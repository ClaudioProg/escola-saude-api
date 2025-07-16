const db = require('../db');

async function listarinstrutor(req, res) {
  try {
    const result = await db.query(
      `SELECT 
         u.id, 
         u.nome, 
         u.email,
         COUNT(DISTINCT ei.evento_id) AS eventos_ministrados,
         ROUND(AVG(
           CASE a.desempenho_instrutor
             WHEN 'Ótimo' THEN 5
             WHEN 'Bom' THEN 4
             WHEN 'Regular' THEN 3
             WHEN 'Ruim' THEN 2
             WHEN 'Péssimo' THEN 1
             ELSE NULL
           END
         )::numeric, 2) AS media_avaliacao
       FROM usuarios u
       JOIN evento_instrutor ei ON u.id = ei.instrutor_id
       -- Pega avaliações de turmas em que ele foi instrutor
       LEFT JOIN turmas t ON t.instrutor_id = u.id
       LEFT JOIN avaliacoes a ON a.turma_id = t.id
       LEFT JOIN eventos e ON e.id = t.evento_id
       WHERE $1 = ANY(u.perfil)
         AND e.id = ei.evento_id
       GROUP BY u.id, u.nome, u.email
       ORDER BY u.nome`,
      ['instrutor']
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Erro ao buscar instrutor:', error);
    res.status(500).json({ erro: 'Erro ao buscar instrutor.' });
  }
}

module.exports = {
  listarinstrutor,
};
