// 📁 src/routes/adminAvaliacoesRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Auth igual ao avaliacoesRoute.js
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// ♻️ Reaproveita controllers existentes onde fizer sentido
const {
  avaliacoesPorTurma,   // lista todas as respostas da turma (admin)
  avaliacoesPorEvento,  // agregado por evento (admin)
} = require("../controllers/avaliacoesController");

// 🆕 Controller específico para a visão administrativa (lista de eventos com resumo)
const adminCtrl = require("../controllers/adminAvaliacoesController");

// Protege todo o grupo: só administradores
router.use(authMiddleware, authorizeRoles("administrador"));

/**
 * GET /api/admin/avaliacoes/eventos
 * Lista eventos com resumo de avaliações (contagens/médias) para o painel
 */
router.get("/eventos", adminCtrl.listarEventosComAvaliacoes);

/**
 * GET /api/admin/avaliacoes/evento/:evento_id
 * Agregado por evento (reusa o controller já existente)
 */
router.get("/evento/:evento_id", avaliacoesPorEvento);

/**
 * GET /api/admin/avaliacoes/turma/:turma_id
 * Todas as respostas da turma (reusa o controller já existente)
 */
router.get("/turma/:turma_id", avaliacoesPorTurma);

module.exports = router;
