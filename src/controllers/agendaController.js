/* eslint-disable no-console */
// ✅ src/controllers/agendaController.js — PREMIUM+++
// - Compat DB robusta
// - Date-only safe
// - Status por data+hora com fuso SP
// - Ocorrências por evento: datas_turma > presencas > fallback controlado
// - Minha agenda com fallback inscricoes/inscricao
// - Logs com RID
// - Compat com calendário/calendario_bloqueios
"use strict";

const dbFallback = require("../db");

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================
   Logger premium
========================= */
function mkRid(prefix = "AGD") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function rid(req, prefix = "AGD") {
  return req?.requestId || req?.rid || mkRid(prefix);
}
function logInfo(req, msg, extra) {
  if (IS_DEV) console.log(`[agenda][${rid(req)}] ${msg}`, extra || "");
}
function logWarn(req, msg, extra) {
  console.warn(`[agenda][${rid(req)}][WARN] ${msg}`, extra || "");
}
function logErr(req, msg, err) {
  console.error(
    `[agenda][${rid(req)}][ERR] ${msg}`,
    err?.stack || err?.message || err
  );
}

/* =========================
   Helpers (premium)
========================= */
function getDb(req) {
  return req?.db ?? dbFallback;
}

function getUserId(req) {
  return (
    req?.user?.id ??
    req?.user?.usuario_id ??
    req?.usuario?.id ??
    req?.usuario?.usuario_id ??
    null
  );
}

function asArrayJson(v) {
  return Array.isArray(v) ? v : [];
}

function isDateOnly(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

async function trySqlList(db, sqls, params) {
  let last = null;

  for (const s of sqls) {
    try {
      return await db.query(s, params);
    } catch (e) {
      last = e;
      if (["42P01", "42703", "42883"].includes(e?.code)) continue;
      throw e;
    }
  }

  throw last || new Error("Falha ao executar SQL.");
}

/* =========================
   Compat de tabelas
========================= */
let _inscrTableCache = null;
let _calendarTableCache = null;

async function resolveInscricaoTable(db) {
  if (_inscrTableCache) return _inscrTableCache;

  try {
    await db.query(`SELECT 1 FROM inscricoes LIMIT 1`);
    _inscrTableCache = "inscricoes";
    return _inscrTableCache;
  } catch (_) {}

  await db.query(`SELECT 1 FROM inscricao LIMIT 1`);
  _inscrTableCache = "inscricao";
  return _inscrTableCache;
}

async function resolveCalendarTable(db) {
  if (_calendarTableCache) return _calendarTableCache;

  try {
    await db.query(`SELECT 1 FROM calendario_bloqueios LIMIT 1`);
    _calendarTableCache = "calendario_bloqueios";
    return _calendarTableCache;
  } catch (_) {}

  await db.query(`SELECT 1 FROM calendario LIMIT 1`);
  _calendarTableCache = "calendario";
  return _calendarTableCache;
}

/* =========================
   SQL snippets (premium)
========================= */
function sqlStatusFromTurmas(minInicioTsExpr, maxFimTsExpr) {
  return `
    CASE
      WHEN (NOW() AT TIME ZONE '${TZ}') < ${minInicioTsExpr} THEN 'programado'
      WHEN (NOW() AT TIME ZONE '${TZ}') BETWEEN ${minInicioTsExpr} AND ${maxFimTsExpr} THEN 'andamento'
      ELSE 'encerrado'
    END
  `;
}

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
           WHERE r.di IS NOT NULL
             AND r.df IS NOT NULL
           ORDER BY 1
        ) z3
      )
    END
  `;
}

function sqlOcorrenciasPorEventoDoUsuario(eventoIdExpr, inscrTable) {
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
           WHERE r.di IS NOT NULL
             AND r.df IS NOT NULL
           ORDER BY 1
        ) z3
      )
    END
  `;
}

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
  const { local, start, end } = req.query || {};

  try {
    const params = [];
    let where = "WHERE 1=1";

    if (local) {
      params.push(`%${String(local).trim()}%`);
      where += ` AND e.local ILIKE $${params.length}`;
    }

    if (start) {
      if (!isDateOnly(start)) {
        return res.status(400).json({ erro: "Parâmetro 'start' deve ser YYYY-MM-DD." });
      }
      params.push(start);
      where += ` AND EXISTS (
        SELECT 1
          FROM turmas tf
         WHERE tf.evento_id = e.id
           AND tf.data_inicio >= $${params.length}::date
      )`;
    }

    if (end) {
      if (!isDateOnly(end)) {
        return res.status(400).json({ erro: "Parâmetro 'end' deve ser YYYY-MM-DD." });
      }
      params.push(end);
      where += ` AND EXISTS (
        SELECT 1
          FROM turmas tf
         WHERE tf.evento_id = e.id
           AND tf.data_fim <= $${params.length}::date
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
      ORDER BY MIN(t.data_inicio), e.id
    `;

    const resultado = await db.query(sql, params);

    const rows = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    logInfo(req, "buscarAgenda OK", {
      total: rows.length,
      filtros: { local: local || null, start: start || null, end: end || null },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgenda@premium+++");
    return res.status(200).json(rows);
  } catch (error) {
    logErr(req, "Erro ao buscar agenda", error);
    return res.status(500).json({ erro: "Erro ao carregar dados da agenda." });
  }
}

/* =========================
   2) Agenda por EVENTO do instrutor (compat)
   GET /api/agenda/instrutor?start=&end=
========================= */
async function buscarAgendaInstrutor(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { start, end } = req.query || {};
    const params = [Number(usuarioId)];
    let whereExtra = "";

    if (start) {
      if (!isDateOnly(start)) {
        return res.status(400).json({ erro: "Parâmetro 'start' deve ser YYYY-MM-DD." });
      }
      params.push(start);
      whereExtra += ` AND t.data_inicio >= $${params.length}::date`;
    }

    if (end) {
      if (!isDateOnly(end)) {
        return res.status(400).json({ erro: "Parâmetro 'end' deve ser YYYY-MM-DD." });
      }
      params.push(end);
      whereExtra += ` AND t.data_fim <= $${params.length}::date`;
    }

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
      ORDER BY MIN(tt.data_inicio) DESC, tt.evento_id DESC
    `;

    const resultado = await db.query(sql, params);

    const eventos = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    logInfo(req, "buscarAgendaInstrutor OK", {
      usuarioId,
      total: eventos.length,
      filtros: { start: start || null, end: end || null },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaInstrutor@premium+++");
    return res.status(200).json(eventos);
  } catch (error) {
    logErr(req, "Erro ao buscar agenda do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

/* =========================
   3) Minha agenda (inscrito)
   GET /api/agenda/minha?start=&end=
========================= */
async function buscarAgendaMinha(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const inscrTable = await resolveInscricaoTable(db);
    const { start, end } = req.query || {};
    const params = [Number(usuarioId)];
    let whereExtra = "";

    if (start) {
      if (!isDateOnly(start)) {
        return res.status(400).json({ erro: "Parâmetro 'start' deve ser YYYY-MM-DD." });
      }
      params.push(start);
      whereExtra += ` AND t.data_inicio >= $${params.length}::date`;
    }

    if (end) {
      if (!isDateOnly(end)) {
        return res.status(400).json({ erro: "Parâmetro 'end' deve ser YYYY-MM-DD." });
      }
      params.push(end);
      whereExtra += ` AND t.data_fim <= $${params.length}::date`;
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

        ${sqlOcorrenciasPorEventoDoUsuario("e.id", inscrTable)} AS ocorrencias

      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      JOIN ${inscrTable} i ON i.turma_id = t.id AND i.usuario_id = $1
      WHERE 1=1
      ${whereExtra}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio), e.id
    `;

    const resultado = await db.query(sql, params);

    const rows = (resultado.rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    logInfo(req, "buscarAgendaMinha OK", {
      usuarioId,
      total: rows.length,
      inscrTable,
      filtros: { start: start || null, end: end || null },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinha@premium+++");
    return res.status(200).json(rows);
  } catch (error) {
    logErr(req, "Erro ao buscar minha agenda", error);
    return res.status(500).json({ erro: "Erro ao carregar sua agenda." });
  }
}

/* =========================
   4) Minha agenda como INSTRUTOR
   GET /api/agenda/minha-instrutor?start=&end=
========================= */
async function buscarAgendaMinhaInstrutor(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { start, end } = req.query || {};
    const params = [Number(usuarioId)];
    let filtroPeriodo = "";

    if (start) {
      if (!isDateOnly(start)) {
        return res.status(400).json({ erro: "Parâmetro 'start' deve ser YYYY-MM-DD." });
      }
      params.push(start);
      filtroPeriodo += ` AND t.data_inicio >= $${params.length}::date`;
    }

    if (end) {
      if (!isDateOnly(end)) {
        return res.status(400).json({ erro: "Parâmetro 'end' deve ser YYYY-MM-DD." });
      }
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
        tt.evento_id           AS id,
        tt.evento_titulo       AS titulo,
        tt.evento_local        AS local,
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

      FROM todas_turmas tt
      GROUP BY tt.evento_id, tt.evento_titulo, tt.evento_local
      ORDER BY MIN(tt.data_inicio) DESC, tt.evento_id DESC
    `;

    const { rows } = await db.query(sql, params);

    const eventos = (rows || []).map((r) => ({
      ...r,
      ocorrencias: asArrayJson(r.ocorrencias),
      instrutores: asArrayJson(r.instrutores),
    }));

    logInfo(req, "buscarAgendaMinhaInstrutor OK", {
      usuarioId,
      total: eventos.length,
      filtros: { start: start || null, end: end || null },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinhaInstrutor@premium+++");
    return res.status(200).json(eventos);
  } catch (error) {
    logErr(req, "Erro ao buscar agenda do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar agenda do instrutor." });
  }
}

/* =======================================================================
   5) Calendário de Bloqueios/Feriados (Admin)
======================================================================== */

/** GET /api/calendario */
async function listarBloqueios(req, res) {
  const db = getDb(req);

  try {
    const table = await resolveCalendarTable(db);

    const sql = `
      SELECT
        id,
        to_char(data::date,'YYYY-MM-DD') AS data,
        tipo,
        descricao
      FROM ${table}
      ORDER BY data ASC, id ASC
    `;

    const r = await db.query(sql);

    logInfo(req, "listarBloqueios OK", {
      total: r.rows?.length || 0,
      table,
    });

    return res.status(200).json(r.rows || []);
  } catch (e) {
    logErr(req, "listarBloqueios erro", e);
    return res.status(500).json({ erro: "Erro ao listar calendário." });
  }
}

/** POST /api/calendario */
async function criarBloqueio(req, res) {
  const db = getDb(req);

  try {
    const { data, tipo, descricao } = req.body || {};

    if (!isDateOnly(data)) {
      return res.status(400).json({ erro: "Campo 'data' deve ser YYYY-MM-DD." });
    }

    if (!tipo || typeof tipo !== "string" || !String(tipo).trim()) {
      return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
    }

    const table = await resolveCalendarTable(db);
    const desc = typeof descricao === "string" ? descricao.trim() : "";

    const sql = `
      INSERT INTO ${table} (data, tipo, descricao, criado_em)
      VALUES ($1::date, $2, $3, NOW())
      RETURNING id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao
    `;

    let r;
    try {
      r = await db.query(sql, [data, String(tipo).trim(), desc || null]);
    } catch (e) {
      if (e?.code === "42703") {
        r = await db.query(
          `
          INSERT INTO ${table} (data, tipo, descricao)
          VALUES ($1::date, $2, $3)
          RETURNING id, to_char(data::date,'YYYY-MM-DD') AS data, tipo, descricao
          `,
          [data, String(tipo).trim(), desc || null]
        );
      } else {
        throw e;
      }
    }

    logInfo(req, "criarBloqueio OK", {
      table,
      item: r.rows?.[0] || null,
    });

    return res.status(201).json({ ok: true, item: r.rows?.[0] || null });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({ erro: "Já existe um bloqueio/feriado nesta data." });
    }

    logErr(req, "criarBloqueio erro", e);
    return res.status(500).json({ erro: "Erro ao salvar no calendário." });
  }
}

/** DELETE /api/calendario/:id */
async function removerBloqueio(req, res) {
  const db = getDb(req);

  try {
    const id = toIntId(req.params?.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const table = await resolveCalendarTable(db);
    const r = await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

    const count = Number(r.rowCount || 0);
    if (!count) return res.status(404).json({ erro: "Item não encontrado." });

    logInfo(req, "removerBloqueio OK", { table, id });
    return res.status(200).json({ ok: true });
  } catch (e) {
    logErr(req, "removerBloqueio erro", e);
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