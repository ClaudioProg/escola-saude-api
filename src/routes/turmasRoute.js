// 📁 src/routes/turmasRoute.js
const express = require('express');
const router = express.Router();

const turmaController = require('../controllers/turmasController'); // <- plural ✔
const inscricoesController = require('../controllers/inscricoesController');
const eventosController = require('../controllers/eventosController'); // usar listarDatasDaTurma

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// ➕ Criar nova turma (somente administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.criarTurma
);

// ✏️ Editar turma (somente administrador) — usa alias editarTurma
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.editarTurma // alias de atualizarTurma
);

// ❌ Excluir turma (somente administrador)
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.excluirTurma
);

// 📋 Listar turmas de um evento (usuário autenticado)
//    Usa o handler do próprio turmasController
router.get(
  '/evento/:evento_id',
  authMiddleware,
  (req, res) => {
    // normaliza o param para o controller (ele espera req.params.evento_id)
    return turmaController.listarTurmasPorEvento(req, res);
  }
);

// 📢 Listar turmas atribuídas ao instrutor ou administrador
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  turmaController.listarTurmasDoinstrutor // alias OK
);

// 👨‍🏫 Listar instrutor(es) da turma
router.get(
  '/:id/instrutores',
  authMiddleware,
  turmaController.listarInstrutorDaTurma
);

// 📅 Datas reais da turma (datas_turma/presenças/intervalo)
//   via=datas      -> lê datas_turma (preferencial)
//   via=presencas  -> fallback por presenças (data ou data_presenca)
//   via=intervalo  -> gera 1 dia a 1 dia entre data_inicio e data_fim
router.get(
  '/:id/datas',
  authMiddleware,
  eventosController.listarDatasDaTurma
);

// 🔍 Obter detalhes de uma turma
router.get(
  '/:id/detalhes',
  authMiddleware,
  turmaController.obterDetalhesTurma
);

// 📋 Listar inscritos de uma turma específica
router.get(
  '/:turma_id/inscritos',
  authMiddleware,
  inscricoesController.listarInscritosPorTurma
);

// 🧾 Listar turmas com usuarios (somente administrador)
router.get(
  '/turmas-com-usuarios',
  authMiddleware,
  authorizeRoles('administrador'),
  turmaController.listarTurmasComusuarios // alias OK
);

module.exports = router;
