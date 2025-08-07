const db = require("../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// ---------- 1. Gera relatório em JSON
async function gerarRelatorios(req, res) {
  const { evento, instrutor, unidade, from, to } = req.query;

  let sql = `
  SELECT 
    e.titulo AS evento,
    u.nome AS instrutor,
    t.data_inicio,
    COUNT(i.*) AS inscritos,
    SUM(CASE WHEN ps.presente THEN 1 ELSE 0 END) AS presencas
  FROM eventos e
  JOIN turmas t ON t.evento_id = e.id
  JOIN evento_instrutor ei ON ei.evento_id = e.id
  JOIN usuarios u ON u.id = ei.instrutor_id
  LEFT JOIN inscricoes i ON i.turma_id = t.id
  LEFT JOIN presencas ps ON ps.usuario_id = i.usuario_id AND ps.turma_id = t.id
  WHERE u.perfil IN ('instrutor', 'administrador')
`;

  const params = [];

  if (evento)     { params.push(evento);     sql += ` AND e.id = $${params.length}`; }
  if (instrutor){ params.push(instrutor);sql += ` AND u.id = $${params.length}`; }
  if (unidade)    { params.push(unidade);    sql += ` AND t.unidade_id = $${params.length}`; }
  if (from)       { params.push(from);       sql += ` AND t.data_inicio >= $${params.length}`; }
  if (to)         { params.push(to);         sql += ` AND t.data_inicio <= $${params.length}`; }

  sql += ` GROUP BY e.titulo, u.nome, t.data_inicio ORDER BY t.data_inicio DESC`;

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao gerar relatório:", err.message);
    res.status(500).json({ erro: "Erro ao gerar relatório." });
  }
}

// ---------- 2. Exporta relatório Excel/PDF
async function exportarRelatorios(req, res) {
  const { filtros, formato } = req.body;
  const { evento, instrutor, unidade, from, to } = filtros;

  let sql = `
    SELECT 
      e.titulo AS evento,
      u.nome AS instrutor,
      t.data_inicio,
      COUNT(i.*) AS inscritos,
      SUM(CASE WHEN ps.presente THEN 1 ELSE 0 END) AS presencas
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    JOIN evento_instrutor ei ON ei.evento_id = e.id
    JOIN usuarios u ON u.id = ei.instrutor_id
    LEFT JOIN inscricoes i ON i.turma_id = t.id
    LEFT JOIN presencas ps ON ps.usuario_id = i.usuario_id AND ps.turma_id = t.id
    WHERE u.perfil IN ('instrutor', 'administrador')
  `;
  const params = [];

  if (evento)     { params.push(evento);     sql += ` AND e.id = $${params.length}`; }
  if (instrutor){ params.push(instrutor);sql += ` AND u.id = $${params.length}`; }
  if (unidade)    { params.push(unidade);    sql += ` AND t.unidade_id = $${params.length}`; }
  if (from)       { params.push(from);       sql += ` AND t.data_inicio >= $${params.length}`; }
  if (to)         { params.push(to);         sql += ` AND t.data_inicio <= $${params.length}`; }

  sql += ` GROUP BY e.titulo, u.nome, t.data_inicio ORDER BY t.data_inicio DESC`;

  try {
    const { rows } = await db.query(sql, params);

    if (formato === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Relatório");
      sheet.columns = [
        { header: "Evento", key: "evento" },
        { header: "instrutor", key: "instrutor" },
        { header: "Data Início", key: "data_inicio" },
        { header: "Inscritos", key: "inscritos" },
        { header: "Presenças", key: "presencas" },
      ];
      rows.forEach(row => {
        sheet.addRow({
          ...row,
          data_inicio: new Date(row.data_inicio).toLocaleDateString("pt-BR")
        });
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.xlsx");
      await workbook.xlsx.write(res);
      res.end();

    } else if (formato === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
      doc.pipe(res);

      const { format } = require("date-fns");
      const { ptBR } = require("date-fns/locale");
      const formatarData = (dataISO) => format(new Date(dataISO), "dd/MM/yyyy", { locale: ptBR });

      doc.fontSize(16)
        .fillColor("#1F4E79")
        .text("Relatório de Eventos", { align: "center" })
        .moveDown(1.5);

      rows.forEach((row, i) => {
        doc.fontSize(12).fillColor("black").text(`Evento ${i + 1}`, { underline: true, bold: true }).moveDown(0.3);
        doc.font("Helvetica-Bold").text("Evento:", { continued: true }).font("Helvetica").text(` ${row.evento}`);
        doc.font("Helvetica-Bold").text("instrutor:", { continued: true }).font("Helvetica").text(` ${row.instrutor}`);
        doc.font("Helvetica-Bold").text("Data de Início:", { continued: true }).font("Helvetica").text(` ${formatarData(row.data_inicio)}`);
        doc.font("Helvetica-Bold").text("Inscritos:", { continued: true }).font("Helvetica").text(` ${row.inscritos}`);
        doc.font("Helvetica-Bold").text("Presenças:", { continued: true }).font("Helvetica").text(` ${row.presencas}`);
        doc.moveDown(1.2);
      });

      doc.end();
    } else {
      res.status(400).json({ erro: "Formato inválido" });
    }

  } catch (err) {
    console.error("Erro ao exportar relatório:", err);
    res.status(500).json({ erro: "Erro ao exportar relatório" });
  }
}

// ---------- 3. Opções de filtro para frontend
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
    console.error("❌ Erro ao buscar opções de filtros:", err);
    res.status(500).json({ erro: "Erro ao buscar opções de filtros" });
  }
}

module.exports = {
  gerarRelatorios,
  exportarRelatorios,
  opcoesRelatorios
};
