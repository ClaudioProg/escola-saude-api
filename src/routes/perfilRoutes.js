// 📁 src/routes/perfilRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Auth (aceita export default/nomeado)
let auth = require("../auth/authMiddleware");
auth = typeof auth === "function" ? auth : (auth.protect || auth.auth || auth.default);

// (opcional) middleware que força atualização do cadastro
const forcarAtualizacaoCadastro = require("../auth/forcarAtualizacaoCadastro");

// Controllers
const usuarioPublico = require("../controllers/usuarioPublicoController");

// ⚙️ helper para encadear async/await com catch centralizado
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

// 🔐 todas as rotas exigem token
router.use(auth);

/**
 * IMPORTANTE:
 * - /opcoes: não passa pelo forcarAtualizacaoCadastro (não pode bloquear a carga das listas)
 * - /me (GET/PUT/PATCH): amarrado diretamente ao usuarioPublicoController
 *   - GET -> obterUsuarioPorId (usa req.user.id)
 *   - PUT/PATCH -> atualizarPerfilCompleto (usa req.user.id)
 */

// ▶️ Opções para os selects (livre do "forçar atualização")
try {
  const { listarOpcoesPerfil } = require("../controllers/perfilController");
  if (typeof listarOpcoesPerfil === "function") {
    router.get("/opcoes", wrap(listarOpcoesPerfil));
  } else {
    // Se não houver perfilController, ainda podemos servir opcoes por outras rotas públicas já existentes
    // (deixamos sem /opcoes neste router)
  }
} catch (_) {
  // perfilController é opcional — ignore se não existir
}

// ✅ A PARTIR DAQUI poderíamos aplicar o "forçar atualização" para demais rotas.
// Como só temos /me, que justamente é a rota de atualização, NÃO aplicamos aqui.
// router.use(forcarAtualizacaoCadastro);

// 👤 Meu perfil (lê pelo ID do token)
router.get(
  "/me",
  wrap(async (req, res) => {
    req.params.id = req.user.id;
    return usuarioPublico.obterUsuarioPorId(req, res);
  })
);

// ✏️ Atualizar meu perfil (cadastro complementar) — aceita PUT e PATCH
const atualizarMeuPerfil = async (req, res) => {
  req.params.id = req.user.id;
  return usuarioPublico.atualizarPerfilCompleto(req, res);
};

router.put("/me", wrap(atualizarMeuPerfil));
router.patch("/me", wrap(atualizarMeuPerfil));

module.exports = router;
