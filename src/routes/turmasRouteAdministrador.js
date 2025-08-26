const express = require('express');
const router = express.Router();

const turmasControllerAdministrador = require('../controllers/turmasControllerAdministrador');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🧭 Lista todas as turmas com detalhes (apenas para administradores)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  turmasControllerAdministrador.listarTurmasadministrador
);

module.exports = router;
