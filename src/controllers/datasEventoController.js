/* eslint-disable no-console */
const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Lista datas de uma turma com diferentes fontes (prioridade):
 * - datas_turma (datas reais, com horários por encontro quando existirem)
 * - presencas (DISTINCT p.data_presenca, horários herdados da turma)
 * - intervalo (generate_series entre data_inicio e data_fim, horários herdados da turma)
 *
 * listarDatasDaTurma:
 *   [{ data: 'YYYY-MM-DD', horario_inicio: 'HH:MM', horario_fim: 'HH:MM' }, ...]
 *
 * listarOcorrenciasTurma:
 *   ["YYYY-MM-DD", ...]
 */

/* ───────────────── Helpers ───────────────── */

// valida "YYYY-MM-DD"
function isIsoDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// valida "HH:MM"
function isHHMM(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

// normaliza saída defensiva
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

function respondError(res, status, msg, err) {
  return res.status(status).json({
    erro: msg,
    detalhe: IS_DEV ? (err?.message || String(err || "")) : undefined,
  });
}

/* ───────────────── Cache: existência datas_turma ───────────────── */

let _hasDatasTurmaCached = null;
let _hasDatasTurmaCheckedAt = 0;
const HAS_TABLE_TTL_MS = 5 * 60 * 1000; // 5 min

async function hasDatasTurmaTable() {
  const now = Date.now();
  if (_hasDatasTurmaCached !== null && now - _hasDatasTurmaCheckedAt < HAS_TABLE_TTL_MS) {
    return _hasDatasTurmaCached;
  }

  try {
    const q = await db.query(
      `SELECT to_regclass('public.datas_turma') IS NOT NULL AS ok;`
    );
    _hasDatasTurmaCached = q?.rows?.[0]?.ok === true;
    _hasDatasTurmaCheckedAt = now;
    return _hasDatasTurmaCached;
  } catch (e) {
    // se der ruim, assume false (não derruba endpoint)
    _hasDatasTurmaCached = false;
    _hasDatasTurmaCheckedAt = now;
    return false;
  }
}

/* ───────────────── Queries ───────────────── */

async function getTurmaBase(turmaId) {
  const r = await db.query(
    `
    SELECT
      id,
      data_inicio::date AS di,
      data_fim::date    AS df,
      to_char(COALESCE(horario_inicio, '00:00'::time), 'HH24:MI') AS hi,
      to_char(COALESCE(horario_fim,   '23:59'::time), 'HH24:MI') AS hf
    FROM turmas
    WHERE id = $1
    LIMIT 1
    `,
    [turmaId]
  );
  return r?.rows?.[0] || null;
}

/** Datas reais (datas_turma), preferindo horário do encontro; fallback para horário da turma */
async function _datasReais(turmaId) {
  const has = await hasDatasTurmaTable();
  if (!has) return [];

  const r = await db.query(
    `
    SELECT
      to_char(dt.data::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(dt.horario_inicio, t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(dt.horario_fim,   t.horario_fim,   '23:59'::time), 'HH24:MI') AS horario_fim
    FROM datas_turma dt
    JOIN turmas t ON t.id = dt.turma_id
    WHERE dt.turma_id = $1
    ORDER BY dt.data ASC
    `,
    [turmaId]
  );

  return (r?.rows || []).map(normalizeRow).filter(x => x.data);
}

/** Datas a partir de presenças (DISTINCT), horários herdados da turma */
async function _datasPresencas(turmaId) {
  const r = await db.query(
    `
    SELECT DISTINCT
      to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(t.horario_fim,   '23:59'::time), 'HH24:MI') AS horario_fim
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    WHERE p.turma_id = $1
    ORDER BY 1 ASC
    `,
    [turmaId]
  );

  return (r?.rows || []).map(normalizeRow).filter(x => x.data);
}

/** Intervalo [data_inicio..data_fim] */
async function _datasIntervalo(turmaBase) {
  // turmaBase já validada (di/df existem)
  const turmaId = Number(turmaBase.id);

  const r = await db.query(
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
    FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
    ORDER BY 1 ASC
    `,
    [turmaId, turmaBase.di, turmaBase.df, turmaBase.hi, turmaBase.hf]
  );

  return (r?.rows || []).map(normalizeRow).filter(x => x.data);
}

/* ───────────────── Resolvedor premium ───────────────── */

const VIA_ALLOWED = new Set(["datas", "especificas", "presencas", "intervalo"]);

function normalizeVia(v) {
  const via = String(v || "intervalo").toLowerCase().trim();
  if (!VIA_ALLOWED.has(via)) return "intervalo";
  return via === "especificas" ? "datas" : via;
}

/**
 * Resolve datas com fallback em cascata:
 * - via=datas → datas_turma -> (se vazio) presencas -> (se vazio) intervalo
 * - via=presencas → presencas -> (se vazio) intervalo
 * - via=intervalo → (se existir datas_turma) usa datas_turma, senão intervalo
 */
async function resolveDatasTurma({ turmaId, via }) {
  // 1) Turma existe?
  const turmaBase = await getTurmaBase(turmaId);
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
    rows = await _datasReais(turmaId);
    source = "datas_turma";
    if (!rows.length) {
      rows = await _datasPresencas(turmaId);
      source = rows.length ? "presencas" : "intervalo";
      if (!rows.length) rows = await _datasIntervalo(turmaBase);
    }
    return { rows, source };
  }

  if (via === "presencas") {
    rows = await _datasPresencas(turmaId);
    source = "presencas";
    if (!rows.length) {
      rows = await _datasIntervalo(turmaBase);
      source = "intervalo";
    }
    return { rows, source };
  }

  // via === "intervalo" (default): prioridade para datas reais se existirem
  rows = await _datasReais(turmaId);
  if (rows.length) {
    source = "datas_turma";
    return { rows, source };
  }

  rows = await _datasIntervalo(turmaBase);
  source = "intervalo";
  return { rows, source };
}

/* ───────────────── Handlers ───────────────── */

/**
 * GET /api/datas/turma/:id?via=(datas|especificas|presencas|intervalo)
 */
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!Number.isFinite(turmaId) || turmaId <= 0) {
    return respondError(res, 400, "turma_id inválido.");
  }

  const via = normalizeVia(req.query.via);

  try {
    const { rows, source } = await resolveDatasTurma({ turmaId, via });

    // dedupe por data (defensivo, caso alguma fonte duplique)
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (!r?.data) continue;
      if (seen.has(r.data)) continue;
      seen.add(r.data);
      out.push(r);
    }

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(out.length));
    return res.json(out);
  } catch (erro) {
    const status = Number(erro?.status) || 500;
    console.error("❌ [datasEvento] erro:", erro?.stack || erro);
    if (status === 404) return respondError(res, 404, "Turma não encontrada.", erro);
    if (status === 409) return respondError(res, 409, "Turma inválida para geração de datas.", erro);
    return respondError(res, 500, "Erro ao buscar datas da turma.", erro);
  }
}

/**
 * GET /api/datas/turma/:id/ocorrencias
 * Retorna apenas array de strings "YYYY-MM-DD"
 */
async function listarOcorrenciasTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!Number.isFinite(turmaId) || turmaId <= 0) {
    return respondError(res, 400, "turma_id inválido.");
  }

  try {
    // prioridade fixa: datas reais -> presencas -> intervalo
    // (não depende de via)
    const turmaBase = await getTurmaBase(turmaId);
    if (!turmaBase) return respondError(res, 404, "Turma não encontrada.");

    let source = "datas_turma";
    let rows = await _datasReais(turmaId);

    if (!rows.length) {
      source = "presencas";
      rows = await _datasPresencas(turmaId);
    }
    if (!rows.length) {
      source = "intervalo";
      if (!turmaBase.di || !turmaBase.df) return respondError(res, 409, "Turma inválida para geração de datas.");
      rows = await _datasIntervalo(turmaBase);
    }

    const uniq = Array.from(
      new Set(rows.map(r => r.data).filter(isIsoDateOnly))
    ).sort();

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(uniq.length));
    return res.json(uniq);
  } catch (erro) {
    console.error("❌ [datasEvento/ocorrencias] erro:", erro?.stack || erro);
    return respondError(res, 500, "Erro ao buscar ocorrências.", erro);
  }
}

module.exports = {
  listarDatasDaTurma,
  listarOcorrenciasTurma,
};
