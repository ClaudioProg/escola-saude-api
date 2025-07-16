const express = require('express');
const router = express.Router();
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');
const relatorioPresencasController = require('../controllers/relatorioPresencasController');

// 📄 Relatório de presenças por turma (administrador ou instrutor)
router.get(
  '/turma/:turma_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  relatorioPresencasController.porTurma
);

// 📄 Relatório detalhado de presenças por turma (administrador ou instrutor)
router.get(
  '/turma/:turma_id/detalhado',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  relatorioPresencasController.porTurmaDetalhado
);

// 📄 Relatório de presenças por evento (somente administrador)
router.get(
  '/evento/:evento_id',
  authMiddleware,
  authorizeRoles('administrador'),
  relatorioPresencasController.porEvento
);

module.exports = router;
