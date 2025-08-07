const db = require("../db");

/**
 * 🔍 Lista todas as datas (com horário) de uma turma específica
 */
async function listarDatasDaTurma(req, res) {
  const turmaId = req.params.id;

  try {
    const resultado = await db.query(
      `SELECT data, horario_inicio, horario_fim
       FROM datas_evento
       WHERE turma_id = $1
       ORDER BY data`,
      [turmaId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    console.error("❌ Erro ao buscar datas da turma:", erro);
    res.status(500).json({ erro: "Erro ao buscar datas da turma." });
  }
}

module.exports = { listarDatasDaTurma };
