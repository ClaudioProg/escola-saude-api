/* eslint-disable no-console */
"use strict";

// ✅ src/routes/relatorioRoute.js — PREMIUM/UNIFICADO (singular + compat)
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.protect ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[relatorioRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function"
    ? authorizeMod
    : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize ||
  authorizeMod?.default;

if (typeof authorizeRoles !== "function") {
  console.error("[relatorioRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* ───────────────── Controller resiliente ───────────────── */
const relatorioCtrlRaw = require("../controllers/relatorioController");
const relatorioController =
  relatorioCtrlRaw?.default || relatorioCtrlRaw;

const {
  gerarRelatorios,
  exportarRelatorios,
  opcaoRelatorios,
  presencasPorTurma,
  presencasPorTurmaDetalhado,
  presencasPorEvento,
} = relatorioController;

for (const [name, fn] of Object.entries({
  gerarRelatorios,
  exportarRelatorios,
  opcaoRelatorios,
  presencasPorTurma,
  presencasPorTurmaDetalhado,
  presencasPorEvento,
})) {
  if (typeof fn !== "function") {
    console.error("[relatorioRoute] Controller inválido:", name, relatorioCtrlRaw);
    throw new Error(`relatorioController inválido (função ausente: ${name})`);
  }
}

/* ───────────────── Helpers ───────────────── */
const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const routeTag = (tag) => (req, res, next) => {
  try {
    res.setHeader("X-Route-Handler", tag);
  } catch {}
  return next();
};

function validarIdParam(param, label = param) {
  return (req, res, next) => {
    const raw = req.params?.[param];
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        erro: `${label}_INVALIDO`,
      });
    }

    req.params[param] = String(id);
    return next();
  };
}

/* ───────────────── Middlewares globais do grupo ───────────────── */
// 🔒 dados sensíveis → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

// 🚦 relatórios tendem a ser pesados
const relatorioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

// 🔐 tudo daqui pra frente exige autenticação
router.use(requireAuth);

/* =========================================================
   ✅ RELATÓRIOS DE PRESENÇAS
========================================================= */

// 📄 Relatório de presenças por turma (administrador ou instrutor)
router.get(
  "/presenca/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presenca/turma/:turma_id"),
  wrap(presencasPorTurma)
);

// 📄 Relatório detalhado de presenças por turma (administrador ou instrutor)
router.get(
  "/presenca/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presenca/turma/:turma_id/detalhado"),
  wrap(presencasPorTurmaDetalhado)
);

// 📄 Relatório de presenças por evento (somente administrador)
router.get(
  "/presenca/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  routeTag("relatorioRoute:GET /presenca/evento/:evento_id"),
  wrap(presencasPorEvento)
);

/* =========================================================
   ✅ RELATÓRIOS GERAIS (admin only)
========================================================= */

router.get(
  "/",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:GET /"),
  wrap(gerarRelatorios)
);

router.post(
  "/exportar",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:POST /exportar"),
  wrap(exportarRelatorios)
);

router.get(
  "/opcao",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:GET /opcao"),
  wrap(opcaoRelatorios)
);

/* =========================================================
   ♻️ ALIASES internos de compat
========================================================= */

// aliases para uso em mounts como /api/relatorios-presencas
router.get(
  "/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /turma/:turma_id"),
  wrap(presencasPorTurma)
);

router.get(
  "/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /turma/:turma_id/detalhado"),
  wrap(presencasPorTurmaDetalhado)
);

router.get(
  "/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  routeTag("relatorioRoute:GET /evento/:evento_id"),
  wrap(presencasPorEvento)
);

module.exports = router;