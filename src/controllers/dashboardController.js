/* eslint-disable no-console */
// ✅ src/controllers/dashboardController.js — PREMIUM+++
// - DB compat robusta
// - Logs com RID
// - Instrutor por TURMA (turma_instrutor) + fallback evento_instrutor
// - Avaliações: avaliacoes/avaliacao + fallback instrutor_id/palestrante_id
// - Fuso SP (NOW() AT TIME ZONE) para status/tempo
// - Inscrições: inscricoes (oficial) + fallback inscricao
// - SQL defensivo, sem duplicação indevida
// - Respostas compatíveis com legado + painel premium

"use strict";

const rawDb = require("../db");
const { formatarGrafico } = require("../utils/graficos");

const dbFallback = rawDb?.db ?? rawDb;
const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* =========================================================================
   Compat DB
=========================================================================== */
function getDb(req) {
  return req?.db ?? dbFallback;
}

async function runQuery(db, sql, params = []) {
  if (typeof db?.query === "function") return db.query(sql, params);
  throw new Error("DB inválido: query ausente.");
}

async function queryFirstWorking(dbConn, variants, params = []) {
  let lastErr = null;
  for (const sql of variants) {
    try {
      return await runQuery(dbConn, sql, params);
    } catch (e) {
      lastErr = e;
      if (["42P01", "42703"].includes(e?.code)) continue; // table/column not found
      throw e;
    }
  }
  throw lastErr || new Error("Nenhuma variante de SQL funcionou.");
}

async function resolveInscricaoTable(dbConn) {
  try {
    await runQuery(dbConn, `SELECT 1 FROM inscricoes LIMIT 1`);
    return "inscricoes";
  } catch {
    return "inscricao";
  }
}

/* =========================================================================
   Logger premium
=========================================================================== */
function mkRid(prefix = "DASH") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "DASH") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;
  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }
  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* =========================================================================
   Helpers comuns
=========================================================================== */
function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function assertIntId(value, name = "id") {
  const n = toInt(value, null);
  if (!n || n <= 0) {
    const e = new Error(`${name} inválido.`);
    e.status = 400;
    throw e;
  }
  return n;
}

function safeJsonError(res, err, fallbackMsg = "Erro interno.") {
  const status = err?.status || 500;
  if (IS_DEV) console.error(err);
  return res.status(status).json({
    erro: err?.status ? err.message : fallbackMsg,
    detalhe: IS_DEV ? err?.message || String(err) : undefined,
  });
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* =========================================================================
   Nota / score (SQL)
=========================================================================== */
function sqlNormText(expr) {
  return `translate(lower(coalesce(${expr}, '')), 'áàãâéêíóôõúç', 'aaaaeeiooouc')`;
}

function sqlScore(colExpr) {
  const norm = sqlNormText(`(${colExpr})::text`);
  return `
    CASE
      WHEN trim((${colExpr})::text) ~ '^[1-5](?:[\\.,]0+)?$'
        THEN REPLACE(trim((${colExpr})::text), ',', '.')::numeric
      WHEN ${norm} IN ('otimo','excelente','muito bom','muitobom') THEN 5
      WHEN ${norm} = 'bom' THEN 4
      WHEN ${norm} IN ('regular','medio','médio') THEN 3
      WHEN ${norm} = 'ruim' THEN 2
      WHEN ${norm} IN ('pessimo','péssimo','muito ruim','muitoruim') THEN 1
      ELSE NULL
    END
  `;
}

function to10From5(v5) {
  if (!Number.isFinite(v5)) return null;
  return Math.round(v5 * 2 * 10) / 10;
}

/* =========================================================================
   Campos oficiais da média do evento
=========================================================================== */
const NOTAS_EVENTO = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

/* =========================================================================
   1) Eventos + turmas ministradas por um instrutor
   GET /api/instrutor/:id/eventos-avaliacao
=========================================================================== */
async function getEventosAvaliacaoPorInstrutor(req, res) {
  const rid = reqRid(req, "DASH-EVT");
  const db = getDb(req);

  try {
    const instrutorId = assertIntId(req.params.id, "instrutor_id");

    logInfo(rid, "getEventosAvaliacaoPorInstrutor:start", { instrutorId });

    const turmasMinistradas = await runQuery(
      db,
      `
      WITH turmas_por_ti AS (
        SELECT t.id AS turma_id
        FROM turma_instrutor ti
        JOIN turmas t ON t.id = ti.turma_id
        WHERE ti.instrutor_id = $1
      ),
      turmas_por_ei AS (
        SELECT t.id AS turma_id
        FROM evento_instrutor ei
        JOIN turmas t ON t.evento_id = ei.evento_id
        WHERE ei.instrutor_id = $1
      ),
      todas AS (
        SELECT turma_id FROM turmas_por_ti
        UNION
        SELECT turma_id FROM turmas_por_ei
      )
      SELECT turma_id
      FROM todas
      ORDER BY turma_id
      `,
      [instrutorId]
    );

    const turmaIds = (turmasMinistradas.rows || [])
      .map((r) => Number(r.turma_id))
      .filter(Boolean);

    if (!turmaIds.length) {
      logInfo(rid, "getEventosAvaliacaoPorInstrutor:sem_turmas", { instrutorId });
      return res.json([]);
    }

    const cabecalho = await queryFirstWorking(
      db,
      [
        `
        SELECT
          e.id     AS evento_id,
          e.titulo AS evento_titulo,
          t.id     AS turma_id,
          t.nome   AS turma_nome,
          to_char(t.data_inicio::date, 'DD/MM/YYYY') AS data_inicio,
          ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 1) AS nota_media_5
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
        WHERE t.id = ANY($1::int[])
        GROUP BY e.id, e.titulo, t.id, t.nome, t.data_inicio
        ORDER BY e.titulo ASC, t.data_inicio DESC
        `,
        `
        SELECT
          e.id     AS evento_id,
          e.titulo AS evento_titulo,
          t.id     AS turma_id,
          t.nome   AS turma_nome,
          to_char(t.data_inicio::date, 'DD/MM/YYYY') AS data_inicio,
          ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 1) AS nota_media_5
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        LEFT JOIN avaliacao a ON a.turma_id = t.id
        WHERE t.id = ANY($1::int[])
        GROUP BY e.id, e.titulo, t.id, t.nome, t.data_inicio
        ORDER BY e.titulo ASC, t.data_inicio DESC
        `,
      ],
      [turmaIds]
    );

    const comentariosQ = await queryFirstWorking(
      db,
      [
        `
        SELECT
          a.turma_id,
          a.desempenho_instrutor,
          a.gostou_mais,
          a.sugestoes_melhoria,
          a.comentarios_finais,
          a.data_avaliacao
        FROM avaliacoes a
        WHERE a.turma_id = ANY($1::int[])
          AND (
            a.gostou_mais IS NOT NULL OR
            a.sugestoes_melhoria IS NOT NULL OR
            a.comentarios_finais IS NOT NULL
          )
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        `,
        `
        SELECT
          a.turma_id,
          a.desempenho_instrutor,
          a.gostou_mais,
          a.sugestoes_melhoria,
          a.comentarios_finais,
          a.data_avaliacao
        FROM avaliacao a
        WHERE a.turma_id = ANY($1::int[])
          AND (
            a.gostou_mais IS NOT NULL OR
            a.sugestoes_melhoria IS NOT NULL OR
            a.comentarios_finais IS NOT NULL
          )
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        `,
      ],
      [turmaIds]
    );

    const comentariosPorTurma = new Map();
    for (const r of comentariosQ.rows || []) {
      const tid = Number(r.turma_id);
      if (!comentariosPorTurma.has(tid)) comentariosPorTurma.set(tid, []);
      comentariosPorTurma.get(tid).push({
        desempenho_instrutor: r.desempenho_instrutor ?? null,
        gostou_mais: (r.gostou_mais || "").trim() || null,
        sugestoes_melhoria: (r.sugestoes_melhoria || "").trim() || null,
        comentarios_finais: (r.comentarios_finais || "").trim() || null,
        data_avaliacao: r.data_avaliacao ?? null,
      });
    }

    const eventosMap = new Map();

    for (const row of cabecalho.rows || []) {
      const eventoId = Number(row.evento_id);
      const turmaId = Number(row.turma_id);
      const nota5 = row.nota_media_5 != null ? Number(row.nota_media_5) : null;

      if (!eventosMap.has(eventoId)) {
        eventosMap.set(eventoId, {
          id: eventoId,
          titulo: row.evento_titulo,
          turmas: [],
        });
      }

      eventosMap.get(eventoId).turmas.push({
        id: turmaId,
        nome: row.turma_nome,
        data: row.data_inicio,
        nota_media: nota5,
        nota_media_10: nota5 != null ? to10From5(nota5) : null,
        comentarios: comentariosPorTurma.get(turmaId) || [],
      });
    }

    const resposta = Array.from(eventosMap.values());

    logInfo(rid, "getEventosAvaliacaoPorInstrutor:ok", {
      instrutorId,
      totalEventos: resposta.length,
      totalTurmas: turmaIds.length,
    });

    return res.json(resposta);
  } catch (err) {
    logErr(rid, "getEventosAvaliacaoPorInstrutor erro", err);
    return safeJsonError(res, err, "Erro ao buscar eventos ministrados.");
  }
}

/* =========================================================================
   2) Resumo do dashboard do usuário
   GET /api/dashboard-usuario
=========================================================================== */
async function getResumoDashboard(req, res) {
  const rid = reqRid(req, "DASH-RES");
  const db = getDb(req);

  try {
    const usuarioId = assertIntId(req.user?.id, "usuario_id");
    const inscrTable = await resolveInscricaoTable(db);
    const nowSP = `(NOW() AT TIME ZONE '${TZ}')`;

    logInfo(rid, "getResumoDashboard:start", { usuarioId, inscrTable });

    const cursosQ = await runQuery(
      db,
      `
      SELECT COUNT(DISTINCT e.id)::int AS eventos_concluidos
      FROM ${inscrTable} i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59'::time)) < ${nowSP}
      `,
      [usuarioId]
    );

    const eventosInstrutorQ = await runQuery(
      db,
      `
      WITH ev_ti AS (
        SELECT DISTINCT t.evento_id
        FROM turma_instrutor ti
        JOIN turmas t ON t.id = ti.turma_id
        WHERE ti.instrutor_id = $1
      ),
      ev_ei AS (
        SELECT DISTINCT ei.evento_id
        FROM evento_instrutor ei
        WHERE ei.instrutor_id = $1
      )
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT evento_id FROM ev_ti
        UNION
        SELECT evento_id FROM ev_ei
      ) x
      `,
      [usuarioId]
    );

    const inscricaoFuturasQ = await runQuery(
      db,
      `
      SELECT COUNT(*)::int AS total
      FROM ${inscrTable} i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00'::time)) > ${nowSP}
      `,
      [usuarioId]
    );

    const inscricaoAtuaisQ = await runQuery(
      db,
      `
      SELECT COUNT(*)::int AS total
      FROM ${inscrTable} i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND ${nowSP} BETWEEN
            (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00'::time))
            AND
            (t.data_fim::date + COALESCE(t.horario_fim,'23:59'::time))
      `,
      [usuarioId]
    );

    const proximosQ = await runQuery(
      db,
      `
      SELECT COUNT(*)::int AS total
      FROM ${inscrTable} i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00'::time)) > ${nowSP}
      `,
      [usuarioId]
    );

    const avalPendentesQ = await queryFirstWorking(
      db,
      [
        `
        SELECT COUNT(*)::int AS total
        FROM ${inscrTable} i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
          AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59'::time)) <= ${nowSP}
          AND NOT EXISTS (
            SELECT 1
            FROM avaliacoes a
            WHERE a.usuario_id = i.usuario_id
              AND a.turma_id = i.turma_id
          )
        `,
        `
        SELECT COUNT(*)::int AS total
        FROM ${inscrTable} i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
          AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59'::time)) <= ${nowSP}
          AND NOT EXISTS (
            SELECT 1
            FROM avaliacao a
            WHERE a.usuario_id = i.usuario_id
              AND a.turma_id = i.turma_id
          )
        `,
      ],
      [usuarioId]
    );

    const certificadosEmitidosQ = await runQuery(
      db,
      `
      SELECT COUNT(*)::int AS total
      FROM certificados c
      WHERE c.usuario_id = $1
        AND c.gerado_em IS NOT NULL
      `,
      [usuarioId]
    );

    const certificadosTotalQ = await runQuery(
      db,
      `
      SELECT COUNT(*)::int AS total
      FROM certificados
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    const pfDash = await runQuery(
      db,
      `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.data_inicio::date AS di_raw,
          t.data_fim::date AS df_raw
        FROM ${inscrTable} i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        SELECT mt.turma_id, dt.data::date AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        SELECT mt.turma_id, gs::date AS d
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
          dbx.turma_id,
          MIN(dbx.d) AS di,
          MAX(dbx.d) AS df,
          COUNT(*) FILTER (WHERE dbx.d <= CURRENT_DATE) AS realizados,
          COUNT(*) FILTER (WHERE dbx.d <= CURRENT_DATE AND p.presente IS TRUE) AS presentes_passados,
          COUNT(*) FILTER (WHERE dbx.d <= CURRENT_DATE AND COALESCE(p.presente, FALSE) IS NOT TRUE) AS ausencias_passadas
        FROM datas_base dbx
        LEFT JOIN pres p ON p.turma_id = dbx.turma_id AND p.d = dbx.d
        GROUP BY dbx.turma_id
      )
      SELECT
        COALESCE(SUM(presentes_passados), 0)::int AS presencas_total,
        COALESCE(SUM(ausencias_passadas), 0)::int AS faltas_total
      FROM agregada
      WHERE CURRENT_DATE > df
      `,
      [usuarioId]
    );

    const presencas_total = num(pfDash.rows?.[0]?.presencas_total, 0);
    const faltas_total = num(pfDash.rows?.[0]?.faltas_total, 0);
    const totalPF = presencas_total + faltas_total;

    const nota_usuario =
      totalPF > 0
        ? Math.max(
            0,
            Math.min(
              10,
              Math.round((10 - (faltas_total / totalPF) * 10) * 10) / 10
            )
          )
        : null;

    const mediaInstrutorQ = await queryFirstWorking(
      db,
      [
        `SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_5 FROM avaliacoes a WHERE a.instrutor_id = $1`,
        `SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_5 FROM avaliacoes a WHERE a.palestrante_id = $1`,
        `SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_5 FROM avaliacao a WHERE a.instrutor_id = $1`,
        `SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_5 FROM avaliacao a WHERE a.palestrante_id = $1`,
      ],
      [usuarioId]
    );

    const media5 = mediaInstrutorQ.rows?.[0]?.media_5;
    const mediaAvaliacao10 = media5 != null ? to10From5(Number(media5)) : null;

    const payload = {
      inscricaoFuturas: num(inscricaoFuturasQ.rows?.[0]?.total, 0),
      avaliacaoPendentes: num(avalPendentesQ.rows?.[0]?.total, 0),
      certificadosEmitidos: num(certificadosEmitidosQ.rows?.[0]?.total, 0),
      presencasTotal: presencas_total,
      faltasTotal: faltas_total,
      notaUsuario: nota_usuario,

      cursosRealizados: num(cursosQ.rows?.[0]?.eventos_concluidos, 0),
      eventosinstrutor: num(eventosInstrutorQ.rows?.[0]?.total, 0),
      inscricaoAtuais: num(inscricaoAtuaisQ.rows?.[0]?.total, 0),
      proximosEventos: num(proximosQ.rows?.[0]?.total, 0),
      certificadosTotal: num(certificadosTotalQ.rows?.[0]?.total, 0),

      mediaAvaliacao: mediaAvaliacao10,
    };

    logInfo(rid, "getResumoDashboard:ok", payload);
    return res.json(payload);
  } catch (err) {
    logErr(rid, "getResumoDashboard erro", err);
    return safeJsonError(res, err, "Erro ao carregar dados do dashboard.");
  }
}

/* =========================================================================
   3) Últimas avaliações recebidas como instrutor
   GET /api/dashboard-usuario/avaliacao-recentes
=========================================================================== */
async function getAvaliacaoRecentesInstrutor(req, res) {
  const rid = reqRid(req, "DASH-AVR");
  const db = getDb(req);

  try {
    const usuarioId = assertIntId(req.user?.id, "usuario_id");

    const { rows } = await queryFirstWorking(
      db,
      [
        `
        SELECT
          e.titulo AS evento,
          ROUND(${sqlScore("a.desempenho_instrutor")}::numeric, 2) AS nota_5,
          a.data_avaliacao
        FROM avaliacoes a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.instrutor_id = $1
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        LIMIT 10
        `,
        `
        SELECT
          e.titulo AS evento,
          ROUND(${sqlScore("a.desempenho_instrutor")}::numeric, 2) AS nota_5,
          a.data_avaliacao
        FROM avaliacoes a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.palestrante_id = $1
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        LIMIT 10
        `,
        `
        SELECT
          e.titulo AS evento,
          ROUND(${sqlScore("a.desempenho_instrutor")}::numeric, 2) AS nota_5,
          a.data_avaliacao
        FROM avaliacao a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.instrutor_id = $1
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        LIMIT 10
        `,
        `
        SELECT
          e.titulo AS evento,
          ROUND(${sqlScore("a.desempenho_instrutor")}::numeric, 2) AS nota_5,
          a.data_avaliacao
        FROM avaliacao a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.palestrante_id = $1
        ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
        LIMIT 10
        `,
      ],
      [usuarioId]
    );

    const out = (rows || []).map((r) => {
      const nota5 = r.nota_5 != null ? Number(r.nota_5) : null;
      return {
        evento: r.evento,
        nota: nota5 != null ? to10From5(nota5) : null,
        nota_5: nota5,
        data_avaliacao: r.data_avaliacao ?? null,
      };
    });

    logInfo(rid, "getAvaliacaoRecentesInstrutor:ok", {
      usuarioId,
      total: out.length,
    });

    return res.json(out);
  } catch (err) {
    logErr(rid, "getAvaliacaoRecentesInstrutor erro", err);
    return safeJsonError(res, err, "Erro ao buscar últimas avaliações.");
  }
}

/* =========================================================================
   4) Dashboard analítico (admin)
   GET /api/dashboard-analitico?ano=&mes=&tipo=
=========================================================================== */
async function obterDashboard(req, res) {
  const rid = reqRid(req, "DASH-ADM");
  const db = getDb(req);

  const { ano, mes, tipo } = req.query;

  const anoNum = ano ? Number(ano) : null;
  const mesNum = mes ? Number(mes) : null;
  const tipoStr = tipo ? String(tipo).trim() : null;

  const params = [];
  const cond = [];

  if (Number.isFinite(anoNum)) {
    params.push(anoNum);
    cond.push(`EXTRACT(YEAR FROM t.data_inicio) = $${params.length}`);
  }

  if (Number.isFinite(mesNum)) {
    params.push(mesNum);
    cond.push(`EXTRACT(MONTH FROM t.data_inicio) = $${params.length}`);
  }

  if (tipoStr) {
    params.push(tipoStr);
    cond.push(`e.tipo = $${params.length}`);
  }

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  async function settled(label, promise, fallbackRows = []) {
    const r = await Promise.allSettled([promise]);
    const out = r[0];

    if (out.status === "fulfilled") return out.value;

    logErr(rid, `[${label}]`, out.reason);
    return { rows: fallbackRows, rowCount: fallbackRows.length };
  }

  try {
    logInfo(rid, "obterDashboard:start", {
      ano: anoNum,
      mes: mesNum,
      tipo: tipoStr,
    });

    const inscrTable = await resolveInscricaoTable(db);

    const totalEventosSQL = `
      SELECT COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
    `;

    const inscritosUnicosSQL = `
      SELECT COUNT(DISTINCT i.usuario_id)::int AS total
      FROM ${inscrTable} i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
    `;

    const mediaAvaliacaoSQL_avaliacoes = `
      WITH a0 AS (
        SELECT
          (${NOTAS_EVENTO.map((c) => sqlScore(`a.${c}`)).join(" + ")})::numeric AS soma,
          (
            ${NOTAS_EVENTO
              .map((c) => `CASE WHEN ${sqlScore(`a.${c}`)} IS NULL THEN 0 ELSE 1 END`)
              .join(" + ")}
          )::numeric AS qtd
        FROM avaliacoes a
        JOIN turmas t ON a.turma_id = t.id
        JOIN eventos e ON t.evento_id = e.id
        ${where}
      )
      SELECT ROUND(AVG(CASE WHEN qtd > 0 THEN (soma / qtd) ELSE NULL END), 2) AS media_evento
      FROM a0
    `;

    const mediaAvaliacaoSQL_avaliacao = mediaAvaliacaoSQL_avaliacoes.replace(
      /avaliacoes/g,
      "avaliacao"
    );

    const mediaInstrutorSQL_avaliacoes = `
      SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_instrutor
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
    `;

    const mediaInstrutorSQL_avaliacao = mediaInstrutorSQL_avaliacoes.replace(
      /avaliacoes/g,
      "avaliacao"
    );

    const presencaSQL = `
      WITH turmas_filtradas AS (
        SELECT
          t.id AS turma_id,
          t.evento_id,
          t.data_inicio::date AS di,
          t.data_fim::date AS df
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        ${where}
      ),
      encontros AS (
        SELECT
          tf.turma_id,
          CASE
            WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = tf.turma_id)
              THEN (SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = tf.turma_id)
            ELSE ((tf.df - tf.di) + 1)
          END AS total_encontros
        FROM turmas_filtradas tf
      ),
      presencas_usuario AS (
        SELECT
          i.usuario_id,
          i.turma_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS presencas_feitas
        FROM ${inscrTable} i
        JOIN turmas_filtradas tf ON tf.turma_id = i.turma_id
        LEFT JOIN presencas p
          ON p.turma_id = i.turma_id
         AND p.usuario_id = i.usuario_id
         AND p.presente = TRUE
        GROUP BY i.usuario_id, i.turma_id
      ),
      elegiveis_por_turma AS (
        SELECT
          pu.usuario_id,
          pu.turma_id,
          tf.evento_id,
          CASE
            WHEN COALESCE(e.total_encontros, 0) > 0
              THEN (pu.presencas_feitas::numeric / e.total_encontros::numeric) >= 0.75
            ELSE FALSE
          END AS elegivel_75
        FROM presencas_usuario pu
        JOIN turmas_filtradas tf ON tf.turma_id = pu.turma_id
        LEFT JOIN encontros e ON e.turma_id = pu.turma_id
      ),
      resumo_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento_titulo,
          COUNT(DISTINCT i.usuario_id)::int AS total_inscritos_evento,
          COUNT(DISTINCT CASE WHEN ept.elegivel_75 THEN ept.usuario_id END)::int AS total_elegiveis_evento
        FROM eventos e
        JOIN turmas_filtradas tf ON tf.evento_id = e.id
        JOIN ${inscrTable} i ON i.turma_id = tf.turma_id
        LEFT JOIN elegiveis_por_turma ept
          ON ept.evento_id = e.id
         AND ept.usuario_id = i.usuario_id
        GROUP BY e.id, e.titulo
      )
      SELECT
        re.evento_titulo AS titulo,
        re.total_inscritos_evento AS total_inscritos,
        re.total_elegiveis_evento AS total_presentes,
        CASE
          WHEN re.total_inscritos_evento > 0
            THEN ROUND((re.total_elegiveis_evento::numeric / re.total_inscritos_evento::numeric) * 100, 2)
          ELSE 0
        END AS percentual
      FROM resumo_evento re
      ORDER BY re.evento_titulo
    `;

    const eventosPorMesSQL = `
      SELECT
        TO_CHAR(t.data_inicio, 'Mon') AS mes,
        COUNT(*)::int AS total,
        EXTRACT(MONTH FROM t.data_inicio)::int AS mes_num
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY mes, mes_num
      ORDER BY mes_num
    `;

    const eventosPorTipoSQL = `
      SELECT
        e.tipo,
        COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY e.tipo
      ORDER BY e.tipo
    `;

    const [
      totalEventosQ,
      inscritosUnicosQ,
      mediaAvaliacaoQ,
      mediaInstrutorQ,
      presencaQ,
      eventosPorMesQ,
      eventosPorTipoQ,
    ] = await Promise.all([
      settled("totalEventos", runQuery(db, totalEventosSQL, params), [{ total: 0 }]),
      settled("inscritosUnicos", runQuery(db, inscritosUnicosSQL, params), [{ total: 0 }]),
      settled(
        "mediaAvaliacao",
        queryFirstWorking(db, [mediaAvaliacaoSQL_avaliacoes, mediaAvaliacaoSQL_avaliacao], params),
        [{ media_evento: 0 }]
      ),
      settled(
        "mediaInstrutor",
        queryFirstWorking(db, [mediaInstrutorSQL_avaliacoes, mediaInstrutorSQL_avaliacao], params),
        [{ media_instrutor: 0 }]
      ),
      settled("presenca", runQuery(db, presencaSQL, params), []),
      settled("eventosPorMes", runQuery(db, eventosPorMesSQL, params), []),
      settled("eventosPorTipo", runQuery(db, eventosPorTipoSQL, params), []),
    ]);

    let totalInscritosGlobal = 0;
    let totalElegiveisGlobal = 0;

    for (const row of presencaQ.rows || []) {
      totalInscritosGlobal += Number(row.total_inscritos) || 0;
      totalElegiveisGlobal += Number(row.total_presentes) || 0;
    }

    const percentualPresencaGlobal =
      totalInscritosGlobal > 0
        ? (totalElegiveisGlobal / totalInscritosGlobal) * 100
        : 0;

    const payload = {
      totalEventos: num(totalEventosQ.rows?.[0]?.total, 0),
      inscritosUnicos: num(inscritosUnicosQ.rows?.[0]?.total, 0),
      mediaAvaliacao: num(mediaAvaliacaoQ.rows?.[0]?.media_evento, 0),
      mediaInstrutor: num(mediaInstrutorQ.rows?.[0]?.media_instrutor, 0),
      mediainstrutor: num(mediaInstrutorQ.rows?.[0]?.media_instrutor, 0),

      percentualPresenca: Number(percentualPresencaGlobal.toFixed(2)),

      eventosPorMes: formatarGrafico(eventosPorMesQ.rows || [], "mes"),
      eventosPorTipo: formatarGrafico(eventosPorTipoQ.rows || [], "tipo"),
      presencaPorEvento: formatarGrafico(presencaQ.rows || [], "titulo"),
    };

    res.setHeader("X-Dashboard-Handler", "dashboardController@premium+++");

    logInfo(rid, "obterDashboard:ok", {
      totalEventos: payload.totalEventos,
      inscritosUnicos: payload.inscritosUnicos,
      mediaAvaliacao: payload.mediaAvaliacao,
      mediaInstrutor: payload.mediaInstrutor,
      percentualPresenca: payload.percentualPresenca,
    });

    return res.json(payload);
  } catch (error) {
    logErr(rid, "obterDashboard erro", error);
    return res.status(500).json({
      erro: "Erro ao gerar dashboard",
      ...(IS_DEV ? { details: error?.message } : {}),
    });
  }
}

/* =========================================================================
   Exports
=========================================================================== */
module.exports = {
  getResumoDashboard,
  getAvaliacaoRecentesInstrutor,
  getEventosAvaliacaoPorInstrutor,
  obterDashboard,
};