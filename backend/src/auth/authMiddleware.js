// ✅ backend/src/auth/authMiddleware.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Contrato oficial de autenticação:
 * - Token recebido exclusivamente por Authorization: Bearer <token>
 * - JWT oficial:
 *   {
 *     sub: string,
 *     perfil: "usuario" | "organizador" | "administrador"
 *   }
 *
 * Request oficial após autenticação:
 * - req.user
 * - req.userId
 * - req.perfil
 *
 * Sem aliases:
 * - sem req.usuario
 * - sem req.auth
 * - sem admin
 * - sem roles/role/perfis
 * - sem cookie auth/access_token/jwt
 * - sem perfil em array
 * - sem normalização corretiva
 */

const jwt = require("jsonwebtoken");

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);
const PERFIL_ADMINISTRADOR = "administrador";

const IS_PROD = process.env.NODE_ENV === "production";
const JWT_ISS = process.env.JWT_ISSUER || undefined;
const JWT_AUD = process.env.JWT_AUDIENCE || undefined;

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function buildAuthLog(req, extra = {}) {
  return {
    requestId: req.requestId || null,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers?.["user-agent"] || null,
    ...extra,
  };
}

function buildAuthErrorResponse(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    erro: message,
    autenticado: false,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
  });
}

function normalizarPerfilOficial(perfil) {
  const valor = String(perfil || "").trim();

  if (!valor) return "";

  if (!PERFIS_OFICIAIS.has(valor)) return "";

  return valor;
}

function perfilPermitido(perfilUsuario, perfisPermitidos = []) {
  const perfil = normalizarPerfilOficial(perfilUsuario);

  if (!perfil) return false;

  if (!Array.isArray(perfisPermitidos) || !perfisPermitidos.length) {
    return false;
  }

  return perfisPermitidos.some((item) => {
    const permitido = normalizarPerfilOficial(item);
    return permitido && permitido === perfil;
  });
}

function extractToken(req) {
  const authorization = String(req.headers?.authorization || "").trim();
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch?.[1]?.trim()) {
    return null;
  }

  return bearerMatch[1].trim();
}

function getJwtSecret() {
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();

  if (!jwtSecret) return null;

  return jwtSecret;
}

function verifyJwtToken(token) {
  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    const error = new Error("JWT_SECRET ausente ou inválido.");
    error.code = "JWT_SECRET_MISSING";
    throw error;
  }

  const verifyOptions = {};

  if (JWT_ISS) verifyOptions.issuer = JWT_ISS;
  if (JWT_AUD) verifyOptions.audience = JWT_AUD;

  return jwt.verify(token, jwtSecret, verifyOptions);
}

function normalizeUserFromJwt(decoded) {
  const id = Number(decoded?.sub);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  const perfil = normalizarPerfilOficial(decoded?.perfil);

  if (!perfil) {
    return null;
  }

  return {
    id,
    perfil,
  };
}

function attachUserContext(req, res, user) {
  req.db = req.db ?? db;

  req.user = user;
  req.userId = user.id;
  req.perfil = user.perfil;

  res.locals.user = user;
}

/* ──────────────────────────────────────────────────────────────
   Core de autenticação
────────────────────────────────────────────────────────────── */

function authenticateRequest(req, res) {
  const token = extractToken(req);

  if (!token) {
    if (!IS_PROD) {
      console.warn(
        "[authMiddleware] token ausente",
        buildAuthLog(req, { tokenSource: null })
      );
    }

    return {
      ok: false,
      response: buildAuthErrorResponse(res, 401, "Não autenticado.", {
        sessionExpired: false,
      }),
    };
  }

  try {
    const decoded = verifyJwtToken(token);
    const user = normalizeUserFromJwt(decoded);

    if (!user) {
      console.warn(
        "[authMiddleware] payload JWT fora do contrato oficial",
        buildAuthLog(req, {
          decodedKeys: decoded ? Object.keys(decoded) : [],
        })
      );

      return {
        ok: false,
        response: buildAuthErrorResponse(res, 401, "Sessão inválida.", {
          sessionExpired: false,
        }),
      };
    }

    attachUserContext(req, res, user);

    return {
      ok: true,
      user,
      decoded,
    };
  } catch (error) {
    const isExpired = error?.name === "TokenExpiredError";
    const isJwtError =
      error?.name === "JsonWebTokenError" ||
      error?.name === "NotBeforeError";
    const isSecretMissing = error?.code === "JWT_SECRET_MISSING";

    if (isSecretMissing) {
      console.error(
        "[authMiddleware] JWT_SECRET ausente ou inválido",
        buildAuthLog(req)
      );

      return {
        ok: false,
        response: res.status(500).json({
          ok: false,
          erro: "Falha de configuração de autenticação.",
          autenticado: false,
          requestId: res.getHeader("X-Request-Id"),
        }),
      };
    }

    console.error(
      "[authMiddleware] falha na autenticação",
      buildAuthLog(req, {
        errorName: error?.name,
        errorMessage: error?.message,
      })
    );

    if (isExpired) {
      return {
        ok: false,
        response: buildAuthErrorResponse(res, 401, "Token expirado.", {
          sessionExpired: true,
        }),
      };
    }

    if (isJwtError) {
      return {
        ok: false,
        response: buildAuthErrorResponse(res, 401, "Token inválido.", {
          sessionExpired: false,
        }),
      };
    }

    return {
      ok: false,
      response: buildAuthErrorResponse(res, 401, "Token inválido ou expirado.", {
        sessionExpired: false,
      }),
    };
  }
}

/* ──────────────────────────────────────────────────────────────
   Middlewares
────────────────────────────────────────────────────────────── */

function authMiddleware(req, res, next) {
  const authResult = authenticateRequest(req, res);

  if (!authResult.ok) {
    return authResult.response;
  }

  return next();
}

function authAdmin(req, res, next) {
  const authResult = authenticateRequest(req, res);

  if (!authResult.ok) {
    return authResult.response;
  }

  if (!perfilPermitido(req.user.perfil, [PERFIL_ADMINISTRADOR])) {
    console.warn(
      "[authAdmin] acesso negado",
      buildAuthLog(req, {
        userId: req.user?.id,
        perfil: req.user?.perfil,
      })
    );

    return res.status(403).json({
      ok: false,
      erro: "Acesso restrito a administradores.",
      autenticado: true,
      autorizado: false,
      requestId: res.getHeader("X-Request-Id"),
    });
  }

  return next();
}

/* ──────────────────────────────────────────────────────────────
   Exports
────────────────────────────────────────────────────────────── */

module.exports = authMiddleware;

module.exports.authMiddleware = authMiddleware;
module.exports.authAdmin = authAdmin;

module.exports.perfilPermitido = perfilPermitido;
module.exports.normalizarPerfilOficial = normalizarPerfilOficial;
module.exports.extractToken = extractToken;
module.exports.authenticateRequest = authenticateRequest;