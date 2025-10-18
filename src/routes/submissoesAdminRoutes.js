// 📁 api/routes/submissoesAdminRoutes.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/submissoesAdminController");

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ──────────────────────────────────────────────
   Avaliadores (ADMIN)
   GET/POST em /api/admin/submissoes/:id/avaliadores
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id/avaliadores",
  requireAdmin,
  ctrl.listarAvaliadoresDaSubmissao
);

router.post(
  "/admin/submissoes/:id/avaliadores",
  requireAdmin,
  ctrl.atribuirAvaliadores
);

/* ──────────────────────────────────────────────
   Avaliações / Notas (ADMIN)
   GET /api/admin/submissoes/:id/avaliacoes
   POST /api/admin/submissoes/:id/nota-visivel
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id/avaliacoes",
  requireAdmin,
  ctrl.listarAvaliacoesDaSubmissao
);

router.post(
  "/admin/submissoes/:id/nota-visivel",
  requireAdmin,
  ctrl.definirNotaVisivel
);

/* ──────────────────────────────────────────────
   Download do pôster (PÚBLICO)
   Responde em /poster (preferido) e /banner (legado)
   ────────────────────────────────────────────── */
router.get("/submissoes/:id/poster", ctrl.baixarBanner);

module.exports = router;
