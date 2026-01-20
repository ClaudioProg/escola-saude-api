/* eslint-disable no-console */
// Serviço de métricas — compatível com pg/pg-promise, independente de Express.

const dbMod = require("../db");

/* ── Adaptação DB (pg/pg-promise) ─────────────────────────────── */
const pgpDb = dbMod?.db ?? dbMod; // alguns projetos exportam { db }
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

const isPgp = !!pgpDb?.tx && !!pgpDb?.oneOrNone;

/* ── Utils ───────────────────────────────────────────────────── */
function toIsoSafe(v) {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  try { return String(v); } catch { return new Date().toISOString(); }
}

/* ── Operações base ──────────────────────────────────────────── */
async function incrementar(chave) {
  const sql = `
    INSERT INTO metricas (chave, valor_numeric)
    VALUES ($1, 1)
    ON CONFLICT (chave)
    DO UPDATE SET
      valor_numeric = metricas.valor_numeric + 1,
      atualizado_em = now()
  `;
  if (isPgp) return pgpDb.tx((t) => t.none(sql, [chave]));
  if (typeof query === "function") { await query(sql, [chave]); return; }
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

/* ── Facades de alto nível (sem Express) ─────────────────────── */
async function registrarVisita() {
  await incrementar("acessos_app");
  return true; // para quem chamar poder decidir a resposta HTTP
}

/**
 * Retorna { acessos_app, atualizado_em } — tolerante a falhas.
 * Fallback para 'acessos_site' se 'acessos_app' não existir.
 */
async function obterMetricasPublicas() {
  try {
    let acessos = { valor_numeric: 0, atualizado_em: null };
    try {
      const app = await obter("acessos_app");
      if (app) acessos = app;
      else {
        const site = await obter("acessos_site");
        if (site) acessos = site;
      }
    } catch {
      // silencioso — página pública nunca quebra
    }

    const valor = Number(acessos?.valor_numeric ?? 0);
    const atualizadoEm = toIsoSafe(acessos?.atualizado_em);

    return {
      acessos_app: Number.isFinite(valor) ? valor : 0,
      atualizado_em: atualizadoEm,
    };
  } catch {
    return {
      acessos_app: 0,
      atualizado_em: new Date().toISOString(),
    };
  }
}

module.exports = {
  // baixo nível
  incrementar,
  obter,
  // alto nível
  registrarVisita,
  obterMetricasPublicas,
};
