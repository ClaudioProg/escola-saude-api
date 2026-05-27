/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/lookupPublicRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas públicas oficiais para listas auxiliares usadas em cadastro,
 *   perfil e filtros.
 *
 * Mount oficial:
 * - /api/lookup
 *
 * Rotas oficiais:
 * - GET  /api/lookup/cargo
 * - HEAD /api/lookup/cargo
 * - GET  /api/lookup/unidade
 * - HEAD /api/lookup/unidade
 * - GET  /api/lookup/genero
 * - HEAD /api/lookup/genero
 * - GET  /api/lookup/orientacao-sexual
 * - HEAD /api/lookup/orientacao-sexual
 * - GET  /api/lookup/cor-raca
 * - HEAD /api/lookup/cor-raca
 * - GET  /api/lookup/escolaridade
 * - HEAD /api/lookup/escolaridade
 * - GET  /api/lookup/deficiencia
 * - HEAD /api/lookup/deficiencia
 *
 * Contrato:
 * - Público.
 * - Cache curto.
 * - Singular.
 * - Sem aliases.
 * - Sem import resiliente.
 * - Sem múltiplas possibilidades de controller.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const lookupPublicController = require("../controllers/lookupPublicController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[lookupPublicRoute] Handler obrigatório ausente: lookupPublicController.${name}`
    );
  }
}

assertHandler("listarCargo", lookupPublicController.listarCargo);
assertHandler("listarUnidade", lookupPublicController.listarUnidade);
assertHandler("listarGenero", lookupPublicController.listarGenero);
assertHandler(
  "listarOrientacaoSexual",
  lookupPublicController.listarOrientacaoSexual
);
assertHandler("listarCorRaca", lookupPublicController.listarCorRaca);
assertHandler("listarEscolaridade", lookupPublicController.listarEscolaridade);
assertHandler("listarDeficiencia", lookupPublicController.listarDeficiencia);

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

function headOk(_req, res) {
  return res.sendStatus(204);
}

/* ─────────────────────────────────────────────────────────────
   Rate limit público
────────────────────────────────────────────────────────────── */

const lookupPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "LOOKUP-429-LIMITE",
    message:
      "Muitas requisições de listas auxiliares. Aguarde antes de tentar novamente.",
  },
});

/* ─────────────────────────────────────────────────────────────
   Middlewares globais
────────────────────────────────────────────────────────────── */

router.use(lookupPublicLimiter);
router.use(publicLookupCache);

/* ─────────────────────────────────────────────────────────────
   Cargo
────────────────────────────────────────────────────────────── */

router.get(
  "/cargo",
  routeTag("lookupPublicRoute:v2.0:GET /cargo"),
  asyncHandler(lookupPublicController.listarCargo)
);

router.head(
  "/cargo",
  routeTag("lookupPublicRoute:v2.0:HEAD /cargo"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Unidade
────────────────────────────────────────────────────────────── */

router.get(
  "/unidade",
  routeTag("lookupPublicRoute:v2.0:GET /unidade"),
  asyncHandler(lookupPublicController.listarUnidade)
);

router.head(
  "/unidade",
  routeTag("lookupPublicRoute:v2.0:HEAD /unidade"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Gênero
────────────────────────────────────────────────────────────── */

router.get(
  "/genero",
  routeTag("lookupPublicRoute:v2.0:GET /genero"),
  asyncHandler(lookupPublicController.listarGenero)
);

router.head(
  "/genero",
  routeTag("lookupPublicRoute:v2.0:HEAD /genero"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Orientação sexual
────────────────────────────────────────────────────────────── */

router.get(
  "/orientacao-sexual",
  routeTag("lookupPublicRoute:v2.0:GET /orientacao-sexual"),
  asyncHandler(lookupPublicController.listarOrientacaoSexual)
);

router.head(
  "/orientacao-sexual",
  routeTag("lookupPublicRoute:v2.0:HEAD /orientacao-sexual"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Cor/raça
────────────────────────────────────────────────────────────── */

router.get(
  "/cor-raca",
  routeTag("lookupPublicRoute:v2.0:GET /cor-raca"),
  asyncHandler(lookupPublicController.listarCorRaca)
);

router.head(
  "/cor-raca",
  routeTag("lookupPublicRoute:v2.0:HEAD /cor-raca"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Escolaridade
────────────────────────────────────────────────────────────── */

router.get(
  "/escolaridade",
  routeTag("lookupPublicRoute:v2.0:GET /escolaridade"),
  asyncHandler(lookupPublicController.listarEscolaridade)
);

router.head(
  "/escolaridade",
  routeTag("lookupPublicRoute:v2.0:HEAD /escolaridade"),
  headOk
);

/* ─────────────────────────────────────────────────────────────
   Deficiência
────────────────────────────────────────────────────────────── */

router.get(
  "/deficiencia",
  routeTag("lookupPublicRoute:v2.0:GET /deficiencia"),
  asyncHandler(lookupPublicController.listarDeficiencia)
);

router.head(
  "/deficiencia",
  routeTag("lookupPublicRoute:v2.0:HEAD /deficiencia"),
  headOk
);

module.exports = router;