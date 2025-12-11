// ✅ src/routes/unidadesRoutes.js
const express = require("express");
const router = express.Router();

// 🏥 Listar todas as unidades
router.get("/", async (req, res) => {
  const db = req.db || require("../db");

  try {
    const sql = "SELECT id, nome FROM unidades ORDER BY nome";
    const result = await db.query(sql);

    console.log(
      `[UNIDADES] Total retornado: ${result.rowCount}`,
      result.rows[0] ? `Exemplo: ${result.rows[0].id} - ${result.rows[0].nome}` : "(sem linhas)"
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar unidades:", err);
    return res.status(500).json({ erro: "Erro ao buscar unidades" });
  }
});

module.exports = router;
