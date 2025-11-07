// ✅ src/controllers/unidadesController.js
/* eslint-disable no-console */
const db = require("../db");

exports.listar = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, sigla, nome
         FROM unidades
        ORDER BY sigla NULLS LAST, nome`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Erro ao listar unidades:", err);
    return res.status(500).json({ message: "Erro ao listar unidades." });
  }
};
