// ✅ src/routes/assinaturaRoutes.js
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/assinaturaController");

// 🔐 todas as rotas exigem autenticação
router.use(requireAuth);

/**
 * 🖋️ Obter assinatura do usuário autenticado
 * GET /api/assinatura
 */
router.get("/", ctrl.getAssinatura);

/**
 * ✍️ Salvar/atualizar assinatura do usuário autenticado
 * POST /api/assinatura
 */
router.post("/", ctrl.salvarAssinatura);

/**
 * 📜 Listar assinaturas cadastradas (metadados para dropdown)
 * GET /api/assinatura/lista  ✅ caminho usado no frontend
 * GET /api/assinatura/todas  🔁 alias (compat)
 * ⛑️ restrito a administradores/instrutores
 */
router.get(
  ["/lista", "/todas"],
  authorizeRoles("administrador", "instrutor"),
  ctrl.listarAssinaturas
);

module.exports = router;
