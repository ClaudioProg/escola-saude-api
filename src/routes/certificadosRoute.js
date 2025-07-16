const express = require('express');
const router = express.Router();

const certificadosController = require('../controllers/certificadosController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🧾 1. Listar certificados do usuário autenticado
router.get(
  '/usuario',
  authMiddleware,
  certificadosController.listarCertificadosDoUsuario
);

// 📥 2. Baixar certificado em PDF (usuário dono ou administrador)
router.get(
  '/:id/download',
  authMiddleware,
  certificadosController.baixarCertificado
);

// 📄 3. Gerar certificado (somente administrador)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  certificadosController.gerarCertificado
);

router.post("/:id/revalidar", authMiddleware, certificadosController.revalidarCertificado);

module.exports = router;
