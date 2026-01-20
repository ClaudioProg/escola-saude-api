// 📁 src/routes/loockupsPublicRoute.js — PREMIUM (leve, cache-aware, resiliente)
/* eslint-disable no-console */
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
    console.error("[loockupsPublicRoute] Controller inválido:", fn, lookupsCtrl);
    throw new Error(`lookupsPublicController inválido (função ausente: ${fn})`);
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
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
const withLookupCache = (req, res, next) => {
  res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
  return next();
};

/* ────────────────────────────────────────────────
   🌐 Lookups públicos (SEM auth)
   Importante: nenhuma dessas rotas passa por middleware de auth
   ──────────────────────────────────────────────── */

// 🧑‍💼 Cargos
router.get(
  "/cargos",
  routeTag("loockupsPublicRoute:GET /cargos"),
  withLookupCache,
  handle(ctrl.listCargos)
);

// 🏢 Unidades
router.get(
  "/unidades",
  routeTag("loockupsPublicRoute:GET /unidades"),
  withLookupCache,
  handle(ctrl.listUnidades)
);

// ⚧️ Gêneros
router.get(
  "/generos",
  routeTag("loockupsPublicRoute:GET /generos"),
  withLookupCache,
  handle(ctrl.listGeneros)
);

// 🏳️‍🌈 Orientações sexuais
router.get(
  "/orientacao-sexuais",
  routeTag("loockupsPublicRoute:GET /orientacao-sexuais"),
  withLookupCache,
  handle(ctrl.listOrientacaoSexuais)
);

// 🎨 Cores / Raças
router.get(
  "/cores-racas",
  routeTag("loockupsPublicRoute:GET /cores-racas"),
  withLookupCache,
  handle(ctrl.listCoresRacas)
);

// 🎓 Escolaridades
router.get(
  "/escolaridades",
  routeTag("loockupsPublicRoute:GET /escolaridades"),
  withLookupCache,
  handle(ctrl.listEscolaridades)
);

// ♿ Deficiências
router.get(
  "/deficiencias",
  routeTag("loockupsPublicRoute:GET /deficiencias"),
  withLookupCache,
  handle(ctrl.listDeficiencias)
);

module.exports = router;
