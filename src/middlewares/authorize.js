/* eslint-disable no-console */

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

/* =========================
   Core — fábrica de middleware
   mode: "any" (default) | "all"
========================= */
function makeAuthorize({ mode = "any" } = {}) {
  return (...rolesPermitidos) => {
    const allowed = toArrayLower(rolesPermitidos);

    return (req, res, next) => {
      // 🔐 Depende do authMiddleware ter populado req.user
      if (!req.user) {
        return res.status(401).json({ erro: "Não autenticado." });
      }

      // ✅ aceita req.user.perfil como string OU array OU "admin,instrutor"
      const userRoles = toArrayLower(req.user.perfil ?? req.user.roles ?? req.user.role);

      // Sem roles exigidas => não bloqueia (evita lock acidental)
      if (allowed.length === 0) return next();

      const ok =
        mode === "all"
          ? allowed.every((r) => userRoles.includes(r))
          : allowed.some((r) => userRoles.includes(r)); // "any"

      if (!ok) {
        return res.status(403).json({ erro: "Acesso negado." });
      }

      return next();
    };
  };
}

/* =========================
   Exports
========================= */
// Uso padrão: authorize("administrador", "instrutor")
const authorize = makeAuthorize({ mode: "any" });

// Açúcar sintático:
authorize.any = makeAuthorize({ mode: "any" }); // exige pelo menos um dos perfis
authorize.all = makeAuthorize({ mode: "all" }); // exige todos os perfis

// ✅ Aliases de compatibilidade (pra não quebrar routes antigos)
const authorizeRoles = authorize.any;
const authorizeRole = authorize.any;

// Alias compatível com "admin"
function requireAdmin(req, res, next) {
  return authorize.any("administrador", "admin")(req, res, next);
}

module.exports = {
  authorize,
  authorizeRoles, // ✅ agora existe
  authorizeRole,  // ✅ agora existe
  requireAdmin,
  toArrayLower,
};
