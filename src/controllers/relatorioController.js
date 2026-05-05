/* eslint-disable no-console */
// 📁 src/controllers/relatorioController.js — ÚNICO & PREMIUM+++ (2026)
// - Consolida relatórios gerais + relatórios de presenças
// - Date-only safe
// - Compat DB robusta (pg / pg-promise / req.db)
// - Evita multiplicação de linhas por instrutor
// - Export Excel/PDF mais consistente
// - Logs com RID
// - Compatibilidade defensiva com schemas diferentes:
//    • usuarios.nome OU usuarios.nome_completo
//    • presença/relatórios com OU sem datas_turma
//    • eventos.unidade_id OU turmas.unidade_id
//    • unidades opcional
// - Corrige filtro de instrutor fora do escopo da CTE
// - Mantém contratos/rotas existentes

"use strict";

const dbRaw = require("../db");
const dbFallback = dbRaw?.db ?? dbRaw;

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/* ────────────────────────────────────────────────────────────────
   Config / Logs
──────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";

const log = (...a) => !IS_PROD && console.log("[relatorios]", ...a);
const warn = (...a) => !IS_PROD && console.warn("[relatorios][WARN]", ...a);
const errlg = (...a) => console.error("[relatorios][ERR]", ...a);

function mkRid(prefix = "REL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
function getDb(req) {
  return req?.db ?? dbFallback;
}

async function q(reqOrDb, sql, params = []) {
  const db = typeof reqOrDb?.query === "function" ? reqOrDb : getDb(reqOrDb);

  if (typeof db?.query === "function") {
    return db.query(sql, params);
  }

  if (typeof db?.any === "function") {
    const op = String(sql).trim().slice(0, 6).toUpperCase();

    if (op.startsWith("SELECT") || op.startsWith("WITH")) {
      const rows = await db.any(sql, params);
      return { rows, rowCount: rows.length };
    }

    if (/RETURNING/i.test(sql) && typeof db.oneOrNone === "function") {
      const row = await db.oneOrNone(sql, params);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (typeof db.none === "function") {
      await db.none(sql, params);
      return { rows: [], rowCount: 0 };
    }
  }

  throw new Error("DB adapter inválido: sem query/any.");
}

async function queryFirstWorking(reqOrDb, variants, params = []) {
  let lastErr = null;

  for (const sql of variants) {
    try {
      return await q(reqOrDb, sql, params);
    } catch (e) {
      lastErr = e;

      if (["42P01", "42703", "42883", "42P10"].includes(e?.code)) {
        continue;
      }

      throw e;
    }
  }

  throw lastErr || new Error("Nenhuma variante SQL funcionou.");
}

/* ────────────────────────────────────────────────────────────────
   Datas (date-only safe)
──────────────────────────────────────────────────────────────── */
function ymdOnly(v) {
  if (!v) return null;

  if (typeof v === "string") {
    const s = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
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

function nowIsoSafe() {
  return new Date().toISOString();
}

/* ────────────────────────────────────────────────────────────────
   Helpers comuns
──────────────────────────────────────────────────────────────── */
function asIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;

  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

const toInt = asIntOrNull;

function normalizarFiltros({ query = {}, filtros = {} }) {
  const use = Object.keys(filtros || {}).length ? filtros : query;

  const evento = asIntOrNull(use.evento ?? use.eventoId ?? use.evento_id);

  const instrutor = asIntOrNull(
    use.instrutor ?? use.instrutorId ?? use.instrutor_id
  );

  const unidade = asIntOrNull(use.unidade ?? use.unidadeId ?? use.unidade_id);

  let from = use.from ?? null;
  let to = use.to ?? null;

  if (Array.isArray(use.periodo) && use.periodo.length === 2) {
    from = use.periodo[0] || null;
    to = use.periodo[1] || null;
  }

  from = normDateOnly(from);
  to = normDateOnly(to);

  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return { evento, instrutor, unidade, from, to };
}

function setNoStore(res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
  } catch {}
}

/* ────────────────────────────────────────────────────────────────
   Descoberta de schema/colunas
──────────────────────────────────────────────────────────────── */
async function tableExists(req, tableName) {
  if (!tableName) return false;

  tableExists._cache ||= new Map();

  const key = `public.${tableName}`;
  if (tableExists._cache.has(key)) return tableExists._cache.get(key);

  try {
    const r = await q(
      req,
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
      `,
      [tableName]
    );

    const exists = !!r.rows?.[0]?.exists;
    tableExists._cache.set(key, exists);

    return exists;
  } catch (e) {
    warn("[schema][tableExists] falhou:", tableName, e?.message);
    tableExists._cache.set(key, false);
    return false;
  }
}

async function columnExists(req, tableName, columnName) {
  if (!tableName || !columnName) return false;

  columnExists._cache ||= new Map();

  const key = `public.${tableName}.${columnName}`;
  if (columnExists._cache.has(key)) return columnExists._cache.get(key);

  try {
    const r = await q(
      req,
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
      `,
      [tableName, columnName]
    );

    const exists = !!r.rows?.[0]?.exists;
    columnExists._cache.set(key, exists);

    return exists;
  } catch (e) {
    warn("[schema][columnExists] falhou:", tableName, columnName, e?.message);
    columnExists._cache.set(key, false);
    return false;
  }
}

async function detectarSchemaUsuarios(req) {
  if (detectarSchemaUsuarios._cache) return detectarSchemaUsuarios._cache;

  const hasNome = await columnExists(req, "usuarios", "nome");
  const hasNomeCompleto = await columnExists(req, "usuarios", "nome_completo");
  const hasCpf = await columnExists(req, "usuarios", "cpf");

  const nomeExpr = hasNome
    ? "u.nome"
    : hasNomeCompleto
      ? "u.nome_completo"
      : "('Usuário #' || u.id::text)";

  detectarSchemaUsuarios._cache = {
    hasNome,
    hasNomeCompleto,
    hasCpf,
    nomeExpr,
    cpfExpr: hasCpf ? "u.cpf" : "NULL::text",
  };

  return detectarSchemaUsuarios._cache;
}

async function detectarColunasUnidade(req) {
  if (detectarColunasUnidade._cache) return detectarColunasUnidade._cache;

  try {
    const qRes = await q(
      req,
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'unidade_id'
        AND table_name IN ('turmas', 'eventos')
      `
    );

    const hasTurmas = qRes.rows.some((r) => r.table_name === "turmas");
    const hasEventos = qRes.rows.some((r) => r.table_name === "eventos");

    detectarColunasUnidade._cache = { hasTurmas, hasEventos };
    return detectarColunasUnidade._cache;
  } catch (e) {
    warn("[schema][detectarColunasUnidade] fallback:", e?.message);

    detectarColunasUnidade._cache = { hasTurmas: false, hasEventos: true };
    return detectarColunasUnidade._cache;
  }
}

/* ────────────────────────────────────────────────────────────────
   SQL base do relatório geral
   ✅ evita multiplicação de linhas por instrutor
   ✅ filtro de instrutor corrigido fora da CTE
──────────────────────────────────────────────────────────────── */
async function montarSQLBaseEFiltros(req, { evento, instrutor, unidade, from, to }) {
  const { hasTurmas, hasEventos } = await detectarColunasUnidade(req);
  const { nomeExpr } = await detectarSchemaUsuarios(req);

  const unidadeCol =
    (hasEventos && "e.unidade_id") || (hasTurmas && "t.unidade_id") || null;

  const params = [];
  const where = [];

  if (evento) {
    params.push(evento);
    where.push(`e.id = $${params.length}`);
  }

  if (unidade && unidadeCol) {
    params.push(unidade);
    where.push(`${unidadeCol} = $${params.length}`);
  }

  if (from) {
    params.push(from);
    where.push(`t.data_inicio::date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    where.push(`t.data_inicio::date <= $${params.length}::date`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let outerWhereSql = "";
  if (instrutor) {
    params.push(instrutor);

    // ✅ Correção importante:
    // vi.instrutor_id não existe fora da CTE "base".
    // O campo projetado na base é "instrutor_id".
    outerWhereSql = `WHERE instrutor_id = $${params.length}`;
  }

  const sql = `
    WITH pres_ag AS (
      SELECT
        p.turma_id,
        p.usuario_id,
        COUNT(DISTINCT p.data_presenca::date) FILTER (WHERE p.presente IS TRUE)::int AS pres_true
      FROM presencas p
      GROUP BY p.turma_id, p.usuario_id
    ),

    vinc_ti AS (
      SELECT
        ti.turma_id,
        t.evento_id,
        ti.instrutor_id
      FROM turma_instrutor ti
      JOIN turmas t ON t.id = ti.turma_id
    ),

    vinc_ei AS (
      SELECT
        t.id AS turma_id,
        ei.evento_id,
        ei.instrutor_id
      FROM evento_instrutor ei
      JOIN turmas t ON t.evento_id = ei.evento_id
    ),

    vinculos_instrutor AS (
      SELECT DISTINCT turma_id, evento_id, instrutor_id FROM vinc_ti
      UNION
      SELECT DISTINCT turma_id, evento_id, instrutor_id FROM vinc_ei
    ),

    base AS (
      SELECT
        e.id AS evento_id,
        e.titulo AS evento,
        u.id AS instrutor_id,
        ${nomeExpr} AS instrutor,
        t.id AS turma_id,
        t.nome AS turma,
        t.data_inicio,
        t.data_fim,
        COUNT(DISTINCT i.usuario_id)::int AS inscritos,
        COALESCE(SUM(COALESCE(pa.pres_true, 0)), 0)::int AS presencas
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN inscricoes i ON i.turma_id = t.id
      LEFT JOIN pres_ag pa
        ON pa.turma_id = t.id
       AND pa.usuario_id = i.usuario_id
      LEFT JOIN vinculos_instrutor vi
        ON vi.turma_id = t.id
      LEFT JOIN usuarios u
        ON u.id = vi.instrutor_id
      ${whereSql}
      GROUP BY
        e.id, e.titulo,
        u.id, ${nomeExpr},
        t.id, t.nome, t.data_inicio, t.data_fim
    )

    SELECT *
    FROM base
    ${outerWhereSql}
    ORDER BY
      data_inicio DESC NULLS LAST,
      evento ASC,
      instrutor ASC NULLS LAST,
      turma ASC
  `;

  return { sql, params };
}

/* ────────────────────────────────────────────────────────────────
   A) RELATÓRIOS (JSON / Exportar / Opções)
──────────────────────────────────────────────────────────────── */
async function gerarRelatorios(req, res) {
  const requestId = mkRid();

  try {
    setNoStore(res);

    const filtros = normalizarFiltros({ query: req.query });
    const { sql, params } = await montarSQLBaseEFiltros(req, filtros);

    log(requestId, "[gerarRelatorios][INICIO]", {
      filtros,
      paramsCount: params.length,
    });

    const result = await q(req, sql, params);

    log(requestId, "[gerarRelatorios][OK]", {
      total: result.rows?.length || 0,
    });

    return res.json({
      ok: true,
      data: result.rows || [],
      meta: {
        requestId,
        total: result.rows?.length || 0,
        filtros,
      },
    });
  } catch (err) {
    errlg(requestId, "[gerarRelatorios][ERRO]", {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "Erro ao gerar relatório.",
      requestId,
    });
  }
}

async function exportarRelatorios(req, res) {
  const requestId = mkRid();

  try {
    const formato = String(req.body?.formato || "")
      .toLowerCase()
      .trim();

    const filtros = normalizarFiltros({ filtros: req.body?.filtros || {} });
    const { sql, params } = await montarSQLBaseEFiltros(req, filtros);
    const { rows } = await q(req, sql, params);

    log(requestId, "[exportarRelatorios][INICIO]", {
      formato,
      rows: rows?.length || 0,
      filtros,
    });

    if (formato === "excel") {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Plataforma da Residência";
      workbook.created = new Date();
      workbook.modified = new Date();

      const sheet = workbook.addWorksheet("Relatório", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      sheet.columns = [
        { header: "Evento", key: "evento", width: 38 },
        { header: "Instrutor", key: "instrutor", width: 30 },
        { header: "Turma", key: "turma", width: 30 },
        { header: "Data Início", key: "data_inicio", width: 14 },
        { header: "Data Fim", key: "data_fim", width: 14 },
        { header: "Inscritos", key: "inscritos", width: 12 },
        { header: "Presenças", key: "presencas", width: 12 },
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      sheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      sheet.autoFilter = { from: "A1", to: "G1" };

      for (const r of rows || []) {
        sheet.addRow({
          evento: r.evento || "",
          instrutor: r.instrutor || "",
          turma: r.turma || "",
          data_inicio: ddmmyyyyFromYMD(ymdOnly(r.data_inicio)),
          data_fim: ddmmyyyyFromYMD(ymdOnly(r.data_fim)),
          inscritos: Number(r.inscritos) || 0,
          presencas: Number(r.presencas) || 0,
        });
      }

      sheet.getColumn("inscritos").numFmt = "0";
      sheet.getColumn("presencas").numFmt = "0";

      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (rowNumber > 1) {
            cell.alignment = { vertical: "middle" };
          }
        });
      });

      sheet.addRow([]);
      sheet.addRow(["requestId", requestId]);
      sheet.addRow(["gerado_em", nowIsoSafe()]);
      sheet.addRow(["filtros", JSON.stringify(filtros)]);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=relatorio.xlsx"
      );

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
        .text(
          `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", {
            locale: ptBR,
          })}  •  ${requestId}`,
          { align: "center" }
        );

      const filtrosLine = [];

      if (filtros.evento) filtrosLine.push(`Evento #${filtros.evento}`);
      if (filtros.instrutor) filtrosLine.push(`Instrutor #${filtros.instrutor}`);
      if (filtros.unidade) filtrosLine.push(`Unidade #${filtros.unidade}`);

      if (filtros.from || filtros.to) {
        filtrosLine.push(
          `Período: ${
            filtros.from ? ddmmyyyyFromYMD(filtros.from) : "—"
          } a ${filtros.to ? ddmmyyyyFromYMD(filtros.to) : "—"}`
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

      const totalInscritos = (rows || []).reduce(
        (a, r) => a + (Number(r.inscritos) || 0),
        0
      );

      const totalPresencas = (rows || []).reduce(
        (a, r) => a + (Number(r.presencas) || 0),
        0
      );

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0F172A")
        .text("Resumo");

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#111827")
        .text(
          `Registros: ${rows?.length || 0}   •   Inscritos: ${totalInscritos}   •   Presenças: ${totalPresencas}`
        );

      doc.moveDown(0.8);

      if (!rows?.length) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#64748B")
          .text("Nenhum registro encontrado para os filtros informados.");
      }

      (rows || []).forEach((row, i) => {
        if (doc.y > 720) doc.addPage();

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#0F172A")
          .text(`${i + 1}. ${row.evento || "Evento"}`);

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111827")
          .text(`Instrutor: ${row.instrutor || "—"}`)
          .text(`Turma: ${row.turma || "—"}`)
          .text(`Período: ${fmt(row.data_inicio)} a ${fmt(row.data_fim)}`)
          .text(
            `Inscritos: ${Number(row.inscritos) || 0}   •   Presenças: ${
              Number(row.presencas) || 0
            }`
          );

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
    errlg(requestId, "[exportarRelatorios][ERRO]", {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "Erro ao exportar relatório.",
      requestId,
    });
  }
}

async function opcaoRelatorios(req, res) {
  const requestId = mkRid();

  try {
    setNoStore(res);

    const { nomeExpr } = await detectarSchemaUsuarios(req);
    const unidadesExists = await tableExists(req, "unidades");

    const eventosPromise = q(
      req,
      `
      SELECT id, titulo
      FROM eventos
      ORDER BY titulo
      `
    );

    const instrutoresPromise = q(
      req,
      `
      SELECT DISTINCT
        u.id,
        ${nomeExpr} AS nome
      FROM usuarios u
      LEFT JOIN turma_instrutor ti ON ti.instrutor_id = u.id
      LEFT JOIN evento_instrutor ei ON ei.instrutor_id = u.id
      WHERE ti.instrutor_id IS NOT NULL
         OR ei.instrutor_id IS NOT NULL
      ORDER BY nome
      `
    );

    const unidadesPromise = unidadesExists
      ? q(
          req,
          `
          SELECT id, nome
          FROM unidades
          ORDER BY nome
          `
        )
      : Promise.resolve({ rows: [], rowCount: 0 });

    const [eventos, instrutores, unidades] = await Promise.all([
      eventosPromise,
      instrutoresPromise,
      unidadesPromise,
    ]);

    return res.json({
      ok: true,
      data: {
        eventos: eventos.rows || [],
        instrutores: instrutores.rows || [],
        unidades: unidades.rows || [],
      },
      meta: { requestId },
    });
  } catch (err) {
    errlg(requestId, "[opcaoRelatorios][ERRO]", {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "Erro ao buscar opções de filtros.",
      requestId,
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   B) RELATÓRIO DE PRESENÇAS
──────────────────────────────────────────────────────────────── */
async function hasDatasTurma(req, turmaId) {
  if (!turmaId) return false;

  const exists = await tableExists(req, "datas_turma");
  if (!exists) return false;

  try {
    const qRes = await q(
      req,
      `
      SELECT EXISTS(
        SELECT 1
        FROM datas_turma
        WHERE turma_id = $1
      ) AS tem
      `,
      [turmaId]
    );

    return !!qRes.rows?.[0]?.tem;
  } catch (e) {
    if (["42P01", "42703"].includes(e?.code)) return false;
    throw e;
  }
}

async function getDatasDaTurmaYMD(req, turmaId) {
  const temDT = await hasDatasTurma(req, turmaId);

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

  const r = await q(req, sql, [turmaId]);

  return (r.rows || [])
    .map((x) => x.data)
    .filter(Boolean);
}

async function getTurmaInfo(req, turmaId) {
  const qRes = await q(
    req,
    `
    SELECT
      t.id AS turma_id,
      t.nome AS turma_nome,
      t.evento_id,
      e.titulo AS evento_titulo,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(t.data_fim::date,   'YYYY-MM-DD')  AS data_fim,
      CASE
        WHEN t.horario_inicio IS NULL THEN NULL
        ELSE to_char(t.horario_inicio::time, 'HH24:MI')
      END AS horario_inicio,
      CASE
        WHEN t.horario_fim IS NULL THEN NULL
        ELSE to_char(t.horario_fim::time, 'HH24:MI')
      END AS horario_fim
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return qRes.rows?.[0] || null;
}

/** GET /api/relatorios/presencas/turma/:turma_id */
async function presencasPorTurma(req, res) {
  const turmaId = toInt(req.params.turma_id);
  const requestId = mkRid("REL-PRES-TURMA");

  if (!turmaId) {
    return res.status(400).json({
      ok: false,
      erro: "TURMA_ID_INVALIDO",
      rid: requestId,
    });
  }

  try {
    setNoStore(res);

    log(requestId, "[presencasPorTurma][INICIO]", { turmaId });

    const turma = await getTurmaInfo(req, turmaId);

    if (!turma) {
      return res.status(404).json({
        ok: false,
        erro: "TURMA_NAO_ENCONTRADA",
        rid: requestId,
      });
    }

    const datas = await getDatasDaTurmaYMD(req, turmaId);

    if (!datas.length) {
      return res.json({
        ok: true,
        rid: requestId,
        turma,
        datas: [],
        lista: [],
      });
    }

    const { nomeExpr, cpfExpr } = await detectarSchemaUsuarios(req);

    const insc = await q(
      req,
      `
      SELECT
        u.id AS usuario_id,
        ${nomeExpr} AS nome,
        ${cpfExpr} AS cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY nome ASC, u.id ASC
      `,
      [turmaId]
    );

    const usuarioIds = (insc.rows || [])
      .map((r) => Number(r.usuario_id))
      .filter(Boolean);

    if (!usuarioIds.length) {
      return res.json({
        ok: true,
        rid: requestId,
        turma,
        datas,
        lista: [],
      });
    }

    const pres = await q(
      req,
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
      [turmaId, usuarioIds]
    );

    const presMap = new Map(
      (pres.rows || []).map((r) => [
        `${Number(r.usuario_id)}|${r.data}`,
        r.presente === true,
      ])
    );

    const lista = [];

    for (const u of insc.rows || []) {
      for (const d of datas) {
        const key = `${Number(u.usuario_id)}|${d}`;

        lista.push({
          usuario_id: Number(u.usuario_id),
          nome: u.nome,
          cpf: u.cpf,
          data: d,
          presente: presMap.get(key) === true,
        });
      }
    }

    log(requestId, "[presencasPorTurma][OK]", {
      turmaId,
      inscritos: usuarioIds.length,
      datas: datas.length,
      registros: lista.length,
    });

    return res.json({
      ok: true,
      rid: requestId,
      turma,
      datas,
      lista,
    });
  } catch (err) {
    errlg("[presencasPorTurma][ERRO]", {
      requestId,
      turmaId,
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "ERRO_RELATORIO_TURMA",
      rid: requestId,
    });
  }
}

/** GET /api/relatorios/presencas/turma/:turma_id/detalhado */
async function presencasPorTurmaDetalhado(req, res) {
  const turmaId = toInt(req.params.turma_id);
  const requestId = mkRid("REL-PRES-DET");

  if (!turmaId) {
    return res.status(400).json({
      ok: false,
      erro: "TURMA_ID_INVALIDO",
      rid: requestId,
    });
  }

  try {
    setNoStore(res);

    log(requestId, "[presencasPorTurmaDetalhado][INICIO]", { turmaId });

    const turma = await getTurmaInfo(req, turmaId);

    if (!turma) {
      return res.status(404).json({
        ok: false,
        erro: "TURMA_NAO_ENCONTRADA",
        rid: requestId,
      });
    }

    const { nomeExpr, cpfExpr } = await detectarSchemaUsuarios(req);

    const result = await q(
      req,
      `
      SELECT
        u.id AS usuario_id,
        ${nomeExpr} AS nome,
        ${cpfExpr} AS cpf,
        to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
        BOOL_OR(p.presente) AS presente,
        MAX(p.confirmado_em) AS confirmado_em
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.usuario_id = u.id
       AND p.turma_id   = i.turma_id
      WHERE i.turma_id = $1
      GROUP BY u.id, ${nomeExpr}, ${cpfExpr}, p.data_presenca::date
      ORDER BY nome ASC, data ASC NULLS LAST
      `,
      [turmaId]
    );

    const lista = (result.rows || [])
      .filter((r) => r.data != null)
      .map((r) => ({
        usuario_id: Number(r.usuario_id),
        nome: r.nome,
        cpf: r.cpf,
        data: r.data,
        presente: r.presente === true,
        confirmado_em: r.confirmado_em,
      }));

    log(requestId, "[presencasPorTurmaDetalhado][OK]", {
      turmaId,
      registros: lista.length,
    });

    return res.json({
      ok: true,
      rid: requestId,
      turma,
      lista,
    });
  } catch (err) {
    errlg("[presencasPorTurmaDetalhado][ERRO]", {
      requestId,
      turmaId,
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "ERRO_RELATORIO_TURMA_DETALHADO",
      rid: requestId,
    });
  }
}

/** GET /api/relatorios/presencas/evento/:evento_id */
async function presencasPorEvento(req, res) {
  const eventoId = toInt(req.params.evento_id);
  const requestId = mkRid("REL-PRES-EV");

  if (!eventoId) {
    return res.status(400).json({
      ok: false,
      erro: "EVENTO_ID_INVALIDO",
      rid: requestId,
    });
  }

  try {
    setNoStore(res);

    log(requestId, "[presencasPorEvento][INICIO]", { eventoId });

    const ev = await q(
      req,
      `
      SELECT
        id AS evento_id,
        COALESCE(titulo, 'Evento') AS titulo
      FROM eventos
      WHERE id = $1
      LIMIT 1
      `,
      [eventoId]
    );

    if (!ev.rowCount) {
      return res.status(404).json({
        ok: false,
        erro: "EVENTO_NAO_ENCONTRADO",
        rid: requestId,
      });
    }

    const hasDT = await tableExists(req, "datas_turma");

    const baseDatasSql = hasDT
      ? `
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
          WHERE NOT EXISTS (
            SELECT 1
            FROM dt
            WHERE dt.turma_id = te.id
          )
          CROSS JOIN LATERAL generate_series(te.di, te.df, interval '1 day') AS gs
        ),
        all_days AS (
          SELECT turma_id, d FROM dt
          UNION ALL
          SELECT turma_id, d FROM ds
        )
        SELECT turma_id, COUNT(*)::int AS total_dias
        FROM all_days
        GROUP BY turma_id
        `
      : `
        WITH turmas_ev AS (
          SELECT id, data_inicio::date AS di, data_fim::date AS df
          FROM turmas
          WHERE evento_id = $1
        ),
        all_days AS (
          SELECT te.id AS turma_id, gs::date AS d
          FROM turmas_ev te
          CROSS JOIN LATERAL generate_series(te.di, te.df, interval '1 day') AS gs
        )
        SELECT turma_id, COUNT(*)::int AS total_dias
        FROM all_days
        GROUP BY turma_id
        `;

    const baseDatas = await q(req, baseDatasSql, [eventoId]);

    const totalDiasTurmaMap = new Map(
      (baseDatas.rows || []).map((r) => [
        Number(r.turma_id),
        Number(r.total_dias || 0),
      ])
    );

    const { nomeExpr, cpfExpr } = await detectarSchemaUsuarios(req);

    const raw = await q(
      req,
      `
      SELECT
        u.id AS usuario_id,
        ${nomeExpr} AS nome,
        ${cpfExpr} AS cpf,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        COUNT(DISTINCT CASE WHEN p.presente IS TRUE THEN p.data_presenca::date END)::int AS presentes
      FROM turmas t
      JOIN inscricoes i ON i.turma_id = t.id
      JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.turma_id = t.id
       AND p.usuario_id = u.id
      WHERE t.evento_id = $1
      GROUP BY
        u.id,
        ${nomeExpr},
        ${cpfExpr},
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim
      ORDER BY nome ASC, t.data_inicio ASC NULLS LAST, t.id ASC
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
        frequencia:
          totalDias > 0 ? Math.round((presentes / totalDias) * 100) : null,
      });

      u.total_dias += totalDias;
      u.presentes += presentes;
    }

    const lista = Array.from(users.values()).map((u) => ({
      ...u,
      frequencia:
        u.total_dias > 0 ? Math.round((u.presentes / u.total_dias) * 100) : null,
      presente: u.total_dias > 0 ? u.presentes > 0 : false,
    }));

    log(requestId, "[presencasPorEvento][OK]", {
      eventoId,
      usuarios: lista.length,
    });

    return res.json({
      ok: true,
      rid: requestId,
      evento: ev.rows[0],
      lista,
    });
  } catch (err) {
    errlg("[presencasPorEvento][ERRO]", {
      requestId,
      eventoId,
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: !IS_PROD ? err?.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      erro: "ERRO_RELATORIO_EVENTO",
      rid: requestId,
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   Exports
──────────────────────────────────────────────────────────────── */
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