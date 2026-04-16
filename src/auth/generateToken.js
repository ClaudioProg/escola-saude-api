// src/auth/generateToken.js
/* eslint-disable no-console */
"use strict";

const jwt = require("jsonwebtoken");

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function uniq(arr) {
  return [...new Set(arr)];
}

function toArrayLower(value) {
  if (!value) return [];

  const arr = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return uniq(
    arr
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function cleanNullable(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const str = String(value).trim();
  return str === "" ? null : str;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido para geração de token.");
  }

  const id = Number(payload.id ?? payload.sub ?? payload.userId ?? payload.usuario_id);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Payload JWT inválido: id ausente ou inválido.");
  }

  const perfil = toArrayLower(
    payload.perfil ??
    payload.perfis ??
    payload.roles ??
    payload.role
  );

  const safePayload = {
    // ✅ padrão JWT: sub deve ser string
    sub: String(id),

    // ✅ compat com o restante do projeto
    id,
    nome: cleanNullable(payload.nome ?? payload.name),
    email: cleanNullable(payload.email),
    cpf: cleanNullable(payload.cpf),

    // ✅ papéis normalizados
    perfil,
  };

  // remove undefined, mantém null quando intencional
  return Object.fromEntries(
    Object.entries(safePayload).filter(([, value]) => value !== undefined)
  );
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret) {
    console.error("❌ [generateToken] JWT_SECRET não definido no ambiente");
    throw new Error("Configuração de autenticação indisponível.");
  }

  return secret;
}

function buildSignOptions(expiresIn, options = {}) {
  const signOptions = {
    expiresIn: expiresIn || "1d",
    ...options,
  };

  const issuer = String(process.env.JWT_ISSUER || "").trim();
  const audience = String(process.env.JWT_AUDIENCE || "").trim();

  if (!signOptions.issuer && issuer) {
    signOptions.issuer = issuer;
  }

  if (!signOptions.audience && audience) {
    signOptions.audience = audience;
  }

  return signOptions;
}

/* ──────────────────────────────────────────────────────────────
   Geração de token
────────────────────────────────────────────────────────────── */
/**
 * Gera um token JWT assinado.
 *
 * Exemplo de payload:
 * {
 *   id: 1,
 *   nome: "Cláudio",
 *   email: "teste@email.com",
 *   cpf: "12345678900",
 *   perfil: ["administrador"]
 * }
 *
 * @param {Object} payload
 * @param {string} [expiresIn="1d"]
 * @param {Object} [options={}]
 * @returns {string}
 */
function generateToken(payload, expiresIn = "1d", options = {}) {
  const secret = getJwtSecret();
  const safePayload = sanitizePayload(payload);
  const signOptions = buildSignOptions(expiresIn, options);

  return jwt.sign(safePayload, secret, signOptions);
}

module.exports = generateToken;