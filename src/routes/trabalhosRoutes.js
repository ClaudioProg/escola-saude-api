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
// ATENÇÃO: use o nome correto do arquivo do controller.
// Se o arquivo é src/controllers/trabalhosControllers.js (plural), mude a linha abaixo.
const ctrl = require("../controllers/trabalhosController");
const adminCtrl = require("../controllers/submissoesAdminController");

// Upload temp (usado por pôster e banner)
const upload = multer({ dest: path.join(process.cwd(), "uploads/tmp") });

/* ─────────────────────────── ROTAS DE USUÁRIO ─────────────────────────── */
router.get("/submissoes/minhas", requireAuth, ctrl.minhasSubmissoes);
router.post("/chamadas/:chamadaId(\\d+)/submissoes", requireAuth, ctrl.criarSubmissao);
router.get("/submissoes/:id(\\d+)", requireAuth, ctrl.obterSubmissao);
router.put("/submissoes/:id(\\d+)", requireAuth, ctrl.atualizarSubmissao);
router.delete("/submissoes/:id(\\d+)", requireAuth, ctrl.removerSubmissao);

// Downloads
router.get("/submissoes/:id(\\d+)/poster", requireAuth, ctrl.baixarPoster);
router.get("/submissoes/:id(\\d+)/banner", requireAuth, ctrl.baixarBanner);

// Uploads
router.post("/submissoes/:id(\\d+)/poster", requireAuth, upload.single("poster"), ctrl.atualizarPoster);
router.post("/submissoes/:id(\\d+)/banner", requireAuth, upload.single("banner"), ctrl.atualizarBanner);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */
router.get("/admin/submissoes", requireAdmin, ctrl.listarSubmissoesAdminTodas);
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, ctrl.listarSubmissoesAdmin);

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
// NOVA rota de contagem (usa a mesma regra do admin para “avaliado”)
router.get("/avaliador/minhas-contagens", requireAuth, ctrl.contagemMinhasAvaliacoes);

router.get("/avaliador/submissoes", requireAuth, ctrl.listarSubmissoesDoAvaliador);
router.get("/avaliador/submissoes/:id(\\d+)", requireAuth, ctrl.obterParaAvaliacao);
router.post("/avaliador/submissoes/:id(\\d+)/avaliar", requireAuth, ctrl.avaliarEscrita);
router.post("/avaliador/submissoes/:id(\\d+)/avaliar-oral", requireAuth, ctrl.avaliarOral);

module.exports = router;
