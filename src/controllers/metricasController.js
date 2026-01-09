// 📁 src/controllers/metricasController.js — PREMIUM (robusto, compatível pg-promise/pg, date-only safe no retorno, sem Date na coluna)
// ✅ Conta acessos do APP (sem Instagram)
/* eslint-disable no-console */

const dbMod = require("../db");

/**
 * Este controller é compatível com:
 * 1) pg-promise: db.oneOrNone / db.tx / t.none
 * 2) node-postgres (pg): { query } ou pool.query
 *
 * Sem depender do formato exato do teu ../db.
 */
const pgpDb = dbMod?.db ?? dbMod; // alguns projetos exportam { db }
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
   ──────────────────────────────────────────────────────────────── */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[metricas][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (!IS_DEV) return;
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   DB Helpers (compat)
   ──────────────────────────────────────────────────────────────── */
const isPgp = !!pgpDb?.tx && !!pgpDb?.oneOrNone;

function toIsoSafe(v) {
  // Evita new Date() em dados do banco; mas como isso é só "atualizado_em" informativo,
  // usamos ISO do servidor se o banco não retornar algo confiável.
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  try {
    return String(v);
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Incrementa a métrica (UPSERT).
 * Em pg-promise: usa tx/none.
 * Em pg: faz query simples.
 */
async function incrementar(chave) {
  const sql = `
    INSERT INTO metricas (chave, valor_numeric)
    VALUES ($1, 1)
    ON CONFLICT (chave)
    DO UPDATE SET
      valor_numeric = metricas.valor_numeric + 1,
      atualizado_em = now()
  `;

  if (isPgp) {
    return pgpDb.tx((t) => t.none(sql, [chave]));
  }
  if (typeof query === "function") {
    await query(sql, [chave]);
    return;
  }

  throw new Error("DB não compatível: query/tx ausentes em ../db");
}

async function obter(chave) {
  const sql = `SELECT valor_numeric, atualizado_em FROM metricas WHERE chave=$1`;

  if (isPgp) return pgpDb.oneOrNone(sql, [chave]);
  if (typeof query === "function") {
    const r = await query(sql, [chave]);
    return r?.rows?.[0] || null;
  }

  throw new Error("DB não compatível: query/oneOrNone ausentes em ../db");
}

/* ────────────────────────────────────────────────────────────────
   Endpoints
   ──────────────────────────────────────────────────────────────── */

/**
 * POST /api/metricas/contar-visita
 * Mantém compatibilidade com o front.
 * - incrementa 'acessos_app'
 * - 204 no-content no sucesso
 */
async function contarVisita(_req, res) {
  const rid = mkRid();
  try {
    await incrementar("acessos_app");
    return res.status(204).end();
  } catch (e) {
    log(rid, "error", "contarVisita erro", e);
    return res.status(500).json({ error: "Falha ao contar visita" });
  }
}

/**
 * GET /api/metricas/publica
 * - retorna apenas 'acessos_app'
 * - fallback legado: 'acessos_site'
 * Observação: `atualizado_em` ideal é o do banco; se não vier, cai no server time.
 */
async function getMetricasPublica(_req, res) {
  const rid = mkRid();

  try {
    let acessos = { valor_numeric: 0, atualizado_em: null };

    try {
      const app = await obter("acessos_app");
      if (app) {
        acessos = app;
      } else {
        const site = await obter("acessos_site");
        if (site) acessos = site;
      }
    } catch (e) {
      log(rid, "warn", "Falha lendo acessos_app/site (não bloqueante)", e?.message || e);
    }

    const valor = Number(acessos?.valor_numeric ?? 0);
    const atualizadoEm = toIsoSafe(acessos?.atualizado_em);

    return res.json({
      acessos_app: Number.isFinite(valor) ? valor : 0,
      atualizado_em: atualizadoEm,
    });
  } catch (e) {
    log(rid, "error", "getMetricasPublica FATAL (fallback 0)", e);
    // Nunca derruba a página pública
    return res.json({
      acessos_app: 0,
      atualizado_em: new Date().toISOString(),
    });
  }
}

module.exports = {
  contarVisita,
  getMetricasPublica,
};
