const express = require('express');
const router = express.Router();

const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');
const presencasController = require('../controllers/presencasController');

// 📌 1. Registro de presença normal com data (usuário autenticado)
router.post(
  '/',
  authMiddleware,
  presencasController.registrarPresenca
);

// 📲 2. Confirmação de presença via QR Code fixo (usuário autenticado)
router.get(
  '/confirmar/:turma_id',
  authMiddleware,
  presencasController.confirmarPresencaViaQR
);

// ✅ 3. Confirmação simples (sem QR, sem data) – autenticado
router.post(
  '/confirmar-simples',
  authMiddleware,
  presencasController.confirmarPresencaSimples
);

// ✍️ 4. Registro manual de presença (administrador ou instrutor)
router.post(
  '/registrar',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  presencasController.registrarManual
);

// 🗓️ 5. Confirmação manual de presença no dia atual (administrador)
router.post(
  '/manual-confirmacao',
  authMiddleware,
  authorizeRoles('administrador'),
  presencasController.confirmarHojeManual
);

// ✅ 6. Validação de presença (administrador ou instrutor)
router.put(
  '/validar',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  presencasController.validarPresenca
);

// 📊 7. Relatório de presenças detalhado por turma (administrador ou instrutor)
router.get(
  '/relatorio-presencas/turma/:turma_id',
  authMiddleware,
  authorizeRoles('administrador', 'instrutor'),
  presencasController.presencasDetalhadasPorTurma
);

// 🟢 8. Confirmação de presença pelo instrutor (prazo: 48h após fim)
router.post(
  '/confirmar-instrutor',
  authMiddleware,
  authorizeRoles('instrutor', 'administrador'), // ✅ permite ambos os perfis
  presencasController.confirmarPresencaInstrutor
);

// 🔍 9. Listar todas as presenças para o administrador
router.get(
  '/admin/listar-tudo',
  authMiddleware,
  authorizeRoles('administrador'),
  presencasController.listarTodasPresencasParaAdmin
);

module.exports = router;
