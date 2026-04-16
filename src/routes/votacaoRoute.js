/* eslint-disable no-console */
"use strict";

// ✅ src/routes/votacaoRoute.js — PREMIUM/UNIFICADO (singular + compat)
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth || _auth?.protect;

if (typeof requireAuth !== "function") {
  console.error("[votacaoRoute] authMiddleware inválido:", _auth);
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
  console.error("[votacaoRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* ───────────────── Controller ───────────────── */
const ctrl = require("../controllers/votacaoController");

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn, label = "handler") =>
  (req, res, next) =>
    Promise.resolve()
      .then(() => {
        if (typeof fn !== "function") {
          const err = new Error(`Handler não implementado: ${label}`);
          err.status = 501;
          throw err;
        }
        return fn(req, res, next);
      })
      .catch(next);

function toPositiveInt(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = toPositiveInt(req.params?.[paramName]);
    if (!id) {
      return res.status(400).json({ erro: `${paramName} inválido.` });
    }
    req.params[paramName] = String(id);
    return next();
  };
}

function buildEtag(payload) {
  return `"vote-${crypto
    .createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("base64")}"`;
}

function setPrivateCache(res, maxAge = 120, swr = 600) {
  res.setHeader(
    "Cache-Control",
    `private, max-age=${maxAge}, stale-while-revalidate=${swr}`
  );
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function routeTag(tag, cacheMode = "private") {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);

    if (cacheMode === "no-store") {
      setNoStore(res);
    }

    return next();
  };
}

function sendWithEtag(req, res, data, { maxAge = 120, swr = 600 } = {}) {
  const etag = buildEtag(data);
  res.setHeader("ETag", etag);
  setPrivateCache(res, maxAge, swr);

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  return res.status(200).json({ ok: true, data });
}

/* ───────────────── Rate limits ───────────────── */
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde um pouco e tente novamente." },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições administrativas. Aguarde um pouco." },
});

const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de voto. Aguarde alguns instantes." },
});

/* =========================================================
   ✅ ROTAS DO USUÁRIO
========================================================= */

/**
 * 🗳️ Votações abertas para o usuário logado
 * GET /api/votacao/abertas/mine
 */
router.get(
  "/abertas/mine",
  requireAuth,
  userLimiter,
  routeTag("votacaoRoute:GET /abertas/mine"),
  asyncHandler(async (req, res) => {
    const data = await ctrl.listarVotacaoElegiveis(req, res, { internal: true });
    if (res.headersSent) return;
    return sendWithEtag(req, res, data, { maxAge: 60, swr: 180 });
  }, "ctrl.listarVotacaoElegiveis")
);

/**
 * 🗳️ Registrar voto
 * POST /api/votacao/:id/votar
 */
router.post(
  "/:id/votar",
  requireAuth,
  voteLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:POST /:id/votar", "no-store"),
  asyncHandler(ctrl.votar, "ctrl.votar")
);

/* =========================================================
   ✅ ROTAS DE ADMIN
========================================================= */

/**
 * 📋 Lista geral
 * GET /api/votacao
 */
router.get(
  "/",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  routeTag("votacaoRoute:GET /"),
  asyncHandler(async (req, res) => {
    const data = await ctrl.listarVotacaoAdmin(req, res, { internal: true });
    if (res.headersSent) return;

    console.log(`[VOTACAO_ROUTE] Listagem admin gerada em ${new Date().toISOString()}`);
    return sendWithEtag(req, res, data, { maxAge: 120, swr: 600 });
  }, "ctrl.listarVotacaoAdmin")
);

/**
 * ➕ Criar votação
 * POST /api/votacao
 */
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  routeTag("votacaoRoute:POST /", "no-store"),
  asyncHandler(ctrl.criarVotacao, "ctrl.criarVotacao")
);

/**
 * ✏️ Atualizar votação
 * PUT /api/votacao/:id
 */
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:PUT /:id", "no-store"),
  asyncHandler(ctrl.atualizarVotacao, "ctrl.atualizarVotacao")
);

/**
 * 🔁 Atualizar status
 * PATCH /api/votacao/:id/status
 */
router.patch(
  "/:id/status",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:PATCH /:id/status", "no-store"),
  asyncHandler(ctrl.atualizarStatus, "ctrl.atualizarStatus")
);

/**
 * ➕ Criar opção
 * POST /api/votacao/:id/opcao
 */
router.post(
  "/:id/opcao",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:POST /:id/opcao", "no-store"),
  asyncHandler(ctrl.criarOpcao, "ctrl.criarOpcao")
);

/**
 * ✏️ Atualizar opção
 * PUT /api/votacao/:id/opcao/:opcaoId
 */
router.put(
  "/:id/opcao/:opcaoId",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  validateIdParam("opcaoId"),
  routeTag("votacaoRoute:PUT /:id/opcao/:opcaoId", "no-store"),
  asyncHandler(ctrl.atualizarOpcao, "ctrl.atualizarOpcao")
);

/**
 * 📊 Ranking
 * GET /api/votacao/:id/ranking
 */
router.get(
  "/:id/ranking",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:GET /:id/ranking"),
  asyncHandler(async (req, res) => {
    const data = await ctrl.ranking(req, res, { internal: true });
    if (res.headersSent) return;
    return sendWithEtag(req, res, data, { maxAge: 120, swr: 600 });
  }, "ctrl.ranking")
);

/**
 * 🔗 URL canônica
 * GET /api/votacao/:id/url
 */
router.get(
  "/:id/url",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:GET /:id/url"),
  asyncHandler(ctrl.getUrl, "ctrl.getUrl")
);

/**
 * 🔎 Detalhe da votação
 * GET /api/votacao/:id
 */
router.get(
  "/:id",
  requireAuth,
  authorizeRoles("administrador", "admin"),
  adminLimiter,
  validateIdParam("id"),
  routeTag("votacaoRoute:GET /:id"),
  asyncHandler(async (req, res) => {
    const data = await ctrl.obterVotacaoAdmin(req, res, { internal: true });
    if (res.headersSent) return;
    return sendWithEtag(req, res, data, { maxAge: 120, swr: 600 });
  }, "ctrl.obterVotacaoAdmin")
);

module.exports = router;