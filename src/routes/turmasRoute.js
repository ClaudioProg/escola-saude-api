// ✅ 📁 src/routes/turmasRoute.js
"use strict";

const express = require("express");
const router = express.Router();

const turmasController = require("../controllers/turmasController");
const inscricoesController = require("../controllers/inscricoesController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* ──────────────────────────────────────────────────────────────
   Helpers premium
────────────────────────────────────────────────────────────── */
const hasFn = (obj, name) => !!obj && typeof obj[name] === "function";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Se o handler não existir, responde 501 (não implementado) — mais correto que 500
function safeHandler(ctrl, fnName) {
  if (hasFn(ctrl, fnName)) return asyncHandler(ctrl[fnName]);
  return (_req, res) =>
    res.status(501).json({
      erro: `Handler não implementado: turmasController.${fnName}`,
    });
}

// Middlewares reutilizáveis
const requireAuth = authMiddleware;
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ──────────────────────────────────────────────────────────────
   Todas as rotas aqui exigem autenticação
────────────────────────────────────────────────────────────── */
router.use(requireAuth);

/* ──────────────────────────────────────────────────────────────
   Admin-only (CRUD e operações sensíveis)
────────────────────────────────────────────────────────────── */

// ➕ Criar nova turma
router.post("/", requireAdmin, safeHandler(turmasController, "criarTurma"));

// ✏️ Editar turma
router.put("/:id(\\d+)", requireAdmin, safeHandler(turmasController, "atualizarTurma"));

// 👨‍🏫 Vincular instrutor(es) à turma
router.post("/:id(\\d+)/instrutores", requireAdmin, safeHandler(turmasController, "adicionarInstrutor"));

// ❌ Excluir turma
router.delete("/:id(\\d+)", requireAdmin, safeHandler(turmasController, "excluirTurma"));

// 🧾 Listar turmas com usuários (admin)
router.get(
  "/turmas-com-usuarios",
  requireAdmin,
  safeHandler(turmasController, "listarTurmasComUsuarios")
);

/* ──────────────────────────────────────────────────────────────
   Leitura (usuários logados)
────────────────────────────────────────────────────────────── */

// ⚡️ Endpoint leve (sem inscritos) — usado pelo ModalEvento
// Obs: mantenho a tua URL para não quebrar o front
router.get(
  "/eventos/:evento_id(\\d+)/turmas-simples",
  safeHandler(turmasController, "obterTurmasPorEvento")
);

// 📋 Listar turmas de um evento (com datas reais, inscritos etc.)
router.get(
  "/evento/:evento_id(\\d+)",
  safeHandler(turmasController, "listarTurmasPorEvento")
);

// 👨‍🏫 Listar instrutor(es) da turma
router.get(
  "/:id(\\d+)/instrutores",
  safeHandler(turmasController, "listarInstrutorDaTurma")
);

// 📅 Datas reais da turma (datas_turma)
router.get(
  "/:id(\\d+)/datas",
  safeHandler(turmasController, "listarDatasDaTurma")
);

// 🔍 Detalhes de uma turma (título do evento + instrutores)
router.get(
  "/:id(\\d+)/detalhes",
  safeHandler(turmasController, "obterDetalhesTurma")
);

// 📋 Listar inscritos de uma turma
router.get(
  "/:turma_id(\\d+)/inscritos",
  asyncHandler(inscricoesController.listarInscritosPorTurma)
);

module.exports = router;
