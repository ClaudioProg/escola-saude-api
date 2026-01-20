/* eslint-disable no-console */
// ✅ src/controllers/dashboardController.js
"use strict";

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;
const { formatarGrafico } = require("../utils/graficos");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================
   Helpers premium (comuns)
========================= */
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
    detalhe: IS_DEV ? (err?.message || String(err)) : undefined,
  });
}

// 1..5 para nota do instrutor (aceita enum/texto/num)
function notaInstrutorTo5(valor) {
  if (valor == null) return null;
  const s = String(valor).trim().toLowerCase();
  const map = {
    "ótimo": 5, "otimo": 5, "excelente": 5, "muito bom": 5,
    "bom": 4,
    "regular": 3, "médio": 3, "medio": 3,
    "ruim": 2,
    "péssimo": 1, "pessimo": 1, "muito ruim": 1,
  };
  if (map[s] != null) return map[s];

  const num = Number(String(valor).replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;

  return null;
}

function to10From5(v5) {
  if (!Number.isFinite(v5)) return null;
  return Math.round(v5 * 2 * 10) / 10; // 1 casa (ex.: 8.6)
}

/* ===================================================================
   📋 Eventos + turmas ministradas por um instrutor (com médias/comentários)
   GET /api/instrutor/:id/eventos-avaliacao
=================================================================== */
async function getEventosAvaliacaoPorInstrutor(req, res) {
  try {
    const instrutorId = assertIntId(req.params.id, "instrutor_id");

    // Turmas do instrutor (preferência: turma_instrutor; fallback: evento_instrutor)
    const turmasMinistradas = await db.query(
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
      SELECT turma_id FROM todas ORDER BY turma_id;
      `,
      [instrutorId]
    );

    const turmaIds = (turmasMinistradas.rows || []).map((r) => Number(r.turma_id)).filter(Boolean);
    if (!turmaIds.length) return res.json([]);

    // Cabeçalho: evento/turma + média de desempenho do instrutor (1..5)
    const cabecalho = await db.query(
      `
      SELECT
        e.id     AS evento_id,
        e.titulo AS evento_titulo,
        t.id     AS turma_id,
        t.nome   AS turma_nome,
        to_char(t.data_inicio::date, 'DD/MM/YYYY') AS data_inicio,
        ROUND(AVG(
          CASE a.desempenho_instrutor
            WHEN 'Ótimo'   THEN 5
            WHEN 'Bom'     THEN 4
            WHEN 'Regular' THEN 3
            WHEN 'Ruim'    THEN 2
            WHEN 'Péssimo' THEN 1
            ELSE NULL
          END
        )::numeric, 1) AS nota_media_5
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN avaliacoes a ON a.turma_id = t.id
      WHERE t.id = ANY($1::int[])
      GROUP BY e.id, e.titulo, t.id, t.nome, t.data_inicio
      ORDER BY e.titulo ASC, t.data_inicio DESC;
      `,
      [turmaIds]
    );

    // Comentários de todas as turmas (sem N+1)
    const comentariosQ = await db.query(
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
      ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC;
      `,
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
      if (!eventosMap.has(eventoId)) {
        eventosMap.set(eventoId, { id: eventoId, titulo: row.evento_titulo, turmas: [] });
      }
      const nota5 = row.nota_media_5 != null ? Number(row.nota_media_5) : null;
      eventosMap.get(eventoId).turmas.push({
        id: turmaId,
        nome: row.turma_nome,
        data: row.data_inicio,                // DD/MM/YYYY
        nota_media: nota5,                    // 1..5
        nota_media_10: nota5 != null ? to10From5(nota5) : null,
        comentarios: comentariosPorTurma.get(turmaId) || [],
      });
    }

    return res.json(Array.from(eventosMap.values()));
  } catch (err) {
    console.error("❌ Erro ao buscar eventos do instrutor:", err?.message || err);
    return safeJsonError(res, err, "Erro ao buscar eventos ministrados.");
  }
}

/* ===================================================================
   📊 Resumo do dashboard do usuário
   GET /api/dashboard-usuario
=================================================================== */
async function getResumoDashboard(req, res) {
  try {
    const usuarioId = assertIntId(req.user?.id, "usuario_id");

    const cursosQ = await db.query(
      `
      SELECT COUNT(DISTINCT e.id)::int AS eventos_concluidos
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim,'23:59')::time) < NOW()
      `,
      [usuarioId]
    );

    const eventosInstrutorQ = await db.query(
      `SELECT COUNT(*)::int AS total FROM evento_instrutor WHERE instrutor_id = $1`,
      [usuarioId]
    );

    const inscricaoFuturasQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time) > NOW()
      `,
      [usuarioId]
    );

    const inscricaoAtuaisQ = await db.query(
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

    const proximosQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time) > NOW()
      `,
      [usuarioId]
    );

    const avalPendentesQ = await db.query(
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

    const certificadosEmitidosQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados c
      WHERE c.usuario_id = $1
        AND c.gerado_em IS NOT NULL
      `,
      [usuarioId]
    );

    const certificadosTotalQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    // Presenças/Faltas e nota (0..10)
    const pfDash = await db.query(
      `
      WITH minhas_turmas AS (
        SELECT t.id AS turma_id,
               t.data_inicio::date AS di_raw,
               t.data_fim::date    AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT mt.turma_id, dt.data::date AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL
        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT mt.turma_id, gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      pres AS (
        SELECT p.turma_id,
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
          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE AND p.presente IS TRUE) AS presentes_passados,
          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE AND COALESCE(p.presente, FALSE) IS NOT TRUE) AS ausencias_passadas
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
    const totalPF = presencas_total + faltas_total;
    const nota_usuario =
      totalPF > 0 ? Math.max(0, Math.min(10, Math.round((10 - (faltas_total / totalPF) * 10) * 10) / 10)) : null;

    // Média recebida como instrutor (0..10)
    const mediaInstrutorQ = await db.query(
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
      )::numeric, 2) AS media_5
      FROM avaliacoes a
      WHERE a.instrutor_id = $1
      `,
      [usuarioId]
    );

    const media5 = mediaInstrutorQ.rows?.[0]?.media_5;
    const mediaAvaliacao10 = media5 != null ? to10From5(Number(media5)) : null;

    return res.json({
      // HomeEscola (painel)
      inscricaoFuturas: Number(inscricaoFuturasQ.rows?.[0]?.total ?? 0) || 0,
      avaliacaoPendentes: Number(avalPendentesQ.rows?.[0]?.total ?? 0) || 0,
      certificadosEmitidos: Number(certificadosEmitidosQ.rows?.[0]?.total ?? 0) || 0,
      presencasTotal: presencas_total,
      faltasTotal: faltas_total,
      notaUsuario: nota_usuario,

      // compat/legado
      cursosRealizados: Number(cursosQ.rows?.[0]?.eventos_concluidos ?? 0) || 0,
      eventosinstrutor: Number(eventosInstrutorQ.rows?.[0]?.total ?? 0) || 0,
      inscricaoAtuais: Number(inscricaoAtuaisQ.rows?.[0]?.total ?? 0) || 0,
      proximosEventos: Number(proximosQ.rows?.[0]?.total ?? 0) || 0,
      certificadosTotal: Number(certificadosTotalQ.rows?.[0]?.total ?? 0) || 0,

      // premium: número (não string)
      mediaAvaliacao: mediaAvaliacao10, // null se não tiver
    });
  } catch (err) {
    console.error("❌ Erro no dashboard:", err?.message || err);
    return safeJsonError(res, err, "Erro ao carregar dados do dashboard.");
  }
}

/* ===================================================================
   ✅ Últimas avaliações recebidas como instrutor (0..10)
   GET /api/dashboard-usuario/avaliacao-recentes
=================================================================== */
async function getAvaliacaoRecentesInstrutor(req, res) {
  try {
    const usuarioId = assertIntId(req.user?.id, "usuario_id");

    const { rows } = await db.query(
      `
      SELECT
        e.titulo AS evento,
        a.desempenho_instrutor,
        a.data_avaliacao
      FROM avaliacoes a
      JOIN turmas t  ON t.id = a.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE a.instrutor_id = $1
      ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
      LIMIT 10
      `,
      [usuarioId]
    );

    const out = (rows || []).map((r) => {
      const v5 = notaInstrutorTo5(r.desempenho_instrutor);
      return {
        evento: r.evento,
        nota: v5 != null ? to10From5(v5) : null,
        data_avaliacao: r.data_avaliacao ?? null,
      };
    });

    return res.json(out);
  } catch (err) {
    console.error("Erro ao buscar últimas avaliações:", err?.message || err);
    return safeJsonError(res, err, "Erro ao buscar últimas avaliações.");
  }
}

/* ===================================================================
   📊 Dashboard analítico (admin) — GET /api/dashboard-analitico?ano=&mes=&tipo=
=================================================================== */

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

async function obterDashboard(req, res) {
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
    console.error(`❌ [dashboard-analitico:${label}]`, IS_DEV ? (out.reason?.stack || out.reason) : (out.reason?.message || out.reason));
    return { rows: fallbackRows, rowCount: fallbackRows.length };
  }

  try {
    if (IS_DEV) console.log("[dashboard-analitico] req:", { ano: anoNum, mes: mesNum, tipo: tipoStr });

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

    // média do evento (só campos oficiais, ignorando NULLs)
    const mediaAvaliacaoSQL = `
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
      SELECT ROUND(AVG(CASE WHEN qtd > 0 THEN (soma / qtd) ELSE NULL END), 2) AS media_evento
      FROM a0
    `;

    const mediaInstrutorSQL = `
      SELECT ROUND(AVG(${sqlScore("a.desempenho_instrutor")})::numeric, 2) AS media_instrutor
      FROM avaliacoes a
      JOIN turmas t ON a.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      ${where}
    `;

    // Presença ≥ 75%
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
        SELECT tf.turma_id, COUNT(*)::int AS total_encontros
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
        SELECT i.usuario_id, i.turma_id,
               COUNT(DISTINCT p.data_presenca::date)::int AS presencas_feitas
        FROM inscricoes i
        JOIN turmas_filtradas tf ON tf.turma_id = i.turma_id
        LEFT JOIN presencas p
          ON p.turma_id = i.turma_id AND p.usuario_id = i.usuario_id AND p.presente = TRUE
        GROUP BY i.usuario_id, i.turma_id
      ),
      elegiveis_por_turma AS (
        SELECT pu.usuario_id, pu.turma_id, tf.evento_id,
               CASE WHEN COALESCE(e.total_encontros, 0) > 0
                    THEN (pu.presencas_feitas::numeric / e.total_encontros::numeric) >= 0.75
                    ELSE FALSE
               END AS elegivel_75
        FROM presencas_usuario pu
        JOIN turmas_filtradas tf ON tf.turma_id = pu.turma_id
        LEFT JOIN encontros e ON e.turma_id = pu.turma_id
      ),
      resumo_evento AS (
        SELECT e.id AS evento_id, e.titulo AS evento_titulo,
               COUNT(DISTINCT i.usuario_id)::int AS total_inscritos_evento,
               COUNT(DISTINCT CASE WHEN ept.elegivel_75 THEN ept.usuario_id END)::int AS total_elegiveis_evento
        FROM eventos e
        JOIN turmas_filtradas tf ON tf.evento_id = e.id
        JOIN inscricao i ON i.turma_id = tf.turma_id
        LEFT JOIN elegiveis_por_turma ept
          ON ept.evento_id = e.id AND ept.usuario_id = i.usuario_id
        GROUP BY e.id, e.titulo
      )
      SELECT re.evento_titulo AS titulo,
             re.total_inscritos_evento AS total_inscritos,
             re.total_elegiveis_evento AS total_presentes,
             CASE WHEN re.total_inscritos_evento > 0
                  THEN ROUND((re.total_elegiveis_evento::numeric / re.total_inscritos_evento::numeric) * 100, 2)
                  ELSE 0 END AS percentual
      FROM resumo_evento re
      ORDER BY re.evento_titulo
    `;

    // Gráficos
    const eventosPorMesSQL = `
      SELECT TO_CHAR(t.data_inicio, 'Mon') AS mes,
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

    const [
      totalEventosQ,
      inscritosUnicosQ,
      mediaAvaliacaoQ,
      mediaInstrutorQ,
      presencaQ,
      eventosPorMesQ,
      eventosPorTipoQ,
    ] = await Promise.all([
      settled("totalEventos", db.query(totalEventosSQL, params), [{ total: 0 }]),
      settled("inscritosUnicos", db.query(inscritosUnicosSQL, params), [{ total: 0 }]),
      settled("mediaAvaliacao", db.query(mediaAvaliacaoSQL, params), [{ media_evento: 0 }]),
      settled("mediaInstrutor", db.query(mediaInstrutorSQL, params), [{ media_instrutor: 0 }]),
      settled("presenca", db.query(presencaSQL, params), []),
      settled("eventosPorMes", db.query(eventosPorMesSQL, params), []),
      settled("eventosPorTipo", db.query(eventosPorTipoSQL, params), []),
    ]);

    // Presença global
    let totalInscritosGlobal = 0;
    let totalElegiveisGlobal = 0;
    for (const row of presencaQ.rows || []) {
      totalInscritosGlobal += Number(row.total_inscritos) || 0;
      totalElegiveisGlobal += Number(row.total_presentes) || 0;
    }
    const percentualPresencaGlobal =
      totalInscritosGlobal > 0 ? (totalElegiveisGlobal / totalInscritosGlobal) * 100 : 0;

    res.setHeader("X-Dashboard-Handler", "dashboardController@premium");
    return res.json({
      totalEventos: Number(totalEventosQ.rows?.[0]?.total || 0),
      inscritosUnicos: Number(inscritosUnicosQ.rows?.[0]?.total || 0),
      mediaAvaliacao: Number(mediaAvaliacaoQ.rows?.[0]?.media_evento || 0),
      mediaInstrutor: Number(mediaInstrutorQ.rows?.[0]?.media_instrutor || 0),
      mediainstrutor: Number(mediaInstrutorQ.rows?.[0]?.media_instrutor || 0), // compat

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

/* =========================
   Exports (único controller)
========================= */
module.exports = {
  getResumoDashboard,
  getAvaliacaoRecentesInstrutor,
  getEventosAvaliacaoPorInstrutor,
  obterDashboard, // analítico (admin)
};
