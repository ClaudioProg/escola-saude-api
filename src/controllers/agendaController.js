const db = require("../db");

/**
 * 📆 Lista eventos da agenda geral (modo administrador com filtros)
 * @route GET /api/agenda?local=&start=&end=
 */
async function buscarAgenda(req, res) {
  const { local, start, end } = req.query;
  const params = [];
  let query = `
    SELECT 
      e.id,
      e.titulo,
      MIN(t.data_inicio) AS data_inicio,
      MAX(t.data_fim) AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim) AS horario_fim,
      e.local, -- ⬅️ Agora usamos diretamente
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome)
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS instrutores
    FROM eventos e
    LEFT JOIN turmas t ON t.evento_id = e.id
    LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
    LEFT JOIN usuarios u ON u.id = ei.instrutor_id
    WHERE 1=1
  `;

  if (local) {
    params.push(`%${local}%`);
    query += ` AND e.local ILIKE $${params.length}`; // ⬅️ Filtro corrigido aqui também
  }

  if (start) {
    params.push(start);
    query += ` AND t.data_inicio >= $${params.length}`;
  }

  if (end) {
    params.push(end);
    query += ` AND t.data_fim <= $${params.length}`;
  }

  query += `
    GROUP BY e.id, e.titulo, e.local
    ORDER BY MIN(t.data_inicio)
  `;

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
  t.nome AS turma,                            -- ⬅️ Alias para nome da turma
  t.data_inicio,
  t.data_fim,
  t.horario_inicio,
  t.horario_fim,
  t.horario_inicio || ' às ' || t.horario_fim AS horario,  -- ⬅️ Cria string pronta para exibir
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

module.exports = {
  buscarAgenda,
  buscarAgendaInstrutor,
};
