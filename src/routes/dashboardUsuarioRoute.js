const express = require("express");
const router = express.Router();

// 📌 Middleware de autenticação
const autenticar = require("../auth/authMiddleware"); // 🔄 Caminho corrigido

// 📦 Controller
const { getResumoDashboard } = require("../controllers/dashboardUsuarioController");

// 📍 Rota protegida: resumo do painel do usuário
router.get("/", autenticar, getResumoDashboard);

module.exports = router;
