// 📁 src/routes/turmasRoute.js
const express = require('express');
const router = express.Router();

const turmaController = require('../controllers/turmaController');
const inscricoesController = require('../controllers/inscricoesController');
const { listarTurmasDoEvento } = require('../controllers/eventosController');

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

/** Bridge: adapta :evento_id → :id para o handler do eventosController */
const listarTurmasPorEventoBridge = (req, res) => {
  req.params.id = req.params.evento_id || req.params.id; // normaliza
  return listarTurmasDoEvento(req, res);
};

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
//    Usa o handler do eventosController que já inclui `inscritos`
router.get(
  '/evento/:evento_id',
  authMiddleware,
  listarTurmasPorEventoBridge
);

// Alias opcional compatível com o front (se usado em algum lugar)
router.get(
  '/por-evento/:id',
  authMiddleware,
  listarTurmasDoEvento
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
