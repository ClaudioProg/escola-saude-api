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

function getAuthUser(req) {
  return req?.user || req?.usuario || req?.auth?.user || null;
}

function getUserRoles(req) {
  const user = getAuthUser(req);

  return toArrayLower(
    user?.perfil ??
    user?.perfis ??
    user?.roles ??
    user?.role ??
    req?.auth?.perfil
  );
}

function getUserId(req) {
  const user = getAuthUser(req);
  return user?.id ?? req?.auth?.userId ?? null;
}

function buildAuthzLog(req, extra = {}) {
  const user = getAuthUser(req);

  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: getUserId(req),
    perfilBruto:
      user?.perfil ??
      user?.perfis ??
      user?.roles ??
      user?.role ??
      req?.auth?.perfil ??
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
      const user = getAuthUser(req);

      // 🔐 depende do authMiddleware já ter autenticado
      if (!user) {
        console.warn(
          "[authorize] acesso sem autenticação",
          buildAuthzLog(req, {
            mode: safeMode,
            allowed,
          })
        );
        return res.status(401).json({
          erro: "Não autenticado.",
          autenticado: false,
        });
      }

      const userRoles = getUserRoles(req);

      // ✅ sem roles exigidas => libera, mas loga para não passar despercebido
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
          autenticado: true,
          autorizado: false,
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
const requireAdmin = authorize.any("administrador", "admin");

module.exports = {
  authorize,
  authorizeRoles,
  authorizeRole,
  requireAdmin,
  toArrayLower,
  normalizeRole,
  getUserRoles,
};