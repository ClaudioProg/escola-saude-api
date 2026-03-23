/* eslint-disable no-console */
"use strict";

/* =========================
   Constantes / helpers base
========================= */
const ROLE_ALIASES = {
  admin: "administrador",
};

function uniq(arr) {
  return [...new Set(arr)];
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "";
  return ROLE_ALIASES[value] || value;
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
      .map((item) => normalizeRole(item))
      .filter(Boolean)
  );
}

function getUserRoles(req) {
  return toArrayLower(
    req?.user?.perfil ??
    req?.user?.perfis ??
    req?.user?.roles ??
    req?.user?.role
  );
}

function buildAuthzLog(req, extra = {}) {
  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id ?? null,
    perfilBruto:
      req.user?.perfil ??
      req.user?.perfis ??
      req.user?.roles ??
      req.user?.role ??
      null,
    ...extra,
  };
}

/* =========================
   Core — fábrica de middleware
   mode: "any" (default) | "all"
========================= */
function makeAuthorize({ mode = "any" } = {}) {
  const safeMode = mode === "all" ? "all" : "any";

  return (...rolesPermitidos) => {
    const allowed = toArrayLower(rolesPermitidos);

    return (req, res, next) => {
      // 🔐 Depende do authMiddleware ter populado req.user
      if (!req.user) {
        console.warn(
          "[authorize] acesso sem autenticação",
          buildAuthzLog(req, {
            mode: safeMode,
            allowed,
          })
        );
        return res.status(401).json({ erro: "Não autenticado." });
      }

      const userRoles = getUserRoles(req);

      // ✅ Sem roles exigidas => não bloqueia, mas loga para evitar configuração solta despercebida
      if (allowed.length === 0) {
        console.warn(
          "[authorize] middleware sem roles configuradas; acesso liberado",
          buildAuthzLog(req, {
            mode: safeMode,
            userRoles,
          })
        );
        return next();
      }

      const ok =
        safeMode === "all"
          ? allowed.every((role) => userRoles.includes(role))
          : allowed.some((role) => userRoles.includes(role));

      if (!ok) {
        console.warn(
          "[authorize] acesso negado",
          buildAuthzLog(req, {
            mode: safeMode,
            allowed,
            userRoles,
          })
        );
        return res.status(403).json({
          erro: "Acesso negado.",
          detalhes: {
            modo: safeMode,
            necessario: allowed,
          },
        });
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

// Açúcar sintático
authorize.any = makeAuthorize({ mode: "any" }); // exige pelo menos um dos perfis
authorize.all = makeAuthorize({ mode: "all" }); // exige todos os perfis

// ✅ Aliases de compatibilidade
const authorizeRoles = authorize.any;
const authorizeRole = authorize.any;

// ✅ Alias compatível com "admin" / "administrador"
function requireAdmin(req, res, next) {
  return authorize.any("administrador", "admin")(req, res, next);
}

module.exports = {
  authorize,
  authorizeRoles,
  authorizeRole,
  requireAdmin,
  toArrayLower,
  normalizeRole,
  getUserRoles,
};