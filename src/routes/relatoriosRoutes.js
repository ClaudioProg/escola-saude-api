const express = require("express");
const router = express.Router();
const {
  gerarRelatorios,
  exportarRelatorios,
  opcoesRelatorios
} = require("../controllers/relatoriosController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

router.get("/", authMiddleware, authorizeRoles("administrador"), gerarRelatorios);
router.post("/exportar", authMiddleware, authorizeRoles("administrador"), exportarRelatorios);
// NOVO: opções de filtros
router.get("/opcoes", authMiddleware, authorizeRoles("administrador"), opcoesRelatorios);

module.exports = router;