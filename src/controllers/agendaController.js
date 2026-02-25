// 📁 src/controllers/agendaController.js — PREMIUM++ (2026)
// - Atualizado COMPLETO (vínculo por TURMA: turma_instrutor)
// - Date-only safe: SEM new Date("YYYY-MM-DD")
// - ✅ Status por data+hora com fuso SP (now() AT TIME ZONE)
// - ✅ Ocorrências por evento: datas_turma > presencas > fallback generate_series (data_inicio..data_fim)
// - ✅ Minha agenda (inscrito): usa inscricoes (compat "inscricao" -> fallback automático)
/* eslint-disable no-console */
"use strict";

const dbFallback = require("../db");

const TZ = "America/Sao_Paulo";

/* =========================
   Helpers (premium)
========================= */
function getDb(req) {
  return req?.db ?? dbFallback;
}
function getUserId(req) {
  return req.user?.id ?? req.user?.usuario_id ?? req.usuario?.id ?? null;
}
function rid(req) {
  return req?.requestId;
}
function asArrayJson(v) {
  return Array.isArray(v) ? v : [];
}

// ✅ datas-only (YYYY-MM-DD), evita bug de fuso
function isDateOnly(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** tenta executar uma lista de SQLs (schemas/tabelas diferentes) */
async function trySqlList(db, sqls, params) {
  let last = null;
  for (const s of sqls) {
    try {
      return await db.query(s, params);
    } catch (e) {
      last = e;
      // tabelas/colunas inexistentes etc
      if (["42P01", "42703", "42883"].includes(e?.code)) continue;
      throw e;
    }
  }
  throw last || new Error("Falha ao executar SQL.");
}

/* =========================
   SQL snippets (premium)
========================= */

/**
 * Status por timestamp (data + hora) em agregação por evento
 * - Usa MIN(inicio_ts) e MAX(fim_ts) do conjunto de turmas do evento
 * - Fuso SP: now() AT TIME ZONE
 */
function sqlStatusFromTurmas(minInicioTsExpr, maxFimTsExpr) {
  return `
    CASE 
      WHEN (now() AT TIME ZONE '${TZ}') < ${minInicioTsExpr} THEN 'programado'
      WHEN (now() AT TIME ZONE '${TZ}') BETWEEN ${minInicioTsExpr} AND ${maxFimTsExpr} THEN 'andamento'
      ELSE 'encerrado'
    END
  `;
}

/**
 * Ocorrências reais do EVENTO (sempre json array)
 * prioridade:
 *  1) datas_turma
 *  2) presencas
 *  3) fallback: generate_series(MIN(data_inicio), MAX(data_fim)) (date-only)
 */
function sqlOcorrenciasPorEvento(eventoIdExpr) {
  return `
    CASE
      WHEN EXISTS (
        SELECT 1
          FROM turmas tx
          JOIN datas_turma dt ON dt.turma_id = tx.id
         WHERE tx.evento_id = ${eventoIdExpr}
      ) THEN (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN datas_turma dt ON dt.turma_id = tx.id
           WHERE tx.evento_id = ${eventoIdExpr}
           ORDER BY 1
        ) z1
      )
      WHEN EXISTS (
        SELECT 1
          FROM turmas tx
          JOIN presencas p ON p.turma_id = tx.id
         WHERE tx.evento_id = ${eventoIdExpr}
      ) THEN (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT DISTINCT to_char(p.data_presenca::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN presencas p ON p.turma_id = tx.id
           WHERE tx.evento_id = ${eventoIdExpr}
           ORDER BY 1
        ) z2
      )
      ELSE (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT to_char(gs::date, 'YYYY-MM-DD') AS d
            FROM (
              SELECT MIN(t0.data_inicio::date) AS di, MAX(t0.data_fim::date) AS df
                FROM turmas t0
               WHERE t0.evento_id = ${eventoIdExpr}
            ) r
            CROSS JOIN LATERAL generate_series(r.di, r.df, interval '1 day') AS gs
           WHERE r.di IS NOT NULL AND r.df IS NOT NULL
           ORDER BY 1
        ) z3
      )
    END
  `;
}

/**
 * Ocorrências reais filtradas pelo usuário (minha agenda)
 * prioridade:
 *  1) datas_turma vinculadas às turmas em que ele está inscrito
 *  2) presenças do usuário
 *  3) fallback: generate_series do período das turmas em que ele está inscrito
 *
 * ⚠️ Atenção: tabela "inscricoes" (plural) é a oficial, mas mantemos fallback para "inscricao" (singular)
 * via trySqlList na query principal (não aqui).
 */
function sqlOcorrenciasPorEventoDoUsuario(eventoIdExpr, inscrTable /* 'inscricoes'|'inscricao' */) {
  return `
    CASE
      WHEN EXISTS (
        SELECT 1
          FROM turmas tx
          JOIN ${inscrTable} i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
          JOIN datas_turma dt ON dt.turma_id = tx.id
         WHERE tx.evento_id = ${eventoIdExpr}
      ) THEN (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN ${inscrTable} i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
            JOIN datas_turma dt ON dt.turma_id = tx.id
           WHERE tx.evento_id = ${eventoIdExpr}
           ORDER BY 1
        ) z1
      )
      WHEN EXISTS (
        SELECT 1
          FROM turmas tx
          JOIN presencas p ON p.turma_id = tx.id
         WHERE tx.evento_id = ${eventoIdExpr}
           AND p.usuario_id = $1
      ) THEN (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT DISTINCT to_char(p.data_presenca::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN presencas p ON p.turma_id = tx.id
           WHERE tx.evento_id = ${eventoIdExpr}
             AND p.usuario_id = $1
           ORDER BY 1
        ) z2
      )
      ELSE (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT to_char(gs::date, 'YYYY-MM-DD') AS d
            FROM (
              SELECT MIN(tx.data_inicio::date) AS di, MAX(tx.data_fim::date) AS df
                FROM turmas tx
                JOIN ${inscrTable} i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
               WHERE tx.evento_id = ${eventoIdExpr}
            ) r
            CROSS JOIN LATERAL generate_series(r.di, r.df, interval '1 day') AS gs
           WHERE r.di IS NOT NULL AND r.df IS NOT NULL
           ORDER BY 1
        ) z3
      )
    END
  `;
}

/**
 * Instrutores do evento (json array)
 * prioridade:
 *  1) turma_instrutor (vínculo por turma) dentro do evento
 */
function sqlInstrutoresPorEvento(eventoIdExpr) {
  return `
    COALESCE((
      SELECT json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
      FROM (
        SELECT ti.instrutor_id AS id_ref
          FROM turma_instrutor ti
          JOIN turmas t2 ON t2.id = ti.turma_id
         WHERE t2.evento_id = ${eventoIdExpr}
        UNION
        SELECT ei2.instrutor_id AS id_ref
          FROM evento_instrutor ei2
         WHERE ei2.evento_id = ${eventoIdExpr}
      ) x
      JOIN usuarios u ON u.id = x.id_ref
    ), '[]'::json)
  `;
}

/* =========================
   1) Agenda geral (admin)
   GET /api/agenda?local=&start=&end=
========================= */
async function buscarAgenda(req, res) {
  const db = getDb(req);
  const { local, start, end } = req.query;

  const params = [];
  let where = "WHERE 1=1";

  if (local) {
    params.push(`%${local}%`);
    where += ` AND e.local ILIKE $${params.length}`;
  }

  // filtro por intervalo (usa turmas do evento)
  if (start) {
    params.push(start);
    where += ` AND EXISTS (
      SELECT 1 FROM turmas tf
      WHERE tf.evento_id = e.id AND tf.data_inicio >= $${params.length}::date
    )`;
  }
  if (end) {
    params.push(end);
    where += ` AND EXISTS (
      SELECT 1 FROM turmas tf
      WHERE tf.evento_id = e.id AND tf.data_fim <= $${params.length}::date
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

      ${sqlStatusFromTurmas(
        "MIN(t.data_inicio::timestamp + COALESCE(t.horario_inicio,'00:00'::time))",
        "MAX(t.data_fim::timestamp + COALESCE(t.horario_fim,'23:59'::time))"
      )} AS status,

      ${sqlInstrutoresPorEvento("e.id")} AS instrutores,

      ${sqlOcorrenciasPorEvento("e.id")} AS ocorrencias

    FROM eventos e
    LEFT JOIN turmas t ON t.evento_id = e.id
    ${where}
    GROUP BY e.id, e.titulo, e.local
    ORDER BY MIN(t.data_inicio)
  `;

  try {
    const resultado = await db.query(sql, params);
    res.set("X-Agenda-Handler", "agendaController:buscarAgenda@premium++");

    const rows = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    return res.status(200).json(rows);
  } catch (error) {
    console.error("[agenda] Erro ao buscar agenda:", { rid: rid(req), code: error?.code, msg: error?.message });
    return res.status(500).json({ erro: "Erro ao carregar dados da agenda." });
  }
}

/* =========================
   2) Agenda por EVENTO do instrutor (compat)
   GET /api/agenda/instrutor?start=&end=
   - Agora considera turma_instrutor (principal) 
========================= */
async function buscarAgendaInstrutor(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let whereExtra = "";

    if (start) {
      params.push(start);
      whereExtra += ` AND t.data_inicio >= $${params.length}::date`;
    }
    if (end) {
      params.push(end);
      whereExtra += ` AND t.data_fim <= $${params.length}::date`;
    }

    // estratégia:
    // - base por turma_instrutor (vínculo por turma)
    const sql = `
      WITH base_ti AS (
        SELECT
          e.id AS evento_id,
          e.titulo,
          e.local,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim
        FROM turma_instrutor ti
        JOIN turmas t  ON t.id = ti.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE ti.instrutor_id = $1
          ${whereExtra}
      ),
      base_ei AS (
        SELECT
          e.id AS evento_id,
          e.titulo,
          e.local,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim
        FROM evento_instrutor ei
        JOIN eventos e ON e.id = ei.evento_id
        JOIN turmas  t ON t.evento_id = e.id
        WHERE ei.instrutor_id = $1
          ${whereExtra}
      ),
      todas AS (
        SELECT * FROM base_ti
        UNION ALL
        SELECT * FROM base_ei
      )
      SELECT 
        tt.evento_id AS id,
        tt.titulo,
        tt.local,

        MIN(tt.data_inicio)    AS data_inicio,
        MAX(tt.data_fim)       AS data_fim,
        MIN(tt.horario_inicio) AS horario_inicio,
        MAX(tt.horario_fim)    AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(tt.data_inicio::timestamp + COALESCE(tt.horario_inicio,'00:00'::time))",
          "MAX(tt.data_fim::timestamp + COALESCE(tt.horario_fim,'23:59'::time))"
        )} AS status,

        ${sqlInstrutoresPorEvento("tt.evento_id")} AS instrutores,

        ${sqlOcorrenciasPorEvento("tt.evento_id")} AS ocorrencias

      FROM todas tt
      GROUP BY tt.evento_id, tt.titulo, tt.local
      ORDER BY MIN(tt.data_inicio) DESC
    `;

    const resultado = await db.query(sql, params);
    res.set("X-Agenda-Handler", "agendaController:buscarAgendaInstrutor@premium++");

    const eventos = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    return res.status(200).json(eventos);
  } catch (error) {
    console.error("[agenda] Erro ao buscar agenda do instrutor:", { rid: rid(req), code: error?.code, msg: error?.message });
    return res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

/* =========================
   3) Minha agenda (inscrito)
   GET /api/agenda/minha?start=&end=
   - Usa inscricoes (plural) com fallback "inscricao" (singular)
========================= */
async function buscarAgendaMinha(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let whereExtra = "";

    if (start) {
      params.push(start);
      whereExtra += ` AND t.data_inicio >= $${params.length}::date`;
    }
    if (end) {
      params.push(end);
      whereExtra += ` AND t.data_fim <= $${params.length}::date`;
    }

    const makeSql = (inscrTable) => `
      SELECT 
        e.id,
        e.titulo,
        e.local,

        MIN(t.data_inicio)    AS data_inicio,
        MAX(t.data_fim)       AS data_fim,
        MIN(t.horario_inicio) AS horario_inicio,
        MAX(t.horario_fim)    AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(t.data_inicio::timestamp + COALESCE(t.horario_inicio,'00:00'::time))",
          "MAX(t.data_fim::timestamp + COALESCE(t.horario_fim,'23:59'::time))"
        )} AS status,

        ${sqlInstrutoresPorEvento("e.id")} AS instrutores,

        ${sqlOcorrenciasPorEventoDoUsuario("e.id", inscrTable)} AS ocorrencias

      FROM eventos e
      JOIN turmas t                  ON t.evento_id = e.id
      JOIN ${inscrTable} i           ON i.turma_id = t.id AND i.usuario_id = $1
      WHERE 1=1
      ${whereExtra}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio)
    `;

    const sqls = [
      makeSql("inscricoes"),
      makeSql("inscricao"),
    ];

    const resultado = await trySqlList(db, sqls, params);
    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinha@premium++");

    const rows = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    return res.status(200).json(rows);
  } catch (error) {
    console.error("[agenda] Erro ao buscar minha agenda:", { rid: rid(req), code: error?.code, msg: error?.message });
    return res.status(500).json({ erro: "Erro ao carregar sua agenda." });
  }
}

/* =========================
   4) Minha agenda como INSTRUTOR (novo)
   GET /api/agenda/minha-instrutor?start=&end=
   - turma_instrutor first-class
========================= */
async function buscarAgendaMinhaInstrutor(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { start, end } = req.query;
    const params = [Number(usuarioId)];
    let filtroPeriodo = "";

    if (start) {
      params.push(start);
      filtroPeriodo += ` AND t.data_inicio >= $${params.length}::date`;
    }
    if (end) {
      params.push(end);
      filtroPeriodo += ` AND t.data_fim <= $${params.length}::date`;
    }

    const sql = `
      WITH turmas_por_ti AS (
        SELECT 
          e.id            AS evento_id,
          e.titulo        AS evento_titulo,
          e.local         AS evento_local,
          t.id            AS turma_id,
          t.nome          AS turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          t.carga_horaria
        FROM turma_instrutor ti
        JOIN turmas t  ON t.id = ti.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE ti.instrutor_id = $1
          ${filtroPeriodo}
      ),
      turmas_por_ei AS (
        SELECT 
          e.id            AS evento_id,
          e.titulo        AS evento_titulo,
          e.local         AS evento_local,
          t.id            AS turma_id,
          t.nome          AS turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          t.carga_horaria
        FROM evento_instrutor ei
        JOIN eventos e ON e.id = ei.evento_id
        JOIN turmas  t ON t.evento_id = e.id
        WHERE ei.instrutor_id = $1
          ${filtroPeriodo}
      ),
      todas_turmas AS (
        SELECT * FROM turmas_por_ti
        UNION ALL
        SELECT * FROM turmas_por_ei
      )
      SELECT 
        tt.evento_id                           AS id,
        tt.evento_titulo                       AS titulo,
        tt.evento_local                        AS local,
        MIN(tt.data_inicio)                    AS data_inicio,
        MAX(tt.data_fim)                       AS data_fim,
        MIN(tt.horario_inicio)                 AS horario_inicio,
        MAX(tt.horario_fim)                    AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(tt.data_inicio::timestamp + COALESCE(tt.horario_inicio,'00:00'::time))",
          "MAX(tt.data_fim::timestamp + COALESCE(tt.horario_fim,'23:59'::time))"
        )} AS status,

        ${sqlInstrutoresPorEvento("tt.evento_id")} AS instrutores,

        ${sqlOcorrenciasPorEvento("tt.evento_id")} AS ocorrencias

      FROM todas_turmas tt
      GROUP BY tt.evento_id, tt.evento_titulo, tt.evento_local
      ORDER BY MIN(tt.data_inicio) DESC
    `;

    const { rows } = await db.query(sql, params);
    const eventos = (rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinhaInstrutor@premium++");
    return res.status(200).json(eventos);
  } catch (error) {
    console.error("[agenda] Erro ao buscar agenda do instrutor:", { rid: rid(req), code: error?.code, msg: error?.message });
    return res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

/* =======================================================================
   ✅ 5) Calendário de Bloqueios/Feriados (Admin)
   - resolve 404 do POST /api/calendario
   Payload do front:
     { data:'YYYY-MM-DD', tipo:'feriado_municipal', descricao:'...' }
======================================================================== */

/** GET /api/calendario */
async function listarBloqueios(req, res) {
  const db = getDb(req);
  try {
    const sqls = [
      `SELECT id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao
         FROM calendario_bloqueios
        ORDER BY data ASC, id ASC`,
      `SELECT id, data::text AS data, tipo, descricao
         FROM calendario_bloqueios
        ORDER BY data ASC, id ASC`,
      `SELECT id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao
         FROM calendario
        ORDER BY data ASC, id ASC`,
    ];

    const r = await trySqlList(db, sqls, []);
    return res.status(200).json(r.rows || []);
  } catch (e) {
    console.error("[calendario] listarBloqueios erro:", { rid: rid(req), code: e?.code, msg: e?.message });
    return res.status(500).json({ erro: "Erro ao listar calendário." });
  }
}

/** POST /api/calendario */
async function criarBloqueio(req, res) {
  const db = getDb(req);

  try {
    const { data, tipo, descricao } = req.body || {};

    if (!isDateOnly(data)) return res.status(400).json({ erro: "Campo 'data' deve ser YYYY-MM-DD." });
    if (!tipo || typeof tipo !== "string") return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });

    const desc = typeof descricao === "string" ? descricao.trim() : "";

    const sqls = [
      `INSERT INTO calendario_bloqueios (data, tipo, descricao, criado_em)
       VALUES ($1::date, $2, $3, NOW())
       RETURNING id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao`,
      `INSERT INTO calendario_bloqueios (data, tipo, descricao)
       VALUES ($1::date, $2, $3)
       RETURNING id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao`,
      `INSERT INTO calendario (data, tipo, descricao, criado_em)
       VALUES ($1::date, $2, $3, NOW())
       RETURNING id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao`,
    ];

    const r = await trySqlList(db, sqls, [data, tipo.trim(), desc || null]);
    return res.status(201).json({ ok: true, item: r.rows?.[0] || null });
  } catch (e) {
    // idempotência simples se você tiver unique(data,tipo) no banco
    if (e?.code === "23505") return res.status(409).json({ erro: "Já existe um bloqueio/feriado nesta data." });

    console.error("[calendario] criarBloqueio erro:", { rid: rid(req), code: e?.code, msg: e?.message });
    return res.status(500).json({ erro: "Erro ao salvar no calendário." });
  }
}

/** DELETE /api/calendario/:id */
async function removerBloqueio(req, res) {
  const db = getDb(req);

  try {
    const id = toIntId(req.params?.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const sqls = [
      `DELETE FROM calendario_bloqueios WHERE id = $1`,
      `DELETE FROM calendario WHERE id = $1`,
    ];

    const r = await trySqlList(db, sqls, [id]);
    const count = Number(r.rowCount || 0);
    if (!count) return res.status(404).json({ erro: "Item não encontrado." });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[calendario] removerBloqueio erro:", { rid: rid(req), code: e?.code, msg: e?.message });
    return res.status(500).json({ erro: "Erro ao remover do calendário." });
  }
}

module.exports = {
  // Agenda
  buscarAgenda,
  buscarAgendaInstrutor,
  buscarAgendaMinha,
  buscarAgendaMinhaInstrutor,

  // Calendário (bloqueios/feriados)
  listarBloqueios,
  criarBloqueio,
  removerBloqueio,
};