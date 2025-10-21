// 📁 api/routes/submissoesAdminRoutes.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/submissoesAdminController");
const trabalhosCtrl = require("../controllers/trabalhosController");

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ──────────────────────────────────────────────
   Listagem administrativa de submissões
   GET /api/admin/submissoes
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes",
  requireAdmin,
  ctrl.listarSubmissoesAdmin
);

/* ──────────────────────────────────────────────
   Avaliadores (ADMIN)
   GET/POST /api/admin/submissoes/:id/avaliadores
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id(\\d+)/avaliadores",
  requireAdmin,
  ctrl.listarAvaliadoresDaSubmissao
);

router.post(
  "/admin/submissoes/:id(\\d+)/avaliadores",
  requireAdmin,
  ctrl.atribuirAvaliadores
);

/* ──────────────────────────────────────────────
   Avaliações / Notas (ADMIN)
   GET /api/admin/submissoes/:id/avaliacoes
   POST /api/admin/submissoes/:id/nota-visivel
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id(\\d+)/avaliacoes",
  requireAdmin,
  ctrl.listarAvaliacoesDaSubmissao
);

router.post(
  "/admin/submissoes/:id(\\d+)/nota-visivel",
  requireAdmin,
  ctrl.definirNotaVisivel
);

/* ──────────────────────────────────────────────
   Atualização de nota média (materializada)
   POST /api/admin/submissoes/:id/atualizar-nota
   ────────────────────────────────────────────── */
router.post(
  "/admin/submissoes/:id(\\d+)/atualizar-nota",
  requireAdmin,
  async (req, res) => {
    try {
      const { atualizarNotaMediaMaterializada } = require("../controllers/submissoesAdminController");
      await atualizarNotaMediaMaterializada(Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("[/admin/submissoes/:id/atualizar-nota]", err);
      res.status(500).json({ error: "Falha ao recalcular nota média." });
    }
  }
);

/* ──────────────────────────────────────────────
   Download do pôster (PÚBLICO)
   Mantém compatibilidade com /banner
   ────────────────────────────────────────────── */
router.get("/submissoes/:id(\\d+)/poster", ctrl.baixarBanner);
router.get("/submissoes/:id(\\d+)/banner", ctrl.baixarBanner);

/* ──────────────────────────────────────────────
   Alias de detalhe da submissão
   (ADMIN/autor/avaliador) — somente IDs numéricos,
   para NÃO capturar caminhos textuais como /minhas.
   ────────────────────────────────────────────── */
router.get(
  "/submissoes/:id(\\d+)",
  requireAuth,
  trabalhosCtrl.obterSubmissao
);

module.exports = router;
