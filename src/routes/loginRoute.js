// 📁 src/routes/authRoute.js
const express = require("express");
const router = express.Router();
const { loginUsuario } = require("../controllers/loginController");

/**
 * @route POST /api/usuarios/login
 * @desc Autenticação de usuário (login)
 * @access Público
 */
router.post("/", loginUsuario);

module.exports = router;
