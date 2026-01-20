/* eslint-disable no-console */
"use strict";

// ✅ src/routes/relatorioRoute.js — PREMIUM/UNIFICADO (singular + compat)
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Auth / Authorization ───────────────── */
const requireAuth = require("../auth/authMiddleware");

const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

// (Opcional) pronto caso queira usar em algum endpoint admin-only
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Controllers ───────────────── */
const { gerarRelatorios, exportarRelatorios, opcaoRelatorios } = require("../controllers/relatorioController");
const relatorioController = require("../controllers/relatorioController");

/* ───────────────── Helpers ───────────────── */
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

// 🔒 dados sensíveis → não cachear (vale para tudo aqui)
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 rate limit (relatórios tendem a ser pesados)
const relatorioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* =========================================================
   ✅ RELATÓRIOS DE PRESENÇAS (admin/instrutor)
   - Prefixo interno: /presenca
========================================================= */

// Tudo autenticado daqui pra baixo
router.use(requireAuth);

// 📄 Relatório de presenças por turma (administrador ou instrutor)
router.get(
  "/presenca/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioController.porTurma)
);

// 📄 Relatório detalhado de presenças por turma (administrador ou instrutor)
router.get(
  "/presenca/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioController.porTurmaDetalhado)
);

// 📄 Relatório de presenças por evento (somente administrador)
router.get(
  "/presenca/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  wrap(relatorioController.porEvento)
);

/* =========================================================
   ✅ RELATÓRIOS GERAIS (admin only)
========================================================= */

// A partir daqui: admin only
router.use(authorizeRoles("administrador"));

// 📄 GET /api/relatorio
router.get("/", relatorioLimiter, wrap(gerarRelatorios));

// 📤 POST /api/relatorio/exportar
router.post("/exportar", relatorioLimiter, wrap(exportarRelatorios));

// ⚙️ GET /api/relatorio/opcao
router.get("/opcao", relatorioLimiter, wrap(opcaoRelatorios));

/* =========================================================
   ♻️ ALIASES internos (opcional)
   - Se este router for montado em /api/relatorios-presencas,
     estes caminhos batem:
========================================================= */

router.get(
  "/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioController.porTurma)
);

router.get(
  "/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  wrap(relatorioController.porTurmaDetalhado)
);

router.get(
  "/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  wrap(relatorioController.porEvento)
);

module.exports = router;
