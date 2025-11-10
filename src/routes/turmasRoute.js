// ✅ 📁 src/routes/turmasRoute.js
const express = require("express");
const router = express.Router();

const turmasController = require("../controllers/turmasController");
const inscricoesController = require("../controllers/inscricoesController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* ───────── helpers ───────── */
const hasFn = (obj, name) => !!obj && typeof obj[name] === "function";
const ensureTurmas = (name) =>
  hasFn(turmasController, name)
    ? turmasController[name]
    : (req, res) => res.status(500).json({ erro: `Handler ausente: turmasController.${name}` });

/* ────────────────────────────────
   ➕ Criar nova turma (somente administrador)
   ──────────────────────────────── */
router.post(
  "/",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("criarTurma")
);

/* ────────────────────────────────
   ✏️ Editar turma (somente administrador)
   ──────────────────────────────── */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("atualizarTurma")
);

/* ────────────────────────────────
   👨‍🏫 Vincular instrutor(es) à TURMA (somente administrador)
   ──────────────────────────────── */
router.post(
  "/:id/instrutores",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("adicionarInstrutor")
);

/* ────────────────────────────────
   ❌ Excluir turma (somente administrador)
   ──────────────────────────────── */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("excluirTurma")
);

/* ────────────────────────────────
   📋 Listar turmas de um evento (com datas reais, inscritos etc.)
   ──────────────────────────────── */
router.get(
  "/evento/:evento_id",
  authMiddleware,
  ensureTurmas("listarTurmasPorEvento")
);

/* ────────────────────────────────
   ⚡️ Endpoint leve (sem inscritos) — usado pelo ModalEvento
   ──────────────────────────────── */
router.get(
  "/eventos/:evento_id/turmas-simples",
  authMiddleware,
  ensureTurmas("obterTurmasPorEvento")
);

/* ────────────────────────────────
   👨‍🏫 Listar instrutor(es) da turma
   ──────────────────────────────── */
router.get(
  "/:id/instrutores",
  authMiddleware,
  ensureTurmas("listarInstrutorDaTurma")
);

/* ────────────────────────────────
   📅 Datas reais da turma (datas_turma)
   ──────────────────────────────── */
router.get(
  "/:id/datas",
  authMiddleware,
  ensureTurmas("listarDatasDaTurma")
);

/* ────────────────────────────────
   🔍 Obter detalhes de uma turma (título do evento + instrutores)
   ──────────────────────────────── */
router.get(
  "/:id/detalhes",
  authMiddleware,
  ensureTurmas("obterDetalhesTurma")
);

/* ────────────────────────────────
   📋 Listar inscritos de uma turma
   ──────────────────────────────── */
router.get(
  "/:turma_id/inscritos",
  authMiddleware,
  inscricoesController.listarInscritosPorTurma
);

/* ────────────────────────────────
   🧾 Listar turmas com usuários (admin)
   ──────────────────────────────── */
router.get(
  "/turmas-com-usuarios",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("listarTurmasComUsuarios")
);

module.exports = router;
