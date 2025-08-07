const express = require('express');
const router = express.Router();

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');
const avaliacoesController = require('../controllers/avaliacoesController');

// 📝 1. Enviar avaliação (usuario, instrutor ou administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  avaliacoesController.enviarAvaliacao
);

// 📊 2. Listar avaliações por turma (instrutor ou administrador)
router.get(
  '/turma/:turma_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  avaliacoesController.avaliacoesPorTurma
);

// 🧾 3. Listar avaliações por evento (apenas administrador)
router.get(
  '/evento/:evento_id',
  authMiddleware,
  authorizeRoles('administrador'),
  avaliacoesController.avaliacoesPorEvento
);

// 📋 4. Listar avaliações pendentes para o próprio usuário
router.get(
  '/disponiveis/:usuario_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  avaliacoesController.listarAvaliacoesDisponiveis
);

module.exports = router;
