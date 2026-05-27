/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/certificadoController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Controller oficial dos certificados de evento/turma.
 * - Geração de PDF com QR Code por codigo_validacao.
 * - Validação pública por código único.
 * - Download autenticado.
 * - Elegibilidade de participante, organizador e palestrante interno.
 * - Emissão documental imutável.
 * - Numeração oficial EMSP-SMS.
 * - Cancelamento/anulação/substituição formal com histórico.
 * - Registro de validações públicas.
 *
 * Contratos oficiais:
 * - req.user.id
 * - req.user.perfil
 * - certificados
 * - certificado_historico
 * - certificado_validacoes
 * - inscricoes
 * - avaliacoes
 * - turma_responsavel
 * - turma_palestrante
 * - turma_certificado_assinante
 * - assinaturas
 *
 * Regras documentais:
 * - Certificado emitido/enviado não é editado.
 * - Certificado emitido/enviado não é sobrescrito.
 * - Certificado emitido/enviado não é resetado.
 * - Correção documental deve ocorrer por cancelamento/anulação/substituição formal.
 *
 * Regras de assinatura:
 * - Assinantes vêm de turma_certificado_assinante.
 * - Ordem oficial vem de turma_certificado_assinante.ordem.
 * - Rafaella Pitol, ID 17, é obrigatória.
 * - Fábio Lopez, ID 2474, quando selecionado, deve ser a última assinatura.
 * - Palestrante externo digitado manualmente não vira assinante automático.
 *
 * Sem legado:
 * - Sem req.usuario.
 * - Sem req.auth.
 * - Sem aliases.
 * - Sem fallback de tabela.
 * - Sem is_assinante.
 * - Sem ordem_assinatura.
 * - Sem reset documental.
 * - Sem validação pública por usuario_id/evento_id/turma_id.
 * - Sem respostas { erro } / { error }.
 */

const crypto = require("crypto");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const {
  desenharCertificadoCompletoV2,
  dataUrlToBuffer,
} = require("../utils/certificadoLayoutPdf");

const dbFallback = require("../db");
const { CERT_DIR, ensureDir } = require("../paths");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;
const MAX_ASSINANTES_TURMA = 3;

const TIPO_CERTIFICADO = Object.freeze({
  USUARIO: "usuario",
  ORGANIZADOR: "organizador",
  PALESTRANTE: "palestrante",
});

const TIPOS_CERTIFICADO_VALIDOS = new Set(Object.values(TIPO_CERTIFICADO));

let gerarNotificacaoDeCertificado = null;

try {
  const notificacaoController = require("./notificacaoController");

  if (
    typeof notificacaoController?.gerarNotificacaoDeCertificado === "function"
  ) {
    gerarNotificacaoDeCertificado =
      notificacaoController.gerarNotificacaoDeCertificado;
  }
} catch {
  gerarNotificacaoDeCertificado = null;
}

/* ─────────────────────────────────────────────
 * Respostas padronizadas
 * ───────────────────────────────────────────── */

function responderSucesso(res, statusCode, data, message, code, extra = {}) {
  return res.status(statusCode).json({
    ok: true,
    data,
    message,
    code,
    ...extra,
  });
}

function responderErro(res, statusCode, message, code, adminHint, details = null) {
  return res.status(statusCode).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
  });
}

/* ─────────────────────────────────────────────
 * Logger
 * ───────────────────────────────────────────── */

function mkRid(prefix = "CERT") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "CERT") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function logInfo(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[certificado][${rid}] ${message}`, extra || "");
  }
}

function logWarn(rid, message, extra) {
  console.warn(`[certificado][${rid}][WARN] ${message}`, extra || "");
}

function logError(rid, message, error) {
  console.error(
    `[certificado][${rid}][ERR] ${message}`,
    error?.stack || error?.message || error
  );
}

/* ─────────────────────────────────────────────
 * DB / transação
 * ───────────────────────────────────────────── */

function getDb(req) {
  if (req?.db && typeof req.db.query === "function") {
    return req.db;
  }

  if (typeof dbFallback?.query === "function") {
    return dbFallback;
  }

  if (typeof dbFallback?.db?.query === "function") {
    return dbFallback.db;
  }

  throw new Error("Contrato inválido: backend/src/db deve exportar query.");
}

async function withTx(req, fn) {
  const pool = req?.db?.pool || dbFallback?.pool || dbFallback?.db?.pool || null;

  if (pool && typeof pool.connect === "function") {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await fn({
        query: client.query.bind(client),
      });

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback não deve ocultar erro original
      }

      throw error;
    } finally {
      client.release();
    }
  }

  const db = getDb(req);

  await db.query("BEGIN");

  try {
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      // rollback não deve ocultar erro original
    }

    throw error;
  }
}

/* ─────────────────────────────────────────────
 * Auth / helpers
 * ───────────────────────────────────────────── */

function getUsuarioId(req) {
  const usuarioId = Number(req?.user?.id);
  return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

function getPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

function isAdministrador(req) {
  return getPerfil(req) === "administrador";
}

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeText(value, max = 5000) {
  if (value == null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  const buffer = await fsp.readFile(filePath);
  return sha256(buffer);
}

function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ymdFromAny(value) {
  if (!value) return "";

  if (isYmd(value)) return value;

  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function dataBR(value) {
  const ymd = ymdFromAny(value);

  if (!ymd) return "";

  const [y, m, d] = ymd.split("-");

  return `${d}/${m}/${y}`;
}

function dataExtensoBR(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${map.day} de ${map.month} de ${map.year}`;
}

function cpfMascarado(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length !== 11) return null;

  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function nomeArquivoSeguro(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

function frontendBaseUrl() {
  return (
    process.env.FRONTEND_BASE_URL ||
    process.env.VITE_FRONTEND_URL ||
    "https://escoladasaude.vercel.app"
  ).replace(/\/+$/, "");
}

function urlValidacaoPublica(codigoValidacao) {
  return `${frontendBaseUrl()}/validar-certificado/${encodeURIComponent(
    codigoValidacao
  )}`;
}

function anoAtualSP() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    year: "numeric",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);

  return Number.isInteger(year) ? year : new Date().getFullYear();
}

function gerarCodigoValidacao(prefixo) {
  const year = anoAtualSP();
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();

  return `EMSP-SMS-${year}-${prefixo}-${random}`;
}

async function gerarNumeroCertificadoEvento(db) {
  const year = anoAtualSP();

  const result = await db.query(
    `
    SELECT nextval('public.certificados_numero_seq')::bigint AS seq
    `
  );

  const seq = Number(result.rows?.[0]?.seq);

  if (!Number.isInteger(seq) || seq <= 0) {
    throw new Error("Falha ao gerar número sequencial do certificado.");
  }

  return `EMSP-SMS-${year}-${String(seq).padStart(6, "0")}`;
}

function registerFonts(doc) {
  const fontsRoot = path.resolve(__dirname, "../../fonts");

  const fonts = [
    ["AlegreyaSans-Regular", "AlegreyaSans-Regular.ttf"],
    ["AlegreyaSans-Bold", "AlegreyaSans-Bold.ttf"],
    ["BreeSerif", "BreeSerif-Regular.ttf"],
    ["AlexBrush", "AlexBrush-Regular.ttf"],
  ];

  for (const [name, file] of fonts) {
    const fontPath = path.join(fontsRoot, file);

    if (!fs.existsSync(fontPath)) continue;

    try {
      doc.registerFont(name, fontPath);
    } catch (error) {
      logWarn(mkRid("FONT"), `Falha ao registrar fonte ${file}`, error.message);
    }
  }
}

async function tryQRCodeDataURL(text) {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    logWarn(mkRid("QRCODE"), "Falha ao gerar QR Code", error.message);
    return null;
  }
}

function horasOuFallback(horasTotal, cargaHoraria) {
  const horas = Number(horasTotal || 0);

  if (Number.isFinite(horas) && horas > 0) return horas;

  const carga = Number(cargaHoraria || 0);

  if (Number.isFinite(carga) && carga > 0) return carga;

  return 0;
}

function cargoAssinantePorId(usuarioId, cargoFallback = "Assinante") {
  const id = Number(usuarioId);

  if (id === RAFAELLA_PITOL_ID) return "Chefe da Escola da Saúde";
  if (id === FABIO_LOPEZ_ID) return "Secretário de Saúde";

  return cargoFallback || "Assinante";
}

/* ─────────────────────────────────────────────
 * Histórico / validação pública
 * ───────────────────────────────────────────── */

async function registrarHistorico(
  db,
  {
    origem,
    certificado_id = null,
    certificado_avulso_id = null,
    acao,
    status_anterior = null,
    status_novo = null,
    motivo = null,
    usuario_id = null,
    metadados_json = {},
  }
) {
  await db.query(
    `
    INSERT INTO certificado_historico (
      origem,
      certificado_id,
      certificado_avulso_id,
      acao,
      status_anterior,
      status_novo,
      motivo,
      usuario_id,
      metadados_json,
      criado_em
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
    `,
    [
      origem,
      certificado_id,
      certificado_avulso_id,
      acao,
      status_anterior,
      status_novo,
      motivo,
      usuario_id,
      JSON.stringify(metadados_json || {}),
    ]
  );
}

async function registrarValidacaoPublica(
  db,
  req,
  {
    origem = null,
    certificado_id = null,
    certificado_avulso_id = null,
    codigo_validacao,
    resultado,
    metadados_json = {},
  }
) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";

  const ipHash = ip ? sha256(String(ip)) : null;
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 1000);

  await db.query(
    `
    INSERT INTO certificado_validacoes (
      origem,
      certificado_id,
      certificado_avulso_id,
      codigo_validacao,
      resultado,
      ip_hash,
      user_agent,
      metadados_json,
      criado_em
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
    `,
    [
      origem,
      certificado_id,
      certificado_avulso_id,
      codigo_validacao,
      resultado,
      ipHash,
      userAgent || null,
      JSON.stringify(metadados_json || {}),
    ]
  );
}

/* ─────────────────────────────────────────────
 * Regras de negócio
 * ───────────────────────────────────────────── */

async function turmaEncerradaSP(db, turmaId) {
  const result = await db.query(
    `
    SELECT
      (NOW() AT TIME ZONE '${TZ}') >=
      COALESCE(
        (
          SELECT MAX(
            dt.data::date +
            COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time)
          )
          FROM datas_turma dt
          JOIN turmas t ON t.id = dt.turma_id
          WHERE dt.turma_id = $1
        ),
        (
          SELECT
            t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time)
          FROM turmas t
          WHERE t.id = $1
          LIMIT 1
        )
      ) AS encerrou
    `,
    [turmaId]
  );

  return result.rows?.[0]?.encerrou === true;
}

async function totalEncontrosTurma(db, turmaId) {
  const result = await db.query(
    `
    WITH dts AS (
      SELECT COUNT(*)::int AS total
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback AS (
      SELECT
        CASE
          WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS total
      FROM turmas t
      WHERE t.id = $1
    )
    SELECT
      CASE
        WHEN (SELECT total FROM dts) > 0 THEN (SELECT total FROM dts)
        ELSE COALESCE((SELECT total FROM fallback), 0)
      END AS total
    `,
    [turmaId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function presencasDistintasUsuarioTurma(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT COUNT(DISTINCT p.data_presenca::date)::int AS total
    FROM presencas p
    WHERE p.turma_id = $1
      AND p.usuario_id = $2
      AND p.presente = TRUE
    `,
    [turmaId, usuarioId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function usuarioEstaInscrito(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM inscricoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rowCount || 0) > 0;
}

async function usuarioFezAvaliacao(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM avaliacoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rowCount || 0) > 0;
}

async function usuarioAprovadoEmQuestionarioObrigatorio(
  db,
  usuarioId,
  eventoId,
  turmaId
) {
  const result = await db.query(
    `
    WITH q AS (
      SELECT
        qe.id,
        qe.min_nota
      FROM questionarios_evento qe
      WHERE qe.evento_id = $2
        AND qe.obrigatorio = TRUE
        AND LOWER(COALESCE(qe.status, '')) = 'publicado'
      ORDER BY qe.id DESC
      LIMIT 1
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM q) THEN TRUE
        ELSE EXISTS (
          SELECT 1
          FROM tentativas_questionario tq
          JOIN q ON q.id = tq.questionario_id
          WHERE tq.usuario_id = $1
            AND tq.turma_id = $3
            AND LOWER(COALESCE(tq.status, '')) = 'enviada'
            AND tq.nota IS NOT NULL
            AND tq.nota >= COALESCE(q.min_nota, 0)
        )
      END AS aprovado
    `,
    [usuarioId, eventoId, turmaId]
  );

  return result.rows?.[0]?.aprovado === true;
}

async function organizadorVinculadoATurma(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM turma_responsavel tr
      WHERE tr.turma_id = $2
        AND tr.usuario_id = $1
        AND tr.papel = 'organizador'
    ) AS vinculado
    `,
    [usuarioId, turmaId]
  );

  return result.rows?.[0]?.vinculado === true;
}

async function palestranteVinculadoATurma(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM turma_palestrante tp
      WHERE tp.turma_id = $2
        AND tp.usuario_id = $1
    ) AS vinculado
    `,
    [usuarioId, turmaId]
  );

  return result.rows?.[0]?.vinculado === true;
}

async function obterContextoTurmaCertificado(db, eventoId, turmaId) {
  const result = await db.query(
    `
    SELECT
      e.id AS evento_id,
      e.titulo,
      e.tipo AS evento_tipo,
      t.id AS turma_id,
      t.nome AS turma_nome,
      t.horario_inicio,
      t.horario_fim,
      t.data_inicio,
      t.data_fim,
      t.carga_horaria
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    WHERE e.id = $1
      AND t.id = $2
    LIMIT 1
    `,
    [eventoId, turmaId]
  );

  return result.rows?.[0] || null;
}

async function resumoDatasTurma(db, turmaId, usuarioId) {
  const result = await db.query(
    `
    WITH base AS (
      SELECT
        MIN(dt.data::date) AS min_data,
        MAX(dt.data::date) AS max_data,
        COUNT(*)::int AS total_aulas,
        SUM(
          EXTRACT(EPOCH FROM (
            COALESCE(dt.horario_fim::time, '23:59'::time) -
            COALESCE(dt.horario_inicio::time, '00:00'::time)
          )) / 3600.0
        ) AS horas_total
      FROM datas_turma dt
      WHERE dt.turma_id = $1
    ),
    pres AS (
      SELECT COUNT(DISTINCT p.data_presenca::date)::int AS presencas_distintas
      FROM presencas p
      WHERE p.turma_id = $1
        AND p.usuario_id = $2
        AND p.presente = TRUE
    )
    SELECT
      base.min_data,
      base.max_data,
      COALESCE(base.total_aulas, 0) AS total_aulas,
      COALESCE(base.horas_total, 0) AS horas_total,
      COALESCE(pres.presencas_distintas, 0) AS presencas_distintas
    FROM base
    LEFT JOIN pres ON TRUE
    `,
    [turmaId, usuarioId]
  );

  const row = result.rows?.[0] || {};

  if (Number(row.total_aulas || 0) > 0) return row;

  const fallback = await db.query(
    `
    SELECT
      t.data_inicio::date AS min_data,
      t.data_fim::date AS max_data,
      CASE
        WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
        ELSE 0
      END::int AS total_aulas,
      COALESCE(t.carga_horaria::numeric, 0) AS horas_total,
      (
        SELECT COUNT(DISTINCT p.data_presenca::date)::int
        FROM presencas p
        WHERE p.turma_id = $1
          AND p.usuario_id = $2
          AND p.presente = TRUE
      ) AS presencas_distintas
    FROM turmas t
    WHERE t.id = $1
    `,
    [turmaId, usuarioId]
  );

  return fallback.rows?.[0] || {};
}

async function obterAssinantesDaTurma(db, turmaId) {
  const result = await db.query(
    `
    SELECT
      tca.usuario_id AS id,
      tca.usuario_id,
      tca.ordem,
      NULLIF(TRIM(u.nome), '') AS nome,
      u.email,
      u.perfil,
      a.imagem_base64
    FROM turma_certificado_assinante tca
    JOIN usuarios u ON u.id = tca.usuario_id
    LEFT JOIN assinaturas a ON a.usuario_id = u.id
    WHERE tca.turma_id = $1
    ORDER BY tca.ordem ASC, u.nome ASC
    `,
    [turmaId]
  );

  const assinantes = (result.rows || [])
    .map((row) => ({
      id: Number(row.id),
      usuario_id: Number(row.usuario_id),
      ordem: Number(row.ordem),
      nome: row.nome || "",
      email: row.email || null,
      perfil: row.perfil || null,
      imagem_base64: row.imagem_base64 || null,
      cargo: cargoAssinantePorId(row.usuario_id, "Assinante"),
      origem: "turma_certificado_assinante",
    }))
    .filter((item) => item.id && item.nome);

  const ids = assinantes.map((item) => Number(item.id));

  if (!ids.includes(RAFAELLA_PITOL_ID)) {
    const error = new Error(
      "A turma não possui a assinatura obrigatória da Rafaella Pitol."
    );
    error.statusCode = 409;
    error.code = "CERTIFICADO_ASSINATURA_RAFAELLA_AUSENTE";
    throw error;
  }

  if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES_TURMA) {
    const error = new Error("A turma deve possuir de 1 a 3 assinantes.");
    error.statusCode = 409;
    error.code = "CERTIFICADO_ASSINANTES_QUANTIDADE_INVALIDA";
    error.details = {
      total_assinantes: assinantes.length,
    };
    throw error;
  }

  const fabioIndex = ids.indexOf(FABIO_LOPEZ_ID);

  if (fabioIndex !== -1 && fabioIndex !== assinantes.length - 1) {
    const error = new Error(
      "Fábio Lopez deve ser a última assinatura quando selecionado."
    );
    error.statusCode = 409;
    error.code = "CERTIFICADO_ASSINATURA_FABIO_ORDEM_INVALIDA";
    throw error;
  }

  const rafaellaIndex = ids.indexOf(RAFAELLA_PITOL_ID);

  if (fabioIndex === -1 && rafaellaIndex !== assinantes.length - 1) {
    const error = new Error(
      "Rafaella Pitol deve ser a última assinatura quando Fábio Lopez não estiver selecionado."
    );
    error.statusCode = 409;
    error.code = "CERTIFICADO_ASSINATURA_RAFAELLA_ORDEM_INVALIDA";
    throw error;
  }

  if (fabioIndex !== -1 && rafaellaIndex !== fabioIndex - 1) {
    const error = new Error(
      "Rafaella Pitol deve ficar imediatamente antes de Fábio Lopez quando ambos estiverem presentes."
    );
    error.statusCode = 409;
    error.code = "CERTIFICADO_ASSINATURA_RAFAELLA_FABIO_ORDEM_INVALIDA";
    throw error;
  }

  return assinantes;
}

function montarAssinaturasLayout(assinantes = []) {
  return assinantes.map((assinante) => ({
    nome: assinante.nome,
    cargo: assinante.cargo,
    imgBuffer: dataUrlToBuffer(assinante.imagem_base64),
  }));
}

/* ─────────────────────────────────────────────
 * PDF
 * ───────────────────────────────────────────── */

async function gerarPdfFisico({
  tipo,
  usuario_id,
  evento_id,
  turma_id,
  numero_certificado,
  codigo_validacao,
  contextoTurma,
  nomeUsuario,
  cpfUsuario,
  horasTotal,
  minData,
  maxData,
  db,
}) {
  await ensureDir(CERT_DIR);

  const nomeArquivo = nomeArquivoSeguro(
    `certificado_${tipo}_${codigo_validacao}.pdf`
  );
  const caminho = path.join(CERT_DIR, nomeArquivo);
  const tmpPath = `${caminho}.tmp`;

  const diYmd = ymdFromAny(minData || contextoTurma.data_inicio);
  const dfYmd = ymdFromAny(maxData || contextoTurma.data_fim);
  const mesmoDia = diYmd && dfYmd && diYmd === dfYmd;

  const dataInicioBR = dataBR(diYmd);
  const dataFimBR = dataBR(dfYmd);
  const dataHojeExtenso = dataExtensoBR(new Date());

  const cargaTexto = horasOuFallback(horasTotal, contextoTurma.carga_horaria);
  const tituloEvento = contextoTurma.titulo || "evento";
  const turmaNome =
    contextoTurma.turma_nome || contextoTurma.nome_turma || `Turma #${turma_id}`;

  const linkValidacao = urlValidacaoPublica(codigo_validacao);
  const qrDataURL = await tryQRCodeDataURL(linkValidacao);
  const assinantes = await obterAssinantesDaTurma(db, turma_id);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 40,
    info: {
      Title: `Certificado ${numero_certificado}`,
      Author: "Escola da Saúde",
      Subject: tituloEvento,
      Keywords: `certificado, ${codigo_validacao}, escola da saúde`,
    },
  });

  const writeStream = fs.createWriteStream(tmpPath);

  const finished = new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });

  doc.pipe(writeStream);
  registerFonts(doc);

  const cpfMask = cpfMascarado(cpfUsuario);

  let textoPrincipal;

  if (tipo === TIPO_CERTIFICADO.ORGANIZADOR) {
    textoPrincipal = mesmoDia
      ? `Participou como organizador(a) do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
      : `Participou como organizador(a) do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`;
  } else if (tipo === TIPO_CERTIFICADO.PALESTRANTE) {
    textoPrincipal = mesmoDia
      ? `Participou como palestrante do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
      : `Participou como palestrante do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`;
  } else {
    textoPrincipal = mesmoDia
      ? `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
      : `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`;
  }

  desenharCertificadoCompletoV2(doc, {
    modelo:
      tipo === TIPO_CERTIFICADO.ORGANIZADOR ||
      tipo === TIPO_CERTIFICADO.PALESTRANTE
        ? "organizador"
        : "padrao",
    nome: nomeUsuario,
    identificadorTexto: cpfMask ? `Identificador: ${cpfMask}` : null,
    textoPrincipal,
    dataTexto: `Santos, ${dataHojeExtenso}.`,
    assinaturas: montarAssinaturasLayout(assinantes),
    numeroCertificado: numero_certificado,
    codigoValidacao: codigo_validacao,
    validacaoUrl: linkValidacao,
    qrDataUrl: qrDataURL,
    subtitulo: "Documento eletrônico emitido pela Plataforma Escola da Saúde",
    fonts: {
      regular: "AlegreyaSans-Regular",
      bold: "AlegreyaSans-Bold",
      serif: "BreeSerif",
      script: "AlexBrush",
    },
  });

  doc.end();

  await finished;

  await fsp.rename(tmpPath, caminho).catch(async () => {
    await fsp.copyFile(tmpPath, caminho);
    await fsp.unlink(tmpPath).catch(() => {});
  });

  const hashPdf = await sha256File(caminho);

  return {
    nomeArquivo,
    caminho,
    hash_pdf: hashPdf,
    dados_assinatura_json: {
      assinantes: assinantes.map((assinante) => ({
        usuario_id: assinante.usuario_id,
        nome: assinante.nome,
        cargo: assinante.cargo,
        ordem: assinante.ordem,
        assinatura_visual: Boolean(assinante.imagem_base64),
        origem: assinante.origem,
      })),
      rafaella_obrigatoria: true,
      fabio_ultimo_quando_presente: true,
      validacao_url: linkValidacao,
    },
  };
}

function montarHashDadosCertificado({
  id = null,
  usuario_id,
  evento_id,
  turma_id,
  tipo,
  numero_certificado,
  arquivo_pdf,
  codigo_validacao,
  gerado_em = null,
}) {
  return sha256(
    JSON.stringify({
      origem: "evento",
      id,
      usuario_id,
      evento_id,
      turma_id,
      tipo,
      numero_certificado,
      arquivo_pdf,
      codigo_validacao,
      gerado_em,
    })
  );
}

/* ─────────────────────────────────────────────
 * Público — validação por código
 * ───────────────────────────────────────────── */

async function validarCertificadoPublico(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const codigo = String(req.params?.codigo_validacao || "").trim().toUpperCase();

  if (!codigo) {
    return responderErro(
      res,
      400,
      "Código de validação não informado.",
      "CERTIFICADO_CODIGO_AUSENTE",
      "A validação pública foi chamada sem codigo_validacao."
    );
  }

  try {
    const regular = await db.query(
      `
      SELECT
        c.id,
        c.codigo_validacao,
        c.status,
        c.tipo,
        c.hash_dados,
        c.hash_pdf,
        c.algoritmo_hash,
        c.gerado_em,
        c.revalidado_em,
        c.enviado_em,
        c.cancelado_em,
        c.motivo_cancelamento,
        u.nome AS nome_participante,
        e.titulo AS nome_evento,
        t.nome AS nome_turma,
        t.carga_horaria,
        t.data_inicio,
        t.data_fim
      FROM certificados c
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN eventos e ON e.id = c.evento_id
      JOIN turmas t ON t.id = c.turma_id
      WHERE c.codigo_validacao = $1
      LIMIT 1
      `,
      [codigo]
    );

    if (regular.rowCount > 0) {
      const row = regular.rows[0];
      const resultado =
        row.status === "emitido" || row.status === "enviado"
          ? "valido"
          : row.status === "cancelado"
            ? "cancelado"
            : row.status === "anulado"
              ? "anulado"
              : row.status === "substituido"
                ? "substituido"
                : "erro";

      await registrarValidacaoPublica(db, req, {
        origem: "evento",
        certificado_id: row.id,
        codigo_validacao: codigo,
        resultado,
      });

      return responderSucesso(
        res,
        200,
        {
          valido: resultado === "valido",
          origem: "evento",
          codigo_validacao: row.codigo_validacao,
          status: row.status,
          participante: row.nome_participante,
          evento: row.nome_evento,
          turma: row.nome_turma,
          tipo: row.tipo,
          carga_horaria: row.carga_horaria,
          data_inicio: ymdFromAny(row.data_inicio),
          data_fim: ymdFromAny(row.data_fim),
          emitido_em: row.gerado_em,
          revalidado_em: row.revalidado_em,
          enviado_em: row.enviado_em,
          cancelado_em: row.cancelado_em,
          motivo_cancelamento: row.motivo_cancelamento,
          algoritmo_hash: row.algoritmo_hash,
          hash_dados: row.hash_dados,
        },
        resultado === "valido"
          ? "Certificado válido."
          : "Certificado localizado, mas não está válido.",
        "CERTIFICADO_VALIDACAO_PUBLICA_OK"
      );
    }

    const avulso = await db.query(
      `
      SELECT
        c.id,
        c.codigo_validacao,
        c.status,
        c.hash_dados,
        c.hash_pdf,
        c.algoritmo_hash,
        c.emitido_em,
        c.enviado_em,
        c.cancelado_em,
        c.motivo_cancelamento,
        c.nome,
        c.email,
        c.curso,
        c.carga_horaria,
        c.data_inicio,
        c.data_fim,
        c.modalidade,
        c.titulo_trabalho,
        c.identificador_tipo,
        c.identificador_mascarado
      FROM certificados_avulsos c
      WHERE c.codigo_validacao = $1
      LIMIT 1
      `,
      [codigo]
    );

    if (avulso.rowCount > 0) {
      const row = avulso.rows[0];
      const resultado =
        row.status === "emitido" || row.status === "enviado"
          ? "valido"
          : row.status === "cancelado"
            ? "cancelado"
            : row.status === "anulado"
              ? "anulado"
              : row.status === "substituido"
                ? "substituido"
                : "erro";

      await registrarValidacaoPublica(db, req, {
        origem: "avulso",
        certificado_avulso_id: row.id,
        codigo_validacao: codigo,
        resultado,
      });

      return responderSucesso(
        res,
        200,
        {
          valido: resultado === "valido",
          origem: "avulso",
          codigo_validacao: row.codigo_validacao,
          status: row.status,
          participante: row.nome,
          curso: row.curso,
          carga_horaria: row.carga_horaria,
          data_inicio: ymdFromAny(row.data_inicio),
          data_fim: ymdFromAny(row.data_fim),
          modalidade: row.modalidade,
          titulo_trabalho: row.titulo_trabalho,
          identificador_tipo: row.identificador_tipo,
          identificador_mascarado: row.identificador_mascarado,
          emitido_em: row.emitido_em,
          enviado_em: row.enviado_em,
          cancelado_em: row.cancelado_em,
          motivo_cancelamento: row.motivo_cancelamento,
          algoritmo_hash: row.algoritmo_hash,
          hash_dados: row.hash_dados,
        },
        resultado === "valido"
          ? "Certificado válido."
          : "Certificado localizado, mas não está válido.",
        "CERTIFICADO_VALIDACAO_PUBLICA_OK"
      );
    }

    await registrarValidacaoPublica(db, req, {
      codigo_validacao: codigo,
      resultado: "nao_encontrado",
    });

    return responderSucesso(
      res,
      200,
      {
        valido: false,
        codigo_validacao: codigo,
        status: "nao_encontrado",
      },
      "Certificado não encontrado.",
      "CERTIFICADO_VALIDACAO_PUBLICA_NAO_ENCONTRADO"
    );
  } catch (error) {
    logError(rid, "Erro na validação pública de certificado", error);

    return responderErro(
      res,
      500,
      "Erro ao validar certificado.",
      "CERTIFICADO_VALIDACAO_PUBLICA_ERRO",
      "Falha inesperada em validarCertificadoPublico.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Geração
 * ───────────────────────────────────────────── */

async function gerarCertificado(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  const usuarioId = toPositiveInt(req.body?.usuario_id);
  const eventoId = toPositiveInt(req.body?.evento_id);
  const turmaId = toPositiveInt(req.body?.turma_id);
  const tipo = String(req.body?.tipo || "").trim().toLowerCase();
  const authUserId = getUsuarioId(req);

  if (!authUserId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!usuarioId || !eventoId || !turmaId) {
    return responderErro(
      res,
      400,
      "Parâmetros obrigatórios inválidos.",
      "CERTIFICADO_PARAMETROS_INVALIDOS",
      "usuario_id, evento_id e turma_id devem ser inteiros positivos."
    );
  }

  if (!TIPOS_CERTIFICADO_VALIDOS.has(tipo)) {
    return responderErro(
      res,
      400,
      "Tipo de certificado inválido.",
      "CERTIFICADO_TIPO_INVALIDO",
      "tipo deve ser usuario, organizador ou palestrante."
    );
  }

  try {
    const contextoTurma = await obterContextoTurmaCertificado(
      db,
      eventoId,
      turmaId
    );

    if (!contextoTurma) {
      return responderErro(
        res,
        404,
        "Evento ou turma não encontrados.",
        "CERTIFICADO_TURMA_NAO_ENCONTRADA",
        "Não foi localizada turma vinculada ao evento informado."
      );
    }

    const pessoa = await db.query(
      `
      SELECT id, nome, cpf, email
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (pessoa.rowCount === 0) {
      return responderErro(
        res,
        404,
        "Usuário não encontrado.",
        "CERTIFICADO_USUARIO_NAO_ENCONTRADO",
        "Não há usuário para o usuario_id informado."
      );
    }

    const encerrou = await turmaEncerradaSP(db, turmaId);

    if (!encerrou) {
      return responderErro(
        res,
        403,
        "A turma ainda não encerrou.",
        "CERTIFICADO_TURMA_NAO_ENCERRADA",
        "A emissão só é permitida após o fim real da turma."
      );
    }

    if (tipo === TIPO_CERTIFICADO.ORGANIZADOR) {
      const vinculado = await organizadorVinculadoATurma(db, usuarioId, turmaId);

      if (!vinculado) {
        return responderErro(
          res,
          403,
          "Usuário não está vinculado como organizador nesta turma.",
          "CERTIFICADO_ORGANIZADOR_NAO_VINCULADO",
          "Não há vínculo em turma_responsavel com papel organizador."
        );
      }
    }

    if (tipo === TIPO_CERTIFICADO.PALESTRANTE) {
      const vinculado = await palestranteVinculadoATurma(db, usuarioId, turmaId);

      if (!vinculado) {
        return responderErro(
          res,
          403,
          "Usuário não está vinculado como palestrante cadastrado nesta turma.",
          "CERTIFICADO_PALESTRANTE_NAO_VINCULADO",
          "Palestrante externo sem usuario_id não pode gerar certificado interno automático."
        );
      }
    }

    if (tipo === TIPO_CERTIFICADO.USUARIO) {
      const inscrito = await usuarioEstaInscrito(db, usuarioId, turmaId);

      if (!inscrito) {
        return responderErro(
          res,
          403,
          "Usuário não está inscrito nesta turma.",
          "CERTIFICADO_USUARIO_NAO_INSCRITO",
          "Não há inscrição correspondente em inscricoes."
        );
      }

      const totalAulas = await totalEncontrosTurma(db, turmaId);
      const presencas = await presencasDistintasUsuarioTurma(
        db,
        usuarioId,
        turmaId
      );
      const percentual = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;

      if (percentual < 75) {
        return responderErro(
          res,
          403,
          "Frequência insuficiente para emissão do certificado.",
          "CERTIFICADO_FREQUENCIA_INSUFICIENTE",
          "O usuário não atingiu presença mínima de 75%.",
          {
            total_aulas: totalAulas,
            presencas,
            percentual: Number(percentual.toFixed(2)),
          }
        );
      }

      const fezAvaliacao = await usuarioFezAvaliacao(db, usuarioId, turmaId);

      if (!fezAvaliacao) {
        return responderErro(
          res,
          403,
          "É necessário enviar a avaliação do evento para liberar o certificado.",
          "CERTIFICADO_AVALIACAO_PENDENTE",
          "Não há registro em avaliacoes para usuario_id/turma_id."
        );
      }

      const questionarioOk = await usuarioAprovadoEmQuestionarioObrigatorio(
        db,
        usuarioId,
        eventoId,
        turmaId
      );

      if (!questionarioOk) {
        return responderErro(
          res,
          403,
          "É necessário ser aprovado no questionário obrigatório para liberar o certificado.",
          "CERTIFICADO_QUESTIONARIO_PENDENTE",
          "Há questionário obrigatório publicado sem tentativa aprovada."
        );
      }
    }

    const resumo = await resumoDatasTurma(db, turmaId, usuarioId);

    const result = await withTx(req, async (tx) => {
      const existente = await tx.query(
        `
        SELECT
          id,
          numero_certificado,
          codigo_validacao,
          status,
          arquivo_pdf,
          hash_pdf,
          hash_dados,
          gerado_em
        FROM certificados
        WHERE usuario_id = $1
          AND evento_id = $2
          AND turma_id = $3
          AND tipo = $4
        LIMIT 1
        FOR UPDATE
        `,
        [usuarioId, eventoId, turmaId, tipo]
      );

      const certificadoAnterior = existente.rows?.[0] || null;

      if (certificadoAnterior) {
        if (["emitido", "enviado"].includes(certificadoAnterior.status)) {
          return {
            ja_existia: true,
            certificado: certificadoAnterior,
          };
        }

        if (
          ["cancelado", "anulado", "substituido"].includes(
            certificadoAnterior.status
          )
        ) {
          const error = new Error(
            "Já existe certificado anterior com status final. Use substituição formal."
          );
          error.statusCode = 409;
          error.code = "CERTIFICADO_EXISTENTE_STATUS_FINAL";
          error.details = {
            certificado_id: certificadoAnterior.id,
            status: certificadoAnterior.status,
            numero_certificado: certificadoAnterior.numero_certificado,
          };
          throw error;
        }

        if (certificadoAnterior.status === "erro_emissao") {
          const error = new Error(
            "Certificado em erro técnico deve ser tratado pela rotina de reprocessamento de erro."
          );
          error.statusCode = 409;
          error.code = "CERTIFICADO_EXISTENTE_ERRO_EMISSAO";
          error.details = {
            certificado_id: certificadoAnterior.id,
            status: certificadoAnterior.status,
            numero_certificado: certificadoAnterior.numero_certificado,
          };
          throw error;
        }
      }

      const numeroCertificado = await gerarNumeroCertificadoEvento(tx);
      const codigoValidacao = gerarCodigoValidacao("CERT");

      const pdf = await gerarPdfFisico({
        tipo,
        usuario_id: usuarioId,
        evento_id: eventoId,
        turma_id: turmaId,
        numero_certificado: numeroCertificado,
        codigo_validacao: codigoValidacao,
        contextoTurma,
        nomeUsuario: pessoa.rows[0].nome,
        cpfUsuario: pessoa.rows[0].cpf || "",
        horasTotal: Number(resumo.horas_total || 0),
        minData: resumo.min_data || contextoTurma.data_inicio,
        maxData: resumo.max_data || contextoTurma.data_fim,
        db: tx,
      });

      const metadados = {
        origem: "evento",
        usuario_id: usuarioId,
        evento_id: eventoId,
        turma_id: turmaId,
        tipo,
        numero_certificado: numeroCertificado,
        evento_titulo: contextoTurma.titulo,
        turma_nome: contextoTurma.turma_nome,
        data_inicio: ymdFromAny(resumo.min_data || contextoTurma.data_inicio),
        data_fim: ymdFromAny(resumo.max_data || contextoTurma.data_fim),
        horas_total: Number(resumo.horas_total || 0),
        codigo_validacao: codigoValidacao,
        validacao_url: urlValidacaoPublica(codigoValidacao),
      };

      const hashDados = montarHashDadosCertificado({
        usuario_id: usuarioId,
        evento_id: eventoId,
        turma_id: turmaId,
        tipo,
        numero_certificado: numeroCertificado,
        arquivo_pdf: pdf.nomeArquivo,
        codigo_validacao: codigoValidacao,
      });

      const insert = await tx.query(
        `
        INSERT INTO certificados (
          usuario_id,
          evento_id,
          turma_id,
          tipo,
          numero_certificado,
          arquivo_pdf,
          gerado_em,
          codigo_validacao,
          status,
          hash_pdf,
          hash_dados,
          algoritmo_hash,
          emitido_por,
          metadados_json,
          dados_assinatura_json,
          atualizado_em
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, NOW(),
          $7, 'emitido', $8, $9, 'sha256',
          $10, $11::jsonb, $12::jsonb, NOW()
        )
        RETURNING
          id,
          usuario_id,
          evento_id,
          turma_id,
          tipo,
          numero_certificado,
          codigo_validacao,
          status,
          arquivo_pdf,
          hash_pdf,
          hash_dados,
          gerado_em
        `,
        [
          usuarioId,
          eventoId,
          turmaId,
          tipo,
          numeroCertificado,
          pdf.nomeArquivo,
          codigoValidacao,
          pdf.hash_pdf,
          hashDados,
          authUserId,
          JSON.stringify(metadados),
          JSON.stringify(pdf.dados_assinatura_json),
        ]
      );

      const certificado = insert.rows[0];

      await registrarHistorico(tx, {
        origem: "evento",
        certificado_id: certificado.id,
        acao: "emitido",
        status_anterior: null,
        status_novo: certificado.status,
        motivo: "Certificado emitido pela geração documental v2.1.",
        usuario_id: authUserId,
        metadados_json: {
          numero_certificado: certificado.numero_certificado,
          arquivo_pdf: certificado.arquivo_pdf,
          codigo_validacao: certificado.codigo_validacao,
          hash_pdf: certificado.hash_pdf,
          hash_dados: certificado.hash_dados,
          tipo,
        },
      });

      return {
        ja_existia: false,
        certificado,
      };
    });

    if (result.ja_existia) {
      return responderSucesso(
        res,
        200,
        result.certificado,
        "Certificado já havia sido emitido. O documento existente foi preservado.",
        "CERTIFICADO_JA_EMITIDO"
      );
    }

    if (typeof gerarNotificacaoDeCertificado === "function") {
      gerarNotificacaoDeCertificado(usuarioId, {
        turma_id: turmaId,
        evento_id: eventoId,
        evento_titulo: contextoTurma.titulo || "evento",
      }).catch((error) => {
        logWarn(rid, "Notificação de certificado falhou", error.message);
      });
    }

    return responderSucesso(
      res,
      201,
      result.certificado,
      "Certificado gerado com sucesso.",
      "CERTIFICADO_GERADO"
    );
  } catch (error) {
    logError(rid, "Erro ao gerar certificado", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode === 409
        ? error.message
      : "Erro ao gerar certificado.",
      error.code || "CERTIFICADO_GERAR_ERRO",
      "Falha inesperada em gerarCertificado.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

/* ─────────────────────────────────────────────
 * Consultas auxiliares de certificado
 * ───────────────────────────────────────────── */

async function obterCertificadoPorId(db, certificadoId) {
  const result = await db.query(
    `
    SELECT
      c.id,
      c.usuario_id,
      c.evento_id,
      c.turma_id,
      c.tipo,
      c.numero_certificado,
      c.codigo_validacao,
      c.status,
      c.arquivo_pdf,
      c.hash_pdf,
      c.hash_dados,
      c.algoritmo_hash,
      c.gerado_em,
      c.revalidado_em,
      c.enviado_em,
      c.cancelado_em,
      c.cancelado_por,
      c.motivo_cancelamento,
      c.substitui_certificado_id,
      c.substituido_por_certificado_id,
      c.metadados_json,
      c.dados_assinatura_json,
      u.nome AS usuario_nome,
      u.email AS usuario_email,
      u.cpf AS usuario_cpf,
      e.titulo AS evento_titulo,
      t.nome AS turma_nome,
      t.data_inicio,
      t.data_fim,
      t.carga_horaria
    FROM certificados c
    JOIN usuarios u ON u.id = c.usuario_id
    JOIN eventos e ON e.id = c.evento_id
    JOIN turmas t ON t.id = c.turma_id
    WHERE c.id = $1
    LIMIT 1
    `,
    [certificadoId]
  );

  return result.rows?.[0] || null;
}

function usuarioPodeAcessarCertificado(req, certificado) {
  if (!certificado) return false;
  if (isAdministrador(req)) return true;

  const usuarioId = getUsuarioId(req);

  return usuarioId && Number(certificado.usuario_id) === Number(usuarioId);
}

function caminhoCertificadoPdf(arquivoPdf) {
  const arquivoSeguro = path.basename(String(arquivoPdf || ""));

  if (!arquivoSeguro) return null;

  return path.join(CERT_DIR, arquivoSeguro);
}

/* ─────────────────────────────────────────────
 * Download autenticado
 * ───────────────────────────────────────────── */

async function downloadCertificado(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const certificadoId = toPositiveInt(req.params?.id);

  if (!certificadoId) {
    return responderErro(
      res,
      400,
      "ID do certificado inválido.",
      "CERTIFICADO_ID_INVALIDO",
      "req.params.id deve ser inteiro positivo."
    );
  }

  try {
    const certificado = await obterCertificadoPorId(db, certificadoId);

    if (!certificado) {
      return responderErro(
        res,
        404,
        "Certificado não encontrado.",
        "CERTIFICADO_NAO_ENCONTRADO",
        "Nenhum certificado localizado para o ID informado."
      );
    }

    if (!usuarioPodeAcessarCertificado(req, certificado)) {
      return responderErro(
        res,
        403,
        "Você não tem permissão para acessar este certificado.",
        "CERTIFICADO_ACESSO_NEGADO",
        "Usuário autenticado não é dono do certificado e não é administrador."
      );
    }

    if (
      certificado.status === "cancelado" ||
      certificado.status === "anulado" ||
      certificado.status === "substituido"
    ) {
      return responderErro(
        res,
        409,
        "Este certificado não está disponível para download.",
        "CERTIFICADO_STATUS_INDISPONIVEL",
        "Certificados cancelados, anulados ou substituídos não devem ser baixados como válidos.",
        {
          status: certificado.status,
          motivo_cancelamento: certificado.motivo_cancelamento || null,
        }
      );
    }

    const filePath = caminhoCertificadoPdf(certificado.arquivo_pdf);

    console.log("[CERTIFICADO][DOWNLOAD][DEBUG]", {
  CERT_DIR,
  arquivo_pdf: certificado.arquivo_pdf,
  filePath,
  exists: filePath ? fs.existsSync(filePath) : false,
});

    let finalFilePath = filePath;

if (!finalFilePath || !fs.existsSync(finalFilePath)) {
  logWarn(rid, "PDF físico ausente. Tentando reconstruir certificado.", {
    certificado_id: certificado.id,
    arquivo_pdf: certificado.arquivo_pdf,
    CERT_DIR,
  });

  const resumo = await resumoDatasTurma(
    db,
    certificado.turma_id,
    certificado.usuario_id
  );

  const contextoTurma = {
    evento_id: certificado.evento_id,
    turma_id: certificado.turma_id,
    titulo: certificado.evento_titulo,
    turma_nome: certificado.turma_nome,
    data_inicio: certificado.data_inicio,
    data_fim: certificado.data_fim,
    carga_horaria: certificado.carga_horaria,
  };

  const pdf = await gerarPdfFisico({
    tipo: certificado.tipo,
    usuario_id: certificado.usuario_id,
    evento_id: certificado.evento_id,
    turma_id: certificado.turma_id,
    numero_certificado: certificado.numero_certificado,
    codigo_validacao: certificado.codigo_validacao,
    contextoTurma,
    nomeUsuario: certificado.usuario_nome,
    cpfUsuario: certificado.usuario_cpf || "",
    horasTotal: Number(resumo.horas_total || certificado.carga_horaria || 0),
    minData: resumo.min_data || certificado.data_inicio,
    maxData: resumo.max_data || certificado.data_fim,
    db,
  });

  finalFilePath = pdf.caminho;

  await db.query(
    `
    UPDATE certificados
    SET
      arquivo_pdf = $2,
      hash_pdf = $3,
      dados_assinatura_json = $4::jsonb,
      atualizado_em = NOW()
    WHERE id = $1
    `,
    [
      certificado.id,
      pdf.nomeArquivo,
      pdf.hash_pdf,
      JSON.stringify(pdf.dados_assinatura_json || {}),
    ]
  );

  certificado.arquivo_pdf = pdf.nomeArquivo;
  certificado.hash_pdf = pdf.hash_pdf;
}

    const filename = nomeArquivoSeguro(
      `${certificado.numero_certificado || "certificado"}.pdf`
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename || "certificado.pdf"}"`
    );
    res.setHeader("Cache-Control", "private, no-store");

    return fs.createReadStream(finalFilePath).pipe(res);
  } catch (error) {
    logError(rid, "Erro ao baixar certificado", error);

    return responderErro(
      res,
      500,
      "Erro ao baixar certificado.",
      "CERTIFICADO_DOWNLOAD_ERRO",
      "Falha inesperada em downloadCertificado.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Listagem do usuário autenticado
 * ───────────────────────────────────────────── */

async function listarCertificadoUsuario(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        c.id,
        c.usuario_id,
        c.evento_id,
        c.turma_id,
        c.tipo,
        c.numero_certificado,
        c.codigo_validacao,
        c.status,
        c.gerado_em,
        c.enviado_em,
        c.cancelado_em,
        c.motivo_cancelamento,
        c.hash_pdf,
        c.hash_dados,
        c.algoritmo_hash,
        e.titulo AS evento_titulo,
        t.nome AS turma_nome,
        t.data_inicio,
        t.data_fim,
        t.carga_horaria
      FROM certificados c
      JOIN eventos e ON e.id = c.evento_id
      JOIN turmas t ON t.id = c.turma_id
      WHERE c.usuario_id = $1
      ORDER BY c.gerado_em DESC NULLS LAST, c.id DESC
      `,
      [usuarioId]
    );

    return responderSucesso(
      res,
      200,
      result.rows || [],
      "Certificados do usuário carregados.",
      "CERTIFICADO_USUARIO_LISTA_OK",
      {
        meta: {
          total: result.rows?.length || 0,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao listar certificados do usuário", error);

    return responderErro(
      res,
      500,
      "Erro ao listar certificados.",
      "CERTIFICADO_USUARIO_LISTA_ERRO",
      "Falha inesperada em listarCertificadoUsuario.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Listagem administrativa por turma
 * ───────────────────────────────────────────── */

async function listarCertificadosPorTurma(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const turmaId = toPositiveInt(req.params?.turma_id || req.params?.id);

  if (!isAdministrador(req)) {
    return responderErro(
      res,
      403,
      "Acesso restrito a administradores.",
      "CERTIFICADO_ADMIN_REQUERIDO",
      "Somente administrador pode consultar certificados por turma."
    );
  }

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "ID da turma inválido.",
      "CERTIFICADO_TURMA_ID_INVALIDO",
      "turma_id deve ser inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        c.id,
        c.usuario_id,
        c.evento_id,
        c.turma_id,
        c.tipo,
        c.numero_certificado,
        c.codigo_validacao,
        c.status,
        c.gerado_em,
        c.enviado_em,
        c.cancelado_em,
        c.motivo_cancelamento,
        c.hash_pdf,
        c.hash_dados,
        c.algoritmo_hash,
        u.nome AS usuario_nome,
        u.email AS usuario_email,
        u.cpf AS usuario_cpf,
        e.titulo AS evento_titulo,
        t.nome AS turma_nome
      FROM certificados c
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN eventos e ON e.id = c.evento_id
      JOIN turmas t ON t.id = c.turma_id
      WHERE c.turma_id = $1
      ORDER BY
        u.nome ASC,
        c.tipo ASC,
        c.gerado_em DESC NULLS LAST,
        c.id DESC
      `,
      [turmaId]
    );

    return responderSucesso(
      res,
      200,
      result.rows || [],
      "Certificados da turma carregados.",
      "CERTIFICADO_TURMA_LISTA_OK",
      {
        meta: {
          turma_id: turmaId,
          total: result.rows?.length || 0,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao listar certificados por turma", error);

    return responderErro(
      res,
      500,
      "Erro ao listar certificados da turma.",
      "CERTIFICADO_TURMA_LISTA_ERRO",
      "Falha inesperada em listarCertificadosPorTurma.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Elegíveis por turma
 * ───────────────────────────────────────────── */

async function listarElegiveisPorTurma(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const turmaId = toPositiveInt(req.params?.turma_id || req.params?.id);

  if (!isAdministrador(req)) {
    return responderErro(
      res,
      403,
      "Acesso restrito a administradores.",
      "CERTIFICADO_ADMIN_REQUERIDO",
      "Somente administrador pode listar elegíveis por turma."
    );
  }

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "ID da turma inválido.",
      "CERTIFICADO_TURMA_ID_INVALIDO",
      "turma_id deve ser inteiro positivo."
    );
  }

  try {
    const turmaResult = await db.query(
      `
      SELECT
        t.id AS turma_id,
        t.evento_id,
        t.nome AS turma_nome,
        e.titulo AS evento_titulo
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    const turma = turmaResult.rows?.[0] || null;

    if (!turma) {
      return responderErro(
        res,
        404,
        "Turma não encontrada.",
        "CERTIFICADO_TURMA_NAO_ENCONTRADA",
        "Não foi localizada turma para o ID informado."
      );
    }

    const participantes = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.email,
        'usuario' AS tipo
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const organizadores = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.email,
        'organizador' AS tipo
      FROM turma_responsavel tr
      JOIN usuarios u ON u.id = tr.usuario_id
      WHERE tr.turma_id = $1
        AND tr.papel = 'organizador'
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const palestrantes = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.email,
        'palestrante' AS tipo
      FROM turma_palestrante tp
      JOIN usuarios u ON u.id = tp.usuario_id
      WHERE tp.turma_id = $1
        AND tp.usuario_id IS NOT NULL
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const certificados = await db.query(
      `
      SELECT usuario_id, tipo, status, id, numero_certificado, codigo_validacao
      FROM certificados
      WHERE turma_id = $1
      `,
      [turmaId]
    );

    const certMap = new Map();

    for (const cert of certificados.rows || []) {
      certMap.set(`${cert.usuario_id}:${cert.tipo}`, cert);
    }

    const lista = [
      ...(participantes.rows || []),
      ...(organizadores.rows || []),
      ...(palestrantes.rows || []),
    ].map((item) => {
      const certificado = certMap.get(`${item.usuario_id}:${item.tipo}`) || null;

      return {
        ...item,
        evento_id: Number(turma.evento_id),
        turma_id: Number(turma.turma_id),
        evento_titulo: turma.evento_titulo,
        turma_nome: turma.turma_nome,
        certificado_emitido: Boolean(certificado),
        certificado: certificado
          ? {
              id: certificado.id,
              numero_certificado: certificado.numero_certificado,
              codigo_validacao: certificado.codigo_validacao,
              status: certificado.status,
            }
          : null,
      };
    });

    return responderSucesso(
      res,
      200,
      lista,
      "Elegíveis para certificado carregados.",
      "CERTIFICADO_ELEGIVEIS_TURMA_OK",
      {
        meta: {
          turma_id: turmaId,
          total: lista.length,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao listar elegíveis por turma", error);

    return responderErro(
      res,
      500,
      "Erro ao listar elegíveis da turma.",
      "CERTIFICADO_ELEGIVEIS_TURMA_ERRO",
      "Falha inesperada em listarElegiveisPorTurma.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Árvore administrativa
 * ───────────────────────────────────────────── */

async function listarAdminArvore(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  if (!isAdministrador(req)) {
    return responderErro(
      res,
      403,
      "Acesso restrito a administradores.",
      "CERTIFICADO_ADMIN_REQUERIDO",
      "Somente administrador pode acessar a árvore administrativa de certificados."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        t.data_inicio,
        t.data_fim,
        COUNT(DISTINCT i.usuario_id)::int AS total_inscritos,
        COUNT(DISTINCT c.id)::int AS total_certificados,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status IN ('emitido', 'enviado')
        )::int AS certificados_validos,
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.status IN ('cancelado', 'anulado', 'substituido')
        )::int AS certificados_invalidos
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN inscricoes i ON i.turma_id = t.id
      LEFT JOIN certificados c ON c.turma_id = t.id
      GROUP BY
        e.id,
        e.titulo,
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim
      ORDER BY
        COALESCE(t.data_inicio, t.data_fim) DESC NULLS LAST,
        e.titulo ASC,
        t.nome ASC
      `
    );

    const eventosMap = new Map();

    for (const row of result.rows || []) {
      const eventoId = Number(row.evento_id);

      if (!eventosMap.has(eventoId)) {
        eventosMap.set(eventoId, {
          evento_id: eventoId,
          evento_titulo: row.evento_titulo,
          turmas: [],
        });
      }

      eventosMap.get(eventoId).turmas.push({
        turma_id: Number(row.turma_id),
        turma_nome: row.turma_nome,
        data_inicio: ymdFromAny(row.data_inicio),
        data_fim: ymdFromAny(row.data_fim),
        total_inscritos: Number(row.total_inscritos || 0),
        total_certificados: Number(row.total_certificados || 0),
        certificados_validos: Number(row.certificados_validos || 0),
        certificados_invalidos: Number(row.certificados_invalidos || 0),
      });
    }

    const data = [...eventosMap.values()];

    return responderSucesso(
      res,
      200,
      data,
      "Árvore administrativa de certificados carregada.",
      "CERTIFICADO_ADMIN_ARVORE_OK",
      {
        meta: {
          total_eventos: data.length,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao listar árvore administrativa de certificados", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar árvore administrativa de certificados.",
      "CERTIFICADO_ADMIN_ARVORE_ERRO",
      "Falha inesperada em listarAdminArvore.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Processar pendentes por turma
 * ───────────────────────────────────────────── */

async function processarPendentesPorTurma(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const turmaId = toPositiveInt(req.params?.turma_id || req.params?.id);

  if (!isAdministrador(req)) {
    return responderErro(
      res,
      403,
      "Acesso restrito a administradores.",
      "CERTIFICADO_ADMIN_REQUERIDO",
      "Somente administrador pode processar certificados pendentes por turma."
    );
  }

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "ID da turma inválido.",
      "CERTIFICADO_TURMA_ID_INVALIDO",
      "turma_id deve ser inteiro positivo."
    );
  }

  try {
    const turmaResult = await db.query(
      `
      SELECT
        t.id AS turma_id,
        t.evento_id,
        t.nome AS turma_nome,
        e.titulo AS evento_titulo
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    const turma = turmaResult.rows?.[0] || null;

    if (!turma) {
      return responderErro(
        res,
        404,
        "Turma não encontrada.",
        "CERTIFICADO_TURMA_NAO_ENCONTRADA",
        "Não foi localizada turma para o ID informado."
      );
    }

    const elegiveisResult = await db.query(
      `
      WITH base AS (
        SELECT
          i.usuario_id,
          'usuario'::text AS tipo
        FROM inscricoes i
        WHERE i.turma_id = $1

        UNION

        SELECT
          tr.usuario_id,
          'organizador'::text AS tipo
        FROM turma_responsavel tr
        WHERE tr.turma_id = $1
          AND tr.papel = 'organizador'

        UNION

        SELECT
          tp.usuario_id,
          'palestrante'::text AS tipo
        FROM turma_palestrante tp
        WHERE tp.turma_id = $1
          AND tp.usuario_id IS NOT NULL
      )
      SELECT
        b.usuario_id,
        b.tipo,
        u.nome,
        u.email
      FROM base b
      JOIN usuarios u ON u.id = b.usuario_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM certificados c
        WHERE c.usuario_id = b.usuario_id
          AND c.turma_id = $1
          AND c.tipo = b.tipo
          AND c.status IN ('emitido', 'enviado')
      )
      ORDER BY u.nome ASC, b.tipo ASC
      `,
      [turmaId]
    );

    return responderSucesso(
      res,
      200,
      {
        turma_id: turmaId,
        evento_id: Number(turma.evento_id),
        evento_titulo: turma.evento_titulo,
        turma_nome: turma.turma_nome,
        pendentes: elegiveisResult.rows || [],
        observacao:
          "Esta rota lista pendentes elegíveis. A emissão individual continua sendo feita por gerarCertificado para preservar validações documentais por usuário/tipo.",
      },
      "Pendentes de certificado carregados.",
      "CERTIFICADO_PENDENTES_TURMA_OK",
      {
        meta: {
          total_pendentes: elegiveisResult.rows?.length || 0,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao processar pendentes por turma", error);

    return responderErro(
      res,
      500,
      "Erro ao processar pendentes da turma.",
      "CERTIFICADO_PENDENTES_TURMA_ERRO",
      "Falha inesperada em processarPendentesPorTurma.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Cancelamento documental
 * ───────────────────────────────────────────── */

async function cancelarCertificado(req, res) {
  const rid = reqRid(req);
  const certificadoId = toPositiveInt(req.params?.id);
  const authUserId = getUsuarioId(req);
  const motivo = safeText(req.body?.motivo, 1000);

  if (!isAdministrador(req)) {
    return responderErro(
      res,
      403,
      "Acesso restrito a administradores.",
      "CERTIFICADO_ADMIN_REQUERIDO",
      "Somente administrador pode cancelar certificado."
    );
  }

  if (!certificadoId) {
    return responderErro(
      res,
      400,
      "ID do certificado inválido.",
      "CERTIFICADO_ID_INVALIDO",
      "req.params.id deve ser inteiro positivo."
    );
  }

  if (!motivo) {
    return responderErro(
      res,
      400,
      "Informe o motivo do cancelamento.",
      "CERTIFICADO_MOTIVO_CANCELAMENTO_OBRIGATORIO",
      "Cancelamento documental exige motivo."
    );
  }

  try {
    const result = await withTx(req, async (tx) => {
      const atual = await tx.query(
        `
        SELECT id, status, numero_certificado, codigo_validacao
        FROM certificados
        WHERE id = $1
        FOR UPDATE
        `,
        [certificadoId]
      );

      const certificado = atual.rows?.[0] || null;

      if (!certificado) {
        const error = new Error("Certificado não encontrado.");
        error.statusCode = 404;
        error.code = "CERTIFICADO_NAO_ENCONTRADO";
        throw error;
      }

      if (
        certificado.status === "cancelado" ||
        certificado.status === "anulado" ||
        certificado.status === "substituido"
      ) {
        const error = new Error("Certificado já possui status final.");
        error.statusCode = 409;
        error.code = "CERTIFICADO_STATUS_FINAL";
        error.details = {
          status: certificado.status,
        };
        throw error;
      }

      const update = await tx.query(
        `
        UPDATE certificados
        SET status = 'cancelado',
            cancelado_em = NOW(),
            cancelado_por = $2,
            motivo_cancelamento = $3,
            atualizado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [certificadoId, authUserId, motivo]
      );

      await registrarHistorico(tx, {
        origem: "evento",
        certificado_id: certificadoId,
        acao: "cancelado",
        status_anterior: certificado.status,
        status_novo: "cancelado",
        motivo,
        usuario_id: authUserId,
        metadados_json: {
          numero_certificado: certificado.numero_certificado,
          codigo_validacao: certificado.codigo_validacao,
        },
      });

      return update.rows[0];
    });

    return responderSucesso(
      res,
      200,
      result,
      "Certificado cancelado com sucesso.",
      "CERTIFICADO_CANCELADO"
    );
  } catch (error) {
    logError(rid, "Erro ao cancelar certificado", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Erro ao cancelar certificado.",
      error.code || "CERTIFICADO_CANCELAR_ERRO",
      "Falha inesperada em cancelarCertificado.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

/* ─────────────────────────────────────────────
 * Exports oficiais
 * ───────────────────────────────────────────── */

module.exports = {
  validarCertificadoPublico,
  gerarCertificado,
  downloadCertificado,

  listarCertificadoUsuario,
  listarCertificadosPorTurma,
  listarElegiveisPorTurma,
  listarAdminArvore,
  processarPendentesPorTurma,

  cancelarCertificado,

  // Helpers úteis para testes/diagnóstico interno controlado.
  obterAssinantesDaTurma,
  montarAssinaturasLayout,
  obterContextoTurmaCertificado,
  turmaEncerradaSP,
  usuarioEstaInscrito,
  usuarioFezAvaliacao,
  organizadorVinculadoATurma,
  palestranteVinculadoATurma,
};