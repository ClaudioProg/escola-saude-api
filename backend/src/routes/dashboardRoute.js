/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/dashboardRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais de dashboard.
 *
 * Mount oficial:
 * - /api/dashboard
 *
 * Rotas oficiais:
 * - GET  /api/dashboard
 * - HEAD /api/dashboard
 * - GET  /api/dashboard/avaliacao-recente
 * - HEAD /api/dashboard/avaliacao-recente
 * - GET  /api/dashboard/administrador
 * - HEAD /api/dashboard/administrador
 *
 * Contrato:
 * - Autenticação obrigatória em todas as rotas.
 * - Dashboard administrativo restrito ao perfil oficial administrador.
 * - authMiddleware exporta função diretamente.
 * - authorize exporta função nomeada em ../middlewares/authorize.
 * - Sem aliases.
 * - Sem /admin.
 * - Sem /analitico.
 * - Sem req.userId, req.usuario ou req.auth.
 * - Usuário autenticado oficial em req.user.id.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const requireAuth = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (typeof requireAuth !== "function") {
  throw new Error("[dashboardRoute] authMiddleware deve exportar uma função.");
}

if (typeof authorize !== "function") {
  throw new Error(
    "[dashboardRoute] authorize deve ser exportado como função nomeada por middlewares/authorize."
  );
}

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[dashboardRoute] Handler obrigatório ausente: dashboardController.${name}`
    );
  }
}

assertHandler("getResumoDashboard", dashboardController.getResumoDashboard);
assertHandler(
  "getAvaliacaoRecenteorganizador",
  dashboardController.getAvaliacaoRecenteorganizador
);
assertHandler("obterDashboard", dashboardController.obterDashboard);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

function getUsuarioIdAutenticado(req) {
  const id = Number(req.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function rateLimitKey(req) {
  return String(getUsuarioIdAutenticado(req) || req.ip || "anon");
}

/* ─────────────────────────────────────────────────────────────
   Rate limit autenticado
────────────────────────────────────────────────────────────── */

const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: {
    ok: false,
    code: "DASHBOARD-429-LIMITE",
    message:
      "Muitas requisições ao dashboard. Aguarde antes de tentar novamente.",
  },
});

/* ─────────────────────────────────────────────────────────────
   Middlewares globais
────────────────────────────────────────────────────────────── */

router.use(requireAuth);
router.use(noStore);
router.use(dashboardLimiter);

/* ─────────────────────────────────────────────────────────────
   Dashboard do usuário autenticado
────────────────────────────────────────────────────────────── */

/**
 * GET /api/dashboard
 */
router.get(
  "/",
  routeTag("dashboardRoute:v2.1:GET /"),
  asyncHandler(dashboardController.getResumoDashboard)
);

/**
 * HEAD /api/dashboard
 */
router.head(
  "/",
  routeTag("dashboardRoute:v2.1:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Avaliação recente do organizador
────────────────────────────────────────────────────────────── */

/**
 * GET /api/dashboard/avaliacao-recente
 */
router.get(
  "/avaliacao-recente",
  routeTag("dashboardRoute:v2.1:GET /avaliacao-recente"),
  asyncHandler(dashboardController.getAvaliacaoRecenteorganizador)
);

/**
 * HEAD /api/dashboard/avaliacao-recente
 */
router.head(
  "/avaliacao-recente",
  routeTag("dashboardRoute:v2.1:HEAD /avaliacao-recente"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Dashboard administrativo
────────────────────────────────────────────────────────────── */

/**
 * GET /api/dashboard/administrador
 */
router.get(
  "/administrador",
  authorize("administrador"),
  routeTag("dashboardRoute:v2.1:GET /administrador"),
  asyncHandler(dashboardController.obterDashboard)
);

/**
 * HEAD /api/dashboard/administrador
 */
router.head(
  "/administrador",
  authorize("administrador"),
  routeTag("dashboardRoute:v2.1:HEAD /administrador"),
  (_req, res) => res.sendStatus(204)
);

module.exports = router;