const express = require("express");
const router = express.Router();

// 🔐 Middlewares de autenticação e autorização
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// 📊 Controller de estatísticas de usuários
const ctrl = require("../controllers/usuariosEstatisticasController");

// 🚫 Acesso restrito a administradores
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// 📈 Endpoint principal — Estatísticas agregadas de usuários
// Retorna totais por faixa etária, unidade (sigla), escolaridade, cargo, gênero, etc.
router.get("/usuarios/estatisticas", requireAdmin, ctrl.getEstatisticasUsuarios);

module.exports = router;
