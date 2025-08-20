// 📁 src/controllers/datasEventoController.js
const db = require("../db");

/**
 * Lista as datas de uma turma.
 * - via padrão (intervalo): gera 1 linha por dia entre data_inicio e data_fim da turma,
 *   reaproveitando horario_inicio/horario_fim da turma.
 * - via=presencas: lista as datas distintas efetivamente registradas em "presencas".
 *
 * @route GET /api/datas/turma/:id          → intervalo (default)
 * @route GET /api/datas/turma/:id?via=presencas
 *
 * Resposta: [{ data: 'YYYY-MM-DD', horario_inicio: 'HH:mm', horario_fim: 'HH:mm' }, ...]
 */
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "intervalo").toLowerCase();

  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: "turma_id inválido" });
  }

  try {
    if (via === "presencas") {
      // Datas distintas existentes na tabela presencas para a turma
      const sql = `
        SELECT DISTINCT
          p.data_presenca::date AS data,
          COALESCE(t.horario_inicio, '00:00') AS horario_inicio,
          COALESCE(t.horario_fim,   '23:59') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC;
      `;
      const { rows } = await db.query(sql, [turmaId]);
      return res.json(rows);
    }

    // via = intervalo (default): usa generate_series do Postgres para cobrir todo o período da turma
    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date    AS df,
          COALESCE(horario_inicio, '00:00') AS hi,
          COALESCE(horario_fim,   '23:59')  AS hf
        FROM turmas
        WHERE id = $1
      )
      SELECT
        gs::date AS data,
        t.hi     AS horario_inicio,
        t.hf     AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC;
    `;
    const { rows } = await db.query(sql, [turmaId]);
    return res.json(rows);
  } catch (erro) {
    console.error("❌ [datasEvento] erro:", erro);
    return res.status(500).json({ erro: "Erro ao buscar datas da turma.", detalhe: erro.message });
  }
}

module.exports = { listarDatasDaTurma };
