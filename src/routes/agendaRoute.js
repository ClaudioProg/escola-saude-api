const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 📆 Listar agenda do instrutor autenticado ou administrador
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  agendaController.buscarAgendaInstrutor
);

// 📅 Listar agenda geral (modo administrador)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  agendaController.buscarAgenda
);

module.exports = router;
