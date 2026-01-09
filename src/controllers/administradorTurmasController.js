// ✅ src/controllers/administradorTurmasController.js
/* eslint-disable no-console */
const dbFallback = require("../db");

/**
 * 📍 Lista todas as turmas com informações para o painel do administrador
 * @route GET /api/administrador/turmas
 */
async function listarTurmasadministrador(req, res) {
  const db = req?.db ?? dbFallback;

  try {
    /**
     * Premium:
     * - Evita multiplicação de linhas (instrutores x inscrições) usando agregações em subqueries
     * - Status considera data + horário (timestamp)
     * - COUNT(DISTINCT) garante vagas_ocupadas correto
     */
    const sql = `
      WITH instrutores_por_evento AS (
        SELECT
          ei.evento_id,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
              FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) AS instrutor
        FROM evento_instrutor ei
        LEFT JOIN usuarios u ON u.id = ei.instrutor_id
        GROUP BY ei.evento_id
      ),
      inscricoes_por_turma AS (
        SELECT
          i.turma_id,
          COUNT(DISTINCT i.id)::int AS vagas_ocupadas
        FROM inscricoes i
        GROUP BY i.turma_id
      )
      SELECT
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        to_char(t.horario_inicio, 'HH24:MI') || ' - ' || to_char(t.horario_fim, 'HH24:MI') AS horario,
        t.vagas_total AS vagas_total,
        COALESCE(ip.vagas_ocupadas, 0) AS vagas_ocupadas,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        COALESCE(ie.instrutor, '[]'::json) AS instrutor,

        CASE
          -- status por timestamp (data + hora)
          WHEN now() < (t.data_inicio::timestamp + t.horario_inicio) THEN 'programado'
          WHEN now() >= (t.data_inicio::timestamp + t.horario_inicio)
           AND now() <= (t.data_fim::timestamp + t.horario_fim) THEN 'em_andamento'
          ELSE 'encerrado'
        END AS status

      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN instrutores_por_evento ie ON ie.evento_id = e.id
      LEFT JOIN inscricoes_por_turma ip ON ip.turma_id = t.id
      ORDER BY t.data_inicio ASC, t.horario_inicio ASC, t.id ASC;
    `;

    const { rows } = await db.query(sql);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("[adminTurmas] Erro ao carregar turmas:", {
      rid: req?.requestId,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });

    return res.status(500).json({
      erro: "Erro ao buscar turmas para o painel administrador.",
      requestId: res.getHeader?.("X-Request-Id"),
    });
  }
}

module.exports = {
  listarTurmasadministrador,
};
