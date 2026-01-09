// 📁 src/routes/metricasRoutes.js — PREMIUM (robusto, cache-aware, anti-abuso)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Import resiliente do controller ───────────────── */
const metricsCtrl = require("../controllers/metricasController");
const ctrl =
  typeof metricsCtrl === "function"
    ? metricsCtrl
    : metricsCtrl?.default || metricsCtrl;

if (
  typeof ctrl?.contarVisita !== "function" ||
  typeof ctrl?.getMetricasPublica !== "function"
) {
  console.error("[metricasRoutes] Controller inválido:", metricsCtrl);
  throw new Error("metricasController inválido (exports ausentes)");
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
 * Rate-limit simples por IP (memória)
 * ➜ suficiente para endpoint público leve
 * ➜ se quiser Redis depois, troca fácil
 */
function simpleRateLimit({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const bucket = hits.get(ip) || [];
    const recent = bucket.filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);

    if (recent.length > max) {
      return res.status(429).json({ erro: "Muitas requisições. Tente novamente." });
    }

    return next();
  };
}

/* ────────────────────────────────────────────────
   📊 Rotas públicas de métricas (APP)
   ──────────────────────────────────────────────── */

/**
 * POST /api/metricas/contar-visita
 * - incrementa acessos_app
 * - protegido contra spam básico
 * - sem cache
 */
router.post(
  "/contar-visita",
  routeTag("metricasRoutes:POST /contar-visita"),
  simpleRateLimit({ windowMs: 60_000, max: 60 }), // 60/min por IP
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    return next();
  },
  handle(ctrl.contarVisita)
);

/**
 * GET /api/metricas/publica
 * - retorna métricas públicas (ex.: acessos_app, atualizado_em)
 * - cache curto (frontend/app agradece)
 */
router.get(
  "/publica",
  routeTag("metricasRoutes:GET /publica"),
  (req, res, next) => {
    // cache leve: dados não são críticos em tempo real
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return next();
  },
  handle(ctrl.getMetricasPublica)
);

module.exports = router;
