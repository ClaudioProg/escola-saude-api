/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/dashboardController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Resumo do dashboard do usuário autenticado.
 * - Avaliações recentes recebidas pelo organizador autenticado.
 * - Dashboard administrativo.
 * - Eventos/turmas vinculados ao organizador.
 *
 * Contrato oficial:
 * - Usuário autenticado em req.user.id.
 * - Perfil oficial em req.user.perfil.
 * - Tabela oficial de inscrições: inscricoes.
 * - Tabela oficial de avaliações: avaliacoes.
 * - Vínculo oficial de organizador com turma: turma_responsavel.
 * - turma_responsavel.usuario_id.
 * - turma_responsavel.turma_id.
 * - turma_responsavel.papel = 'organizador'.
 *
 * Contrato oficial de notas:
 * - Ótimo = 10
 * - Bom = 8
 * - Regular = 6
 * - Ruim = 4
 * - Péssimo = 2
 *
 * Rotas relacionadas:
 * - GET /api/dashboard
 * - GET /api/dashboard/avaliacao-recente
 * - GET /api/dashboard/administrador
 * - GET /api/dashboard/organizador/:id/evento-avaliacao
 *
 * Padrão:
 * - Sem getDb(req).
 * - Sem req.usuario.
 * - Sem req.auth.
 * - Sem req.userId.
 * - Sem tabela inscricao.
 * - Sem tabela avaliacao.
 * - Sem organizador_id em turma_responsavel.
 * - Sem a.organizador_id.
 * - Sem aliases de nota.
 * - Sem retorno em array puro nas rotas de dashboard.
 * - Respostas ok/data/message/code.
 */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const { formatarGrafico } = require("../utils/grafico");

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  throw new Error("[dashboardController] db.query indisponível.");
}

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const TZ = "America/Sao_Paulo";
const PAPEL_ORGANIZADOR = "organizador";

const NOTAS_EVENTO = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

/* ─────────────────────────────────────────────────────────────
   Helpers de resposta
────────────────────────────────────────────────────────────── */

function getRequestId(res) {
  try {
    return res?.getHeader?.("X-Request-Id") || undefined;
  } catch {
    return undefined;
  }
}

function respostaOk(res, status, data = {}, extra = {}) {
  return res.status(status).json({
    ok: true,
    data,
    requestId: getRequestId(res),
    ...extra,
  });
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    requestId: getRequestId(res),
    ...extra,
  });
}

function logErro(scope, err, extra = {}) {
  console.error(`[dashboardController.${scope}] ERRO`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    stack: err?.stack,
    ...extra,
  });
}

/* ─────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function toInt(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function asPositiveInt(value) {
  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function getUsuarioId(req) {
  return asPositiveInt(req?.user?.id);
}

function exigirUsuarioId(req, res) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    respostaErro(
      res,
      401,
      "DASHBOARD-401-NAO-AUTENTICADO",
      "Usuário não autenticado."
    );
    return null;
  }

  return usuarioId;
}

function num(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function sqlScore10(colExpr) {
  return `
    CASE (${colExpr})::text
      WHEN 'Ótimo' THEN 10
      WHEN 'Bom' THEN 8
      WHEN 'Regular' THEN 6
      WHEN 'Ruim' THEN 4
      WHEN 'Péssimo' THEN 2
      ELSE NULL
    END
  `;
}

function sqlAgoraSp() {
  return `(NOW() AT TIME ZONE '${TZ}')`;
}

function parseAno(value) {
  const ano = toInt(value, null);

  if (!ano) return null;
  if (ano < 2000 || ano > 2100) return null;

  return ano;
}

function parseMes(value) {
  const mes = toInt(value, null);

  if (!mes) return null;
  if (mes < 1 || mes > 12) return null;

  return mes;
}

function parseTipo(value) {
  const tipo = String(value || "").trim();

  return tipo ? tipo.slice(0, 80) : null;
}

function buildFiltroTurmaEvento(query = {}) {
  const ano = parseAno(query.ano);
  const mes = parseMes(query.mes);
  const tipo = parseTipo(query.tipo);

  const params = [];
  const condicoes = [];

  if (ano) {
    params.push(ano);
    condicoes.push(`EXTRACT(YEAR FROM t.data_inicio) = $${params.length}`);
  }

  if (mes) {
    params.push(mes);
    condicoes.push(`EXTRACT(MONTH FROM t.data_inicio) = $${params.length}`);
  }

  if (tipo) {
    params.push(tipo);
    condicoes.push(`e.tipo = $${params.length}`);
  }

  return {
    params,
    where: condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "",
    filtros: {
      ano,
      mes,
      tipo,
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   GET /api/dashboard/organizador/:id/evento-avaliacao
────────────────────────────────────────────────────────────── */

async function getEventoAvaliacaoPororganizador(req, res) {
  const organizadorId = asPositiveInt(req.params.id);

  if (!organizadorId) {
    return respostaErro(
      res,
      400,
      "DASHBOARD-ORGANIZADOR-400-ID-INVALIDO",
      "ID de organizador inválido."
    );
  }

  try {
    const turmasResult = await db.query(
      `
      SELECT DISTINCT
        t.id AS turma_id
      FROM turma_responsavel tr
      INNER JOIN turmas t ON t.id = tr.turma_id
      WHERE tr.usuario_id = $1
        AND tr.papel = $2
      ORDER BY t.id ASC
      `,
      [organizadorId, PAPEL_ORGANIZADOR]
    );

    const turmaIds = (turmasResult.rows || [])
      .map((row) => Number(row.turma_id))
      .filter(Boolean);

    if (!turmaIds.length) {
      return respostaOk(
        res,
        200,
        {
          evento: [],
          total_evento: 0,
          total_turma: 0,
        },
        {
          message: "Nenhuma turma vinculada ao organizador foi localizada.",
        }
      );
    }

    const cabecalhoResult = await db.query(
      `
      SELECT
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date, 'DD/MM/YYYY') AS data_inicio,
        ROUND(AVG(${sqlScore10("a.desempenho_instrutor")})::numeric, 2) AS nota_media_10
      FROM turmas t
      INNER JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN avaliacoes a ON a.turma_id = t.id
      WHERE t.id = ANY($1::int[])
      GROUP BY e.id, e.titulo, t.id, t.nome, t.data_inicio
      ORDER BY e.titulo ASC, t.data_inicio DESC
      `,
      [turmaIds]
    );

    const comentariosResult = await db.query(
      `
      SELECT
        a.turma_id,
        a.desempenho_instrutor,
        a.gostou_mais,
        a.sugestoes_melhoria,
        a.comentarios_finais,
        a.data_avaliacao
      FROM avaliacoes a
      WHERE a.turma_id = ANY($1::int[])
        AND (
          NULLIF(TRIM(COALESCE(a.gostou_mais, '')), '') IS NOT NULL OR
          NULLIF(TRIM(COALESCE(a.sugestoes_melhoria, '')), '') IS NOT NULL OR
          NULLIF(TRIM(COALESCE(a.comentarios_finais, '')), '') IS NOT NULL
        )
      ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
      `,
      [turmaIds]
    );

    const comentariosPorTurma = new Map();

    for (const row of comentariosResult.rows || []) {
      const turmaId = Number(row.turma_id);

      if (!comentariosPorTurma.has(turmaId)) {
        comentariosPorTurma.set(turmaId, []);
      }

      comentariosPorTurma.get(turmaId).push({
        desempenho_organizador: row.desempenho_organizador ?? null,
        gostou_mais: String(row.gostou_mais || "").trim() || null,
        sugestoes_melhoria:
          String(row.sugestoes_melhoria || "").trim() || null,
        comentarios_finais:
          String(row.comentarios_finais || "").trim() || null,
        data_avaliacao: row.data_avaliacao ?? null,
      });
    }

    const eventoMap = new Map();

    for (const row of cabecalhoResult.rows || []) {
      const eventoId = Number(row.evento_id);
      const turmaId = Number(row.turma_id);
      const nota10 =
        row.nota_media_10 != null ? Number(row.nota_media_10) : null;

      if (!eventoMap.has(eventoId)) {
        eventoMap.set(eventoId, {
          id: eventoId,
          titulo: row.evento_titulo,
          turma: [],
        });
      }

      eventoMap.get(eventoId).turma.push({
        id: turmaId,
        nome: row.turma_nome,
        data: row.data_inicio,
        nota_media: nota10,
        nota_media_10: nota10,
        comentario: comentariosPorTurma.get(turmaId) || [],
      });
    }

    const evento = Array.from(eventoMap.values());

    return respostaOk(
      res,
      200,
      {
        evento,
        total_evento: evento.length,
        total_turma: turmaIds.length,
      },
      {
        message: "Eventos vinculados ao organizador listados com sucesso.",
      }
    );
  } catch (err) {
    logErro("getEventoAvaliacaoPororganizador", err, { organizadorId });

    return respostaErro(
      res,
      500,
      "DASHBOARD-ORGANIZADOR-500-EVENTO-AVALIACAO",
      "Erro ao buscar eventos do organizador."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/dashboard
────────────────────────────────────────────────────────────── */

async function getResumoDashboard(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  const agoraSp = sqlAgoraSp();

  try {
    const cursosResult = await db.query(
      `
      SELECT COUNT(DISTINCT e.id)::int AS total
      FROM inscricoes i
      INNER JOIN turmas t ON t.id = i.turma_id
      INNER JOIN eventos e ON e.id = t.evento_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim, '23:59'::time)) < ${agoraSp}
      `,
      [usuarioId]
    );

    const eventoOrganizadorResult = await db.query(
      `
      SELECT COUNT(DISTINCT t.evento_id)::int AS total
      FROM turma_responsavel tr
      INNER JOIN turmas t ON t.id = tr.turma_id
      WHERE tr.usuario_id = $1
        AND tr.papel = $2
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    const inscricaoFuturaResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      INNER JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND (t.data_inicio::date + COALESCE(t.horario_inicio, '00:00'::time)) > ${agoraSp}
      `,
      [usuarioId]
    );

    const inscricaoAtualResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      INNER JOIN turmas t ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND ${agoraSp} BETWEEN
          (t.data_inicio::date + COALESCE(t.horario_inicio, '00:00'::time))
          AND
          (t.data_fim::date + COALESCE(t.horario_fim, '23:59'::time))
      `,
      [usuarioId]
    );

    const avaliacaoPendenteResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes i
      INNER JOIN turmas t ON t.id = i.turma_id
      WHERE i.usuario_id = $1
        AND (t.data_fim::date + COALESCE(t.horario_fim, '23:59'::time)) <= ${agoraSp}
        AND NOT EXISTS (
          SELECT 1
          FROM avaliacoes a
          WHERE a.usuario_id = i.usuario_id
            AND a.turma_id = i.turma_id
        )
      `,
      [usuarioId]
    );

    const certificadoEmitidoResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados c
      WHERE c.usuario_id = $1
        AND c.gerado_em IS NOT NULL
        AND c.status IN ('emitido', 'enviado')
      `,
      [usuarioId]
    );

    const certificadoTotalResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM certificados
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    const presencaFaltaResult = await db.query(
      `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.data_inicio::date AS data_inicio,
          t.data_fim::date AS data_fim
        FROM inscricoes i
        INNER JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        SELECT
          mt.turma_id,
          dt.data::date AS data
        FROM minhas_turmas mt
        INNER JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        SELECT
          mt.turma_id,
          gs::date AS data
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(
          mt.data_inicio,
          mt.data_fim,
          interval '1 day'
        ) AS gs
        WHERE dt.turma_id IS NULL
      ),
      presenca AS (
        SELECT
          p.turma_id,
          p.data_presenca::date AS data,
          BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
      agregada AS (
        SELECT
          dbx.turma_id,
          MIN(dbx.data) AS data_inicio,
          MAX(dbx.data) AS data_fim,
          COUNT(*) FILTER (
            WHERE dbx.data <= CURRENT_DATE
          ) AS realizados,
          COUNT(*) FILTER (
            WHERE dbx.data <= CURRENT_DATE
              AND p.presente IS TRUE
          ) AS presentes_passados,
          COUNT(*) FILTER (
            WHERE dbx.data <= CURRENT_DATE
              AND COALESCE(p.presente, FALSE) IS NOT TRUE
          ) AS ausencias_passadas
        FROM datas_base dbx
        LEFT JOIN presenca p
          ON p.turma_id = dbx.turma_id
         AND p.data = dbx.data
        GROUP BY dbx.turma_id
      )
      SELECT
        COALESCE(SUM(presentes_passados), 0)::int AS presenca_total,
        COALESCE(SUM(ausencias_passadas), 0)::int AS falta_total
      FROM agregada
      WHERE CURRENT_DATE > data_fim
      `,
      [usuarioId]
    );

    const presencaTotal = num(presencaFaltaResult.rows?.[0]?.presenca_total, 0);
    const faltaTotal = num(presencaFaltaResult.rows?.[0]?.falta_total, 0);
    const totalPresencaFalta = presencaTotal + faltaTotal;

    const notaUsuario =
      totalPresencaFalta > 0
        ? Math.max(
            0,
            Math.min(
              10,
              Math.round(
                (10 - (faltaTotal / totalPresencaFalta) * 10) * 10
              ) / 10
            )
          )
        : null;

    const mediaOrganizadorResult = await db.query(
      `
      SELECT
        ROUND(AVG(${sqlScore10("a.desempenho_instrutor")})::numeric, 2) AS media_10
      FROM turma_responsavel tr
      INNER JOIN avaliacoes a ON a.turma_id = tr.turma_id
      WHERE tr.usuario_id = $1
        AND tr.papel = $2
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    const mediaAvaliacao10 =
      mediaOrganizadorResult.rows?.[0]?.media_10 != null
        ? Number(mediaOrganizadorResult.rows[0].media_10)
        : null;

    return respostaOk(
      res,
      200,
      {
        inscricao_futura: num(inscricaoFuturaResult.rows?.[0]?.total, 0),
        inscricao_atual: num(inscricaoAtualResult.rows?.[0]?.total, 0),
        avaliacao_pendente: num(avaliacaoPendenteResult.rows?.[0]?.total, 0),
        certificado_emitido: num(certificadoEmitidoResult.rows?.[0]?.total, 0),
        certificado_total: num(certificadoTotalResult.rows?.[0]?.total, 0),
        presenca_total: presencaTotal,
        falta_total: faltaTotal,
        nota_usuario: notaUsuario,
        curso_realizado: num(cursosResult.rows?.[0]?.total, 0),
        evento_organizador: num(eventoOrganizadorResult.rows?.[0]?.total, 0),
        proximo_evento: num(inscricaoFuturaResult.rows?.[0]?.total, 0),
        media_avaliacao: mediaAvaliacao10,
      },
      {
        message: "Resumo do dashboard carregado com sucesso.",
      }
    );
  } catch (err) {
    logErro("getResumoDashboard", err, { usuarioId });

    return respostaErro(
      res,
      500,
      "DASHBOARD-500-RESUMO",
      "Erro ao carregar dados do dashboard."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/dashboard/avaliacao-recente
────────────────────────────────────────────────────────────── */

async function getAvaliacaoRecenteorganizador(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  try {
    const result = await db.query(
      `
      SELECT
        e.titulo AS evento,
        ROUND(${sqlScore10("a.desempenho_instrutor")}::numeric, 2) AS nota_10,
        a.data_avaliacao
      FROM turma_responsavel tr
      INNER JOIN turmas t ON t.id = tr.turma_id
      INNER JOIN eventos e ON e.id = t.evento_id
      INNER JOIN avaliacoes a ON a.turma_id = t.id
      WHERE tr.usuario_id = $1
        AND tr.papel = $2
      ORDER BY a.data_avaliacao DESC NULLS LAST, a.id DESC
      LIMIT 10
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    const avaliacao = (result.rows || []).map((row) => ({
      evento: row.evento,
      nota_10: row.nota_10 != null ? Number(row.nota_10) : null,
      data_avaliacao: row.data_avaliacao ?? null,
    }));

    return respostaOk(
      res,
      200,
      {
        avaliacao,
        total: avaliacao.length,
      },
      {
        message: "Avaliações recentes carregadas com sucesso.",
      }
    );
  } catch (err) {
    logErro("getAvaliacaoRecenteorganizador", err, { usuarioId });

    return respostaErro(
      res,
      500,
      "DASHBOARD-500-AVALIACAO-RECENTE",
      "Erro ao buscar últimas avaliações."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/dashboard/administrador
────────────────────────────────────────────────────────────── */

async function obterDashboard(req, res) {
  const filtro = buildFiltroTurmaEvento(req.query);

  try {
    const totalEventoResult = await db.query(
      `
      SELECT COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      INNER JOIN turmas t ON t.evento_id = e.id
      ${filtro.where}
      `,
      filtro.params
    );

    const inscritoUnicoResult = await db.query(
      `
      SELECT COUNT(DISTINCT i.usuario_id)::int AS total
      FROM inscricoes i
      INNER JOIN turmas t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      ${filtro.where}
      `,
      filtro.params
    );

    const mediaAvaliacaoSql = `
      WITH avaliacao_base AS (
        SELECT
          (${NOTAS_EVENTO.map((campo) => sqlScore10(`a.${campo}`)).join(" + ")})::numeric AS soma,
          (
            ${NOTAS_EVENTO.map(
              (campo) =>
                `CASE WHEN ${sqlScore10(`a.${campo}`)} IS NULL THEN 0 ELSE 1 END`
            ).join(" + ")}
          )::numeric AS quantidade
        FROM avaliacoes a
        INNER JOIN turmas t ON a.turma_id = t.id
        INNER JOIN eventos e ON t.evento_id = e.id
        ${filtro.where}
      )
      SELECT
        ROUND(
          AVG(
            CASE
              WHEN quantidade > 0 THEN soma / quantidade
              ELSE NULL
            END
          ),
          2
        ) AS media_evento
      FROM avaliacao_base
    `;

    const mediaAvaliacaoResult = await db.query(
      mediaAvaliacaoSql,
      filtro.params
    );

    const mediaOrganizadorResult = await db.query(
      `
      SELECT
        ROUND(AVG(${sqlScore10("a.desempenho_instrutor")})::numeric, 2) AS media_organizador
      FROM avaliacoes a
      INNER JOIN turmas t ON a.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      ${filtro.where}
      `,
      filtro.params
    );

    const presencaResult = await db.query(
      `
      WITH turma_filtrada AS (
        SELECT
          t.id AS turma_id,
          t.evento_id,
          t.data_inicio::date AS data_inicio,
          t.data_fim::date AS data_fim
        FROM turmas t
        INNER JOIN eventos e ON e.id = t.evento_id
        ${filtro.where}
      ),
      encontro AS (
        SELECT
          tf.turma_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM datas_turma dt
              WHERE dt.turma_id = tf.turma_id
            )
              THEN (
                SELECT COUNT(*)::int
                FROM datas_turma dt
                WHERE dt.turma_id = tf.turma_id
              )
            ELSE ((tf.data_fim - tf.data_inicio) + 1)
          END AS total_encontro
        FROM turma_filtrada tf
      ),
      presenca_usuario AS (
        SELECT
          i.usuario_id,
          i.turma_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS presenca_feita
        FROM inscricoes i
        INNER JOIN turma_filtrada tf ON tf.turma_id = i.turma_id
        LEFT JOIN presencas p
          ON p.turma_id = i.turma_id
         AND p.usuario_id = i.usuario_id
         AND p.presente = TRUE
        GROUP BY i.usuario_id, i.turma_id
      ),
      elegivel_por_turma AS (
        SELECT
          pu.usuario_id,
          pu.turma_id,
          tf.evento_id,
          CASE
            WHEN COALESCE(e.total_encontro, 0) > 0
              THEN (pu.presenca_feita::numeric / e.total_encontro::numeric) >= 0.75
            ELSE FALSE
          END AS elegivel_75
        FROM presenca_usuario pu
        INNER JOIN turma_filtrada tf ON tf.turma_id = pu.turma_id
        LEFT JOIN encontro e ON e.turma_id = pu.turma_id
      ),
      resumo_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento_titulo,
          COUNT(DISTINCT i.usuario_id)::int AS total_inscrito_evento,
          COUNT(DISTINCT CASE WHEN ept.elegivel_75 THEN ept.usuario_id END)::int AS total_elegivel_evento
        FROM eventos e
        INNER JOIN turma_filtrada tf ON tf.evento_id = e.id
        INNER JOIN inscricoes i ON i.turma_id = tf.turma_id
        LEFT JOIN elegivel_por_turma ept
          ON ept.evento_id = e.id
         AND ept.usuario_id = i.usuario_id
        GROUP BY e.id, e.titulo
      )
      SELECT
        re.evento_titulo AS titulo,
        re.total_inscrito_evento AS total_inscrito,
        re.total_elegivel_evento AS total_presente,
        CASE
          WHEN re.total_inscrito_evento > 0
            THEN ROUND(
              (re.total_elegivel_evento::numeric / re.total_inscrito_evento::numeric) * 100,
              2
            )
          ELSE 0
        END AS percentual
      FROM resumo_evento re
      ORDER BY re.evento_titulo ASC
      `,
      filtro.params
    );

    const eventoPorMesResult = await db.query(
      `
      SELECT
        TO_CHAR(t.data_inicio, 'Mon') AS mes,
        COUNT(*)::int AS total,
        EXTRACT(MONTH FROM t.data_inicio)::int AS mes_num
      FROM eventos e
      INNER JOIN turmas t ON t.evento_id = e.id
      ${filtro.where}
      GROUP BY mes, mes_num
      ORDER BY mes_num ASC
      `,
      filtro.params
    );

    const eventoPorTipoResult = await db.query(
      `
      SELECT
        e.tipo,
        COUNT(DISTINCT e.id)::int AS total
      FROM eventos e
      INNER JOIN turmas t ON t.evento_id = e.id
      ${filtro.where}
      GROUP BY e.tipo
      ORDER BY e.tipo ASC
      `,
      filtro.params
    );

    let totalInscritoGlobal = 0;
    let totalElegivelGlobal = 0;

    for (const row of presencaResult.rows || []) {
      totalInscritoGlobal += Number(row.total_inscrito) || 0;
      totalElegivelGlobal += Number(row.total_presente) || 0;
    }

    const percentualPresenca =
      totalInscritoGlobal > 0
        ? Number(((totalElegivelGlobal / totalInscritoGlobal) * 100).toFixed(2))
        : 0;

    return respostaOk(
      res,
      200,
      {
        total_evento: num(totalEventoResult.rows?.[0]?.total, 0),
        inscrito_unico: num(inscritoUnicoResult.rows?.[0]?.total, 0),
        media_avaliacao: num(mediaAvaliacaoResult.rows?.[0]?.media_evento, 0),
        media_organizador: num(
          mediaOrganizadorResult.rows?.[0]?.media_organizador,
          0
        ),
        percentual_presenca: percentualPresenca,
        evento_por_mes: formatarGrafico(eventoPorMesResult.rows || [], "mes"),
        evento_por_tipo: formatarGrafico(
          eventoPorTipoResult.rows || [],
          "tipo"
        ),
        presenca_por_evento: formatarGrafico(
          presencaResult.rows || [],
          "titulo"
        ),
        filtro: filtro.filtros,
      },
      {
        message: "Dashboard administrativo carregado com sucesso.",
      }
    );
  } catch (err) {
    logErro("obterDashboard", err, { filtro: filtro.filtros });

    return respostaErro(
      res,
      500,
      "DASHBOARD-500-ADMINISTRADOR",
      "Erro ao gerar dashboard administrativo."
    );
  }
}

module.exports = {
  getResumoDashboard,
  getAvaliacaoRecenteorganizador,
  getEventoAvaliacaoPororganizador,
  obterDashboard,
};