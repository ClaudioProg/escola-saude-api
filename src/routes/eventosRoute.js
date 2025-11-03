// ✅ src/routes/eventosRoute.js
const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

/* ===============================
   🔐 Rota de teste de autenticação (remover em produção)
   =============================== */
router.get('/protegido', authMiddleware, (req, res) => {
  res.json({ mensagem: `Acesso autorizado para o usuário ${req.user.cpf}` });
});

/* ===============================
   🎯 Eventos visíveis por usuário
   (aplica regra do campo "registro")
   =============================== */
// ✅ Lista apenas eventos que o usuário pode ver
router.get('/para-mim/lista', authMiddleware, eventosController.listarEventosParaMim);

// ✅ Checagem rápida de acesso para a página do curso
router.get('/:id/visivel', authMiddleware, eventosController.verificarVisibilidadeEvento);

// ✅ Detalhes do curso condicionados ao acesso
router.get('/:id/detalhes', authMiddleware, eventosController.obterDetalhesEventoComRestricao);

/* ===============================
   🚀 Publicação / Despublicação
   =============================== */
router.post(
  '/:id/publicar',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.publicarEvento
);

router.post(
  '/:id/despublicar',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.despublicarEvento
);

/* ===============================
   📅 Rotas principais
   =============================== */

// 📆 Agenda de eventos (usuário autenticado)
router.get('/agenda', authMiddleware, eventosController.getAgendaEventos);

// 🎤 Eventos do instrutor autenticado
router.get('/instrutor', authMiddleware, eventosController.listarEventosDoinstrutor);

// 📋 Listar todos os eventos (usuário autenticado)
router.get('/', authMiddleware, eventosController.listarEventos);

// 🔍 Buscar evento por ID (usuário autenticado)
router.get('/:id', authMiddleware, eventosController.buscarEventoPorId);

// 📚 Listar turmas completas de um evento
router.get('/:id/turmas', authMiddleware, eventosController.listarTurmasDoEvento);

// 📋 Listar turmas simples (usado no frontend de inscrições)
router.get('/:id/turmas-simples', authMiddleware, eventosController.listarTurmasSimples);

/* ===============================
   ✏️ Operações administrativas
   =============================== */

// ➕ Criar novo evento
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.criarEvento
);

// ✏️ Atualizar evento
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.atualizarEvento
);

// ❌ Deletar evento
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.excluirEvento
);

module.exports = router;
