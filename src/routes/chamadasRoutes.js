const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/chamadasController");

// ✅ Middlewares do seu projeto (em src/auth)
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// ✅ Injeta o DB mesmo quando a rota é pública (sem login)
const injectDb = require("../middlewares/injectDb");

// Helper para exigir perfil admin nas rotas de administração
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/**
 * Público / Usuário
 * ------------------------------------------------------------------
 * Lista chamadas publicadas e informa flag de prazo no payload.
 * GET /api/chamadas/ativas
 * GET /api/chamadas/publicadas  (alias para compatibilidade)
 */
router.get("/chamadas/ativas", injectDb(), ctrl.listarAtivas);
router.get("/chamadas/publicadas", injectDb(), ctrl.listarAtivas);

/**
 * Detalhe de uma chamada (com linhas/critérios)
 * GET /api/chamadas/:id
 */
router.get("/chamadas/:id", injectDb(), ctrl.obterChamada);

/**
 * Download do modelo de banner (.pptx) POR CHAMADA
 * GET /api/chamadas/:id/modelo-banner
 * HEAD /api/chamadas/:id/modelo-banner
 */
router.head("/chamadas/:id/modelo-banner", injectDb(), ctrl.baixarModeloPorChamada);
router.get("/chamadas/:id/modelo-banner", injectDb(), ctrl.baixarModeloPorChamada);

/**
 * Download do modelo de banner padrão (legado/global)
 * GET /api/modelos/banner-padrao.pptx
 */
router.get("/modelos/banner-padrao.pptx", ctrl.exportarModeloBanner);

/**
 * Administração (Escola da Saúde)
 * ------------------------------------------------------------------
 * CRUD e publicação das chamadas
 * Base: /api/admin/chamadas
 */
router.get("/admin/chamadas", requireAdmin, ctrl.listarAdmin);
router.post("/admin/chamadas", requireAdmin, ctrl.criar);
router.put("/admin/chamadas/:id", requireAdmin, ctrl.atualizar);

// publicar/despublicar → aceita POST, PUT e PATCH
router.post("/admin/chamadas/:id/publicar", requireAdmin, ctrl.publicar);
router.put("/admin/chamadas/:id/publicar", requireAdmin, ctrl.publicar);
router.patch("/admin/chamadas/:id/publicar", requireAdmin, ctrl.publicar);

// excluir
router.delete("/admin/chamadas/:id", requireAdmin, ctrl.remover);

module.exports = router;
