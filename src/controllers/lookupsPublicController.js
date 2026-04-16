/* eslint-disable no-console */
// 📁 src/controllers/lookupsPublicController.js — PREMIUM++
// - Compat DB robusta (req.db + fallback)
// - Cache-friendly
// - Fallback inteligente para colunas opcionais
// - Menos duplicação
// - Shape consistente nas respostas

"use strict";

const dbMod = require("../db");

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const baseQuery =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof baseQuery !== "function") {
  console.error("[lookupsPublicController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em lookupsPublicController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query: baseQuery };
}

async function queryDb(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
──────────────────────────────────────────────────────────────── */
function mkRid(prefix = "LOOKUP") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[LOOKUP][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (!IS_DEV) return undefined;

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
  const code = err?.code || err?.original?.code;
  return code === "42703" || code === "42P01";
}

function setLookupCache(res) {
  res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
  res.set("Vary", "Accept-Encoding");
}

async function tryQuery(req, rid, sqlPrimary, sqlFallback, massageFallbackRows) {
  try {
    const { rows } = await queryDb(req, sqlPrimary);
    return rows || [];
  } catch (e) {
    if (!isMissingColumnOrRelation(e)) {
      log(rid, "error", "Lookup primary falhou (não é missing column/table)", e);
      throw e;
    }

    log(rid, "warn", "Lookup primary -> fallback", {
      code: e?.code,
      message: e?.message,
    });

    try {
      const { rows } = await queryDb(req, sqlFallback);
      const out = rows || [];
      return typeof massageFallbackRows === "function"
        ? massageFallbackRows(out)
        : out;
    } catch (e2) {
      log(rid, "error", "Lookup fallback falhou", e2);
      throw e2;
    }
  }
}

function withDisplayOrder(rows = []) {
  return rows.map((x) => ({
    ...x,
    display_order: x.display_order ?? null,
  }));
}

function withSigla(rows = []) {
  return rows.map((x) => ({
    ...x,
    sigla: x.sigla ?? null,
  }));
}

async function genericList(req, res, config) {
  const rid = mkRid();

  try {
    setLookupCache(res);

    const rows = await tryQuery(
      req,
      rid,
      config.sqlPrimary,
      config.sqlFallback,
      config.massageFallbackRows
    );

    log(rid, "info", `${config.label} OK`, { total: rows.length });
    return res.json(rows);
  } catch (e) {
    log(rid, "error", `${config.label} erro`, e);
    return res.status(500).json({ erro: config.errorMessage });
  }
}

/* ────────────────────────────────────────────────────────────────
   Endpoints
──────────────────────────────────────────────────────────────── */
async function listCargos(req, res) {
  return genericList(req, res, {
    label: "listCargos",
    errorMessage: "Falha ao listar cargos.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM cargos
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, nome ASC
    `,
    sqlFallback: `SELECT id, nome FROM cargos${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
}

async function listUnidades(req, res) {
  return genericList(req, res, {
    label: "listUnidades",
    errorMessage: "Falha ao listar unidades.",
    sqlPrimary: `
      SELECT id, nome, sigla
      FROM unidades
      ORDER BY nome ASC
    `,
    sqlFallback: `SELECT id, nome FROM unidades${orderByNome()}`,
    massageFallbackRows: withSigla,
  });
}

async function listGeneros(req, res) {
  return genericList(req, res, {
    label: "listGeneros",
    errorMessage: "Falha ao listar gêneros.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM generos
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
    `,
    sqlFallback: `SELECT id, nome FROM generos${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
}

async function listOrientacaoSexuais(req, res) {
  return genericList(req, res, {
    label: "listOrientacaoSexuais",
    errorMessage: "Falha ao listar orientações sexuais.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM orientacoes_sexuais
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
    `,
    sqlFallback: `SELECT id, nome FROM orientacoes_sexuais${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
}

async function listCoresRacas(req, res) {
  return genericList(req, res, {
    label: "listCoresRacas",
    errorMessage: "Falha ao listar cores/raças.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM cores_racas
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
    `,
    sqlFallback: `SELECT id, nome FROM cores_racas${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
}

async function listEscolaridades(req, res) {
  return genericList(req, res, {
    label: "listEscolaridades",
    errorMessage: "Falha ao listar escolaridades.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM escolaridades
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
    `,
    sqlFallback: `SELECT id, nome FROM escolaridades${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
}

async function listDeficiencias(req, res) {
  return genericList(req, res, {
    label: "listDeficiencias",
    errorMessage: "Falha ao listar deficiências.",
    sqlPrimary: `
      SELECT id, nome, display_order
      FROM deficiencias
      WHERE is_active = TRUE
      ORDER BY display_order NULLS LAST, id ASC
    `,
    sqlFallback: `SELECT id, nome FROM deficiencias${orderByNome()}`,
    massageFallbackRows: withDisplayOrder,
  });
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