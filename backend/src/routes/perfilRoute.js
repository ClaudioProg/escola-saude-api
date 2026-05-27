/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/perfilRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Mount oficial:
 * - /api/perfil
 *
 * Rotas oficiais:
 * - GET  /api/perfil/opcao
 * - HEAD /api/perfil/opcao
 * - GET  /api/perfil/me
 * - HEAD /api/perfil/me
 * - PUT  /api/perfil/me
 *
 * Contrato:
 * - /perfil/opcao é público, com cache curto.
 * - /perfil/me é protegido por authMiddleware.
 * - Atualização do próprio perfil usa PUT, sem PATCH alternativo.
 *
 * Sem aliases:
 * - sem /profile
 * - sem /meu-perfil
 * - sem PATCH duplicando PUT
 * - sem múltiplas possibilidades de export
 */

const express = require("express");

const requireAuth = require("../auth/authMiddleware");
const perfilController = require("../controllers/perfilController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (typeof requireAuth !== "function") {
  throw new Error("[perfilRoute] authMiddleware deve exportar uma função.");
}

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[perfilRoute] Handler obrigatório ausente: perfilController.${name}`
    );
  }
}

assertHandler("listarOpcaoPerfil", perfilController.listarOpcaoPerfil);
assertHandler("meuPerfil", perfilController.meuPerfil);
assertHandler("atualizarMeuPerfil", perfilController.atualizarMeuPerfil);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function publicLookupCache(_req, res, next) {
  res.setHeader(
    "Cache-Control",
    "public, max-age=600, stale-while-revalidate=600"
  );
  return next();
}

function privateNoStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

/* ─────────────────────────────────────────────────────────────
   Rotas públicas
────────────────────────────────────────────────────────────── */

/**
 * GET /api/perfil/opcao
 */
router.get(
  "/opcao",
  publicLookupCache,
  routeTag("perfilRoute:v2.0:GET /opcao"),
  asyncHandler(perfilController.listarOpcaoPerfil)
);

/**
 * HEAD /api/perfil/opcao
 */
router.head(
  "/opcao",
  publicLookupCache,
  routeTag("perfilRoute:v2.0:HEAD /opcao"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Rotas protegidas
────────────────────────────────────────────────────────────── */

router.use(requireAuth, privateNoStore);

/**
 * GET /api/perfil/me
 */
router.get(
  "/me",
  routeTag("perfilRoute:v2.0:GET /me"),
  asyncHandler(perfilController.meuPerfil)
);

/**
 * HEAD /api/perfil/me
 */
router.head(
  "/me",
  routeTag("perfilRoute:v2.0:HEAD /me"),
  (_req, res) => res.sendStatus(204)
);

/**
 * PUT /api/perfil/me
 */
router.put(
  "/me",
  routeTag("perfilRoute:v2.0:PUT /me"),
  asyncHandler(perfilController.atualizarMeuPerfil)
);

module.exports = router;