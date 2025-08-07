 // controllers/relatorioPresencasController.js
const db = require('../db');

// 📄 Relatório de presenças por turma (corrigido sem uso de datas_evento)
async function porTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const result = await db.query(`
      WITH dados_turma AS (
        SELECT 
          t.id AS turma_id,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim
        FROM turmas t
        WHERE t.id = $1
      ),
      datas AS (
        SELECT generate_series(data_inicio, data_fim, '1 day')::date AS data
        FROM dados_turma
      )
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        d.data,
        COALESCE(p.presente, false) AS presente,
        dt.data_inicio,
        dt.data_fim,
        dt.horario_inicio,
        dt.horario_fim
      FROM inscricoes i
      JOIN usuarios u ON i.usuario_id = u.id
      CROSS JOIN datas d
      JOIN dados_turma dt ON dt.turma_id = i.turma_id
      LEFT JOIN presencas p
        ON p.usuario_id = u.id
        AND p.turma_id = i.turma_id
        AND p.data_presenca = d.data
      WHERE i.turma_id = $1
      ORDER BY u.nome, d.data
    `, [turma_id]);

    res.json({ lista: result.rows });
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
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        p.data_presenca,
        COALESCE(p.presente, false) AS presente,
        i.turma_id
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
