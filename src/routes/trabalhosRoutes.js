// 📁 api/routes/trabalhosRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Middlewares
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// Controllers
const ctrl = require("../controllers/trabalhosController");
const adminCtrl = require("../controllers/submissoesAdminController");

/* ─────────────────────────── ROTAS DE USUÁRIO ─────────────────────────── */
/**
 * GET /api/submissoes/minhas
 * → Lista todas as submissões do usuário autenticado.
 * ⚠️ Deve vir antes de qualquer rota com :id(\\d+)!
 */
router.get("/submissoes/minhas", requireAuth, ctrl.listarMinhas);

/**
 * GET /api/submissoes/:id
 * → Detalhe de uma submissão (autor, avaliador ou admin)
 * Usa regex numérica para não capturar /minhas.
 */
router.get("/submissoes/:id(\\d+)", requireAuth, ctrl.obterSubmissao);

/**
 * PUT /api/submissoes/:id
 * → Atualiza uma submissão (autor dentro do prazo ou admin)
 */
router.put("/submissoes/:id(\\d+)", requireAuth, ctrl.atualizarSubmissao);

/**
 * DELETE /api/submissoes/:id
 * → Remove uma submissão (autor: rascunho/submetido; admin pode sempre)
 */
router.delete("/submissoes/:id(\\d+)", requireAuth, ctrl.removerSubmissao);


/* Downloads (inline; autorização fina no controller) */
router.get("/submissoes/:id(\\d+)/poster", requireAuth, ctrl.baixarPoster);
router.get("/submissoes/:id(\\d+)/banner", requireAuth, ctrl.baixarBanner);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */
// Lista todas as submissões (sem filtrar por chamada)
router.get("/admin/submissoes", requireAdmin, ctrl.listarSubmissoesAdminTodas);

// Lista por chamada (compat)
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, ctrl.listarSubmissoesAdmin);

// Avaliações / Notas / Avaliadores (AdminSubmissoes.jsx)
router.get("/admin/submissoes/:id(\\d+)/avaliacoes", requireAdmin, adminCtrl.listarAvaliacoesDaSubmissao);
router.post("/admin/submissoes/:id(\\d+)/nota-visivel", requireAdmin, adminCtrl.definirNotaVisivel);
router.get("/admin/submissoes/:id(\\d+)/avaliadores", requireAdmin, adminCtrl.listarAvaliadoresDaSubmissao);
router.post("/admin/submissoes/:id(\\d+)/avaliadores", requireAdmin, adminCtrl.atribuirAvaliadores);

// Avaliações (admin/avaliador)
router.post("/admin/submissoes/:id(\\d+)/avaliar", requireAuth, ctrl.avaliarEscrita);
router.post("/admin/submissoes/:id(\\d+)/avaliar-oral", requireAuth, ctrl.avaliarOral);

// Consolidação e status final (admin-only)
router.post("/admin/chamadas/:chamadaId/classificar", requireAdmin, ctrl.consolidarClassificacao);
router.post("/admin/submissoes/:id(\\d+)/status", requireAdmin, ctrl.definirStatusFinal);

/* ─────────────────────────── PAINEL DO AVALIADOR ─────────────────────────── */
router.get("/avaliador/submissoes", requireAuth, ctrl.listarSubmissoesDoAvaliador);
router.get("/avaliador/submissoes/:id(\\d+)", requireAuth, ctrl.obterParaAvaliacao);
router.post("/avaliador/submissoes/:id(\\d+)/avaliar", requireAuth, ctrl.avaliarEscrita);

module.exports = router;
