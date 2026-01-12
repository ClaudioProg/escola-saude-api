/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const ctrlUser = require("../controllers/submissoesUsuarioController");

/* ──────────────────────────────────────────────
   Minhas submissões (USUÁRIO)
   GET /api/submissoes/minhas
   ────────────────────────────────────────────── */
router.get("/submissoes/minhas", requireAuth, ctrlUser.listarMinhas);

/* ──────────────────────────────────────────────
   Detalhe da submissão (autor/avaliador/admin)
   GET /api/submissoes/:id
   ────────────────────────────────────────────── */
router.get("/submissoes/:id(\\d+)", requireAuth, ctrlUser.obterSubmissao);

/* ──────────────────────────────────────────────
   Download do pôster (PÚBLICO)
   Mantém compatibilidade com /banner
   GET /api/submissoes/:id/poster
   GET /api/submissoes/:id/banner
   ────────────────────────────────────────────── */
router.get("/submissoes/:id(\\d+)/poster", ctrlUser.baixarBanner);
router.get("/submissoes/:id(\\d+)/banner", ctrlUser.baixarBanner);

/* ──────────────────────────────────────────────
   HEAD (meta de modelos) — FRONT legado faz HEAD.
   Devolvemos 410 (Gone) publicamente para não poluir console.
   ────────────────────────────────────────────── */
router.head("/chamadas/:id(\\d+)/modelo-banner", (_req, res) => res.sendStatus(410));
router.head("/chamadas/:id(\\d+)/modelo-oral", (_req, res) => res.sendStatus(410));

module.exports = router;
