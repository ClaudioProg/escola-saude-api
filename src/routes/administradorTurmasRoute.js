// 📁 src/routes/administradorTurmasRoute.js
const express = require("express");
const rateLimit = require("express-rate-limit");

const administradorTurmasController = require("../controllers/administradorTurmasController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const router = express.Router();

/* =========================
   Helpers (premium)
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
   Middlewares do grupo
========================= */
router.use(authMiddleware, authorizeRoles("administrador"));

// 🛡️ Premium: não cachear endpoints administrativos
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 Premium: rate limit leve para listagem administrativa
const adminListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* =========================
   Rotas
========================= */
/**
 * GET /api/administrador/turmas
 * Lista todas as turmas com detalhes (somente administradores)
 */
router.get("/", adminListLimiter, asyncHandler(administradorTurmasController.listarTurmasadministrador));

module.exports = router;
