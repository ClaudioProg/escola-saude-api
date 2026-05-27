/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/organizadorController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Controller oficial do módulo de organizadores.
 * - Lista organizadores.
 * - Consulta eventos e avaliações por organizador.
 * - Consulta turmas vinculadas a organizador específico.
 * - Consulta turmas do organizador autenticado.
 *
 * Rotas oficiais:
 * - GET /api/organizador
 * - GET /api/organizador/:id/eventos-avaliacao
 * - GET /api/organizador/:id/turmas
 * - GET /api/organizador/minhas/turmas?filtro=ativos|encerrados|todos
 *
 * Contrato oficial único:
 * - req.user.id
 * - req.user.perfil
 * - tabela oficial de avaliações: avaliacoes
 * - tabela oficial de assinaturas: assinaturas
 * - vínculo oficial por turma: turma_responsavel
 * - turma_responsavel.usuario_id
 * - turma_responsavel.turma_id
 * - turma_responsavel.papel = 'organizador'
 *
 * Diretrizes v2.1:
 * - Sem req.usuario.
 * - Sem aliases de filtro.
 * - Sem fallback para tabela avaliacao.
 * - Sem fallback para notas antigas.
 * - Sem aceitar "otimo", "excelente", "5", "pessimo" etc.
 * - Sem resposta { erro }.
 * - Sem organizador_id em turma_responsavel.
 * - Date-only seguro.
 * - Status por data/hora em America/Sao_Paulo.
 */

const dbFallback = require("../db");

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

const PAPEL_ORGANIZADOR = "organizador";

/* ─────────────────────────────────────────────
 * DB
 * ───────────────────────────────────────────── */

function getDb(req) {
  if (req?.db && typeof req.db.query === "function") {
    return req.db;
  }

  if (dbFallback && typeof dbFallback.query === "function") {
    return dbFallback;
  }

  throw new Error("Contrato inválido: backend/src/db deve exportar query.");
}

/* ─────────────────────────────────────────────
 * Respostas
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

function mkRid(prefix = "ORG") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "ORG") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function logInfo(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[organizadorController][${rid}] ${message}`, extra || "");
  }
}

function logError(rid, message, error) {
  console.error(
    `[organizadorController][${rid}][ERR] ${message}`,
    error?.stack || error?.message || error
  );
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function getUsuarioId(req) {
  return toPositiveInt(req?.user?.id);
}

function getPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

function normalizarFiltro(req) {
  const raw = String(req?.query?.filtro || "todos").trim().toLowerCase();

  if (raw === "ativos") return "ativos";
  if (raw === "encerrados") return "encerrados";
  if (raw === "todos") return "todos";

  return null;
}

function filtroWhereSql(filtro) {
  if (filtro === "encerrados") {
    return "WHERE base.status = 'encerrado'";
  }

  if (filtro === "ativos") {
    return "WHERE base.status IN ('programado', 'andamento')";
  }

  return "";
}

function montarTurma(row) {
  return {
    id: row.id,
    nome: row.nome,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    horario_inicio: row.horario_inicio,
    horario_fim: row.horario_fim,
    status: row.status || "programado",
    evento: {
      id: row.evento_id,
      nome: row.evento_nome,
      local: row.evento_local,
    },
  };
}

/* ─────────────────────────────────────────────
 * SQL oficial
 * ───────────────────────────────────────────── */

const SQL_STATUS_TURMA = `
  CASE
    WHEN (now() AT TIME ZONE '${TZ}') <
      (t.data_inicio::timestamp + COALESCE(t.horario_inicio, '00:00'::time))
      THEN 'programado'

    WHEN (now() AT TIME ZONE '${TZ}') BETWEEN
      (t.data_inicio::timestamp + COALESCE(t.horario_inicio, '00:00'::time))
      AND
      (t.data_fim::timestamp + COALESCE(t.horario_fim, '23:59'::time))
      THEN 'andamento'

    ELSE 'encerrado'
  END
`;

const SQL_NOTA_DESEMPENHO_ORGANIZADOR = `
  CASE a.desempenho_instrutor::text
    WHEN 'Ótimo' THEN 10
    WHEN 'Bom' THEN 8
    WHEN 'Regular' THEN 6
    WHEN 'Ruim' THEN 4
    WHEN 'Péssimo' THEN 2
    ELSE NULL
  END
`;

function sqlVinculosOrganizador(whereUsuario = "$1") {
  return `
    WITH vinculos AS (
      SELECT DISTINCT
        tr.usuario_id,
        t.evento_id,
        tr.turma_id
      FROM turma_responsavel tr
      JOIN turmas t ON t.id = tr.turma_id
      WHERE tr.usuario_id = ${whereUsuario}
        AND tr.papel = '${PAPEL_ORGANIZADOR}'
    )
  `;
}

function sqlVinculosGlobais() {
  return `
    WITH vinculos AS (
      SELECT DISTINCT
        tr.usuario_id,
        t.evento_id,
        tr.turma_id
      FROM turma_responsavel tr
      JOIN turmas t ON t.id = tr.turma_id
      WHERE tr.papel = '${PAPEL_ORGANIZADOR}'
    )
  `;
}

/* ─────────────────────────────────────────────
 * GET /api/organizador
 * ───────────────────────────────────────────── */

async function listarorganizador(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const result = await db.query(
      `
      ${sqlVinculosGlobais()},
      organizadores AS (
        SELECT DISTINCT
          u.id,
          u.nome,
          u.email
        FROM usuarios u
        WHERE u.perfil IN ('organizador', 'administrador')
      ),
      eventos_por_organizador AS (
        SELECT
          usuario_id,
          COUNT(DISTINCT evento_id)::int AS eventos_ministrados
        FROM vinculos
        GROUP BY usuario_id
      ),
      turmas_por_organizador AS (
        SELECT
          usuario_id,
          COUNT(DISTINCT turma_id)::int AS turmas_vinculadas
        FROM vinculos
        GROUP BY usuario_id
      ),
      notas_por_organizador AS (
        SELECT
          v.usuario_id,
          ${SQL_NOTA_DESEMPENHO_ORGANIZADOR} AS nota
        FROM vinculos v
        LEFT JOIN avaliacoes a ON a.turma_id = v.turma_id
      ),
      notas_agg AS (
        SELECT
          usuario_id,
          COUNT(nota)::int AS total_respostas,
          ROUND(AVG(nota)::numeric, 2) AS media_avaliacao
        FROM notas_por_organizador
        GROUP BY usuario_id
      ),
      assinaturas_agg AS (
        SELECT
          a.usuario_id,
          BOOL_OR(a.imagem_base64 IS NOT NULL AND btrim(a.imagem_base64) <> '') AS possui_assinatura
        FROM assinaturas a
        GROUP BY a.usuario_id
      )
      SELECT
        o.id,
        o.nome,
        o.email,
        COALESCE(ep.eventos_ministrados, 0) AS eventos_ministrados,
        COALESCE(tp.turmas_vinculadas, 0) AS turmas_vinculadas,
        COALESCE(na.total_respostas, 0) AS total_respostas,
        na.media_avaliacao,
        COALESCE(aa.possui_assinatura, FALSE) AS possui_assinatura
      FROM organizadores o
      LEFT JOIN eventos_por_organizador ep ON ep.usuario_id = o.id
      LEFT JOIN turmas_por_organizador tp ON tp.usuario_id = o.id
      LEFT JOIN notas_agg na ON na.usuario_id = o.id
      LEFT JOIN assinaturas_agg aa ON aa.usuario_id = o.id
      ORDER BY o.nome ASC
      `
    );

    logInfo(rid, "listarorganizador OK", {
      total: result.rows.length,
    });

    return responderSucesso(
      res,
      200,
      result.rows,
      "Organizadores carregados com sucesso.",
      "ORGANIZADOR_LISTADO"
    );
  } catch (error) {
    logError(rid, "Erro ao listar organizadores", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar organizadores.",
      "ORGANIZADOR_ERRO_LISTAR",
      "Falha inesperada em organizadorController.listarorganizador.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/organizador/:id/eventos-avaliacao
 * ───────────────────────────────────────────── */

async function getEventosAvaliacaoPororganizador(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const organizadorId = toPositiveInt(req.params?.id);

  if (!organizadorId) {
    return responderErro(
      res,
      400,
      "ID do organizador inválido.",
      "ORGANIZADOR_ID_INVALIDO",
      "req.params.id deve ser inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      ${sqlVinculosOrganizador("$1")},
      turmas_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento,
          MIN(t.data_inicio)::date AS data_inicio,
          MAX(t.data_fim)::date AS data_fim
        FROM vinculos v
        JOIN eventos e ON e.id = v.evento_id
        JOIN turmas t ON t.id = v.turma_id
        GROUP BY e.id, e.titulo
      ),
      notas_evento AS (
        SELECT
          v.evento_id,
          ${SQL_NOTA_DESEMPENHO_ORGANIZADOR} AS nota
        FROM vinculos v
        LEFT JOIN avaliacoes a ON a.turma_id = v.turma_id
      ),
      notas_agg AS (
        SELECT
          evento_id,
          ROUND(AVG(nota)::numeric, 2) AS nota_media,
          COUNT(nota)::int AS total_respostas
        FROM notas_evento
        GROUP BY evento_id
      )
      SELECT
        te.evento_id,
        te.evento,
        to_char(te.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        to_char(te.data_fim, 'YYYY-MM-DD') AS data_fim,
        na.nota_media,
        COALESCE(na.total_respostas, 0) AS total_respostas
      FROM turmas_evento te
      LEFT JOIN notas_agg na ON na.evento_id = te.evento_id
      ORDER BY te.data_inicio DESC NULLS LAST, te.evento_id DESC
      `,
      [organizadorId]
    );

    logInfo(rid, "getEventosAvaliacaoPororganizador OK", {
      organizador_id: organizadorId,
      total: result.rows.length,
    });

    return responderSucesso(
      res,
      200,
      result.rows,
      "Eventos e avaliações do organizador carregados com sucesso.",
      "ORGANIZADOR_EVENTOS_AVALIACAO_LISTADOS"
    );
  } catch (error) {
    logError(rid, "Erro ao carregar eventos/avaliações do organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar eventos e avaliações do organizador.",
      "ORGANIZADOR_EVENTOS_AVALIACAO_ERRO",
      "Falha inesperada em organizadorController.getEventosAvaliacaoPororganizador.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/organizador/:id/turmas
 * ───────────────────────────────────────────── */

async function getTurmasComEventoPororganizador(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const organizadorId = toPositiveInt(req.params?.id);

  if (!organizadorId) {
    return responderErro(
      res,
      400,
      "ID do organizador inválido.",
      "ORGANIZADOR_ID_INVALIDO",
      "req.params.id deve ser inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      ${sqlVinculosOrganizador("$1")},
      turmas_ids AS (
        SELECT DISTINCT turma_id
        FROM vinculos
      )
      SELECT
        t.id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim, 'HH24:MI') AS horario_fim,
        ${SQL_STATUS_TURMA} AS status,
        e.id AS evento_id,
        e.titulo AS evento_nome,
        e.local AS evento_local
      FROM turmas_ids ti
      JOIN turmas t ON t.id = ti.turma_id
      JOIN eventos e ON e.id = t.evento_id
      ORDER BY
        t.data_inicio ASC NULLS LAST,
        t.id ASC
      `,
      [organizadorId]
    );

    const turmas = result.rows.map(montarTurma);

    logInfo(rid, "getTurmasComEventoPororganizador OK", {
      organizador_id: organizadorId,
      total: turmas.length,
    });

    return responderSucesso(
      res,
      200,
      turmas,
      "Turmas do organizador carregadas com sucesso.",
      "ORGANIZADOR_TURMAS_LISTADAS"
    );
  } catch (error) {
    logError(rid, "Erro ao carregar turmas do organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar turmas do organizador.",
      "ORGANIZADOR_TURMAS_ERRO",
      "Falha inesperada em organizadorController.getTurmasComEventoPororganizador.",
      IS_DEV ? error.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/organizador/minhas/turmas
 * ───────────────────────────────────────────── */

async function getMinhasTurmasorganizador(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const usuarioId = getUsuarioId(req);
  const perfil = getPerfil(req);
  const filtro = normalizarFiltro(req);

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "ORGANIZADOR_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!filtro) {
    return responderErro(
      res,
      400,
      "Filtro inválido.",
      "ORGANIZADOR_FILTRO_INVALIDO",
      "Use filtro=ativos, filtro=encerrados ou filtro=todos.",
      {
        filtro_recebido: req?.query?.filtro ?? null,
        filtros_validos: ["ativos", "encerrados", "todos"],
      }
    );
  }

  try {
    const whereFiltro = filtroWhereSql(filtro);

    const result = await db.query(
      `
      WITH vinculos AS (
        SELECT DISTINCT
          tr.usuario_id,
          tr.turma_id
        FROM turma_responsavel tr
        WHERE tr.usuario_id = $1
          AND tr.papel = $2
      ),
      base AS (
        SELECT
          t.id,
          t.nome,
          to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
          to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim, 'HH24:MI') AS horario_fim,
          ${SQL_STATUS_TURMA} AS status,
          e.id AS evento_id,
          e.titulo AS evento_nome,
          e.local AS evento_local
        FROM vinculos v
        JOIN turmas t ON t.id = v.turma_id
        JOIN eventos e ON e.id = t.evento_id
      )
      SELECT *
      FROM base
      ${whereFiltro}
      ORDER BY
        CASE
          WHEN status = 'andamento' THEN 1
          WHEN status = 'programado' THEN 2
          ELSE 3
        END,
        data_inicio DESC NULLS LAST,
        id DESC
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    const turmas = result.rows.map(montarTurma);

    res.setHeader("X-Organizador-Filtro", filtro);
    res.setHeader("X-Organizador-Turmas", String(turmas.length));

    logInfo(rid, "getMinhasTurmasorganizador OK", {
      usuario_id: usuarioId,
      perfil,
      filtro,
      total: turmas.length,
    });

    return responderSucesso(
      res,
      200,
      turmas,
      "Turmas do organizador carregadas com sucesso.",
      "ORGANIZADOR_MINHAS_TURMAS_LISTADAS",
      {
        meta: {
          filtro,
          total: turmas.length,
        },
      }
    );
  } catch (error) {
    logError(rid, "Erro ao carregar minhas turmas do organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao carregar suas turmas.",
      "ORGANIZADOR_MINHAS_TURMAS_ERRO",
      "Falha inesperada em organizadorController.getMinhasTurmasorganizador.",
      IS_DEV ? error.message : null
    );
  }
}

module.exports = {
  listarorganizador,
  getEventosAvaliacaoPororganizador,
  getTurmasComEventoPororganizador,
  getMinhasTurmasorganizador,
};