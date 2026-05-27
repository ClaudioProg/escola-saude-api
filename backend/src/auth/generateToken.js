// ✅ backend/src/auth/generateToken.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Contrato oficial do JWT:
 * - Entrada obrigatória:
 *   {
 *     id: number,
 *     perfil: "usuario" | "organizador" | "administrador"
 *   }
 *
 * - Payload assinado:
 *   {
 *     sub: string,
 *     perfil: string
 *   }
 *
 * Premissa:
 * - Sem aliases.
 * - Sem userId.
 * - Sem usuario_id.
 * - Sem role/roles/perfis.
 * - Sem admin.
 * - Sem array de perfis.
 * - Sem normalização corretiva.
 * - Perfil oficial de administrador: "administrador".
 */

const jwt = require("jsonwebtoken");

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function normalizarPerfil(perfil) {
  const valor = String(perfil || "").trim();

  if (!valor) {
    throw new Error("Payload JWT inválido: perfil ausente.");
  }

  if (!PERFIS_OFICIAIS.has(valor)) {
    throw new Error(`Payload JWT inválido: perfil não permitido (${valor}).`);
  }

  return valor;
}

function normalizarId(id) {
  const numero = Number(id);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error("Payload JWT inválido: id ausente ou inválido.");
  }

  return numero;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido para geração de token.");
  }

  const id = normalizarId(payload.id);
  const perfil = normalizarPerfil(payload.perfil);

  return {
    sub: String(id),
    perfil,
  };
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret) {
    console.error("[generateToken] JWT_SECRET não definido no ambiente.");
    throw new Error("Configuração de autenticação indisponível.");
  }

  return secret;
}

function buildSignOptions(expiresIn, options = {}) {
  const issuer = String(process.env.JWT_ISSUER || "").trim();
  const audience = String(process.env.JWT_AUDIENCE || "").trim();

  const signOptions = {
    expiresIn: expiresIn || "1d",
    ...options,
  };

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
 * Gera token JWT oficial da plataforma.
 *
 * @param {{ id: number, perfil: "usuario" | "organizador" | "administrador" }} payload
 * @param {string} [expiresIn="1d"]
 * @param {object} [options={}]
 * @returns {string}
 */
function generateToken(payload, expiresIn = "1d", options = {}) {
  const secret = getJwtSecret();
  const safePayload = sanitizePayload(payload);
  const signOptions = buildSignOptions(expiresIn, options);

  return jwt.sign(safePayload, secret, signOptions);
}

module.exports = generateToken;