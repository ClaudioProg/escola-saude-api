// 📁 src/routes/perfilRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Auth
let auth = require("../auth/authMiddleware");
auth = typeof auth === "function"
  ? auth
  : (auth.protect || auth.auth || auth.default);

// Controllers corretos
const {
  listarOpcoesPerfil,
  meuPerfil,
  atualizarMeuPerfil,
} = require("../controllers/perfilController");

// ⚙️ helper async
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

/**
 * 🔓 ROTAS PÚBLICAS
 */

// Opções para selects (cadastro)
router.get("/opcoes", wrap(listarOpcoesPerfil));

/**
 * 🔐 ROTAS PROTEGIDAS
 */
router.use(auth);

// Meu perfil
router.get("/me", wrap(meuPerfil));

// Atualizar meu perfil
router.put("/me", wrap(atualizarMeuPerfil));
router.patch("/me", wrap(atualizarMeuPerfil));

module.exports = router;
