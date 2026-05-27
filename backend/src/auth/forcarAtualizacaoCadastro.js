// ✅ src/auth/forcarAtualizacaoCadastro.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Middleware de diagnóstico de perfil institucional.
 *
 * Contrato oficial:
 * - Usuário autenticado em req.user / req.userId
 * - Header de resposta: X-Perfil-Incompleto = "1" ou "0"
 *
 * Regra oficial de perfil institucional obrigatório:
 * - cargo_id
 * - unidade_id
 * - data_nascimento
 * - escolaridade_id
 * - deficiencia_id
 *
 * Campos opcionais:
 * - genero_id
 * - orientacao_sexual_id
 * - cor_raca_id
 *
 * Sem aliases:
 * - sem req.usuario
 * - sem req.auth
 */

const dbModule = require("../db");

const defaultDb = dbModule?.db ?? dbModule;

/* ──────────────────────────────────────────────────────────────
   Cache curto
────────────────────────────────────────────────────────────── */

const CACHE = new Map();
const TTL_MS = 15_000;

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIL_INCOMPLETO_HEADER = "X-Perfil-Incompleto";

const CAMPOS_PERFIL_OBRIGATORIOS = [
  "cargo_id",
  "unidade_id",
  "data_nascimento",
  "escolaridade_id",
  "deficiencia_id",
];

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function getDb(req) {
  return req?.db ?? defaultDb;
}

function getUserId(req) {
  const raw = req?.userId ?? req?.user?.id ?? null;
  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getNow() {
  return Date.now();
}

function getCache(userId) {
  const cached = CACHE.get(userId);

  if (!cached) return null;

  const expired = getNow() - cached.ts > TTL_MS;

  if (expired) {
    CACHE.delete(userId);
    return null;
  }

  return cached;
}

function setCache(userId, incompleto) {
  CACHE.set(userId, {
    incompleto: !!incompleto,
    ts: getNow(),
  });
}

function clearCache(userId) {
  const id = Number(userId);

  if (Number.isSafeInteger(id) && id > 0) {
    CACHE.delete(id);
  }
}

function clearAllCache() {
  CACHE.clear();
}

function setExposeHeader(res, headerName) {
  try {
    const prev = res.getHeader("Access-Control-Expose-Headers");

    const list = String(prev || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!list.includes(headerName)) {
      list.push(headerName);
    }

    res.setHeader("Access-Control-Expose-Headers", list.join(", "));
  } catch (error) {
    console.warn("[forcarAtualizacaoCadastro] falha ao expor header", {
      message: error?.message,
    });
  }
}

function applyPerfilHeader(req, res, incompleto) {
  const value = incompleto ? "1" : "0";

  setExposeHeader(res, PERFIL_INCOMPLETO_HEADER);

  try {
    res.setHeader(PERFIL_INCOMPLETO_HEADER, value);
  } catch (error) {
    console.warn("[forcarAtualizacaoCadastro] falha ao setar header", {
      header: PERFIL_INCOMPLETO_HEADER,
      message: error?.message,
    });
  }

  req.perfilIncompleto = !!incompleto;
  res.locals.perfilIncompleto = !!incompleto;
}

function campoVazio(value) {
  return value === null || value === undefined || value === "";
}

function isPerfilInstitucionalIncompleto(usuario) {
  if (!usuario || typeof usuario !== "object") return true;

  return CAMPOS_PERFIL_OBRIGATORIOS.some((campo) => campoVazio(usuario[campo]));
}

async function queryUsuarioPerfil(db, userId) {
  if (!db?.query || typeof db.query !== "function") {
    throw new Error("DB inválido ou sem método query.");
  }

  const result = await db.query(
    `
    SELECT
      id,
      cargo_id,
      unidade_id,
      data_nascimento,
      escolaridade_id,
      deficiencia_id
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows?.[0] || null;
}

function buildErrorPayload(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    erro: message,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
  });
}

/* ──────────────────────────────────────────────────────────────
   Middleware principal
────────────────────────────────────────────────────────────── */

async function forcarAtualizacaoCadastro(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return buildErrorPayload(res, 401, "Não autenticado.", {
        autenticado: false,
      });
    }

    const cached = getCache(userId);

    if (cached) {
      applyPerfilHeader(req, res, cached.incompleto);
      return next();
    }

    const db = getDb(req);
    const usuario = await queryUsuarioPerfil(db, userId);

    if (!usuario) {
      return buildErrorPayload(res, 404, "Usuário não encontrado.", {
        autenticado: true,
      });
    }

    const incompleto = isPerfilInstitucionalIncompleto(usuario);

    applyPerfilHeader(req, res, incompleto);
    setCache(userId, incompleto);

    return next();
  } catch (error) {
    console.error("[forcarAtualizacaoCadastro] erro", {
      requestId: req?.requestId || null,
      userId: req?.userId ?? req?.user?.id ?? null,
      method: req?.method,
      url: req?.originalUrl || req?.url,
      message: error?.message,
      stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    });

    // Não derruba a requisição por falha diagnóstica.
    return next();
  }
}

/* ──────────────────────────────────────────────────────────────
   Utilitários de cache
────────────────────────────────────────────────────────────── */

forcarAtualizacaoCadastro.clearCache = clearCache;
forcarAtualizacaoCadastro.clearAllCache = clearAllCache;
forcarAtualizacaoCadastro.isPerfilInstitucionalIncompleto =
  isPerfilInstitucionalIncompleto;

module.exports = forcarAtualizacaoCadastro;