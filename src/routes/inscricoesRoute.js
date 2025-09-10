//src/routes/incricoesRoute.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');
const inscricoesController = require('../controllers/inscricoesController');

// 🔗 serviços/DB para validar acesso por registro
const db = require('../db');
const { podeVerEvento } = require('../services/eventoAcessoRegistroService');

/**
 * 🛡️ Middleware: checa se o usuário pode se inscrever na turma informada,
 * validando a regra de visibilidade por registro do evento da turma.
 */
async function checarAcessoPorRegistroNaTurma(req, res, next) {
  try {
    const turmaId =
      req.body?.turma_id ||
      req.body?.turmaId ||
      req.params?.turma_id ||
      req.query?.turma_id;

    if (!turmaId) {
      return res.status(400).json({ ok: false, erro: 'TURMA_ID_OBRIGATORIO' });
    }

    const { rows } = await db.query(
      'SELECT id, evento_id FROM turmas WHERE id = $1',
      [turmaId]
    );
    const turma = rows[0];
    if (!turma) {
      return res.status(400).json({ ok: false, erro: 'TURMA_INVALIDA' });
    }

    const acesso = await podeVerEvento({
      usuarioId: req.usuario.id,
      eventoId: turma.evento_id,
    });

    if (!acesso.ok) {
      // Motivos esperados: 'SEM_REGISTRO' | 'REGISTRO_NAO_AUTORIZADO' | ...
      return res.status(403).json({ ok: false, motivo: acesso.motivo });
    }

    return next();
  } catch (e) {
    console.error('ERRO checarAcessoPorRegistroNaTurma:', e);
    return res.status(500).json({ ok: false, erro: 'ERRO_INTERNO' });
  }
}

// ➕ Realizar inscrição em uma turma (usuario, instrutor ou administrador)
//    ✅ Aplica validação de visibilidade por registro antes de inscrever.
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  checarAcessoPorRegistroNaTurma,
  inscricoesController.inscreverEmTurma
);

// ❌ Cancelar inscrição (usuário autenticado)
router.delete(
  '/:id',
  authMiddleware,
  inscricoesController.cancelarMinhaInscricao
);

// 👤 Obter minhas inscrições (usuário autenticado)
router.get(
  '/minhas',
  authMiddleware,
  inscricoesController.obterMinhasInscricoes
);

// 📋 Listar inscritos de uma turma (instrutor ou administrador)
router.get(
  '/turma/:turma_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  inscricoesController.listarInscritosPorTurma
);

module.exports = router;
