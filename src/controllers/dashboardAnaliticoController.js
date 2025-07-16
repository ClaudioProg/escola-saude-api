const db = require("../db");
const {
  formatarGrafico,
  formatarGraficoPresenca,
  calcularMediaPresenca,
} = require("../utils/graficos");

/**
 * 📊 Gera os dados para o painel analítico (administrador), com filtros por ano, mês e tipo de evento.
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
    // Total de eventos distintos (com base nas turmas)
    const totalEventos = await db.query(
      `SELECT COUNT(DISTINCT e.id)
       FROM eventos e
       JOIN turmas t ON t.evento_id = e.id
       ${where}`,
      params
    );

    // Total de inscritos únicos
    const inscritosUnicos = await db.query(
      `SELECT COUNT(DISTINCT i.usuario_id)
       FROM inscricoes i
       JOIN turmas t ON i.turma_id = t.id
       JOIN eventos e ON t.evento_id = e.id
       ${where}`,
      params
    );

    // Média das notas do evento (exclui desempenho_instrutor)
    const mediaAvaliacoes = await db.query(
      `SELECT ROUND(AVG((
          COALESCE(CASE a.divulgacao_evento WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.recepcao WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.credenciamento WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.material_apoio WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.pontualidade WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.sinalizacao_local WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.conteudo_temas WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.estrutura_local WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.acessibilidade WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.limpeza WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.inscricao_online WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.exposicao_trabalhos WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.apresentacao_oral_mostra WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.apresentacao_tcrs WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0) +
          COALESCE(CASE a.oficinas WHEN 'Ótimo' THEN 5 WHEN 'Bom' THEN 4 WHEN 'Regular' THEN 3 WHEN 'Ruim' THEN 2 WHEN 'Péssimo' THEN 1 ELSE NULL END, 0)
        )::numeric /
        (
          (CASE WHEN a.divulgacao_evento IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.recepcao IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.credenciamento IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.material_apoio IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.pontualidade IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.sinalizacao_local IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.conteudo_temas IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.estrutura_local IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.acessibilidade IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.limpeza IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.inscricao_online IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.exposicao_trabalhos IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.apresentacao_oral_mostra IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.apresentacao_tcrs IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN a.oficinas IS NOT NULL THEN 1 ELSE 0 END)
        )::numeric
      ), 2) as media_evento
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}`,
      params
    );

    // Média do desempenho do instrutor
    const mediainstrutor = await db.query(
      `SELECT ROUND(AVG(
          CASE a.desempenho_instrutor
            WHEN 'Ótimo' THEN 5
            WHEN 'Bom' THEN 4
            WHEN 'Regular' THEN 3
            WHEN 'Ruim' THEN 2
            WHEN 'Péssimo' THEN 1
            ELSE NULL
          END
        )::numeric, 2) as media_instrutor
       FROM avaliacoes a
       JOIN turmas t ON a.turma_id = t.id
       JOIN eventos e ON t.evento_id = e.id
       ${where}`,
      params
    );

    // Presença por evento
    const presencaPorEvento = await db.query(
      `SELECT 
         e.titulo, 
         COUNT(p.*) AS total_presentes, 
         COUNT(DISTINCT i.usuario_id) AS total_inscritos
       FROM eventos e
       JOIN turmas t ON t.evento_id = e.id
       LEFT JOIN inscricoes i ON i.turma_id = t.id
       LEFT JOIN presencas p 
         ON p.usuario_id = i.usuario_id 
         AND p.turma_id = t.id 
         AND p.presente = true
       ${where}
       GROUP BY e.titulo`,
      params
    );

    // Eventos por mês
    const eventosPorMes = await db.query(
      `SELECT TO_CHAR(t.data_inicio, 'Mon') as mes, COUNT(*) as total
       FROM eventos e
       JOIN turmas t ON t.evento_id = e.id
       ${where}
       GROUP BY mes ORDER BY MIN(t.data_inicio)`,
      params
    );

    // Eventos por tipo
    const eventosPorTipo = await db.query(
      `SELECT e.tipo, COUNT(DISTINCT e.id) as total
       FROM eventos e
       JOIN turmas t ON t.evento_id = e.id
       ${where}
       GROUP BY e.tipo`,
      params
    );

    res.json({
      totalEventos: parseInt(totalEventos.rows[0]?.count || 0),
      inscritosUnicos: parseInt(inscritosUnicos.rows[0]?.count || 0),
      mediaAvaliacoes: parseFloat(mediaAvaliacoes.rows[0]?.media_evento || 0),
      mediainstrutor: parseFloat(mediainstrutor.rows[0]?.media_instrutor || 0),
      percentualPresenca: calcularMediaPresenca(presencaPorEvento.rows && presencaPorEvento.rows.length ? presencaPorEvento.rows : []),
      eventosPorMes: formatarGrafico(eventosPorMes.rows && eventosPorMes.rows.length ? eventosPorMes.rows : [], "mes"),
      eventosPorTipo: formatarGrafico(eventosPorTipo.rows && eventosPorTipo.rows.length ? eventosPorTipo.rows : [], "tipo"),
      presencaPorEvento: formatarGraficoPresenca(presencaPorEvento.rows && presencaPorEvento.rows.length ? presencaPorEvento.rows : []),
    });
  } catch (error) {
    console.error("❌ Erro ao gerar dashboard:", error);
    res.status(500).json({ erro: "Erro ao gerar dashboard" });
  }
}

module.exports = {
  obterDashboard,
};
