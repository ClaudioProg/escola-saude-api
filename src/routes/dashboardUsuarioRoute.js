// 📁 src/routes/dashboardUsuarioRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Autenticação
const authMiddleware = require("../auth/authMiddleware");

// 📦 Controllers
const {
  getResumoDashboard,
  getAvaliacoesRecentesInstrutor,
} = require("../controllers/dashboardUsuarioController");

/* ===================================================================
   📊 DASHBOARD DO USUÁRIO
   - Usuário autenticado (participante / instrutor / admin)
   =================================================================== */

/**
 * 🔹 Resumo geral do painel do usuário
 * - Cursos realizados / inscritos
 * - Avaliações pendentes
 * - Certificados
 * - Métricas rápidas
 */
router.get(
  "/",
  authMiddleware,
  getResumoDashboard
);

/**
 * 🔹 Últimas avaliações recebidas (instrutor)
 * - Usado no painel do instrutor
 * - Retorna últimas N avaliações
 */
router.get(
  "/avaliacoes-recentes",
  authMiddleware,
  getAvaliacoesRecentesInstrutor
);

module.exports = router;
