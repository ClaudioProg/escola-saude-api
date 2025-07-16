const express = require("express");
const router = express.Router();

const { salvarAssinatura, getAssinatura } = require("../controllers/assinaturaController");
const authMiddleware = require("../auth/authMiddleware");

// 🔐 Todas as rotas de assinatura requerem autenticação
router.use(authMiddleware);

// 🖋️ Obter assinatura do usuário autenticado
router.get("/", getAssinatura);

// 🖋️ Salvar/atualizar assinatura
router.post("/", salvarAssinatura);

module.exports = router;
