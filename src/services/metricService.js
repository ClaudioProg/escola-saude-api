/* eslint-disable no-console */
"use strict";

// ✅ src/services/metricService.js
// Serviço de métricas — compatível com pg/pg-promise, independente de Express.

const dbMod = require("../db");

/* ── Adaptação DB (pg/pg-promise) ─────────────────────────────── */
const pgpDb = dbMod?.db ?? dbMod;
const pool = dbMod?.pool || dbMod?.Pool || dbMod?.pool?.pool || dbMod;
const query =
  dbMod?.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

const isPgp = !!pgpDb?.tx && !!pgpDb?.oneOrNone;

if (typeof query !== "function" && !isPgp) {
  console.error("[metricService] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB não compatível em metricService.js (query/tx ausentes)");
}

/* ── Helpers ──────────────────────────────────────────────────── */
function toIsoSafe(v) {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  try {
    return String(v);
  } catch {
    return new Date().toISOString();
  }
}

function normalizeKey(chave) {
  const key = String(chave || "").trim().toLowerCase();
  if (!key) {
    const err = new Error("Chave da métrica é obrigatória.");
    err.code = "METRIC_KEY_REQUIRED";
    throw err;
  }
  if (key.length > 120) {
    const err = new Error("Chave da métrica muito longa.");
    err.code = "METRIC_KEY_TOO_LONG";
    throw err;
  }
  return key;
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function execNone(sql, params = []) {
  if (isPgp) return pgpDb.none(sql, params);
  await query(sql, params);
  return null;
}

async function execOneOrNone(sql, params = []) {
  if (isPgp) return pgpDb.oneOrNone(sql, params);
  const r = await query(sql, params);
  return r?.rows?.[0] || null;
}

/* ── Operações base ──────────────────────────────────────────── */
async function incrementar(chave, valor = 1) {
  const key = normalizeKey(chave);
  const incValue = normalizeNumber(valor, 1);

  const sql = `
    INSERT INTO metricas (chave, valor_numeric, atualizado_em)
    VALUES ($1, $2, now())
    ON CONFLICT (chave)
    DO UPDATE SET
      valor_numeric = COALESCE(metricas.valor_numeric, 0) + EXCLUDED.valor_numeric,
      atualizado_em = now()
  `;

  await execNone(sql, [key, incValue]);
  return true;
}

async function adicionar(chave, valor = 1) {
  return incrementar(chave, valor);
}

async function definir(chave, valor = 0) {
  const key = normalizeKey(chave);
  const num = normalizeNumber(valor, 0);

  const sql = `
    INSERT INTO metricas (chave, valor_numeric, atualizado_em)
    VALUES ($1, $2, now())
    ON CONFLICT (chave)
    DO UPDATE SET
      valor_numeric = EXCLUDED.valor_numeric,
      atualizado_em = now()
  `;

  await execNone(sql, [key, num]);
  return true;
}

async function obter(chave) {
  const key = normalizeKey(chave);

  const sql = `
    SELECT chave, valor_numeric, atualizado_em
    FROM metricas
    WHERE chave = $1
    LIMIT 1
  `;

  return execOneOrNone(sql, [key]);
}

async function timing(chave, ms) {
  const key = normalizeKey(chave);
  const valorMs = normalizeNumber(ms, NaN);

  if (!Number.isFinite(valorMs) || valorMs < 0) {
    const err = new Error("Valor de timing inválido.");
    err.code = "METRIC_TIMING_INVALID";
    throw err;
  }

  // salva o último timing observado
  await definir(`${key}:last_ms`, valorMs);

  // acumula contagem e soma para média posterior
  await incrementar(`${key}:count`, 1);
  await incrementar(`${key}:sum_ms`, valorMs);

  return true;
}

/* ── Facades de alto nível ───────────────────────────────────── */
async function registrarVisita() {
  await incrementar("acessos_app", 1);
  return true;
}

/**
 * Retorna:
 * {
 *   acessos_app,
 *   atualizado_em
 * }
 *
 * Fallback para 'acessos_site' se 'acessos_app' não existir.
 */
async function obterMetricasPublicas() {
  try {
    let acessos = null;

    try {
      acessos = await obter("acessos_app");
      if (!acessos) {
        acessos = await obter("acessos_site");
      }
    } catch {
      acessos = null;
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

/* ── API pública do serviço ──────────────────────────────────── */
module.exports = {
  // base
  incrementar,
  adicionar,
  definir,
  obter,
  timing,

  // aliases compat com rotas/uso externo
  inc: incrementar,
  add: adicionar,
  set: definir,
  get: obter,

  // alto nível
  registrarVisita,
  obterMetricasPublicas,
};