//src/routes/eventosRoute.js
const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🚧 Rota de teste de autenticação (remover em produção)
router.get('/protegido', authMiddleware, (req, res) => {
  res.json({ mensagem: `Acesso autorizado para o usuário ${req.usuario.cpf}` });
});

/* ===============================
   Eventos visíveis por usuário
   (aplica regra do campo "registro")
   =============================== */
// ✅ Lista apenas eventos que o usuário pode ver (vis_reg_tipo)
router.get('/para-mim/lista', authMiddleware, eventosController.listarEventosParaMim);

// ✅ Checagem rápida de acesso para a página do curso
router.get('/:id/visivel', authMiddleware, eventosController.verificarVisibilidadeEvento);

// ✅ Detalhes do curso condicionados ao acesso
router.get('/:id/detalhes', authMiddleware, eventosController.obterDetalhesEventoComRestricao);

/* ===============================
   Rotas já existentes
   =============================== */

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

// 🔍 Buscar evento por ID (usuário autenticado) — sem aplicar regra de visibilidade
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
