// 📁 src/routes/agendaRoutes.js
const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🗓️ Agenda do usuário autenticado (inscrito como aluno)
router.get(
  '/minha',
  authMiddleware,
  authorizeRoles('usuario', 'instrutor', 'administrador'),
  agendaController.buscarAgendaMinha
);

// 👩‍🏫 Agenda do instrutor autenticado (novo endpoint usado pelo front)
router.get(
  '/minha-instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  agendaController.buscarAgendaMinhaInstrutor
);

// (alias opcional p/ compatibilidade: /api/agenda/instrutor)
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  agendaController.buscarAgendaMinhaInstrutor
);

// 📅 Agenda geral (somente administrador)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  agendaController.buscarAgenda
);

module.exports = router;
