const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const ctrl = require("../controllers/assinaturaController");

// 🔐 todas as rotas exigem autenticação
router.use(authMiddleware);

/**
 * ✍️ Salvar ou atualizar assinatura do usuário autenticado
 * POST /api/assinatura
 */
router.post("/", ctrl.salvarAssinatura);

/**
 * 🖋️ Obter assinatura do usuário autenticado
 * GET /api/assinatura
 */
router.get("/", ctrl.getAssinatura);

/**
 * 📜 Listar assinaturas cadastradas (para o dropdown de 2ª assinatura)
 * GET /api/assinatura/lista  ✅ caminho usado no frontend
 * GET /api/assinaturas       🔁 alias (compatibilidade)
 */
router.get("/lista", ctrl.listarAssinaturas);
router.get("/todas", ctrl.listarAssinaturas); // opcional, mantém tua versão antiga também

module.exports = router;
