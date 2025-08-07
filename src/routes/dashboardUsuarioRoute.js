const express = require("express");
const router = express.Router();

// 📌 Middleware de autenticação
const autenticar = require("../auth/authMiddleware");

// 📦 Controller
const {
  getResumoDashboard,
  getAvaliacoesRecentesInstrutor, // 👈 importar também
} = require("../controllers/dashboardUsuarioController");

// 📍 Rota protegida: resumo do painel do usuário
router.get("/", autenticar, getResumoDashboard);

// ✅ NOVA ROTA: últimas avaliações do instrutor
router.get("/avaliacoes-recentes", autenticar, getAvaliacoesRecentesInstrutor);

module.exports = router;
