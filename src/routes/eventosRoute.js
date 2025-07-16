const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🚧 Rota de teste de autenticação (remover em produção)
router.get('/protegido', authMiddleware, (req, res) => {
  res.json({ mensagem: `Acesso autorizado para o usuário ${req.usuario.cpf}` });
});

// 📆 Agenda de eventos (usuário autenticado)
router.get('/agenda', authMiddleware, eventosController.getAgendaEventos);

// 🎤 Eventos do instrutor autenticado
router.get('/instrutor', authMiddleware, eventosController.listarEventosDoinstrutor);

// 📋 Listar todos os eventos (usuário autenticado)
router.get('/', authMiddleware, eventosController.listarEventos);

// ➕ Criar novo evento (somente administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.criarEvento
);

// 🔍 Buscar evento por ID (usuário autenticado)
router.get('/:id', authMiddleware, eventosController.buscarEventoPorId);

// ✏️ Atualizar evento (somente administrador)
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.atualizarEvento
);

// ❌ Deletar evento (somente administrador)
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.excluirEvento
);

// 📚 Listar turmas de um evento (usuário autenticado)
router.get('/:id/turmas', authMiddleware, eventosController.listarTurmasDoEvento);

module.exports = router;
