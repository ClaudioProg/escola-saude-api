// 📁 src/routes/certificadosRoute.js
const express = require('express');
const router = express.Router();

const certificadosController = require('../controllers/certificadosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

/* ───────────────── Middlewares anti-IDOR ───────────────── */

/** Permite admin; demais perfis só se req.body.usuario_id === id do token */
function ensureBodySelfOrAdmin(req, res, next) {
  const user = req.user ?? req.usuario ?? {};
  const tokenId = Number(user.id);

  const perfis = Array.isArray(user.perfil)
    ? user.perfil.map(String)
    : String(user.perfil || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

  const isAdmin = perfis.includes('administrador');

  const bodyId = Number(req.body?.usuario_id);
  if (!Number.isFinite(bodyId)) {
    return res
      .status(400)
      .json({ erro: "Body inválido: 'usuario_id' numérico é obrigatório." });
  }
  if (isAdmin || bodyId === tokenId) return next();
  return res.status(403).json({ erro: 'Acesso negado.' });
}

/** Permite admin; demais perfis só se o certificado pertence ao token */
async function ensureCertOwnerOrAdmin(req, res, next) {
  try {
    const user = req.user ?? req.usuario ?? {};
    const tokenId = Number(user.id);

    const perfis = Array.isArray(user.perfil)
      ? user.perfil.map(String)
      : String(user.perfil || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    const isAdmin = perfis.includes('administrador');

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ erro: 'ID de certificado inválido.' });
    }
    if (isAdmin) return next();

    // Checa dono do certificado
    const db = require('../db');
    const q = await db.query(
      'SELECT 1 FROM certificados WHERE id = $1 AND usuario_id = $2 LIMIT 1',
      [id, tokenId]
    );
    if (q.rowCount > 0) return next();
    return res.status(403).json({ erro: 'Acesso negado ao certificado.' });
  } catch (e) {
    console.error('ensureCertOwnerOrAdmin:', e);
    return res.status(500).json({ erro: 'Erro de autorização.' });
  }
}

/* Helper: exige perfil administrador */
const requireAdmin = [authMiddleware, authorizeRoles('administrador')];

/* ───────────────── Rotas ───────────────── */

// 🧾 1) Listar certificados emitidos do usuário autenticado
router.get(
  '/usuario',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  certificadosController.listarCertificadosDoUsuario
);

// 🆕 2) Listar certificados elegíveis para participante (do próprio usuário)
router.get(
  '/elegiveis',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  certificadosController.listarCertificadosElegiveis
);

// 🆕 3) Listar certificados elegíveis para instrutor (do próprio usuário)
//    ✅ agora permite 'administrador' OU 'instrutor'
router.get(
  '/elegiveis-instrutor',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  certificadosController.listarCertificadosInstrutorElegiveis
);

// 🖨️ 4) Gerar certificado (participante ou instrutor)
//      Requer: auth + (admin ou o próprio usuario_id no body)
router.post(
  '/gerar',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  ensureBodySelfOrAdmin,
  certificadosController.gerarCertificado
);

// 📥 5) Baixar certificado PDF
// 👉 Opção B (recomendada): proteger com dono/admin.
// router.get('/:id/download',
//   authMiddleware,
//   authorizeRoles('administrador', 'instrutor', 'usuario'),
//   ensureCertOwnerOrAdmin,
//   certificadosController.baixarCertificado
// );

// Mantendo a rota pública (como você usa hoje).
// Se optar por deixá-la pública, prefira IDs opacos (UUID) no futuro.
router.get('/:id/download', certificadosController.baixarCertificado);

// 🔁 6) Revalidar certificado (dono ou admin)
router.post(
  '/:id/revalidar',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor', 'usuario'),
  ensureCertOwnerOrAdmin,
  certificadosController.revalidarCertificado
);

/* ───────────────── Admin: Reset por Turma ─────────────────
   Se montado em /api/certificados:
   POST /api/certificados/admin/turmas/:turmaId/reset
---------------------------------------------------------------- */
router.post(
  '/admin/turmas/:turmaId/reset',
  requireAdmin,
  certificadosController.resetTurma
);

module.exports = router;
