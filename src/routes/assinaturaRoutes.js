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
 * - Se usuário for instrutor/administrador e NÃO tiver assinatura,
 *   o controller auto-gera uma assinatura (PNG em dataURL) e persiste.
 * - Retorna { assinatura: string|null }
 */
router.get("/", (req, res, next) => {
  // evita cache agressivo do navegador
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return ctrl.getAssinatura(req, res, next);
});

/**
 * ✍️ Salvar/atualizar assinatura do usuário autenticado (dataURL)
 * POST /api/assinatura
 * body: { assinatura: "data:image/png;base64,..." }
 */
router.post("/", ctrl.salvarAssinatura);

/**
 * ⚡ Forçar autogeração idempotente (atalho)
 * POST /api/assinatura/auto
 * - Útil para o front acionar explicitamente a criação automática quando quiser.
 * - Apenas delega ao getAssinatura (que já é idempotente).
 */
router.post("/auto", (req, res, next) => ctrl.getAssinatura(req, res, next));

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
