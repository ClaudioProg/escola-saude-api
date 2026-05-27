/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/lookupPublicController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Listar dados auxiliares públicos para cadastro, perfil e filtros.
 *
 * Contrato oficial:
 * - Singular nos nomes de arquivos, rotas e handlers.
 * - Sem aliases.
 * - Sem fallback de DB.
 * - Sem fallback de coluna/tabela.
 * - Sem req.db.
 * - Sem resposta em array puro.
 *
 * Resposta:
 * {
 *   ok: true,
 *   data: []
 * }
 */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ─────────────────────────────────────────────────────────────
   Contrato obrigatório
────────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  throw new Error("[lookupPublicController] db.query indisponível.");
}

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function respostaOk(res, data = []) {
  return res.status(200).json({
    ok: true,
    data,
  });
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function logErro(scope, err) {
  console.error(`[lookupPublicController.${scope}] ERRO`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    stack: err?.stack,
  });
}

async function listarLookup(res, scope, sql, code, message) {
  try {
    const result = await db.query(sql);
    return respostaOk(res, result.rows || []);
  } catch (err) {
    logErro(scope, err);
    return respostaErro(res, 500, code, message);
  }
}

/* ─────────────────────────────────────────────────────────────
   Cargo
────────────────────────────────────────────────────────────── */

async function listarCargo(_req, res) {
  return listarLookup(
    res,
    "listarCargo",
    `
    SELECT
      id,
      nome,
      display_order
    FROM cargos
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, nome ASC, id ASC
    `,
    "LOOKUP-CARGO-500-LISTAR",
    "Erro ao listar cargos."
  );
}

/* ─────────────────────────────────────────────────────────────
   Unidade
────────────────────────────────────────────────────────────── */

async function listarUnidade(_req, res) {
  return listarLookup(
    res,
    "listarUnidade",
    `
    SELECT
      id,
      nome,
      sigla
    FROM unidades
    ORDER BY nome ASC, sigla ASC, id ASC
    `,
    "LOOKUP-UNIDADE-500-LISTAR",
    "Erro ao listar unidades."
  );
}

/* ─────────────────────────────────────────────────────────────
   Gênero
────────────────────────────────────────────────────────────── */

async function listarGenero(_req, res) {
  return listarLookup(
    res,
    "listarGenero",
    `
    SELECT
      id,
      nome,
      display_order
    FROM generos
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, id ASC
    `,
    "LOOKUP-GENERO-500-LISTAR",
    "Erro ao listar gêneros."
  );
}

/* ─────────────────────────────────────────────────────────────
   Orientação sexual
────────────────────────────────────────────────────────────── */

async function listarOrientacaoSexual(_req, res) {
  return listarLookup(
    res,
    "listarOrientacaoSexual",
    `
    SELECT
      id,
      nome,
      display_order
    FROM orientacoes_sexuais
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, nome ASC, id ASC
    `,
    "LOOKUP-ORIENTACAO-SEXUAL-500-LISTAR",
    "Erro ao listar orientações sexuais."
  );
}

/* ─────────────────────────────────────────────────────────────
   Cor/raça
────────────────────────────────────────────────────────────── */

async function listarCorRaca(_req, res) {
  return listarLookup(
    res,
    "listarCorRaca",
    `
    SELECT
      id,
      nome,
      display_order
    FROM cores_racas
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, nome ASC, id ASC
    `,
    "LOOKUP-COR-RACA-500-LISTAR",
    "Erro ao listar cores/raças."
  );
}

/* ─────────────────────────────────────────────────────────────
   Escolaridade
────────────────────────────────────────────────────────────── */

async function listarEscolaridade(_req, res) {
  return listarLookup(
    res,
    "listarEscolaridade",
    `
    SELECT
      id,
      nome,
      display_order
    FROM escolaridades
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, nome ASC, id ASC
    `,
    "LOOKUP-ESCOLARIDADE-500-LISTAR",
    "Erro ao listar escolaridades."
  );
}

/* ─────────────────────────────────────────────────────────────
   Deficiência
────────────────────────────────────────────────────────────── */

async function listarDeficiencia(_req, res) {
  return listarLookup(
    res,
    "listarDeficiencia",
    `
    SELECT
      id,
      nome,
      display_order
    FROM deficiencias
    WHERE is_active = TRUE
    ORDER BY display_order NULLS LAST, nome ASC, id ASC
    `,
    "LOOKUP-DEFICIENCIA-500-LISTAR",
    "Erro ao listar deficiências."
  );
}

module.exports = {
  listarCargo,
  listarUnidade,
  listarGenero,
  listarOrientacaoSexual,
  listarCorRaca,
  listarEscolaridade,
  listarDeficiencia,
};