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
 * - tem frequência geral >= 75% (baseado em dias distintos)
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
    WHERE i.usuario_id = $1
      AND a.id IS NULL
      -- turma finalizada (fim + horario_fim já passou)
      AND ( now() > (t.data_fim::timestamp + t.horario_fim) )
      -- frequência geral >= 75% no intervalo data_inicio..data_fim
      AND (
        (
          SELECT COUNT(DISTINCT p.data_presenca)::int
          FROM presencas p
          WHERE p.usuario_id = i.usuario_id
            AND p.turma_id   = t.id
        ) >= CEIL(0.75 * ( (t.data_fim - t.data_inicio) + 1 ))
      )
    ORDER BY t.data_fim DESC
    `,
    [uid]
  );

  return result.rows || [];
}

module.exports = { buscarAvaliacaoPendentes };
