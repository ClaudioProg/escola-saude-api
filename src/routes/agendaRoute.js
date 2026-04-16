"use strict";
/* eslint-disable no-console */

// 📁 src/routes/agendaRoute.js — PREMIUM++
// - Agenda geral + minha + instrutor
// - Calendário de bloqueios/feriados
// - Auth resiliente
// - Roles resilientes
// - Rate limits separados
// - Sem cache
// - Async handler seguro

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   Helpers de resolução de middleware
────────────────────────────────────────────────────────────── */
function resolveAuthMiddleware(mod) {
  if (typeof mod === "function") return mod;
  if (typeof mod?.default === "function") return mod.default;
  if (typeof mod?.authMiddleware === "function") return mod.authMiddleware;
  if (typeof mod?.authAny === "function") return mod.authAny;
  if (typeof mod?.auth === "function") return mod.auth;
  return null;
}

function resolveAuthorize(mod) {
  if (typeof mod === "function") return mod;
  if (typeof mod?.default === "function") return mod.default;
  if (typeof mod?.authorize === "function") return mod.authorize;
  if (typeof mod?.authorizeRoles === "function") return mod.authorizeRoles;
  if (typeof mod?.authorizeRole === "function") return mod.authorizeRole;
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Auth / Roles
────────────────────────────────────────────────────────────── */
const authModule = require("../auth/authMiddleware");
const requireAuth = resolveAuthMiddleware(authModule);

if (typeof requireAuth !== "function") {
  console.error("[agendaRoute] authMiddleware inválido:", authModule);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const authorizeModule = require("../middlewares/authorize");
const authorize = resolveAuthorize(authorizeModule);

if (typeof authorize !== "function") {
  console.error("[agendaRoute] authorize inválido:", authorizeModule);
  throw new Error(
    "authorize não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

/* ──────────────────────────────────────────────────────────────
   Controller
────────────────────────────────────────────────────────────── */
const ctrl = require("../controllers/agendaController");

if (!ctrl || typeof ctrl !== "object") {
  console.error("[agendaRoute] agendaController inválido:", ctrl);
  throw new Error(
    "agendaController inválido (verifique exports em src/controllers/agendaController.js)"
  );
}

/* ──────────────────────────────────────────────────────────────
   Async wrapper
────────────────────────────────────────────────────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* ──────────────────────────────────────────────────────────────
   No-store global
────────────────────────────────────────────────────────────── */
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Route-Group", "agenda");
  return next();
});

/* ──────────────────────────────────────────────────────────────
   Rate limits
────────────────────────────────────────────────────────────── */
const agendaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

const calendarioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas operações no calendário. Aguarde alguns instantes." },
});

/* ──────────────────────────────────────────────────────────────
   Rotas de agenda
────────────────────────────────────────────────────────────── */

/**
 * 1) Agenda geral (admin)
 * GET /api/agenda?local=&start=&end=
 */
router.get(
  "/",
  agendaLimiter,
  requireAuth,
  authorize("administrador"),
  asyncHandler(ctrl.buscarAgenda)
);

/**
 * 2) Agenda por EVENTO do instrutor (compat)
 * GET /api/agenda/instrutor?start=&end=
 */
router.get(
  "/instrutor",
  agendaLimiter,
  requireAuth,
  asyncHandler(ctrl.buscarAgendaInstrutor)
);

/**
 * 3) Minha agenda (inscrito)
 * GET /api/agenda/minha?start=&end=
 */
router.get(
  "/minha",
  agendaLimiter,
  requireAuth,
  asyncHandler(ctrl.buscarAgendaMinha)
);

/**
 * 4) Minha agenda como instrutor
 * GET /api/agenda/minha-instrutor?start=&end=
 */
router.get(
  "/minha-instrutor",
  agendaLimiter,
  requireAuth,
  asyncHandler(ctrl.buscarAgendaMinhaInstrutor)
);

/* ──────────────────────────────────────────────────────────────
   Rotas de calendário (bloqueios / feriados)
   Compat com:
   - GET    /api/agenda/calendario
   - POST   /api/agenda/calendario
   - DELETE /api/agenda/calendario/:id
────────────────────────────────────────────────────────────── */

/**
 * Listar bloqueios/feriados
 * GET /api/agenda/calendario
 */
router.get(
  "/calendario",
  calendarioLimiter,
  requireAuth,
  authorize("administrador"),
  asyncHandler(ctrl.listarBloqueios)
);

/**
 * Criar bloqueio/feriado
 * POST /api/agenda/calendario
 */
router.post(
  "/calendario",
  calendarioLimiter,
  requireAuth,
  authorize("administrador"),
  asyncHandler(ctrl.criarBloqueio)
);

/**
 * Remover bloqueio/feriado
 * DELETE /api/agenda/calendario/:id
 */
router.delete(
  "/calendario/:id",
  calendarioLimiter,
  requireAuth,
  authorize("administrador"),
  asyncHandler(ctrl.removerBloqueio)
);

module.exports = router;