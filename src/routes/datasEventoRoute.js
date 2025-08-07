// 📁 src/routes/datasEventoRoute.js
const express = require("express");
const router = express.Router();
const { listarDatasDaTurma } = require("../controllers/datasEventoController");
const authMiddleware = require("../auth/authMiddleware");

// 🔍 Buscar todas as datas de uma turma
router.get("/turma/:id", authMiddleware, listarDatasDaTurma);

module.exports = router;