// 📁 src/routes/instrutorRoute.js — PREMIUM (robusto, consistente, sem conflito de rotas)
/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[instrutorRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[instrutorRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

/* ───────────────── Controller ───────────────── */
const {
  listarInstrutor,
  getEventosAvaliacaoPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,
} = require("../controllers/instrutorController");

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  try {
    res.set("X-Route-Handler", tag);
  } catch {}
  return next();
};

const noStore = (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
  } catch {}
  return next();
};

const ensureNumericParam = (paramName) => (req, res, next) => {
  const n = Number(req.params?.[paramName]);

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ erro: `${paramName} inválido.` });
  }

  req.params[paramName] = String(n);
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

/* ───────────────── Middlewares do grupo ───────────────── */
router.use(requireAuth);
router.use(noStore);

/* ──────────────────────────────────────────────────────────
   🚦 Rotas específicas primeiro (evita conflito com :id)
────────────────────────────────────────────────────────── */

/**
 * 🔐 Turmas do instrutor autenticado
 * GET /api/instrutor/minhas/turmas?filtro=ativos|encerrados|todos
 */
router.get(
  "/minhas/turmas",
  authorizeRoles("instrutor", "administrador"),
  routeTag("instrutorRoute:GET /minhas/turmas"),
  handle(getMinhasTurmasInstrutor)
);

// aliases internos de compatibilidade, caso algum front use nomes alternativos
router.get(
  "/minhas-turmas",
  authorizeRoles("instrutor", "administrador"),
  routeTag("instrutorRoute:GET /minhas-turmas"),
  handle(getMinhasTurmasInstrutor)
);

router.get(
  "/me/turmas",
  authorizeRoles("instrutor", "administrador"),
  routeTag("instrutorRoute:GET /me/turmas"),
  handle(getMinhasTurmasInstrutor)
);

/* ──────────────────────────────────────────────────────────
   👨‍💼 Admin
────────────────────────────────────────────────────────── */

/**
 * 📋 Listar todos os instrutores
 * GET /api/instrutor
 */
router.get(
  "/",
  authorizeRoles("administrador"),
  routeTag("instrutorRoute:GET /"),
  handle(listarInstrutor)
);

/**
 * 📊 Histórico de eventos + avaliações por instrutor
 * GET /api/instrutor/:id/eventos-avaliacao
 */
router.get(
  "/:id/eventos-avaliacao",
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("instrutorRoute:GET /:id/eventos-avaliacao"),
  handle(getEventosAvaliacaoPorInstrutor)
);

/**
 * 📚 Turmas vinculadas a um instrutor
 * GET /api/instrutor/:id/turmas
 */
router.get(
  "/:id/turmas",
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("instrutorRoute:GET /:id/turmas"),
  handle(getTurmasComEventoPorInstrutor)
);

module.exports = router;