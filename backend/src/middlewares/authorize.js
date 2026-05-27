// 📁 backend/src/middlewares/authorize.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 * Middleware oficial de autorização por perfil
 *
 * Pré-requisito:
 * - Deve ser usado depois do authMiddleware.
 *
 * Contrato oficial da request autenticada:
 * - req.user
 * - req.userId
 * - req.perfil
 *
 * Perfis oficiais:
 * - usuario
 * - organizador
 * - administrador
 *
 * Uso:
 * - authorize("administrador")
 * - authorize("organizador", "administrador")
 * - authorize.any("organizador", "administrador")
 * - authorize.all("organizador", "administrador")
 * - requireAdmin
 *
 * Não usar:
 * - admin
 * - roles
 * - role
 * - perfis
 * - req.usuario
 * - req.auth
 * - authorizeRole
 * - authorize
 */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

function uniq(values) {
  return [...new Set(values)];
}

function normalizePerfil(value) {
  const perfil = String(value || "").trim().toLowerCase();

  if (!perfil) {
    return "";
  }

  return perfil;
}

function toPerfilArray(value) {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : String(value).split(",");

  return uniq(
    raw
      .map((item) => normalizePerfil(item))
      .filter(Boolean)
  );
}

function validarPerfisOficiais(perfis, origem = "authorize") {
  const invalidos = perfis.filter((perfil) => !PERFIS_OFICIAIS.has(perfil));

  if (invalidos.length > 0) {
    throw new Error(
      `[${origem}] Perfil não oficial informado: ${invalidos.join(", ")}. ` +
        `Use apenas: ${Array.from(PERFIS_OFICIAIS).join(", ")}.`
    );
  }
}

function getAuthUser(req) {
  return req?.user || null;
}

function getUserId(req) {
  return req?.userId || req?.user?.id || null;
}

function getUserPerfis(req) {
  return toPerfilArray(req?.perfil || req?.user?.perfil);
}

function buildAuthzLog(req, extra = {}) {
  return {
    method: req?.method,
    url: req?.originalUrl,
    ip: req?.ip,
    userId: getUserId(req),
    perfil: getUserPerfis(req),
    ...extra,
  };
}

function sendUnauthorized(res) {
  return res.status(401).json({
    ok: false,
    code: "AUTH-401-UNAUTHENTICATED",
    message: "Não autenticado.",
    data: null,
  });
}

function sendForbidden(res, details = {}) {
  return res.status(403).json({
    ok: false,
    code: "AUTH-403-FORBIDDEN",
    message: "Acesso negado.",
    data: null,
    details,
  });
}

/* =========================
   Core
   mode: "any" | "all"
========================= */

function makeAuthorize({ mode = "any" } = {}) {
  const safeMode = mode === "all" ? "all" : "any";

  return (...perfisPermitidos) => {
    const allowed = toPerfilArray(perfisPermitidos);

    validarPerfisOficiais(allowed, "authorize.allowed");

    return (req, res, next) => {
      const user = getAuthUser(req);

      if (!user) {
        console.warn(
          "[authorize] acesso sem autenticação",
          buildAuthzLog(req, {
            mode: safeMode,
            allowed,
          })
        );

        return sendUnauthorized(res);
      }

      const userPerfis = getUserPerfis(req);

      validarPerfisOficiais(userPerfis, "authorize.user");

      if (allowed.length === 0) {
        console.warn(
          "[authorize] middleware sem perfis configurados; acesso liberado",
          buildAuthzLog(req, {
            mode: safeMode,
            userPerfis,
          })
        );

        return next();
      }

      const autorizado =
        safeMode === "all"
          ? allowed.every((perfil) => userPerfis.includes(perfil))
          : allowed.some((perfil) => userPerfis.includes(perfil));

      if (!autorizado) {
        console.warn(
          "[authorize] acesso negado",
          buildAuthzLog(req, {
            mode: safeMode,
            allowed,
            userPerfis,
          })
        );

        return sendForbidden(res, {
          mode: safeMode,
          necessario: allowed,
        });
      }

      return next();
    };
  };
}

/* =========================
   Exports oficiais
========================= */

const authorize = makeAuthorize({ mode: "any" });

authorize.any = makeAuthorize({ mode: "any" });
authorize.all = makeAuthorize({ mode: "all" });

const requireAdmin = authorize("administrador");

module.exports = {
  authorize,
  requireAdmin,
  toPerfilArray,
  normalizePerfil,
  getUserPerfis,
};