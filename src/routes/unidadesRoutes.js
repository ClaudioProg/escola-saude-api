const express = require("express");
const router = express.Router();
const db = require("../db");

// 🏥 Listar todas as unidades
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nome FROM unidades ORDER BY nome"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar unidades:", err);
    res.status(500).json({ erro: "Erro ao buscar unidades" });
  }
});

module.exports = router;
