/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/unidadeRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Mount oficial:
 * - /api/unidade
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const unidadeController = require("../controllers/unidadeController");

const router = express.Router();

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[unidadeRoute] Handler obrigatório ausente: unidadeController.${name}`
    );
  }
}

assertHandler("listar", unidadeController.listar);
assertHandler("obterPorId", unidadeController.obterPorId);
assertHandler("existePorId", unidadeController.existePorId);

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
    "public, max-age=300, stale-while-revalidate=600"
  );
  return next();
}

const unidadeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "UNIDADE-429-LIMITE",
    message: "Muitas requisições de unidades. Aguarde antes de tentar novamente.",
  },
});

router.use(unidadeLimiter);
router.use(publicLookupCache);

router.get(
  "/",
  routeTag("unidadeRoute:v2.0:GET /"),
  asyncHandler(unidadeController.listar)
);

router.head(
  "/",
  routeTag("unidadeRoute:v2.0:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

router.get(
  "/:id",
  routeTag("unidadeRoute:v2.0:GET /:id"),
  asyncHandler(unidadeController.obterPorId)
);

router.head(
  "/:id",
  routeTag("unidadeRoute:v2.0:HEAD /:id"),
  asyncHandler(unidadeController.existePorId)
);

module.exports = router;