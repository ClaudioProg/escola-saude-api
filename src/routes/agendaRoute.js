"use strict";
/* eslint-disable no-console */

// 📁 src/routes/calendarioRoute.js — PREMIUM (CRUD bloqueios/feriados)
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[calendarioRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles || _roles?.authorizeRole;

if (typeof authorizeRoles !== "function") {
  console.error("[calendarioRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

/* ───────────────── Controller ───────────────── */
const ctrl = require("../controllers/calendarioController");

/* ───────────────── Helpers ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* ───────────────── Middlewares do grupo ───────────────── */
router.use(requireAuth);
router.use(authorizeRoles("administrador")); // calendário/bloqueios = admin

// 🛡️ dado sensível → sem cache
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
// GET /api/calendario
router.get("/", limiter, asyncHandler(ctrl.listar));

// POST /api/calendario
router.post("/", limiter, asyncHandler(ctrl.criar));

// PATCH /api/calendario/:id
router.patch("/:id(\\d+)", limiter, asyncHandler(ctrl.atualizar));

// DELETE /api/calendario/:id
router.delete("/:id(\\d+)", limiter, asyncHandler(ctrl.excluir));

module.exports = router;
