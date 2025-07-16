const db = require("../db");

async function getResumoDashboard(req, res) {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const cursos = await db.query(`
      SELECT COUNT(*) FROM inscricoes WHERE usuario_id = $1
    `, [usuarioId]);

    const eventosinstrutor = await db.query(`
      SELECT COUNT(*) FROM evento_instrutor WHERE instrutor_id = $1
    `, [usuarioId]);

    const inscricoesAtuais = await db.query(`
      SELECT COUNT(*) FROM inscricoes WHERE usuario_id = $1
    `, [usuarioId]);

    const proximos = await db.query(`
      SELECT COUNT(*) FROM turmas WHERE data_inicio >= CURRENT_DATE
    `);

    const certificados = await db.query(`
      SELECT COUNT(*) FROM certificados WHERE usuario_id = $1
    `, [usuarioId]);

    const mediaAvaliacao = await db.query(`
      SELECT ROUND(AVG(
        CASE a.desempenho_instrutor
          WHEN 'Ótimo' THEN 5
          WHEN 'Bom' THEN 4
          WHEN 'Regular' THEN 3
          WHEN 'Ruim' THEN 2
          WHEN 'Péssimo' THEN 1
          ELSE NULL
        END
      )::numeric, 2) AS media
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      WHERE t.instrutor_id = $1
    `, [usuarioId]);
    

    const eventosData = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM inscricoes i
         JOIN turmas t ON i.turma_id = t.id
         WHERE i.usuario_id = $1 AND t.data_fim < CURRENT_DATE) AS realizados,

        (SELECT COUNT(*) FROM inscricoes i
         JOIN turmas t ON i.turma_id = t.id
         WHERE i.usuario_id = $1 AND t.data_inicio >= CURRENT_DATE) AS programados,

        (SELECT COUNT(*) FROM evento_instrutor WHERE instrutor_id = $1) AS instrutor
    `, [usuarioId]);

    const avaliacoes = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE desempenho_instrutor = 'Ótimo') AS otimo,
        COUNT(*) FILTER (WHERE desempenho_instrutor = 'Bom') AS bom,
        COUNT(*) FILTER (WHERE desempenho_instrutor = 'Regular') AS regular,
        COUNT(*) FILTER (WHERE desempenho_instrutor = 'Ruim') AS ruim,
        COUNT(*) FILTER (WHERE desempenho_instrutor = 'Péssimo') AS pessimo
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      WHERE t.instrutor_id = $1
    `, [usuarioId]);

    const notificacoesQuery = `
      SELECT mensagem, data
      FROM (
        SELECT 
          '📅 Você tem uma aula do evento "' || e.titulo || '" em breve.' AS mensagem,
          t.data_inicio AS data
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        JOIN inscricoes i ON i.turma_id = t.id
        WHERE i.usuario_id = $1 AND t.data_inicio >= CURRENT_DATE

        UNION ALL

        SELECT 
          '📜 Seu certificado do evento "' || e.titulo || '" está disponível.',
          c.gerado_em
        FROM certificados c
        JOIN eventos e ON e.id = c.evento_id
        WHERE c.usuario_id = $1

        UNION ALL

        SELECT 
  '⭐ Você recebeu uma nova avaliação como instrutor em "' || e.titulo || '".',
  MAX(a.data_avaliacao)
FROM avaliacoes a
JOIN turmas t ON t.id = a.turma_id
JOIN eventos e ON e.id = t.evento_id
WHERE t.instrutor_id = $1
GROUP BY e.titulo
      ) AS notificacoes
      ORDER BY data DESC
      LIMIT 3
    `;
    const { rows: ultimasNotificacoes } = await db.query(notificacoesQuery, [usuarioId]);

    res.json({
      cursosRealizados: Number(cursos.rows[0].count),
      eventosinstrutor: Number(eventosinstrutor.rows[0].count),
      inscricoesAtuais: Number(inscricoesAtuais.rows[0].count),
      proximosEventos: Number(proximos.rows[0].count),
      certificadosEmitidos: Number(certificados.rows[0].count),
      mediaAvaliacao: mediaAvaliacao.rows[0].media !== null
        ? parseFloat(mediaAvaliacao.rows[0].media)
        : 0,
      graficoEventos: eventosData.rows[0],
      graficoAvaliacoes: avaliacoes.rows[0],
      ultimasNotificacoes,
    });

  } catch (error) {
    console.error("❌ Erro no dashboard:", error.message);
    res.status(500).json({ erro: "Erro ao carregar dados do dashboard." });
  }
}

module.exports = { getResumoDashboard };
