"use strict";
/* eslint-disable no-console */

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const calendarioController = require("../controllers/calendarioController");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[calendarioRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Authorize resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[calendarioRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

/* ───────────────── Helpers ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* ───────────────── Middlewares do grupo ───────────────── */
// 🔐 Todas as rotas exigem autenticação
router.use(requireAuth);

// 🔒 Apenas admin (calendário/bloqueios é dado “de gestão”)
router.use(authorizeRoles("administrador"));

// 🛡️ Não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 rate limit (ajuste se quiser)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* ───────────────── Rotas ───────────────── */

// 📅 Listar calendário (admin)
router.get("/", limiter, asyncHandler(calendarioController.listar));

// ➕ Criar evento no calendário (admin)
router.post("/", limiter, asyncHandler(calendarioController.criar));

// ✏️ Atualizar evento do calendário (admin)
// Mantém PUT (compat) + PATCH (mais moderno)
router.put("/:id(\\d+)", limiter, asyncHandler(calendarioController.atualizar));
router.patch("/:id(\\d+)", limiter, asyncHandler(calendarioController.atualizar));

// 🗑️ Excluir evento do calendário (admin)
router.delete("/:id(\\d+)", limiter, asyncHandler(calendarioController.excluir));

module.exports = router;
