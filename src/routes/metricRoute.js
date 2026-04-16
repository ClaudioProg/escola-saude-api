"use strict";

/* eslint-disable no-console */
// ✅ src/routes/metricRoute.js — wrapper do metricService (Express Router)
const express = require("express");
const router = express.Router();

const metricService = require("../services/metricService");

/* ───────────────── Helpers premium ───────────────── */
const wrap =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };

function isExpressRouterLike(obj) {
  return !!(
    obj &&
    typeof obj === "function" &&
    typeof obj.use === "function" &&
    typeof obj.handle === "function"
  );
}

function isMiddlewareLike(obj) {
  return typeof obj === "function";
}

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/* ───────────────── Export direto se o service já for middleware/router ───────────────── */
if (isExpressRouterLike(metricService) || isMiddlewareLike(metricService)) {
  module.exports = metricService;
} else {
  /**
   * A partir daqui: metricService é OBJETO (não middleware).
   * Exponha endpoints mínimos e adapte conforme as funções existentes.
   */

  // Health/overview: útil para debug
  router.get("/", (_req, res) => {
    return res.json({
      ok: true,
      serviceType: typeof metricService,
      keys:
        metricService && typeof metricService === "object"
          ? Object.keys(metricService)
          : [],
    });
  });

  router.head("/", (_req, res) => {
    return res.sendStatus(204);
  });

  // Exemplo: /metric/inc/:name  (se existir metricService.inc)
  router.post(
    "/inc/:name",
    wrap(async (req, res) => {
      const name = String(req.params.name || "").trim();
      if (!name) {
        return res
          .status(400)
          .json({ ok: false, erro: "name obrigatório" });
      }

      if (typeof metricService?.inc !== "function") {
        return res.status(501).json({
          ok: false,
          erro: "metricService.inc não implementado",
        });
      }

      const value = toFiniteNumber(req.body?.value, 1);
      await metricService.inc(name, value);

      return res.json({
        ok: true,
        metric: name,
        value,
      });
    })
  );

  // Exemplo: /metric/timing/:name  (se existir metricService.timing)
  router.post(
    "/timing/:name",
    wrap(async (req, res) => {
      const name = String(req.params.name || "").trim();
      const ms = toFiniteNumber(req.body?.ms);

      if (!name) {
        return res
          .status(400)
          .json({ ok: false, erro: "name obrigatório" });
      }

      if (!Number.isFinite(ms)) {
        return res
          .status(400)
          .json({ ok: false, erro: "ms numérico obrigatório" });
      }

      if (typeof metricService?.timing !== "function") {
        return res.status(501).json({
          ok: false,
          erro: "metricService.timing não implementado",
        });
      }

      await metricService.timing(name, ms);

      return res.json({
        ok: true,
        metric: name,
        ms,
      });
    })
  );

  module.exports = router;
}