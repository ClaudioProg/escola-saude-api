/* eslint-disable no-console */
// ✅ src/routes/dashboardRoute.js — PREMIUM/UNIFICADO (singular + compat)
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Controllers ───────────────── */
const dashboardController = require("../controllers/dashboardController");
const {
  getResumoDashboard,
  getAvaliacaoRecentesInstrutor,
} = require("../controllers/dashboardController");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;
if (typeof requireAuth !== "function") {
  console.error("[dashboardRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[dashboardRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

/* =========================
   Helpers
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// 🔒 dados sensíveis → não cachear (vale para ambos dashboards)
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rate limits
========================= */
// 🧯 limiter leve (evita refresh em loop derrubar API)
const dashLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um pouco e tente novamente." },
});

/* =========================================================
   ✅ DASHBOARD DO USUÁRIO (autenticado)
   - participante / instrutor / admin
   GET  /api/dashboard
   GET  /api/dashboard/avaliacao-recentes
========================================================= */
router.get("/", requireAuth, dashLimiter, asyncHandler(getResumoDashboard));

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
   - se o front antigo chama /api/dashboard-usuario ou /api/dashboard-analitico,
     você monta aliases no server.js apontando pro mesmo router.
========================================================= */

// (Opcional) alias de path interno também, se algum front bate direto:
// GET /api/dashboard/analitico  -> mesma coisa do /admin
router.get(
  "/analitico",
  requireAuth,
  authorizeRoles("administrador"),
  dashLimiter,
  asyncHandler(dashboardController.obterDashboard)
);

module.exports = router;
