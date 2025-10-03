// 📁 src/routes/chamadasRoutes.js
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
 */
router.get("/chamadas/ativas", injectDb(), ctrl.listarAtivas);

/**
 * Detalhe de uma chamada (com linhas/critérios)
 * GET /api/chamadas/:id
 * Observação: permanece público; usamos injectDb para o pool correto.
 */
router.get("/chamadas/:id", injectDb(), ctrl.obterChamada);

/**
 * Download do modelo de banner (.pptx)
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
