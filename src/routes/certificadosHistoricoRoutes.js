const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const {
  listarHistoricoCertificados,
  revalidarCertificado,
} = require("../controllers/certificadoshistoController");

// 🧾 Histórico de certificados (administrador ou usuário autenticado)
router.get("/", authMiddleware, listarHistoricoCertificados);

// 🔄 Revalidar certificado (autenticado)
router.post("/revalidar/:id", authMiddleware, revalidarCertificado);

module.exports = router;
