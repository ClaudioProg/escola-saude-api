// 📁 src/middlewares/requireAdmin.js
/* eslint-disable no-console */

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [];
  return arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
}

/**
 * 🔐 Middleware que garante acesso apenas a administradores
 * Requer que authMiddleware já tenha rodado
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  const perfis = toArrayLower(req.user.perfil);

  // aceita "administrador" (oficial) e "admin" (fallback)
  if (perfis.includes("administrador") || perfis.includes("admin")) {
    return next();
  }

  return res.status(403).json({ erro: "Acesso restrito a administradores." });
}

module.exports = requireAdmin;
