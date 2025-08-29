// 📁 src/controllers/turmasControllerAdministrador.js
const db = require('../db');

/**
 * 📍 Lista todas as turmas com informações para o painel do administrador
 *    Datas/horários calculados a partir de `datas_turma` (com fallback em `turmas`).
 * @route GET /api/administrador/turmas
 */
async function listarTurmasadministrador(req, res) {
  try {
    const query = `
      SELECT
        t.id,
        t.nome,

        /* ▸ Período sempre como 'YYYY-MM-DD' a partir de datas_turma */
        to_char(
          COALESCE(
            (SELECT MIN(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            t.data_inicio::date
          ),
          'YYYY-MM-DD'
        ) AS data_inicio,

        to_char(
          COALESCE(
            (SELECT MAX(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            t.data_fim::date
          ),
          'YYYY-MM-DD'
        ) AS data_fim,

        /* ▸ Horário mais frequente em datas_turma -> 'HH:MM'; fallback coluna da turma; fallback default */
        COALESCE(
          (
            SELECT to_char(z.hi, 'HH24:MI') FROM (
              SELECT dt.horario_inicio AS hi, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, hi
              LIMIT 1
            ) z
          ),
          to_char(t.horario_inicio, 'HH24:MI'),
          '08:00'
        ) AS horario_inicio,

        COALESCE(
          (
            SELECT to_char(z.hf, 'HH24:MI') FROM (
              SELECT dt.horario_fim AS hf, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, hf
              LIMIT 1
            ) z
          ),
          to_char(t.horario_fim, 'HH24:MI'),
          '17:00'
        ) AS horario_fim,

        /* ▸ String combinada 'HH:MM - HH:MM' */
        (
          COALESCE(
            (
              SELECT to_char(z.hi, 'HH24:MI') FROM (
                SELECT dt.horario_inicio AS hi, COUNT(*) c
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
                GROUP BY dt.horario_inicio
                ORDER BY COUNT(*) DESC, hi
                LIMIT 1
              ) z
            ),
            to_char(t.horario_inicio, 'HH24:MI'),
            '08:00'
          )
          || ' - ' ||
          COALESCE(
            (
              SELECT to_char(z.hf, 'HH24:MI') FROM (
                SELECT dt.horario_fim AS hf, COUNT(*) c
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
                GROUP BY dt.horario_fim
                ORDER BY COUNT(*) DESC, hf
                LIMIT 1
              ) z
            ),
            to_char(t.horario_fim, 'HH24:MI'),
            '17:00'
          )
        ) AS horario,

        t.vagas_total AS vagas_total,
        COUNT(i.id) AS vagas_ocupadas,

        e.id    AS evento_id,
        e.titulo AS evento_titulo,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutor,

        /* ▸ Status baseado em datas_turma (min/max) */
        CASE
          WHEN CURRENT_DATE < COALESCE(
            (SELECT MIN(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            t.data_inicio::date
          ) THEN 'programado'
          WHEN CURRENT_DATE > COALESCE(
            (SELECT MAX(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            t.data_fim::date
          ) THEN 'encerrado'
          ELSE 'em_andamento'
        END AS status

      FROM turmas t
      JOIN eventos e           ON e.id = t.evento_id
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u      ON u.id = ei.instrutor_id
      LEFT JOIN inscricoes i    ON i.turma_id = t.id
      GROUP BY t.id, e.id
      ORDER BY
        COALESCE(
          (SELECT MIN(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
          t.data_inicio::date
        ) ASC, t.id ASC
    `;

    const resultado = await db.query(query);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('❌ Erro ao carregar turmas (administrador):', error.message);
    res.status(500).json({ erro: 'Erro ao buscar turmas para o painel administrador.' });
  }
}

module.exports = {
  listarTurmasadministrador,
};
