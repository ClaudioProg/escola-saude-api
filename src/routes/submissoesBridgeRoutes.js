/* eslint-disable no-console */
// 📁 src/routes/submissoesBridgeRoutes.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");

let ctrl;
try {
  ctrl = require("../controllers/submissoesAvaliadorController");
} catch {
  ctrl = require("../controllers/submissoesAdminController");
}

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

const head204 = (_req, res) => res.status(204).end();

/* Rotas legadas chamadas pelo front */
router.get("/avaliacoes/atribuidas", requireAuth, wrap(ctrl.listarAtribuidas));
router.head("/avaliacoes/atribuidas", requireAuth, head204);

router.get("/submissoes/atribuidas", requireAuth, wrap(ctrl.listarAtribuidas));
router.head("/submissoes/atribuidas", requireAuth, head204);

router.get("/submissoes/para-mim", requireAuth, wrap(ctrl.paraMim));
router.head("/submissoes/para-mim", requireAuth, head204);

/* Admin legacy (alguns trechos tentam isso) */
router.get("/admin/submissoes/para-mim", requireAuth, wrap(ctrl.paraMim));
router.head("/admin/submissoes/para-mim", requireAuth, head204);

module.exports = router;
