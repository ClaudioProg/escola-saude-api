const db = require("../db");

async function buscarAvaliacoesPendentes(usuario_id) {
  const result = await db.query(`
    SELECT 
      e.id AS evento_id,
      e.titulo AS nome_evento,
      t.id AS turma_id,
      t.data_inicio,
      t.data_fim,
      t.horario_fim
    FROM inscricoes i
    INNER JOIN turmas t ON i.turma_id = t.id
    INNER JOIN eventos e ON t.evento_id = e.id
    LEFT JOIN avaliacoes a 
      ON a.usuario_id = i.usuario_id AND a.turma_id = t.id
    WHERE i.usuario_id = $1
      AND a.id IS NULL
      AND (
        t.data_fim < CURRENT_DATE
        OR (t.data_fim = CURRENT_DATE AND t.horario_fim < CURRENT_TIME)
      )
      AND EXISTS (
        SELECT 1 FROM presencas p
        WHERE p.usuario_id = i.usuario_id AND p.turma_id = i.turma_id
        GROUP BY p.usuario_id, p.turma_id
        HAVING COUNT(*) * 1.0 / (t.data_fim - t.data_inicio + 1) >= 0.75
      )
    ORDER BY t.data_fim DESC
  `, [usuario_id]);

  return result.rows;
}

module.exports = { buscarAvaliacoesPendentes };
