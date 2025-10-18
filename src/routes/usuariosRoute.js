// 📁 src/routes/usuariosRoutes.js
const express = require("express");
const router = express.Router();

const usuarioAdministradorController = require("../controllers/usuarioAdministradorController");
const usuarioPublicoController = require("../controllers/usuarioPublicoController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────
function validarId(req, res, next) {
  const { id } = req.params;
  if (Number.isNaN(Number(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }
  next();
}

function registerIf(fn, registrar, rotaDescrita) {
  if (typeof fn === "function") {
    registrar();
  } else {
    const nomeFn = registrar?.name || rotaDescrita || "rota-desconhecida";
    console.warn(`⚠️  Rota '${nomeFn}' não registrada: handler ausente no controller.`);
  }
}

// ─────────────────────────────────────────────────────────────
// 🔓 Rotas públicas (sem autenticação)
// ─────────────────────────────────────────────────────────────
if (typeof usuarioPublicoController?.cadastrarUsuario === "function") {
  router.post("/cadastro", usuarioPublicoController.cadastrarUsuario);
}
if (typeof usuarioPublicoController?.loginUsuario === "function") {
  router.post("/login", usuarioPublicoController.loginUsuario);
}
if (typeof usuarioPublicoController?.recuperarSenha === "function") {
  router.post("/recuperar-senha", usuarioPublicoController.recuperarSenha);
}
if (typeof usuarioPublicoController?.redefinirSenha === "function") {
  router.post("/redefinir-senha", usuarioPublicoController.redefinirSenha);
}

// ─────────────────────────────────────────────────────────────
// 🔒 Rotas protegidas (exigem token válido)
// OBS: endpoints de perfil /perfil/me ficam em perfilRoutes
// ─────────────────────────────────────────────────────────────

// 👥 Listar todos (admin)
registerIf(usuarioAdministradorController?.listarUsuarios, function listarUsuariosRoute() {
  router.get(
    "/",
    authMiddleware,
    authorizeRoles("administrador"),
    usuarioAdministradorController.listarUsuarios
  );
});

// 👨‍🏫 Listar instrutores (admin)
const listarInstrutoresHandler =
  usuarioAdministradorController?.listarInstrutores ||
  usuarioAdministradorController?.listarinstrutor;

registerIf(listarInstrutoresHandler, function listarInstrutoresRoute() {
  router.get(
    "/instrutores",
    authMiddleware,
    authorizeRoles("administrador"),
    listarInstrutoresHandler
  );
});

// 👨‍⚖️ Listar avaliadores elegíveis (instrutor/administrador) — admin
registerIf(usuarioAdministradorController?.listarAvaliadoresElegiveis, function listarAvaliadoresElegiveisRoute() {
  // Ex.: GET /usuarios/avaliadores?roles=instrutor,administrador
  router.get(
    "/avaliadores",
    authMiddleware,
    authorizeRoles("administrador"),
    usuarioAdministradorController.listarAvaliadoresElegiveis
  );
});

// 📊 Resumo do usuário (cursos ≥75% e certificados) — admin
registerIf(usuarioAdministradorController?.getResumoUsuario, function getResumoUsuarioRoute() {
  router.get(
    "/:id(\\d+)/resumo",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    usuarioAdministradorController.getResumoUsuario
  );
});

// 📝 Atualizar perfil (admin) por :id (NUMÉRICO)
const atualizarPerfilHandler =
  usuarioAdministradorController?.atualizarPerfil ||
  usuarioAdministradorController?.atualizarPerfilUsuario ||
  usuarioAdministradorController?.updatePerfil;

registerIf(atualizarPerfilHandler, function atualizarPerfilRoute() {
  router.patch(
    "/:id(\\d+)/perfil",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    atualizarPerfilHandler
  );
  router.put(
    "/:id(\\d+)/perfil",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    atualizarPerfilHandler
  );
});

// 👤 Obter usuário por ID (NUMÉRICO)
registerIf(usuarioPublicoController?.obterUsuarioPorId, function obterUsuarioPorIdRoute() {
  router.get(
    "/:id(\\d+)",
    authMiddleware,
    validarId,
    usuarioPublicoController.obterUsuarioPorId
  );
});

// 🔄 Atualizar dados básicos do usuário por ID (NUMÉRICO)
registerIf(usuarioPublicoController?.atualizarUsuario, function atualizarUsuarioRoute() {
  router.patch(
    "/:id(\\d+)",
    authMiddleware,
    validarId,
    usuarioPublicoController.atualizarUsuario
  );
});

// ✍️ Assinatura do usuário autenticado
registerIf(usuarioPublicoController?.obterAssinatura, function obterAssinaturaRoute() {
  router.get(
    "/assinatura",
    authMiddleware,
    usuarioPublicoController.obterAssinatura
  );
});

// ❌ Excluir usuário (admin) por ID (NUMÉRICO)
registerIf(usuarioAdministradorController?.excluirUsuario, function excluirUsuarioRoute() {
  router.delete(
    "/:id(\\d+)",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    usuarioAdministradorController.excluirUsuario
  );
});

module.exports = router;
