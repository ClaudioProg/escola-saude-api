// ✅ src/routes/unidadesRoute.js
const express = require("express");
const router = express.Router();

const auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const unidadesController = require("../controllers/unidadesController");

// Pode ser público se quiser liberar o filtro na tela de login.
// Aqui mantive restrito a administradores:
router.get("/", auth, authorizeRoles("administrador"), unidadesController.listar);

module.exports = router;
