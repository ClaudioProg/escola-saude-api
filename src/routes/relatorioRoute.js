/* eslint-disable no-console */
"use strict";

// ✅ src/routes/relatorioRoute.js — PREMIUM/UNIFICADO+++ (2026)
// - Rotas de relatórios gerais + relatórios de presenças
// - Compatível com singular/plural:
//    • /presenca/...
//    • /presencas/...
//    • /turma/...
//    • /evento/...
// - Auth/roles resilientes
// - Rate limit para endpoints pesados
// - No-store para dados sensíveis
// - X-Route-Handler + X-Request-Id para diagnóstico
// - Mantém contratos antigos sem quebrar frontend existente

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ────────────────────────────────────────────────────────────────
   Config / Logs
──────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";

const log = (...a) => !IS_PROD && console.log("[relatorioRoute]", ...a);
const warn = (...a) => !IS_PROD && console.warn("[relatorioRoute][WARN]", ...a);
const errlg = (...a) => console.error("[relatorioRoute][ERR]", ...a);

function mkRid(prefix = "REL-ROUTE") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ────────────────────────────────────────────────────────────────
   Auth resiliente
──────────────────────────────────────────────────────────────── */
const _auth = require("../auth/authMiddleware");

const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.protect ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  errlg("authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ────────────────────────────────────────────────────────────────
   Roles resiliente
──────────────────────────────────────────────────────────────── */
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
  errlg("authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* ────────────────────────────────────────────────────────────────
   Controller resiliente
──────────────────────────────────────────────────────────────── */
const relatorioCtrlRaw = require("../controllers/relatorioController");
const relatorioController = relatorioCtrlRaw?.default || relatorioCtrlRaw;

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
    errlg("Controller inválido:", name, relatorioCtrlRaw);
    throw new Error(`relatorioController inválido (função ausente: ${name})`);
  }
}

/* ────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const routeTag = (tag) => (req, res, next) => {
  try {
    res.setHeader("X-Route-Handler", tag);

    if (!res.getHeader("X-Request-Id")) {
      const rid =
        req.headers?.["x-request-id"] ||
        req.headers?.["x-correlation-id"] ||
        mkRid();

      req.requestId = req.requestId || String(rid);
      res.setHeader("X-Request-Id", req.requestId);
    }
  } catch {}

  return next();
};

function validarIdParam(param, label = param) {
  return (req, res, next) => {
    const raw = req.params?.[param];
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      const rid = req.requestId || mkRid("REL-VALID");

      warn("[validarIdParam][INVALIDO]", {
        rid,
        param,
        label,
        raw,
      });

      return res.status(400).json({
        ok: false,
        erro: `${label}_INVALIDO`,
        rid,
      });
    }

    req.params[param] = String(id);
    return next();
  };
}

/* ────────────────────────────────────────────────────────────────
   Middlewares globais do grupo
──────────────────────────────────────────────────────────────── */

// 🔒 Dados sensíveis → não cachear
router.use((req, res, next) => {
  try {
    const rid =
      req.headers?.["x-request-id"] ||
      req.headers?.["x-correlation-id"] ||
      mkRid();

    req.requestId = req.requestId || String(rid);

    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  } catch {}

  next();
});

// 🚦 Relatórios tendem a ser endpoints mais pesados
const relatorioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    erro: "Muitas requisições. Aguarde alguns instantes.",
  },
});

// 🔐 Tudo daqui para frente exige autenticação
router.use(requireAuth);

/* =========================================================
   ✅ RELATÓRIOS DE PRESENÇAS
   Compatibilidade:
   - /presenca/...
   - /presencas/...
========================================================= */

// 📄 Relatório de presenças por turma — singular
router.get(
  "/presenca/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presenca/turma/:turma_id"),
  wrap(presencasPorTurma)
);

// 📄 Relatório detalhado de presenças por turma — singular
router.get(
  "/presenca/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presenca/turma/:turma_id/detalhado"),
  wrap(presencasPorTurmaDetalhado)
);

// 📄 Relatório de presenças por evento — singular
router.get(
  "/presenca/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  routeTag("relatorioRoute:GET /presenca/evento/:evento_id"),
  wrap(presencasPorEvento)
);

// ♻️ Alias plural: /presencas/turma/:turma_id
router.get(
  "/presencas/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presencas/turma/:turma_id"),
  wrap(presencasPorTurma)
);

// ♻️ Alias plural: /presencas/turma/:turma_id/detalhado
router.get(
  "/presencas/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /presencas/turma/:turma_id/detalhado"),
  wrap(presencasPorTurmaDetalhado)
);

// ♻️ Alias plural: /presencas/evento/:evento_id
router.get(
  "/presencas/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  routeTag("relatorioRoute:GET /presencas/evento/:evento_id"),
  wrap(presencasPorEvento)
);

/* =========================================================
   ✅ RELATÓRIOS GERAIS — admin only
========================================================= */

// ⚠️ Colocar rotas específicas antes de "/" por legibilidade.
// No Express, "/" é exato neste caso, mas manter assim evita confusão futura.

router.get(
  "/opcao",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:GET /opcao"),
  wrap(opcaoRelatorios)
);

router.post(
  "/exportar",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:POST /exportar"),
  wrap(exportarRelatorios)
);

router.get(
  "/",
  relatorioLimiter,
  authorizeRoles("administrador"),
  routeTag("relatorioRoute:GET /"),
  wrap(gerarRelatorios)
);

/* =========================================================
   ♻️ ALIASES internos de compat
   Para mounts como:
   - /api/relatorios-presencas
   - /api/relatorio-presencas
   - /api/relatorio
========================================================= */

// 📄 Alias direto por turma
router.get(
  "/turma/:turma_id",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /turma/:turma_id"),
  wrap(presencasPorTurma)
);

// 📄 Alias direto por turma detalhado
router.get(
  "/turma/:turma_id/detalhado",
  relatorioLimiter,
  authorizeRoles("administrador", "instrutor"),
  validarIdParam("turma_id", "TURMA_ID"),
  routeTag("relatorioRoute:GET /turma/:turma_id/detalhado"),
  wrap(presencasPorTurmaDetalhado)
);

// 📄 Alias direto por evento
router.get(
  "/evento/:evento_id",
  relatorioLimiter,
  authorizeRoles("administrador"),
  validarIdParam("evento_id", "EVENTO_ID"),
  routeTag("relatorioRoute:GET /evento/:evento_id"),
  wrap(presencasPorEvento)
);

log("Rotas de relatório inicializadas:", {
  auth: typeof requireAuth,
  authorizeRoles: typeof authorizeRoles,
  controller: {
    gerarRelatorios: typeof gerarRelatorios,
    exportarRelatorios: typeof exportarRelatorios,
    opcaoRelatorios: typeof opcaoRelatorios,
    presencasPorTurma: typeof presencasPorTurma,
    presencasPorTurmaDetalhado: typeof presencasPorTurmaDetalhado,
    presencasPorEvento: typeof presencasPorEvento,
  },
});

module.exports = router;