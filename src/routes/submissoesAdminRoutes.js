// 📁 api/routes/submissoesAdminRoutes.js
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/submissoesAdminController");

// ✅ Middleware composto (admin)
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ──────────────────────────────────────────────────────────────
   Helpers premium
   ────────────────────────────────────────────────────────────── */

// Wrapper async (evita try/catch em toda rota)
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Param validator centralizado (somente IDs numéricos)
router.param("id", (req, res, next, id) => {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ error: "ID inválido." });
  }
  req.params.id = String(n);
  return next();
});

// Helper para usar o :id já validado
const idParam = (req) => Number(req.params.id);

/* ──────────────────────────────────────────────
   Listagem administrativa de submissões
   GET /api/admin/submissoes
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes",
  requireAdmin,
  wrap(ctrl.listarSubmissoesAdmin)
);

/* ──────────────────────────────────────────────
   Avaliadores (ADMIN)
   GET/POST/DELETE/PATCH /api/admin/submissoes/:id/avaliadores
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id(\\d+)/avaliadores",
  requireAdmin,
  wrap(ctrl.listarAvaliadoresDaSubmissao)
);

router.post(
  "/admin/submissoes/:id(\\d+)/avaliadores",
  requireAdmin,
  wrap(ctrl.atribuirAvaliadores)
);

// ❌ Revogar (excluir lógico) avaliador
router.delete(
  "/admin/submissoes/:id(\\d+)/avaliadores",
  requireAdmin,
  wrap(ctrl.revogarAvaliadorFlex)
);

// 🔁 Restaurar vínculo revogado
router.patch(
  "/admin/submissoes/:id(\\d+)/avaliadores/restore",
  requireAdmin,
  wrap(ctrl.restaurarAvaliadorFlex)
);

// (Opcional) Alias POST caso seu cliente não envie body em DELETE
router.post(
  "/admin/submissoes/:id(\\d+)/avaliadores/revogar",
  requireAdmin,
  wrap(ctrl.revogarAvaliadorFlex)
);

/* ──────────────────────────────────────────────
   Avaliações / Notas (ADMIN)
   GET  /api/admin/submissoes/:id/avaliacoes
   POST /api/admin/submissoes/:id/nota-visivel
   ────────────────────────────────────────────── */
router.get(
  "/admin/submissoes/:id(\\d+)/avaliacoes",
  requireAdmin,
  wrap(ctrl.listarAvaliacoesDaSubmissao)
);

router.post(
  "/admin/submissoes/:id(\\d+)/nota-visivel",
  requireAdmin,
  wrap(ctrl.definirNotaVisivel)
);

/* ──────────────────────────────────────────────
   Atualização de nota média (materializada)
   POST /api/admin/submissoes/:id/atualizar-nota
   ────────────────────────────────────────────── */

router.post(
  "/admin/submissoes/:id(\\d+)/atualizar-nota",
  requireAdmin,
  wrap(async (req, res) => {
    // ✅ evita require dinâmico por request
    if (typeof ctrl.atualizarNotaMediaMaterializada !== "function") {
      return res
        .status(501)
        .json({ error: "Função atualizarNotaMediaMaterializada não implementada." });
    }

    await ctrl.atualizarNotaMediaMaterializada(idParam(req));
    return res.json({ ok: true });
  })
);

/* ──────────────────────────────────────────────
   Download do pôster (PÚBLICO)
   Mantém compatibilidade com /banner
   GET /api/submissoes/:id/poster
   GET /api/submissoes/:id/banner
   ────────────────────────────────────────────── */
router.get("/submissoes/:id(\\d+)/poster", wrap(ctrl.baixarBanner));
router.get("/submissoes/:id(\\d+)/banner", wrap(ctrl.baixarBanner));

/* ──────────────────────────────────────────────
   Detalhe da submissão
   (ADMIN/autor/avaliador)
   GET /api/submissoes/:id
   ────────────────────────────────────────────── */
router.get(
  "/submissoes/:id(\\d+)",
  requireAuth,
  wrap(ctrl.obterSubmissao)
);

/* ──────────────────────────────────────────────
   Resumo de avaliadores (ADMIN)
   GET /api/admin/avaliadores/resumo
   + alias protegido
   ────────────────────────────────────────────── */
router.get(
  "/admin/avaliadores/resumo",
  requireAdmin,
  wrap(ctrl.resumoAvaliadores)
);

// Alias protegido (mantém)
router.get(
  "/avaliadores/resumo",
  requireAdmin,
  wrap(ctrl.resumoAvaliadores)
);

module.exports = router;
