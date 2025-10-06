const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/chamadasController");
// 🆕 Controller de submissões
const trabCtrl = require("../controllers/trabalhosController");

// ✅ Middlewares do seu projeto
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// ✅ Injeta o DB mesmo quando a rota é pública (sem login)
const injectDb = require("../middlewares/injectDb");

// Helper para exigir perfil admin nas rotas de administração
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ------------------------------------------------------------------ */
/* Público / Usuário                                                  */
/* ------------------------------------------------------------------ */

// Lista chamadas publicadas (com flag dentro_prazo)
router.get("/chamadas/ativas", injectDb(), ctrl.listarAtivas);
router.get("/chamadas/publicadas", injectDb(), ctrl.listarAtivas); // alias

// Detalhe de uma chamada (linhas / critérios / limites)
router.get("/chamadas/:id", injectDb(), ctrl.obterChamada);

// Download do modelo de banner (.ppt/.pptx) POR CHAMADA
router.head("/chamadas/:id/modelo-banner", injectDb(), ctrl.baixarModeloPorChamada);
router.get ("/chamadas/:id/modelo-banner", injectDb(), ctrl.baixarModeloPorChamada);

// Download do modelo de banner padrão (legado/global)
router.get("/modelos/banner-padrao.pptx", ctrl.exportarModeloBanner);

/* ------------------------------------------------------------------ */
/* Administração (Escola da Saúde)                                    */
/* Base: /api/admin/chamadas                                          */
/* ------------------------------------------------------------------ */

// Listar chamadas (admin)
router.get("/admin/chamadas", requireAdmin, ctrl.listarAdmin);

// Criar / Atualizar chamadas
router.post("/admin/chamadas", requireAdmin, ctrl.criar);
router.put ("/admin/chamadas/:id", requireAdmin, ctrl.atualizar);

// Publicar / Despublicar chamada
router.post ("/admin/chamadas/:id/publicar",  requireAdmin, ctrl.publicar);
router.put  ("/admin/chamadas/:id/publicar",  requireAdmin, ctrl.publicar);
router.patch("/admin/chamadas/:id/publicar",  requireAdmin, ctrl.publicar);

// Excluir chamada
router.delete("/admin/chamadas/:id", requireAdmin, ctrl.remover);

/* ---------------- Modelo por CHAMADA (Admin) ----------------
   - GET  /api/admin/chamadas/:id/modelo-banner
   - POST /api/admin/chamadas/:id/modelo-banner  (campo "banner")
-------------------------------------------------------------- */
if (typeof ctrl.modeloBannerMeta === "function") {
  router.get("/admin/chamadas/:id/modelo-banner", requireAdmin, ctrl.modeloBannerMeta);
}
if (typeof ctrl.importarModeloBanner === "function") {
  router.post("/admin/chamadas/:id/modelo-banner", requireAdmin, ctrl.importarModeloBanner);
}

/* ------------------------------------------------------------------ */
/* Administração — Submissões (sem exigir chamadaId)                  */
/* ------------------------------------------------------------------ */

// 🆕 Todas as submissões (sem filtrar por chamada)
if (typeof trabCtrl.listarSubmissoesAdminTodas === "function") {
  router.get("/admin/submissoes", requireAdmin, trabCtrl.listarSubmissoesAdminTodas);
}

// Submissões por chamada (compat com página atual)
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, trabCtrl.listarSubmissoesAdmin);

// Avaliação escrita / oral
router.post("/admin/submissoes/:id/avaliar",      requireAdmin, trabCtrl.avaliarEscrita);
router.post("/admin/submissoes/:id/avaliar-oral", requireAdmin, trabCtrl.avaliarOral);

// Definir status final
router.post("/admin/submissoes/:id/status", requireAdmin, trabCtrl.definirStatusFinal);

// Consolidar classificação (Top 40 + Top 6 por linha)
router.post("/admin/chamadas/:chamadaId/classificar", requireAdmin, trabCtrl.consolidarClassificacao);

module.exports = router;
