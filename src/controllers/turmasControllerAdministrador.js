/* eslint-disable no-console */
// ✅ src/controllers/turmasControllerAdministrador.js
"use strict";

const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const log = (...a) => IS_DEV && console.log("[TURMAS_ADMIN]", ...a);

/**
 * 📍 Lista todas as turmas com informações para o painel do administrador
 * - Datas/horários calculados a partir de `datas_turma` (fallback em `turmas`)
 * - Instrutores por turma (turma_instrutor) — mais correto que evento_instrutor
 * - Status considerando data+hora (padrão do projeto)
 * @route GET /api/administrador/turmas
 */
async function listarTurmasAdministrador(req, res) {
  try {
    const sql = `
      WITH base AS (
        SELECT
          t.id,
          t.nome,
          t.evento_id,
          t.vagas_total,
          t.data_inicio::date     AS t_data_inicio,
          t.data_fim::date        AS t_data_fim,
          t.horario_inicio        AS t_horario_inicio,
          t.horario_fim           AS t_horario_fim,
          e.titulo                AS evento_titulo
        FROM turmas t
        JOIN eventos e ON e.id = t.evento_id
      ),

      datas_agg AS (
        SELECT
          dt.turma_id,
          MIN(dt.data)::date AS dt_min,
          MAX(dt.data)::date AS dt_max
        FROM datas_turma dt
        GROUP BY dt.turma_id
      ),

      -- "Moda" de horário por turma (início e fim)
      horario_moda AS (
        SELECT
          x.turma_id,
          x.hi_moda,
          y.hf_moda
        FROM (
          SELECT DISTINCT ON (dt.turma_id)
            dt.turma_id,
            dt.horario_inicio AS hi_moda
          FROM datas_turma dt
          WHERE dt.horario_inicio IS NOT NULL
          GROUP BY dt.turma_id, dt.horario_inicio
          ORDER BY dt.turma_id, COUNT(*) DESC, dt.horario_inicio ASC
        ) x
        FULL JOIN (
          SELECT DISTINCT ON (dt.turma_id)
            dt.turma_id,
            dt.horario_fim AS hf_moda
          FROM datas_turma dt
          WHERE dt.horario_fim IS NOT NULL
          GROUP BY dt.turma_id, dt.horario_fim
          ORDER BY dt.turma_id, COUNT(*) DESC, dt.horario_fim ASC
        ) y ON y.turma_id = x.turma_id
      ),

      inscritos AS (
        SELECT
          i.turma_id,
          COUNT(DISTINCT i.id)::int AS vagas_ocupadas
        FROM inscricoes i
        GROUP BY i.turma_id
      ),

      instrutores AS (
        SELECT
          ti.turma_id,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
              FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) AS instrutor
        FROM turma_instrutor ti
        JOIN usuarios u ON u.id = ti.instrutor_id
        GROUP BY ti.turma_id
      )

      SELECT
        b.id,
        b.nome,

        -- período (date-only, YYYY-MM-DD)
        to_char(COALESCE(d.dt_min, b.t_data_inicio), 'YYYY-MM-DD') AS data_inicio,
        to_char(COALESCE(d.dt_max, b.t_data_fim),    'YYYY-MM-DD') AS data_fim,

        -- horários: moda -> fallback da turma -> default
        COALESCE(to_char(h.hi_moda, 'HH24:MI'), to_char(b.t_horario_inicio, 'HH24:MI'), '08:00') AS horario_inicio,
        COALESCE(to_char(h.hf_moda, 'HH24:MI'), to_char(b.t_horario_fim,   'HH24:MI'), '17:00') AS horario_fim,

        (
          COALESCE(to_char(h.hi_moda, 'HH24:MI'), to_char(b.t_horario_inicio, 'HH24:MI'), '08:00')
          || ' - ' ||
          COALESCE(to_char(h.hf_moda, 'HH24:MI'), to_char(b.t_horario_fim,   'HH24:MI'), '17:00')
        ) AS horario,

        b.vagas_total AS vagas_total,
        COALESCE(i.vagas_ocupadas, 0) AS vagas_ocupadas,

        b.evento_id AS evento_id,
        b.evento_titulo AS evento_titulo,

        COALESCE(ins.instrutor, '[]'::json) AS instrutor,

        -- Status considerando data+hora (padrão do projeto)
        CASE
          WHEN (
            now() < (
              (COALESCE(d.dt_min, b.t_data_inicio))::timestamp
              + COALESCE(h.hi_moda, b.t_horario_inicio, '08:00'::time)
            )
          ) THEN 'programado'
          WHEN (
            now() > (
              (COALESCE(d.dt_max, b.t_data_fim))::timestamp
              + COALESCE(h.hf_moda, b.t_horario_fim, '17:00'::time)
            )
          ) THEN 'encerrado'
          ELSE 'em_andamento'
        END AS status

      FROM base b
      LEFT JOIN datas_agg d     ON d.turma_id = b.id
      LEFT JOIN horario_moda h  ON h.turma_id = b.id
      LEFT JOIN inscritos i     ON i.turma_id = b.id
      LEFT JOIN instrutores ins ON ins.turma_id = b.id

      ORDER BY COALESCE(d.dt_min, b.t_data_inicio) ASC, b.id ASC;
    `;

    const result = await db.query(sql);

    log("listarTurmasAdministrador:", { total: result.rows?.length || 0 });
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ [TURMAS_ADMIN] Erro ao carregar turmas:", error);
    return res.status(500).json({
      erro: "Erro ao buscar turmas para o painel administrador.",
      detalhe: IS_DEV ? error?.message : undefined,
    });
  }
}

module.exports = {
  listarTurmasAdministrador,
};
