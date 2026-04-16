/* eslint-disable no-console */
"use strict";

// ✅ src/controllers/avaliacaoController.js — PREMIUM+++
// - Compat DB robusta
// - Transação segura no envio
// - Date-only safe / anti-fuso
// - Compat com avaliacoes/avaliacao e inscricoes/inscricao
// - Elegibilidade consistente: turma encerrada + presença + >= 75%
// - Logs com RID
// - Pós-avaliação: ponte resiliente para certificado
// - Analytics premium / respostas agregadas
// - Fallback conservador para turmas sem datas_turma

const dbMod = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* ────────────────────────────────────────────────────────────────
   Notificação de certificado — import resiliente
──────────────────────────────────────────────────────────────── */
let notifyCertFn = null;
try {
  const notif = require("./notificacaoController");
  notifyCertFn =
    notif?.gerarNotificacaoDeCertificado ||
    notif?.gerarNotificacoesDeCertificado ||
    notif?.gerarNotificacoesDeCertificado?.default ||
    null;
} catch (_) {
  notifyCertFn = null;
}

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof query !== "function") {
  console.error("[avaliacaoController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em avaliacaoController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query };
}

async function withTx(req, fn) {
  const reqDb = req?.db;
  const reqPool =
    reqDb?.pool ||
    reqDb?.Pool ||
    reqDb?.db?.pool ||
    dbMod?.pool ||
    dbMod?.Pool ||
    dbMod?.db?.pool ||
    null;

  if (!reqPool || typeof reqPool.connect !== "function") {
    await query("BEGIN");
    try {
      const out = await fn({ query });
      await query("COMMIT");
      return out;
    } catch (e) {
      try {
        await query("ROLLBACK");
      } catch {}
      throw e;
    }
  }

  const client = await reqPool.connect();
  try {
    const q = client.query.bind(client);
    await q("BEGIN");
    const out = await fn({ query: q });
    await q("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}

/* ────────────────────────────────────────────────────────────────
   Logger premium (RID)
──────────────────────────────────────────────────────────────── */
function mkRid(prefix = "AVL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function reqRid(req, prefix = "AVL") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;
  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }
  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

/* ────────────────────────────────────────────────────────────────
   Helpers — auth / contexto
──────────────────────────────────────────────────────────────── */
const getUserId = (req) =>
  req?.user?.id ??
  req?.usuario?.id ??
  req?.user?.usuario_id ??
  req?.usuario?.usuario_id ??
  req?.auth?.userId ??
  null;

function getPerfis(user) {
  const raw = user?.perfis ?? user?.perfil ?? "";
  if (Array.isArray(raw)) {
    return raw
      .map(String)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminLike(user) {
  return getPerfis(user).includes("administrador");
}

/* ────────────────────────────────────────────────────────────────
   Helpers — básicos
──────────────────────────────────────────────────────────────── */
function toPositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function safeText(v, fb = "") {
  return v == null ? fb : String(v);
}

function normText(v, { max = 5000 } = {}) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function asNullableScore(v) {
  if (v == null) return null;
  const s0 = String(v).trim();
  if (!s0) return null;

  const n = Number(s0.replace(",", "."));
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;

  const s = s0
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const map = {
    otimo: 5,
    excelente: 5,
    "muito bom": 5,
    bom: 4,
    regular: 3,
    medio: 3,
    ruim: 2,
    pessimo: 1,
    "muito ruim": 1,
  };

  return map[s] ?? null;
}

function mediaFromDist(dist) {
  const n1 = dist["1"] || 0;
  const n2 = dist["2"] || 0;
  const n3 = dist["3"] || 0;
  const n4 = dist["4"] || 0;
  const n5 = dist["5"] || 0;
  const total = n1 + n2 + n3 + n4 + n5;
  if (!total) return null;
  const soma = 1 * n1 + 2 * n2 + 3 * n3 + 4 * n4 + 5 * n5;
  return Number((soma / total).toFixed(2));
}

function pickText(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "object") {
    const t = v.texto ?? v.comentario ?? v.value ?? null;
    return typeof t === "string" && t.trim() ? t.trim() : null;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
   Helpers — date-only safe
──────────────────────────────────────────────────────────────── */
const isYmd = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function ymdToSafeLocalDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toYMDLocal(dateLike) {
  if (isYmd(dateLike)) return dateLike;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function gerarIntervaloYMD(inicioLike, fimLike) {
  const iniY = toYMDLocal(inicioLike);
  const fimY = toYMDLocal(fimLike);
  if (!isYmd(iniY) || !isYmd(fimY)) return [];

  const ini = ymdToSafeLocalDate(iniY);
  const fim = ymdToSafeLocalDate(fimY);
  if (!ini || !fim || Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return [];

  const out = [];
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    out.push(toYMDLocal(d));
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────
   Regras / campos
──────────────────────────────────────────────────────────────── */
const NOTAS_EVENTO = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

const CAMPOS_MEDIA_OFICIAL = [...NOTAS_EVENTO];

const CAMPOS_OBJETIVOS = [
  ...NOTAS_EVENTO,
  "desempenho_instrutor",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];

const CAMPOS_TEXTOS = ["gostou_mais", "sugestoes_melhoria", "comentarios_finais"];
const CAMPOS_OBRIGATORIOS = ["desempenho_instrutor", ...NOTAS_EVENTO];

function mediaNotasEventoDe(aval) {
  let soma = 0;
  let n = 0;

  for (const c of NOTAS_EVENTO) {
    const s = asNullableScore(aval[c]);
    if (s != null) {
      soma += s;
      n += 1;
    }
  }

  return n ? soma / n : null;
}

function filtrarCamposPorTipoEvento(tipoEvento, payload) {
  const tipo = String(tipoEvento || "").toLowerCase();
  const allowExposicao = tipo === "congresso" || tipo === "simpósio" || tipo === "simposio";
  const allowCongressoOnly = tipo === "congresso";

  return {
    exposicao_trabalhos: allowExposicao ? payload.exposicao_trabalhos ?? null : null,
    apresentacao_oral_mostra: allowCongressoOnly ? payload.apresentacao_oral_mostra ?? null : null,
    apresentacao_tcrs: allowCongressoOnly ? payload.apresentacao_tcrs ?? null : null,
    oficinas: allowCongressoOnly ? payload.oficinas ?? null : null,
  };
}

function sanitizePayloadAvaliacao(payload, tipoEvento) {
  const opcionais = filtrarCamposPorTipoEvento(tipoEvento, payload);

  return {
    desempenho_instrutor: payload.desempenho_instrutor,
    divulgacao_evento: payload.divulgacao_evento,
    recepcao: payload.recepcao,
    credenciamento: payload.credenciamento,
    material_apoio: payload.material_apoio,
    pontualidade: payload.pontualidade,
    sinalizacao_local: payload.sinalizacao_local,
    conteudo_temas: payload.conteudo_temas,
    estrutura_local: payload.estrutura_local,
    acessibilidade: payload.acessibilidade,
    limpeza: payload.limpeza,
    inscricao_online: payload.inscricao_online,

    exposicao_trabalhos: opcionais.exposicao_trabalhos,
    apresentacao_oral_mostra: opcionais.apresentacao_oral_mostra,
    apresentacao_tcrs: opcionais.apresentacao_tcrs,
    oficinas: opcionais.oficinas,

    gostou_mais: normText(payload.gostou_mais, { max: 4000 }),
    sugestoes_melhoria: normText(payload.sugestoes_melhoria, { max: 4000 }),
    comentarios_finais: normText(payload.comentarios_finais, { max: 4000 }),
  };
}

/* ────────────────────────────────────────────────────────────────
   SQL fallback helpers
──────────────────────────────────────────────────────────────── */
async function queryFirstWorking(dbConn, variants, params = []) {
  let lastErr = null;

  for (const sql of variants) {
    try {
      return await dbConn.query(sql, params);
    } catch (e) {
      lastErr = e;
      if (["42P01", "42703"].includes(e?.code)) continue; // tabela/coluna inexistente
      throw e;
    }
  }

  throw lastErr || new Error("Nenhuma variante SQL funcionou.");
}

async function resolveInscricaoTable(dbConn) {
  try {
    await dbConn.query(`SELECT 1 FROM inscricoes LIMIT 1`);
    return "inscricoes";
  } catch {
    return "inscricao";
  }
}

async function resolveAvaliacaoTable(dbConn) {
  try {
    await dbConn.query(`SELECT 1 FROM avaliacoes LIMIT 1`);
    return "avaliacoes";
  } catch {
    return "avaliacao";
  }
}

/* ────────────────────────────────────────────────────────────────
   Elegibilidade / contexto
──────────────────────────────────────────────────────────────── */
async function obterContextoTurma(dbConn, turmaId) {
  const { rows, rowCount } = await dbConn.query(
    `
    SELECT
      t.id,
      t.evento_id,
      to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio_ymd,
      to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim_ymd,
      t.horario_inicio,
      t.horario_fim,
      e.tipo AS evento_tipo,
      e.titulo AS evento_titulo,
      t.nome AS turma_nome
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [Number(turmaId)]
  );

  return rowCount ? rows[0] : null;
}

async function usuarioTemPresenca(dbConn, usuarioId, turmaId) {
  const r = await dbConn.query(
    `
    SELECT 1
    FROM presencas
    WHERE usuario_id = $1
      AND turma_id   = $2
      AND presente   = true
    LIMIT 1
    `,
    [Number(usuarioId), Number(turmaId)]
  );
  return (r.rowCount || 0) > 0;
}

async function totalEncontrosTurma(dbConn, turmaId) {
  const r = await dbConn.query(
    `
    WITH dts AS (
      SELECT COUNT(*)::int AS n
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback AS (
      SELECT
        CASE
          WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS n
      FROM turmas t
      WHERE t.id = $1
    )
    SELECT
      CASE
        WHEN (SELECT n FROM dts) > 0 THEN (SELECT n FROM dts)
        ELSE (SELECT n FROM fallback)
      END AS total
    `,
    [Number(turmaId)]
  );

  return Number(r.rows?.[0]?.total || 0);
}

async function usuarioAtingiu75(dbConn, usuarioId, turmaId) {
  const total = await totalEncontrosTurma(dbConn, turmaId);
  if (total <= 0) {
    return { ok: false, presentes: 0, total, freq: 0 };
  }

  const r = await dbConn.query(
    `
    SELECT COUNT(DISTINCT p.data_presenca::date)::int AS qtd_presencas
    FROM presencas p
    WHERE p.usuario_id = $1
      AND p.turma_id   = $2
      AND p.presente   = true
    `,
    [Number(usuarioId), Number(turmaId)]
  );

  const presentes = Number(r.rows?.[0]?.qtd_presencas || 0);
  const freq = total > 0 ? presentes / total : 0;
  return { ok: freq >= 0.75, presentes, total, freq };
}

async function fimRealTurmaTS(dbConn, turmaId) {
  const r = await dbConn.query(
    `
    WITH base AS (
      SELECT
        (
          SELECT (dt.data::date + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time))
          FROM datas_turma dt
          JOIN turmas t ON t.id = dt.turma_id
          WHERE dt.turma_id = $1
          ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
          LIMIT 1
        ) AS fim_dt,
        (
          SELECT (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
          FROM turmas t
          WHERE t.id = $1
          LIMIT 1
        ) AS fim_tb
    )
    SELECT COALESCE(fim_dt, fim_tb) AS fim_local
    FROM base
    `,
    [Number(turmaId)]
  );

  return r.rows?.[0]?.fim_local || null;
}

async function turmaEncerrada(dbConn, turmaId) {
  const fimLocal = await fimRealTurmaTS(dbConn, turmaId);
  if (!fimLocal) return false;

  const r = await dbConn.query(
    `SELECT (NOW() AT TIME ZONE '${TZ}') >= $1::timestamp AS encerrou`,
    [fimLocal]
  );

  return r.rows?.[0]?.encerrou === true;
}

async function usuarioJaAvaliou(dbConn, usuarioId, turmaId) {
  const avaliacaoTable = await resolveAvaliacaoTable(dbConn);
  const r = await dbConn.query(
    `SELECT 1 FROM ${avaliacaoTable} WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [Number(usuarioId), Number(turmaId)]
  );
  return (r.rowCount || 0) > 0;
}

async function contarAvaliacoesDaTurma(dbConn, turmaId) {
  const avaliacaoTable = await resolveAvaliacaoTable(dbConn);
  const r = await dbConn.query(
    `SELECT COUNT(*)::int AS total FROM ${avaliacaoTable} WHERE turma_id = $1`,
    [Number(turmaId)]
  );
  return Number(r.rows?.[0]?.total || 0);
}

/* ────────────────────────────────────────────────────────────────
   Endpoints — Usuário / Instrutor
──────────────────────────────────────────────────────────────── */
/** POST /api/avaliacao */
async function enviarAvaliacao(req, res) {
  const rid = reqRid(req);
  const usuario_id = toPositiveInt(getUserId(req));
  const dbConn = getDb(req);
  const payload = req.body || {};
  const turma_id = toPositiveInt(payload.turma_id);
  const evento_id = payload.evento_id != null ? toPositiveInt(payload.evento_id) : null;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Não autenticado." });
  }
  if (!turma_id) {
    return res.status(400).json({ erro: "turma_id inválido." });
  }
  if (payload.evento_id != null && !evento_id) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }

  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (payload[campo] == null || String(payload[campo]).trim() === "") {
      return res.status(400).json({ erro: `Campo obrigatório '${campo}' faltando.` });
    }
  }

  try {
    const ctx = await obterContextoTurma(dbConn, turma_id);
    if (!ctx) {
      logWarn(rid, "turma não encontrada", { usuario_id, turma_id, evento_id });
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    logInfo(rid, "tentativa de envio de avaliação", {
      usuario_id,
      turma_id,
      evento_id,
      evento_id_turma: ctx.evento_id,
      evento_tipo: ctx.evento_tipo,
    });

    if (evento_id != null && evento_id !== Number(ctx.evento_id)) {
      return res.status(400).json({ erro: "evento_id não corresponde à turma_id." });
    }

    const participou = await usuarioTemPresenca(dbConn, usuario_id, turma_id);
    logInfo(rid, "check participou", { usuario_id, turma_id, participou });
    if (!participou) {
      return res.status(403).json({ erro: "Você não participou desta turma." });
    }

    const encerrada = await turmaEncerrada(dbConn, turma_id);
    logInfo(rid, "check turma encerrada", { usuario_id, turma_id, encerrada });
    if (!encerrada) {
      return res.status(403).json({ erro: "A avaliação só fica disponível após o encerramento da turma." });
    }

    const freqCheck = await usuarioAtingiu75(dbConn, usuario_id, turma_id);
    logInfo(rid, "check frequência", {
      usuario_id,
      turma_id,
      atingiu75: freqCheck.ok,
      presentes: freqCheck.presentes,
      total: freqCheck.total,
      freq: freqCheck.freq,
    });

    if (!freqCheck.ok) {
      return res.status(403).json({
        erro: "Você ainda não atingiu a frequência mínima (75%) para avaliar.",
      });
    }

    const clean = sanitizePayloadAvaliacao(payload, ctx.evento_tipo);

    const avaliacao = await withTx(req, async ({ query: q }) => {
      const localDb = { query: q };

      const lockTurma = await q(`SELECT id FROM turmas WHERE id = $1 FOR UPDATE`, [turma_id]);
      if (!lockTurma.rowCount) {
        throw Object.assign(new Error("Turma não encontrada."), { statusCode: 404 });
      }

      const avaliacaoTable = await resolveAvaliacaoTable(localDb);

      const dup = await q(
        `SELECT 1 FROM ${avaliacaoTable} WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
        [usuario_id, turma_id]
      );

      if (dup.rowCount > 0) {
        throw Object.assign(new Error("Você já avaliou esta turma."), { statusCode: 400 });
      }

      const insertSql = `
        INSERT INTO ${avaliacaoTable} (
          usuario_id, turma_id,
          desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
          material_apoio, pontualidade, sinalizacao_local, conteudo_temas,
          estrutura_local, acessibilidade, limpeza, inscricao_online,
          exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
          gostou_mais, sugestoes_melhoria, comentarios_finais, data_avaliacao
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, NOW()
        )
        RETURNING *
      `;

      const insertRes = await q(insertSql, [
        usuario_id,
        turma_id,

        clean.desempenho_instrutor,
        clean.divulgacao_evento,
        clean.recepcao,
        clean.credenciamento,

        clean.material_apoio,
        clean.pontualidade,
        clean.sinalizacao_local,
        clean.conteudo_temas,

        clean.estrutura_local,
        clean.acessibilidade,
        clean.limpeza,
        clean.inscricao_online,

        clean.exposicao_trabalhos,
        clean.apresentacao_oral_mostra,
        clean.apresentacao_tcrs,
        clean.oficinas,

        clean.gostou_mais,
        clean.sugestoes_melhoria,
        clean.comentarios_finais,
      ]);

      return insertRes.rows?.[0] || null;
    });

    logInfo(rid, "avaliação registrada", {
      avaliacao_id: avaliacao?.id || null,
      usuario_id,
      turma_id,
      evento_id: ctx.evento_id,
    });

    if (typeof notifyCertFn === "function") {
      try {
        const certPayload = {
          turma_id,
          evento_id: Number(ctx.evento_id),
          evento_titulo: ctx.evento_titulo || "evento",
        };

        if (notifyCertFn.length >= 2) {
          await notifyCertFn(usuario_id, certPayload);
        } else {
          await notifyCertFn(usuario_id);
        }

        logInfo(rid, "pós-avaliação: notificação de certificado acionada", {
          usuario_id,
          turma_id,
          evento_id: ctx.evento_id,
        });
      } catch (e) {
        logWarn(rid, "falha ao notificar certificado (não bloqueante)", {
          usuario_id,
          turma_id,
          msg: e?.message || String(e),
        });
      }
    } else {
      logWarn(rid, "notifyCertFn ausente", { usuario_id, turma_id });
    }

    return res.status(201).json({
      mensagem: "Avaliação registrada com sucesso. Se elegível, seu certificado será liberado.",
      avaliacao,
    });
  } catch (err) {
    const statusCode = Number(err?.statusCode) || 500;

    logError(rid, "erro ao registrar avaliação", err);

    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ erro: err.message || "Não foi possível registrar a avaliação." });
    }

    return res.status(500).json({ erro: "Erro ao registrar avaliação." });
  }
}

/** GET /api/avaliacao/disponiveis/:usuario_id */
async function listarAvaliacaoDisponiveis(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const authUserId = toPositiveInt(getUserId(req));
  const usuarioParam = toPositiveInt(req.params.usuario_id);
  const admin = isAdminLike(req.user || req.usuario);

  if (!authUserId) {
    return res.status(401).json({ erro: "Não autenticado." });
  }
  if (!usuarioParam) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }
  if (!admin && authUserId !== usuarioParam) {
    return res.status(403).json({ erro: "Sem permissão para consultar este usuário." });
  }

  try {
    const inscrTable = await resolveInscricaoTable(dbConn);
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const sql = `
      WITH fim_real AS (
        SELECT
          t.id AS turma_id,
          COALESCE(
            (
              SELECT (dt.data::date + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time))
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
              LIMIT 1
            ),
            (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
          ) AS fim_local
        FROM turmas t
      ),
      total_encontros AS (
        SELECT
          t.id AS turma_id,
          CASE
            WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id)
              THEN (SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id)
            WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL
              THEN 1
            ELSE 0
          END AS total
        FROM turmas t
      ),
      presencas_ok AS (
        SELECT
          p.turma_id,
          p.usuario_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
        FROM presencas p
        WHERE p.usuario_id = $1
          AND p.presente = TRUE
        GROUP BY p.turma_id, p.usuario_id
      )
      SELECT
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        to_char(COALESCE(t.horario_fim,'23:59'::time),'HH24:MI') AS horario_fim,
        te.total AS total_encontros,
        COALESCE(po.dias_presentes, 0) AS dias_presentes,
        CASE
          WHEN te.total > 0
            THEN ROUND((COALESCE(po.dias_presentes, 0)::numeric / te.total::numeric) * 100, 2)
          ELSE 0
        END AS percentual_frequencia
      FROM ${inscrTable} i
      INNER JOIN turmas t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN ${avaliacaoTable} a
        ON a.usuario_id = i.usuario_id
       AND a.turma_id   = t.id
      JOIN fim_real fr ON fr.turma_id = t.id
      JOIN total_encontros te ON te.turma_id = t.id
      LEFT JOIN presencas_ok po ON po.turma_id = t.id AND po.usuario_id = i.usuario_id
      WHERE i.usuario_id = $1
        AND a.id IS NULL
        AND te.total > 0
        AND (NOW() AT TIME ZONE '${TZ}') >= fr.fim_local
        AND COALESCE(po.dias_presentes, 0) >= CEIL(0.75 * te.total)
      ORDER BY t.data_fim DESC, t.id DESC
    `;

    const result = await dbConn.query(sql, [usuarioParam]);

    logInfo(rid, "listarAvaliacaoDisponiveis OK", {
      usuario_id: usuarioParam,
      total: result.rows?.length || 0,
      inscrTable,
      avaliacaoTable,
    });

    return res.status(200).json(result.rows || []);
  } catch (err) {
    logError(rid, "erro ao buscar avaliações disponíveis", err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações disponíveis." });
  }
}

/** GET /api/avaliacao/turma/:turma_id  (instrutor logado ou admin) */
async function listarPorTurmaParaInstrutor(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const user = req.user || req.usuario || {};
  const usuarioId = toPositiveInt(getUserId(req));
  const perfis = getPerfis(user);
  const turma_id = toPositiveInt(req.params.turma_id);

  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });
  if (!turma_id) return res.status(400).json({ erro: "ID de turma inválido." });

  try {
    const admin = perfis.includes("administrador");

    if (!admin) {
      const chk = await dbConn.query(
        `
        SELECT 1
        FROM turmas t
        WHERE t.id = $2
          AND (
            EXISTS (
              SELECT 1
              FROM turma_instrutor ti
              WHERE ti.turma_id = t.id
                AND ti.instrutor_id = $1
            )
            OR EXISTS (
              SELECT 1
              FROM evento_instrutor ei
              WHERE ei.evento_id = t.evento_id
                AND ei.instrutor_id = $1
            )
          )
        LIMIT 1
        `,
        [usuarioId, turma_id]
      );

      if (!chk.rowCount) {
        return res.status(403).json({ erro: "Acesso negado à turma." });
      }
    }

    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const r = await dbConn.query(
      `
      SELECT
        id, turma_id, usuario_id,
        desempenho_instrutor,
        divulgacao_evento, recepcao, credenciamento, material_apoio,
        pontualidade, sinalizacao_local, conteudo_temas,
        estrutura_local, acessibilidade, limpeza, inscricao_online,
        exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        gostou_mais, sugestoes_melhoria, comentarios_finais,
        data_avaliacao
      FROM ${avaliacaoTable}
      WHERE turma_id = $1
      ORDER BY id DESC
      `,
      [turma_id]
    );

    const rows = r.rows || [];

    if (IS_DEV) {
      res.setHeader("X-Debug-User", String(usuarioId));
      res.setHeader("X-Debug-Perfis", perfis.join(","));
      res.setHeader("X-Debug-Avaliacao-Count", String(rows.length));
      res.setHeader("X-Debug-Avaliacao-Table", String(avaliacaoTable));
    }

    logInfo(rid, "listarPorTurmaParaInstrutor OK", {
      turma_id,
      usuarioId,
      total: rows.length,
      admin,
      avaliacaoTable,
    });

    return res.json(rows);
  } catch (err) {
    logError(rid, "listarPorTurmaParaInstrutor", err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/* ────────────────────────────────────────────────────────────────
   Endpoints — Administração / Analytics
──────────────────────────────────────────────────────────────── */
/** GET /api/avaliacao/turma/:turma_id/all  (admin) */
async function avaliacaoPorTurma(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const turma_id = toPositiveInt(req.params.turma_id);

  if (!turma_id) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  try {
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const result = await dbConn.query(
      `
      SELECT
        u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
        a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
        a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
        a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
        a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
      FROM ${avaliacaoTable} a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      `,
      [turma_id]
    );

    const avaliacao = result.rows || [];

    const notasInstrutor = avaliacao
      .map((a) => asNullableScore(a.desempenho_instrutor))
      .filter((v) => v != null);

    const media_instrutor = notasInstrutor.length
      ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
      : null;

    const notasEvento = avaliacao
      .map((a) => mediaNotasEventoDe(a))
      .filter((v) => v != null);

    const media_evento = notasEvento.length
      ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
      : null;

    const comentarios = avaliacao
      .filter(
        (a) =>
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    const inscrTable = await resolveInscricaoTable(dbConn);

    const inscritosRes = await dbConn.query(
      `SELECT COUNT(*)::int AS total FROM ${inscrTable} WHERE turma_id = $1`,
      [turma_id]
    );
    const total_inscritos = Number(inscritosRes.rows?.[0]?.total || 0);

    const totalDias = await totalEncontrosTurma(dbConn, turma_id);

    const presencasRes = await dbConn.query(
      `
      SELECT
        usuario_id,
        to_char(data_presenca::date,'YYYY-MM-DD') AS data_ymd,
        presente
      FROM presencas
      WHERE turma_id = $1
      `,
      [turma_id]
    );

    const mapaPresencas = Object.create(null);
    for (const row of presencasRes.rows || []) {
      if (row.presente === false) continue;
      const ymd = row.data_ymd;
      if (!isYmd(ymd)) continue;

      const uid = String(row.usuario_id);
      if (!mapaPresencas[uid]) mapaPresencas[uid] = new Set();
      mapaPresencas[uid].add(ymd);
    }

    let total_presentes = 0;
    if (totalDias > 0) {
      for (const uid of Object.keys(mapaPresencas)) {
        const qtd = mapaPresencas[uid].size;
        const freq = qtd / totalDias;
        if (freq >= 0.75) total_presentes += 1;
      }
    }

    const presenca_media =
      total_inscritos > 0 ? Math.round((total_presentes / total_inscritos) * 100) : 0;

    logInfo(rid, "avaliacaoPorTurma OK", {
      turma_id,
      total_avaliacao: avaliacao.length,
      total_inscritos,
      total_presentes,
      totalDias,
      avaliacaoTable,
      inscrTable,
    });

    return res.json({
      turma_id,
      total_inscritos,
      total_presentes,
      presenca_media,
      total_avaliacao: avaliacao.length,
      media_evento,
      media_instrutor,
      comentarios,
      avaliacao,
    });
  } catch (err) {
    logError(rid, "avaliacaoPorTurma", err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/** GET /api/avaliacao/evento/:evento_id  (admin) */
async function avaliacaoPorEvento(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const evento_id = toPositiveInt(req.params.evento_id);

  if (!evento_id) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }

  try {
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const result = await dbConn.query(
      `
      SELECT
        u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
        a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
        a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
        a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
        a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
      FROM ${avaliacaoTable} a
      JOIN usuarios u ON u.id = a.usuario_id
      JOIN turmas t ON t.id = a.turma_id
      WHERE t.evento_id = $1
      `,
      [evento_id]
    );

    const avaliacao = result.rows || [];

    const notasInstrutor = avaliacao
      .map((a) => asNullableScore(a.desempenho_instrutor))
      .filter((v) => v != null);

    const media_instrutor = notasInstrutor.length
      ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
      : null;

    const notasEvento = avaliacao
      .map((a) => mediaNotasEventoDe(a))
      .filter((v) => v != null);

    const media_evento = notasEvento.length
      ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
      : null;

    const comentarios = avaliacao
      .filter(
        (a) =>
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    logInfo(rid, "avaliacaoPorEvento OK", {
      evento_id,
      total_avaliacao: avaliacao.length,
      avaliacaoTable,
    });

    return res.json({
      evento_id,
      media_evento,
      media_instrutor,
      comentarios,
    });
  } catch (err) {
    logError(rid, "avaliacaoPorEvento", err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações do evento." });
  }
}

/** GET /api/admin/avaliacao/eventos  (admin) */
async function listarEventosComAvaliacao(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);

  try {
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const result = await dbConn.query(
      `
      WITH turmas_com_count AS (
        SELECT
          t.id,
          t.evento_id,
          COUNT(a.id) AS total_respostas,
          MIN(t.data_inicio) AS di,
          MAX(t.data_fim) AS df
        FROM turmas t
        LEFT JOIN ${avaliacaoTable} a ON a.turma_id = t.id
        GROUP BY t.id
      ),
      eventos_agreg AS (
        SELECT
          e.id,
          e.titulo AS titulo,
          MIN(t.di) AS di,
          MAX(t.df) AS df,
          SUM(t.total_respostas)::int AS total_respostas
        FROM eventos e
        JOIN turmas_com_count t ON t.evento_id = e.id
        GROUP BY e.id, e.titulo
      )
      SELECT *
      FROM eventos_agreg
      WHERE total_respostas > 0
      ORDER BY di DESC NULLS LAST, id DESC
      `
    );

    logInfo(rid, "listarEventosComAvaliacao OK", {
      total: result.rows?.length || 0,
      avaliacaoTable,
    });

    return res.json(result.rows || []);
  } catch (err) {
    logError(rid, "listarEventosComAvaliacao", err);
    return res.status(500).json({ error: "Erro ao listar eventos com avaliações." });
  }
}

/** GET /api/admin/avaliacao/evento/:evento_id  (admin) */
async function obterAvaliacaoDoEvento(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const eventoId = toPositiveInt(req.params.evento_id);

  if (!eventoId) {
    return res.status(400).json({ error: "evento_id inválido" });
  }

  try {
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const turmasRes = await dbConn.query(
      `
      SELECT
        t.id,
        t.nome,
        COUNT(a.id)::int AS total_respostas
      FROM turmas t
      LEFT JOIN ${avaliacaoTable} a ON a.turma_id = t.id
      WHERE t.evento_id = $1
      GROUP BY t.id, t.nome
      ORDER BY t.id
      `,
      [eventoId]
    );
    const turmas = turmasRes.rows || [];

    const respostasRes = await dbConn.query(
      `
      SELECT
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM ${avaliacaoTable} a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE t.evento_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [eventoId]
    );

    const respostasRaw = respostasRes.rows || [];
    const respostas = respostasRaw.map((r) => ({
      ...r,
      __turmaId: r.turma_id,
      __turmaNome: r.turma_nome,
    }));

    const dist = {};
    const medias = {};
    for (const c of CAMPOS_OBJETIVOS) {
      dist[c] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    }

    for (const r of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const s = asNullableScore(r[campo]);
        if (s != null) dist[campo][String(Math.round(s))] += 1;
      }
    }

    for (const campo of CAMPOS_OBJETIVOS) {
      medias[campo] = mediaFromDist(dist[campo]);
    }

    const textos = {};
    for (const c of CAMPOS_TEXTOS) {
      textos[c] = respostas.map((r) => pickText(r[c])).filter(Boolean);
    }

    const mediasOficiais = CAMPOS_MEDIA_OFICIAL.map((c) => medias[c]).filter((x) => Number.isFinite(x));
    const mediaOficial = mediasOficiais.length
      ? Number((mediasOficiais.reduce((a, b) => a + b, 0) / mediasOficiais.length).toFixed(2))
      : null;

    logInfo(rid, "obterAvaliacaoDoEvento OK", {
      eventoId,
      respostas: respostas.length,
      turmas: turmas.length,
      avaliacaoTable,
    });

    return res.json({
      respostas,
      agregados: {
        total: respostas.length,
        dist,
        medias,
        textos,
        mediaOficial,
      },
      turmas: turmas || [],
    });
  } catch (err) {
    logError(rid, "obterAvaliacaoDoEvento", err);
    return res.status(500).json({ error: "Erro ao obter avaliações do evento." });
  }
}

/** GET /api/admin/avaliacao/turma/:turma_id  (admin) */
async function obterAvaliacaoDaTurma(req, res) {
  const rid = reqRid(req);
  const dbConn = getDb(req);
  const turmaId = toPositiveInt(req.params.turma_id);

  if (!turmaId) {
    return res.status(400).json({ error: "turma_id inválido" });
  }

  try {
    const avaliacaoTable = await resolveAvaliacaoTable(dbConn);

    const result = await dbConn.query(
      `
      SELECT
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM ${avaliacaoTable} a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [turmaId]
    );

    logInfo(rid, "obterAvaliacaoDaTurma OK", {
      turmaId,
      total: result.rows?.length || 0,
      avaliacaoTable,
    });

    return res.json(result.rows || []);
  } catch (err) {
    logError(rid, "obterAvaliacaoDaTurma", err);
    return res.status(500).json({ error: "Erro ao obter avaliações da turma." });
  }
}

/* ────────────────────────────────────────────────────────────────
   Exports
──────────────────────────────────────────────────────────────── */
module.exports = {
  // Usuário / Instrutor
  enviarAvaliacao,
  listarAvaliacaoDisponiveis,
  listarPorTurmaParaInstrutor,

  // Administração / Analytics
  avaliacaoPorTurma,
  avaliacaoPorEvento,

  // Admin legacy endpoints
  listarEventosComAvaliacao,
  obterAvaliacaoDoEvento,
  obterAvaliacaoDaTurma,
};