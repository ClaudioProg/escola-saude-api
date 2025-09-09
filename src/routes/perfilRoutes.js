// 📁 src/routes/perfilRoutes.js
const express = require("express");
const router = express.Router();

let auth = require("../auth/authMiddleware");
auth = typeof auth === "function" ? auth : (auth.protect || auth.auth || auth.default);

const forcarAtualizacaoCadastro = require("../auth/forcarAtualizacaoCadastro");
const { listarOpcoesPerfil, meuPerfil, atualizarMeuPerfil } = require("../controllers/perfilController");

router.use(auth);
router.use(forcarAtualizacaoCadastro);

router.get("/opcoes", listarOpcoesPerfil);
router.get("/me", meuPerfil);
router.put("/me", atualizarMeuPerfil);
router.patch("/me", atualizarMeuPerfil);   // ✅ adiciona PATCH

module.exports = router;
