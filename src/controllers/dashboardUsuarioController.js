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

    /* ===========================
       ✅ CONCLUÍDOS (mantém)
       =========================== */
    const cursos = await db.query(
      `
      SELECT COUNT(DISTINCT e.id) AS eventos_concluidos
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59')::time) < NOW()
      `,
      [usuarioId]
    );

    const eventosinstrutor = await db.query(
      `SELECT COUNT(*) FROM evento_instrutor WHERE instrutor_id = $1`,
      [usuarioId]
    );

    /* ===========================
       ✅ NOVOS STATS (Painel Home)
       =========================== */

    // 1) Inscrições futuras (cursos que ainda vai fazer)
    const inscricoesFuturas = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time) > NOW()
      `,
      [usuarioId]
    );

    // inscrições atuais (compatibilidade)
    const inscricoesAtuais = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND NOW() BETWEEN (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time)
                      AND (t.data_fim::date    + COALESCE(t.horario_fim,'23:59')::time)
      `,
      [usuarioId]
    );

    // próximos eventos (compatibilidade; mesma lógica das futuras)
    const proximos = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time) > NOW()
      `,
      [usuarioId]
    );

    // 2) Avaliações pendentes
    const avalPendentes = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59')::time) <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM avaliacoes a
          WHERE a.usuario_id = i.usuario_id
            AND a.turma_id = i.turma_id
        )
      `,
      [usuarioId]
    );

    // 3) Certificados emitidos (fonte da verdade: gerado_em)
    const certificadosEmitidosQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados c
      WHERE c.usuario_id = $1
        AND c.gerado_em IS NOT NULL
      `,
      [usuarioId]
    );

    // total de certificados (compatibilidade antiga)
    const certificados = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    /* ===========================
       ✅ Presenças / Faltas / Nota (VERDADEIRO CORRIGIDO)
       - MESMA base do /presencas/minhas
       - usa datas_turma quando existe
       - fallback: generate_series(data_inicio..data_fim)
       - faltas = dias passados sem presença TRUE
       - soma somente turmas encerradas (CURRENT_DATE > df)
       =========================== */

    const pfDash = await db.query(
      `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.data_inicio::date AS di_raw,
          t.data_fim::date     AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT
          mt.turma_id,
          dt.data::date AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT
          mt.turma_id,
          gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      pres AS (
        SELECT
          p.turma_id,
          p.data_presenca::date AS d,
          BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
      agregada AS (
        SELECT
          db.turma_id,
          MIN(db.d) AS di,
          MAX(db.d) AS df,

          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE) AS realizados,

          COUNT(*) FILTER (
            WHERE db.d <= CURRENT_DATE AND p.presente IS TRUE
          ) AS presentes_passados,

          COUNT(*) FILTER (
            WHERE db.d <= CURRENT_DATE AND COALESCE(p.presente, FALSE) IS NOT TRUE
          ) AS ausencias_passadas

        FROM datas_base db
        LEFT JOIN pres p ON p.turma_id = db.turma_id AND p.d = db.d
        GROUP BY db.turma_id
      )
      SELECT
        COALESCE(SUM(presentes_passados), 0)::int AS presencas_total,
        COALESCE(SUM(ausencias_passadas), 0)::int AS faltas_total
      FROM agregada
      WHERE CURRENT_DATE > df
      `,
      [usuarioId]
    );

    const presencas_total = Number(pfDash.rows?.[0]?.presencas_total ?? 0) || 0;
    const faltas_total = Number(pfDash.rows?.[0]?.faltas_total ?? 0) || 0;

    // nota = 10 - (faltas/(presencas+faltas) * 10)
    const totalPF = presencas_total + faltas_total;
    let nota_usuario = null;
    if (totalPF > 0) {
      const raw = 10 - (faltas_total / totalPF) * 10;
      nota_usuario = Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
    }

    /* ===========================
       ✅ mantém (instrutor) média
       =========================== */
    const mediaAvaliacao = await db.query(
      `
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
      `,
      [usuarioId]
    );

    /* ===========================
       ✅ RESPOSTA (sem gráficos e sem notificações)
       =========================== */
    return res.json({
      // HomeEscola (painel)
      inscricoesFuturas: Number(inscricoesFuturas.rows?.[0]?.total ?? 0) || 0,
      avaliacoesPendentes: Number(avalPendentes.rows?.[0]?.total ?? 0) || 0,
      certificadosEmitidos: Number(certificadosEmitidosQ.rows?.[0]?.total ?? 0) || 0,
      presencasTotal: presencas_total,
      faltasTotal: faltas_total,
      notaUsuario: nota_usuario,

      // compatibilidade / legado
      cursosRealizados: Number(cursos.rows?.[0]?.eventos_concluidos ?? 0) || 0,
      eventosinstrutor: Number(eventosinstrutor.rows?.[0]?.count ?? 0) || 0,
      inscricoesAtuais: Number(inscricoesAtuais.rows?.[0]?.total ?? 0) || 0,
      proximosEventos: Number(proximos.rows?.[0]?.total ?? 0) || 0,
      certificadosTotal: Number(certificados.rows?.[0]?.total ?? 0) || 0,

      // mantém sua média como instrutor
      mediaAvaliacao:
        mediaAvaliacao.rows?.[0]?.media !== null && mediaAvaliacao.rows?.[0]?.media !== undefined
          ? (parseFloat(mediaAvaliacao.rows[0].media) * 2).toFixed(1)
          : "0.0",
    });
  } catch (error) {
    console.error("❌ Erro no dashboard:", error);
    return res.status(500).json({ erro: "Erro ao carregar dados do dashboard." });
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
