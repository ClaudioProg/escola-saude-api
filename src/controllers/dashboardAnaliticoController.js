// ✅ src/controllers/dashboardAnaliticoController.js
/* eslint-disable no-console */
"use strict";

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;

const { formatarGrafico } = require("../utils/graficos");

const IS_DEV = process.env.NODE_ENV !== "production";

// Campos oficiais da média do evento (11) — (sem desempenho_instrutor)
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

// Normaliza texto no SQL (remove acentos + lower) — funciona com enum via ::text
function sqlNormText(expr) {
  // expr deve ser algo como: a.campo::text
  return `translate(lower(coalesce(${expr}, '')), 'áàãâéêíóôõúç', 'aaaaeeiooouc')`;
}

// Mapeia texto/enum para score (1..5) no SQL — robusto a Ótimo/Otimo/Péssimo/Pessimo etc.
function sqlScore(colExpr) {
  // colExpr: ex.: "a.divulgacao_evento" (enum ou text)
  const norm = sqlNormText(`${colExpr}::text`);
  return `
    CASE
      WHEN ${norm} IN ('otimo','excelente','muito bom','muitobom') THEN 5
      WHEN ${norm} = 'bom' THEN 4
      WHEN ${norm} = 'regular' THEN 3
      WHEN ${norm} = 'ruim' THEN 2
      WHEN ${norm} IN ('pessimo','pessima') THEN 1
      ELSE NULL
    END
  `;
}

/**
 * 📊 Dashboard analítico (admin)
 * @route GET /api/dashboard-analitico?ano=&mes=&tipo=
 */
async function obterDashboard(req, res) {
  const { ano, mes, tipo } = req.query;

  // validação leve
  const anoNum = ano ? Number(ano) : null;
  const mesNum = mes ? Number(mes) : null;
  const tipoStr = tipo ? String(tipo).trim() : null;

  const params = [];
  const cond = [];

  // Mantém o comportamento atual: filtra por data_inicio da turma
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

  // helper premium: Promise.allSettled com fallback
  async function settled(label, promise, fallbackRows = []) {
    const r = await Promise.allSettled([promise]);
    const out = r[0];
    if (out.status === "fulfilled") return out.value;
    console.error(`❌ [dashboard-analitico:${label}]`, IS_DEV ? (out.reason?.stack || out.reason) : (out.reason?.message || out.reason));
    return { rows: fallbackRows, rowCount: fallbackRows.length };
  }

  try {
    if (IS_DEV) console.log("[dashboard-analitico] req:", { ano: anoNum, mes: mesNum, tipo: tipoStr });

    /* =====================================================
       1) Métricas base
    ====================================================== */

    const totalEventosSQL = `
      SELECT COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
    `;

    const inscritosUnicosSQL = `
      SELECT COUNT(DISTINCT i.usuario_id)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
    `;

    // ✅ média do evento: soma apenas scores válidos e divide pela contagem válida
    const mediaAvaliacoesSQL = `
      WITH a0 AS (
        SELECT
          (${NOTAS_EVENTO.map((c) => sqlScore(`a.${c}`)).join(" + ")})::numeric AS soma,
          (
            ${NOTAS_EVENTO.map((c) => `CASE WHEN ${sqlScore(`a.${c}`)} IS NULL THEN 0 ELSE 1 END`).join(" + ")}
          )::numeric AS qtd
        FROM avaliacoes a
        JOIN turmas t ON a.turma_id = t.id
        JOIN eventos e ON t.evento_id = e.id
        ${where}
      )
      SELECT
        ROUND(AVG(CASE WHEN qtd > 0 THEN (soma / qtd) ELSE NULL END), 2) AS media_evento
      FROM a0
    `;

    const mediaInstrutorSQL = `
      SELECT ROUND(
        AVG(${sqlScore("a.desempenho_instrutor")})::numeric,
        2
      ) AS media_instrutor
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
    `;

    /* =====================================================
       2) Presença ≥ 75%
    ====================================================== */

    const presencaSQL = `
      WITH turmas_filtradas AS (
        SELECT t.id AS turma_id, t.evento_id, t.data_inicio::date AS di, t.data_fim::date AS df
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
        ${where}
      ),
      has_datas AS (
        SELECT (to_regclass('public.datas_turma') IS NOT NULL) AS ok
      ),
      encontros AS (
        SELECT
          tf.turma_id,
          COUNT(*)::int AS total_encontros
        FROM turmas_filtradas tf, has_datas hd
        JOIN LATERAL (
          SELECT dt.data::date AS d
          FROM datas_turma dt
          WHERE hd.ok = TRUE AND dt.turma_id = tf.turma_id

          UNION ALL
          SELECT DISTINCT p.data_presenca::date AS d
          FROM presencas p
          WHERE hd.ok = FALSE AND p.turma_id = tf.turma_id

          UNION ALL
          SELECT gs::date AS d
          FROM generate_series(tf.di, tf.df, interval '1 day') gs
        ) x ON TRUE
        WHERE x.d <= NOW()::date
        GROUP BY tf.turma_id
      ),
      presencas_usuario AS (
        SELECT
          i.usuario_id,
          i.turma_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS presencas_feitas
        FROM inscricoes i
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
        JOIN inscricoes i ON i.turma_id = tf.turma_id
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

    /* =====================================================
       3) Gráficos
    ====================================================== */

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
      SELECT e.tipo, COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY e.tipo
      ORDER BY e.tipo
    `;

    // 🚀 paralelo — com allSettled (não derruba tudo)
    const [
      totalEventosQ,
      inscritosUnicosQ,
      mediaAvaliacoesQ,
      mediaInstrutorQ,
      presencaQ,
      eventosPorMesQ,
      eventosPorTipoQ,
    ] = await Promise.all([
      settled("totalEventos", db.query(totalEventosSQL, params), [{ total: 0 }]),
      settled("inscritosUnicos", db.query(inscritosUnicosSQL, params), [{ total: 0 }]),
      settled("mediaAvaliacoes", db.query(mediaAvaliacoesSQL, params), [{ media_evento: 0 }]),
      settled("mediaInstrutor", db.query(mediaInstrutorSQL, params), [{ media_instrutor: 0 }]),
      settled("presenca", db.query(presencaSQL, params), []),
      settled("eventosPorMes", db.query(eventosPorMesSQL, params), []),
      settled("eventosPorTipo", db.query(eventosPorTipoSQL, params), []),
    ]);

    // Global presença
    let totalInscritosGlobal = 0;
    let totalElegiveisGlobal = 0;

    for (const row of presencaQ.rows || []) {
      totalInscritosGlobal += Number(row.total_inscritos) || 0;
      totalElegiveisGlobal += Number(row.total_presentes) || 0;
    }

    const percentualPresencaGlobal =
      totalInscritosGlobal > 0 ? (totalElegiveisGlobal / totalInscritosGlobal) * 100 : 0;

    res.setHeader("X-Dashboard-Handler", "dashboardAnaliticoController@premium");
    return res.json({
      totalEventos: Number(totalEventosQ.rows?.[0]?.total || 0),
      inscritosUnicos: Number(inscritosUnicosQ.rows?.[0]?.total || 0),
      mediaAvaliacoes: Number(mediaAvaliacoesQ.rows?.[0]?.media_evento || 0),
      mediaInstrutor: Number(mediaInstrutorQ.rows?.[0]?.media_instrutor || 0),

      // compat antiga (se algum front antigo usa esse campo)
      mediainstrutor: Number(mediaInstrutorQ.rows?.[0]?.media_instrutor || 0),

      percentualPresenca: Number(percentualPresencaGlobal.toFixed(2)),

      eventosPorMes: formatarGrafico(eventosPorMesQ.rows || [], "mes"),
      eventosPorTipo: formatarGrafico(eventosPorTipoQ.rows || [], "tipo"),
      presencaPorEvento: formatarGrafico(presencaQ.rows || [], "titulo"),
    });
  } catch (error) {
    console.error("❌ [dashboard-analitico] erro:", IS_DEV ? (error?.stack || error) : (error?.message || error));
    return res.status(500).json({
      erro: "Erro ao gerar dashboard",
      ...(IS_DEV ? { details: error?.message } : {}),
    });
  }
}

module.exports = { obterDashboard };
