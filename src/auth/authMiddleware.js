// src/auth/authMiddleware.js
/* eslint-disable no-console */
"use strict";

const jwt = require("jsonwebtoken");
const cookie = require("cookie");

// ✅ compatível com exports: module.exports = db  OU  module.exports = { db }
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const ADMIN_ROLES = ["administrador", "admin"];

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
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasAnyRole(userOrRoles, allowedRoles = []) {
  const roles = Array.isArray(userOrRoles)
    ? toArrayLower(userOrRoles)
    : toArrayLower(userOrRoles?.perfil);

  const allowed = toArrayLower(allowedRoles);
  return allowed.some((role) => roles.includes(role));
}

function normalizeUser(raw) {
  const id = Number(raw?.sub ?? raw?.id ?? raw?.userId ?? raw?.usuario_id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

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
  if (req.cookies && typeof req.cookies === "object") return req.cookies;

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
  const authorization = req.headers?.authorization || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]?.trim()) {
    return {
      token: bearerMatch[1].trim(),
      source: "authorization_bearer",
    };
  }

  // 2) Cookies (cookie-parser ou manual)
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

function attachUserContext(req, res, user) {
  req.db = req.db ?? db;

  // ✅ padrão principal
  req.user = user;

  // ✅ compat legado
  req.usuario = user;

  // ✅ facilita middlewares/logs
  req.userId = user.id;

  // ✅ compat adicional
  req.auth = req.auth ?? {
    userId: user.id,
    perfil: user.perfil,
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

function authMiddleware(req, res, next) {
  try {
    // ✅ Se outro middleware já setou req.user, só normaliza
    if (req.user && (req.user.id || req.user.sub || req.user.userId || req.user.usuario_id)) {
      const user = normalizeUser(req.user);

      if (!user) {
        console.warn(
          "[authMiddleware] req.user prévio inválido",
          buildAuthLog(req, { reqUser: req.user })
        );
        return res.status(401).json({ erro: "Sessão inválida." });
      }

      attachUserContext(req, res, user);
      return next();
    }

    const { token, source } = extractToken(req);

    if (!token) {
      console.warn(
        "[authMiddleware] token ausente",
        buildAuthLog(req, { tokenSource: source })
      );
      return res.status(401).json({ erro: "Não autenticado." });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== "string" || !jwtSecret.trim()) {
      console.error(
        "[authMiddleware] JWT_SECRET ausente ou inválido",
        buildAuthLog(req, { tokenSource: source })
      );
      return res.status(500).json({ erro: "Falha de configuração de autenticação." });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = normalizeUser(decoded);

    if (!user) {
      console.warn(
        "[authMiddleware] payload JWT sem usuário válido",
        buildAuthLog(req, {
          tokenSource: source,
          decodedKeys: decoded ? Object.keys(decoded) : [],
        })
      );
      return res.status(401).json({ erro: "Sessão inválida." });
    }

    attachUserContext(req, res, user);
    return next();
  } catch (err) {
    const isExpired = err?.name === "TokenExpiredError";
    const isJwtError =
      err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError";

    console.error(
      "[authMiddleware] falha na autenticação",
      buildAuthLog(req, {
        errorName: err?.name,
        errorMessage: err?.message,
      })
    );

    if (isExpired) {
      return res.status(401).json({ erro: "Token expirado." });
    }

    if (isJwtError) {
      return res.status(401).json({ erro: "Token inválido." });
    }

    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

function authAdmin(req, res, next) {
  return authMiddleware(req, res, () => {
    const perfis = req.user?.perfil ?? [];

    if (!hasAnyRole(perfis, ADMIN_ROLES)) {
      console.warn(
        "[authAdmin] acesso negado",
        buildAuthLog(req, {
          userId: req.user?.id,
          perfilBruto: req.user?.perfil,
        })
      );
      return res.status(403).json({ erro: "Acesso restrito a administradores." });
    }

    return next();
  });
}

module.exports = authMiddleware;
module.exports.default = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.authAny = authAny;
module.exports.authAdmin = authAdmin;
module.exports.hasAnyRole = hasAnyRole;
module.exports.toArrayLower = toArrayLower;
module.exports.normalizeUser = normalizeUser;