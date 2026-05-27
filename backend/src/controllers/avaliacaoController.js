/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/avaliacaoController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Controller oficial do módulo de avaliação pós-evento/turma.
 * - Envio de avaliação pelo usuário elegível.
 * - Consulta de avaliações disponíveis.
 * - Consulta por turma para organizador/administrador.
 * - Analytics administrativo por turma e por evento.
 * - Listagem administrativa de eventos com avaliação.
 *
 * Contratos oficiais de banco:
 * - avaliacoes
 * - inscricoes
 * - turmas
 * - eventos
 * - usuarios
 * - presencas
 * - datas_turma
 * - turma_responsavel
 *
 * Contrato oficial de autenticação:
 * - req.user.id
 * - req.user.perfil
 *
 * Contrato oficial de organizador:
 * - turma_responsavel.usuario_id
 * - turma_responsavel.turma_id
 * - turma_responsavel.papel = 'organizador'
 *
 * Contrato oficial de notas:
 * - Ótimo
 * - Bom
 * - Regular
 * - Ruim
 * - Péssimo
 *
 * Pontuação interna para média:
 * - Ótimo = 10
 * - Bom = 8
 * - Regular = 6
 * - Ruim = 4
 * - Péssimo = 2
 *
 * Diretrizes v2.1:
 * - Sem aliases.
 * - Sem fallback legado.
 * - Sem compatibilidade com tabela antiga.
 * - Sem req.usuario.
 * - Sem req.auth.userId.
 * - Sem respostas { erro } / { error }.
 * - Sem aceitar nota numérica ou textual alternativa.
 * - Date-only seguro.
 * - Transação segura no envio.
 * - Elegibilidade preservada: turma encerrada + presença + frequência >= 75%.
 */

const dbFallback = require("../db");
const { buscarAvaliacaoPendentes } = require("../services/avaliacaoService");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

const PAPEL_ORGANIZADOR = "organizador";

/* ─────────────────────────────────────────────
 * Notificação de certificado — contrato único
 * ───────────────────────────────────────────── */

let gerarNotificacaoDeCertificado = null;

try {
  const notificacaoController = require("./notificacaoController");

  if (
    typeof notificacaoController?.gerarNotificacaoDeCertificado === "function"
  ) {
    gerarNotificacaoDeCertificado =
      notificacaoController.gerarNotificacaoDeCertificado;
  }
} catch {
  gerarNotificacaoDeCertificado = null;
}

/* ─────────────────────────────────────────────
 * Respostas padronizadas
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

function mkRid(prefix = "AVL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "AVL") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function logInfo(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[avaliacao][${rid}] ${message}`, extra || "");
  }
}

function logWarn(rid, message, extra) {
  console.warn(`[avaliacao][${rid}][WARN] ${message}`, extra || "");
}

function logError(rid, message, error) {
  console.error(
    `[avaliacao][${rid}][ERR] ${message}`,
    error?.stack || error?.message || error
  );
}

/* ─────────────────────────────────────────────
 * DB / transação
 * ───────────────────────────────────────────── */

function getDb(req) {
  if (req?.db && typeof req.db.query === "function") {
    return req.db;
  }

  if (typeof dbFallback?.query === "function") {
    return dbFallback;
  }

  throw new Error("Contrato inválido: backend/src/db deve exportar query.");
}

async function withTx(req, fn) {
  const reqPool = req?.db?.pool || null;
  const fallbackPool = dbFallback?.pool || dbFallback?.db?.pool || null;
  const pool = reqPool || fallbackPool;

  if (pool && typeof pool.connect === "function") {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await fn({
        query: client.query.bind(client),
      });

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback não deve ocultar o erro original
      }

      throw error;
    } finally {
      client.release();
    }
  }

  const db = getDb(req);

  await db.query("BEGIN");

  try {
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      // rollback não deve ocultar o erro original
    }

    throw error;
  }
}

/* ─────────────────────────────────────────────
 * Auth / contexto
 * ───────────────────────────────────────────── */

function getUsuarioId(req) {
  const usuarioId = Number(req?.user?.id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return null;
  }

  return usuarioId;
}

function getPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

function isAdministrador(req) {
  return getPerfil(req) === "administrador";
}

/* ─────────────────────────────────────────────
 * Helpers básicos
 * ───────────────────────────────────────────── */

function toPositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normText(value, { max = 5000 } = {}) {
  if (value == null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
}

function pickText(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  return text || null;
}

/* ─────────────────────────────────────────────
 * Helpers date-only
 * ───────────────────────────────────────────── */

function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toYMDLocal(dateLike) {
  if (isYmd(dateLike)) return dateLike;

  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ─────────────────────────────────────────────
 * Contrato oficial de avaliação
 * ───────────────────────────────────────────── */

const NOTA_ENUM_OFICIAL = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const NOTA_PONTUACAO = {
  Ótimo: 10,
  Bom: 8,
  Regular: 6,
  Ruim: 4,
  Péssimo: 2,
};

const CAMPOS_OBRIGATORIOS = [
  "divulgacao_evento",
  "pontualidade",
  "conteudo_temas",
  "desempenho_organizador",
  "inscricao_online",
];

const CAMPOS_OPCIONAIS_NOTA = [
  "recepcao",
  "credenciamento",
  "material_apoio",
  "sinalizacao_local",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];

const CAMPOS_MEDIA_OFICIAL = [
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

const CAMPOS_OBJETIVOS = [
  ...CAMPOS_MEDIA_OFICIAL,
  "desempenho_organizador",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];

const CAMPOS_TEXTOS = [
  "gostou_mais",
  "sugestoes_melhoria",
  "comentarios_finais",
];

function isNotaEnumOficial(value) {
  return NOTA_ENUM_OFICIAL.includes(value);
}

function notaParaPontuacao(value) {
  if (!isNotaEnumOficial(value)) return null;
  return NOTA_PONTUACAO[value];
}

function validarNotaObrigatoria(payload, campo) {
  const value = payload?.[campo];

  if (!isNotaEnumOficial(value)) {
    return {
      ok: false,
      campo,
      valorRecebido: value ?? null,
      valoresAceitos: NOTA_ENUM_OFICIAL,
    };
  }

  return { ok: true };
}

function normalizarNotaOpcional(payload, campo) {
  const value = payload?.[campo];

  if (value == null || value === "") {
    return null;
  }

  if (!isNotaEnumOficial(value)) {
    throw Object.assign(new Error(`Valor inválido para '${campo}'.`), {
      statusCode: 400,
      code: "AVALIACAO_NOTA_INVALIDA",
      details: {
        campo,
        valorRecebido: value,
        valoresAceitos: NOTA_ENUM_OFICIAL,
      },
    });
  }

  return value;
}

function sanitizePayloadAvaliacao(payload, tipoEvento) {
  for (const campo of CAMPOS_OBRIGATORIOS) {
    const validacao = validarNotaObrigatoria(payload, campo);

    if (!validacao.ok) {
      throw Object.assign(
        new Error(`Campo obrigatório '${campo}' inválido ou ausente.`),
        {
          statusCode: 400,
          code: "AVALIACAO_CAMPO_OBRIGATORIO_INVALIDO",
          details: validacao,
        }
      );
    }
  }

  const tipo = String(tipoEvento || "").toLowerCase();
  const permitirExposicao =
    tipo === "congresso" || tipo === "simpósio" || tipo === "simposio";
  const permitirCongresso = tipo === "congresso";

  return {
    desempenho_organizador: payload.desempenho_organizador,
    divulgacao_evento: payload.divulgacao_evento,
    recepcao: normalizarNotaOpcional(payload, "recepcao"),
    credenciamento: normalizarNotaOpcional(payload, "credenciamento"),
    material_apoio: normalizarNotaOpcional(payload, "material_apoio"),
    pontualidade: payload.pontualidade,
    sinalizacao_local: normalizarNotaOpcional(payload, "sinalizacao_local"),
    conteudo_temas: payload.conteudo_temas,
    estrutura_local: normalizarNotaOpcional(payload, "estrutura_local"),
    acessibilidade: normalizarNotaOpcional(payload, "acessibilidade"),
    limpeza: normalizarNotaOpcional(payload, "limpeza"),
    inscricao_online: payload.inscricao_online,

    exposicao_trabalhos: permitirExposicao
      ? normalizarNotaOpcional(payload, "exposicao_trabalhos")
      : null,

    apresentacao_oral_mostra: permitirCongresso
      ? normalizarNotaOpcional(payload, "apresentacao_oral_mostra")
      : null,

    apresentacao_tcrs: permitirCongresso
      ? normalizarNotaOpcional(payload, "apresentacao_tcrs")
      : null,

    oficinas: permitirCongresso
      ? normalizarNotaOpcional(payload, "oficinas")
      : null,

    gostou_mais: normText(payload.gostou_mais, { max: 4000 }),
    sugestoes_melhoria: normText(payload.sugestoes_melhoria, { max: 4000 }),
    comentarios_finais: normText(payload.comentarios_finais, { max: 4000 }),
  };
}

function criarDistribuicaoNotas() {
  return {
    Ótimo: 0,
    Bom: 0,
    Regular: 0,
    Ruim: 0,
    Péssimo: 0,
  };
}

function mediaFromDist(dist) {
  let total = 0;
  let soma = 0;

  for (const nota of NOTA_ENUM_OFICIAL) {
    const qtd = Number(dist?.[nota] || 0);

    total += qtd;
    soma += qtd * NOTA_PONTUACAO[nota];
  }

  return total ? Number((soma / total).toFixed(2)) : null;
}

function mediaNotasEventoDe(avaliacao) {
  let soma = 0;
  let total = 0;

  for (const campo of CAMPOS_MEDIA_OFICIAL) {
    const pontuacao = notaParaPontuacao(avaliacao?.[campo]);

    if (pontuacao != null) {
      soma += pontuacao;
      total += 1;
    }
  }

  return total ? Number((soma / total).toFixed(2)) : null;
}

/* ─────────────────────────────────────────────
 * Elegibilidade / contexto
 * ───────────────────────────────────────────── */

async function obterContextoTurma(db, turmaId) {
  const result = await db.query(
    `
    SELECT
      t.id,
      t.evento_id,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio_ymd,
      to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim_ymd,
      t.horario_inicio,
      t.horario_fim,
      e.tipo AS evento_tipo,
      e.titulo AS evento_titulo,
      t.nome AS turma_nome
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return result.rows?.[0] || null;
}

async function usuarioTemInscricao(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM inscricoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rowCount || 0) > 0;
}

async function usuarioTemPresenca(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM presencas
    WHERE usuario_id = $1
      AND turma_id = $2
      AND presente = TRUE
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rowCount || 0) > 0;
}

async function totalEncontrosTurma(db, turmaId) {
  const result = await db.query(
    `
    WITH total_datas AS (
      SELECT COUNT(*)::int AS total
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback_turma AS (
      SELECT
        CASE
          WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS total
      FROM turmas t
      WHERE t.id = $1
    )
    SELECT
      CASE
        WHEN (SELECT total FROM total_datas) > 0 THEN (SELECT total FROM total_datas)
        ELSE COALESCE((SELECT total FROM fallback_turma), 0)
      END AS total
    `,
    [turmaId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function usuarioAtingiu75(db, usuarioId, turmaId) {
  const total = await totalEncontrosTurma(db, turmaId);

  if (total <= 0) {
    return {
      ok: false,
      presentes: 0,
      total,
      percentual: 0,
    };
  }

  const result = await db.query(
    `
    SELECT COUNT(DISTINCT p.data_presenca::date)::int AS presentes
    FROM presencas p
    WHERE p.usuario_id = $1
      AND p.turma_id = $2
      AND p.presente = TRUE
    `,
    [usuarioId, turmaId]
  );

  const presentes = Number(result.rows?.[0]?.presentes || 0);
  const percentual = total > 0 ? (presentes / total) * 100 : 0;

  return {
    ok: percentual >= 75,
    presentes,
    total,
    percentual: Number(percentual.toFixed(2)),
  };
}

async function fimRealTurmaTS(db, turmaId) {
  const result = await db.query(
    `
    WITH base AS (
      SELECT
        (
          SELECT (
            dt.data::date +
            COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time)
          )
          FROM datas_turma dt
          JOIN turmas t ON t.id = dt.turma_id
          WHERE dt.turma_id = $1
          ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
          LIMIT 1
        ) AS fim_datas_turma,

        (
          SELECT (
            t.data_fim::date +
            COALESCE(t.horario_fim::time, '23:59'::time)
          )
          FROM turmas t
          WHERE t.id = $1
          LIMIT 1
        ) AS fim_turma
    )
    SELECT COALESCE(fim_datas_turma, fim_turma) AS fim_local
    FROM base
    `,
    [turmaId]
  );

  return result.rows?.[0]?.fim_local || null;
}

async function turmaEncerrada(db, turmaId) {
  const fimLocal = await fimRealTurmaTS(db, turmaId);

  if (!fimLocal) return false;

  const result = await db.query(
    `SELECT (NOW() AT TIME ZONE '${TZ}') >= $1::timestamp AS encerrada`,
    [fimLocal]
  );

  return result.rows?.[0]?.encerrada === true;
}

async function usuarioJaAvaliou(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM avaliacoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rowCount || 0) > 0;
}

async function usuarioPodeAcessarTurmaComoorganizador(db, usuarioId, turmaId) {
  const result = await db.query(
    `
    SELECT 1
    FROM turma_responsavel tr
    WHERE tr.turma_id = $2
      AND tr.usuario_id = $1
      AND tr.papel = $3
    LIMIT 1
    `,
    [usuarioId, turmaId, PAPEL_ORGANIZADOR]
  );

  return Number(result.rowCount || 0) > 0;
}

/* ─────────────────────────────────────────────
 * POST /api/avaliacao
 * Enviar avaliação
 * ───────────────────────────────────────────── */

async function enviarAvaliacao(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const usuarioId = getUsuarioId(req);
  const payload = req.body || {};
  const turmaId = toPositiveInt(payload.turma_id);
  const eventoId = payload.evento_id != null ? toPositiveInt(payload.evento_id) : null;

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "AVALIACAO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "turma_id inválido.",
      "AVALIACAO_TURMA_ID_INVALIDO",
      "O payload de avaliação não recebeu turma_id como inteiro positivo."
    );
  }

  if (payload.evento_id != null && !eventoId) {
    return responderErro(
      res,
      400,
      "evento_id inválido.",
      "AVALIACAO_EVENTO_ID_INVALIDO",
      "O payload de avaliação recebeu evento_id inválido."
    );
  }

  try {
    const contexto = await obterContextoTurma(db, turmaId);

    if (!contexto) {
      logWarn(rid, "turma não encontrada", {
        usuarioId,
        turmaId,
        eventoId,
      });

      return responderErro(
        res,
        404,
        "Turma não encontrada.",
        "AVALIACAO_TURMA_NAO_ENCONTRADA",
        "Nenhuma turma foi localizada para o turma_id informado."
      );
    }

    if (eventoId != null && eventoId !== Number(contexto.evento_id)) {
      return responderErro(
        res,
        400,
        "evento_id não corresponde à turma_id.",
        "AVALIACAO_EVENTO_TURMA_INCOMPATIVEL",
        "O evento_id informado no payload não pertence à turma_id informada.",
        {
          evento_id_payload: eventoId,
          evento_id_turma: Number(contexto.evento_id),
          turma_id: turmaId,
        }
      );
    }

    const inscrito = await usuarioTemInscricao(db, usuarioId, turmaId);

    if (!inscrito) {
      return responderErro(
        res,
        403,
        "Você não está inscrito nesta turma.",
        "AVALIACAO_USUARIO_NAO_INSCRITO",
        "Usuário tentou avaliar uma turma sem inscrição correspondente em inscricoes."
      );
    }

    const participou = await usuarioTemPresenca(db, usuarioId, turmaId);

    if (!participou) {
      return responderErro(
        res,
        403,
        "Você não participou desta turma.",
        "AVALIACAO_USUARIO_SEM_PRESENCA",
        "Usuário não possui presença verdadeira registrada para a turma."
      );
    }

    const encerrada = await turmaEncerrada(db, turmaId);

    if (!encerrada) {
      return responderErro(
        res,
        403,
        "A avaliação só fica disponível após o encerramento da turma.",
        "AVALIACAO_TURMA_NAO_ENCERRADA",
        "Tentativa de avaliação antes do fim real da turma."
      );
    }

    const frequencia = await usuarioAtingiu75(db, usuarioId, turmaId);

    if (!frequencia.ok) {
      return responderErro(
        res,
        403,
        "Você ainda não atingiu a frequência mínima de 75% para avaliar.",
        "AVALIACAO_FREQUENCIA_INSUFICIENTE",
        "Usuário não atingiu frequência mínima para liberação da avaliação.",
        frequencia
      );
    }

    const clean = sanitizePayloadAvaliacao(payload, contexto.evento_tipo);

    const avaliacao = await withTx(req, async (tx) => {
      const lockTurma = await tx.query(
        `
        SELECT id
        FROM turmas
        WHERE id = $1
        FOR UPDATE
        `,
        [turmaId]
      );

      if (!lockTurma.rowCount) {
        throw Object.assign(new Error("Turma não encontrada."), {
          statusCode: 404,
          code: "AVALIACAO_TURMA_NAO_ENCONTRADA",
        });
      }

      const duplicada = await tx.query(
        `
        SELECT 1
        FROM avaliacoes
        WHERE usuario_id = $1
          AND turma_id = $2
        LIMIT 1
        `,
        [usuarioId, turmaId]
      );

      if (duplicada.rowCount > 0) {
        throw Object.assign(new Error("Você já avaliou esta turma."), {
          statusCode: 409,
          code: "AVALIACAO_DUPLICADA",
        });
      }

      const insertResult = await tx.query(
        `
        INSERT INTO avaliacoes (
          usuario_id,
          turma_id,
          desempenho_organizador,
          divulgacao_evento,
          recepcao,
          credenciamento,
          material_apoio,
          pontualidade,
          sinalizacao_local,
          conteudo_temas,
          estrutura_local,
          acessibilidade,
          limpeza,
          inscricao_online,
          exposicao_trabalhos,
          apresentacao_oral_mostra,
          apresentacao_tcrs,
          oficinas,
          gostou_mais,
          sugestoes_melhoria,
          comentarios_finais,
          data_avaliacao
        )
        VALUES (
          $1, $2,
          $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, NOW()
        )
        RETURNING *
        `,
        [
          usuarioId,
          turmaId,

          clean.desempenho_organizador,
          clean.divulgacao_evento,
          clean.recepcao,
          clean.credenciamento,

          clean.material_apoio,
          clean.pontualidade,
          clean.sinalizacao_local,
          clean.conteudo_temas,

          clean.estrutura_local,
          clean.acessibilidade,
          clean.limpeza,
          clean.inscricao_online,

          clean.exposicao_trabalhos,
          clean.apresentacao_oral_mostra,
          clean.apresentacao_tcrs,
          clean.oficinas,

          clean.gostou_mais,
          clean.sugestoes_melhoria,
          clean.comentarios_finais,
        ]
      );

      return insertResult.rows?.[0] || null;
    });

    logInfo(rid, "avaliação registrada", {
      avaliacao_id: avaliacao?.id || null,
      usuarioId,
      turmaId,
      eventoId: Number(contexto.evento_id),
    });

    if (typeof gerarNotificacaoDeCertificado === "function") {
      try {
        await gerarNotificacaoDeCertificado(usuarioId, {
          turma_id: turmaId,
          evento_id: Number(contexto.evento_id),
          evento_titulo: contexto.evento_titulo || "evento",
        });

        logInfo(rid, "notificação de certificado acionada", {
          usuarioId,
          turmaId,
          eventoId: Number(contexto.evento_id),
        });
      } catch (error) {
        logWarn(rid, "falha não bloqueante ao gerar notificação de certificado", {
          usuarioId,
          turmaId,
          message: error?.message || String(error),
        });
      }
    }

    return responderSucesso(
      res,
      201,
      avaliacao,
      "Avaliação registrada com sucesso. Se elegível, seu certificado será liberado.",
      "AVALIACAO_REGISTRADA"
    );
  } catch (error) {
    logError(rid, "erro ao registrar avaliação", error);

    const statusCode = Number(error?.statusCode || 500);

    if (statusCode >= 400 && statusCode < 500) {
      return responderErro(
        res,
        statusCode,
        error.message || "Não foi possível registrar a avaliação.",
        error.code || "AVALIACAO_ERRO_VALIDACAO",
        "Erro de validação/regra de negócio em enviarAvaliacao.",
        error.details || null
      );
    }

    if (error?.code === "23505") {
      return responderErro(
        res,
        409,
        "Você já avaliou esta turma.",
        "AVALIACAO_DUPLICADA",
        "Violação de unicidade ao inserir avaliação.",
        IS_DEV ? error?.detail || error?.message : null
      );
    }

    if (error?.code === "23514") {
      return responderErro(
        res,
        400,
        "Uma ou mais notas informadas não são aceitas.",
        "AVALIACAO_NOTA_ENUM_INVALIDA",
        "Violação de CHECK/enum no banco ao inserir em avaliacoes.",
        IS_DEV ? error?.detail || error?.message : null
      );
    }

    return responderErro(
      res,
      500,
      "Erro ao registrar avaliação.",
      "AVALIACAO_ERRO_REGISTRAR",
      "Falha inesperada em avaliacaoController.enviarAvaliacao.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/disponivel/:usuario_id
 * GET /api/avaliacao/disponivel
 * ───────────────────────────────────────────── */

async function listarAvaliacaoDisponiveis(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const usuarioId = toPositiveInt(req.params?.usuario_id);

  if (!usuarioId) {
    return responderErro(
      res,
      400,
      "usuario_id inválido.",
      "AVALIACAO_USUARIO_ID_INVALIDO",
      "A consulta de avaliações disponíveis recebeu usuario_id inválido."
    );
  }

  try {
    const rows = await buscarAvaliacaoPendentes(usuarioId, { db });

    logInfo(rid, "listarAvaliacaoDisponiveis OK", {
      usuarioId,
      total: rows.length,
      regra_questionario: "aplicada pelo avaliacaoService",
    });

    return responderSucesso(
      res,
      200,
      rows,
      "Avaliações disponíveis carregadas com sucesso.",
      "AVALIACOES_DISPONIVEIS_LISTADAS"
    );
  } catch (error) {
    logError(rid, "erro ao buscar avaliações disponíveis", error);

    return responderErro(
      res,
      500,
      "Erro ao buscar avaliações disponíveis.",
      "AVALIACOES_DISPONIVEIS_ERRO_LISTAR",
      "Falha inesperada em avaliacaoController.listarAvaliacaoDisponiveis.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/turma/:turma_id
 * Organizador/Admin
 * ───────────────────────────────────────────── */

async function listarPorTurmaParaorganizador(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const usuarioId = getUsuarioId(req);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!usuarioId) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "AVALIACAO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado no request."
    );
  }

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "ID de turma inválido.",
      "AVALIACAO_TURMA_ID_INVALIDO",
      "O parâmetro turma_id não é um inteiro positivo."
    );
  }

  try {
    const admin = isAdministrador(req);

    if (!admin) {
      const podeAcessar = await usuarioPodeAcessarTurmaComoorganizador(
        db,
        usuarioId,
        turmaId
      );

      if (!podeAcessar) {
        return responderErro(
          res,
          403,
          "Acesso negado à turma.",
          "AVALIACAO_TURMA_ACESSO_NEGADO",
          "Organizador tentou acessar avaliações de turma sem vínculo oficial em turma_responsavel."
        );
      }
    }

    const result = await db.query(
      `
      SELECT
        id,
        turma_id,
        usuario_id,
        desempenho_organizador,
        divulgacao_evento,
        recepcao,
        credenciamento,
        material_apoio,
        pontualidade,
        sinalizacao_local,
        conteudo_temas,
        estrutura_local,
        acessibilidade,
        limpeza,
        inscricao_online,
        exposicao_trabalhos,
        apresentacao_oral_mostra,
        apresentacao_tcrs,
        oficinas,
        gostou_mais,
        sugestoes_melhoria,
        comentarios_finais,
        data_avaliacao
      FROM avaliacoes
      WHERE turma_id = $1
      ORDER BY id DESC
      `,
      [turmaId]
    );

    const rows = result.rows || [];

    if (IS_DEV) {
      res.setHeader("X-Debug-User", String(usuarioId));
      res.setHeader("X-Debug-Perfil", getPerfil(req));
      res.setHeader("X-Debug-Avaliacao-Count", String(rows.length));
      res.setHeader("X-Debug-Avaliacao-Table", "avaliacoes");
    }

    logInfo(rid, "listarPorTurmaParaorganizador OK", {
      turmaId,
      usuarioId,
      total: rows.length,
      admin,
    });

    return responderSucesso(
      res,
      200,
      rows,
      "Avaliações da turma carregadas com sucesso.",
      "AVALIACOES_TURMA_LISTADAS"
    );
  } catch (error) {
    logError(rid, "erro ao listar avaliações da turma para organizador", error);

    return responderErro(
      res,
      500,
      "Erro ao buscar avaliações da turma.",
      "AVALIACOES_TURMA_ERRO_LISTAR",
      "Falha inesperada em avaliacaoController.listarPorTurmaParaorganizador.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/turma/:turma_id/all
 * Admin agregado por turma
 * ───────────────────────────────────────────── */

async function avaliacaoPorTurma(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "ID de turma inválido.",
      "AVALIACAO_TURMA_ID_INVALIDO",
      "O parâmetro turma_id não é um inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento,
        a.recepcao,
        a.credenciamento,
        a.material_apoio,
        a.pontualidade,
        a.sinalizacao_local,
        a.conteudo_temas,
        a.estrutura_local,
        a.acessibilidade,
        a.limpeza,
        a.inscricao_online,
        a.exposicao_trabalhos,
        a.apresentacao_oral_mostra,
        a.apresentacao_tcrs,
        a.oficinas,
        a.gostou_mais,
        a.sugestoes_melhoria,
        a.comentarios_finais
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      `,
      [turmaId]
    );

    const avaliacoes = result.rows || [];

    const notasorganizador = avaliacoes
      .map((item) => notaParaPontuacao(item.desempenho_organizador))
      .filter((value) => value != null);

    const media_organizador = notasorganizador.length
      ? Number(
          (
            notasorganizador.reduce((acc, value) => acc + value, 0) /
            notasorganizador.length
          ).toFixed(2)
        )
      : null;

    const notasEvento = avaliacoes
      .map((item) => mediaNotasEventoDe(item))
      .filter((value) => value != null);

    const media_evento = notasEvento.length
      ? Number(
          (
            notasEvento.reduce((acc, value) => acc + value, 0) /
            notasEvento.length
          ).toFixed(2)
        )
      : null;

    const comentarios = avaliacoes
      .filter(
        (item) =>
          pickText(item.gostou_mais) ||
          pickText(item.sugestoes_melhoria) ||
          pickText(item.comentarios_finais)
      )
      .map((item) => ({
        nome: item.nome,
        desempenho_organizador: item.desempenho_organizador,
        gostou_mais: item.gostou_mais,
        sugestoes_melhoria: item.sugestoes_melhoria,
        comentarios_finais: item.comentarios_finais,
      }));

    const inscritosRes = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM inscricoes
      WHERE turma_id = $1
      `,
      [turmaId]
    );

    const total_inscritos = Number(inscritosRes.rows?.[0]?.total || 0);
    const totalDias = await totalEncontrosTurma(db, turmaId);

    const presencasRes = await db.query(
      `
      SELECT
        usuario_id,
        to_char(data_presenca::date, 'YYYY-MM-DD') AS data_ymd,
        presente
      FROM presencas
      WHERE turma_id = $1
      `,
      [turmaId]
    );

    const mapaPresencas = Object.create(null);

    for (const row of presencasRes.rows || []) {
      if (row.presente !== true) continue;
      if (!isYmd(row.data_ymd)) continue;

      const usuarioKey = String(row.usuario_id);

      if (!mapaPresencas[usuarioKey]) {
        mapaPresencas[usuarioKey] = new Set();
      }

      mapaPresencas[usuarioKey].add(row.data_ymd);
    }

    let total_presentes = 0;

    if (totalDias > 0) {
      for (const usuarioKey of Object.keys(mapaPresencas)) {
        const quantidade = mapaPresencas[usuarioKey].size;
        const percentual = (quantidade / totalDias) * 100;

        if (percentual >= 75) {
          total_presentes += 1;
        }
      }
    }

    const presenca_media =
      total_inscritos > 0
        ? Math.round((total_presentes / total_inscritos) * 100)
        : 0;

    const data = {
      turma_id: turmaId,
      total_inscritos,
      total_presentes,
      presenca_media,
      total_avaliacao: avaliacoes.length,
      media_evento,
      media_organizador,
      comentarios,
      avaliacao: avaliacoes,
    };

    logInfo(rid, "avaliacaoPorTurma OK", {
      turmaId,
      total_avaliacao: avaliacoes.length,
      total_inscritos,
      total_presentes,
      totalDias,
    });

    return responderSucesso(
      res,
      200,
      data,
      "Resumo de avaliações da turma carregado com sucesso.",
      "AVALIACAO_TURMA_RESUMO"
    );
  } catch (error) {
    logError(rid, "erro ao buscar avaliações da turma", error);

    return responderErro(
      res,
      500,
      "Erro ao buscar avaliações da turma.",
      "AVALIACAO_TURMA_ERRO_RESUMO",
      "Falha inesperada em avaliacaoController.avaliacaoPorTurma.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/evento/:evento_id
 * Admin agregado por evento
 * ───────────────────────────────────────────── */

async function avaliacaoPorEvento(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const eventoId = toPositiveInt(req.params?.evento_id);

  if (!eventoId) {
    return responderErro(
      res,
      400,
      "evento_id inválido.",
      "AVALIACAO_EVENTO_ID_INVALIDO",
      "O parâmetro evento_id não é um inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento,
        a.recepcao,
        a.credenciamento,
        a.material_apoio,
        a.pontualidade,
        a.sinalizacao_local,
        a.conteudo_temas,
        a.estrutura_local,
        a.acessibilidade,
        a.limpeza,
        a.inscricao_online,
        a.exposicao_trabalhos,
        a.apresentacao_oral_mostra,
        a.apresentacao_tcrs,
        a.oficinas,
        a.gostou_mais,
        a.sugestoes_melhoria,
        a.comentarios_finais
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      JOIN turmas t ON t.id = a.turma_id
      WHERE t.evento_id = $1
      `,
      [eventoId]
    );

    const avaliacoes = result.rows || [];

    const notasorganizador = avaliacoes
      .map((item) => notaParaPontuacao(item.desempenho_organizador))
      .filter((value) => value != null);

    const media_organizador = notasorganizador.length
      ? Number(
          (
            notasorganizador.reduce((acc, value) => acc + value, 0) /
            notasorganizador.length
          ).toFixed(2)
        )
      : null;

    const notasEvento = avaliacoes
      .map((item) => mediaNotasEventoDe(item))
      .filter((value) => value != null);

    const media_evento = notasEvento.length
      ? Number(
          (
            notasEvento.reduce((acc, value) => acc + value, 0) /
            notasEvento.length
          ).toFixed(2)
        )
      : null;

    const comentarios = avaliacoes
      .filter(
        (item) =>
          pickText(item.gostou_mais) ||
          pickText(item.sugestoes_melhoria) ||
          pickText(item.comentarios_finais)
      )
      .map((item) => ({
        nome: item.nome,
        desempenho_organizador: item.desempenho_organizador,
        gostou_mais: item.gostou_mais,
        sugestoes_melhoria: item.sugestoes_melhoria,
        comentarios_finais: item.comentarios_finais,
      }));

    const data = {
      evento_id: eventoId,
      total_avaliacao: avaliacoes.length,
      media_evento,
      media_organizador,
      comentarios,
    };

    logInfo(rid, "avaliacaoPorEvento OK", {
      eventoId,
      total_avaliacao: avaliacoes.length,
    });

    return responderSucesso(
      res,
      200,
      data,
      "Resumo de avaliações do evento carregado com sucesso.",
      "AVALIACAO_EVENTO_RESUMO"
    );
  } catch (error) {
    logError(rid, "erro ao buscar avaliações do evento", error);

    return responderErro(
      res,
      500,
      "Erro ao buscar avaliações do evento.",
      "AVALIACAO_EVENTO_ERRO_RESUMO",
      "Falha inesperada em avaliacaoController.avaliacaoPorEvento.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/admin/eventos
 * Admin: eventos com avaliação
 * ───────────────────────────────────────────── */

async function listarEventosComAvaliacao(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const result = await db.query(
      `
      WITH turmas_com_count AS (
        SELECT
          t.id,
          t.evento_id,
          COUNT(a.id)::int AS total_respostas,
          MIN(t.data_inicio) AS data_inicio,
          MAX(t.data_fim) AS data_fim
        FROM turmas t
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
        GROUP BY t.id
      ),
      eventos_agregados AS (
        SELECT
          e.id,
          e.titulo,
          MIN(t.data_inicio) AS data_inicio,
          MAX(t.data_fim) AS data_fim,
          SUM(t.total_respostas)::int AS total_respostas
        FROM eventos e
        JOIN turmas_com_count t ON t.evento_id = e.id
        GROUP BY e.id, e.titulo
      )
      SELECT
        id,
        titulo,
        data_inicio,
        data_fim,
        total_respostas
      FROM eventos_agregados
      WHERE total_respostas > 0
      ORDER BY data_inicio DESC NULLS LAST, id DESC
      `
    );

    const rows = result.rows || [];

    logInfo(rid, "listarEventosComAvaliacao OK", {
      total: rows.length,
    });

    return responderSucesso(
      res,
      200,
      rows,
      "Eventos com avaliações carregados com sucesso.",
      "AVALIACAO_ADMIN_EVENTOS_LISTADOS"
    );
  } catch (error) {
    logError(rid, "erro ao listar eventos com avaliações", error);

    return responderErro(
      res,
      500,
      "Erro ao listar eventos com avaliações.",
      "AVALIACAO_ADMIN_EVENTOS_ERRO_LISTAR",
      "Falha inesperada em avaliacaoController.listarEventosComAvaliacao.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/admin/evento/:evento_id
 * Admin: analytics detalhado do evento
 * ───────────────────────────────────────────── */

async function obterAvaliacaoDoEvento(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const eventoId = toPositiveInt(req.params?.evento_id);

  if (!eventoId) {
    return responderErro(
      res,
      400,
      "evento_id inválido.",
      "AVALIACAO_EVENTO_ID_INVALIDO",
      "O parâmetro evento_id não é um inteiro positivo."
    );
  }

  try {
    const turmasRes = await db.query(
      `
      SELECT
        t.id,
        t.nome,
        COUNT(a.id)::int AS total_respostas
      FROM turmas t
      LEFT JOIN avaliacoes a ON a.turma_id = t.id
      WHERE t.evento_id = $1
      GROUP BY t.id, t.nome
      ORDER BY t.id
      `,
      [eventoId]
    );

    const respostasRes = await db.query(
      `
      SELECT
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((campo) => `a.${campo} AS ${campo}`).join(", ")},
        ${CAMPOS_TEXTOS.map((campo) => `a.${campo} AS ${campo}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE t.evento_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [eventoId]
    );

    const turmas = turmasRes.rows || [];
    const respostas = (respostasRes.rows || []).map((row) => ({
      ...row,
      __turmaId: row.turma_id,
      __turmaNome: row.turma_nome,
    }));

    const dist = {};
    const medias = {};

    for (const campo of CAMPOS_OBJETIVOS) {
      dist[campo] = criarDistribuicaoNotas();
    }

    for (const resposta of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const nota = resposta[campo];

        if (isNotaEnumOficial(nota)) {
          dist[campo][nota] += 1;
        }
      }
    }

    for (const campo of CAMPOS_OBJETIVOS) {
      medias[campo] = mediaFromDist(dist[campo]);
    }

    const textos = {};

    for (const campo of CAMPOS_TEXTOS) {
      textos[campo] = respostas.map((row) => pickText(row[campo])).filter(Boolean);
    }

    const mediasOficiais = CAMPOS_MEDIA_OFICIAL.map((campo) => medias[campo]).filter(
      (value) => Number.isFinite(value)
    );

    const mediaOficial = mediasOficiais.length
      ? Number(
          (
            mediasOficiais.reduce((acc, value) => acc + value, 0) /
            mediasOficiais.length
          ).toFixed(2)
        )
      : null;

    const data = {
      respostas,
      agregados: {
        total: respostas.length,
        dist,
        medias,
        textos,
        mediaOficial,
      },
      turmas,
    };

    logInfo(rid, "obterAvaliacaoDoEvento OK", {
      eventoId,
      respostas: respostas.length,
      turmas: turmas.length,
    });

    return responderSucesso(
      res,
      200,
      data,
      "Avaliações do evento carregadas com sucesso.",
      "AVALIACAO_ADMIN_EVENTO_DETALHE"
    );
  } catch (error) {
    logError(rid, "erro ao obter avaliações do evento", error);

    return responderErro(
      res,
      500,
      "Erro ao obter avaliações do evento.",
      "AVALIACAO_ADMIN_EVENTO_ERRO_DETALHE",
      "Falha inesperada em avaliacaoController.obterAvaliacaoDoEvento.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * GET /api/avaliacao/admin/turma/:turma_id
 * Admin: respostas da turma
 * ───────────────────────────────────────────── */

async function obterAvaliacaoDaTurma(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!turmaId) {
    return responderErro(
      res,
      400,
      "turma_id inválido.",
      "AVALIACAO_TURMA_ID_INVALIDO",
      "O parâmetro turma_id não é um inteiro positivo."
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((campo) => `a.${campo} AS ${campo}`).join(", ")},
        ${CAMPOS_TEXTOS.map((campo) => `a.${campo} AS ${campo}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [turmaId]
    );

    const rows = result.rows || [];

    logInfo(rid, "obterAvaliacaoDaTurma OK", {
      turmaId,
      total: rows.length,
    });

    return responderSucesso(
      res,
      200,
      rows,
      "Avaliações da turma carregadas com sucesso.",
      "AVALIACAO_ADMIN_TURMA_DETALHE"
    );
  } catch (error) {
    logError(rid, "erro ao obter avaliações da turma", error);

    return responderErro(
      res,
      500,
      "Erro ao obter avaliações da turma.",
      "AVALIACAO_ADMIN_TURMA_ERRO_DETALHE",
      "Falha inesperada em avaliacaoController.obterAvaliacaoDaTurma.",
      IS_DEV ? error?.message : null
    );
  }
}

/* ─────────────────────────────────────────────
 * Exports
 * ───────────────────────────────────────────── */

module.exports = {
  enviarAvaliacao,
  listarAvaliacaoDisponiveis,
  listarPorTurmaParaorganizador,
  avaliacaoPorTurma,
  avaliacaoPorEvento,
  listarEventosComAvaliacao,
  obterAvaliacaoDoEvento,
  obterAvaliacaoDaTurma,
};