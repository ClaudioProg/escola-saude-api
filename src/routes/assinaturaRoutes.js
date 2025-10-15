/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

// 🔐 import resiliente
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[assinaturaRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[assinaturaRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

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
