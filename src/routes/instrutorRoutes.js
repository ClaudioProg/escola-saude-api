// 📁 src/routes/instrutorRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,          // ✅ importar
} = require("../controllers/instrutorController");

// 👇👇 PRIMEIRO as rotas estáticas / específicas
// 🔐 Turmas do instrutor autenticado (sem :id)
router.get(
  "/minhas/turmas",
  authMiddleware,
  authorizeRoles("instrutor", "administrador"),
  getMinhasTurmasInstrutor
);

// 📋 Listar todos os instrutores (admin)
router.get("/", authMiddleware, authorizeRoles("administrador"), listarInstrutor);

// 📊 Histórico de eventos + avaliações por instrutor (admin)
router.get(
  "/:id/eventos-avaliacoes",
  authMiddleware,
  authorizeRoles("administrador"),
  getEventosAvaliacoesPorInstrutor
);

// 📚 Turmas com dados completos do evento por instrutor (admin)
router.get(
  "/:id/turmas",
  authMiddleware,
  authorizeRoles("administrador"),
  getTurmasComEventoPorInstrutor
);

module.exports = router;
