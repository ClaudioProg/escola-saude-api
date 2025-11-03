// ✅ 📁 src/routes/turmasRoute.js
const express = require('express');
const router = express.Router();

const turmaController = require('../controllers/turmasController'); // <- plural ✔
const inscricoesController = require('../controllers/inscricoesController');
const eventosController = require('../controllers/eventosController'); // usar listarDatasDaTurma

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

/* ────────────────────────────────
   ➕ Criar nova turma (somente administrador)
   ──────────────────────────────── */
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.criarTurma
);

/* ────────────────────────────────
   ✏️ Editar turma (somente administrador)
   ──────────────────────────────── */
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.editarTurma // alias de atualizarTurma
);

/* ────────────────────────────────
   ❌ Excluir turma (somente administrador)
   ──────────────────────────────── */
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.excluirTurma
);

/* ────────────────────────────────
   📋 Listar turmas de um evento (usuário autenticado)
   ──────────────────────────────── */
router.get(
  '/evento/:evento_id',
  authMiddleware,
  (req, res) => turmaController.listarTurmasPorEvento(req, res)
);

/* ────────────────────────────────
   ⚡️ Endpoint leve (sem inscritos) — usado pelo ModalEvento
   Caminho final: /api/turmas/eventos/:evento_id/turmas-simples
   ──────────────────────────────── */
router.get(
  '/eventos/:evento_id/turmas-simples',
  authMiddleware,
  (req, res) => turmaController.obterTurmasPorEvento(req, res)
);

/* ────────────────────────────────
   📢 Listar turmas atribuídas ao instrutor
   ──────────────────────────────── */
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  turmaController.listarTurmasDoinstrutor // alias OK
);

/* ────────────────────────────────
   👨‍🏫 Listar instrutor(es) da turma
   (⚠️ manter após as rotas mais específicas para não colidir)
   ──────────────────────────────── */
router.get(
  '/:id/instrutores',
  authMiddleware,
  turmaController.listarInstrutorDaTurma
);

/* ────────────────────────────────
   📅 Datas reais da turma
   ──────────────────────────────── */
router.get(
  '/:id/datas',
  authMiddleware,
  eventosController.listarDatasDaTurma
);

/* ────────────────────────────────
   🔍 Obter detalhes de uma turma
   ──────────────────────────────── */
router.get(
  '/:id/detalhes',
  authMiddleware,
  turmaController.obterDetalhesTurma
);

/* ────────────────────────────────
   📋 Listar inscritos de uma turma
   ──────────────────────────────── */
router.get(
  '/:turma_id/inscritos',
  authMiddleware,
  inscricoesController.listarInscritosPorTurma
);

/* ────────────────────────────────
   🧾 Listar turmas com usuários (admin)
   ──────────────────────────────── */
router.get(
  '/turmas-com-usuarios',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.listarTurmasComusuarios // alias OK
);

module.exports = router;
