"use strict";

/* eslint-disable no-console */
// ✅ src/routes/metricRoute.js — wrapper do metricService (Express Router)
const express = require("express");
const router = express.Router();

const metricService = require("../services/metricService");

// Helper pra responder sempre ok/err
const wrap =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };

// ✅ Se o service já expõe um middleware/router pronto, usa direto
if (typeof metricService === "function") {
  module.exports = metricService;
  return;
}
if (metricService && typeof metricService === "object" && typeof metricService.handle === "function") {
  // provavelmente é um express.Router
  module.exports = metricService;
  return;
}

/**
 * A partir daqui: metricService é OBJETO (não middleware).
 * Exponha endpoints mínimos e adapte conforme as funções existentes.
 */

// Health/overview: tenta mostrar chaves do service (útil pra debug)
router.get("/", (req, res) => {
  return res.json({
    ok: true,
    serviceType: typeof metricService,
    keys: metricService && typeof metricService === "object" ? Object.keys(metricService) : [],
  });
});

// Exemplo: /metric/inc/:nome  (se existir metricService.inc)
router.post(
  "/inc/:name",
  wrap(async (req, res) => {
    const name = String(req.params.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, erro: "name obrigatório" });

    if (typeof metricService?.inc !== "function") {
      return res.status(501).json({ ok: false, erro: "metricService.inc não implementado" });
    }

    const value = req.body?.value ?? 1;
    await metricService.inc(name, value);
    return res.json({ ok: true });
  })
);

// Exemplo: /metric/timing/:nome  (se existir metricService.timing)
router.post(
  "/timing/:name",
  wrap(async (req, res) => {
    const name = String(req.params.name || "").trim();
    const ms = Number(req.body?.ms);
    if (!name) return res.status(400).json({ ok: false, erro: "name obrigatório" });
    if (!Number.isFinite(ms)) return res.status(400).json({ ok: false, erro: "ms numérico obrigatório" });

    if (typeof metricService?.timing !== "function") {
      return res.status(501).json({ ok: false, erro: "metricService.timing não implementado" });
    }

    await metricService.timing(name, ms);
    return res.json({ ok: true });
  })
);

module.exports = router;
