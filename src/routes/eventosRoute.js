// ✅ src/routes/eventosRoute.js
const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventosController');
const turmasController  = require('../controllers/turmasController');
const authMiddleware    = require('../auth/authMiddleware');
const authorizeRoles    = require('../auth/authorizeRoles');

/* ───────────────────────────────────────────────────────────────
   🔐 Rota de teste (remover em produção)
   ─────────────────────────────────────────────────────────────── */
router.get('/protegido', authMiddleware, (req, res) => {
  res.json({ mensagem: `Acesso autorizado para o usuário ${req.user.cpf}` });
});

/* ───────────────────────────────────────────────────────────────
   🎯 Eventos “para mim”
   ─────────────────────────────────────────────────────────────── */
router.get('/para-mim/lista', authMiddleware, eventosController.listarEventosParaMim);

/* ───────────────────────────────────────────────────────────────
   📆 Agenda & visão do instrutor
   ─────────────────────────────────────────────────────────────── */
router.get('/agenda',     authMiddleware, eventosController.getAgendaEventos);
router.get('/instrutor',  authMiddleware, eventosController.listarEventosDoinstrutor);

/* ───────────────────────────────────────────────────────────────
   📌 Datas reais da turma (usa :id = turma_id)
   ─────────────────────────────────────────────────────────────── */
router.get('/turmas/:id/datas', authMiddleware, turmasController.listarDatasDaTurma);

/* ───────────────────────────────────────────────────────────────
   🔎 Auto-complete de cargos (ANTES de '/:id')
   ─────────────────────────────────────────────────────────────── */
router.get('/cargos/sugerir', authMiddleware, eventosController.sugerirCargos);

/* ───────────────────────────────────────────────────────────────
   📅 CRUD principal de eventos
   ─────────────────────────────────────────────────────────────── */
// Listar todos
router.get('/', authMiddleware, eventosController.listarEventos);

// Publicar / Despublicar (admin)
router.post('/:id/publicar',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.publicarEvento
);
router.post('/:id/despublicar',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.despublicarEvento
);

// Turmas por evento (ANTES de '/:id')
router.get('/:id/turmas',         authMiddleware, eventosController.listarTurmasDoEvento);
router.get('/:id/turmas-simples', authMiddleware, eventosController.listarTurmasSimples);

/* ───────────────────────────────────────────────────────────────
   📎 Upload direto de arquivos do evento (admin)
   ─────────────────────────────────────────────────────────────── */
router.post('/:id/folder',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.atualizarArquivosDoEvento
);

router.post('/:id/programacao',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.atualizarArquivosDoEvento
);

// Buscar por ID (com checagens e flags)
router.get('/:id', authMiddleware, eventosController.buscarEventoPorId);

// Criar (admin) — com upload (folder/programacao)
router.post('/',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.criarEvento
);

// Atualizar (admin) — metadados/restrição/turmas, com upload opcional
router.put('/:id',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.atualizarEvento
);

// Excluir (admin)
router.delete('/:id',
  authMiddleware, authorizeRoles('administrador'),
  eventosController.excluirEvento
);

module.exports = router;
