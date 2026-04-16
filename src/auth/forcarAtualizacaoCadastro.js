// src/auth/forcarAtualizacaoCadastro.js
/* eslint-disable no-console */
"use strict";

const dbModule = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

// ✅ compatível com:
// module.exports = db
// OU
// module.exports = { db, query, pool, ... }
const defaultDb = dbModule?.db ?? dbModule;

/* ──────────────────────────────────────────────────────────────
   Cache curto para reduzir hits no DB
   key: userId -> { incompleto: boolean, ts: number }
────────────────────────────────────────────────────────────── */
const CACHE = new Map();
const TTL_MS = 15_000; // 15s

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function getDb(req) {
  return req?.db ?? defaultDb;
}

function getUserId(req) {
  const raw =
    req?.user?.id ??
    req?.usuario?.id ??
    req?.userId ??
    req?.auth?.userId ??
    null;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
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
  if (Number.isFinite(id) && id > 0) {
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
      .map((s) => s.trim())
      .filter(Boolean);

    if (!list.includes(headerName)) {
      list.push(headerName);
    }

    res.setHeader("Access-Control-Expose-Headers", list.join(", "));
  } catch (err) {
    console.warn("[forcarAtualizacaoCadastro] falha ao expor header:", err?.message || err);
  }
}

function applyPerfilHeader(req, res, incompleto) {
  const value = incompleto ? "1" : "0";

  setExposeHeader(res, "X-Perfil-Incompleto");

  try {
    res.setHeader("X-Perfil-Incompleto", value);
  } catch (err) {
    console.warn("[forcarAtualizacaoCadastro] falha ao setar X-Perfil-Incompleto:", err?.message || err);
  }

  req.perfilIncompleto = !!incompleto;
  res.locals.perfilIncompleto = !!incompleto;
}

async function queryUsuarioPerfil(db, userId) {
  if (!db?.query || typeof db.query !== "function") {
    throw new Error("DB inválido ou sem método query.");
  }

  const { rows } = await db.query(
    `
    SELECT
      id,
      cargo_id,
      unidade_id,
      data_nascimento,
      genero_id,
      orientacao_sexual_id,
      cor_raca_id,
      escolaridade_id,
      deficiencia_id
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return rows?.[0] || null;
}

/* ──────────────────────────────────────────────────────────────
   Middleware principal
────────────────────────────────────────────────────────────── */
async function forcarAtualizacaoCadastro(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    // ✅ cache curto
    const cached = getCache(userId);
    if (cached) {
      applyPerfilHeader(req, res, cached.incompleto);
      return next();
    }

    const db = getDb(req);
    const usuario = await queryUsuarioPerfil(db, userId);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const incompleto = !!isPerfilIncompleto(usuario);

    applyPerfilHeader(req, res, incompleto);
    setCache(userId, incompleto);

    return next();
  } catch (e) {
    console.error("[forcarAtualizacaoCadastro] erro:", e?.message || e);

    // ✅ premium: não derruba a requisição
    return next();
  }
}

/* ──────────────────────────────────────────────────────────────
   Utilitários de cache
   - úteis para invalidar cache após update de perfil
────────────────────────────────────────────────────────────── */
forcarAtualizacaoCadastro.clearCache = clearCache;
forcarAtualizacaoCadastro.clearAllCache = clearAllCache;

module.exports = forcarAtualizacaoCadastro;