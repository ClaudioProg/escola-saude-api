// ✅ src/routes/eventosRoute.js
const express = require('express');
const router = express.Router();

const eventosController = require('../controllers/eventosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// ───────────────────────────────────────────────────────────────
// 🔐 Rota de teste (remover em produção)
router.get('/protegido', authMiddleware, (req, res) => {
  res.json({ mensagem: `Acesso autorizado para o usuário ${req.user.cpf}` });
});

// ───────────────────────────────────────────────────────────────
// 🎯 Eventos “para mim” (aplica regra de visibilidade do controller)
router.get('/para-mim/lista', authMiddleware, eventosController.listarEventosParaMim);

// ───────────────────────────────────────────────────────────────
// 📆 Agenda & visão do instrutor
router.get('/agenda', authMiddleware, eventosController.getAgendaEventos);
router.get('/instrutor', authMiddleware, eventosController.listarEventosDoinstrutor);

// ───────────────────────────────────────────────────────────────
// 📌 Utilitário: datas reais da turma (usa :id = turma_id)
router.get('/turmas/:id/datas', authMiddleware, eventosController.listarDatasDaTurma);

// ───────────────────────────────────────────────────────────────
// 🔎 Auto-complete de cargos (deve vir ANTES de '/:id')
router.get('/cargos/sugerir', authMiddleware, eventosController.sugerirCargos);

// ───────────────────────────────────────────────────────────────
// 📅 CRUD principal de eventos

// Listar todos (resumo + compat fallback)
router.get('/', authMiddleware, eventosController.listarEventos);

// Publicar / Despublicar (admin)
router.post('/:id/publicar',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.publicarEvento
);
router.post('/:id/despublicar',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.despublicarEvento
);

// Turmas por evento (precisam estar ANTES de '/:id' isolado)
router.get('/:id/turmas', authMiddleware, eventosController.listarTurmasDoEvento);
router.get('/:id/turmas-simples', authMiddleware, eventosController.listarTurmasSimples);

// 🔽🔽🔽 NOVAS ROTAS DE UPLOAD DIRETO DE ARQUIVOS 🔽🔽🔽
// Observação: usamos o mesmo middleware de upload (folder/programacao)
// e reaproveitamos o atualizarEvento, que só atualizará os campos enviados.

// Upload de banner (folder.png/jpg/jpeg)
router.post('/:id/folder',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.uploadEventos, // aceita 'folder' e/ou 'programacao'
  (req, res) => eventosController.atualizarEvento(req, res)
);

// Upload de programação (programacao.pdf)
router.post('/:id/programacao',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.uploadEventos,
  (req, res) => eventosController.atualizarEvento(req, res)
);
// 🔼🔼🔼 FIM DAS NOVAS ROTAS 🔼🔼🔼

// Buscar por ID (com checagens e flags)
router.get('/:id', authMiddleware, eventosController.buscarEventoPorId);

// Criar (admin) — com upload (folder.png/jpg e programacao.pdf)
router.post('/',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.criarEvento
);

// Atualizar (admin) — metadados, restrição e turmas, com upload
router.put('/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.uploadEventos,
  eventosController.atualizarEvento
);

// Excluir (admin)
router.delete('/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.excluirEvento
);

router.post('/:id/folder',
  authMiddleware,
  authorizeRoles('administrador'),
  eventosController.uploadEventos,          // middleware do multer que você já tem
  eventosController.atualizarArquivosDoEvento // novo handler (abaixo)
);

module.exports = router;
