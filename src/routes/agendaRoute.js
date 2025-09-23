// 📁 src/routes/agendaRoutes.js
const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🗓️ Agenda do usuário autenticado (eventos em que está inscrito)
router.get(
  '/minha',
  authMiddleware,
  authorizeRoles('usuario', 'instrutor', 'administrador'),
  agendaController.buscarAgendaMinha
);

// 📆 Agenda do instrutor autenticado (ou admin)
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  agendaController.buscarAgendaInstrutor
);

// 📅 Agenda geral (somente administrador)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  agendaController.buscarAgenda
);

module.exports = router;
