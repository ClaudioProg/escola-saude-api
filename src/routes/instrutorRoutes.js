const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const { listarinstrutor } = require("../controllers/instrutorController");

// 📋 Listar instrutor (apenas administrador)
router.get("/", authMiddleware, authorizeRoles("administrador"), listarinstrutor);

module.exports = router;
