const db = require('../db');

/**
 * 📍 Lista todas as turmas com informações para o painel do administrador
 * @route GET /api/administrador/turmas
 */
async function listarTurmasadministrador(req, res) {
  try {
    const query = `
      SELECT
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        to_char(t.horario_inicio, 'HH24:MI') || ' - ' || to_char(t.horario_fim, 'HH24:MI') AS horario,
        t.vagas_total AS vagas_total,
        COUNT(i.id) AS vagas_ocupadas,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
          FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutor,
        CASE
          WHEN CURRENT_DATE < t.data_inicio THEN 'programado'
          WHEN CURRENT_DATE BETWEEN t.data_inicio AND t.data_fim THEN 'em_andamento'
          ELSE 'encerrado'
        END AS status
      FROM turmas t
      JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u ON u.id = ei.instrutor_id
      LEFT JOIN inscricoes i ON i.turma_id = t.id
      GROUP BY t.id, e.id
      ORDER BY t.data_inicio ASC
    `;

    const resultado = await db.query(query);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('❌ Erro ao carregar turmas (administrador):', error.message);
    res.status(500).json({ erro: 'Erro ao buscar turmas para o painel administrador.' });
  }
}

module.exports = {
  listarTurmasadministrador,
};
