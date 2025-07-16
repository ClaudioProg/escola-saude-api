const express = require('express');
const router = express.Router();

const turmaController = require('../controllers/turmaController');
const inscricoesController = require('../controllers/inscricoesController');

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// ➕ Criar nova turma (somente administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.criarTurma
);

// ✏️ Editar turma (somente administrador)
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.editarTurma
);

// ❌ Excluir turma (somente administrador)
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.excluirTurma
);

// 📋 Listar turmas de um evento (usuário autenticado)
router.get(
  '/evento/:evento_id',
  authMiddleware,
  turmaController.listarTurmasPorEvento
);

// 📢 Listar turmas atribuídas ao instrutor ou administrador
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  turmaController.listarTurmasDoinstrutor
);

// 🔍 Obter detalhes de uma turma (usuário autenticado)
router.get(
  '/:id/detalhes',
  authMiddleware,
  turmaController.obterDetalhesTurma
);

// 📋 Listar inscritos de uma turma específica (usuário autenticado)
router.get(
  '/:turma_id/inscritos',
  authMiddleware,
  inscricoesController.listarInscritosPorTurma
);

// 🧾 Listar turmas com usuarios (somente administrador)
router.get(
  '/turmas-com-usuarios',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.listarTurmasComusuarios
);

module.exports = router;
