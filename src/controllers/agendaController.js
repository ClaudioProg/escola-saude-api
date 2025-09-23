// 📁 src/controllers/agendaController.js
const db = require("../db");

/**
 * 📆 Lista eventos da agenda geral (modo administrador com filtros)
 * Retorna OCORRENCIAS (YYYY-MM-DD[]) apenas de datas reais: datas_turma → presencas → []
 * @route GET /api/agenda?local=&start=&end=
 */
async function buscarAgenda(req, res) {
  const { local, start, end } = req.query;
  const params = [];
  let where = "WHERE 1=1";

  if (local) {
    params.push(`%${local}%`);
    where += ` AND e.local ILIKE $${params.length}`;
  }
  if (start) {
    params.push(start);
    // filtra eventos que tenham pelo menos uma turma iniciando a partir de start
    where += ` AND EXISTS (
      SELECT 1 FROM turmas tf
      WHERE tf.evento_id = e.id AND tf.data_inicio >= $${params.length}
    )`;
  }
  if (end) {
    params.push(end);
    // filtra eventos que tenham ao menos uma turma terminando até end
    where += ` AND EXISTS (
      SELECT 1 FROM turmas tf
      WHERE tf.evento_id = e.id AND tf.data_fim <= $${params.length}
    )`;
  }

  const sql = `
    SELECT 
      e.id,
      e.titulo,
      e.local,

      -- datas/horários gerais para status (não usados para pintar bolinhas)
      MIN(t.data_inicio)    AS data_inicio,
      MAX(t.data_fim)       AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim)    AS horario_fim,

      CASE 
        WHEN CURRENT_TIMESTAMP < MIN(t.data_inicio + t.horario_inicio) THEN 'programado'
        WHEN CURRENT_TIMESTAMP BETWEEN MIN(t.data_inicio + t.horario_inicio)
                                 AND MAX(t.data_fim + t.horario_fim) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,

      -- instrutores (mantido)
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome)
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS instrutores,

      -- 🔹 OCORRENCIAS (datas reais)
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM turmas tx
          JOIN datas_turma dt ON dt.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d)
          FROM (
            SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN datas_turma dt ON dt.turma_id = tx.id
            WHERE tx.evento_id = e.id
            ORDER BY 1
          ) z1
        )
        WHEN EXISTS (
          SELECT 1
          FROM turmas tx
          JOIN presencas p ON p.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d)
          FROM (
            SELECT DISTINCT to_char(p.data_presenca::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN presencas p ON p.turma_id = tx.id
            WHERE tx.evento_id = e.id
            ORDER BY 1
          ) z2
        )
        ELSE '[]'::json
      END AS ocorrencias

    FROM eventos e
    LEFT JOIN turmas t         ON t.evento_id = e.id
    LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
    LEFT JOIN usuarios u          ON u.id = ei.instrutor_id
    ${where}
    GROUP BY e.id, e.titulo, e.local
    ORDER BY MIN(t.data_inicio)
  `;

  try {
    const resultado = await db.query(sql, params);
    res.set("X-Agenda-Handler", "agendaController:buscarAgenda@estrita");
    const rows = (resultado.rows || []).map(r => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));
    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar agenda:", error.message);
    res.status(500).json({ erro: "Erro ao carregar dados da agenda." });
  }
}

/**
 * 📅 Lista a agenda de turmas do instrutor autenticado (mantido)
 * @route GET /api/agenda/instrutor
 */
async function buscarAgendaInstrutor(req, res) {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const query = `
      SELECT 
        t.id,
        t.nome AS turma,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.horario_inicio || ' às ' || t.horario_fim AS horario,
        t.vagas_total,
        json_build_object('id', e.id, 'nome', e.titulo) AS evento
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio DESC
    `;

    const resultado = await db.query(query, [usuarioId]);
    const turmas = resultado.rows || [];
    return res.status(200).json(turmas); 
  } catch (error) {
    console.error("❌ Erro ao buscar agenda do instrutor:", error.message);
    res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

/**
 * 🗓️ Agenda do usuário autenticado — somente eventos em que está inscrito
 * Suporta filtros opcionais ?start=YYYY-MM-DD&end=YYYY-MM-DD
 * @route GET /api/agenda/minha
 */
async function buscarAgendaMinha(req, res) {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let whereExtra = "";

    if (start) {
      params.push(start);
      whereExtra += ` AND t.data_inicio >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      whereExtra += ` AND t.data_fim <= $${params.length}`;
    }

    const sql = `
      SELECT 
        e.id,
        e.titulo,
        e.local,

        -- intervalo consolidado das SUAS turmas
        MIN(t.data_inicio)    AS data_inicio,
        MAX(t.data_fim)       AS data_fim,
        MIN(t.horario_inicio) AS horario_inicio,
        MAX(t.horario_fim)    AS horario_fim,

        CASE 
          WHEN CURRENT_TIMESTAMP < MIN(t.data_inicio + t.horario_inicio) THEN 'programado'
          WHEN CURRENT_TIMESTAMP BETWEEN MIN(t.data_inicio + t.horario_inicio)
                                   AND MAX(t.data_fim + t.horario_fim) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutores,

        -- 🔹 OCORRÊNCIAS apenas das turmas nas quais o usuário está inscrito
        CASE
          WHEN EXISTS (
            SELECT 1
              FROM turmas tx
              JOIN inscricoes i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
              JOIN datas_turma dt ON dt.turma_id = tx.id
             WHERE tx.evento_id = e.id
          ) THEN (
            SELECT json_agg(d ORDER BY d)
              FROM (
                SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
                  FROM turmas tx
                  JOIN inscricoes i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
                  JOIN datas_turma dt ON dt.turma_id = tx.id
                 WHERE tx.evento_id = e.id
                 ORDER BY 1
              ) z1
          )
          WHEN EXISTS (
            SELECT 1
              FROM turmas tx
              JOIN presencas p ON p.turma_id = tx.id
             WHERE tx.evento_id = e.id
               AND p.usuario_id = $1
          ) THEN (
            SELECT json_agg(d ORDER BY d)
              FROM (
                SELECT DISTINCT to_char(p.data_presenca::date, 'YYYY-MM-DD') AS d
                  FROM turmas tx
                  JOIN presencas p ON p.turma_id = tx.id
                 WHERE tx.evento_id = e.id
                   AND p.usuario_id = $1
                 ORDER BY 1
              ) z2
          )
          ELSE '[]'::json
        END AS ocorrencias

      FROM eventos e
      JOIN turmas t                 ON t.evento_id = e.id
      JOIN inscricoes i             ON i.turma_id = t.id AND i.usuario_id = $1
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u          ON u.id = ei.instrutor_id
      ${whereExtra}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio)
    `;

    const resultado = await db.query(sql, params);
    const rows = (resultado.rows || []).map(r => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));
    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinha");
    return res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar minha agenda:", error);
    return res.status(500).json({ erro: "Erro ao carregar sua agenda." });
  }
}

module.exports = {
  buscarAgenda,
  buscarAgendaInstrutor,
  buscarAgendaMinha, // 🆕 export
};
