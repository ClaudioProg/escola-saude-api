/* eslint-disable no-console */
"use strict";

// ✅ src/routes/avaliacaoRoute.js — PREMIUM/UNIFICADO (singular + compat + debug pós-curso)

const express = require("express");
const { param, validationResult } = require("express-validator");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.authAny || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[avaliacaoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  authorizeMod?.authorizeRoles ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[avaliacaoRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

// ✅ Controller principal
const avaliacaoCtrl = require("../controllers/avaliacaoController");

// ✅ Controller de debug pós-curso
const debugPosCursoCtrl = require("../controllers/debugPosCursoController");

const router = express.Router();

/* =========================
   Helpers (premium)
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    ok: false,
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({
      campo: e.path || e.param,
      msg: e.msg,
    })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

const idParam = (name) =>
  param(name)
    .exists({ checkFalsy: true })
    .withMessage(`"${name}" é obrigatório.`)
    .bail()
    .isInt({ min: 1 })
    .withMessage(`"${name}" deve ser um inteiro >= 1.`)
    .toInt();

function getPerfis(user) {
  const raw = user?.perfis ?? user?.perfil ?? user?.roles ?? user?.role ?? "";

  if (Array.isArray(raw)) {
    return raw
      .map(String)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getUserId(req) {
  const u = req.user || req.usuario || {};
  return (
    u?.id ??
    u?.usuario_id ??
    req?.user?.usuario_id ??
    req?.usuario?.usuario_id ??
    req?.auth?.userId ??
    null
  );
}

// Admin pode ver qualquer usuário; demais perfis só se :usuario_id === id do token
function ensureSelfOrAdmin(req, res, next) {
  const user = req.user || req.usuario || {};
  const tokenId = Number(getUserId(req));
  const paramId = Number(req.params.usuario_id);

  const perfis = getPerfis(user);
  const isAdmin = perfis.includes("administrador") || perfis.includes("admin");

  if (!Number.isFinite(paramId) || paramId <= 0) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  if (isAdmin || tokenId === paramId) return next();

  return res.status(403).json({ erro: "Acesso negado." });
}

function injectCurrentUserIdIntoParams(req, res, next) {
  const uid = getUserId(req);

  if (!uid) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  req.params.usuario_id = String(uid);
  return next();
}

/* =========================
   Middlewares do grupo
========================= */
router.use(requireAuth);

// 🛡️ Premium: avaliações podem conter comentários → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================================================
   ✅ DEBUG PÓS-CURSO
   Final: GET /api/avaliacao/debug/pos-curso/:usuario_id
========================================================= */
router.get(
  "/debug/pos-curso/:usuario_id",
  authorizeRoles("administrador"),
  [idParam("usuario_id")],
  validate,
  asyncHandler(debugPosCursoCtrl.debugPosCursoPorUsuario)
);

/* =========================================================
   ✅ ADMIN (subrotas dentro do mesmo router)
   Montado em /api/avaliacao -> /api/avaliacao/admin/...
   (e também funciona via alias do index: /api/admin/avaliacao -> /api/admin/avaliacao/...)
========================================================= */
const admin = express.Router();

admin.use(authorizeRoles("administrador"));

/**
 * ✅ LISTA de eventos com avaliações
 * Canon:   GET /api/avaliacao/admin/eventos
 * Compat:  GET /api/avaliacao/admin/evento
 */
admin.get("/eventos", asyncHandler(avaliacaoCtrl.listarEventosComAvaliacao));
admin.get("/evento", asyncHandler(avaliacaoCtrl.listarEventosComAvaliacao)); // alias

/**
 * ✅ Detalhe avaliações do evento
 * Canon:   GET /api/avaliacao/admin/evento/:evento_id
 * Compat:  GET /api/avaliacao/admin/eventos/:evento_id
 */
admin.get(
  ["/evento/:evento_id", "/eventos/:evento_id"],
  [idParam("evento_id")],
  validate,
  asyncHandler(avaliacaoCtrl.obterAvaliacaoDoEvento)
);

/**
 * ✅ Detalhe avaliações da turma
 * Canon: GET /api/avaliacao/admin/turma/:turma_id
 */
admin.get(
  "/turma/:turma_id",
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoCtrl.obterAvaliacaoDaTurma)
);

router.use("/admin", admin);

/* =========================================================
   ✅ ROTAS “NORMAIS” (usuário / instrutor / admin)
========================================================= */

/**
 * 📝 Enviar avaliação
 * POST /api/avaliacao
 */
router.post(
  "/",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(avaliacaoCtrl.enviarAvaliacao)
);

/**
 * 📊 (Admin) agregado/RAW por turma (todas respostas)
 * GET /api/avaliacao/turma/:turma_id/all
 */
router.get(
  "/turma/:turma_id/all",
  authorizeRoles("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoCtrl.avaliacaoPorTurma)
);

/**
 * 📊 (Instrutor/Admin) respostas da turma
 * GET /api/avaliacao/turma/:turma_id
 */
router.get(
  "/turma/:turma_id",
  authorizeRoles("instrutor", "administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoCtrl.listarPorTurmaParaInstrutor)
);

/**
 * 🧾 (Admin) agregado por evento
 * GET /api/avaliacao/evento/:evento_id
 */
router.get(
  "/evento/:evento_id",
  authorizeRoles("administrador"),
  [idParam("evento_id")],
  validate,
  asyncHandler(avaliacaoCtrl.avaliacaoPorEvento)
);

/**
 * 📋 Pendentes por usuário (protegido contra IDOR)
 * Canon: GET /api/avaliacao/disponivel/:usuario_id
 */
router.get(
  "/disponivel/:usuario_id",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [idParam("usuario_id")],
  validate,
  ensureSelfOrAdmin,
  asyncHandler(avaliacaoCtrl.listarAvaliacaoDisponiveis)
);

/**
 * Alias: GET /api/avaliacao/disponivel
 * usa o id do token
 */
router.get(
  "/disponivel",
  authorizeRoles("administrador", "instrutor", "usuario"),
  injectCurrentUserIdIntoParams,
  asyncHandler(avaliacaoCtrl.listarAvaliacaoDisponiveis)
);

/* =========================================================
   ♻️ ALIASES de compat (mantém URLs antigas vivas)
========================================================= */

/**
 * Alias antigo: /disponiveis/:usuario_id
 */
router.get(
  "/disponiveis/:usuario_id",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [idParam("usuario_id")],
  validate,
  ensureSelfOrAdmin,
  asyncHandler(avaliacaoCtrl.listarAvaliacaoDisponiveis)
);

/**
 * Alias antigo: /disponiveis
 */
router.get(
  "/disponiveis",
  authorizeRoles("administrador", "instrutor", "usuario"),
  injectCurrentUserIdIntoParams,
  asyncHandler(avaliacaoCtrl.listarAvaliacaoDisponiveis)
);

module.exports = router;