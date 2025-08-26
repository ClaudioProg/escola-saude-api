const express = require('express');
const router = express.Router();

const turmasControlleradministrador = require('../controllers/turmasControlleradministrador');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🧭 Lista todas as turmas com detalhes (apenas para administradores)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  turmasControlleradministrador.listarTurmasadministrador
);

module.exports = router;
