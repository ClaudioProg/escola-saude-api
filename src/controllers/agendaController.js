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
    where += ` AND EXISTS (
      SELECT 1 FROM turmas tf
      WHERE tf.evento_id = e.id AND tf.data_inicio >= $${params.length}
    )`;
  }
  if (end) {
    params.push(end);
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
        json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
          FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS instrutores,
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
    LEFT JOIN turmas t             ON t.evento_id = e.id
    LEFT JOIN evento_instrutor ei  ON ei.evento_id = e.id
    LEFT JOIN usuarios u           ON u.id = ei.instrutor_id
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
 * 📅 Lista a agenda (por EVENTO) somente dos eventos nos quais o usuário é INSTRUTOR
 * Retorna OCORRENCIAS com datas reais (datas_turma; fallback: presencas)
 * Filtros opcionais: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 * @route GET /api/agenda/instrutor
 */
async function buscarAgendaInstrutor(req, res) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let whereExtra = "";

    // Filtramos pelas turmas do evento (para performance/escopo do período)
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
          json_agg(DISTINCT jsonb_build_object('id', u2.id, 'nome', u2.nome))
            FILTER (WHERE u2.id IS NOT NULL),
          '[]'
        ) AS instrutores,

        -- 🔹 OCORRENCIAS (somente datas REAIS das turmas deste evento)
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
      -- garante que o usuário é instrutor deste EVENTO
      JOIN evento_instrutor ei ON ei.evento_id = e.id AND ei.instrutor_id = $1
      JOIN turmas t            ON t.evento_id = e.id
      LEFT JOIN evento_instrutor ei2 ON ei2.evento_id = e.id
      LEFT JOIN usuarios u2          ON u2.id = ei2.instrutor_id
      ${whereExtra}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio) DESC
    `;

    const resultado = await db.query(sql, params);
    const eventos = (resultado.rows || []).map(r => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaInstrutor@datasReais");
    return res.status(200).json(eventos);
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
    const usuarioId = req.user?.id;
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
          json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
            FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutores,
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

/**
 * 👩‍🏫 Agenda do INSTRUTOR autenticado — eventos/turmas em que ministra
 * Novo vínculo por turma (turma_instrutor) + fallback legado (evento_instrutor)
 * Filtros opcionais: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 * @route GET /api/agenda/minha-instrutor
 */
async function buscarAgendaMinhaInstrutor(req, res) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let filtroPeriodo = "";

    if (start) {
      params.push(start);
      filtroPeriodo += ` AND t.data_inicio >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      filtroPeriodo += ` AND t.data_fim <= $${params.length}`;
    }

    const sql = `
      with turmas_por_ti as (
        select 
          e.id            as evento_id,
          e.titulo        as evento_titulo,
          e.local         as evento_local,
          t.id            as turma_id,
          t.nome          as turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          t.carga_horaria
        from turmas t
        join eventos e on e.id = t.evento_id
        join turma_instrutor ti on ti.turma_id = t.id
        where ti.instrutor_id = $1
          ${filtroPeriodo}
      ),
      turmas_por_ei as (
        select 
          e.id            as evento_id,
          e.titulo        as evento_titulo,
          e.local         as evento_local,
          t.id            as turma_id,
          t.nome          as turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          t.carga_horaria
        from eventos e
        join evento_instrutor ei on ei.evento_id = e.id and ei.instrutor_id = $1
        join turmas t on t.evento_id = e.id
        where 1=1
          ${filtroPeriodo}
      ),
      todas_turmas as (
        select * from turmas_por_ti
        union all
        select * from turmas_por_ei
      )
      select 
        tt.evento_id                           as id,
        tt.evento_titulo                       as titulo,
        tt.evento_local                        as local,
        min(tt.data_inicio)                    as data_inicio,
        max(tt.data_fim)                       as data_fim,
        min(tt.horario_inicio)                 as horario_inicio,
        max(tt.horario_fim)                    as horario_fim,
        case 
          when CURRENT_TIMESTAMP < min(tt.data_inicio + tt.horario_inicio) then 'programado'
          when CURRENT_TIMESTAMP between min(tt.data_inicio + tt.horario_inicio)
                                    and     max(tt.data_fim + tt.horario_fim) then 'andamento'
          else 'encerrado'
        end as status,
        /* Instrutores do evento: une evento_instrutor + turma_instrutor */
        coalesce((
          select json_agg(distinct jsonb_build_object('id', u.id, 'nome', u.nome))
          from (
            select ei2.instrutor_id as id_ref, 'ei' as origem
              from evento_instrutor ei2
             where ei2.evento_id = tt.evento_id
            union
            select ti2.instrutor_id as id_ref, 'ti' as origem
              from turma_instrutor ti2
              join turmas t2 on t2.id = ti2.turma_id and t2.evento_id = tt.evento_id
          ) x
          join usuarios u on u.id = x.id_ref
        ), '[]') as instrutores,
        /* Ocorrências: datas reais (datas_turma se houver; senão, presenças) */
        case
          when exists (
            select 1
              from turmas tx
              join datas_turma dt on dt.turma_id = tx.id
             where tx.evento_id = tt.evento_id
          ) then (
            select json_agg(d order by d)
              from (
                select distinct to_char(dt.data::date, 'YYYY-MM-DD') as d
                  from turmas tx
                  join datas_turma dt on dt.turma_id = tx.id
                 where tx.evento_id = tt.evento_id
                 order by 1
              ) z1
          )
          when exists (
            select 1
              from turmas tx
              join presencas p on p.turma_id = tx.id
             where tx.evento_id = tt.evento_id
          ) then (
            select json_agg(d order by d)
              from (
                select distinct to_char(p.data_presenca::date, 'YYYY-MM-DD') as d
                  from turmas tx
                  join presencas p on p.turma_id = tx.id
                 where tx.evento_id = tt.evento_id
                 order by 1
              ) z2
          )
          else '[]'::json
        end as ocorrencias
      from todas_turmas tt
      group by tt.evento_id, tt.evento_titulo, tt.evento_local
      order by min(tt.data_inicio) desc
    `;

    const { rows } = await db.query(sql, params);
    const eventos = (rows || []).map(r => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinhaInstrutor");
    return res.status(200).json(eventos);
  } catch (error) {
    console.error("❌ Erro ao buscar agenda do instrutor:", error.message);
    return res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

module.exports = {
  buscarAgenda,
  buscarAgendaInstrutor,
  buscarAgendaMinha,
  buscarAgendaMinhaInstrutor,
};
