// ✅ src/controllers/relatoriosController.js
const db = require("../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/* -----------------------------------------------------------
 * Normaliza filtros vindos do frontend
 * - Suporta:
 *   - query: evento, instrutor, unidade, from, to
 *   - body:  filtros: { eventoId, instrutorId, unidadeId, periodo: [from,to] }
 * ----------------------------------------------------------- */
function normalizarFiltros({ query = {}, filtros = {} }) {
  // Prioriza os campos de "filtros" (POST /exportar). Se não houver, usa query.
  const use = Object.keys(filtros || {}).length ? filtros : query;

  const evento =
    use.evento ?? use.eventoId ?? use.evento_id ?? null;
  const instrutor =
    use.instrutor ?? use.instrutorId ?? use.instrutor_id ?? null;
  const unidade =
    use.unidade ?? use.unidadeId ?? use.unidade_id ?? null;

  // período pode chegar como periodo: [from, to] (ISO)
  // ou from/to diretamente
  let from = use.from ?? null;
  let to = use.to ?? null;

  if (Array.isArray(use.periodo) && use.periodo.length === 2) {
    from = use.periodo[0] || null;
    to = use.periodo[1] || null;
  }

  // Garante strings "limpas" ou null
  return {
    evento: evento ? String(evento) : null,
    instrutor: instrutor ? String(instrutor) : null,
    unidade: unidade ? String(unidade) : null,
    from: from || null,
    to: to || null,
  };
}

/* -----------------------------------------------------------
 * Monta SQL base compartilhado (JSON e exportações)
 * - Conta inscritos de forma correta (DISTINCT)
 * - Soma presenças verdadeiras
 * - Agrupamento por turma + evento + instrutor
 * ----------------------------------------------------------- */
function montarSQLBaseEFiltros({ evento, instrutor, unidade, from, to }) {
  // OBS: usamos COUNT(DISTINCT i.usuario_id) para não inflar inscritos
  // com o JOIN de presenças. E somamos booleanos de presença.
  let sql = `
    SELECT 
      e.id            AS evento_id,
      e.titulo        AS evento,
      u.id            AS instrutor_id,
      u.nome          AS instrutor,
      t.id            AS turma_id,
      t.nome          AS turma,
      t.data_inicio   AS data_inicio,
      t.data_fim      AS data_fim,
      COUNT(DISTINCT i.usuario_id)                                 AS inscritos,
      COALESCE(SUM(CASE WHEN ps.presente THEN 1 ELSE 0 END), 0)    AS presencas
    FROM eventos e
      JOIN turmas t           ON t.evento_id = e.id
      JOIN evento_instrutor ei ON ei.evento_id = e.id
      JOIN usuarios u          ON u.id = ei.instrutor_id
      LEFT JOIN inscricoes i   ON i.turma_id = t.id
      LEFT JOIN presencas ps   ON ps.turma_id = t.id
                              AND ps.usuario_id = i.usuario_id
    WHERE 1=1
  `;

  const params = [];

  if (evento)   { params.push(evento);   sql += ` AND e.id = $${params.length}`; }
  if (instrutor){ params.push(instrutor);sql += ` AND u.id = $${params.length}`; }
  if (unidade)  { params.push(unidade);  sql += ` AND t.unidade_id = $${params.length}`; }
  if (from)     { params.push(from);     sql += ` AND t.data_inicio >= $${params.length}`; }
  if (to)       { params.push(to);       sql += ` AND t.data_inicio <= $${params.length}`; }

  sql += `
    GROUP BY 
      e.id, e.titulo, u.id, u.nome, t.id, t.nome, t.data_inicio, t.data_fim
    ORDER BY t.data_inicio DESC, e.titulo ASC, u.nome ASC
  `;

  return { sql, params };
}

/* -----------------------------------------------------------
 * 1) GET /api/relatorios
 * Gera relatório em JSON
 * ----------------------------------------------------------- */
async function gerarRelatorios(req, res) {
  try {
    const filtros = normalizarFiltros({ query: req.query });
    const { sql, params } = montarSQLBaseEFiltros(filtros);

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao gerar relatório:", err.message);
    res.status(500).json({ erro: "Erro ao gerar relatório." });
  }
}

/* -----------------------------------------------------------
 * 2) POST /api/relatorios/exportar
 * Exporta relatório Excel/PDF
 * Body: { filtros: {...}, formato: "excel"|"pdf" }
 * ----------------------------------------------------------- */
async function exportarRelatorios(req, res) {
  try {
    const { formato } = req.body || {};
    const filtros = normalizarFiltros({ filtros: (req.body && req.body.filtros) || {} });
    const { sql, params } = montarSQLBaseEFiltros(filtros);

    const { rows } = await db.query(sql, params);

    if (formato === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Relatório");

      sheet.columns = [
        { header: "Evento",       key: "evento",       width: 32 },
        { header: "Instrutor",    key: "instrutor",    width: 28 },
        { header: "Turma",        key: "turma",        width: 28 },
        { header: "Data Início",  key: "data_inicio",  width: 16 },
        { header: "Data Fim",     key: "data_fim",     width: 16 },
        { header: "Inscritos",    key: "inscritos",    width: 12 },
        { header: "Presenças",    key: "presencas",    width: 12 },
      ];

      rows.forEach((row) => {
        sheet.addRow({
          evento: row.evento,
          instrutor: row.instrutor,
          turma: row.turma,
          data_inicio: row.data_inicio ? format(new Date(row.data_inicio), "dd/MM/yyyy") : "",
          data_fim: row.data_fim ? format(new Date(row.data_fim), "dd/MM/yyyy") : "",
          inscritos: Number(row.inscritos) || 0,
          presencas: Number(row.presencas) || 0,
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.xlsx");
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (formato === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
      doc.pipe(res);

      const formatarData = (dataISO) =>
        dataISO ? format(new Date(dataISO), "dd/MM/yyyy", { locale: ptBR }) : "";

      // Título
      doc
        .fontSize(16)
        .fillColor("#1F4E79")
        .text("Relatório de Eventos", { align: "center" })
        .moveDown(1.2);

      // Faixa de filtros (se houver)
      const filtrosLine = [];
      if (filtros.evento) filtrosLine.push(`Evento: #${filtros.evento}`);
      if (filtros.instrutor) filtrosLine.push(`Instrutor: #${filtros.instrutor}`);
      if (filtros.unidade) filtrosLine.push(`Unidade: #${filtros.unidade}`);
      if (filtros.from || filtros.to) {
        filtrosLine.push(
          `Período: ${filtros.from ? formatarData(filtros.from) : "—"} a ${filtros.to ? formatarData(filtros.to) : "—"}`
        );
      }
      if (filtrosLine.length) {
        doc.fontSize(10).fillColor("#333").text(filtrosLine.join("  |  "), { align: "center" }).moveDown(0.8);
      }

      // Conteúdo
      rows.forEach((row, i) => {
        doc
          .fontSize(12)
          .fillColor("black")
          .font("Helvetica-Bold")
          .text(`Evento ${i + 1}`, { underline: true })
          .moveDown(0.3);

        doc.font("Helvetica-Bold").text("Evento:", { continued: true });
        doc.font("Helvetica").text(` ${row.evento}`);

        doc.font("Helvetica-Bold").text("Instrutor:", { continued: true });
        doc.font("Helvetica").text(` ${row.instrutor}`);

        doc.font("Helvetica-Bold").text("Turma:", { continued: true });
        doc.font("Helvetica").text(` ${row.turma}`);

        doc.font("Helvetica-Bold").text("Data de Início:", { continued: true });
        doc.font("Helvetica").text(` ${formatarData(row.data_inicio)}`);

        doc.font("Helvetica-Bold").text("Data de Fim:", { continued: true });
        doc.font("Helvetica").text(` ${formatarData(row.data_fim)}`);

        doc.font("Helvetica-Bold").text("Inscritos:", { continued: true });
        doc.font("Helvetica").text(` ${row.inscritos}`);

        doc.font("Helvetica-Bold").text("Presenças:", { continued: true });
        doc.font("Helvetica").text(` ${row.presencas}`);

        doc.moveDown(1.1);
      });

      doc.end();
      return;
    }

    return res.status(400).json({ erro: "Formato inválido." });
  } catch (err) {
    console.error("❌ Erro ao exportar relatório:", err.message);
    res.status(500).json({ erro: "Erro ao exportar relatório." });
  }
}

/* -----------------------------------------------------------
 * 3) GET /api/relatorios/opcoes
 * Opções para selects do frontend
 * ----------------------------------------------------------- */
async function opcoesRelatorios(req, res) {
  try {
    const eventos = await db.query(`SELECT id, titulo FROM eventos ORDER BY titulo`);
    const instrutor = await db.query(`
      SELECT DISTINCT u.id, u.nome
      FROM usuarios u
      JOIN evento_instrutor ei ON ei.instrutor_id = u.id
      ORDER BY u.nome
    `);
    const unidades = await db.query(`SELECT id, nome FROM unidades ORDER BY nome`);

    res.json({
      eventos: eventos.rows,
      instrutor: instrutor.rows,
      unidades: unidades.rows,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar opções de filtros:", err.message);
    res.status(500).json({ erro: "Erro ao buscar opções de filtros." });
  }
}

module.exports = {
  gerarRelatorios,
  exportarRelatorios,
  opcoesRelatorios,
};
