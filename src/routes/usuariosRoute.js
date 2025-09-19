// 📁 src/routes/usuariosRoute.js
const express = require("express");
const router = express.Router();

const usuarioAdministradorController = require("../controllers/usuarioAdministradorController");
const usuarioPublicoController = require("../controllers/usuarioPublicoController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/*
  Montagem típica (no app.js):
    // Você JÁ monta as rotas de perfil separadamente em server.js:
    // app.use("/api/perfil", require("./routes/perfilRoutes"));
    // app.use("/api/usuarios/perfil", require("./routes/perfilRoutes"));
*/

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
// ─────────────────────────────────────────────────────────────
// ⚠️ Removido: /me e /perfil/me
// Esses endpoints já são servidos por perfilRoutes montadas em server.js:
//  - /api/perfil/me
//  - /api/usuarios/perfil/me

// 👥 Listar todos (admin)
registerIf(usuarioAdministradorController?.listarUsuarios, function listarUsuariosRoute() {
  router.get(
    "/",
    authMiddleware,
    authorizeRoles("administrador"),
    usuarioAdministradorController.listarUsuarios
  );
});

// 👨‍🏫 Listar instrutores (admin) — com fallback de nome
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

// 📝 Atualizar perfil (admin) por :id
const atualizarPerfilHandler =
  usuarioAdministradorController?.atualizarPerfil ||
  usuarioAdministradorController?.atualizarPerfilUsuario ||
  usuarioAdministradorController?.updatePerfil;

registerIf(atualizarPerfilHandler, function atualizarPerfilRoute() {
  router.patch(
    "/:id/perfil",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    atualizarPerfilHandler
  );
  router.put(
    "/:id/perfil",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    atualizarPerfilHandler
  );
});

// 👤 Obter usuário por ID
registerIf(usuarioPublicoController?.obterUsuarioPorId, function obterUsuarioPorIdRoute() {
  router.get(
    "/:id",
    authMiddleware,
    validarId,
    usuarioPublicoController.obterUsuarioPorId
  );
});

// 🔄 Atualizar dados básicos do usuário (próprio ou admin) por :id
registerIf(usuarioPublicoController?.atualizarUsuario, function atualizarUsuarioRoute() {
  router.patch(
    "/:id",
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

// ❌ Excluir usuário (admin)
registerIf(usuarioAdministradorController?.excluirUsuario, function excluirUsuarioRoute() {
  router.delete(
    "/:id",
    authMiddleware,
    authorizeRoles("administrador"),
    validarId,
    usuarioAdministradorController.excluirUsuario
  );
});

module.exports = router;
