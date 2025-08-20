const db = require('../db');

/**
 * 📋 Lista todos os instrutores com suas médias de avaliação
 * @route GET /api/usuarios/instrutor
 */
async function listarInstrutor(req, res) {
  try {
    const result = await db.query(`
      SELECT 
        u.id, 
        u.nome, 
        u.email,

        -- Contagem correta dos eventos distintos
        (
          SELECT COUNT(DISTINCT ei.evento_id)
          FROM evento_instrutor ei
          JOIN eventos e ON e.id = ei.evento_id
          WHERE ei.instrutor_id = u.id
        ) AS "eventosMinistrados",

        -- Média de avaliação com CASE
        ROUND(AVG(
          CASE a.desempenho_instrutor
            WHEN 'Ótimo' THEN 5
            WHEN 'Bom' THEN 4
            WHEN 'Regular' THEN 3
            WHEN 'Ruim' THEN 2
            WHEN 'Péssimo' THEN 1
            ELSE NULL
          END
        )::numeric, 2) AS media_avaliacao,

        -- Verifica se possui assinatura
        CASE 
          WHEN s.imagem_base64 IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS "possuiAssinatura"

      FROM usuarios u
      LEFT JOIN assinaturas s ON s.usuario_id = u.id
      LEFT JOIN avaliacoes a ON a.instrutor_id = u.id
      LEFT JOIN turmas t ON t.id = a.turma_id

      WHERE string_to_array(u.perfil, ',') && ARRAY['instrutor', 'administrador']
      GROUP BY u.id, u.nome, u.email, s.imagem_base64
      ORDER BY u.nome;
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Erro ao buscar instrutor:', error);
    res.status(500).json({ erro: 'Erro ao buscar instrutor.' });
  }
}



/**
 * 📊 Lista eventos e avaliações detalhadas de um instrutor específico
 * @route GET /api/instrutor/:id/eventos-avaliacoes
 */
async function getEventosAvaliacoesPorInstrutor(req, res) {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
  e.id AS evento_id,
  e.titulo AS evento,
  MIN(t.data_inicio) AS data_inicio,
  MAX(t.data_fim) AS data_fim,
  ROUND(AVG(sub.nota) * 2::numeric, 1) AS nota_media
FROM eventos e
JOIN turmas t ON t.evento_id = e.id
JOIN evento_instrutor ei ON ei.evento_id = e.id
LEFT JOIN (
  SELECT 
    a.turma_id,
    CASE a.desempenho_instrutor
      WHEN 'Ótimo' THEN 5
      WHEN 'Bom' THEN 4
      WHEN 'Regular' THEN 3
      WHEN 'Ruim' THEN 2
      WHEN 'Péssimo' THEN 1
      ELSE NULL
    END AS nota
  FROM avaliacoes a
) sub ON sub.turma_id = t.id
WHERE ei.instrutor_id = $1
GROUP BY e.id, e.titulo
ORDER BY MIN(t.data_inicio) DESC;

    `;

    const { rows } = await db.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar eventos do instrutor:", error.message);
    res.status(500).json({ erro: "Erro ao buscar eventos ministrados." });
  }
}



/**
 * 📚 Lista turmas vinculadas a um instrutor com nome do evento
 * @route GET /api/instrutor/:id/turmas
 */
async function getTurmasComEventoPorInstrutor(req, res) {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        t.id AS id,
        t.nome AS nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_nome
      FROM evento_instrutor ei
      JOIN eventos e ON ei.evento_id = e.id
      JOIN turmas t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio ASC
    `;

    const { rows } = await db.query(query, [id]);

    const turmasFormatadas = rows.map((t) => ({
      id: t.id,
      nome: t.nome,
      data_inicio: t.data_inicio,
      data_fim: t.data_fim,
      horario_inicio: t.horario_inicio,
      horario_fim: t.horario_fim,
      evento: {
        id: t.evento_id,
        nome: t.evento_nome,
      },
    }));

    res.json(turmasFormatadas);
  } catch (error) {
    console.error("❌ Erro ao buscar turmas do instrutor:", error.message);
    res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

module.exports = {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor,
};
