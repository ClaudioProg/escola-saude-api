"use strict";

/**
 * ✅ src/routes/turmaRoute.js — PREMIUM/UNIFICADO (singular + compat)
 * - Admin router: /admin
 * - Rotas normais: autenticadas
 * - Compat com controllers legados de admin
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* ───────────────── Controllers ───────────────── */
const turmaController = require("../controllers/turmaController");
const inscricaoController = require("../controllers/inscricaoController");

// Admin listagem (existem 2 controllers diferentes no legado)
let turmasAdminCtrlA = null;
try {
  turmasAdminCtrlA = require("../controllers/turmaControllerAdministrador");
} catch {
  turmasAdminCtrlA = null;
}

let turmasAdminCtrlB = null;
try {
  turmasAdminCtrlB = require("../controllers/administradorturmaController");
} catch {
  turmasAdminCtrlB = null;
}

/* ───────────────── Auth / Authorization resilientes ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.protect || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[turmaRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize ||
  authorizeMod?.default;

if (typeof authorizeRoles !== "function") {
  console.error("[turmaRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js (esperado função ou { authorizeRoles })"
  );
}

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Helpers premium ───────────────── */
function hasFn(obj, name) {
  return !!obj && typeof obj[name] === "function";
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function routeTag(tag, cacheControl = "no-store") {
  return (_req, res, next) => {
    try {
      res.setHeader("X-Route-Handler", tag);
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      if (cacheControl === "no-store") res.setHeader("Pragma", "no-cache");
    } catch {}
    return next();
  };
}

function safeHandler(ctrl, fnName, label = "controller") {
  if (hasFn(ctrl, fnName)) return asyncHandler(ctrl[fnName]);

  return (_req, res) =>
    res.status(501).json({
      erro: `Handler não implementado: ${label}.${fnName}`,
    });
}

function pickAdminListHandler() {
  if (hasFn(turmasAdminCtrlA, "listarTurmasAdministrador")) {
    return asyncHandler(turmasAdminCtrlA.listarTurmasAdministrador);
  }

  if (hasFn(turmasAdminCtrlB, "listarTurmasadministrador")) {
    return asyncHandler(turmasAdminCtrlB.listarTurmasadministrador);
  }

  return (_req, res) =>
    res.status(501).json({
      erro: "Handler não implementado: listarTurmasAdministrador (admin list).",
    });
}

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ erro: `${paramName} inválido.` });
    }

    req.params[paramName] = String(n);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* ───────────────── Rate limit (admin list) ───────────────── */
const adminListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* =========================================================
   ✅ ADMIN
   Mount sugerido: /api/turma
   → /api/turma/admin
========================================================= */
const admin = express.Router();

admin.use(...requireAdmin, noStore);

// GET /api/turma/admin
admin.get(
  "/",
  routeTag("turmaRoute:GET /admin"),
  adminListLimiter,
  pickAdminListHandler()
);

router.use("/admin", admin);

/* =========================================================
   ✅ ROTAS “NORMAIS” (autenticado)
========================================================= */
router.use(requireAuth);
router.use(noStore);

/* -------------------------------
   Admin-only (CRUD e sensíveis)
-------------------------------- */

// ➕ Criar nova turma
router.post(
  "/",
  ...requireAdmin,
  routeTag("turmaRoute:POST /"),
  safeHandler(turmaController, "criarTurma", "turmaController")
);

// ✏️ Editar turma
router.put(
  "/:id(\\d+)",
  ...requireAdmin,
  ensureNumericParam("id"),
  routeTag("turmaRoute:PUT /:id"),
  safeHandler(turmaController, "atualizarTurma", "turmaController")
);

// 👨‍🏫 Vincular instrutor(es) à turma
router.post(
  "/:id(\\d+)/instrutores",
  ...requireAdmin,
  ensureNumericParam("id"),
  routeTag("turmaRoute:POST /:id/instrutores"),
  safeHandler(turmaController, "adicionarInstrutor", "turmaController")
);

// ❌ Excluir turma
router.delete(
  "/:id(\\d+)",
  ...requireAdmin,
  ensureNumericParam("id"),
  routeTag("turmaRoute:DELETE /:id"),
  safeHandler(turmaController, "excluirTurma", "turmaController")
);

// 🧾 Listar turmas com usuários (admin)
router.get(
  "/com-usuario",
  ...requireAdmin,
  routeTag("turmaRoute:GET /com-usuario"),
  safeHandler(turmaController, "listarTurmasComUsuarios", "turmaController")
);

// compat antigo
router.get(
  "/turmas-com-usuarios",
  ...requireAdmin,
  routeTag("turmaRoute:GET /turmas-com-usuarios"),
  safeHandler(turmaController, "listarTurmasComUsuarios", "turmaController")
);

/* -------------------------------
   Leitura (usuários logados)
-------------------------------- */

// ⚡ Endpoint leve (sem inscritos) — usado pelo ModalEvento
router.get(
  "/eventos/:evento_id(\\d+)/turmas-simples",
  ensureNumericParam("evento_id"),
  routeTag("turmaRoute:GET /eventos/:evento_id/turmas-simples"),
  safeHandler(turmaController, "obterTurmasPorEvento", "turmaController")
);

// 📋 Listar turmas de um evento
router.get(
  "/evento/:evento_id(\\d+)",
  ensureNumericParam("evento_id"),
  routeTag("turmaRoute:GET /evento/:evento_id"),
  safeHandler(turmaController, "listarTurmasPorEvento", "turmaController")
);

// 👨‍🏫 Listar instrutor(es) da turma
router.get(
  "/:id(\\d+)/instrutores",
  ensureNumericParam("id"),
  routeTag("turmaRoute:GET /:id/instrutores"),
  safeHandler(turmaController, "listarInstrutorDaTurma", "turmaController")
);

// 📅 Datas reais da turma
router.get(
  "/:id(\\d+)/datas",
  ensureNumericParam("id"),
  routeTag("turmaRoute:GET /:id/datas"),
  safeHandler(turmaController, "listarDatasDaTurma", "turmaController")
);

// 🔍 Detalhes de uma turma
router.get(
  "/:id(\\d+)/detalhes",
  ensureNumericParam("id"),
  routeTag("turmaRoute:GET /:id/detalhes"),
  safeHandler(turmaController, "obterDetalhesTurma", "turmaController")
);

// 📋 Listar inscritos de uma turma
router.get(
  "/:turma_id(\\d+)/inscritos",
  ensureNumericParam("turma_id"),
  routeTag("turmaRoute:GET /:turma_id/inscritos"),
  asyncHandler(inscricaoController.listarInscritosPorTurma)
);

module.exports = router;