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

// Admin listagem (existem 2 controllers diferentes no seu legado)
let turmasAdminCtrlA;
try {
  turmasAdminCtrlA = require("../controllers/turmaControllerAdministrador");
} catch {
  turmasAdminCtrlA = null;
}

let turmasAdminCtrlB;
try {
  turmasAdminCtrlB = require("../controllers/administradorturmaController");
} catch {
  turmasAdminCtrlB = null;
}

/* ───────────────── Auth / Authorization ───────────────── */
const requireAuth = require("../auth/authMiddleware");

// authorize.js exporta objeto { authorize, authorizeRoles, ... } (padrão que ajustamos)
const authorizeMod = require("../middlewares/authorize");

// suporte: module.exports = fn  OU  module.exports = { authorizeRoles }  OU  { authorize }
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js (esperado função ou { authorizeRoles })"
  );
}

// ✅ middleware array reutilizável (NÃO espalhar com ... dentro de outra array)
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Helpers premium ───────────────── */
const hasFn = (obj, name) => !!obj && typeof obj[name] === "function";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Se o handler não existir, responde 501 — melhor que 500
function safeHandler(ctrl, fnName, label = "controller") {
  if (hasFn(ctrl, fnName)) return asyncHandler(ctrl[fnName]);
  return (_req, res) =>
    res.status(501).json({
      erro: `Handler não implementado: ${label}.${fnName}`,
    });
}

function pickAdminListHandler() {
  // prioridade: controller específico do painel admin (A), depois o legado B
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

/* ───────────────── No-store para admin ───────────────── */
function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
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
   ✅ ADMIN (dentro do mesmo router)
   Mount sugerido: /api/turma
   → /api/turma/admin
========================================================= */
const admin = express.Router();

// ✅ aqui NÃO usa spread em requireAdmin (ele já é array de middlewares)
admin.use(...requireAdmin, noStore);

// GET /api/turma/admin → lista turmas p/ painel
admin.get("/", adminListLimiter, pickAdminListHandler());

// compat antigos via server.js apontando para este mesmo router
router.use("/admin", admin);

/* =========================================================
   ✅ ROTAS “NORMAIS” (autenticado)
   Tudo aqui exige autenticação
========================================================= */
router.use(requireAuth);

/* -------------------------------
   Admin-only (CRUD e sensíveis)
-------------------------------- */

// ➕ Criar nova turma
router.post("/", ...requireAdmin, safeHandler(turmaController, "criarTurma", "turmaController"));

// ✏️ Editar turma
router.put("/:id(\\d+)", ...requireAdmin, safeHandler(turmaController, "atualizarTurma", "turmaController"));

// 👨‍🏫 Vincular instrutor(es) à turma
router.post(
  "/:id(\\d+)/instrutores",
  ...requireAdmin,
  safeHandler(turmaController, "adicionarInstrutor", "turmaController")
);

// ❌ Excluir turma
router.delete("/:id(\\d+)", ...requireAdmin, safeHandler(turmaController, "excluirTurma", "turmaController"));

// 🧾 Listar turmas com usuários (admin)
router.get(
  "/com-usuario",
  ...requireAdmin,
  safeHandler(turmaController, "listarTurmasComUsuarios", "turmaController")
);
// compat antigo
router.get(
  "/turmas-com-usuarios",
  ...requireAdmin,
  safeHandler(turmaController, "listarTurmasComUsuarios", "turmaController")
);

/* -------------------------------
   Leitura (usuários logados)
-------------------------------- */

// ⚡️ Endpoint leve (sem inscritos) — usado pelo ModalEvento
// Mantém URL antiga para não quebrar o front
router.get(
  "/eventos/:evento_id(\\d+)/turmas-simples",
  safeHandler(turmaController, "obterTurmasPorEvento", "turmaController")
);

// 📋 Listar turmas de um evento (com datas reais, inscritos etc.)
router.get(
  "/evento/:evento_id(\\d+)",
  safeHandler(turmaController, "listarTurmasPorEvento", "turmaController")
);

// 👨‍🏫 Listar instrutor(es) da turma
router.get(
  "/:id(\\d+)/instrutores",
  safeHandler(turmaController, "listarInstrutorDaTurma", "turmaController")
);

// 📅 Datas reais da turma (datas_turma)
router.get(
  "/:id(\\d+)/datas",
  safeHandler(turmaController, "listarDatasDaTurma", "turmaController")
);

// 🔍 Detalhes de uma turma (título do evento + instrutores)
router.get(
  "/:id(\\d+)/detalhes",
  safeHandler(turmaController, "obterDetalhesTurma", "turmaController")
);

// 📋 Listar inscritos de uma turma
router.get(
  "/:turma_id(\\d+)/inscritos",
  asyncHandler(inscricaoController.listarInscritosPorTurma)
);

module.exports = router;
