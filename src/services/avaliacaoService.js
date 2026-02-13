// 📁 src/services/avaliacaoService.js
const dbFallback = require("../db");

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/**
 * Lista turmas encerradas em que o usuário:
 * - está inscrito
 * - ainda não avaliou
 * - tem frequência geral >= 75% (baseado em dias distintos com presente=TRUE)
 * - encerrou no horário real (datas_turma > turmas)
 *
 * Retorna rows:
 * { evento_id, nome_evento, turma_id, data_inicio, data_fim, horario_fim }
 */
async function buscarAvaliacaoPendentes(usuario_id, opts = {}) {
  const db = opts.db ?? dbFallback;

  const uid = toIntId(usuario_id);
  if (!uid) return [];

  const result = await db.query(
    `
    WITH fim_real AS (
      SELECT
        t.id AS turma_id,
        COALESCE(
          (
            SELECT (dt.data::date + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time))
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
            LIMIT 1
          ),
          (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
        ) AS fim_local
      FROM turmas t
    ),
    total_encontros AS (
      SELECT
        t.id AS turma_id,
        CASE
          WHEN (SELECT COUNT(*) FROM datas_turma dt WHERE dt.turma_id = t.id) > 0
            THEN (SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id)
          ELSE GREATEST(1, ((t.data_fim::date - t.data_inicio::date) + 1))::int
        END AS total
      FROM turmas t
    ),
    presencas_ok AS (
      SELECT
        p.turma_id,
        p.usuario_id,
        COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
      FROM presencas p
      WHERE p.usuario_id = $1
        AND p.presente = TRUE
      GROUP BY p.turma_id, p.usuario_id
    )
    SELECT 
      e.id AS evento_id,
      e.titulo AS nome_evento,
      t.id AS turma_id,
      t.data_inicio,
      t.data_fim,
      t.horario_fim
    FROM inscricoes i
    INNER JOIN turmas t ON i.turma_id = t.id
    INNER JOIN eventos e ON t.evento_id = e.id
    LEFT JOIN avaliacoes a 
      ON a.usuario_id = i.usuario_id
     AND a.turma_id   = t.id
    JOIN fim_real fr ON fr.turma_id = t.id
    JOIN total_encontros te ON te.turma_id = t.id
    LEFT JOIN presencas_ok po ON po.turma_id = t.id AND po.usuario_id = i.usuario_id
    WHERE i.usuario_id = $1
      AND a.id IS NULL
      -- turma finalizada (fim real já passou)
      AND (NOW() AT TIME ZONE 'America/Sao_Paulo') >= fr.fim_local
      -- frequência geral >= 75% (datas_turma > fallback)
      AND COALESCE(po.dias_presentes, 0) >= CEIL(0.75 * te.total)
    ORDER BY t.data_fim DESC
    `,
    [uid]
  );

  return result.rows || [];
}

module.exports = { buscarAvaliacaoPendentes };
