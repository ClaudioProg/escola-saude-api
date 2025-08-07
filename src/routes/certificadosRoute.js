const express = require('express');
const router = express.Router();

const certificadosController = require('../controllers/certificadosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🧾 1. Listar certificados emitidos do usuário autenticado
router.get(
  '/usuario',
  authMiddleware,
  certificadosController.listarCertificadosDoUsuario
);

// 🆕 2. Listar certificados elegíveis para participante
router.get(
  '/elegiveis',
  authMiddleware,
  certificadosController.listarCertificadosElegiveis
);

// 🆕 3. Listar certificados elegíveis para instrutor
router.get(
  '/elegiveis-instrutor',
  authMiddleware,
  certificadosController.listarCertificadosInstrutorElegiveis
);

// 🖨️ 4. Gerar certificado (participante ou instrutor, autenticado)
router.post(
  '/gerar',
  authMiddleware,
  certificadosController.gerarCertificado
);

// 📥 5. Baixar certificado PDF (rota pública ou autenticada, como preferir)
router.get(
  '/:id/download',
  certificadosController.baixarCertificado // ← sem authMiddleware se quiser permitir acesso público
);

// 🔁 6. Revalidar certificado (usuário autenticado)
router.post(
  '/:id/revalidar',
  authMiddleware,
  certificadosController.revalidarCertificado
);

module.exports = router;
