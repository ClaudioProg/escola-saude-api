// ✅ 📁 src/routes/turmasRoute.js
const express = require("express");
const router = express.Router();

const turmasController = require("../controllers/turmasController"); // unificado (plural)
const inscricoesController = require("../controllers/inscricoesController");

// eventosController é opcional aqui (só para listarDatasDaTurma)
let eventosController = null;
try {
  eventosController = require("../controllers/eventosController");
} catch (_) {
  eventosController = null;
}

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* ───────── helpers defensivos ───────── */
const hasFn = (obj, name) => !!obj && typeof obj[name] === "function";
const ensureTurmas = (name) =>
  hasFn(turmasController, name)
    ? turmasController[name]
    : (req, res) =>
        res.status(500).json({
          erro: `Handler ausente: turmasController.${name}`,
        });

// listarDatasDaTurma pode não existir no eventosController dependendo do branch
const listarDatasDaTurmaHandler = hasFn(eventosController, "listarDatasDaTurma")
  ? eventosController.listarDatasDaTurma
  : (req, res) =>
      res.status(501).json({
        erro: "listarDatasDaTurma indisponível no eventosController.",
      });

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
  ensureTurmas("atualizarTurma") // nome canônico
);

/* ────────────────────────────────
   👨‍🏫 Vincular instrutor(es) à TURMA (somente administrador)
   ──────────────────────────────── */
router.post(
  "/:id/instrutores",
  authMiddleware,
  authorizeRoles("administrador"),
  ensureTurmas("adicionarInstrutor") // tabela turma_instrutor
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
   Caminho: /api/turmas/eventos/:evento_id/turmas-simples
   ──────────────────────────────── */
router.get(
  "/eventos/:evento_id/turmas-simples",
  authMiddleware,
  ensureTurmas("obterTurmasPorEvento")
);

/* ────────────────────────────────
   📢 Listar turmas atribuídas ao instrutor logado
   ──────────────────────────────── */
router.get(
  "/instrutor",
  authMiddleware,
  authorizeRoles("administrador", "instrutor"),
  ensureTurmas("listarTurmasDoInstrutor")
);

/* ────────────────────────────────
   👨‍🏫 Listar instrutor(es) da turma
   (⚠ manter após rotas mais específicas para não colidir)
   ──────────────────────────────── */
router.get(
  "/:id/instrutores",
  authMiddleware,
  ensureTurmas("listarInstrutorDaTurma")
);

/* ────────────────────────────────
   📅 Datas reais da turma (datas_turma) — via eventosController
   ──────────────────────────────── */
router.get(
  "/:id/datas",
  authMiddleware,
  listarDatasDaTurmaHandler
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
  ensureTurmas("listarTurmasComUsuarios") // nome canônico
);

module.exports = router;
