// src/auth/generateToken.js
/* eslint-disable no-console */
const jwt = require("jsonwebtoken");

/* =========================
   Helpers
========================= */
function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [];
  return arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido para geração de token.");
  }

  const id = Number(payload.id ?? payload.sub ?? payload.userId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Payload JWT inválido: id ausente.");
  }

  return {
    // 🔑 padrão JWT
    sub: id,

    // 📦 dados úteis (não sensíveis)
    id,
    nome: payload.nome ?? null,
    email: payload.email ?? null,
    cpf: payload.cpf ?? null,

    // 🔐 roles normalizadas
    perfil: toArrayLower(payload.perfil ?? payload.perfis ?? payload.roles),
  };
}

/**
 * 🔐 Gera um token JWT assinado
 *
 * @param {Object} payload - Ex: { id, cpf, nome, email, perfil: ['administrador'] }
 * @param {string} [expiresIn='1d'] - Tempo de expiração ('1d', '2h', etc.)
 * @param {Object} [options] - Opções extras do jwt.sign (opcional)
 * @returns {string} Token JWT
 */
function generateToken(payload, expiresIn = "1d", options = {}) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("❌ JWT_SECRET não definido no ambiente");
    throw new Error("Configuração de autenticação indisponível.");
  }

  const safePayload = sanitizePayload(payload);

  return jwt.sign(
    safePayload,
    secret,
    {
      expiresIn,
      ...options, // permite future-proof (issuer, audience, etc.)
    }
  );
}

module.exports = generateToken;
