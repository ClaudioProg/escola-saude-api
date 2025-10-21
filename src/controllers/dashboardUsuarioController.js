const db = require("../db");

/**
 * 📋 Lista todos os eventos com avaliações ministrados por um instrutor
 * @route GET /api/instrutor/:id/eventos-avaliacoes
 */
async function getEventosAvaliacoesPorInstrutor(req, res) {
  const { id } = req.params;

  try {
    // Busca os eventos com turmas e nota média
    const query = `
      SELECT 
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        TO_CHAR(t.data_inicio, 'DD/MM/YYYY') AS data_inicio,
        ROUND(AVG(
          CASE a.desempenho_instrutor
            WHEN 'Ótimo' THEN 5
            WHEN 'Bom' THEN 4
            WHEN 'Regular' THEN 3
            WHEN 'Ruim' THEN 2
            WHEN 'Péssimo' THEN 1
            ELSE NULL
          END
        )::numeric, 1) AS nota_media
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN avaliacoes a ON a.turma_id = t.id AND a.instrutor_id = ei.instrutor_id
      WHERE ei.instrutor_id = $1
      GROUP BY e.id, e.titulo, t.id, t.nome, t.data_inicio
      ORDER BY e.titulo, t.data_inicio DESC
    `;

    const { rows } = await db.query(query, [id]);

    const eventosMapeados = {};
    for (const row of rows) {
      const turmaId = row.turma_id;

      // 🔍 Aqui buscamos os comentários para cada turma + instrutor
      const { rows: avaliacoesDetalhadas } = await db.query(
        `
        SELECT 
          desempenho_instrutor,
          gostou_mais,
          sugestoes_melhoria,
          comentarios_finais
        FROM avaliacoes
        WHERE turma_id = $1 AND instrutor_id = $2
        `,
        [turmaId, id]
      );

      if (!eventosMapeados[row.evento_id]) {
        eventosMapeados[row.evento_id] = {
          id: row.evento_id,
          titulo: row.evento_titulo,
          turmas: [],
        };
      }

      eventosMapeados[row.evento_id].turmas.push({
        id: turmaId,
        nome: row.turma_nome,
        data: row.data_inicio,
        nota_media: row.nota_media,
        comentarios: avaliacoesDetalhadas, // agora com os campos completos
      });
    }

    const eventosAgrupados = Object.values(eventosMapeados);
    res.json(eventosAgrupados);
  } catch (error) {
    console.error("❌ Erro ao buscar eventos do instrutor:", error.message);
    res.status(500).json({ erro: "Erro ao buscar eventos ministrados." });
  }
}


async function getResumoDashboard(req, res) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const cursos = await db.query(`
      SELECT COUNT(DISTINCT e.id) AS eventos_concluidos
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE i.usuario_id = $1 AND t.data_fim < CURRENT_DATE
    `, [usuarioId]);

    const eventosinstrutor = await db.query(`
      SELECT COUNT(*) FROM evento_instrutor WHERE instrutor_id = $1
    `, [usuarioId]);

    const inscricoesAtuais = await db.query(`
      SELECT COUNT(*) 
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND CURRENT_DATE BETWEEN t.data_inicio AND t.data_fim
    `, [usuarioId]);

    const proximos = await db.query(`
      SELECT COUNT(*) 
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND t.data_inicio > CURRENT_DATE
    `, [usuarioId]);

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
      WHERE a.instrutor_id = $1
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
  COUNT(*) FILTER (WHERE a.desempenho_instrutor = 'Ótimo') AS otimo,
  COUNT(*) FILTER (WHERE a.desempenho_instrutor = 'Bom') AS bom,
  COUNT(*) FILTER (WHERE a.desempenho_instrutor = 'Regular') AS regular,
  COUNT(*) FILTER (WHERE a.desempenho_instrutor = 'Ruim') AS ruim,
  COUNT(*) FILTER (WHERE a.desempenho_instrutor = 'Péssimo') AS pessimo
FROM avaliacoes a
JOIN turmas t ON t.id = a.turma_id
JOIN eventos e ON e.id = t.evento_id
JOIN evento_instrutor ei ON ei.evento_id = e.id
WHERE ei.instrutor_id = $1
    `, [usuarioId]);

    const notificacoesQuery = `
      SELECT mensagem, TO_CHAR(data, 'DD/MM/YYYY') AS data
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
        WHERE a.instrutor_id = $1
        GROUP BY e.titulo
      ) AS notificacoes
      ORDER BY data DESC
      LIMIT 5
    `;
    const { rows: ultimasNotificacoes } = await db.query(notificacoesQuery, [usuarioId]);

    res.json({
      cursosRealizados: Number(cursos.rows[0].eventos_concluidos),
      eventosinstrutor: Number(eventosinstrutor.rows[0].count),
      inscricoesAtuais: Number(inscricoesAtuais.rows[0].count),
      proximosEventos: Number(proximos.rows[0].count),
      certificadosEmitidos: Number(certificados.rows[0].count),
      mediaAvaliacao: mediaAvaliacao.rows[0].media !== null
        ? (parseFloat(mediaAvaliacao.rows[0].media) * 2).toFixed(1)
        : "0.0",
      graficoEventos: eventosData.rows[0],
      graficoAvaliacoes: avaliacoes.rows[0],
      ultimasNotificacoes,
    });

  } catch (error) {
    console.error("❌ Erro no dashboard:", error.message);
    res.status(500).json({ erro: "Erro ao carregar dados do dashboard." });
  }
}

async function getAvaliacoesRecentesInstrutor(req, res) {
  try {
    const usuarioId = req.user?.id;
    const query = `
      SELECT 
        e.titulo AS evento,
        a.desempenho_instrutor,
        a.data_avaliacao
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE a.instrutor_id = $1
      ORDER BY a.data_avaliacao DESC
      LIMIT 10
    `;

    const { rows } = await db.query(query, [usuarioId]);
    const notasConvertidas = rows.map((row) => ({
      evento: row.evento,
      nota: {
        "Ótimo": 5,
        "Bom": 4,
        "Regular": 3,
        "Ruim": 2,
        "Péssimo": 1,
      }[row.desempenho_instrutor] * 2,
    }));

    res.json(notasConvertidas);
  } catch (error) {
    console.error("Erro ao buscar últimas avaliações:", error.message);
    res.status(500).json({ erro: "Erro ao buscar últimas avaliações." });
  }
}

module.exports = { getResumoDashboard, getAvaliacoesRecentesInstrutor, getEventosAvaliacoesPorInstrutor };
