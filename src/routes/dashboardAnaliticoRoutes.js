// ✅ src/routes/dashboardAnaliticoRoutes.js
/* eslint-disable no-console */
const express = require("express");
const rateLimit = require("express-rate-limit");

const dashboardController = require("../controllers/dashboardAnaliticoController");

// 🔐 Auth resiliente
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;
if (typeof requireAuth !== "function") {
  console.error("[dashboardAnaliticoRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[dashboardAnaliticoRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const router = express.Router();

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// 🔒 dados sensíveis → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🛡️ admin only (para todas as rotas deste grupo)
router.use(requireAuth, authorizeRoles("administrador"));

// 🧯 limiter leve (evita refresh em loop derrubar API)
const dashLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,            // 120 req/min por IP (ajuste se quiser)
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um pouco e tente novamente." },
});

// 📊 Painel analítico
router.get("/", dashLimiter, asyncHandler(dashboardController.obterDashboard));

module.exports = router;
