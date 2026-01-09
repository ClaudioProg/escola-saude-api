// 📁 src/routes/relatorioPresencasRoute.js — PREMIUM (robusto, seguro, consistente)
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const relatorioPresencasController = require("../controllers/relatorioPresencasController");

/* ────────────────────────────────────────────────────────────────
   🧰 Helpers (validação + async wrapper)
   ──────────────────────────────────────────────────────────────── */
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

function validarIdParam(param, label = param) {
  return (req, res, next) => {
    const raw = req.params?.[param];
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, erro: `${label}_INVALIDO` });
    }
    req.params[param] = String(id); // normaliza
    return next();
  };
}

/* ────────────────────────────────────────────────────────────────
   📄 Relatórios de Presenças
   Observação: deixe o "mount" no server/app, ex:
   app.use('/api/relatorios-presencas', router)
   ──────────────────────────────────────────────────────────────── */

// 📄 Relatório de presenças por turma (administrador ou instrutor)
router.get(
  "/turma/:turma_id",
  authMiddleware,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioPresencasController.porTurma)
);

// 📄 Relatório detalhado de presenças por turma (administrador ou instrutor)
router.get(
  "/turma/:turma_id/detalhado",
  authMiddleware,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioPresencasController.porTurmaDetalhado)
);

// 📄 Relatório de presenças por evento (somente administrador)
router.get(
  "/evento/:evento_id",
  authMiddleware,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  wrap(relatorioPresencasController.porEvento)
);

module.exports = router;
