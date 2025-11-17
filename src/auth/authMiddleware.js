//src/auth/authMiddleware.js
/* eslint-disable no-console */
const jwt = require("jsonwebtoken");
const cookie = require("cookie"); // só se você ainda não usa cookie-parser
const { db } = require("../db");

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : (typeof v === "string" ? v.split(",") : []);
  return arr.map(s => String(s).toLowerCase().trim()).filter(Boolean);
}

function normalizeUser(raw) {
  const id = Number(raw?.sub ?? raw?.id ?? raw?.userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const roles = raw?.perfis ?? raw?.perfil ?? raw?.roles ?? [];
  return {
    id,
    nome: raw?.nome ?? null,
    cpf: raw?.cpf ?? null,
    perfil: toArrayLower(roles), // array normalizado
    raw,
  };
}

function extractToken(req) {
  // 1) Authorization: Bearer
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];

  // 2) Cookies (cookie-parser ou manual)
  const c = req.cookies || cookie.parse(req.headers.cookie || "");
  return (
    c.token || c.jwt || c.access_token || c.auth || null
  );
}

function authMiddleware(req, res, next) {
  try {
    // Se outro middleware já setou req.user, só normaliza e segue
    if (req.user && req.user.id) {
      req.user = {
        ...req.user,
        id: Number(req.user.id),
        perfil: toArrayLower(req.user.perfil ?? req.user.perfis ?? req.user.roles),
      };
      res.locals.user = req.user;
      req.db = req.db ?? db;
      return next();
    }

    const token = extractToken(req);
    if (!token) return res.status(401).json({ erro: "Não autenticado." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = normalizeUser(decoded);
    if (!user) return res.status(403).json({ erro: "Token inválido: id ausente." });

    req.db = req.db ?? db;
    req.user = user;
    res.locals.user = user;
    return next();
  } catch (e) {
    console.error("🔴 JWT inválido:", e.message);
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

function authAdmin(req, res, next) {
  return authMiddleware(req, res, (err) => {
    if (err) return next(err);
    const perfis = req.user?.perfil ?? [];
    // aceita "administrador" (oficial) e "admin" (fallback)
    if (!(perfis.includes("administrador") || perfis.includes("admin"))) {
      return res.status(403).json({ erro: "Acesso restrito a administradores." });
    }
    next();
  });
}

module.exports = authMiddleware;
module.exports.default = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.authAny = authAny;
module.exports.authAdmin = authAdmin;
