/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/certificadoAvulsoController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Controller oficial dos certificados avulsos.
 * - Criação, listagem, primeira consolidação de PDF, envio por e-mail,
 *   cancelamento, anulação e histórico.
 *
 * Regra documental v2.1:
 * - Certificado avulso emitido/enviado não é editado, resetado, sobrescrito ou apagado.
 * - PDF/hash só podem ser gravados na primeira consolidação documental.
 * - Se o PDF já foi consolidado, não deve ser refeito para trocar assinaturas.
 * - Correção documental ocorre por substituição formal, com novo número, novo código, novo PDF e novo hash.
 * - Número de certificado é único, sequencial e nunca reaproveitado.
 *
 * Contratos oficiais:
 * - req.user.id
 * - certificados_avulsos
 * - certificado_historico
 * - certificado_status
 * - certificado_identificador_tipo
 * - certificados_avulsos_numero_seq
 * - assinantes avulsos via query/body oficial: assinantes_ids
 *
 * Contrato de assinaturas avulsas:
 * - De 1 a 3 assinaturas.
 * - Rafaella Pitol, ID 17, é obrigatória.
 * - Rafaella fica sempre por último, exceto quando Fábio Lopez, ID 2474, também for selecionado.
 * - Quando Fábio for selecionado, ele fica por último e Rafaella imediatamente antes dele.
 * - Demais assinantes devem ser usuários com perfil organizador ou administrador.
 * - A ordem final é normalizada no backend antes da geração do PDF.
 *
 * Diretrizes:
 * - Sem aliases de modalidade.
 * - Sem respostas { erro }.
 * - Sem nodemailer direto.
 * - Sem CPF exposto integralmente em validação pública.
 * - Campo físico atual cpf = identificador original informado.
 * - Contrato semântico:
 *   - identificador_tipo
 *   - identificador_hash
 *   - identificador_mascarado
 * - PDF persistido em arquivo_pdf.
 * - hash_pdf real calculado pelo conteúdo do PDF.
 * - hash_dados calculado por dados estruturados.
 * - QR Code por codigo_validacao.
 * - Histórico em certificado_historico.
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
const { sendEmail } = require("../services/mailer");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* ─────────────────────────────────────────────
 * Constantes oficiais
 * ───────────────────────────────────────────── */

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;
const MAX_ASSINATURAS_AVULSO = 3;

const PERFIS_ASSINANTES_VALIDOS = new Set(["organizador", "administrador"]);

const CARGO_ASSINATURA_OVERRIDE = {
  [RAFAELLA_PITOL_ID]: "Chefe da Escola da Saúde",
  [FABIO_LOPEZ_ID]: "Secretário Municipal de Saúde",
};

const MODALIDADES_OFICIAIS = [
  "participante",
  "organizador",
  "palestrante",
  "banca_avaliadora",
  "oficineiro",
  "mediador",
  "banca_tcr_medica",
  "banca_tcr_multi",
  "residente_medica",
  "residente_multi",
  "mostra_banner",
  "mostra_oral",
  "comissao_organizadora",
];

const MODALIDADES_SEM_CARGA = [
  "banca_avaliadora",
  "comissao_organizadora",
];

const MODALIDADES_EXIGEM_TITULO = [
  "residente_medica",
  "residente_multi",
  "mostra_banner",
  "mostra_oral",
  "oficineiro",
];

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

function mkRid(prefix = "CERTAV") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "CERTAV") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function logInfo(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[certificado-avulso][${rid}] ${message}`, extra || "");
  }
}

function logWarn(rid, message, extra) {
  console.warn(`[certificado-avulso][${rid}][WARN] ${message}`, extra || "");
}

function logError(rid, message, error) {
  console.error(
    `[certificado-avulso][${rid}][ERR] ${message}`,
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
 * Helpers gerais
 * ───────────────────────────────────────────── */

function getUsuarioId(req) {
  const usuarioId = Number(req?.user?.id);
  return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function onlyDigits(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

function safeText(value, max = 5000) {
  if (value == null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
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

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  const buffer = await fsp.readFile(filePath);
  return sha256(buffer);
}

function normalizarNomeArquivo(value) {
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

function gerarCodigoValidacao(prefixo = "AVULSO") {
  const year = anoAtualSP();
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();

  return `EMSP-SMS-${year}-${prefixo}-${random}`;
}

async function gerarNumeroCertificadoAvulso(db) {
  const year = anoAtualSP();

  const result = await db.query(
    `
    SELECT nextval('public.certificados_avulsos_numero_seq')::bigint AS seq
    `
  );

  const seq = Number(result.rows?.[0]?.seq);

  if (!Number.isInteger(seq) || seq <= 0) {
    throw new Error("Falha ao gerar número sequencial do certificado avulso.");
  }

  return `EMSP-SMS-AV-${year}-${String(seq).padStart(6, "0")}`;
}

function getIdentificadorInfo(identificadorOriginal) {
  const raw = String(identificadorOriginal || "").trim();
  const digits = onlyDigits(raw);

  if (digits.length === 11) {
    return {
      identificador_tipo: "cpf",
      identificador_hash: sha256(`cpf:${digits}`),
      identificador_mascarado: `***.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
      )}-**`,
      identificador_pdf: `Identificador: ***.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
      )}-**`,
    };
  }

  return {
    identificador_tipo: "registro_funcional",
    identificador_hash: sha256(`registro_funcional:${raw.toUpperCase()}`),
    identificador_mascarado: "Registro funcional informado",
    identificador_pdf: "Identificador: registro funcional informado",
  };
}

function modalidadeNaoTemCarga(modalidade) {
  return MODALIDADES_SEM_CARGA.includes(modalidade);
}

function modalidadeExigeTitulo(modalidade) {
  return MODALIDADES_EXIGEM_TITULO.includes(modalidade);
}

function assertModalidadeOficial(modalidade) {
  return MODALIDADES_OFICIAIS.includes(modalidade);
}

function formatarPeriodo(dataInicio, dataFim) {
  const di = dataInicio ? dataBR(dataInicio) : "";
  const df = dataFim ? dataBR(dataFim) : di;

  if (di && df) {
    if (di === df) return `realizado em ${di}`;
    return `realizado de ${di} a ${df}`;
  }

  if (di) return `realizado em ${di}`;

  return "";
}

function montarTextoModalidade({
  modalidade,
  curso,
  dataInicio,
  dataFim,
  cargaHoraria,
  tituloTrabalho,
  textoPersonalizado,
}) {
  const personalizado = safeText(textoPersonalizado, 5000);

  if (personalizado) return personalizado;

  const periodo = formatarPeriodo(dataInicio, dataFim);
  const evento = curso || "";
  const temCarga =
    Number(cargaHoraria || 0) > 0 && !modalidadeNaoTemCarga(modalidade);
  const trechoCarga = temCarga
    ? `, com carga horária total de ${Number(cargaHoraria)} horas.`
    : ".";

  switch (modalidade) {
    case "organizador":
      return periodo
        ? `Participou como organizador(a) do evento "${evento}", ${periodo}${trechoCarga}`
        : `Participou como organizador(a) do evento "${evento}"${trechoCarga}`;

    case "palestrante":
      return periodo
        ? `Participou como palestrante do evento "${evento}", ${periodo}${trechoCarga}`
        : `Participou como palestrante do evento "${evento}"${trechoCarga}`;

    case "banca_avaliadora":
      return periodo
        ? `Participou como banca avaliadora do evento "${evento}", ${periodo}.`
        : `Participou como banca avaliadora do evento "${evento}".`;

    case "oficineiro": {
      const titulo = safeText(tituloTrabalho, 500);
      const trechoTitulo = titulo ? ` na oficina intitulada "${titulo}"` : "";

      return periodo
        ? `Participou como oficineiro(a) do evento "${evento}"${trechoTitulo}, ${periodo}${trechoCarga}`
        : `Participou como oficineiro(a) do evento "${evento}"${trechoTitulo}${trechoCarga}`;
    }

    case "mediador":
      return periodo
        ? `Participou como mediador(a) do evento "${evento}", ${periodo}${trechoCarga}`
        : `Participou como mediador(a) do evento "${evento}"${trechoCarga}`;

    case "banca_tcr_medica":
      return periodo
        ? `Participou como banca avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${evento}", ${periodo}.`
        : `Participou como banca avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${evento}".`;

    case "banca_tcr_multi":
      return periodo
        ? `Participou como banca avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${evento}", ${periodo}.`
        : `Participou como banca avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${evento}".`;

    case "residente_medica": {
      const titulo = safeText(tituloTrabalho, 500) || "—";

      return periodo
        ? `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${evento}" intitulado "${titulo}", ${periodo}.`
        : `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${evento}" intitulado "${titulo}".`;
    }

    case "residente_multi": {
      const titulo = safeText(tituloTrabalho, 500) || "—";

      return periodo
        ? `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${evento}" intitulado "${titulo}", ${periodo}.`
        : `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${evento}" intitulado "${titulo}".`;
    }

    case "mostra_banner": {
      const titulo = safeText(tituloTrabalho, 500) || "—";

      return periodo
        ? `Apresentou o trabalho intitulado "${titulo}" na modalidade banner do evento "${evento}", ${periodo}.`
        : `Apresentou o trabalho intitulado "${titulo}" na modalidade banner do evento "${evento}".`;
    }

    case "mostra_oral": {
      const titulo = safeText(tituloTrabalho, 500) || "—";

      return periodo
        ? `Apresentou o trabalho intitulado "${titulo}" na modalidade apresentação oral do evento "${evento}", ${periodo}.`
        : `Apresentou o trabalho intitulado "${titulo}" na modalidade apresentação oral do evento "${evento}".`;
    }

    case "comissao_organizadora":
      return periodo
        ? `Participou como comissão organizadora do evento "${evento}", ${periodo}.`
        : `Participou como comissão organizadora do evento "${evento}".`;

    case "participante":
    default:
      return periodo
        ? `Participou do evento "${evento}", ${periodo}${trechoCarga}`
        : `Participou do evento "${evento}"${trechoCarga}`;
  }
}

function escaparHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ─────────────────────────────────────────────
 * Assets / fontes / assinaturas
 * ───────────────────────────────────────────── */

function getFontCandidates() {
  return [
    path.resolve(__dirname, "../../fonts"),
    path.resolve(process.cwd(), "fonts"),
    path.resolve(process.cwd(), "assets/fonts"),
    path.resolve(__dirname, "../../assets/fonts"),
  ];
}

function registerFonts(doc) {
  const fontRoots = getFontCandidates();

  const fontFiles = {
    "AlegreyaSans-Bold": "AlegreyaSans-Bold.ttf",
    "AlegreyaSans-Regular": "AlegreyaSans-Regular.ttf",
    BreeSerif: "BreeSerif-Regular.ttf",
    AlexBrush: "AlexBrush-Regular.ttf",
  };

  const registered = new Set();

  for (const [fontName, fileName] of Object.entries(fontFiles)) {
    let foundPath = null;

    for (const root of fontRoots) {
      const candidate = path.join(root, fileName);

      if (fs.existsSync(candidate)) {
        foundPath = candidate;
        break;
      }
    }

    if (!foundPath) continue;

    try {
      doc.registerFont(fontName, foundPath);
      registered.add(fontName);
    } catch (error) {
      logWarn(mkRid("FONT"), `Falha ao registrar fonte ${fontName}`, error.message);
    }
  }

  return registered;
}

function parseAssinantesIdsInput(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseAssinantesIdsInput(item))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  if (value == null || value === "") return [];

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  const raw = String(value || "").trim();

  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      return parseAssinantesIdsInput(parsed);
    } catch {
      return [];
    }
  }

  return raw
    .split(",")
    .map((item) => Number(String(item).trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function normalizarAssinantesAvulso(input) {
  const ids = [
    ...new Set(parseAssinantesIdsInput(input)),
  ];

  const temFabio = ids.includes(FABIO_LOPEZ_ID);

  const extras = ids.filter(
    (id) => id !== RAFAELLA_PITOL_ID && id !== FABIO_LOPEZ_ID
  );

  const base = extras.slice(0, temFabio ? 1 : 2);

  if (temFabio) {
    return [...base, RAFAELLA_PITOL_ID, FABIO_LOPEZ_ID];
  }

  return [...base, RAFAELLA_PITOL_ID];
}

function obterAssinantesIdsDaRequisicao(req) {
  if (typeof req?.body?.assinantes_ids !== "undefined") {
    return normalizarAssinantesAvulso(req.body.assinantes_ids);
  }

  if (typeof req?.query?.assinantes_ids !== "undefined") {
    return normalizarAssinantesAvulso(req.query.assinantes_ids);
  }

  return normalizarAssinantesAvulso([]);
}

async function carregarAssinaturasAvulsas(db, assinantesIds = []) {
  const ids = normalizarAssinantesAvulso(assinantesIds);

  if (!ids.includes(RAFAELLA_PITOL_ID)) {
    const error = new Error("A assinatura da Rafaella Pitol é obrigatória.");
    error.statusCode = 400;
    error.code = "CERTIFICADO_AVULSO_RAFAELLA_OBRIGATORIA";
    throw error;
  }

  if (ids.length < 1 || ids.length > MAX_ASSINATURAS_AVULSO) {
    const error = new Error("O certificado avulso deve ter de 1 a 3 assinaturas.");
    error.statusCode = 400;
    error.code = "CERTIFICADO_AVULSO_ASSINATURAS_QUANTIDADE_INVALIDA";
    error.details = {
      total: ids.length,
      maximo: MAX_ASSINATURAS_AVULSO,
    };
    throw error;
  }

  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      u.email,
      u.perfil,
      c.nome AS cargo_nome,
      a.imagem_base64
    FROM usuarios u
    LEFT JOIN cargos c ON c.id = u.cargo_id
    LEFT JOIN assinaturas a ON a.usuario_id = u.id
    WHERE u.id = ANY($1::int[])
    ORDER BY array_position($1::int[], u.id)
    `,
    [ids]
  );

  const rows = result.rows || [];
  const rowsMap = new Map(rows.map((row) => [Number(row.id), row]));

  const ausentes = ids.filter((id) => !rowsMap.has(Number(id)));

  if (ausentes.length) {
    const error = new Error(`Assinante(s) não encontrado(s): ${ausentes.join(", ")}.`);
    error.statusCode = 400;
    error.code = "CERTIFICADO_AVULSO_ASSINANTE_NAO_ENCONTRADO";
    error.details = {
      ausentes,
    };
    throw error;
  }

  const invalidos = rows.filter((row) => {
    const perfil = String(row.perfil || "").trim();
    return !PERFIS_ASSINANTES_VALIDOS.has(perfil);
  });

  if (invalidos.length) {
    const error = new Error(
      "Assinantes devem ser usuários com perfil organizador ou administrador."
    );
    error.statusCode = 400;
    error.code = "CERTIFICADO_AVULSO_ASSINANTE_PERFIL_INVALIDO";
    error.details = {
      invalidos: invalidos.map((row) => ({
        id: row.id,
        nome: row.nome,
        perfil: row.perfil,
      })),
    };
    throw error;
  }

  return ids.map((id, index) => {
    const row = rowsMap.get(id);

    const imgBuffer = dataUrlToBuffer(row?.imagem_base64);

    return {
      id,
      usuario_id: id,
      nome: row?.nome || "—",
      email: row?.email || null,
      perfil: row?.perfil || null,
      cargo:
        CARGO_ASSINATURA_OVERRIDE[id] ||
        row?.cargo_nome ||
        "Assinante institucional",
      ordem: index + 1,
      imgBuffer,
      assinatura_visual: Boolean(imgBuffer),
    };
  });
}

function serializarDadosAssinatura(assinaturas = []) {
  return {
    regra: "assinaturas_avulsas_v2_1",
    rafaella_obrigatoria: true,
    fabio_ultimo_quando_selecionado: true,
    assinantes: (assinaturas || []).map((assinatura) => ({
      usuario_id: assinatura.usuario_id || assinatura.id,
      nome: assinatura.nome,
      cargo: assinatura.cargo,
      perfil: assinatura.perfil || null,
      ordem: assinatura.ordem,
      assinatura_visual: Boolean(assinatura.imgBuffer),
    })),
  };
}

/* ─────────────────────────────────────────────
 * Histórico
 * ───────────────────────────────────────────── */

async function registrarHistorico(
  db,
  {
    certificado_avulso_id,
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
      certificado_avulso_id,
      acao,
      status_anterior,
      status_novo,
      motivo,
      usuario_id,
      metadados_json,
      criado_em
    )
    VALUES (
      'avulso',
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      NOW()
    )
    `,
    [
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

/* ─────────────────────────────────────────────
 * PDF
 * ───────────────────────────────────────────── */

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

function desenharCertificado(doc, certificado, opts = {}) {
  const assinaturas = Array.isArray(opts.assinaturas)
    ? opts.assinaturas
    : [];

  const textoPrincipal = montarTextoModalidade({
    modalidade: certificado.modalidade || "participante",
    curso: certificado.curso || "",
    dataInicio: certificado.data_inicio,
    dataFim: certificado.data_fim,
    cargaHoraria: certificado.carga_horaria,
    tituloTrabalho: certificado.titulo_trabalho,
    textoPersonalizado: certificado.texto_personalizado,
  });

  desenharCertificadoCompletoV2(doc, {
    modelo: "avulso",
    nome: certificado.nome,
    identificadorTexto: certificado.identificador_mascarado
      ? `Identificador: ${certificado.identificador_mascarado}`
      : null,
    textoPrincipal,
    dataTexto: `Santos, ${dataExtensoBR(new Date())}.`,
    assinaturas,
    numeroCertificado: certificado.numero_certificado,
    codigoValidacao: opts.codigoValidacao,
    validacaoUrl: opts.validacaoUrl,
    qrDataUrl: opts.qrDataUrl,
    subtitulo: "Documento eletrônico emitido pela Plataforma Escola da Saúde",
    fonts: {
      regular: "AlegreyaSans-Regular",
      bold: "AlegreyaSans-Bold",
      serif: "BreeSerif",
      script: "AlexBrush",
    },
  });
}

async function gerarPdfPersistido(certificado, opts = {}) {
  await ensureDir(CERT_DIR);

  const filename = normalizarNomeArquivo(
    `certificado_avulso_${certificado.numero_certificado}.pdf`
  );

  const caminho = path.join(CERT_DIR, filename);
  const tmpPath = `${caminho}.tmp`;

  const validacaoUrl = urlValidacaoPublica(certificado.codigo_validacao);
  const qrDataUrl = await tryQRCodeDataURL(validacaoUrl);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      layout: "landscape",
      bufferPages: false,
      info: {
        Title: `Certificado ${certificado.numero_certificado}`,
        Author: "Escola Municipal de Saúde Pública",
        Subject: certificado.curso || "Certificado avulso",
        Keywords: `certificado, ${certificado.numero_certificado}, ${certificado.codigo_validacao}, escola municipal de saúde pública`,
      },
    });

    const stream = fs.createWriteStream(tmpPath);
    registerFonts(doc);

    const onError = (error) => {
      try {
        stream.destroy();
      } catch {
        // ignora
      }

      reject(error);
    };

    stream.on("error", onError);
    doc.on("error", onError);

    doc.pipe(stream);

    try {
      desenharCertificado(doc, certificado, {
        ...opts,
        codigoValidacao: certificado.codigo_validacao,
        validacaoUrl,
        qrDataUrl,
      });

      doc.end();
    } catch (error) {
      onError(error);
      return;
    }

    stream.on("finish", resolve);
  });

  await fsp.rename(tmpPath, caminho).catch(async () => {
    await fsp.copyFile(tmpPath, caminho);
    await fsp.unlink(tmpPath).catch(() => {});
  });

  const hashPdf = await sha256File(caminho);

  return {
    arquivo_pdf: filename,
    caminho,
    hash_pdf: hashPdf,
    validacao_url: validacaoUrl,
  };
}

function montarHashDadosCertificadoAvulso(certificado) {
  return sha256(
    JSON.stringify({
      origem: "avulso",
      id: certificado.id,
      numero_certificado: certificado.numero_certificado,
      codigo_validacao: certificado.codigo_validacao,
      nome: certificado.nome,
      identificador_tipo: certificado.identificador_tipo,
      identificador_hash: certificado.identificador_hash,
      email: certificado.email,
      curso: certificado.curso,
      carga_horaria: certificado.carga_horaria,
      data_inicio: ymdFromAny(certificado.data_inicio),
      data_fim: ymdFromAny(certificado.data_fim),
      modalidade: certificado.modalidade,
      titulo_trabalho: certificado.titulo_trabalho,
      arquivo_pdf: certificado.arquivo_pdf || null,
      emitido_em: certificado.emitido_em,
      dados_assinatura_json: certificado.dados_assinatura_json || null,
    })
  );
}

/* ─────────────────────────────────────────────
 * Handlers
 * ───────────────────────────────────────────── */

async function criarCertificadoAvulso(req, res) {
  const rid = reqRid(req);
  const usuarioId = getUsuarioId(req);

  const nome = safeText(req.body?.nome, 300);
  const identificadorOriginal = safeText(req.body?.cpf, 80);
  const email = safeText(req.body?.email, 300);
  const curso = safeText(req.body?.curso, 500);
  const modalidade = safeText(req.body?.modalidade, 80) || "participante";
  const tituloTrabalho = safeText(req.body?.titulo_trabalho, 500);
  const textoPersonalizado = safeText(req.body?.texto_personalizado, 5000);

  const cargaRaw = req.body?.carga_horaria;
  let cargaHoraria =
    cargaRaw === null || cargaRaw === undefined || String(cargaRaw).trim() === ""
      ? null
      : Number(cargaRaw);

  const dataInicio = safeText(req.body?.data_inicio, 10);
  const dataFim = safeText(req.body?.data_fim, 10) || dataInicio;

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_AVULSO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!nome || !identificadorOriginal || !email || !curso) {
    return responderErro(
      res,
      400,
      "Campos obrigatórios ausentes.",
      "CERTIFICADO_AVULSO_CAMPOS_OBRIGATORIOS",
      "nome, identificador, email e curso são obrigatórios."
    );
  }

  if (!validarEmail(email)) {
    return responderErro(
      res,
      400,
      "E-mail inválido.",
      "CERTIFICADO_AVULSO_EMAIL_INVALIDO",
      "O campo email não passou na validação."
    );
  }

  if (!assertModalidadeOficial(modalidade)) {
    return responderErro(
      res,
      400,
      "Modalidade inválida.",
      "CERTIFICADO_AVULSO_MODALIDADE_INVALIDA",
      "A modalidade deve corresponder exatamente ao enum certificado_modalidade.",
      {
        modalidades_oficiais: MODALIDADES_OFICIAIS,
      }
    );
  }

  if (modalidadeNaoTemCarga(modalidade)) {
    cargaHoraria = null;
  }

  if (
    cargaHoraria !== null &&
    (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0)
  ) {
    return responderErro(
      res,
      400,
      "Carga horária inválida.",
      "CERTIFICADO_AVULSO_CARGA_HORARIA_INVALIDA",
      "carga_horaria deve ser número positivo ou nulo conforme modalidade."
    );
  }

  if (modalidadeExigeTitulo(modalidade) && !tituloTrabalho) {
    return responderErro(
      res,
      400,
      "Título do trabalho é obrigatório para a modalidade selecionada.",
      "CERTIFICADO_AVULSO_TITULO_OBRIGATORIO",
      "Modalidade exige titulo_trabalho."
    );
  }

  if (dataInicio && !isYmd(dataInicio)) {
    return responderErro(
      res,
      400,
      "data_inicio inválida.",
      "CERTIFICADO_AVULSO_DATA_INICIO_INVALIDA",
      "Use formato AAAA-MM-DD."
    );
  }

  if (dataFim && !isYmd(dataFim)) {
    return responderErro(
      res,
      400,
      "data_fim inválida.",
      "CERTIFICADO_AVULSO_DATA_FIM_INVALIDA",
      "Use formato AAAA-MM-DD."
    );
  }

  if (dataInicio && dataFim && dataFim < dataInicio) {
    return responderErro(
      res,
      400,
      "data_fim deve ser maior ou igual à data_inicio.",
      "CERTIFICADO_AVULSO_PERIODO_INVALIDO",
      "Período de certificado avulso inválido."
    );
  }

  try {
    const identificador = getIdentificadorInfo(identificadorOriginal);

    const result = await withTx(req, async (tx) => {
      const numeroCertificado = await gerarNumeroCertificadoAvulso(tx);
      const codigoValidacao = gerarCodigoValidacao("AVULSO");

      const insert = await tx.query(
        `
        INSERT INTO certificados_avulsos (
          nome,
          cpf,
          email,
          curso,
          carga_horaria,
          emitido_em,
          enviado,
          data_inicio,
          data_fim,
          modalidade,
          titulo_trabalho,
          texto_personalizado,
          numero_certificado,
          codigo_validacao,
          status,
          algoritmo_hash,
          emitido_por,
          identificador_tipo,
          identificador_hash,
          identificador_mascarado,
          metadados_json,
          dados_assinatura_json,
          atualizado_em
        )
        VALUES (
          $1, $2, $3, $4, $5,
          NOW(),
          false,
          $6::date,
          $7::date,
          $8,
          $9,
          $10,
          $11,
          $12,
          'emitido',
          'sha256',
          $13,
          $14,
          $15,
          $16,
          $17::jsonb,
          '{}'::jsonb,
          NOW()
        )
        RETURNING *
        `,
        [
          nome,
          identificadorOriginal,
          email,
          curso,
          cargaHoraria,
          dataInicio || null,
          dataFim || null,
          modalidade,
          tituloTrabalho,
          textoPersonalizado,
          numeroCertificado,
          codigoValidacao,
          usuarioId,
          identificador.identificador_tipo,
          identificador.identificador_hash,
          identificador.identificador_mascarado,
          JSON.stringify({
            origem: "avulso",
            numero_certificado: numeroCertificado,
            codigo_validacao: codigoValidacao,
            validacao_url: urlValidacaoPublica(codigoValidacao),
          }),
        ]
      );

      const criado = insert.rows[0];
      const hashDados = montarHashDadosCertificadoAvulso(criado);

      const update = await tx.query(
        `
        UPDATE certificados_avulsos
        SET
          hash_dados = $2,
          atualizado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [criado.id, hashDados]
      );

      const atualizado = update.rows[0];

      await registrarHistorico(tx, {
        certificado_avulso_id: atualizado.id,
        acao: "emitido",
        status_novo: atualizado.status,
        motivo: "Certificado avulso criado pela geração documental v2.1.",
        usuario_id: usuarioId,
        metadados_json: {
          numero_certificado: atualizado.numero_certificado,
          codigo_validacao: atualizado.codigo_validacao,
          modalidade: atualizado.modalidade,
          identificador_tipo: atualizado.identificador_tipo,
        },
      });

      return atualizado;
    });

    logInfo(rid, "criarCertificadoAvulso OK", {
      id: result.id,
      numero_certificado: result.numero_certificado,
      modalidade: result.modalidade,
    });

    return responderSucesso(
      res,
      201,
      result,
      "Certificado avulso criado com sucesso.",
      "CERTIFICADO_AVULSO_CRIADO"
    );
  } catch (error) {
    logError(rid, "Erro ao criar certificado avulso", error);

    return responderErro(
      res,
      500,
      "Erro ao criar certificado avulso.",
      "CERTIFICADO_AVULSO_ERRO_CRIAR",
      "Falha inesperada em criarCertificadoAvulso.",
      IS_DEV ? error.message : null
    );
  }
}

async function listarCertificadosAvulsos(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const result = await db.query(
      `
      SELECT
        id,
        nome,
        email,
        curso,
        carga_horaria,
        emitido_em,
        enviado,
        enviado_em,
        data_inicio,
        data_fim,
        modalidade,
        titulo_trabalho,
        texto_personalizado,
        numero_certificado,
        codigo_validacao,
        arquivo_pdf,
        status,
        hash_pdf,
        hash_dados,
        algoritmo_hash,
        emitido_por,
        cancelado_em,
        cancelado_por,
        motivo_cancelamento,
        substitui_certificado_id,
        substituido_por_certificado_id,
        identificador_tipo,
        identificador_mascarado,
        metadados_json,
        dados_assinatura_json,
        atualizado_em
      FROM certificados_avulsos
      ORDER BY id DESC
      `
    );

    logInfo(rid, "listarCertificadosAvulsos OK", {
      total: result.rows.length,
    });

    return responderSucesso(
      res,
      200,
      result.rows,
      "Certificados avulsos carregados com sucesso.",
      "CERTIFICADOS_AVULSOS_LISTADOS"
    );
  } catch (error) {
    logError(rid, "Erro ao listar certificados avulsos", error);

    return responderErro(
      res,
      500,
      "Erro ao listar certificados avulsos.",
      "CERTIFICADO_AVULSO_ERRO_LISTAR",
      "Falha inesperada em listarCertificadosAvulsos.",
      IS_DEV ? error.message : null
    );
  }
}

async function carregarCertificadoAvulso(db, id) {
  const result = await db.query(
    `
    SELECT *
    FROM certificados_avulsos
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows?.[0] || null;
}

async function consolidarPdfAvulsoSePendente(req, id, assinantesIdsInput = null) {
  const usuarioId = getUsuarioId(req);
  const assinantesIds = normalizarAssinantesAvulso(assinantesIdsInput);

  const result = await withTx(req, async (tx) => {
    const atualResult = await tx.query(
      `
      SELECT *
      FROM certificados_avulsos
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (atualResult.rowCount === 0) {
      return null;
    }

    const atual = atualResult.rows[0];

    if (!["emitido", "enviado"].includes(atual.status)) {
      const error = new Error("Certificado avulso não está válido para PDF.");
      error.statusCode = 403;
      error.code = "CERTIFICADO_AVULSO_STATUS_INVALIDO_PDF";
      error.details = {
        status: atual.status,
        numero_certificado: atual.numero_certificado,
      };
      throw error;
    }

    if (atual.arquivo_pdf && atual.hash_pdf) {
      return {
        certificado: atual,
        caminho: path.join(CERT_DIR, atual.arquivo_pdf),
        ja_existia: true,
        observacao:
          "PDF já consolidado. Assinaturas não são alteradas após consolidação documental.",
      };
    }

    if (!atual.numero_certificado) {
      const error = new Error("Certificado avulso sem número oficial.");
      error.statusCode = 409;
      error.code = "CERTIFICADO_AVULSO_SEM_NUMERO";
      error.details = { certificado_avulso_id: atual.id };
      throw error;
    }

    if (!atual.codigo_validacao) {
      const error = new Error("Certificado avulso sem código de validação.");
      error.statusCode = 409;
      error.code = "CERTIFICADO_AVULSO_SEM_CODIGO";
      error.details = { certificado_avulso_id: atual.id };
      throw error;
    }

    const assinaturas = await carregarAssinaturasAvulsas(tx, assinantesIds);
    const dadosAssinatura = serializarDadosAssinatura(assinaturas);

    const pdf = await gerarPdfPersistido(
      {
        ...atual,
        dados_assinatura_json: dadosAssinatura,
      },
      {
        assinaturas,
      }
    );

    const metadados = {
      ...(atual.metadados_json || {}),
      origem: "avulso",
      numero_certificado: atual.numero_certificado,
      codigo_validacao: atual.codigo_validacao,
      validacao_url: pdf.validacao_url,
      arquivo_pdf: pdf.arquivo_pdf,
    };

    const hashDados = montarHashDadosCertificadoAvulso({
      ...atual,
      arquivo_pdf: pdf.arquivo_pdf,
      dados_assinatura_json: dadosAssinatura,
    });

    const update = await tx.query(
      `
      UPDATE certificados_avulsos
      SET
        arquivo_pdf = $2,
        hash_pdf = $3,
        hash_dados = $4,
        algoritmo_hash = 'sha256',
        metadados_json = $5::jsonb,
        dados_assinatura_json = $6::jsonb,
        atualizado_em = NOW()
      WHERE id = $1
        AND arquivo_pdf IS NULL
        AND hash_pdf IS NULL
      RETURNING *
      `,
      [
        id,
        pdf.arquivo_pdf,
        pdf.hash_pdf,
        hashDados,
        JSON.stringify(metadados),
        JSON.stringify(dadosAssinatura),
      ]
    );

    if (update.rowCount === 0) {
      const recarregado = await tx.query(
        `
        SELECT *
        FROM certificados_avulsos
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      const row = recarregado.rows?.[0];

      return {
        certificado: row,
        caminho: row?.arquivo_pdf ? path.join(CERT_DIR, row.arquivo_pdf) : null,
        ja_existia: true,
      };
    }

    const atualizado = update.rows[0];

    await registrarHistorico(tx, {
      certificado_avulso_id: atualizado.id,
      acao: "pdf_consolidado",
      status_anterior: atual.status,
      status_novo: atualizado.status,
      motivo: "PDF consolidado pela primeira vez na rotina documental v2.1.",
      usuario_id: usuarioId,
      metadados_json: {
        numero_certificado: atualizado.numero_certificado,
        arquivo_pdf: atualizado.arquivo_pdf,
        codigo_validacao: atualizado.codigo_validacao,
        hash_pdf: atualizado.hash_pdf,
        assinantes: dadosAssinatura.assinantes,
      },
    });

    return {
      certificado: atualizado,
      caminho: pdf.caminho,
      ja_existia: false,
    };
  });

  return result;
}

async function gerarPdfCertificado(req, res) {
  const rid = reqRid(req);
  const id = toPositiveInt(req.params?.id);
  const assinantesIds = obterAssinantesIdsDaRequisicao(req);

  if (!id) {
    return responderErro(
      res,
      400,
      "ID inválido.",
      "CERTIFICADO_AVULSO_ID_INVALIDO",
      "O parâmetro id deve ser inteiro positivo."
    );
  }

  try {
    const result = await consolidarPdfAvulsoSePendente(req, id, assinantesIds);

    if (!result) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Não há certificado avulso com o id informado."
      );
    }

    const caminho = result.caminho;

    if (!caminho || !fs.existsSync(caminho)) {
      return responderErro(
        res,
        404,
        "Arquivo PDF não encontrado.",
        "CERTIFICADO_AVULSO_PDF_NAO_ENCONTRADO",
        "Não foi possível localizar o arquivo PDF consolidado."
      );
    }

    logInfo(rid, "gerarPdfCertificado OK", {
      id,
      numero_certificado: result.certificado.numero_certificado,
      arquivo_pdf: result.certificado.arquivo_pdf,
      ja_existia: result.ja_existia,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(caminho)}"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    return fs.createReadStream(caminho).pipe(res);
  } catch (error) {
    logError(rid, "Erro ao gerar PDF de certificado avulso", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode === 400 ||
        error.statusCode === 403 ||
        error.statusCode === 409
        ? error.message
        : "Erro ao gerar PDF.",
      error.code || "CERTIFICADO_AVULSO_ERRO_PDF",
      "Falha inesperada em gerarPdfCertificado.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

async function enviarPorEmail(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const id = toPositiveInt(req.params?.id);
  const assinantesIds = obterAssinantesIdsDaRequisicao(req);
  const usuarioId = getUsuarioId(req);

  if (!id) {
    return responderErro(
      res,
      400,
      "ID inválido.",
      "CERTIFICADO_AVULSO_ID_INVALIDO",
      "O parâmetro id deve ser inteiro positivo."
    );
  }

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_AVULSO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  try {
    const pdfResult = await consolidarPdfAvulsoSePendente(req, id, assinantesIds);

    if (!pdfResult) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Não há certificado avulso com o id informado."
      );
    }

    const certificado = await carregarCertificadoAvulso(db, id);

    if (!certificado) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Registro desapareceu após geração do PDF."
      );
    }

    if (!["emitido", "enviado"].includes(certificado.status)) {
      return responderErro(
        res,
        403,
        "Certificado avulso não está válido para envio.",
        "CERTIFICADO_AVULSO_STATUS_INVALIDO_EMAIL",
        "Somente certificado emitido/enviado pode ser enviado por e-mail.",
        {
          status: certificado.status,
          numero_certificado: certificado.numero_certificado,
        }
      );
    }

    if (!validarEmail(certificado.email)) {
      return responderErro(
        res,
        400,
        "O registro possui e-mail inválido.",
        "CERTIFICADO_AVULSO_EMAIL_INVALIDO",
        "O campo email do certificado não passou na validação."
      );
    }

    if (!pdfResult.caminho || !fs.existsSync(pdfResult.caminho)) {
      return responderErro(
        res,
        404,
        "Arquivo PDF não encontrado para envio.",
        "CERTIFICADO_AVULSO_PDF_NAO_ENCONTRADO",
        "O PDF consolidado não foi localizado no armazenamento."
      );
    }

    const textoPrincipal = montarTextoModalidade({
      modalidade: certificado.modalidade || "participante",
      curso: certificado.curso || "",
      dataInicio: certificado.data_inicio,
      dataFim: certificado.data_fim,
      cargaHoraria: certificado.carga_horaria,
      tituloTrabalho: certificado.titulo_trabalho,
      textoPersonalizado: certificado.texto_personalizado,
    });

    const linkValidacao = urlValidacaoPublica(certificado.codigo_validacao);

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; color:#111;">
        <p>Prezado(a) <strong>${escaparHtml(certificado.nome)}</strong>,</p>
        <p>${escaparHtml(textoPrincipal)}</p>
        <p>Em anexo, segue o seu certificado em PDF.</p>
        <p>Você também pode validar a autenticidade do certificado pelo link abaixo:</p>
        <p>
          <a href="${escaparHtml(linkValidacao)}" style="display:inline-block; padding:10px 16px; border-radius:8px; text-decoration:none; background:#1b4332; color:#fff;">
            Validar certificado
          </a>
        </p>
        <p style="font-size:14px; color:#444;">
          Certificado nº: <strong>${escaparHtml(certificado.numero_certificado)}</strong><br>
          Código de validação: <strong>${escaparHtml(certificado.codigo_validacao)}</strong><br>
          Se o botão não funcionar, copie e cole este link no navegador:<br>
          <a href="${escaparHtml(linkValidacao)}">${escaparHtml(linkValidacao)}</a>
        </p>
        <p>Atenciosamente,<br><strong>Equipe da Escola Municipal de Saúde Pública</strong></p>
      </div>
    `;

    await sendEmail({
      to: certificado.email,
      subject:
        process.env.CERT_AVULSO_SUBJECT ||
        "Seu Certificado — Escola Municipal de Saúde Pública",
      text: `Prezado(a) ${certificado.nome},

${textoPrincipal}

Em anexo, segue o seu certificado em PDF.

Certificado nº: ${certificado.numero_certificado}
Validação pública:
${linkValidacao}

Código de validação: ${certificado.codigo_validacao}

Atenciosamente,
Equipe da Escola Municipal de Saúde Pública
`,
      html,
      attachments: [
        {
          filename: path.basename(pdfResult.caminho),
          path: pdfResult.caminho,
          contentType: "application/pdf",
        },
      ],
    });

    const update = await db.query(
      `
      UPDATE certificados_avulsos
      SET
        enviado = TRUE,
        enviado_em = NOW(),
        status = 'enviado',
        atualizado_em = NOW()
      WHERE id = $1
        AND status = 'emitido'
      RETURNING *
      `,
      [id]
    );

    const certificadoAtualizado =
      update.rows?.[0] || (await carregarCertificadoAvulso(db, id));

    await registrarHistorico(db, {
      certificado_avulso_id: id,
      acao: "email_enviado",
      status_anterior: certificado.status,
      status_novo: certificadoAtualizado?.status || "enviado",
      motivo:
        certificado.status === "enviado"
          ? "Certificado avulso reenviado por e-mail."
          : "Certificado avulso enviado por e-mail.",
      usuario_id: usuarioId,
      metadados_json: {
        numero_certificado: certificado.numero_certificado,
        email: certificado.email,
        arquivo_pdf: pdfResult.certificado.arquivo_pdf,
        codigo_validacao: certificado.codigo_validacao,
      },
    });

    logInfo(rid, "enviarPorEmail OK", {
      id,
      numero_certificado: certificado.numero_certificado,
      email: certificado.email,
    });

    return responderSucesso(
      res,
      200,
      certificadoAtualizado,
      "Certificado enviado com sucesso.",
      "CERTIFICADO_AVULSO_EMAIL_ENVIADO"
    );
  } catch (error) {
    logError(rid, "Erro ao enviar certificado avulso por e-mail", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode === 400 ||
        error.statusCode === 403 ||
        error.statusCode === 409
        ? error.message
        : "Erro ao enviar certificado avulso.",
      error.code || "CERTIFICADO_AVULSO_ERRO_EMAIL",
      "Falha inesperada em enviarPorEmail.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

async function cancelarCertificadoAvulso(req, res) {
  const rid = reqRid(req);
  const id = toPositiveInt(req.params?.id);
  const usuarioId = getUsuarioId(req);
  const motivo = safeText(req.body?.motivo, 2000);

  if (!id) {
    return responderErro(
      res,
      400,
      "ID inválido.",
      "CERTIFICADO_AVULSO_ID_INVALIDO",
      "O parâmetro id deve ser inteiro positivo."
    );
  }

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_AVULSO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!motivo) {
    return responderErro(
      res,
      400,
      "Motivo é obrigatório.",
      "CERTIFICADO_AVULSO_MOTIVO_OBRIGATORIO",
      "Cancelamento de certificado exige motivo."
    );
  }

  try {
    const result = await withTx(req, async (tx) => {
      const atual = await tx.query(
        `
        SELECT id, status, numero_certificado
        FROM certificados_avulsos
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (atual.rowCount === 0) return null;

      const anterior = atual.rows[0];

      if (!["emitido", "enviado"].includes(anterior.status)) {
        const error = new Error("Somente certificado emitido/enviado pode ser cancelado.");
        error.statusCode = 409;
        error.code = "CERTIFICADO_AVULSO_STATUS_NAO_CANCELAVEL";
        error.details = {
          status: anterior.status,
          numero_certificado: anterior.numero_certificado,
        };
        throw error;
      }

      const update = await tx.query(
        `
        UPDATE certificados_avulsos
        SET
          status = 'cancelado',
          cancelado_em = NOW(),
          cancelado_por = $2,
          motivo_cancelamento = $3,
          atualizado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, usuarioId, motivo]
      );

      await registrarHistorico(tx, {
        certificado_avulso_id: id,
        acao: "cancelado",
        status_anterior: anterior.status,
        status_novo: "cancelado",
        motivo,
        usuario_id: usuarioId,
        metadados_json: {
          numero_certificado: anterior.numero_certificado,
        },
      });

      return update.rows[0];
    });

    if (!result) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Não há certificado avulso com o id informado."
      );
    }

    logInfo(rid, "cancelarCertificadoAvulso OK", {
      id,
      numero_certificado: result.numero_certificado,
    });

    return responderSucesso(
      res,
      200,
      result,
      "Certificado avulso cancelado com sucesso.",
      "CERTIFICADO_AVULSO_CANCELADO"
    );
  } catch (error) {
    logError(rid, "Erro ao cancelar certificado avulso", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode === 409
        ? error.message
        : "Erro ao cancelar certificado avulso.",
      error.code || "CERTIFICADO_AVULSO_CANCELAR_ERRO",
      "Falha inesperada em cancelarCertificadoAvulso.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

async function anularCertificadoAvulso(req, res) {
  const rid = reqRid(req);
  const id = toPositiveInt(req.params?.id);
  const usuarioId = getUsuarioId(req);
  const motivo = safeText(req.body?.motivo, 2000);

  if (!id) {
    return responderErro(
      res,
      400,
      "ID inválido.",
      "CERTIFICADO_AVULSO_ID_INVALIDO",
      "O parâmetro id deve ser inteiro positivo."
    );
  }

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "CERTIFICADO_AVULSO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!motivo) {
    return responderErro(
      res,
      400,
      "Motivo é obrigatório.",
      "CERTIFICADO_AVULSO_MOTIVO_OBRIGATORIO",
      "Anulação de certificado exige motivo."
    );
  }

  try {
    const result = await withTx(req, async (tx) => {
      const atual = await tx.query(
        `
        SELECT id, status, numero_certificado
        FROM certificados_avulsos
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (atual.rowCount === 0) return null;

      const anterior = atual.rows[0];

      if (!["emitido", "enviado"].includes(anterior.status)) {
        const error = new Error("Somente certificado emitido/enviado pode ser anulado.");
        error.statusCode = 409;
        error.code = "CERTIFICADO_AVULSO_STATUS_NAO_ANULAVEL";
        error.details = {
          status: anterior.status,
          numero_certificado: anterior.numero_certificado,
        };
        throw error;
      }

      const update = await tx.query(
        `
        UPDATE certificados_avulsos
        SET
          status = 'anulado',
          cancelado_em = NOW(),
          cancelado_por = $2,
          motivo_cancelamento = $3,
          atualizado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, usuarioId, motivo]
      );

      await registrarHistorico(tx, {
        certificado_avulso_id: id,
        acao: "anulado",
        status_anterior: anterior.status,
        status_novo: "anulado",
        motivo,
        usuario_id: usuarioId,
        metadados_json: {
          numero_certificado: anterior.numero_certificado,
        },
      });

      return update.rows[0];
    });

    if (!result) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Não há certificado avulso com o id informado."
      );
    }

    logInfo(rid, "anularCertificadoAvulso OK", {
      id,
      numero_certificado: result.numero_certificado,
    });

    return responderSucesso(
      res,
      200,
      result,
      "Certificado avulso anulado com sucesso.",
      "CERTIFICADO_AVULSO_ANULADO"
    );
  } catch (error) {
    logError(rid, "Erro ao anular certificado avulso", error);

    return responderErro(
      res,
      error.statusCode || 500,
      error.statusCode === 409
        ? error.message
        : "Erro ao anular certificado avulso.",
      error.code || "CERTIFICADO_AVULSO_ANULAR_ERRO",
      "Falha inesperada em anularCertificadoAvulso.",
      error.details || (IS_DEV ? error.message : null)
    );
  }
}

async function historicoCertificadoAvulso(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const id = toPositiveInt(req.params?.id);

  if (!id) {
    return responderErro(
      res,
      400,
      "ID inválido.",
      "CERTIFICADO_AVULSO_ID_INVALIDO",
      "O parâmetro id deve ser inteiro positivo."
    );
  }

  try {
    const cert = await db.query(
      `
      SELECT id
      FROM certificados_avulsos
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (cert.rowCount === 0) {
      return responderErro(
        res,
        404,
        "Certificado avulso não encontrado.",
        "CERTIFICADO_AVULSO_NAO_ENCONTRADO",
        "Não há certificado avulso com o id informado."
      );
    }

    const historico = await db.query(
      `
      SELECT
        h.id,
        h.acao,
        h.status_anterior,
        h.status_novo,
        h.motivo,
        h.usuario_id,
        u.nome AS usuario_nome,
        h.metadados_json,
        h.criado_em
      FROM certificado_historico h
      LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.origem = 'avulso'
        AND h.certificado_avulso_id = $1
      ORDER BY h.criado_em DESC, h.id DESC
      `,
      [id]
    );

    return responderSucesso(
      res,
      200,
      historico.rows,
      "Histórico do certificado avulso carregado com sucesso.",
      "CERTIFICADO_AVULSO_HISTORICO_LISTADO"
    );
  } catch (error) {
    logError(rid, "Erro ao carregar histórico do certificado avulso", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar histórico do certificado avulso.",
      "CERTIFICADO_AVULSO_HISTORICO_ERRO",
      "Falha inesperada em historicoCertificadoAvulso.",
      IS_DEV ? error.message : null
    );
  }
}

module.exports = {
  criarCertificadoAvulso,
  listarCertificadosAvulsos,
  gerarPdfCertificado,
  enviarPorEmail,
  cancelarCertificadoAvulso,
  anularCertificadoAvulso,
  historicoCertificadoAvulso,

  // Helpers úteis para diagnóstico/teste controlado.
  normalizarAssinantesAvulso,
  carregarAssinaturasAvulsas,
  serializarDadosAssinatura,
};