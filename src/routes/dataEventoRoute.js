/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

const {
  listarDatasDaTurma,
  listarOcorrenciasTurma,
} = require("../controllers/dataEventoController");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.authAny ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[datasEventoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Helpers ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// valida e normaliza :id (turma_id)
function validateTurmaIdParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  req.params.id = String(Math.trunc(id));
  return next();
}

/* ───────────────── Middlewares do grupo ───────────────── */
router.use(requireAuth);

// 🔒 sem cache
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* ───────────────── Rotas ───────────────── */

/**
 * 🔍 Buscar datas completas da turma
 * GET /api/datas-evento/turma/:id?via=datas|especificas|presencas|intervalo
 */
router.get(
  "/turma/:id",
  validateTurmaIdParam,
  (req, res, next) => {
    res.setHeader("X-Route", "datasEventoRoute:listarDatasDaTurma");
    return next();
  },
  asyncHandler(listarDatasDaTurma)
);

/**
 * 📅 Buscar apenas ocorrências (YYYY-MM-DD)
 * GET /api/datas-evento/turma/:id/ocorrencias
 */
router.get(
  "/turma/:id/ocorrencias",
  validateTurmaIdParam,
  (req, res, next) => {
    res.setHeader("X-Route", "datasEventoRoute:listarOcorrenciasTurma");
    return next();
  },
  asyncHandler(listarOcorrenciasTurma)
);

module.exports = router;