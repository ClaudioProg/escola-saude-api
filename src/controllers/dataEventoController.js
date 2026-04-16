/* eslint-disable no-console */
// ✅ src/controllers/datasEventoController.js — PREMIUM+++
// - Compat DB robusta (req.db + fallback)
// - Logs com RID
// - Date-only safe
// - Prioridade de datas:
//   1) datas_turma
//   2) presencas (DISTINCT)
//   3) intervalo da turma
// - Cache para existência de datas_turma
// - Deduplicação e normalização defensiva
// - Saídas estáveis para frontend
"use strict";

const rawDb = require("../db");
const dbFallback = rawDb?.db ?? rawDb;

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Compat DB
=========================================================================== */
function getDb(req) {
  return req?.db ?? dbFallback;
}

async function runQuery(db, sql, params = []) {
  if (typeof db?.query === "function") return db.query(sql, params);
  throw new Error("DB inválido: query ausente.");
}

/* =========================================================================
   Logger premium
=========================================================================== */
function mkRid(prefix = "DATAS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "DATAS") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;
  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
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
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* =========================================================================
   Helpers
=========================================================================== */
function isIsoDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHHMM(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeRow(r) {
  const data = String(r?.data || "").slice(0, 10);
  const hi = String(r?.horario_inicio || "").slice(0, 5);
  const hf = String(r?.horario_fim || "").slice(0, 5);

  return {
    data: isIsoDateOnly(data) ? data : null,
    horario_inicio: isHHMM(hi) ? hi : "00:00",
    horario_fim: isHHMM(hf) ? hf : "23:59",
  };
}

function dedupeRowsByDate(rows = []) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    if (!row?.data || !isIsoDateOnly(row.data)) continue;
    if (seen.has(row.data)) continue;
    seen.add(row.data);
    out.push(row);
  }

  return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

function respondError(res, status, msg, err) {
  return res.status(status).json({
    erro: msg,
    detalhe: IS_DEV ? err?.message || String(err || "") : undefined,
  });
}

/* =========================================================================
   Cache: existência da tabela datas_turma
=========================================================================== */
let _hasDatasTurmaCached = null;
let _hasDatasTurmaCheckedAt = 0;
const HAS_TABLE_TTL_MS = 5 * 60 * 1000;

async function hasDatasTurmaTable(db) {
  const now = Date.now();

  if (
    _hasDatasTurmaCached !== null &&
    now - _hasDatasTurmaCheckedAt < HAS_TABLE_TTL_MS
  ) {
    return _hasDatasTurmaCached;
  }

  try {
    const q = await runQuery(
      db,
      `SELECT to_regclass('public.datas_turma') IS NOT NULL AS ok`
    );

    _hasDatasTurmaCached = q?.rows?.[0]?.ok === true;
    _hasDatasTurmaCheckedAt = now;
    return _hasDatasTurmaCached;
  } catch (e) {
    _hasDatasTurmaCached = false;
    _hasDatasTurmaCheckedAt = now;
    return false;
  }
}

/* =========================================================================
   Base da turma
=========================================================================== */
async function getTurmaBase(db, turmaId) {
  const r = await runQuery(
    db,
    `
    SELECT
      id,
      data_inicio::date AS di,
      data_fim::date    AS df,
      to_char(COALESCE(horario_inicio, '00:00'::time), 'HH24:MI') AS hi,
      to_char(COALESCE(horario_fim, '23:59'::time), 'HH24:MI') AS hf
    FROM turmas
    WHERE id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return r?.rows?.[0] || null;
}

/* =========================================================================
   Fontes de datas
=========================================================================== */
async function _datasReais(db, turmaId) {
  const has = await hasDatasTurmaTable(db);
  if (!has) return [];

  const r = await runQuery(
    db,
    `
    SELECT
      to_char(dt.data::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(dt.horario_inicio, t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(dt.horario_fim, t.horario_fim, '23:59'::time), 'HH24:MI') AS horario_fim
    FROM datas_turma dt
    JOIN turmas t ON t.id = dt.turma_id
    WHERE dt.turma_id = $1
    ORDER BY dt.data ASC
    `,
    [turmaId]
  );

  return dedupeRowsByDate((r?.rows || []).map(normalizeRow));
}

async function _datasPresencas(db, turmaId) {
  const r = await runQuery(
    db,
    `
    SELECT DISTINCT
      to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(t.horario_fim, '23:59'::time), 'HH24:MI') AS horario_fim
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    WHERE p.turma_id = $1
    ORDER BY 1 ASC
    `,
    [turmaId]
  );

  return dedupeRowsByDate((r?.rows || []).map(normalizeRow));
}

async function _datasIntervalo(db, turmaBase) {
  const turmaId = Number(turmaBase.id);

  const r = await runQuery(
    db,
    `
    WITH t AS (
      SELECT
        $1::int AS turma_id,
        $2::date AS di,
        $3::date AS df,
        $4::text AS hi,
        $5::text AS hf
    )
    SELECT
      to_char(gs::date, 'YYYY-MM-DD') AS data,
      t.hi AS horario_inicio,
      t.hf AS horario_fim
    FROM t,
         generate_series(t.di, t.df, interval '1 day') AS gs
    ORDER BY 1 ASC
    `,
    [turmaId, turmaBase.di, turmaBase.df, turmaBase.hi, turmaBase.hf]
  );

  return dedupeRowsByDate((r?.rows || []).map(normalizeRow));
}

/* =========================================================================
   Resolvedor premium
=========================================================================== */
const VIA_ALLOWED = new Set(["datas", "especificas", "presencas", "intervalo"]);

function normalizeVia(v) {
  const via = String(v || "intervalo").toLowerCase().trim();
  if (!VIA_ALLOWED.has(via)) return "intervalo";
  return via === "especificas" ? "datas" : via;
}

/**
 * Resolve datas com fallback:
 * - via=datas      -> datas_turma -> presencas -> intervalo
 * - via=presencas  -> presencas -> intervalo
 * - via=intervalo  -> datas_turma -> intervalo
 */
async function resolveDatasTurma(db, { turmaId, via, rid }) {
  const turmaBase = await getTurmaBase(db, turmaId);

  if (!turmaBase) {
    const e = new Error("Turma não encontrada.");
    e.status = 404;
    throw e;
  }

  if (!turmaBase.di || !turmaBase.df) {
    const e = new Error("Turma sem data_inicio/data_fim configuradas.");
    e.status = 409;
    throw e;
  }

  let source = "intervalo";
  let rows = [];

  if (via === "datas") {
    rows = await _datasReais(db, turmaId);
    source = "datas_turma";

    if (!rows.length) {
      rows = await _datasPresencas(db, turmaId);
      source = rows.length ? "presencas" : "intervalo";
      if (!rows.length) rows = await _datasIntervalo(db, turmaBase);
    }

    logInfo(rid, "resolveDatasTurma via=datas", {
      turmaId,
      source,
      total: rows.length,
    });

    return { rows, source };
  }

  if (via === "presencas") {
    rows = await _datasPresencas(db, turmaId);
    source = "presencas";

    if (!rows.length) {
      rows = await _datasIntervalo(db, turmaBase);
      source = "intervalo";
    }

    logInfo(rid, "resolveDatasTurma via=presencas", {
      turmaId,
      source,
      total: rows.length,
    });

    return { rows, source };
  }

  rows = await _datasReais(db, turmaId);
  if (rows.length) {
    source = "datas_turma";

    logInfo(rid, "resolveDatasTurma via=intervalo usando datas_turma", {
      turmaId,
      source,
      total: rows.length,
    });

    return { rows, source };
  }

  rows = await _datasIntervalo(db, turmaBase);
  source = "intervalo";

  logInfo(rid, "resolveDatasTurma via=intervalo usando fallback", {
    turmaId,
    source,
    total: rows.length,
  });

  return { rows, source };
}

/* =========================================================================
   Handlers
=========================================================================== */

/**
 * GET /api/datas/turma/:id?via=(datas|especificas|presencas|intervalo)
 */
async function listarDatasDaTurma(req, res) {
  const rid = reqRid(req, "DATAS-LIST");
  const db = getDb(req);
  const turmaId = toIntId(req.params.id);

  if (!turmaId) {
    return respondError(res, 400, "turma_id inválido.");
  }

  const via = normalizeVia(req.query.via);

  try {
    logInfo(rid, "listarDatasDaTurma:start", { turmaId, via });

    const { rows, source } = await resolveDatasTurma(db, {
      turmaId,
      via,
      rid,
    });

    const out = dedupeRowsByDate(rows);

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(out.length));
    res.setHeader("X-Datas-Handler", "datasEventoController:listarDatasDaTurma@premium+++");

    logInfo(rid, "listarDatasDaTurma:ok", {
      turmaId,
      via,
      source,
      total: out.length,
    });

    return res.json(out);
  } catch (erro) {
    logErr(rid, "listarDatasDaTurma erro", erro);

    const status = Number(erro?.status) || 500;
    if (status === 404) return respondError(res, 404, "Turma não encontrada.", erro);
    if (status === 409) {
      return respondError(res, 409, "Turma inválida para geração de datas.", erro);
    }
    return respondError(res, 500, "Erro ao buscar datas da turma.", erro);
  }
}

/**
 * GET /api/datas/turma/:id/ocorrencias
 * Retorna apenas ["YYYY-MM-DD", ...]
 */
async function listarOcorrenciasTurma(req, res) {
  const rid = reqRid(req, "DATAS-OCO");
  const db = getDb(req);
  const turmaId = toIntId(req.params.id);

  if (!turmaId) {
    return respondError(res, 400, "turma_id inválido.");
  }

  try {
    logInfo(rid, "listarOcorrenciasTurma:start", { turmaId });

    const turmaBase = await getTurmaBase(db, turmaId);
    if (!turmaBase) {
      return respondError(res, 404, "Turma não encontrada.");
    }

    let source = "datas_turma";
    let rows = await _datasReais(db, turmaId);

    if (!rows.length) {
      source = "presencas";
      rows = await _datasPresencas(db, turmaId);
    }

    if (!rows.length) {
      source = "intervalo";
      if (!turmaBase.di || !turmaBase.df) {
        return respondError(res, 409, "Turma inválida para geração de datas.");
      }
      rows = await _datasIntervalo(db, turmaBase);
    }

    const uniq = Array.from(
      new Set(rows.map((r) => r.data).filter(isIsoDateOnly))
    ).sort();

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(uniq.length));
    res.setHeader("X-Datas-Handler", "datasEventoController:listarOcorrenciasTurma@premium+++");

    logInfo(rid, "listarOcorrenciasTurma:ok", {
      turmaId,
      source,
      total: uniq.length,
    });

    return res.json(uniq);
  } catch (erro) {
    logErr(rid, "listarOcorrenciasTurma erro", erro);
    return respondError(res, 500, "Erro ao buscar ocorrências.", erro);
  }
}

module.exports = {
  listarDatasDaTurma,
  listarOcorrenciasTurma,
};