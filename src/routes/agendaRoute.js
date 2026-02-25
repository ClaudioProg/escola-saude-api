"use strict";
/* eslint-disable no-console */

// 📁 src/routes/agendaRoute.js — PREMIUM (Agenda geral + minha + instrutor)
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[agendaRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Roles (opcional p/ rota geral admin) ───────────────── */
const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles || _roles?.authorizeRole;

if (typeof authorizeRoles !== "function") {
  console.error("[agendaRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

/* ───────────────── Controller certo ───────────────── */
const ctrl = require("../controllers/agendaController");

/* ───────────────── Helpers ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// 🛡️ sem cache
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* ───────────────── Rotas ───────────────── */
/**
 * 1) Agenda geral (admin)
 * GET /api/agenda?local=&start=&end=
 */
router.get(
  "/",
  limiter,
  requireAuth,
  authorizeRoles("administrador"),
  asyncHandler(ctrl.buscarAgenda)
);

/**
 * 2) Agenda por EVENTO do instrutor (compat)
 * GET /api/agenda/instrutor?start=&end=
 */
router.get("/instrutor", limiter, requireAuth, asyncHandler(ctrl.buscarAgendaInstrutor));

/**
 * 3) Minha agenda (inscrito)
 * GET /api/agenda/minha?start=&end=
 */
router.get("/minha", limiter, requireAuth, asyncHandler(ctrl.buscarAgendaMinha));

/**
 * 4) Minha agenda como INSTRUTOR
 * GET /api/agenda/minha-instrutor?start=&end=
 */
router.get("/minha-instrutor", limiter, requireAuth, asyncHandler(ctrl.buscarAgendaMinhaInstrutor));

module.exports = router;