/* eslint-disable no-console */
// ✅ src/routes/dashboardRoute.js — PREMIUM/UNIFICADO (singular + compat)
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Controllers ───────────────── */
const dashboardController = require("../controllers/dashboardController");

const {
  getResumoDashboard,
  getAvaliacaoRecentesInstrutor,
} = dashboardController;

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.authAny ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[dashboardRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  authorizeMod?.authorizeRoles ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[dashboardRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* =========================
   Helpers
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function getUserId(req) {
  return (
    req.userId ??
    req.user?.id ??
    req.usuario?.id ??
    req.auth?.userId ??
    null
  );
}

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      String(
        getUserId(req) ||
          req.ip ||
          req.headers["x-forwarded-for"] ||
          "anon"
      ),
    message,
  });
}

/* ───────────────── Segurança de cache ───────────────── */
// 🔒 dados sensíveis → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rate limits
========================= */
// 🧯 limiter leve (evita refresh em loop derrubar API)
const dashLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { erro: "Muitas requisições. Aguarde um pouco e tente novamente." },
});

/* =========================================================
   ✅ DASHBOARD DO USUÁRIO (autenticado)
   - participante / instrutor / admin
   GET /api/dashboard
   GET /api/dashboard/avaliacao-recentes
========================================================= */
router.get(
  "/",
  requireAuth,
  dashLimiter,
  asyncHandler(getResumoDashboard)
);

router.get(
  "/avaliacao-recentes",
  requireAuth,
  dashLimiter,
  asyncHandler(getAvaliacaoRecentesInstrutor)
);

/* =========================================================
   ✅ DASHBOARD ANALÍTICO (ADMIN)
   GET /api/dashboard/admin
========================================================= */
router.get(
  "/admin",
  requireAuth,
  authorizeRoles("administrador"),
  dashLimiter,
  asyncHandler(dashboardController.obterDashboard)
);

/* =========================================================
   ♻️ ALIASES RETROCOMPAT
========================================================= */

// GET /api/dashboard/analitico -> mesma coisa do /admin
router.get(
  "/analitico",
  requireAuth,
  authorizeRoles("administrador"),
  dashLimiter,
  asyncHandler(dashboardController.obterDashboard)
);

module.exports = router;