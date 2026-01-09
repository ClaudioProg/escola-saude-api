// ✅ src/routes/usuariosRoutes.js
/* eslint-disable no-console */
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const usuarioAdministradorController = require("../controllers/usuarioAdministradorController");
const usuarioPublicoController = require("../controllers/usuarioPublicoController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* ─────────────────────────────────────────────────────────────
   Helpers “premium”
────────────────────────────────────────────────────────────── */
const requireAdmin = [authMiddleware, authorizeRoles("administrador")];

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Wrap para lidar com handlers async sem estourar unhandled rejections */
const asyncHandler = (fn) =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** ID numérico positivo (defensivo contra overflow e NaN) */
function validarId(req, res, next) {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }
  return next();
}

/** Registro condicional de rotas (com log amigável quando faltar handler) */
function registerIf(fn, registrar, rotaDescrita) {
  if (typeof fn === "function") {
    registrar();
  } else {
    const nomeFn = rotaDescrita || registrar?.name || "rota-desconhecida";
    console.warn(`⚠️  Rota '${nomeFn}' não registrada: handler ausente no controller.`);
  }
}

/* ─────────────────────────────────────────────────────────────
   🔓 Rotas públicas (sem autenticação)
────────────────────────────────────────────────────────────── */
registerIf(usuarioPublicoController?.cadastrarUsuario, function cadastroPublicoRoute() {
  router.post("/cadastro", authLimiter, asyncHandler(usuarioPublicoController.cadastrarUsuario));
}, "POST /usuarios/cadastro");

registerIf(usuarioPublicoController?.loginUsuario, function loginPublicoRoute() {
  router.post("/login", authLimiter, asyncHandler(usuarioPublicoController.loginUsuario));
}, "POST /usuarios/login");

registerIf(usuarioPublicoController?.recuperarSenha, function recuperarSenhaRoute() {
  router.post("/recuperar-senha", authLimiter, asyncHandler(usuarioPublicoController.recuperarSenha));
}, "POST /usuarios/recuperar-senha");

registerIf(usuarioPublicoController?.redefinirSenha, function redefinirSenhaRoute() {
  router.post("/redefinir-senha", authLimiter, asyncHandler(usuarioPublicoController.redefinirSenha));
}, "POST /usuarios/redefinir-senha");

/* ─────────────────────────────────────────────────────────────
   🔒 Rotas protegidas (exigem token válido)
   OBS: endpoints de perfil /perfil/me ficam em perfilRoutes
────────────────────────────────────────────────────────────── */

/** 👥 Listar todos (admin) */
registerIf(usuarioAdministradorController?.listarUsuarios, function listarUsuariosRoute() {
  router.get(
    "/",
    ...requireAdmin,
    adminLimiter,
    asyncHandler(usuarioAdministradorController.listarUsuarios)
  );
}, "GET /usuarios");

/** 👨‍🏫 Listar instrutores (admin) */
const listarInstrutoresHandler =
  usuarioAdministradorController?.listarInstrutores ||
  usuarioAdministradorController?.listarinstrutor;

registerIf(listarInstrutoresHandler, function listarInstrutoresRoute() {
  router.get(
    "/instrutores",
    ...requireAdmin,
    adminLimiter,
    asyncHandler(listarInstrutoresHandler)
  );
}, "GET /usuarios/instrutores");

/** 👨‍⚖️ Listar avaliadores elegíveis (admin) */
registerIf(usuarioAdministradorController?.listarAvaliadoresElegiveis, function listarAvaliadoresElegiveisRoute() {
  // Ex.: GET /usuarios/avaliadores?roles=instrutor,administrador
  router.get(
    "/avaliadores",
    ...requireAdmin,
    adminLimiter,
    asyncHandler(usuarioAdministradorController.listarAvaliadoresElegiveis)
  );
}, "GET /usuarios/avaliadores");

/** 📊 Resumo do usuário (admin) */
registerIf(usuarioAdministradorController?.getResumoUsuario, function getResumoUsuarioRoute() {
  router.get(
    "/:id(\\d+)/resumo",
    ...requireAdmin,
    adminLimiter,
    validarId,
    asyncHandler(usuarioAdministradorController.getResumoUsuario)
  );
}, "GET /usuarios/:id/resumo");

/** 📝 Atualizar perfil (admin) por :id */
const atualizarPerfilHandler =
  usuarioAdministradorController?.atualizarPerfil ||
  usuarioAdministradorController?.atualizarPerfilUsuario ||
  usuarioAdministradorController?.updatePerfil;

registerIf(atualizarPerfilHandler, function atualizarPerfilRoute() {
  router.patch(
    "/:id(\\d+)/perfil",
    ...requireAdmin,
    adminLimiter,
    validarId,
    asyncHandler(atualizarPerfilHandler)
  );
  router.put(
    "/:id(\\d+)/perfil",
    ...requireAdmin,
    adminLimiter,
    validarId,
    asyncHandler(atualizarPerfilHandler)
  );
}, "PATCH/PUT /usuarios/:id/perfil");

/** 👤 Obter usuário por ID (protegido) */
registerIf(usuarioPublicoController?.obterUsuarioPorId, function obterUsuarioPorIdRoute() {
  router.get(
    "/:id(\\d+)",
    authMiddleware,
    authLimiter,
    validarId,
    asyncHandler(usuarioPublicoController.obterUsuarioPorId)
  );
}, "GET /usuarios/:id");

/** 🔄 Atualizar dados básicos do usuário por ID (protegido) */
registerIf(usuarioPublicoController?.atualizarUsuario, function atualizarUsuarioRoute() {
  router.patch(
    "/:id(\\d+)",
    authMiddleware,
    authLimiter,
    validarId,
    asyncHandler(usuarioPublicoController.atualizarUsuario)
  );
}, "PATCH /usuarios/:id");

/** ✍️ Assinatura do usuário autenticado (protegido) */
registerIf(usuarioPublicoController?.obterAssinatura, function obterAssinaturaRoute() {
  router.get(
    "/assinatura",
    authMiddleware,
    authLimiter,
    asyncHandler(usuarioPublicoController.obterAssinatura)
  );
}, "GET /usuarios/assinatura");

/** ❌ Excluir usuário (admin) */
registerIf(usuarioAdministradorController?.excluirUsuario, function excluirUsuarioRoute() {
  router.delete(
    "/:id(\\d+)",
    ...requireAdmin,
    adminLimiter,
    validarId,
    asyncHandler(usuarioAdministradorController.excluirUsuario)
  );
}, "DELETE /usuarios/:id");

module.exports = router;
