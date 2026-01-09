// 📁 src/routes/instrutorRoutes.js — PREMIUM (robusto, consistente, sem conflito de rotas)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth/roles resilientes ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[instrutorRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[instrutorRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,
} = require("../controllers/instrutorController");

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store");
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

/* ──────────────────────────────────────────────────────────
   🚦 Rotas específicas primeiro (evita conflito com :id)
   ────────────────────────────────────────────────────────── */

// 🔐 Turmas do instrutor autenticado (sem :id)
router.get(
  "/minhas/turmas",
  requireAuth,
  authorizeRoles("instrutor", "administrador"),
  routeTag("instrutorRoutes:GET /minhas/turmas"),
  handle(getMinhasTurmasInstrutor)
);

// 📋 Listar todos os instrutores (apenas admin)
router.get(
  "/",
  requireAuth,
  authorizeRoles("administrador"),
  routeTag("instrutorRoutes:GET /"),
  handle(listarInstrutor)
);

// 📊 Histórico de eventos + avaliações por instrutor (apenas admin)
router.get(
  "/:id/eventos-avaliacoes",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("instrutorRoutes:GET /:id/eventos-avaliacoes"),
  handle(getEventosAvaliacoesPorInstrutor)
);

// 📚 Turmas vinculadas a um instrutor, com dados do evento (apenas admin)
router.get(
  "/:id/turmas",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("instrutorRoutes:GET /:id/turmas"),
  handle(getTurmasComEventoPorInstrutor)
);

module.exports = router;
