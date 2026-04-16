// src/auth/authMiddleware.js
/* eslint-disable no-console */
"use strict";

const jwt = require("jsonwebtoken");
const cookie = require("cookie");

// ✅ compatível com:
// module.exports = db
// OU
// module.exports = { db, query, pool, ... }
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const ADMIN_ROLES = ["administrador", "admin"];
const IS_PROD = process.env.NODE_ENV === "production";
const JWT_ISS = process.env.JWT_ISSUER || undefined;
const JWT_AUD = process.env.JWT_AUDIENCE || undefined;

/* ──────────────────────────────────────────────────────────────
   Helpers gerais
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

function hasAnyRole(userOrRoles, allowedRoles = []) {
  const roles = Array.isArray(userOrRoles)
    ? toArrayLower(userOrRoles)
    : toArrayLower(
        userOrRoles?.perfis ??
        userOrRoles?.perfil ??
        userOrRoles?.roles ??
        userOrRoles?.role
      );

  const allowed = toArrayLower(allowedRoles);
  return allowed.some((role) => roles.includes(role));
}

function normalizeUser(raw) {
  const id = Number(
    raw?.sub ??
    raw?.id ??
    raw?.userId ??
    raw?.usuario_id
  );

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  const roles =
    raw?.perfis ??
    raw?.perfil ??
    raw?.roles ??
    raw?.role ??
    [];

  return {
    id,
    nome: raw?.nome ?? raw?.name ?? null,
    email: raw?.email ?? null,
    cpf: raw?.cpf ?? null,
    perfil: toArrayLower(roles),
    raw,
  };
}

function parseCookies(req) {
  if (req.cookies && typeof req.cookies === "object") {
    return req.cookies;
  }

  try {
    return cookie.parse(req.headers?.cookie || "");
  } catch (err) {
    console.warn("[authMiddleware] falha ao parsear cookies", {
      message: err?.message,
      url: req.originalUrl,
      method: req.method,
    });
    return {};
  }
}

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]?.trim()) {
    return {
      token: bearerMatch[1].trim(),
      source: "authorization_bearer",
    };
  }

  // 2) Cookies
  const cookies = parseCookies(req);
  const token =
    cookies.token ||
    cookies.jwt ||
    cookies.access_token ||
    cookies.auth ||
    null;

  if (typeof token === "string" && token.trim()) {
    return {
      token: token.trim(),
      source: "cookie",
    };
  }

  return {
    token: null,
    source: null,
  };
}

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || typeof jwtSecret !== "string" || !jwtSecret.trim()) {
    return null;
  }

  return jwtSecret.trim();
}

function verifyJwtToken(token) {
  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    const err = new Error("JWT_SECRET ausente ou inválido");
    err.code = "JWT_SECRET_MISSING";
    throw err;
  }

  const verifyOptions = {};
  if (JWT_ISS) verifyOptions.issuer = JWT_ISS;
  if (JWT_AUD) verifyOptions.audience = JWT_AUD;

  return jwt.verify(token, jwtSecret, verifyOptions);
}

function attachUserContext(req, res, user) {
  req.db = req.db ?? db;

  // ✅ padrão principal
  req.user = user;

  // ✅ compat legado
  req.usuario = user;

  // ✅ facilita middlewares / logs / controllers antigos
  req.userId = user.id;

  // ✅ contexto auth padronizado
  req.auth = {
    ...(req.auth || {}),
    userId: user.id,
    perfil: user.perfil,
    user,
  };

  res.locals.user = user;
}

function buildAuthLog(req, extra = {}) {
  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers?.["user-agent"] || null,
    ...extra,
  };
}

function buildAuthErrorResponse(res, status, message, extra = {}) {
  return res.status(status).json({
    erro: message,
    autenticado: false,
    ...extra,
  });
}

/* ──────────────────────────────────────────────────────────────
   Core de autenticação
────────────────────────────────────────────────────────────── */
function authenticateRequest(req, res) {
  // ✅ Se outro middleware já setou req.user, apenas normaliza e reaproveita
  if (req.user && (req.user.id || req.user.sub || req.user.userId || req.user.usuario_id)) {
    const normalizedFromReq = normalizeUser(req.user);

    if (!normalizedFromReq) {
      console.warn(
        "[authMiddleware] req.user prévio inválido",
        buildAuthLog(req, { reqUserKeys: Object.keys(req.user || {}) })
      );

      return {
        ok: false,
        response: buildAuthErrorResponse(res, 401, "Sessão inválida.", {
          sessionExpired: false,
        }),
      };
    }

    attachUserContext(req, res, normalizedFromReq);

    return {
      ok: true,
      user: normalizedFromReq,
      tokenSource: "preloaded_req_user",
    };
  }

  const { token, source } = extractToken(req);

  if (!token) {
    if (!IS_PROD) {
      console.warn(
        "[authMiddleware] token ausente",
        buildAuthLog(req, { tokenSource: source })
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
    const user = normalizeUser(decoded);

    if (!user) {
      console.warn(
        "[authMiddleware] payload JWT sem usuário válido",
        buildAuthLog(req, {
          tokenSource: source,
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
      tokenSource: source,
      decoded,
    };
  } catch (err) {
    const isExpired = err?.name === "TokenExpiredError";
    const isJwtError =
      err?.name === "JsonWebTokenError" ||
      err?.name === "NotBeforeError";
    const isSecretMissing = err?.code === "JWT_SECRET_MISSING";

    if (isSecretMissing) {
      console.error(
        "[authMiddleware] JWT_SECRET ausente ou inválido",
        buildAuthLog(req, { tokenSource: source })
      );

      return {
        ok: false,
        response: res.status(500).json({
          erro: "Falha de configuração de autenticação.",
          autenticado: false,
        }),
      };
    }

    console.error(
      "[authMiddleware] falha na autenticação",
      buildAuthLog(req, {
        tokenSource: source,
        errorName: err?.name,
        errorMessage: err?.message,
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

function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

function authAdmin(req, res, next) {
  const authResult = authenticateRequest(req, res);

  if (!authResult.ok) {
    return authResult.response;
  }

  const perfis = req.user?.perfil ?? [];

  if (!hasAnyRole(perfis, ADMIN_ROLES)) {
    console.warn(
      "[authAdmin] acesso negado",
      buildAuthLog(req, {
        userId: req.user?.id,
        perfilBruto: req.user?.perfil,
      })
    );

    return res.status(403).json({
      erro: "Acesso restrito a administradores.",
      autenticado: true,
      autorizado: false,
    });
  }

  return next();
}

/* ──────────────────────────────────────────────────────────────
   Exports
────────────────────────────────────────────────────────────── */
module.exports = authMiddleware;
module.exports.default = authMiddleware;

module.exports.authMiddleware = authMiddleware;
module.exports.authAny = authAny;
module.exports.authAdmin = authAdmin;

module.exports.hasAnyRole = hasAnyRole;
module.exports.toArrayLower = toArrayLower;
module.exports.normalizeUser = normalizeUser;
module.exports.extractToken = extractToken;
module.exports.authenticateRequest = authenticateRequest;