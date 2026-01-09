/* eslint-disable no-console */
const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================
   Utils premium
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

function notaInstrutorTo5(valor) {
  if (valor == null) return null;
  const s = String(valor).trim().toLowerCase();
  const map = {
    "ótimo": 5,
    "otimo": 5,
    "excelente": 5,
    "muito bom": 5,
    "bom": 4,
    "regular": 3,
    "médio": 3,
    "medio": 3,
    "ruim": 2,
    "péssimo": 1,
    "pessimo": 1,
    "muito ruim": 1,
  };
  if (map[s] != null) return map[s];

  const num = Number(String(valor).replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;

  return null;
}

function to10From5(v5) {
  if (!Number.isFinite(v5)) return null;
  return Math.round(v5 * 2 * 10) / 10; // 1 casa, ex: 8.6
}

function safeJsonError(res, err, fallbackMsg = "Erro interno.") {
  const status = err?.status || 500;
  if (IS_DEV) console.error(err);
  return res.status(status).json({
    erro: err?.status ? err.message : fallbackMsg,
    detalhe: IS_DEV ? (err?.message || String(err)) : undefined,
  });
}

/* ===================================================================
   📋 Lista eventos/turmas com avaliações do instrutor (SEM N+1)
   GET /api/instrutor/:id/eventos-avaliacoes
   - Agrupa por evento -> turmas
   - Traz média + comentários da turma (quando houver)
   =================================================================== */
async function getEventosAvaliacoesPorInstrutor(req, res) {
  try {
    const instrutorId = assertIntId(req.params.id, "instrutor_id");

    /**
     * ✅ Estratégia (premium):
     * - 1 query para “cabeçalho” (eventos/turmas + média)
     * - 1 query para “comentários” (todas as turmas de uma vez)
     *
     * ⚠️ Observação de schema:
     * - Se sua tabela avaliacoes tiver instrutor_id, filtramos.
     * - Se não tiver, ainda retornamos por turma (turma ensinada pelo instrutor),
     *   mas os comentários virão do que existir para a turma.
     */

    // 1) Turmas ministradas pelo instrutor (preferência: turma_instrutor; fallback: evento_instrutor)
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

    // Se não ministra nada, retorna vazio
    if (!turmaIds.length) return res.json([]);

    // 2) Cabeçalho: eventos + turmas + média de desempenho_instrutor (na turma)
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

    // 3) Comentários: pega tudo de uma vez (SEM N+1)
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

    // Indexa comentários por turma
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

    // Monta resposta agrupada
    const eventosMap = new Map();

    for (const row of cabecalho.rows || []) {
      const eventoId = Number(row.evento_id);
      const turmaId = Number(row.turma_id);

      if (!eventosMap.has(eventoId)) {
        eventosMap.set(eventoId, {
          id: eventoId,
          titulo: row.evento_titulo,
          turmas: [],
        });
      }

      const nota5 = row.nota_media_5 != null ? Number(row.nota_media_5) : null;

      eventosMap.get(eventoId).turmas.push({
        id: turmaId,
        nome: row.turma_nome,
        data: row.data_inicio, // DD/MM/YYYY (front-ready)
        nota_media: nota5,     // em 1..5 (mantém o que você já tinha)
        nota_media_10: nota5 != null ? to10From5(nota5) : null, // bônus premium pro front
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

    /* ===========================
       ✅ CONCLUÍDOS
       =========================== */
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

    /* ===========================
       ✅ NOVOS STATS
       =========================== */
    const inscricoesFuturasQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio,'00:00')::time) > NOW()
      `,
      [usuarioId]
    );

    const inscricoesAtuaisQ = await db.query(
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

    /* ===========================
       ✅ Presenças / Faltas / Nota
       =========================== */
    const pfDash = await db.query(
      `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.data_inicio::date AS di_raw,
          t.data_fim::date     AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT
          mt.turma_id,
          dt.data::date AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT
          mt.turma_id,
          gs::date AS d
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

    /* ===========================
       ✅ Média como instrutor (0..10)
       =========================== */
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
      inscricoesFuturas: Number(inscricoesFuturasQ.rows?.[0]?.total ?? 0) || 0,
      avaliacoesPendentes: Number(avalPendentesQ.rows?.[0]?.total ?? 0) || 0,
      certificadosEmitidos: Number(certificadosEmitidosQ.rows?.[0]?.total ?? 0) || 0,
      presencasTotal: presencas_total,
      faltasTotal: faltas_total,
      notaUsuario: nota_usuario,

      // compatibilidade / legado
      cursosRealizados: Number(cursosQ.rows?.[0]?.eventos_concluidos ?? 0) || 0,
      eventosinstrutor: Number(eventosInstrutorQ.rows?.[0]?.total ?? 0) || 0,
      inscricoesAtuais: Number(inscricoesAtuaisQ.rows?.[0]?.total ?? 0) || 0,
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
   GET /api/dashboard-usuario/avaliacoes-recentes
   =================================================================== */
async function getAvaliacoesRecentesInstrutor(req, res) {
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

module.exports = {
  getResumoDashboard,
  getAvaliacoesRecentesInstrutor,
  getEventosAvaliacoesPorInstrutor,
};
