 // controllers/relatorioPresencasController.js
const db = require('../db');

// 📄 Relatório de presenças por turma
async function porTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const result = await db.query(
      `SELECT u.nome, u.cpf,
              CASE WHEN p.id IS NULL THEN false ELSE true END AS presente
         FROM inscricoes i
         JOIN usuarios u ON i.usuario_id = u.id
         LEFT JOIN presencas p
           ON p.usuario_id = u.id
           AND p.turma_id = i.turma_id
         WHERE i.turma_id = $1
         ORDER BY u.nome`,
      [turma_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao gerar relatório por turma:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório por turma' });
  }
}

// 📄 Relatório de presenças por evento
async function porEvento(req, res) {
  const { evento_id } = req.params;

  try {
    const result = await db.query(
      `SELECT DISTINCT u.nome, u.cpf,
              CASE WHEN p.id IS NULL THEN false ELSE true END AS presente
         FROM eventos e
         JOIN turmas t ON t.evento_id = e.id
         JOIN inscricoes i ON i.turma_id = t.id
         JOIN usuarios u ON i.usuario_id = u.id
         LEFT JOIN presencas p
           ON p.usuario_id = u.id
           AND p.turma_id = t.id
         WHERE e.id = $1
         ORDER BY u.nome`,
      [evento_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao gerar relatório por evento:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório por evento' });
  }
}

// 📄 Relatório detalhado de presenças por turma
async function porTurmaDetalhado(req, res) {
  const { turma_id } = req.params;

  try {
    const result = await db.query(`
      SELECT
        u.nome,
        u.cpf,
        p.data_presenca
      FROM inscricoes i
      JOIN usuarios u ON i.usuario_id = u.id
      LEFT JOIN presencas p
        ON p.usuario_id = u.id
        AND p.turma_id = i.turma_id
      WHERE i.turma_id = $1
      ORDER BY u.nome, p.data_presenca
    `, [turma_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao gerar relatório detalhado por turma:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório detalhado por turma' });
  }
}

module.exports = {
  porEvento,
  porTurma,
  porTurmaDetalhado,
};
