"use strict";

/**
 * 📁 backend/src/controllers/debugPosCursoController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Diagnóstico administrativo pós-curso.
 *
 * Função:
 * - Permitir ao administrador verificar, por usuário, o estado técnico do fluxo:
 *   inscrição → presença → encerramento da turma → avaliação → certificado.
 *
 * Contratos oficiais:
 * - req.user.id
 * - req.user.perfil === "administrador"
 * - tabela inscricoes
 * - tabela avaliacoes
 * - tabela presencas
 * - tabela certificados
 * - tabela turmas
 * - tabela eventos
 * - tabela datas_turma
 *
 * Diretrizes v2.0:
 * - sem fallback de tabela;
 * - sem req.usuario;
 * - sem resposta { erro };
 * - sem retorno cru de array;
 * - sem aliases;
 * - date-only seguro;
 * - horário de parede tratado no banco;
 * - resposta padrão ok/data/message/code/meta;
 * - erro padrão ok:false/data:null/message/code/adminHint/details/requestId.
 */

const db = require("../db");

/* =========================================================================
   DB oficial
=========================================================================== */

const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof db?.pool?.query === "function"
      ? db.pool.query.bind(db.pool)
      : null;

if (typeof query !== "function") {
  throw new Error(
    "[debugPosCursoController] DB inválido. O export oficial de ../db deve expor query."
  );
}

/* =========================================================================
   Configurações
=========================================================================== */

const TZ_OFICIAL = "America/Sao_Paulo";
const IS_PROD = process.env.NODE_ENV === "production";

/* =========================================================================
   Respostas / logs
=========================================================================== */

function gerarRequestId(prefix = "debug-pos-curso") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sucesso(
  res,
  {
    status = 200,
    data = null,
    message = "OK",
    code = "OK",
    meta = null,
  } = {}
) {
  return res.status(status).json({
    ok: true,
    data,
    message,
    code,
    ...(meta ? { meta } : {}),
  });
}

function falha(
  res,
  {
    status = 500,
    message = "Erro interno.",
    code = "ERRO_INTERNO",
    adminHint = null,
    details = null,
    requestId,
  }
) {
  return res.status(status).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId,
  });
}

function logErro(requestId, contexto, err) {
  console.error(`[debugPosCursoController][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

/* =========================================================================
   Helpers
=========================================================================== */

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function perfilNormalizado(user) {
  return String(user?.perfil || "").trim().toLowerCase();
}

function calcularMotivosBloqueio(row) {
  const motivos = [];

  if (!row.inscrito) {
    motivos.push({
      etapa: "inscricao",
      code: "USUARIO_NAO_INSCRITO",
      message: "Usuário não inscrito na turma.",
    });
  }

  if (!row.turma_encerrada) {
    motivos.push({
      etapa: "turma",
      code: "TURMA_NAO_ENCERRADA",
      message: "Turma ainda não encerrada.",
    });
  }

  if (!row.atingiu_75) {
    motivos.push({
      etapa: "presenca",
      code: "FREQUENCIA_INSUFICIENTE",
      message: "Frequência inferior a 75%.",
    });
  }

  if (!row.avaliou) {
    motivos.push({
      etapa: "avaliacao",
      code: "AVALIACAO_PENDENTE",
      message: "Avaliação pendente.",
    });
  }

  if (row.certificado_gerado) {
    motivos.push({
      etapa: "certificado",
      code: "CERTIFICADO_JA_GERADO",
      message: "Certificado já gerado.",
    });
  }

  return motivos;
}

function primeiroMotivoBloqueio(row) {
  const motivos = calcularMotivosBloqueio(row);
  return motivos[0]?.message || "";
}

function calcularStatusFluxo(item) {
  if (item.certificado_gerado) return "certificado_gerado";
  if (item.pode_gerar_certificado) return "pronto_para_certificado";
  if (item.pode_avaliar) return "pronto_para_avaliacao";
  if (!item.turma_encerrada) return "aguardando_encerramento";
  if (!item.atingiu_75) return "bloqueado_por_frequencia";
  if (!item.avaliou) return "aguardando_avaliacao";
  return "bloqueado";
}

/* =========================================================================
   Controller
=========================================================================== */

async function debugPosCursoPorUsuario(req, res) {
  const requestId = gerarRequestId();

  try {
    const usuarioLogadoId = toPositiveInt(req.user?.id);
    const perfil = perfilNormalizado(req.user);
    const usuarioId = toPositiveInt(req.params?.usuario_id);

    if (!usuarioLogadoId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint:
          "O middleware de autenticação deve popular req.user.id com o usuário logado.",
        requestId,
      });
    }

    if (perfil !== "administrador") {
      return falha(res, {
        status: 403,
        message: "Acesso permitido apenas para administradores.",
        code: "ACESSO_ADMINISTRADOR_OBRIGATORIO",
        adminHint:
          "Verifique se req.user.perfil usa o contrato oficial 'administrador'.",
        details: {
          perfil: perfil || null,
        },
        requestId,
      });
    }

    if (!usuarioId) {
      return falha(res, {
        status: 400,
        message: "usuario_id inválido.",
        code: "USUARIO_ID_INVALIDO",
        adminHint: "O parâmetro usuario_id deve ser um inteiro positivo.",
        details: {
          value: req.params?.usuario_id ?? null,
        },
        requestId,
      });
    }

    const result = await query(
      `
        WITH inscricoes_usuario AS (
          SELECT
            i.usuario_id,
            i.turma_id
          FROM inscricoes i
          WHERE i.usuario_id = $1
        ),

        presencas_usuario AS (
          SELECT
            p.usuario_id,
            p.turma_id,
            COUNT(DISTINCT p.data_presenca::date)
              FILTER (WHERE p.presente = TRUE)::int AS presencas
          FROM presencas p
          WHERE p.usuario_id = $1
          GROUP BY p.usuario_id, p.turma_id
        ),

        avaliacoes_usuario AS (
          SELECT
            a.usuario_id,
            a.turma_id,
            COUNT(*)::int AS total_avaliacoes
          FROM avaliacoes a
          WHERE a.usuario_id = $1
          GROUP BY a.usuario_id, a.turma_id
        ),

        certificados_usuario AS (
          SELECT
            c.usuario_id,
            c.turma_id,
            c.evento_id,
            c.tipo,
            c.id AS certificado_id,
            c.numero_certificado,
            c.codigo_validacao,
            c.status AS certificado_status,
            c.hash_pdf,
            c.hash_dados,
            c.arquivo_pdf
          FROM certificados c
          WHERE c.usuario_id = $1
            AND c.tipo = 'usuario'
        ),

        base AS (
          SELECT
            u.id AS usuario_id,
            u.nome,
            u.email,
            t.id AS turma_id,
            e.id AS evento_id,
            e.titulo AS evento,
            t.nome AS turma,
            e.tipo AS tipo_evento,
            to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
            to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
            t.horario_inicio,
            t.horario_fim,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
              ) THEN (
                SELECT COUNT(*)::int
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
              )
              WHEN t.data_inicio IS NOT NULL
               AND t.data_fim IS NOT NULL
                THEN GREATEST(
                  1,
                  ((t.data_fim::date - t.data_inicio::date) + 1)
                )::int
              ELSE 0
            END AS total_aulas,
            COALESCE(
              (
                SELECT
                  to_char(
                    MAX(
                      dt.data::date
                      + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time)
                    ),
                    'YYYY-MM-DD HH24:MI:SS'
                  )
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
              ),
              to_char(
                (
                  t.data_fim::date
                  + COALESCE(t.horario_fim::time, '23:59'::time)
                ),
                'YYYY-MM-DD HH24:MI:SS'
              )
            ) AS encerramento_tecnico
          FROM usuarios u
          JOIN inscricoes_usuario iu
            ON iu.usuario_id = u.id
          JOIN turmas t
            ON t.id = iu.turma_id
          JOIN eventos e
            ON e.id = t.evento_id
          WHERE u.id = $1
        )

        SELECT
          b.usuario_id,
          b.nome,
          b.email,
          b.turma_id,
          b.evento_id,
          b.evento,
          b.turma,
          b.tipo_evento,
          b.data_inicio,
          b.data_fim,
          b.horario_inicio,
          b.horario_fim,
          b.encerramento_tecnico,
          TRUE AS inscrito,
          COALESCE(pu.presencas, 0)::int AS presencas,
          COALESCE(b.total_aulas, 0)::int AS total_aulas,
          CASE
            WHEN COALESCE(b.total_aulas, 0) > 0
              THEN ROUND(
                (
                  COALESCE(pu.presencas, 0)::numeric
                  / b.total_aulas::numeric
                ) * 100,
                2
              )
            ELSE 0
          END AS percentual_presenca,
          CASE
            WHEN COALESCE(b.total_aulas, 0) > 0
              THEN (
                COALESCE(pu.presencas, 0)::numeric
                / b.total_aulas::numeric
              ) >= 0.75
            ELSE FALSE
          END AS atingiu_75,
          (
            (NOW() AT TIME ZONE $2) >= b.encerramento_tecnico::timestamp
          ) AS turma_encerrada,
          COALESCE(au.total_avaliacoes, 0)::int AS total_avaliacoes,
          COALESCE(au.total_avaliacoes, 0) > 0 AS avaliou,
          cu.certificado_id IS NOT NULL AS certificado_gerado,
          cu.certificado_id,
          cu.numero_certificado,
          cu.codigo_validacao,
          cu.certificado_status,
          cu.hash_pdf,
          cu.hash_dados,
          cu.arquivo_pdf
        FROM base b
        LEFT JOIN presencas_usuario pu
          ON pu.usuario_id = b.usuario_id
         AND pu.turma_id = b.turma_id
        LEFT JOIN avaliacoes_usuario au
          ON au.usuario_id = b.usuario_id
         AND au.turma_id = b.turma_id
        LEFT JOIN certificados_usuario cu
          ON cu.usuario_id = b.usuario_id
         AND cu.turma_id = b.turma_id
        ORDER BY b.data_fim DESC NULLS LAST, b.turma_id DESC
      `,
      [usuarioId, TZ_OFICIAL]
    );

    const itens = (result.rows || []).map((row) => {
      const podeAvaliar =
        row.inscrito === true &&
        row.turma_encerrada === true &&
        row.atingiu_75 === true &&
        row.avaliou === false;

      const podeGerarCertificado =
        row.inscrito === true &&
        row.turma_encerrada === true &&
        row.atingiu_75 === true &&
        row.avaliou === true &&
        row.certificado_gerado === false;

      const item = {
        ...row,
        tipo_vinculo: "usuario",
        pode_avaliar: podeAvaliar,
        pode_gerar_certificado: podeGerarCertificado,
      };

      const motivos = calcularMotivosBloqueio(item);

      return {
        ...item,
        status_fluxo: calcularStatusFluxo(item),
        motivo_bloqueio: primeiroMotivoBloqueio(item),
        motivos_bloqueio: motivos,
      };
    });

    const resumo = {
      total_turmas: itens.length,
      pronto_para_avaliacao: itens.filter((item) => item.pode_avaliar).length,
      pronto_para_certificado: itens.filter((item) => item.pode_gerar_certificado)
        .length,
      certificados_gerados: itens.filter((item) => item.certificado_gerado)
        .length,
      bloqueados_por_frequencia: itens.filter(
        (item) => item.turma_encerrada && !item.atingiu_75
      ).length,
      aguardando_encerramento: itens.filter((item) => !item.turma_encerrada)
        .length,
      avaliacoes_pendentes: itens.filter(
        (item) => item.turma_encerrada && item.atingiu_75 && !item.avaliou
      ).length,
    };

    return sucesso(res, {
      data: {
        usuario_id: usuarioId,
        diagnostico: itens,
        resumo,
      },
      message: "Diagnóstico pós-curso gerado com sucesso.",
      code: "DEBUG_POS_CURSO_USUARIO_OK",
      meta: {
        total: itens.length,
        timezone: TZ_OFICIAL,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao gerar diagnóstico pós-curso", err);

    return falha(res, {
      status: 500,
      message: "Erro ao gerar diagnóstico de pós-curso.",
      code: "DEBUG_POS_CURSO_ERRO",
      adminHint:
        "Verifique tabelas oficiais inscricoes, avaliacoes, presencas, certificados, turmas, eventos e datas_turma. Não há fallback v2.0 para nomes antigos.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
        ...(IS_PROD ? {} : { detalhe: err?.message }),
      },
      requestId,
    });
  }
}

module.exports = {
  debugPosCursoPorUsuario,
};