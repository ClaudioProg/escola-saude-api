// src/auth/authorizeRoles.js

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [];
  return arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
}

function makeAuthorize({ mode = "any" } = {}) {
  return (...rolesPermitidos) => {
    const allowed = toArrayLower(rolesPermitidos);

    return (req, res, next) => {
      // 🔐 Depende do authMiddleware ter rodado antes
      if (!req.user) {
        return res.status(401).json({ erro: "Não autenticado." });
      }

      const userRoles = toArrayLower(req.user.perfil);

      if (allowed.length === 0) {
        // Se alguém chamou authorizeRoles() sem roles, não bloqueia (evita lock acidental)
        return next();
      }

      const ok =
        mode === "all"
          ? allowed.every((r) => userRoles.includes(r))
          : allowed.some((r) => userRoles.includes(r)); // "any" (padrão)

      if (!ok) {
        return res.status(403).json({ erro: "Acesso negado." });
      }

      return next();
    };
  };
}

// ✅ uso padrão: authorizeRoles("administrador", "instrutor")
const authorizeRoles = makeAuthorize({ mode: "any" });

// ✅ sugar: authorizeRoles.any(...) e authorizeRoles.all(...)
authorizeRoles.any = makeAuthorize({ mode: "any" });
authorizeRoles.all = makeAuthorize({ mode: "all" });

module.exports = authorizeRoles;
