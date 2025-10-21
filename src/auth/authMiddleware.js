/* eslint-disable no-console */
const jwt = require("jsonwebtoken");
const { db } = require("../db"); // ✅ import único e correto

let warned = false; // avisa 1x em dev sobre req.user

/**
 * Middleware base: valida JWT e injeta req.user
 */
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  const token = m[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // aceita sub (padrão JWT) ou id
    const userId = decoded.sub ?? decoded.id;
    if (!userId) {
      return res.status(403).json({ erro: "Token inválido: id ausente." });
    }

    // normaliza perfil -> array
    const perfil = Array.isArray(decoded.perfil)
      ? decoded.perfil
      : typeof decoded.perfil === "string"
        ? decoded.perfil.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

    const user = {
      id: String(userId),
      cpf: decoded.cpf ?? null,
      nome: decoded.nome ?? null,
      perfil,
    };

    req.db = req.db ?? db;
    req.user = user;
    req.user = user; // compat temporária

    if (process.env.NODE_ENV !== "production" && !warned) {
      warned = true;
      // padroniza: sempre colocar o usuário em res.locals.user (fonte única)
 // manter req.user apenas por compat (será removido depois)
 const user = decoded || null; // de onde você já extrai o payload do JWT
 res.locals.user = user;
 req.user = user; // compat
 if (!user || !user.id || !Number.isFinite(Number(user.id))) {
   return res.status(401).json({ erro: "Não autorizado" });
 }
    }

    return next();
  } catch (e) {
    console.error("🔴 JWT inválido:", e.message);
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

/**
 * Wrapper: permite apenas usuários autenticados (qualquer papel)
 */
function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

/**
 * Wrapper: exige perfil de administrador
 */
function authAdmin(req, res, next) {
  return authMiddleware(req, res, (err) => {
    if (err) return next(err);
    const perfis = req.user?.perfil ?? [];
    if (!perfis.includes("administrador")) {
      return res.status(403).json({ erro: "Acesso restrito a administradores." });
    }
    next();
  });
}

/* ───────────────── Exports ───────────────── */
module.exports = authMiddleware;           // default CJS
module.exports.default = authMiddleware;   // compat
module.exports.authMiddleware = authMiddleware;
module.exports.authAny = authAny;
module.exports.authAdmin = authAdmin;
