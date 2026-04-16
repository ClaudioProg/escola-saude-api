// 📁 src/routes/lookupsPublicRoute.js — PREMIUM (leve, cache-aware, resiliente)
/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

/* ───────────────── Import resiliente do controller ───────────────── */
const lookupsCtrl = require("../controllers/lookupsPublicController");
const ctrl =
  typeof lookupsCtrl === "function"
    ? lookupsCtrl
    : lookupsCtrl?.default || lookupsCtrl;

const requiredFns = [
  "listCargos",
  "listUnidades",
  "listGeneros",
  "listOrientacaoSexuais",
  "listCoresRacas",
  "listEscolaridades",
  "listDeficiencias",
];

for (const fn of requiredFns) {
  if (typeof ctrl?.[fn] !== "function") {
    console.error("[lookupsPublicRoute] Controller inválido:", fn, lookupsCtrl);
    throw new Error(
      `lookupsPublicController inválido (função ausente: ${fn})`
    );
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (_req, res, next) => {
  try {
    res.set("X-Route-Handler", tag);
  } catch {}
  return next();
};

const handle =
  (fn) =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };

/**
 * Cache padrão para lookups públicos
 * ➜ dados mudam pouco, ótimo para performance do app
 * ➜ se quiser zerar cache, troque por `no-store`
 */
const withLookupCache = (_req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
    res.set("Pragma", "public");
  } catch {}
  return next();
};

const headOk = (_req, res) => res.sendStatus(204);

/* ────────────────────────────────────────────────
   🌐 Lookups públicos (SEM auth)
   Importante: nenhuma dessas rotas passa por middleware de auth
──────────────────────────────────────────────── */

// 🧑‍💼 Cargos
router.get(
  "/cargos",
  routeTag("lookupsPublicRoute:GET /cargos"),
  withLookupCache,
  handle(ctrl.listCargos)
);
router.head(
  "/cargos",
  routeTag("lookupsPublicRoute:HEAD /cargos"),
  withLookupCache,
  headOk
);

// 🏢 Unidades
router.get(
  "/unidades",
  routeTag("lookupsPublicRoute:GET /unidades"),
  withLookupCache,
  handle(ctrl.listUnidades)
);
router.head(
  "/unidades",
  routeTag("lookupsPublicRoute:HEAD /unidades"),
  withLookupCache,
  headOk
);

// ⚧️ Gêneros
router.get(
  "/generos",
  routeTag("lookupsPublicRoute:GET /generos"),
  withLookupCache,
  handle(ctrl.listGeneros)
);
router.head(
  "/generos",
  routeTag("lookupsPublicRoute:HEAD /generos"),
  withLookupCache,
  headOk
);

// 🏳️‍🌈 Orientações sexuais
router.get(
  "/orientacao-sexuais",
  routeTag("lookupsPublicRoute:GET /orientacao-sexuais"),
  withLookupCache,
  handle(ctrl.listOrientacaoSexuais)
);
router.get(
  "/orientacoes-sexuais",
  routeTag("lookupsPublicRoute:GET /orientacoes-sexuais"),
  withLookupCache,
  handle(ctrl.listOrientacaoSexuais)
);
router.head(
  "/orientacao-sexuais",
  routeTag("lookupsPublicRoute:HEAD /orientacao-sexuais"),
  withLookupCache,
  headOk
);
router.head(
  "/orientacoes-sexuais",
  routeTag("lookupsPublicRoute:HEAD /orientacoes-sexuais"),
  withLookupCache,
  headOk
);

// 🎨 Cores / Raças
router.get(
  "/cores-racas",
  routeTag("lookupsPublicRoute:GET /cores-racas"),
  withLookupCache,
  handle(ctrl.listCoresRacas)
);
router.head(
  "/cores-racas",
  routeTag("lookupsPublicRoute:HEAD /cores-racas"),
  withLookupCache,
  headOk
);

// 🎓 Escolaridades
router.get(
  "/escolaridades",
  routeTag("lookupsPublicRoute:GET /escolaridades"),
  withLookupCache,
  handle(ctrl.listEscolaridades)
);
router.head(
  "/escolaridades",
  routeTag("lookupsPublicRoute:HEAD /escolaridades"),
  withLookupCache,
  headOk
);

// ♿ Deficiências
router.get(
  "/deficiencias",
  routeTag("lookupsPublicRoute:GET /deficiencias"),
  withLookupCache,
  handle(ctrl.listDeficiencias)
);
router.head(
  "/deficiencias",
  routeTag("lookupsPublicRoute:HEAD /deficiencias"),
  withLookupCache,
  headOk
);

module.exports = router;