// src/auth/authMiddleware.js
/* eslint-disable no-console */
const jwt = require("jsonwebtoken");
const cookie = require("cookie"); // útil se não usa cookie-parser

// ✅ compatível com exports: module.exports = db  OU  module.exports = { db }
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [];
  return arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
}

function normalizeUser(raw) {
  const id = Number(raw?.sub ?? raw?.id ?? raw?.userId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const roles = raw?.perfis ?? raw?.perfil ?? raw?.roles ?? [];
  return {
    id,
    nome: raw?.nome ?? null,
    email: raw?.email ?? null,
    cpf: raw?.cpf ?? null,
    perfil: toArrayLower(roles),
    raw,
  };
}

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();

  // 2) Cookies (cookie-parser ou manual)
  const c = req.cookies || cookie.parse(req.headers.cookie || "");
  return (c.token || c.jwt || c.access_token || c.auth || null)?.trim?.() || null;
}

function authMiddleware(req, res, next) {
  try {
    // ✅ Se outro middleware já setou req.user, só normaliza
    if (req.user && (req.user.id || req.user.sub || req.user.userId)) {
      const user = normalizeUser(req.user);
      if (!user) return res.status(401).json({ erro: "Sessão inválida." });

      req.user = user;
      res.locals.user = user;
      req.db = req.db ?? db;
      return next();
    }

    const token = extractToken(req);
    if (!token) return res.status(401).json({ erro: "Não autenticado." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = normalizeUser(decoded);

    if (!user) {
      return res.status(401).json({ erro: "Sessão inválida." });
    }

    req.db = req.db ?? db;
    req.user = user;
    res.locals.user = user;
    return next();
  } catch (e) {
    // ⚠️ Não vazar detalhes: log interno, resposta genérica
    console.error("🔴 [authMiddleware] JWT inválido:", e?.message || e);
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

function authAdmin(req, res, next) {
  // chama authMiddleware e depois valida role
  return authMiddleware(req, res, () => {
    const perfis = req.user?.perfil ?? [];
    if (!(perfis.includes("administrador") || perfis.includes("admin"))) {
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
