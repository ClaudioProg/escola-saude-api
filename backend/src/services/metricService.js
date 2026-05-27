/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/metricService.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Registrar e consultar métricas simples da plataforma.
 *
 * Contrato oficial:
 * - db exportado diretamente por backend/src/db/index.js
 * - tabela física atual: metricas
 * - chave oficial em metricas.chave
 * - valor numérico em metricas.valor_numeric
 *
 * Não usar:
 * - dbMod.db
 * - pool alternativo
 * - aliases inc/add/set/get
 * - fallback acessos_site
 */

const db = require("../db");

/* ─────────────────────────────────────────
   Constantes
───────────────────────────────────────── */

const METRICA_ACESSO_APP = "acessos_app";

/* ─────────────────────────────────────────
   Contrato obrigatório
───────────────────────────────────────── */

if (!db || typeof db.none !== "function" || typeof db.oneOrNone !== "function") {
  throw new Error(
    "[metricService] db deve exportar none() e oneOrNone()."
  );
}

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function createMetricError(message, code, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function normalizarChave(chave) {
  const key = String(chave || "").trim().toLowerCase();

  if (!key) {
    throw createMetricError(
      "Chave da métrica é obrigatória.",
      "METRICA-400-CHAVE-OBRIGATORIA"
    );
  }

  if (key.length > 120) {
    throw createMetricError(
      "Chave da métrica muito longa.",
      "METRICA-400-CHAVE-LONGA"
    );
  }

  if (!/^[a-z0-9:_-]+$/.test(key)) {
    throw createMetricError(
      "Chave da métrica possui caracteres inválidos.",
      "METRICA-400-CHAVE-INVALIDA"
    );
  }

  return key;
}

function normalizarNumero(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizarIncremento(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw createMetricError(
      "Incremento da métrica inválido.",
      "METRICA-400-INCREMENTO-INVALIDO"
    );
  }

  return number;
}

function mapMetrica(row) {
  if (!row) {
    return null;
  }

  const valor = Number(row.valor_numeric ?? 0);

  return {
    chave: row.chave,
    valor_numeric: Number.isFinite(valor) ? valor : 0,
    atualizado_em: row.atualizado_em,
  };
}

/* ─────────────────────────────────────────
   Operações base
───────────────────────────────────────── */

async function incrementarMetrica(chave, valor = 1, conn = db) {
  const key = normalizarChave(chave);
  const incremento = normalizarIncremento(valor);

  await conn.none(
    `
      INSERT INTO metricas (
        chave,
        valor_numeric,
        atualizado_em
      )
      VALUES ($1, $2, now())
      ON CONFLICT (chave)
      DO UPDATE SET
        valor_numeric = COALESCE(metricas.valor_numeric, 0)
          + EXCLUDED.valor_numeric,
        atualizado_em = now()
    `,
    [key, incremento]
  );

  return true;
}

async function definirMetrica(chave, valor = 0, conn = db) {
  const key = normalizarChave(chave);
  const numero = normalizarNumero(valor, 0);

  await conn.none(
    `
      INSERT INTO metricas (
        chave,
        valor_numeric,
        atualizado_em
      )
      VALUES ($1, $2, now())
      ON CONFLICT (chave)
      DO UPDATE SET
        valor_numeric = EXCLUDED.valor_numeric,
        atualizado_em = now()
    `,
    [key, numero]
  );

  return true;
}

async function obterMetrica(chave, conn = db) {
  const key = normalizarChave(chave);

  const row = await conn.oneOrNone(
    `
      SELECT
        chave,
        valor_numeric,
        atualizado_em
      FROM metricas
      WHERE chave = $1
      LIMIT 1
    `,
    [key]
  );

  return mapMetrica(row);
}

async function listarMetricas(prefixo = "", conn = db) {
  const prefix = String(prefixo || "").trim().toLowerCase();

  if (prefix && !/^[a-z0-9:_-]+$/.test(prefix)) {
    throw createMetricError(
      "Prefixo da métrica possui caracteres inválidos.",
      "METRICA-400-PREFIXO-INVALIDO"
    );
  }

  const params = [];
  let whereSql = "";

  if (prefix) {
    params.push(`${prefix}%`);
    whereSql = "WHERE chave LIKE $1";
  }

  const rows = await conn.any(
    `
      SELECT
        chave,
        valor_numeric,
        atualizado_em
      FROM metricas
      ${whereSql}
      ORDER BY chave ASC
    `,
    params
  );

  return (rows || []).map(mapMetrica).filter(Boolean);
}

async function registrarTimingMetrica(chave, ms) {
  const key = normalizarChave(chave);
  const valorMs = Number(ms);

  if (!Number.isFinite(valorMs) || valorMs < 0) {
    throw createMetricError(
      "Valor de timing inválido.",
      "METRICA-400-TIMING-INVALIDO"
    );
  }

  await db.tx(async (tx) => {
    await definirMetrica(`${key}:last_ms`, valorMs, tx);
    await incrementarMetrica(`${key}:count`, 1, tx);
    await incrementarMetrica(`${key}:sum_ms`, valorMs, tx);
  });

  return true;
}

/* ─────────────────────────────────────────
   Métricas oficiais da plataforma
───────────────────────────────────────── */

async function registrarAcessoApp() {
  return incrementarMetrica(METRICA_ACESSO_APP, 1);
}

async function obterAcessosApp() {
  const metrica = await obterMetrica(METRICA_ACESSO_APP);

  return metrica || {
    chave: METRICA_ACESSO_APP,
    valor_numeric: 0,
    atualizado_em: null,
  };
}

/* ─────────────────────────────────────────
   Export oficial
───────────────────────────────────────── */

module.exports = {
  METRICA_ACESSO_APP,
  incrementarMetrica,
  definirMetrica,
  obterMetrica,
  listarMetricas,
  registrarTimingMetrica,
  registrarAcessoApp,
  obterAcessosApp,
};