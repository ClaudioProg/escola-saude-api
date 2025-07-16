const express = require('express');
const router = express.Router();

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');
const inscricoesController = require('../controllers/inscricoesController');

// ➕ Realizar inscrição em uma turma (usuario, instrutor ou administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  inscricoesController.inscreverEmTurma
);

// ❌ Cancelar inscrição (usuário autenticado)
router.delete(
  '/:id',
  authMiddleware,
  inscricoesController.cancelarMinhaInscricao
);

// 👤 Obter minhas inscrições (usuário autenticado)
router.get(
  '/minhas',
  authMiddleware,
  inscricoesController.obterMinhasInscricoes
);

// 📋 Listar inscritos de uma turma (instrutor ou administrador)
router.get(
  '/turma/:turma_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  inscricoesController.listarInscritosPorTurma
);

module.exports = router;
