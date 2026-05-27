/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/unidadeController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Listar unidades.
 * - Obter unidade por ID.
 *
 * Contrato oficial:
 * - Tabela: unidades
 * - Campos retornados:
 *   - id
 *   - nome
 *   - sigla
 *
 * Query oficial:
 * - q
 * - limite
 * - deslocamento
 * - ordenar_por: id | nome | sigla
 * - direcao: asc | desc
 *
 * Resposta:
 * {
 *   ok: true,
 *   data: [],
 *   meta: {}
 * }
 *
 * Padrão:
 * - Sem legacy.
 * - Sem array puro.
 * - Sem fields dinâmico.
 * - Sem getDb(req).
 * - Sem aliases.
 * - Sem fallback de DB.
 * - Sem logs operacionais em sucesso.
 */

const crypto = require("crypto");

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  throw new Error("[unidadeController] db.query indisponível.");
}

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const ORDENACOES_OFICIAIS = new Set(["id", "nome", "sigla"]);
const DIRECOES_OFICIAIS = new Set(["asc", "desc"]);

const LIMITE_PADRAO = 200;
const LIMITE_MAXIMO = 200;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function respostaOk(res, status, data = {}, extra = {}) {
  return res.status(status).json({
    ok: true,
    data,
    ...extra,
  });
}

function asPositiveInt(value) {
  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function asNonNegativeInt(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) return fallback;

  return number;
}

function asLimit(value) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) return LIMITE_PADRAO;

  return Math.min(number, LIMITE_MAXIMO);
}

function sanitizeSearch(value) {
  return String(value || "").trim().slice(0, 120);
}

function parseQueryParams(query = {}) {
  const q = sanitizeSearch(query.q);

  const limite = asLimit(query.limite);
  const deslocamento = asNonNegativeInt(query.deslocamento, 0);

  const ordenarRaw = String(query.ordenar_por || "nome")
    .trim()
    .toLowerCase();

  const direcaoRaw = String(query.direcao || "asc")
    .trim()
    .toLowerCase();

  const ordenar_por = ORDENACOES_OFICIAIS.has(ordenarRaw)
    ? ordenarRaw
    : "nome";

  const direcao = DIRECOES_OFICIAIS.has(direcaoRaw) ? direcaoRaw : "asc";

  return {
    q,
    limite,
    deslocamento,
    ordenar_por,
    direcao,
  };
}

function buildEtag(payload) {
  const hash = crypto.createHash("sha1").update(payload).digest("base64url");
  return `"unidade-v2-${hash}"`;
}

function setCachingHeaders(req, res, payload) {
  const etag = buildEtag(payload);

  res.setHeader("ETag", etag);
  res.setHeader(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=600"
  );

  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return true;
  }

  return false;
}

function buildOrderSql(ordenarPor, direcao) {
  const direction = direcao === "desc" ? "DESC" : "ASC";

  if (ordenarPor === "sigla") {
    return `ORDER BY u.sigla ${direction} NULLS LAST, u.nome ASC, u.id ASC`;
  }

  if (ordenarPor === "id") {
    return `ORDER BY u.id ${direction}`;
  }

  return `ORDER BY u.nome ${direction} NULLS LAST, u.sigla ASC, u.id ASC`;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/unidade
────────────────────────────────────────────────────────────── */

async function listar(req, res) {
  const params = parseQueryParams(req.query);

  try {
    const where = [];
    const values = [];

    if (params.q) {
      values.push(`%${params.q}%`);
      where.push(
        `(unaccent(u.nome) ILIKE unaccent($1) OR unaccent(COALESCE(u.sigla, '')) ILIKE unaccent($1))`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = buildOrderSql(params.ordenar_por, params.direcao);

    const countResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM unidades u
      ${whereSql}
      `,
      values
    );

    const total = Number(countResult.rows?.[0]?.total || 0);

    const dataResult = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.sigla
      FROM unidades u
      ${whereSql}
      ${orderSql}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, params.limite, params.deslocamento]
    );

    const rows = dataResult.rows || [];

    const response = {
      ok: true,
      data: rows,
      meta: {
        total,
        count: rows.length,
        limite: params.limite,
        deslocamento: params.deslocamento,
        tem_mais: params.deslocamento + rows.length < total,
        ordenar_por: params.ordenar_por,
        direcao: params.direcao,
        q: params.q,
      },
    };

    const payload = JSON.stringify(response);

    if (setCachingHeaders(req, res, payload)) return null;

    return res.status(200).json(response);
  } catch (err) {
    console.error("[unidadeController.listar] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack,
      params,
    });

    return respostaErro(
      res,
      500,
      "UNIDADE-500-LISTAR",
      "Erro ao listar unidades."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/unidade/:id
────────────────────────────────────────────────────────────── */

async function obterPorId(req, res) {
  const id = asPositiveInt(req.params.id);

  if (!id) {
    return respostaErro(
      res,
      400,
      "UNIDADE-400-ID-INVALIDO",
      "ID de unidade inválido."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        id,
        nome,
        sigla
      FROM unidades
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const unidade = result.rows?.[0] || null;

    if (!unidade) {
      return respostaErro(
        res,
        404,
        "UNIDADE-404-NAO-ENCONTRADA",
        "Unidade não encontrada."
      );
    }

    const response = {
      ok: true,
      data: unidade,
    };

    const payload = JSON.stringify(response);

    if (setCachingHeaders(req, res, payload)) return null;

    return res.status(200).json(response);
  } catch (err) {
    console.error("[unidadeController.obterPorId] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack,
      id,
    });

    return respostaErro(
      res,
      500,
      "UNIDADE-500-OBTER",
      "Erro ao buscar unidade."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   HEAD helpers para rota
────────────────────────────────────────────────────────────── */

async function existePorId(req, res) {
  const id = asPositiveInt(req.params.id);

  if (!id) return res.sendStatus(400);

  try {
    const result = await db.query(
      `
      SELECT 1
      FROM unidades
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return res.sendStatus(result.rows?.length ? 204 : 404);
  } catch (err) {
    console.error("[unidadeController.existePorId] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      id,
    });

    return res.sendStatus(500);
  }
}

module.exports = {
  listar,
  obterPorId,
  existePorId,
};