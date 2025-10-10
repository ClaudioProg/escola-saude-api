// 📁 src/routes/chamadas.routes.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/chamadasController");
const trabCtrl = require("../controllers/trabalhosController");

// Middlewares do projeto
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const injectDb = require("../middlewares/injectDb");

// Helper: exige perfil administrador
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* =================================================================== */
/* Público / Usuário                                                    */
/* Base: /api                                                           */
/* =================================================================== */

// Lista chamadas publicadas (com flag dentro_prazo)
router.get("/chamadas/ativas", injectDb(), ctrl.listarAtivas);
router.get("/chamadas/publicadas", injectDb(), ctrl.listarAtivas); // alias

// Detalhe de uma chamada (linhas / critérios / limites)
router.get("/chamadas/:id", injectDb(), ctrl.obterChamada);

// Modelo de banner POR CHAMADA
// - HEAD → retorna apenas headers (útil para checagem rápida no front)
// - GET  → streaming do arquivo (download) ou 302 para link externo
router.head("/chamadas/:id/modelo-banner", injectDb(), ctrl.baixarModeloPorChamada);
router.get ("/chamadas/:id/modelo-banner",  injectDb(), ctrl.baixarModeloPorChamada);

// Modelo de banner padrão (legado/global)
router.get("/modelos/banner-padrao.pptx", injectDb(), ctrl.exportarModeloBanner);

/* =================================================================== */
/* Administração (Escola da Saúde)                                      */
/* Base: /api/admin/chamadas                                            */
/* =================================================================== */

// Listar chamadas (admin)
router.get("/admin/chamadas", requireAdmin, injectDb(), ctrl.listarAdmin);

// Criar / Atualizar chamadas
router.post("/admin/chamadas", requireAdmin, injectDb(), ctrl.criar);
router.put ("/admin/chamadas/:id", requireAdmin, injectDb(), ctrl.atualizar);

// Publicar / Despublicar chamada (aceita POST/PUT/PATCH)
router.post ("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);
router.put  ("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);
router.patch("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);

// Excluir chamada
router.delete("/admin/chamadas/:id", requireAdmin, injectDb(), ctrl.remover);

/* ---------------- Modelo por CHAMADA (Admin) ----------------
   - GET  /api/admin/chamadas/:id/modelo-banner      → META (ou use ?meta=1 na pública)
   - POST /api/admin/chamadas/:id/modelo-banner      → UPLOAD (campo "banner")
   ------------------------------------------------------------ */
if (typeof ctrl.modeloBannerMeta === "function") {
  router.get("/admin/chamadas/:id/modelo-banner", requireAdmin, injectDb(), ctrl.modeloBannerMeta);
}
if (typeof ctrl.importarModeloBanner === "function") {
  router.post("/admin/chamadas/:id/modelo-banner", requireAdmin, injectDb(), ctrl.importarModeloBanner);
}

/* =================================================================== */
/* Administração — Submissões (sem exigir chamadaId)                    */
/* =================================================================== */

// Todas as submissões (admin)
if (typeof trabCtrl.listarSubmissoesAdminTodas === "function") {
  router.get("/admin/submissoes", requireAdmin, injectDb(), trabCtrl.listarSubmissoesAdminTodas);
}

// Submissões por chamada (compat com página atual)
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, injectDb(), trabCtrl.listarSubmissoesAdmin);

// Avaliação escrita / oral
router.post("/admin/submissoes/:id/avaliar",      requireAdmin, injectDb(), trabCtrl.avaliarEscrita);
router.post("/admin/submissoes/:id/avaliar-oral", requireAdmin, injectDb(), trabCtrl.avaliarOral);

// Definir status final
router.post("/admin/submissoes/:id/status", requireAdmin, injectDb(), trabCtrl.definirStatusFinal);

// Consolidar classificação (Top 40 + Top 6 por linha)
router.post("/admin/chamadas/:chamadaId/classificar", requireAdmin, injectDb(), trabCtrl.consolidarClassificacao);

module.exports = router;
