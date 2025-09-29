// 📁 src/routes/instrutorRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,
} = require("../controllers/instrutorController");

// 🚦 Rotas específicas primeiro (evita conflito com :id)

// 🔐 Turmas do instrutor autenticado (sem :id)
router.get(
  "/minhas/turmas",
  authMiddleware,
  authorizeRoles("instrutor", "administrador"),
  getMinhasTurmasInstrutor
);

// 📋 Listar todos os instrutores (apenas admin)
router.get(
  "/",
  authMiddleware,
  authorizeRoles("administrador"),
  listarInstrutor
);

// 📊 Histórico de eventos + avaliações por instrutor (apenas admin)
router.get(
  "/:id/eventos-avaliacoes",
  authMiddleware,
  authorizeRoles("administrador"),
  getEventosAvaliacoesPorInstrutor
);

// 📚 Turmas vinculadas a um instrutor, com dados do evento (apenas admin)
router.get(
  "/:id/turmas",
  authMiddleware,
  authorizeRoles("administrador"),
  getTurmasComEventoPorInstrutor
);

module.exports = router;
