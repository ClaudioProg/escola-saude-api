const express = require('express');
const router = express.Router();

const administradorTurmasController = require('../controllers/administradorTurmasController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🧭 Lista todas as turmas com detalhes (apenas para administradores)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  administradorTurmasController.listarTurmasadministrador
);

module.exports = router;
