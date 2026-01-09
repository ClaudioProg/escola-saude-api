// 📁 src/routes/agendaRoutes.js
const express = require("express");
const rateLimit = require("express-rate-limit");

const agendaController = require("../controllers/agendaController");
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
router.use(authMiddleware);

// 🛡️ Premium: agenda é dado pessoal → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 Premium: rate limit leve (ajuste se necessário)
const agendaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180, // 3 req/s em média (folgado pro front com navegação)
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* =========================
   Rotas
========================= */
// 🗓️ Agenda do usuário autenticado (inscrito como aluno)
router.get(
  "/minha",
  agendaLimiter,
  authorizeRoles("usuario", "instrutor", "administrador"),
  asyncHandler(agendaController.buscarAgendaMinha)
);

// 👩‍🏫 Agenda do instrutor autenticado (novo endpoint usado pelo front)
router.get(
  "/minha-instrutor",
  agendaLimiter,
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(agendaController.buscarAgendaMinhaInstrutor)
);

// (alias p/ compatibilidade: /api/agenda/instrutor)
router.get(
  "/instrutor",
  agendaLimiter,
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(agendaController.buscarAgendaMinhaInstrutor)
);

// 📅 Agenda geral (somente administrador)
router.get(
  "/",
  agendaLimiter,
  authorizeRoles("administrador"),
  asyncHandler(agendaController.buscarAgenda)
);

module.exports = router;
