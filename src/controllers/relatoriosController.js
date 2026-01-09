// ✅ src/controllers/relatoriosController.js
/* eslint-disable no-console */
const db = require("../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/* ────────────────────────────────────────────────────────────────
   Config / Logs
─────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";
const log = (...a) => !IS_PROD && console.log("[relatorios]", ...a);
const warn = (...a) => !IS_PROD && console.warn("[relatorios][WARN]", ...a);
const errlog = (...a) => console.error("[relatorios][ERR]", ...a);

function rid() {
  return `rid=${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ────────────────────────────────────────────────────────────────
   Datas: date-only SAFE (sem pulo de fuso)
   - Entrada esperada: "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM..."
   - Saída: "dd/MM/yyyy"
─────────────────────────────────────────────────────────────── */
function ymdOnly(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  // Se vier Date (timestamp do banco), converte para ISO e corta
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function ddmmyyyyFromYMD(ymd) {
  if (!ymd || typeof ymd !== "string" || ymd.length < 10) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/* ────────────────────────────────────────────────────────────────
   Helpers: validação / normalização
─────────────────────────────────────────────────────────────── */
function asIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normDateOnly(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/* -----------------------------------------------------------
 * Normaliza filtros vindos do frontend
 * - Suporta:
 *   - query: evento, instrutor, unidade, from, to
 *   - body:  filtros: { eventoId, instrutorId, unidadeId, periodo: [from,to] }
 * ----------------------------------------------------------- */
function normalizarFiltros({ query = {}, filtros = {} }) {
  const use = Object.keys(filtros || {}).length ? filtros : query;

  const evento = asIntOrNull(use.evento ?? use.eventoId ?? use.evento_id);
  const instrutor = asIntOrNull(use.instrutor ?? use.instrutorId ?? use.instrutor_id);
  const unidade = asIntOrNull(use.unidade ?? use.unidadeId ?? use.unidade_id);

  let from = use.from ?? null;
  let to = use.to ?? null;

  if (Array.isArray(use.periodo) && use.periodo.length === 2) {
    from = use.periodo[0] || null;
    to = use.periodo[1] || null;
  }

  from = normDateOnly(from);
  to = normDateOnly(to);

  // se inverteram datas, corrige
  if (from && to && from > to) [from, to] = [to, from];

  return { evento, instrutor, unidade, from, to };
}

/* -----------------------------------------------------------
 * Monta SQL base compartilhado (JSON e exportações)
 *
 * ⚠️ Importante:
 * - unidade_id no seu schema está em EVENTOS (eventos.unidade_id).
 *   Alguns bancos legados podem ter em turmas. Vamos suportar ambos.
 *
 * - Presenças:
 *   Em vez de somar linhas de presencas (pode inflar com duplicidade),
 *   contamos PRESENÇAS TRUE únicas por usuario_id + data_presenca.
 * ----------------------------------------------------------- */
async function detectarColunasUnidade() {
  // Cache simples em memória
  if (detectarColunasUnidade._cache) return detectarColunasUnidade._cache;

  try {
    const q = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND column_name='unidade_id'
        AND table_name IN ('turmas','eventos')
    `);

    const hasTurmas = q.rows.some((r) => r.table_name === "turmas");
    const hasEventos = q.rows.some((r) => r.table_name === "eventos");

    detectarColunasUnidade._cache = { hasTurmas, hasEventos };
    return detectarColunasUnidade._cache;
  } catch (e) {
    // fallback seguro
    detectarColunasUnidade._cache = { hasTurmas: false, hasEventos: true };
    return detectarColunasUnidade._cache;
  }
}

async function montarSQLBaseEFiltros({ evento, instrutor, unidade, from, to }) {
  const { hasTurmas, hasEventos } = await detectarColunasUnidade();

  // coluna de unidade preferida: eventos.unidade_id (se existir)
  // fallback: turmas.unidade_id (se existir)
  const unidadeCol =
    (hasEventos && "e.unidade_id") ||
    (hasTurmas && "t.unidade_id") ||
    null;

  let sql = `
    WITH pres_ag AS (
      SELECT
        p.turma_id,
        p.usuario_id,
        COUNT(DISTINCT p.data_presenca::date) FILTER (WHERE p.presente IS TRUE) AS pres_true
      FROM presencas p
      GROUP BY p.turma_id, p.usuario_id
    )
    SELECT 
      e.id          AS evento_id,
      e.titulo      AS evento,
      u.id          AS instrutor_id,
      u.nome        AS instrutor,
      t.id          AS turma_id,
      t.nome        AS turma,
      t.data_inicio AS data_inicio,
      t.data_fim    AS data_fim,

      COUNT(DISTINCT i.usuario_id)                                AS inscritos,
      COALESCE(SUM(COALESCE(pa.pres_true, 0)), 0)                 AS presencas

    FROM eventos e
      JOIN turmas t             ON t.evento_id = e.id
      JOIN evento_instrutor ei  ON ei.evento_id = e.id
      JOIN usuarios u           ON u.id = ei.instrutor_id
      LEFT JOIN inscricoes i    ON i.turma_id = t.id
      LEFT JOIN pres_ag pa      ON pa.turma_id = t.id AND pa.usuario_id = i.usuario_id
    WHERE 1=1
  `;

  const params = [];

  if (evento) {
    params.push(evento);
    sql += ` AND e.id = $${params.length}`;
  }

  if (instrutor) {
    params.push(instrutor);
    sql += ` AND u.id = $${params.length}`;
  }

  if (unidade && unidadeCol) {
    params.push(unidade);
    sql += ` AND ${unidadeCol} = $${params.length}`;
  }

  // período (date-only): filtra por data_inicio da turma (mantém sua regra atual)
  if (from) {
    params.push(from);
    sql += ` AND t.data_inicio::date >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    sql += ` AND t.data_inicio::date <= $${params.length}::date`;
  }

  sql += `
    GROUP BY 
      e.id, e.titulo,
      u.id, u.nome,
      t.id, t.nome, t.data_inicio, t.data_fim
    ORDER BY t.data_inicio DESC NULLS LAST, e.titulo ASC, u.nome ASC
  `;

  return { sql, params };
}

/* ────────────────────────────────────────────────────────────────
   1) GET /api/relatorios  (JSON)
─────────────────────────────────────────────────────────────── */
async function gerarRelatorios(req, res) {
  const requestId = rid();
  try {
    const filtros = normalizarFiltros({ query: req.query });
    const { sql, params } = await montarSQLBaseEFiltros(filtros);

    log(requestId, "gerarRelatorios filtros:", filtros);
    const result = await db.query(sql, params);

    return res.json({
      ok: true,
      data: result.rows,
      meta: { requestId, total: result.rows.length, filtros },
    });
  } catch (err) {
    errlog(requestId, "gerarRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao gerar relatório.", requestId });
  }
}

/* ────────────────────────────────────────────────────────────────
   2) POST /api/relatorios/exportar
   Body: { filtros: {...}, formato: "excel"|"pdf" }
─────────────────────────────────────────────────────────────── */
async function exportarRelatorios(req, res) {
  const requestId = rid();

  try {
    const formato = String(req.body?.formato || "").toLowerCase().trim();
    const filtros = normalizarFiltros({ filtros: req.body?.filtros || {} });

    const { sql, params } = await montarSQLBaseEFiltros(filtros);
    const { rows } = await db.query(sql, params);

    log(requestId, "exportarRelatorios formato:", formato, "filtros:", filtros, "rows:", rows.length);

    if (formato === "excel") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Escola da Saúde";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Relatório", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      sheet.columns = [
        { header: "Evento", key: "evento", width: 38 },
        { header: "Instrutor", key: "instrutor", width: 28 },
        { header: "Turma", key: "turma", width: 28 },
        { header: "Data Início", key: "data_inicio", width: 14 },
        { header: "Data Fim", key: "data_fim", width: 14 },
        { header: "Inscritos", key: "inscritos", width: 12 },
        { header: "Presenças", key: "presencas", width: 12 },
      ];

      // Estilo do header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: "middle" };
      sheet.autoFilter = { from: "A1", to: "G1" };

      for (const row of rows) {
        sheet.addRow({
          evento: row.evento,
          instrutor: row.instrutor,
          turma: row.turma,
          data_inicio: ddmmyyyyFromYMD(ymdOnly(row.data_inicio)),
          data_fim: ddmmyyyyFromYMD(ymdOnly(row.data_fim)),
          inscritos: Number(row.inscritos) || 0,
          presencas: Number(row.presencas) || 0,
        });
      }

      // Formatos numéricos
      sheet.getColumn("inscritos").numFmt = "0";
      sheet.getColumn("presencas").numFmt = "0";

      // Rodapé com meta
      sheet.addRow([]);
      sheet.addRow(["requestId", requestId]);
      sheet.addRow(["gerado_em", new Date().toISOString()]);
      sheet.addRow(["filtros", JSON.stringify(filtros)]);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.xlsx");

      await workbook.xlsx.write(res);
      return res.end();
    }

    if (formato === "pdf") {
      const doc = new PDFDocument({ margin: 36, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
      doc.pipe(res);

      const fmt = (data) => {
        const ymd = ymdOnly(data);
        return ymd ? ddmmyyyyFromYMD(ymd) : "";
      };

      // Cabeçalho
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#0F172A")
        .text("Relatório de Eventos", { align: "center" });

      doc
        .moveDown(0.3)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#475569")
        .text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}  •  ${requestId}`, {
          align: "center",
        });

      // Filtros
      const filtrosLine = [];
      if (filtros.evento) filtrosLine.push(`Evento #${filtros.evento}`);
      if (filtros.instrutor) filtrosLine.push(`Instrutor #${filtros.instrutor}`);
      if (filtros.unidade) filtrosLine.push(`Unidade #${filtros.unidade}`);
      if (filtros.from || filtros.to) {
        filtrosLine.push(
          `Período: ${filtros.from ? ddmmyyyyFromYMD(filtros.from) : "—"} a ${filtros.to ? ddmmyyyyFromYMD(filtros.to) : "—"}`
        );
      }
      if (filtrosLine.length) {
        doc
          .moveDown(0.6)
          .fontSize(10)
          .fillColor("#111827")
          .text(filtrosLine.join("  |  "), { align: "center" });
      }

      doc.moveDown(0.8);

      // Resumo
      const totalInscritos = rows.reduce((a, r) => a + (Number(r.inscritos) || 0), 0);
      const totalPresencas = rows.reduce((a, r) => a + (Number(r.presencas) || 0), 0);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0F172A")
        .text("Resumo");

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#111827")
        .text(`Registros: ${rows.length}   •   Inscritos: ${totalInscritos}   •   Presenças: ${totalPresencas}`);

      doc.moveDown(0.8);

      // Conteúdo (cards)
      rows.forEach((row, i) => {
        // Quebra de página (simples)
        if (doc.y > 720) doc.addPage();

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#0F172A")
          .text(`${i + 1}. ${row.evento}`);

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111827")
          .text(`Instrutor: ${row.instrutor}`)
          .text(`Turma: ${row.turma}`)
          .text(`Período: ${fmt(row.data_inicio)} a ${fmt(row.data_fim)}`)
          .text(`Inscritos: ${Number(row.inscritos) || 0}   •   Presenças: ${Number(row.presencas) || 0}`);

        doc
          .moveDown(0.6)
          .strokeColor("#E2E8F0")
          .lineWidth(1)
          .moveTo(36, doc.y)
          .lineTo(559, doc.y)
          .stroke();

        doc.moveDown(0.6);
      });

      doc.end();
      return;
    }

    return res.status(400).json({
      ok: false,
      erro: "Formato inválido. Use 'excel' ou 'pdf'.",
      requestId,
    });
  } catch (err) {
    errlog(requestId, "exportarRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao exportar relatório.", requestId });
  }
}

/* ────────────────────────────────────────────────────────────────
   3) GET /api/relatorios/opcoes
   Opções para selects do frontend
─────────────────────────────────────────────────────────────── */
async function opcoesRelatorios(req, res) {
  const requestId = rid();
  try {
    const [eventos, instrutores, unidades] = await Promise.all([
      db.query(`SELECT id, titulo FROM eventos ORDER BY titulo`),
      db.query(`
        SELECT DISTINCT u.id, u.nome
        FROM usuarios u
        JOIN evento_instrutor ei ON ei.instrutor_id = u.id
        ORDER BY u.nome
      `),
      db.query(`SELECT id, nome FROM unidades ORDER BY nome`),
    ]);

    return res.json({
      ok: true,
      data: {
        eventos: eventos.rows,
        instrutores: instrutores.rows,
        unidades: unidades.rows,
      },
      meta: { requestId },
    });
  } catch (err) {
    errlog(requestId, "opcoesRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao buscar opções de filtros.", requestId });
  }
}

module.exports = {
  gerarRelatorios,
  exportarRelatorios,
  opcoesRelatorios,
};
