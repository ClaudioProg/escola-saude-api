/* eslint-disable no-console */
// 📁 src/controllers/relatorioController.js — ÚNICO & PREMIUM
// - Consolida relatórios gerais + relatórios de presenças
// - Seguro para date-only, evita “pulos” de fuso
// - Mantém contratos/rotas existentes

const dbRaw = require("../db");
const db = dbRaw?.db ?? dbRaw; // compat: pg-pool (query) OU pg-promise (db)

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/* ────────────────────────────────────────────────────────────────
   Config / Logs
─────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";
const log   = (...a) => !IS_PROD && console.log("[relatorios]", ...a);
const warn  = (...a) => !IS_PROD && console.warn("[relatorios][WARN]", ...a);
const errlg = (...a) => console.error("[relatorios][ERR]", ...a);

const rid = () => `rid=${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* ────────────────────────────────────────────────────────────────
   Datas (date-only safe)
─────────────────────────────────────────────────────────────── */
function ymdOnly(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
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
function normDateOnly(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/* ────────────────────────────────────────────────────────────────
   Helpers comuns (valid/normalizers)
─────────────────────────────────────────────────────────────── */
function asIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
const toInt = asIntOrNull;

/* Normaliza filtros vindos do frontend (query/body) */
function normalizarFiltros({ query = {}, filtros = {} }) {
  const use = Object.keys(filtros || {}).length ? filtros : query;

  const evento    = asIntOrNull(use.evento ?? use.eventoId ?? use.evento_id);
  const instrutor = asIntOrNull(use.instrutor ?? use.instrutorId ?? use.instrutor_id);
  const unidade   = asIntOrNull(use.unidade ?? use.unidadeId ?? use.unidade_id);

  let from = use.from ?? null;
  let to   = use.to ?? null;

  if (Array.isArray(use.periodo) && use.periodo.length === 2) {
    from = use.periodo[0] || null;
    to   = use.periodo[1] || null;
  }

  from = normDateOnly(from);
  to   = normDateOnly(to);

  if (from && to && from > to) [from, to] = [to, from];
  return { evento, instrutor, unidade, from, to };
}

/* ────────────────────────────────────────────────────────────────
   Descoberta de colunas (unidade_id)
─────────────────────────────────────────────────────────────── */
async function detectarColunasUnidade() {
  if (detectarColunasUnidade._cache) return detectarColunasUnidade._cache;
  try {
    const q = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND column_name='unidade_id'
        AND table_name IN ('turmas','eventos')
    `);
    const hasTurmas  = q.rows.some((r) => r.table_name === "turmas");
    const hasEventos = q.rows.some((r) => r.table_name === "eventos");
    detectarColunasUnidade._cache = { hasTurmas, hasEventos };
    return detectarColunasUnidade._cache;
  } catch {
    detectarColunasUnidade._cache = { hasTurmas: false, hasEventos: true };
    return detectarColunasUnidade._cache;
  }
}

/* Monta SQL base (JSON/Export) */
async function montarSQLBaseEFiltros({ evento, instrutor, unidade, from, to }) {
  const { hasTurmas, hasEventos } = await detectarColunasUnidade();
  const unidadeCol =
    (hasEventos && "e.unidade_id") ||
    (hasTurmas  && "t.unidade_id") ||
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
      LEFT JOIN inscricao i    ON i.turma_id = t.id
      LEFT JOIN pres_ag pa      ON pa.turma_id = t.id AND pa.usuario_id = i.usuario_id
    WHERE 1=1
  `;

  const params = [];
  if (evento)    { params.push(evento);   sql += ` AND e.id = $${params.length}`; }
  if (instrutor) { params.push(instrutor);sql += ` AND u.id = $${params.length}`; }
  if (unidade && unidadeCol) {
    params.push(unidade);
    sql += ` AND ${unidadeCol} = $${params.length}`;
  }
  if (from) { params.push(from); sql += ` AND t.data_inicio::date >= $${params.length}::date`; }
  if (to)   { params.push(to);   sql += ` AND t.data_inicio::date <= $${params.length}::date`; }

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
   A) RELATÓRIOS (JSON / Exportar / Opções)
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
    errlg(requestId, "gerarRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao gerar relatório.", requestId });
  }
}

async function exportarRelatorios(req, res) {
  const requestId = rid();

  try {
    const formato = String(req.body?.formato || "").toLowerCase().trim();
    const filtros = normalizarFiltros({ filtros: req.body?.filtros || {} });
    const { sql, params } = await montarSQLBaseEFiltros(filtros);
    const { rows } = await db.query(sql, params);

    log(requestId, "exportarRelatorios:", formato, "rows:", rows.length, "filtros:", filtros);

    if (formato === "excel") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Escola da Saúde";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Relatório", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.columns = [
        { header: "Evento",      key: "evento",      width: 38 },
        { header: "Instrutor",   key: "instrutor",   width: 28 },
        { header: "Turma",       key: "turma",       width: 28 },
        { header: "Data Início", key: "data_inicio", width: 14 },
        { header: "Data Fim",    key: "data_fim",    width: 14 },
        { header: "Inscritos",   key: "inscritos",   width: 12 },
        { header: "Presenças",   key: "presencas",   width: 12 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: "middle" };
      sheet.autoFilter = { from: "A1", to: "G1" };

      for (const r of rows) {
        sheet.addRow({
          evento: r.evento,
          instrutor: r.instrutor,
          turma: r.turma,
          data_inicio: ddmmyyyyFromYMD(ymdOnly(r.data_inicio)),
          data_fim: ddmmyyyyFromYMD(ymdOnly(r.data_fim)),
          inscritos: Number(r.inscritos) || 0,
          presencas: Number(r.presencas) || 0,
        });
      }
      sheet.getColumn("inscritos").numFmt = "0";
      sheet.getColumn("presencas").numFmt = "0";
      sheet.addRow([]); sheet.addRow(["requestId", requestId]);
      sheet.addRow(["gerado_em", new Date().toISOString()]);
      sheet.addRow(["filtros", JSON.stringify(filtros)]);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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
        const s = ymdOnly(data);
        return s ? ddmmyyyyFromYMD(s) : "";
      };

      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0F172A").text("Relatório de Eventos", { align: "center" });
      doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#475569")
        .text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}  •  ${requestId}`, { align: "center" });

      const filtrosLine = [];
      if (filtros.evento)    filtrosLine.push(`Evento #${filtros.evento}`);
      if (filtros.instrutor) filtrosLine.push(`Instrutor #${filtros.instrutor}`);
      if (filtros.unidade)   filtrosLine.push(`Unidade #${filtros.unidade}`);
      if (filtros.from || filtros.to) {
        filtrosLine.push(`Período: ${filtros.from ? ddmmyyyyFromYMD(filtros.from) : "—"} a ${filtros.to ? ddmmyyyyFromYMD(filtros.to) : "—"}`);
      }
      if (filtrosLine.length) {
        doc.moveDown(0.6).fontSize(10).fillColor("#111827").text(filtrosLine.join("  |  "), { align: "center" });
      }
      doc.moveDown(0.8);

      const totalInscritos = rows.reduce((a, r) => a + (Number(r.inscritos) || 0), 0);
      const totalPresencas = rows.reduce((a, r) => a + (Number(r.presencas) || 0), 0);

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0F172A").text("Resumo");
      doc.font("Helvetica").fontSize(10).fillColor("#111827")
        .text(`Registros: ${rows.length}   •   Inscritos: ${totalInscritos}   •   Presenças: ${totalPresencas}`);
      doc.moveDown(0.8);

      rows.forEach((row, i) => {
        if (doc.y > 720) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0F172A").text(`${i + 1}. ${row.evento}`);
        doc.font("Helvetica").fontSize(10).fillColor("#111827")
          .text(`Instrutor: ${row.instrutor}`)
          .text(`Turma: ${row.turma}`)
          .text(`Período: ${fmt(row.data_inicio)} a ${fmt(row.data_fim)}`)
          .text(`Inscritos: ${Number(row.inscritos) || 0}   •   Presenças: ${Number(row.presencas) || 0}`);
        doc.moveDown(0.6).strokeColor("#E2E8F0").lineWidth(1).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.6);
      });

      doc.end();
      return;
    }

    return res.status(400).json({ ok: false, erro: "Formato inválido. Use 'excel' ou 'pdf'.", requestId });
  } catch (err) {
    errlg(requestId, "exportarRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao exportar relatório.", requestId });
  }
}

async function opcaoRelatorios(_req, res) {
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
    errlg(requestId, "opcaoRelatorios:", err?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao buscar opções de filtros.", requestId });
  }
}

/* ────────────────────────────────────────────────────────────────
   B) RELATÓRIO DE PRESENÇAS (Turma/Eventos)
   — Baseado na versão mais robusta (datas_turma > fallback)
─────────────────────────────────────────────────────────────── */
async function hasDatasTurma(turmaId) {
  const q = await db.query(
    `SELECT EXISTS(SELECT 1 FROM datas_turma WHERE turma_id = $1) AS tem`,
    [turmaId]
  );
  return !!q.rows?.[0]?.tem;
}

async function getDatasDaTurmaYMD(turmaId) {
  const temDT = await hasDatasTurma(turmaId);
  const sql = temDT
    ? `
      SELECT to_char(dt.data::date, 'YYYY-MM-DD') AS data
      FROM datas_turma dt
      WHERE dt.turma_id = $1
      ORDER BY dt.data ASC
    `
    : `
      WITH t AS (
        SELECT data_inicio::date AS di, data_fim::date AS df
        FROM turmas
        WHERE id = $1
        LIMIT 1
      )
      SELECT to_char(gs::date, 'YYYY-MM-DD') AS data
      FROM t
      CROSS JOIN LATERAL generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY gs ASC
    `;
  const r = await db.query(sql, [turmaId]);
  return (r.rows || []).map((x) => x.data).filter(Boolean);
}

async function getTurmaInfo(turmaId) {
  const q = await db.query(
    `
    SELECT
      t.id AS turma_id,
      t.nome AS turma_nome,
      t.evento_id,
      e.titulo AS evento_titulo,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(t.data_fim::date,   'YYYY-MM-DD')  AS data_fim,
      to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
      to_char(t.horario_fim::time,    'HH24:MI') AS horario_fim
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );
  return q.rows?.[0] || null;
}

/** 📄 GET /api/relatorios/presencas/turma/:turma_id */
async function presencasPorTurma(req, res) {
  const turmaId = toInt(req.params.turma_id);
  if (!turmaId) return res.status(400).json({ ok: false, erro: "TURMA_ID_INVALIDO" });

  const requestId = rid();
  try {
    const turma = await getTurmaInfo(turmaId);
    if (!turma) return res.status(404).json({ ok: false, erro: "TURMA_NAO_ENCONTRADA" });

    const datas = await getDatasDaTurmaYMD(turmaId);
    if (!datas.length) {
      return res.json({ ok: true, rid: requestId, turma, datas: [], lista: [] });
    }

    const insc = await db.query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC, u.id ASC
      `,
      [turmaId]
    );

    const pres = await db.query(
      `
      SELECT
        p.usuario_id,
        to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
        BOOL_OR(p.presente) AS presente
      FROM presencas p
      WHERE p.turma_id = $1
        AND p.usuario_id = ANY($2::int[])
      GROUP BY p.usuario_id, p.data_presenca::date
      `,
      [turmaId, insc.rows.map((r) => Number(r.usuario_id))]
    );

    const presMap = new Map(
      (pres.rows || []).map((r) => [`${r.usuario_id}|${r.data}`, r.presente === true])
    );

    const lista = [];
    for (const u of insc.rows) {
      for (const d of datas) {
        const key = `${u.usuario_id}|${d}`;
        lista.push({
          usuario_id: u.usuario_id,
          nome: u.nome,
          cpf: u.cpf,
          data: d,
          presente: presMap.get(key) === true,
        });
      }
    }

    return res.json({ ok: true, rid: requestId, turma, datas, lista });
  } catch (err) {
    errlg("[presencasPorTurma]", { requestId, turmaId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_TURMA", rid: requestId });
  }
}

/** 📄 GET /api/relatorios/presencas/turma/:turma_id/detalhado */
async function presencasPorTurmaDetalhado(req, res) {
  const turmaId = toInt(req.params.turma_id);
  if (!turmaId) return res.status(400).json({ ok: false, erro: "TURMA_ID_INVALIDO" });

  const requestId = rid();
  try {
    const turma = await getTurmaInfo(turmaId);
    if (!turma) return res.status(404).json({ ok: false, erro: "TURMA_NAO_ENCONTRADA" });

    const result = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
        BOOL_OR(p.presente) AS presente,
        MAX(p.confirmado_em) AS confirmado_em
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.usuario_id = u.id
       AND p.turma_id   = i.turma_id
      WHERE i.turma_id = $1
      GROUP BY u.id, u.nome, u.cpf, p.data_presenca::date
      ORDER BY u.nome ASC, data ASC NULLS LAST
      `,
      [turmaId]
    );

    const lista = (result.rows || []).filter((r) => r.data != null);
    return res.json({ ok: true, rid: requestId, turma, lista });
  } catch (err) {
    errlg("[presencasPorTurmaDetalhado]", { requestId, turmaId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_TURMA_DETALHADO", rid: requestId });
  }
}

/** 📄 GET /api/relatorios/presencas/evento/:evento_id */
async function presencasPorEvento(req, res) {
  const eventoId = toInt(req.params.evento_id);
  if (!eventoId) return res.status(400).json({ ok: false, erro: "EVENTO_ID_INVALIDO" });

  const requestId = rid();
  try {
    const ev = await db.query(
      `SELECT id AS evento_id, COALESCE(titulo,'Evento') AS titulo FROM eventos WHERE id = $1 LIMIT 1`,
      [eventoId]
    );
    if (!ev.rowCount) return res.status(404).json({ ok: false, erro: "EVENTO_NAO_ENCONTRADO" });

    const baseDatas = await db.query(
      `
      WITH turmas_ev AS (
        SELECT id, data_inicio::date AS di, data_fim::date AS df
        FROM turmas
        WHERE evento_id = $1
      ),
      dt AS (
        SELECT turma_id, data::date AS d
        FROM datas_turma
        WHERE turma_id IN (SELECT id FROM turmas_ev)
      ),
      ds AS (
        SELECT te.id AS turma_id, gs::date AS d
        FROM turmas_ev te
        LEFT JOIN dt ON dt.turma_id = te.id
        CROSS JOIN LATERAL generate_series(te.di, te.df, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      all_days AS (
        SELECT turma_id, d FROM dt
        UNION ALL
        SELECT turma_id, d FROM ds
      )
      SELECT turma_id, COUNT(*)::int AS total_dias
      FROM all_days
      GROUP BY turma_id
      `,
      [eventoId]
    );

    const totalDiasTurmaMap = new Map(
      (baseDatas.rows || []).map((r) => [Number(r.turma_id), Number(r.total_dias || 0)])
    );

    const raw = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        COUNT(DISTINCT CASE WHEN p.presente IS TRUE THEN p.data_presenca::date END)::int AS presentes
      FROM turmas t
      JOIN inscricao i ON i.turma_id = t.id
      JOIN usuarios u   ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.turma_id = t.id
       AND p.usuario_id = u.id
      WHERE t.evento_id = $1
      GROUP BY u.id, u.nome, u.cpf, t.id, t.nome, t.data_inicio, t.data_fim
      ORDER BY u.nome ASC, t.data_inicio ASC NULLS LAST, t.id ASC
      `,
      [eventoId]
    );

    const users = new Map();
    for (const r of raw.rows || []) {
      const uid = Number(r.usuario_id);
      if (!users.has(uid)) {
        users.set(uid, {
          usuario_id: uid,
          nome: r.nome,
          cpf: r.cpf,
          turmas: [],
          total_dias: 0,
          presentes: 0,
          frequencia: 0,
        });
      }
      const totalDias = totalDiasTurmaMap.get(Number(r.turma_id)) || 0;
      const presentes = Number(r.presentes || 0);

      const u = users.get(uid);
      u.turmas.push({
        turma_id: Number(r.turma_id),
        turma_nome: r.turma_nome,
        data_inicio: r.data_inicio,
        data_fim: r.data_fim,
        total_dias: totalDias,
        presentes,
        frequencia: totalDias > 0 ? Math.round((presentes / totalDias) * 100) : null,
      });

      u.total_dias += totalDias;
      u.presentes  += presentes;
    }

    const lista = Array.from(users.values()).map((u) => ({
      ...u,
      frequencia: u.total_dias > 0 ? Math.round((u.presentes / u.total_dias) * 100) : null,
      presente:   u.total_dias > 0 ? u.presentes > 0 : false,
    }));

    return res.json({ ok: true, rid: requestId, evento: ev.rows[0], lista });
  } catch (err) {
    errlg("[presencasPorEvento]", { requestId, eventoId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_EVENTO", rid: requestId });
  }
}

/* ────────────────────────────────────────────────────────────────
   EXPORTS — arquivo único
─────────────────────────────────────────────────────────────── */
module.exports = {
  // A) Relatórios gerais
  gerarRelatorios,
  exportarRelatorios,
  opcaoRelatorios,

  // B) Presenças
  presencasPorTurma,
  presencasPorTurmaDetalhado,
  presencasPorEvento,
};
