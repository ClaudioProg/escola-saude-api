/* eslint-disable no-console */
"use strict";

/**
 * ✅ src/controllers/agendaController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Controller oficial da agenda de eventos.
 * - Agenda administrativa geral.
 * - Agenda do organizador.
 * - Minha agenda como participante.
 * - Minha agenda como organizador.
 * - Calendário administrativo de bloqueios/feriados.
 *
 * Contratos oficiais de banco:
 * - eventos
 * - turmas
 * - datas_turma
 * - presencas
 * - usuarios
 * - inscricoes
 * - turma_responsavel
 * - calendario_bloqueios
 *
 * Contrato oficial de autenticação:
 * - req.user.id
 *
 * Diretrizes v2.1:
 * - Sem aliases.
 * - Sem fallback legado.
 * - Sem compatibilidade com tabelas antigas.
 * - Sem req.usuario.
 * - Sem resposta { erro }.
 * - Date-only seguro.
 * - Respostas padronizadas.
 * - Logs com requestId controlado.
 * - Organizador oficial vem de turma_responsavel.papel = 'organizador'.
 */

const dbFallback = require("../db");

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

const PAPEL_ORGANIZADOR = "organizador";

/* ─────────────────────────────────────────────
 * Helpers de resposta
 * ───────────────────────────────────────────── */

function responderSucesso(res, statusCode, data, message, code, extra = {}) {
  return res.status(statusCode).json({
    ok: true,
    data,
    message,
    code,
    ...extra,
  });
}

function responderErro(res, statusCode, message, code, adminHint, details = null) {
  return res.status(statusCode).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
  });
}

/* ─────────────────────────────────────────────
 * Logger
 * ───────────────────────────────────────────── */

function mkRid(prefix = "AGD") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function rid(req, prefix = "AGD") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function logInfo(req, msg, extra) {
  if (IS_DEV) {
    console.log(`[agenda][${rid(req)}] ${msg}`, extra || "");
  }
}

function logErr(req, msg, error) {
  console.error(
    `[agenda][${rid(req)}][ERR] ${msg}`,
    error?.stack || error?.message || error
  );
}

/* ─────────────────────────────────────────────
 * Helpers gerais
 * ───────────────────────────────────────────── */

function getDb(req) {
  return req?.db || dbFallback;
}

function getUsuarioId(req) {
  const usuarioId = Number(req?.user?.id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return null;
  }

  return usuarioId;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIntId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function asArrayJson(value) {
  return Array.isArray(value) ? value : [];
}

function normalizarTexto(value, max = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function validarPeriodoQuery(req, res) {
  const { start, end } = req.query || {};

  if (start && !isDateOnly(start)) {
    responderErro(
      res,
      400,
      "O parâmetro 'start' deve estar no formato YYYY-MM-DD.",
      "AGENDA_START_INVALIDO",
      "A consulta de agenda recebeu start fora do contrato date-only."
    );
    return null;
  }

  if (end && !isDateOnly(end)) {
    responderErro(
      res,
      400,
      "O parâmetro 'end' deve estar no formato YYYY-MM-DD.",
      "AGENDA_END_INVALIDO",
      "A consulta de agenda recebeu end fora do contrato date-only."
    );
    return null;
  }

  if (start && end && start > end) {
    responderErro(
      res,
      400,
      "O período informado é inválido: a data inicial não pode ser maior que a data final.",
      "AGENDA_PERIODO_INVALIDO",
      "A consulta recebeu start maior que end."
    );
    return null;
  }

  return {
    start: start || null,
    end: end || null,
  };
}

/* ─────────────────────────────────────────────
 * SQL helpers
 * ───────────────────────────────────────────── */

function sqlStatusFromTurmas(minInicioTsExpr, maxFimTsExpr) {
  return `
    CASE
      WHEN ${minInicioTsExpr} IS NULL OR ${maxFimTsExpr} IS NULL THEN 'programado'
      WHEN (NOW() AT TIME ZONE '${TZ}') < ${minInicioTsExpr} THEN 'programado'
      WHEN (NOW() AT TIME ZONE '${TZ}') BETWEEN ${minInicioTsExpr} AND ${maxFimTsExpr} THEN 'andamento'
      ELSE 'encerrado'
    END
  `;
}

function sqlOrganizadoresPorEvento(eventoIdExpr) {
  return `
    COALESCE((
      SELECT json_agg(obj ORDER BY obj->>'nome')
      FROM (
        SELECT DISTINCT jsonb_build_object(
          'id', u.id,
          'nome', u.nome
        ) AS obj
        FROM turmas t2
        JOIN turma_responsavel tr ON tr.turma_id = t2.id
        JOIN usuarios u ON u.id = tr.usuario_id
        WHERE t2.evento_id = ${eventoIdExpr}
          AND tr.papel = '${PAPEL_ORGANIZADOR}'
      ) organizadores
    ), '[]'::json)
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
        ) datas_evento
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
        ) datas_presenca
      )

      ELSE (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT to_char(gs::date, 'YYYY-MM-DD') AS d
            FROM (
              SELECT
                MIN(t0.data_inicio::date) AS data_inicio,
                MAX(t0.data_fim::date) AS data_fim
              FROM turmas t0
              WHERE t0.evento_id = ${eventoIdExpr}
            ) periodo
            CROSS JOIN LATERAL generate_series(
              periodo.data_inicio,
              periodo.data_fim,
              interval '1 day'
            ) AS gs
           WHERE periodo.data_inicio IS NOT NULL
             AND periodo.data_fim IS NOT NULL
           ORDER BY 1
        ) datas_fallback
      )
    END
  `;
}

function sqlOcorrenciasPorEventoDoUsuario(eventoIdExpr) {
  return `
    CASE
      WHEN EXISTS (
        SELECT 1
          FROM turmas tx
          JOIN inscricoes i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
          JOIN datas_turma dt ON dt.turma_id = tx.id
         WHERE tx.evento_id = ${eventoIdExpr}
      ) THEN (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN inscricoes i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
            JOIN datas_turma dt ON dt.turma_id = tx.id
           WHERE tx.evento_id = ${eventoIdExpr}
           ORDER BY 1
        ) datas_evento
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
        ) datas_presenca
      )

      ELSE (
        SELECT COALESCE(json_agg(d ORDER BY d), '[]'::json)
        FROM (
          SELECT to_char(gs::date, 'YYYY-MM-DD') AS d
            FROM (
              SELECT
                MIN(tx.data_inicio::date) AS data_inicio,
                MAX(tx.data_fim::date) AS data_fim
              FROM turmas tx
              JOIN inscricoes i2 ON i2.turma_id = tx.id AND i2.usuario_id = $1
              WHERE tx.evento_id = ${eventoIdExpr}
            ) periodo
            CROSS JOIN LATERAL generate_series(
              periodo.data_inicio,
              periodo.data_fim,
              interval '1 day'
            ) AS gs
           WHERE periodo.data_inicio IS NOT NULL
             AND periodo.data_fim IS NOT NULL
           ORDER BY 1
        ) datas_fallback
      )
    END
  `;
}

function montarFiltroPeriodoTurmas(params, start, end, aliasTurma = "t") {
  let where = "";

  if (start) {
    params.push(start);
    where += ` AND ${aliasTurma}.data_fim >= $${params.length}::date`;
  }

  if (end) {
    params.push(end);
    where += ` AND ${aliasTurma}.data_inicio <= $${params.length}::date`;
  }

  return where;
}

function normalizarAgendaRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    ocorrencias: asArrayJson(row.ocorrencias),
    organizadores: asArrayJson(row.organizadores),
  }));
}

/* ─────────────────────────────────────────────
 * GET /api/agenda
 * Agenda geral administrativa
 * ───────────────────────────────────────────── */

async function buscarAgenda(req, res) {
  const db = getDb(req);

  try {
    const periodo = validarPeriodoQuery(req, res);
    if (!periodo) return null;

    const local = normalizarTexto(req.query?.local, 160);

    const params = [];
    let where = "WHERE 1=1";

    if (local) {
      params.push(`%${local}%`);
      where += ` AND e.local ILIKE $${params.length}`;
    }

    if (periodo.start) {
      params.push(periodo.start);
      where += `
        AND EXISTS (
          SELECT 1
            FROM turmas tf
           WHERE tf.evento_id = e.id
             AND tf.data_fim >= $${params.length}::date
        )
      `;
    }

    if (periodo.end) {
      params.push(periodo.end);
      where += `
        AND EXISTS (
          SELECT 1
            FROM turmas tf
           WHERE tf.evento_id = e.id
             AND tf.data_inicio <= $${params.length}::date
        )
      `;
    }

    const sql = `
      SELECT
        e.id,
        e.titulo,
        e.local,

        MIN(t.data_inicio) AS data_inicio,
        MAX(t.data_fim) AS data_fim,
        MIN(t.horario_inicio) AS horario_inicio,
        MAX(t.horario_fim) AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(t.data_inicio::timestamp + COALESCE(t.horario_inicio, '00:00'::time))",
          "MAX(t.data_fim::timestamp + COALESCE(t.horario_fim, '23:59'::time))"
        )} AS status,

        ${sqlOrganizadoresPorEvento("e.id")} AS organizadores,
        ${sqlOcorrenciasPorEvento("e.id")} AS ocorrencias

      FROM eventos e
      LEFT JOIN turmas t ON t.evento_id = e.id
      ${where}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio) ASC NULLS LAST, e.id ASC
    `;

    const resultado = await db.query(sql, params);
    const agenda = normalizarAgendaRows(resultado.rows);

    logInfo(req, "buscarAgenda OK", {
      total: agenda.length,
      filtros: {
        local: local || null,
        start: periodo.start,
        end: periodo.end,
      },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgenda@v2.1");

    return responderSucesso(
      res,
      200,
      agenda,
      "Agenda carregada com sucesso.",
      "AGENDA_LISTADA"
    );
  } catch (error) {
    logErr(req, "Erro ao buscar agenda administrativa", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar a agenda.",
      "AGENDA_ERRO_LISTAR",
      "Falha inesperada em agendaController.buscarAgenda.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/agenda/organizador
 * Agenda de eventos do organizador autenticado
 * ───────────────────────────────────────────── */

async function buscarAgendaorganizador(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return responderErro(
        res,
        401,
        "Usuário não autenticado.",
        "AGENDA_USUARIO_NAO_AUTENTICADO",
        "req.user.id não foi encontrado no request."
      );
    }

    const periodo = validarPeriodoQuery(req, res);
    if (!periodo) return null;

    const params = [usuarioId];
    const filtroPeriodo = montarFiltroPeriodoTurmas(
      params,
      periodo.start,
      periodo.end,
      "t"
    );

    const sql = `
      WITH eventos_organizador AS (
        SELECT
          e.id AS evento_id,
          e.titulo,
          e.local,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim
        FROM turma_responsavel tr
        JOIN turmas t ON t.id = tr.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE tr.usuario_id = $1
          AND tr.papel = '${PAPEL_ORGANIZADOR}'
          ${filtroPeriodo}
      )
      SELECT
        eo.evento_id AS id,
        eo.titulo,
        eo.local,

        MIN(eo.data_inicio) AS data_inicio,
        MAX(eo.data_fim) AS data_fim,
        MIN(eo.horario_inicio) AS horario_inicio,
        MAX(eo.horario_fim) AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(eo.data_inicio::timestamp + COALESCE(eo.horario_inicio, '00:00'::time))",
          "MAX(eo.data_fim::timestamp + COALESCE(eo.horario_fim, '23:59'::time))"
        )} AS status,

        ${sqlOrganizadoresPorEvento("eo.evento_id")} AS organizadores,
        ${sqlOcorrenciasPorEvento("eo.evento_id")} AS ocorrencias

      FROM eventos_organizador eo
      GROUP BY eo.evento_id, eo.titulo, eo.local
      ORDER BY MIN(eo.data_inicio) DESC NULLS LAST, eo.evento_id DESC
    `;

    const resultado = await db.query(sql, params);
    const agenda = normalizarAgendaRows(resultado.rows);

    logInfo(req, "buscarAgendaorganizador OK", {
      usuarioId,
      total: agenda.length,
      filtros: {
        start: periodo.start,
        end: periodo.end,
      },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaorganizador@v2.1");

    return responderSucesso(
      res,
      200,
      agenda,
      "Agenda do organizador carregada com sucesso.",
      "AGENDA_ORGANIZADOR_LISTADA"
    );
  } catch (error) {
    logErr(req, "Erro ao buscar agenda do organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar a agenda do organizador.",
      "AGENDA_ORGANIZADOR_ERRO_LISTAR",
      "Falha inesperada em agendaController.buscarAgendaorganizador.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/agenda/minha
 * Minha agenda como participante/inscrito
 * ───────────────────────────────────────────── */

async function buscarAgendaMinha(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return responderErro(
        res,
        401,
        "Usuário não autenticado.",
        "AGENDA_USUARIO_NAO_AUTENTICADO",
        "req.user.id não foi encontrado no request."
      );
    }

    const periodo = validarPeriodoQuery(req, res);
    if (!periodo) return null;

    const params = [usuarioId];
    const filtroPeriodo = montarFiltroPeriodoTurmas(
      params,
      periodo.start,
      periodo.end,
      "t"
    );

    const sql = `
      SELECT
        e.id,
        e.titulo,
        e.local,

        MIN(t.data_inicio) AS data_inicio,
        MAX(t.data_fim) AS data_fim,
        MIN(t.horario_inicio) AS horario_inicio,
        MAX(t.horario_fim) AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(t.data_inicio::timestamp + COALESCE(t.horario_inicio, '00:00'::time))",
          "MAX(t.data_fim::timestamp + COALESCE(t.horario_fim, '23:59'::time))"
        )} AS status,

        ${sqlOrganizadoresPorEvento("e.id")} AS organizadores,
        ${sqlOcorrenciasPorEventoDoUsuario("e.id")} AS ocorrencias

      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      JOIN inscricoes i ON i.turma_id = t.id AND i.usuario_id = $1
      WHERE 1=1
        ${filtroPeriodo}
      GROUP BY e.id, e.titulo, e.local
      ORDER BY MIN(t.data_inicio) ASC NULLS LAST, e.id ASC
    `;

    const resultado = await db.query(sql, params);
    const agenda = normalizarAgendaRows(resultado.rows);

    logInfo(req, "buscarAgendaMinha OK", {
      usuarioId,
      total: agenda.length,
      filtros: {
        start: periodo.start,
        end: periodo.end,
      },
    });

    res.set("X-Agenda-Handler", "agendaController:buscarAgendaMinha@v2.1");

    return responderSucesso(
      res,
      200,
      agenda,
      "Sua agenda foi carregada com sucesso.",
      "AGENDA_MINHA_LISTADA"
    );
  } catch (error) {
    logErr(req, "Erro ao buscar minha agenda", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar sua agenda.",
      "AGENDA_MINHA_ERRO_LISTAR",
      "Falha inesperada em agendaController.buscarAgendaMinha.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/agenda/minha-organizador
 * Minha agenda como organizador
 * ───────────────────────────────────────────── */

async function buscarAgendaMinhaorganizador(req, res) {
  const db = getDb(req);

  try {
    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return responderErro(
        res,
        401,
        "Usuário não autenticado.",
        "AGENDA_USUARIO_NAO_AUTENTICADO",
        "req.user.id não foi encontrado no request."
      );
    }

    const periodo = validarPeriodoQuery(req, res);
    if (!periodo) return null;

    const params = [usuarioId];
    const filtroPeriodo = montarFiltroPeriodoTurmas(
      params,
      periodo.start,
      periodo.end,
      "t"
    );

    const sql = `
      WITH turmas_do_organizador AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento_titulo,
          e.local AS evento_local,
          t.id AS turma_id,
          t.nome AS turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          t.carga_horaria
        FROM turma_responsavel tr
        JOIN turmas t ON t.id = tr.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE tr.usuario_id = $1
          AND tr.papel = '${PAPEL_ORGANIZADOR}'
          ${filtroPeriodo}
      )
      SELECT
        tdo.evento_id AS id,
        tdo.evento_titulo AS titulo,
        tdo.evento_local AS local,

        MIN(tdo.data_inicio) AS data_inicio,
        MAX(tdo.data_fim) AS data_fim,
        MIN(tdo.horario_inicio) AS horario_inicio,
        MAX(tdo.horario_fim) AS horario_fim,

        ${sqlStatusFromTurmas(
          "MIN(tdo.data_inicio::timestamp + COALESCE(tdo.horario_inicio, '00:00'::time))",
          "MAX(tdo.data_fim::timestamp + COALESCE(tdo.horario_fim, '23:59'::time))"
        )} AS status,

        ${sqlOrganizadoresPorEvento("tdo.evento_id")} AS organizadores,
        ${sqlOcorrenciasPorEvento("tdo.evento_id")} AS ocorrencias

      FROM turmas_do_organizador tdo
      GROUP BY tdo.evento_id, tdo.evento_titulo, tdo.evento_local
      ORDER BY MIN(tdo.data_inicio) DESC NULLS LAST, tdo.evento_id DESC
    `;

    const resultado = await db.query(sql, params);
    const agenda = normalizarAgendaRows(resultado.rows);

    logInfo(req, "buscarAgendaMinhaorganizador OK", {
      usuarioId,
      total: agenda.length,
      filtros: {
        start: periodo.start,
        end: periodo.end,
      },
    });

    res.set(
      "X-Agenda-Handler",
      "agendaController:buscarAgendaMinhaorganizador@v2.1"
    );

    return responderSucesso(
      res,
      200,
      agenda,
      "Sua agenda como organizador foi carregada com sucesso.",
      "AGENDA_MINHA_ORGANIZADOR_LISTADA"
    );
  } catch (error) {
    logErr(req, "Erro ao buscar minha agenda como organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar sua agenda como organizador.",
      "AGENDA_MINHA_ORGANIZADOR_ERRO_LISTAR",
      "Falha inesperada em agendaController.buscarAgendaMinhaorganizador.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/agenda/calendario
 * Listar bloqueios/feriados
 * ───────────────────────────────────────────── */

async function listarBloqueios(req, res) {
  const db = getDb(req);

  try {
    const sql = `
      SELECT
        id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        tipo,
        descricao,
        criado_em,
        atualizado_em
      FROM calendario_bloqueios
      ORDER BY data ASC, id ASC
    `;

    const resultado = await db.query(sql);
    const bloqueios = resultado.rows || [];

    logInfo(req, "listarBloqueios OK", {
      total: bloqueios.length,
    });

    res.set("X-Agenda-Handler", "agendaController:listarBloqueios@v2.1");

    return responderSucesso(
      res,
      200,
      bloqueios,
      "Calendário de bloqueios carregado com sucesso.",
      "AGENDA_CALENDARIO_LISTADO"
    );
  } catch (error) {
    logErr(req, "Erro ao listar bloqueios do calendário", error);

    return responderErro(
      res,
      500,
      "Erro ao listar o calendário de bloqueios.",
      "AGENDA_CALENDARIO_ERRO_LISTAR",
      "Falha inesperada em agendaController.listarBloqueios.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * POST /api/agenda/calendario
 * Criar bloqueio/feriado
 * ───────────────────────────────────────────── */

async function criarBloqueio(req, res) {
  const db = getDb(req);

  try {
    const data = req.body?.data;
    const tipo = normalizarTexto(req.body?.tipo, 80);
    const descricao = normalizarTexto(req.body?.descricao, 1000);

    if (!isDateOnly(data)) {
      return responderErro(
        res,
        400,
        "O campo 'data' deve estar no formato YYYY-MM-DD.",
        "AGENDA_CALENDARIO_DATA_INVALIDA",
        "O payload de criação de bloqueio recebeu data fora do contrato date-only."
      );
    }

    if (!tipo) {
      return responderErro(
        res,
        400,
        "O campo 'tipo' é obrigatório.",
        "AGENDA_CALENDARIO_TIPO_OBRIGATORIO",
        "O payload de criação de bloqueio não recebeu tipo válido."
      );
    }

    const sql = `
      INSERT INTO calendario_bloqueios (
        data,
        tipo,
        descricao,
        criado_em,
        atualizado_em
      )
      VALUES ($1::date, $2, $3, NOW(), NOW())
      RETURNING
        id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        tipo,
        descricao,
        criado_em,
        atualizado_em
    `;

    const resultado = await db.query(sql, [
      data,
      tipo,
      descricao || null,
    ]);

    const item = resultado.rows?.[0] || null;

    logInfo(req, "criarBloqueio OK", {
      item,
    });

    res.set("X-Agenda-Handler", "agendaController:criarBloqueio@v2.1");

    return responderSucesso(
      res,
      201,
      item,
      "Bloqueio cadastrado com sucesso.",
      "AGENDA_CALENDARIO_CRIADO"
    );
  } catch (error) {
    if (error?.code === "23505") {
      return responderErro(
        res,
        409,
        "Já existe um bloqueio ou feriado cadastrado para esta data.",
        "AGENDA_CALENDARIO_DUPLICADO",
        "Violação de unicidade ao inserir em calendario_bloqueios.",
        IS_DEV ? error?.detail || error?.message : null
      );
    }

    if (error?.code === "23514") {
      return responderErro(
        res,
        400,
        "O tipo informado não é aceito pelo calendário.",
        "AGENDA_CALENDARIO_TIPO_INVALIDO",
        "Violação de CHECK constraint em calendario_bloqueios.tipo.",
        IS_DEV ? error?.detail || error?.message : null
      );
    }

    logErr(req, "Erro ao criar bloqueio do calendário", error);

    return responderErro(
      res,
      500,
      "Erro ao salvar o bloqueio no calendário.",
      "AGENDA_CALENDARIO_ERRO_CRIAR",
      "Falha inesperada em agendaController.criarBloqueio.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * DELETE /api/agenda/calendario/:id
 * Remover bloqueio/feriado
 * ───────────────────────────────────────────── */

async function removerBloqueio(req, res) {
  const db = getDb(req);

  try {
    const id = toIntId(req.params?.id);

    if (!id) {
      return responderErro(
        res,
        400,
        "ID inválido.",
        "AGENDA_CALENDARIO_ID_INVALIDO",
        "O parâmetro id da rota não é um inteiro positivo."
      );
    }

    const sql = `
      DELETE FROM calendario_bloqueios
      WHERE id = $1
      RETURNING
        id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        tipo,
        descricao
    `;

    const resultado = await db.query(sql, [id]);
    const itemRemovido = resultado.rows?.[0] || null;

    if (!itemRemovido) {
      return responderErro(
        res,
        404,
        "Bloqueio não encontrado.",
        "AGENDA_CALENDARIO_NAO_ENCONTRADO",
        "Nenhum registro foi removido de calendario_bloqueios para o id informado."
      );
    }

    logInfo(req, "removerBloqueio OK", {
      id,
      itemRemovido,
    });

    res.set("X-Agenda-Handler", "agendaController:removerBloqueio@v2.1");

    return responderSucesso(
      res,
      200,
      itemRemovido,
      "Bloqueio removido com sucesso.",
      "AGENDA_CALENDARIO_REMOVIDO"
    );
  } catch (error) {
    logErr(req, "Erro ao remover bloqueio do calendário", error);

    return responderErro(
      res,
      500,
      "Erro ao remover o bloqueio do calendário.",
      "AGENDA_CALENDARIO_ERRO_REMOVER",
      "Falha inesperada em agendaController.removerBloqueio.",
      IS_DEV ? error?.message : null
    );
  }
}

module.exports = {
  buscarAgenda,
  buscarAgendaorganizador,
  buscarAgendaMinha,
  buscarAgendaMinhaorganizador,
  listarBloqueios,
  criarBloqueio,
  removerBloqueio,
};