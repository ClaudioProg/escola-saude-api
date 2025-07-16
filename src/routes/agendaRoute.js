const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 📆 Listar agenda do instrutor autenticado ou administradoristrador
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  agendaController.buscarAgendaInstrutor // ✅ Correção aqui
);

module.exports = router;
