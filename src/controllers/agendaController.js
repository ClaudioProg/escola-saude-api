const db = require("../db");

/**
 * 📆 Lista eventos da agenda geral (modo administradoristrador com filtros)
 * @route GET /api/agenda?local=&start=&end=
 */
async function buscarAgenda(req, res) {
  const { local, start, end } = req.query;
  const params = [];
  let query = `
    SELECT 
      e.id,
      e.titulo,
      t.data_inicio,
      t.data_fim,
      l.nome AS local
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    LEFT JOIN locais l ON e.local_id = l.id
    WHERE 1=1
  `;

  if (local) {
    params.push(`%${local}%`);
    query += ` AND l.nome ILIKE $${params.length}`;
  }

  if (start) {
    params.push(start);
    query += ` AND t.data_inicio >= $${params.length}`;
  }

  if (end) {
    params.push(end);
    query += ` AND t.data_fim <= $${params.length}`;
  }

  try {
    const resultado = await db.query(query, params);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar agenda:", error.message);
    res.status(500).json({ erro: "Erro ao carregar dados da agenda." });
  }
}

/**
 * 📅 Lista a agenda de turmas do instrutor autenticado
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
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.vagas_total,
        e.id AS evento_id,
        e.titulo AS evento_titulo
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio ASC
    `;

    const resultado = await db.query(query, [usuarioId]);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar agenda do instrutor:", error.message);
    res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

module.exports = {
  buscarAgenda,
  buscarAgendaInstrutor,
};
