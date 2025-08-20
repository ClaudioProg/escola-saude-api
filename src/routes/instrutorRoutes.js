const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor, // ✅ incluído
} = require("../controllers/instrutorController");

// 📋 Listar todos os instrutor (admin)
router.get("/", authMiddleware, authorizeRoles("administrador"), listarInstrutor);

// 📊 Histórico de eventos com avaliação por instrutor
router.get(
  "/:id/eventos-avaliacoes",
  authMiddleware,
  authorizeRoles("administrador"),
  getEventosAvaliacoesPorInstrutor
);

// 📚 Turmas com dados completos do evento
router.get(
  "/:id/turmas",
  authMiddleware,
  authorizeRoles("administrador"),
  getTurmasComEventoPorInstrutor
);

module.exports = router;
