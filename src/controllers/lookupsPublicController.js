/* eslint-disable no-console */
// 📁 src/controllers/lookupsPublicController.js — PREMIUM (robusto, consistente, cache-friendly, fallback inteligente)
const dbMod = require("../db");

// Compat: db pode exportar { query } ou pool etc.
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[lookupsPublicController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em lookupsPublicController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
   ──────────────────────────────────────────────────────────────── */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[LOOKUP][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (!IS_DEV) return;
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
function orderByNome(alias = "") {
  const a = alias ? `${alias}.` : "";
  return ` ORDER BY ${a}nome ASC`;
}

function isMissingColumnOrRelation(err) {
  // 42703 = undefined_column, 42P01 = undefined_table
  const code = err?.code || err?.original?.code;
  return code === "42703" || code === "42P01";
}

/**
 * tryQuery:
 * - tenta SQL A; se falhar por coluna/tabela inexistente, cai no SQL B
 * - permite "massagear" rows do fallback para manter shape consistente
 */
async function tryQuery(rid, sqlPrimary, sqlFallback, massageFallbackRows) {
  try {
    const { rows } = await query(sqlPrimary);
    return rows || [];
  } catch (e) {
    if (!isMissingColumnOrRelation(e)) {
      log(rid, "error", "Lookup primary falhou (não é missing column/table)", e);
      throw e;
    }

    log(rid, "warn", "Lookup primary -> fallback", { code: e?.code, message: e?.message });

    try {
      const { rows } = await query(sqlFallback);
      const out = rows || [];
      return typeof massageFallbackRows === "function" ? massageFallbackRows(out) : out;
    } catch (e2) {
      log(rid, "error", "Lookup fallback falhou", e2);
      throw e2;
    }
  }
}

/**
 * Resposta cache-friendly:
 * - lookups mudam pouco; pode cachear curto (CDN/proxy) sem risco.
 * - Se preferir zero cache, troque por no-store.
 */
function setLookupCache(res) {
  // 10 min de cache + stale-while-revalidate (bom para performance)
  res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
}

/* ────────────────────────────────────────────────────────────────
   Endpoints (todos com shape consistente)
   ──────────────────────────────────────────────────────────────── */
async function listCargos(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      // tenta com is_active + display_order
      `
      SELECT id, nome, display_order
      FROM cargos
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, nome ASC
      `,
      // fallback mínimo
      `SELECT id, nome FROM cargos${orderByNome()}`,
      // garante chaves no shape
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listCargos erro", e);
    return res.status(500).json({ erro: "Falha ao listar cargos." });
  }
}

async function listUnidades(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      // tenta com sigla (se existir)
      `
      SELECT id, nome, sigla
      FROM unidades
      ORDER BY nome ASC
      `,
      `SELECT id, nome FROM unidades${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, sigla: x.sigla ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listUnidades erro", e);
    return res.status(500).json({ erro: "Falha ao listar unidades." });
  }
}

async function listGeneros(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      `
      SELECT id, nome, display_order
      FROM generos
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
      `,
      `SELECT id, nome FROM generos${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listGeneros erro", e);
    return res.status(500).json({ erro: "Falha ao listar gêneros." });
  }
}

async function listOrientacaoSexuais(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      `
      SELECT id, nome, display_order
      FROM orientacoes_sexuais
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
      `,
      `SELECT id, nome FROM orientacoes_sexuais${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listOrientacaoSexuais erro", e);
    return res.status(500).json({ erro: "Falha ao listar orientações sexuais." });
  }
}

async function listCoresRacas(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      `
      SELECT id, nome, display_order
      FROM cores_racas
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
      `,
      `SELECT id, nome FROM cores_racas${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listCoresRacas erro", e);
    return res.status(500).json({ erro: "Falha ao listar cores/raças." });
  }
}

async function listEscolaridades(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      `
      SELECT id, nome, display_order
      FROM escolaridades
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
      `,
      `SELECT id, nome FROM escolaridades${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listEscolaridades erro", e);
    return res.status(500).json({ erro: "Falha ao listar escolaridades." });
  }
}

async function listDeficiencias(req, res) {
  const rid = mkRid();
  try {
    setLookupCache(res);

    const rows = await tryQuery(
      rid,
      `
      SELECT id, nome, display_order
      FROM deficiencias
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
      `,
      `SELECT id, nome FROM deficiencias${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );

    return res.json(rows);
  } catch (e) {
    log(rid, "error", "listDeficiencias erro", e);
    return res.status(500).json({ erro: "Falha ao listar deficiências." });
  }
}

module.exports = {
  listCargos,
  listUnidades,
  listGeneros,
  listOrientacaoSexuais,
  listCoresRacas,
  listEscolaridades,
  listDeficiencias,
};
