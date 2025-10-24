// 📁 src/controllers/dashboardAnaliticoController.js
const db = require("../db");
const { formatarGrafico } = require("../utils/graficos");

/**
 * 📊 Gera os dados para o painel analítico (administrador), com filtros por ano, mês e tipo de evento.
 * 
 * Regras principais:
 * - Presença: considera “presente” quem tiver frequência ≥ 75% nas datas que já ocorreram.
 * - Percentual geral = (soma de pessoas elegíveis) / (soma de inscritos) × 100
 * 
 * @route GET /api/dashboard-analitico
 */
async function obterDashboard(req, res) {
  const { ano, mes, tipo } = req.query;
  const params = [];
  const condicoes = [];

  if (ano) {
    condicoes.push(`EXTRACT(YEAR FROM t.data_inicio) = $${params.length + 1}`);
    params.push(ano);
  }

  if (mes) {
    condicoes.push(`EXTRACT(MONTH FROM t.data_inicio) = $${params.length + 1}`);
    params.push(mes);
  }

  if (tipo) {
    condicoes.push(`e.tipo = $${params.length + 1}`);
    params.push(tipo);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  try {
    console.log("Dashboard analítico requisitado:", { ano, mes, tipo });

    /* =====================================================
       1️⃣ Métricas básicas
    ====================================================== */
    const totalEventosQ = await db.query(
      `
      SELECT COUNT(DISTINCT e.id) AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      `,
      params
    );

    const inscritosUnicosQ = await db.query(
      `
      SELECT COUNT(DISTINCT i.usuario_id) AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
      `,
      params
    );

    const mediaAvaliacoesQ = await db.query(
      `
      SELECT ROUND(AVG((
        COALESCE(CASE a.divulgacao_evento WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.recepcao WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.credenciamento WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.material_apoio WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.pontualidade WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.sinalizacao_local WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.conteudo_temas WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.estrutura_local WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.acessibilidade WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.limpeza WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0) +
        COALESCE(CASE a.inscricao_online WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 END, 0)
      )::numeric / 11), 2) AS media_evento
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where};
      `,
      params
    );

    const mediainstrutorQ = await db.query(
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
      )::numeric, 2) AS media_instrutor
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where};
      `,
      params
    );

    /* =====================================================
       2️⃣ Presença ≥ 75%
    ====================================================== */
    const presencaQuery = await db.query(
      `
      WITH turmas_filtradas AS (
        SELECT t.id AS turma_id, t.evento_id
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        ${where}
      ),
      encontros_ocorridos AS (
        SELECT p.turma_id, COUNT(DISTINCT p.data_presenca::date) AS total_encontros
        FROM presencas p
        JOIN turmas_filtradas tf ON tf.turma_id = p.turma_id
        WHERE p.data_presenca::date <= NOW()::date
        GROUP BY p.turma_id
      ),
      freq_usuario_turma AS (
        SELECT i.usuario_id, i.turma_id, eo.total_encontros,
               SUM(CASE WHEN p.presente THEN 1 ELSE 0 END) AS presencas_feitas
        FROM inscricoes i
        JOIN turmas_filtradas tf ON tf.turma_id = i.turma_id
        LEFT JOIN presencas p ON p.turma_id = i.turma_id AND p.usuario_id = i.usuario_id
        LEFT JOIN encontros_ocorridos eo ON eo.turma_id = i.turma_id
        GROUP BY i.usuario_id, i.turma_id, eo.total_encontros
      ),
      elegiveis_por_turma AS (
        SELECT fut.usuario_id, fut.turma_id, tf.evento_id,
               CASE WHEN fut.total_encontros > 0 
                    THEN (fut.presencas_feitas::decimal / fut.total_encontros::decimal) >= 0.75
                    ELSE false END AS elegivel_75
        FROM freq_usuario_turma fut
        JOIN turmas_filtradas tf ON tf.turma_id = fut.turma_id
      ),
      resumo_evento AS (
        SELECT e.id AS evento_id, e.titulo AS evento_titulo,
               COUNT(DISTINCT i.usuario_id) AS total_inscritos_evento,
               COUNT(DISTINCT CASE WHEN ept.elegivel_75 THEN ept.usuario_id END) AS total_elegiveis_evento
        FROM eventos e
        JOIN turmas_filtradas tf ON tf.evento_id = e.id
        JOIN inscricoes i ON i.turma_id = tf.turma_id
        LEFT JOIN elegiveis_por_turma ept ON ept.evento_id = e.id AND ept.usuario_id = i.usuario_id
        GROUP BY e.id, e.titulo
      )
      SELECT re.evento_titulo AS titulo,
             re.total_inscritos_evento AS total_inscritos,
             re.total_elegiveis_evento AS total_presentes,
             CASE WHEN re.total_inscritos_evento > 0
                  THEN ROUND((re.total_elegiveis_evento::decimal / re.total_inscritos_evento::decimal) * 100, 2)
                  ELSE 0 END AS percentual
      FROM resumo_evento re
      ORDER BY re.evento_titulo;
      `,
      params
    );

    let totalInscritosGlobal = 0;
    let totalElegiveisGlobal = 0;

    for (const row of presencaQuery.rows) {
      totalInscritosGlobal += Number(row.total_inscritos) || 0;
      totalElegiveisGlobal += Number(row.total_presentes) || 0;
    }

    const percentualPresencaGlobal =
      totalInscritosGlobal > 0
        ? (totalElegiveisGlobal / totalInscritosGlobal) * 100
        : 0;

    /* =====================================================
       3️⃣ Eventos por mês / tipo
    ====================================================== */
    const eventosPorMesQ = await db.query(
      `
      SELECT TO_CHAR(t.data_inicio, 'Mon') AS mes,
             COUNT(*) AS total,
             EXTRACT(MONTH FROM t.data_inicio) AS mes_num
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY mes, mes_num
      ORDER BY mes_num;
      `,
      params
    );

    const eventosPorTipoQ = await db.query(
      `
      SELECT e.tipo, COUNT(DISTINCT e.id) AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY e.tipo
      ORDER BY e.tipo;
      `,
      params
    );

    /* =====================================================
       4️⃣ Resposta final
    ====================================================== */
    res.json({
      totalEventos: parseInt(totalEventosQ.rows[0]?.total || 0),
      inscritosUnicos: parseInt(inscritosUnicosQ.rows[0]?.total || 0),
      mediaAvaliacoes: parseFloat(mediaAvaliacoesQ.rows[0]?.media_evento || 0),
      mediainstrutor: parseFloat(mediainstrutorQ.rows[0]?.media_instrutor || 0),
      percentualPresenca: Number(percentualPresencaGlobal.toFixed(2)),

      eventosPorMes: formatarGrafico(eventosPorMesQ.rows || [], "mes"),
      eventosPorTipo: formatarGrafico(eventosPorTipoQ.rows || [], "tipo"),
      presencaPorEvento: formatarGrafico(presencaQuery.rows || [], "titulo"),
    });
  } catch (error) {
    console.error("❌ Erro ao gerar dashboard:", error);
    res.status(500).json({ erro: "Erro ao gerar dashboard" });
  }
}

module.exports = { obterDashboard };
