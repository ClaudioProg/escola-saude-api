// 📁 src/routes/adminAvaliacoesRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Auth igual ao avaliacoesRoute.js
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// 🆕 Controller específico para a visão administrativa
const adminCtrl = require("../controllers/adminAvaliacoesController");

// (Opcional) ainda podemos reaproveitar algo do avaliacoesController se precisar
// const { avaliacoesPorTurma } = require("../controllers/avaliacoesController");

// Protege todo o grupo: só administradores
router.use(authMiddleware, authorizeRoles("administrador"));

/**
 * GET /api/admin/avaliacoes/eventos
 * Lista eventos com resumo de avaliações (contagens/médias) para o painel
 */
router.get("/eventos", adminCtrl.listarEventosComAvaliacoes);

/**
 * GET /api/admin/avaliacoes/evento/:evento_id
 * 🔄 Agora usa o controller NOVO, que retorna:
 * { respostas, agregados: { total, dist, medias, textos, mediaOficial }, turmas }
 */
router.get("/evento/:evento_id", adminCtrl.obterAvaliacoesDoEvento);

/**
 * GET /api/admin/avaliacoes/turma/:turma_id
 * Pode usar a versão nova do admin (com mesmos campos da do evento)
 */
router.get("/turma/:turma_id", adminCtrl.obterAvaliacoesDaTurma);

module.exports = router;
