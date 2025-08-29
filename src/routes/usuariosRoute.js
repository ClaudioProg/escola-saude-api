// 📁 src/routes/usuariosRoute.js
const express = require("express");
const router = express.Router();

const usuarioAdministradorController = require("../controllers/usuarioAdministradorController");
const usuarioPublicoController = require("../controllers/usuarioPublicoController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/*
  Montagem típica (no app.js):
    app.use("/api/usuarios", require("./routes/usuariosRoute"));
*/

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────

// valida :id numérico
function validarId(req, res, next) {
  const { id } = req.params;
  if (Number.isNaN(Number(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }
  next();
}

// registra rota protegida apenas se o handler existir
function registerIf(fn, registrar) {
  if (typeof fn === "function") {
    registrar();
  } else {
    const nome = registrar._name || "rota-desconhecida";
    console.warn(`⚠️  Rota '${nome}' não registrada: handler ausente no controller.`);
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

// 👥 Listar todos (admin)
registerIf(usuarioAdministradorController?.listarUsuarios, function listarUsuariosRoute() {
  router.get(
    "/",
    authMiddleware,
    authorizeRoles("administrador"),
    usuarioAdministradorController.listarUsuarios
  );
});

// 👨‍🏫 Listar instrutores (admin) — opcional
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

// 📝 Atualizar perfil (admin)
// compat: aceita possíveis nomes de função no controller
const atualizarPerfilHandler =
  usuarioAdministradorController?.atualizarPerfil ||
  usuarioAdministradorController?.atualizarPerfilUsuario ||
  usuarioAdministradorController?.updatePerfil;

registerIf(atualizarPerfilHandler, function atualizarPerfilRoute() {
  // ✅ aceita PATCH (REST “parcial”) e PUT (compat com frontend atual)
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

// 🔄 Atualizar dados do usuário (próprio ou admin)
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
