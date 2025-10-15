// 📁 src/routes/chamadasRoutes.js
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
/* Helpers locais                                                      */
/* =================================================================== */

// Cache curtinho para arquivos públicos (ideal para <img> sem token)
function cachePublicoCurto(_req, res, next) {
  // 1 hora, com "immutable" para evitar revalidações desnecessárias
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  next();
}

/* =================================================================== */
/* Público / Usuário  (montado sob /api)                               */
/* =================================================================== */

// Lista chamadas publicadas (com flag dentro_prazo)
router.get("/chamadas/ativas", injectDb(), ctrl.listarAtivas);
router.get("/chamadas/publicadas", injectDb(), ctrl.listarAtivas); // alias

// Detalhe de uma chamada (linhas / critérios / limites)
router.get("/chamadas/:id", injectDb(), ctrl.obterChamada);

// ⚠️ REMOVIDO DAQUI:
//   HEAD/GET /chamadas/:id/modelo-banner
// Essas rotas agora vivem em src/routes/chamadasModeloRoutes.js

// Modelo de banner padrão (legado/global)
router.get("/modelos/banner-padrao.pptx", injectDb(), ctrl.exportarModeloBanner);

/* =================================================================== */
/* Administração (Escola da Saúde)  (montado sob /api/admin)           */
/* =================================================================== */

// Listar chamadas (admin)
router.get("/admin/chamadas", requireAdmin, injectDb(), ctrl.listarAdmin);

// Criar / Atualizar chamadas
router.post("/admin/chamadas", requireAdmin, injectDb(), ctrl.criar);
router.put("/admin/chamadas/:id", requireAdmin, injectDb(), ctrl.atualizar);

// Publicar / Despublicar chamada (aceita POST/PUT/PATCH)
router.post("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);
router.put("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);
router.patch("/admin/chamadas/:id/publicar", requireAdmin, injectDb(), ctrl.publicar);

// Excluir chamada
router.delete("/admin/chamadas/:id", requireAdmin, injectDb(), ctrl.remover);

// ⚠️ REMOVIDO DAQUI (ADMIN – modelo por chamada):
//   - GET  /api/admin/chamadas/:id/modelo-banner
//   - POST /api/admin/chamadas/:id/modelo-banner
//   - HEAD/GET /api/admin/chamadas/:id/modelo-banner/download
// Essas rotas agora vivem em src/routes/chamadasModeloRoutes.js

/* =================================================================== */
/* Administração — Submissões (sem exigir chamadaId)                    */
/* =================================================================== */

// Todas as submissões (admin)
if (typeof trabCtrl.listarSubmissoesAdminTodas === "function") {
  router.get("/admin/submissoes", requireAdmin, injectDb(), trabCtrl.listarSubmissoesAdminTodas);
}

// Submissões por chamada (compat com página atual)
router.get(
  "/admin/chamadas/:chamadaId/submissoes",
  requireAdmin,
  injectDb(),
  trabCtrl.listarSubmissoesAdmin
);

// Avaliação escrita / oral
router.post("/admin/submissoes/:id/avaliar", requireAdmin, injectDb(), trabCtrl.avaliarEscrita);
router.post("/admin/submissoes/:id/avaliar-oral", requireAdmin, injectDb(), trabCtrl.avaliarOral);

// Definir status final
router.post("/admin/submissoes/:id/status", requireAdmin, injectDb(), trabCtrl.definirStatusFinal);

// Consolidar classificação (Top 40 + Top 6 por linha)
router.post(
  "/admin/chamadas/:chamadaId/classificar",
  requireAdmin,
  injectDb(),
  trabCtrl.consolidarClassificacao
);

module.exports = router;
