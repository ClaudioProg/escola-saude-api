/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/questionarioController.js — v2.0
 * Atualizado em: 14/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo de questionário.
 *
 * Contratos aplicados:
 * - Mount esperado: /api/questionario
 * - Tabela oficial de inscrição: inscricoes
 * - Sem tabela inscricao
 * - Sem resolveInscricaoTable
 * - Sem compat DB paralela
 * - Sem req.usuario
 * - Sem perfil/perfis/roles/role
 * - Usuário autenticado oficial: req.user.id
 * - Perfil autenticado oficial: req.user.perfil
 * - Rotas singulares:
 *   - questao
 *   - alternativa
 *   - disponivel
 * - Param oficial de alternativa: alternativa_id
 * - Envelope oficial: { ok, data, message }
 * - Erros oficiais: { ok:false, message, details? }
 * - Date-only seguro no banco via date/time nativos
 * - Frequência via datas_turma e presencas
 * - Publicação com validação forte
 * - Tentativas com transação
 *
 * Observação importante:
 * - O schema atual NÃO possui questionarios_evento.tempo_minutos.
 * - Portanto, este controller não grava nem retorna tempo_minutos como dado persistido.
 * - Quando a coluna for criada, incluir tempo_minutos em atualizarQuestionario
 *   e nos SELECTs oficiais.
 */

const db = require("../db");

let gerarNotificacaoDeAvaliacao = async () => {};
try {
  ({ gerarNotificacaoDeAvaliacao } = require("./notificacaoController"));
} catch {
  gerarNotificacaoDeAvaliacao = async () => {};
}

/* ─────────────────────────────────────────────────────────────
 * DB oficial
 * ───────────────────────────────────────────────────────────── */

const pool = db?.pool || null;
const query = typeof db?.query === "function" ? db.query.bind(db) : null;

if (typeof query !== "function") {
  console.error("[questionarioController] db.query inválido:", db);
  throw new Error("db.query deve existir em backend/src/db.js.");
}

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

const QUESTIONARIO_STATUS = Object.freeze({
  RASCUNHO: "rascunho",
  PUBLICADO: "publicado",
});

const TENTATIVA_STATUS = Object.freeze({
  INICIADA: "iniciada",
  ENVIADA: "enviada",
});

const TIPOS_QUESTAO = Object.freeze(["multipla_escolha", "dissertativa"]);

/* ─────────────────────────────────────────────────────────────
 * Logger
 * ───────────────────────────────────────────────────────────── */

function mkRid(prefix = "QST") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function logDev(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[${rid}] ${message}`, extra || "");
  }
}

function logWarn(rid, message, extra) {
  console.warn(`[${rid}] ${message}`, extra || "");
}

function logError(rid, message, error) {
  console.error(
    `[${rid}] ${message}`,
    error?.stack || error?.message || error || ""
  );
}

/* ─────────────────────────────────────────────────────────────
 * Envelope
 * ───────────────────────────────────────────────────────────── */

function ok(res, data = null, message = "Operação realizada com sucesso.", status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    message,
  });
}

function fail(res, status, message, details = undefined) {
  const payload = {
    ok: false,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

/* ─────────────────────────────────────────────────────────────
 * Transação
 * ───────────────────────────────────────────────────────────── */

async function withTx(fn) {
  if (!pool || typeof pool.connect !== "function") {
    await query("BEGIN");

    try {
      const result = await fn({ query });
      await query("COMMIT");
      return result;
    } catch (error) {
      try {
        await query("ROLLBACK");
      } catch {}
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    const q = client.query.bind(client);

    await q("BEGIN");

    const result = await fn({ query: q });

    await q("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}

/* ─────────────────────────────────────────────────────────────
 * Helpers gerais
 * ───────────────────────────────────────────────────────────── */

function nowSP_YMDHM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function toNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBool(value, fallback = null) {
  if (typeof value === "boolean") return value;

  return fallback;
}

function normalizeTipoQuestao(value) {
  const tipo = normalizeText(value);

  return TIPOS_QUESTAO.includes(tipo) ? tipo : null;
}

function getUserId(req) {
  return toPositiveInt(req?.user?.id);
}

function getUserPerfil(req) {
  return normalizeText(req?.user?.perfil).toLowerCase();
}

function isAdmin(req) {
  return getUserPerfil(req) === "administrador";
}

function isGestorQuestionario(req) {
  const perfil = getUserPerfil(req);

  return perfil === "administrador" || perfil === "organizador" || perfil === "coordenador";
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/* ─────────────────────────────────────────────────────────────
 * Helpers de questionário
 * ───────────────────────────────────────────────────────────── */

async function carregarQuestionarioPorId(q, questionarioId) {
  const result = await q(
    `
    SELECT *
    FROM questionarios_evento
    WHERE id = $1
    LIMIT 1
    `,
    [questionarioId]
  );

  return result.rows?.[0] || null;
}

async function carregarQuestionarioPorEvento(q, eventoId) {
  const result = await q(
    `
    SELECT *
    FROM questionarios_evento
    WHERE evento_id = $1
    LIMIT 1
    `,
    [eventoId]
  );

  return result.rows?.[0] || null;
}

async function carregarQuestoes(q, questionarioId) {
  const result = await q(
    `
    SELECT *
    FROM questoes_questionario
    WHERE questionario_id = $1
    ORDER BY ordem ASC, id ASC
    `,
    [questionarioId]
  );

  return result.rows || [];
}

async function carregarAlternativasPorQuestoes(q, questaoIds = []) {
  const ids = (Array.isArray(questaoIds) ? questaoIds : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!ids.length) return [];

  const result = await q(
    `
    SELECT *
    FROM alternativas_questao
    WHERE questao_id = ANY($1::int[])
    ORDER BY questao_id ASC, ordem ASC, id ASC
    `,
    [ids]
  );

  return result.rows || [];
}

async function carregarQuestionarioCompleto(q, questionarioId) {
  const questionario = await carregarQuestionarioPorId(q, questionarioId);

  if (!questionario) return null;

  const questoes = await carregarQuestoes(q, questionario.id);
  const alternativas = await carregarAlternativasPorQuestoes(
    q,
    questoes.map((questao) => questao.id)
  );

  return {
    ...questionario,
    questoes: questoes.map((questao) => ({
      ...questao,
      alternativas: alternativas.filter(
        (alternativa) => Number(alternativa.questao_id) === Number(questao.id)
      ),
    })),
  };
}

async function questionarioPertenceATurma(q, questionarioId, turmaId) {
  const result = await q(
    `
    SELECT
      q.id AS questionario_id,
      q.evento_id,
      q.status,
      q.obrigatorio,
      q.min_nota,
      q.tentativas_max,
      t.id AS turma_id
    FROM questionarios_evento q
    JOIN turmas t ON t.evento_id = q.evento_id
    WHERE q.id = $1
      AND t.id = $2
    LIMIT 1
    `,
    [questionarioId, turmaId]
  );

  return result.rows?.[0] || null;
}

/* ─────────────────────────────────────────────────────────────
 * Regras de turma/elegibilidade
 * ───────────────────────────────────────────────────────────── */

async function fimRealTurmaStr(q, turmaId) {
  const result = await q(
    `
    WITH fim_datas AS (
      SELECT
        to_char(dt.data::date, 'YYYY-MM-DD') || ' ' ||
        to_char(dt.horario_fim::time, 'HH24:MI') AS fim_real
      FROM datas_turma dt
      WHERE dt.turma_id = $1
      ORDER BY dt.data DESC, dt.horario_fim DESC
      LIMIT 1
    ),
    fim_turma AS (
      SELECT
        to_char(t.data_fim::date, 'YYYY-MM-DD') || ' ' ||
        to_char(COALESCE(t.horario_fim::time, '23:59'::time), 'HH24:MI') AS fim_real
      FROM turmas t
      WHERE t.id = $1
      LIMIT 1
    )
    SELECT COALESCE(
      (SELECT fim_real FROM fim_datas),
      (SELECT fim_real FROM fim_turma)
    ) AS fim_real
    `,
    [turmaId]
  );

  return result.rows?.[0]?.fim_real || null;
}

async function totalDatasTurma(q, turmaId) {
  const result = await q(
    `
    WITH datas AS (
      SELECT COUNT(*)::int AS total
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback_turma AS (
      SELECT
        CASE
          WHEN data_inicio IS NOT NULL AND data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS total
      FROM turmas
      WHERE id = $1
      LIMIT 1
    )
    SELECT
      CASE
        WHEN (SELECT total FROM datas) > 0 THEN (SELECT total FROM datas)
        ELSE COALESCE((SELECT total FROM fallback_turma), 0)
      END AS total
    `,
    [turmaId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function presentesUsuarioTurma(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT COUNT(DISTINCT data_presenca)::int AS presentes
    FROM presencas
    WHERE usuario_id = $1
      AND turma_id = $2
      AND presente = TRUE
    `,
    [usuarioId, turmaId]
  );

  return Number(result.rows?.[0]?.presentes || 0);
}

async function usuarioEstaInscrito(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT 1
    FROM inscricoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return result.rowCount > 0;
}

async function checarElegibilidadeAluno(q, { usuarioId, turmaId }) {
  const fimReal = await fimRealTurmaStr(q, turmaId);

  if (!fimReal) {
    return {
      ok: false,
      motivo: "TURMA_INVALIDA",
    };
  }

  const agora = nowSP_YMDHM();

  if (agora < fimReal) {
    return {
      ok: false,
      motivo: "TURMA_NAO_ENCERRADA",
      agora,
      fim_real: fimReal,
    };
  }

  const total = await totalDatasTurma(q, turmaId);

  if (total <= 0) {
    return {
      ok: false,
      motivo: "TURMA_SEM_DATAS",
      agora,
      fim_real: fimReal,
    };
  }

  const presentes = await presentesUsuarioTurma(q, usuarioId, turmaId);
  const frequencia = total > 0 ? presentes / total : 0;

  if (frequencia < 0.75) {
    return {
      ok: false,
      motivo: "FREQUENCIA_INSUFICIENTE",
      presentes,
      total_datas: total,
      frequencia,
      frequencia_percentual: round2(frequencia * 100),
      agora,
      fim_real: fimReal,
    };
  }

  return {
    ok: true,
    motivo: null,
    presentes,
    total_datas: total,
    frequencia,
    frequencia_percentual: round2(frequencia * 100),
    agora,
    fim_real: fimReal,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Validações
 * ───────────────────────────────────────────────────────────── */

function validarMinNota(value) {
  const number = toNonNegativeNumber(value);

  if (number === null) return null;
  if (number > 100) return null;

  return number;
}

function validarTentativasMax(value) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 50) return undefined;

  return number;
}

function validarPeso(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0 || number > 10) {
    return null;
  }

  return number;
}

/* ─────────────────────────────────────────────────────────────
 * 1) Gestão: rascunho/metadados
 * ───────────────────────────────────────────────────────────── */

async function criarOuObterRascunhoPorEvento(req, res) {
  const rid = mkRid();

  try {
    const eventoId = toPositiveInt(req.params.evento_id);
    const userId = getUserId(req);

    if (!eventoId) {
      return fail(res, 400, "evento_id inválido.");
    }

    const result = await withTx(async ({ query: q }) => {
      const existente = await carregarQuestionarioPorEvento(q, eventoId);

      if (existente) {
        return {
          status: 200,
          data: existente,
          message: "Rascunho já existente.",
        };
      }

      const insert = await q(
        `
        INSERT INTO questionarios_evento (
          evento_id,
          titulo,
          descricao,
          obrigatorio,
          status,
          criado_por
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          eventoId,
          "Questionário de Aprendizagem",
          "Verificação de absorção do conteúdo antes da avaliação institucional.",
          true,
          QUESTIONARIO_STATUS.RASCUNHO,
          userId || null,
        ]
      );

      return {
        status: 201,
        data: insert.rows[0],
        message: "Rascunho criado.",
      };
    });

    logDev(rid, "criarOuObterRascunhoPorEvento OK", {
      eventoId,
      questionarioId: result?.data?.id || null,
    });

    return ok(res, result.data, result.message, result.status);
  } catch (error) {
    logError(rid, "Erro em criarOuObterRascunhoPorEvento", error);
    return fail(res, 500, "Erro ao criar ou obter rascunho do questionário.");
  }
}

async function obterQuestionarioPorEvento(req, res) {
  const rid = mkRid();

  try {
    const eventoId = toPositiveInt(req.params.evento_id);

    if (!eventoId) {
      return fail(res, 400, "evento_id inválido.");
    }

    const questionario = await carregarQuestionarioPorEvento(query, eventoId);

    if (!questionario) {
      return fail(res, 404, "Questionário não encontrado.");
    }

    const completo = await carregarQuestionarioCompleto(query, questionario.id);

    logDev(rid, "obterQuestionarioPorEvento OK", {
      eventoId,
      questionarioId: questionario.id,
    });

    return ok(res, completo, "Questionário carregado.");
  } catch (error) {
    logError(rid, "Erro em obterQuestionarioPorEvento", error);
    return fail(res, 500, "Erro ao obter questionário.");
  }
}

async function atualizarQuestionario(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);

    if (!questionarioId) {
      return fail(res, 400, "questionario_id inválido.");
    }

    const titulo = normalizeText(req.body?.titulo);
    const descricao =
      req.body?.descricao === undefined ? undefined : normalizeText(req.body.descricao);
    const obrigatorio = normalizeBool(req.body?.obrigatorio, undefined);
    const minNota = validarMinNota(req.body?.min_nota);
    const tentativasMax = validarTentativasMax(req.body?.tentativas_max);

    if (req.body?.titulo !== undefined && !titulo) {
      return fail(res, 400, "titulo é obrigatório.");
    }

    if (req.body?.min_nota !== undefined && minNota === null) {
      return fail(res, 400, "min_nota inválida. Use valor entre 0 e 100.");
    }

    if (req.body?.tentativas_max !== undefined && tentativasMax === undefined) {
      return fail(res, 400, "tentativas_max inválido. Use valor entre 1 e 50.");
    }

    const result = await query(
      `
      UPDATE questionarios_evento
      SET
        titulo = COALESCE($2, titulo),
        descricao = COALESCE($3, descricao),
        obrigatorio = COALESCE($4, obrigatorio),
        min_nota = COALESCE($5, min_nota),
        tentativas_max = COALESCE($6, tentativas_max),
        atualizado_em = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        questionarioId,
        req.body?.titulo === undefined ? null : titulo,
        descricao === undefined ? null : descricao,
        obrigatorio === undefined ? null : obrigatorio,
        req.body?.min_nota === undefined ? null : minNota,
        req.body?.tentativas_max === undefined ? null : tentativasMax,
      ]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Questionário não encontrado.");
    }

    logDev(rid, "atualizarQuestionario OK", { questionarioId });

    return ok(res, result.rows[0], "Questionário atualizado.");
  } catch (error) {
    logError(rid, "Erro em atualizarQuestionario", error);
    return fail(res, 500, "Erro ao atualizar questionário.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 2) Gestão: questões
 * ───────────────────────────────────────────────────────────── */

async function adicionarQuestao(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const tipo = normalizeTipoQuestao(req.body?.tipo);
    const enunciado = normalizeText(req.body?.enunciado);
    const ordem = toPositiveInt(req.body?.ordem) || 1;
    const peso = validarPeso(req.body?.peso ?? 1);

    if (!questionarioId) return fail(res, 400, "questionario_id inválido.");
    if (!tipo) return fail(res, 400, "tipo inválido.");
    if (!enunciado) return fail(res, 400, "enunciado é obrigatório.");
    if (peso === null) return fail(res, 400, "peso inválido. Use valor maior que 0 e menor ou igual a 10.");

    const questionario = await carregarQuestionarioPorId(query, questionarioId);

    if (!questionario) {
      return fail(res, 404, "Questionário não encontrado.");
    }

    if (questionario.status === QUESTIONARIO_STATUS.PUBLICADO) {
      return fail(res, 409, "Questionário publicado não pode receber novas questões.");
    }

    const result = await query(
      `
      INSERT INTO questoes_questionario (
        questionario_id,
        tipo,
        enunciado,
        ordem,
        peso
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [questionarioId, tipo, enunciado, ordem, peso]
    );

    logDev(rid, "adicionarQuestao OK", {
      questionarioId,
      questaoId: result.rows[0]?.id,
    });

    return ok(res, result.rows[0], "Questão adicionada.", 201);
  } catch (error) {
    logError(rid, "Erro em adicionarQuestao", error);
    return fail(res, 500, "Erro ao adicionar questão.");
  }
}

async function atualizarQuestao(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const questaoId = toPositiveInt(req.params.questao_id);

    if (!questionarioId) return fail(res, 400, "questionario_id inválido.");
    if (!questaoId) return fail(res, 400, "questao_id inválido.");

    const tipo =
      req.body?.tipo === undefined ? undefined : normalizeTipoQuestao(req.body.tipo);
    const enunciado =
      req.body?.enunciado === undefined ? undefined : normalizeText(req.body.enunciado);
    const ordem =
      req.body?.ordem === undefined ? undefined : toPositiveInt(req.body.ordem);
    const peso =
      req.body?.peso === undefined ? undefined : validarPeso(req.body.peso);

    if (req.body?.tipo !== undefined && !tipo) return fail(res, 400, "tipo inválido.");
    if (req.body?.enunciado !== undefined && !enunciado) {
      return fail(res, 400, "enunciado é obrigatório.");
    }
    if (req.body?.ordem !== undefined && !ordem) return fail(res, 400, "ordem inválida.");
    if (req.body?.peso !== undefined && peso === null) {
      return fail(res, 400, "peso inválido. Use valor maior que 0 e menor ou igual a 10.");
    }

    const result = await query(
      `
      UPDATE questoes_questionario
      SET
        tipo = COALESCE($3, tipo),
        enunciado = COALESCE($4, enunciado),
        ordem = COALESCE($5, ordem),
        peso = COALESCE($6, peso)
      WHERE id = $1
        AND questionario_id = $2
      RETURNING *
      `,
      [
        questaoId,
        questionarioId,
        tipo === undefined ? null : tipo,
        enunciado === undefined ? null : enunciado,
        ordem === undefined ? null : ordem,
        peso === undefined ? null : peso,
      ]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Questão não encontrada.");
    }

    logDev(rid, "atualizarQuestao OK", { questionarioId, questaoId });

    return ok(res, result.rows[0], "Questão atualizada.");
  } catch (error) {
    logError(rid, "Erro em atualizarQuestao", error);
    return fail(res, 500, "Erro ao atualizar questão.");
  }
}

async function removerQuestao(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const questaoId = toPositiveInt(req.params.questao_id);

    if (!questionarioId) return fail(res, 400, "questionario_id inválido.");
    if (!questaoId) return fail(res, 400, "questao_id inválido.");

    const result = await query(
      `
      DELETE FROM questoes_questionario
      WHERE id = $1
        AND questionario_id = $2
      RETURNING id
      `,
      [questaoId, questionarioId]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Questão não encontrada.");
    }

    logDev(rid, "removerQuestao OK", { questionarioId, questaoId });

    return ok(res, { id: questaoId }, "Questão removida.");
  } catch (error) {
    logError(rid, "Erro em removerQuestao", error);
    return fail(res, 500, "Erro ao remover questão.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 3) Gestão: alternativas
 * ───────────────────────────────────────────────────────────── */

async function adicionarAlternativa(req, res) {
  const rid = mkRid();

  try {
    const questaoId = toPositiveInt(req.params.questao_id);
    const texto = normalizeText(req.body?.texto);
    const correta = normalizeBool(req.body?.correta, false);
    const ordem = toPositiveInt(req.body?.ordem) || 1;

    if (!questaoId) return fail(res, 400, "questao_id inválido.");
    if (!texto) return fail(res, 400, "texto é obrigatório.");

    const result = await query(
      `
      INSERT INTO alternativas_questao (
        questao_id,
        texto,
        correta,
        ordem
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [questaoId, texto, correta, ordem]
    );

    logDev(rid, "adicionarAlternativa OK", {
      questaoId,
      alternativaId: result.rows[0]?.id,
    });

    return ok(res, result.rows[0], "Alternativa adicionada.", 201);
  } catch (error) {
    logError(rid, "Erro em adicionarAlternativa", error);
    return fail(res, 500, "Erro ao adicionar alternativa.");
  }
}

async function atualizarAlternativa(req, res) {
  const rid = mkRid();

  try {
    const alternativaId = toPositiveInt(req.params.alternativa_id);

    if (!alternativaId) {
      return fail(res, 400, "alternativa_id inválido.");
    }

    const texto =
      req.body?.texto === undefined ? undefined : normalizeText(req.body.texto);
    const correta =
      req.body?.correta === undefined ? undefined : normalizeBool(req.body.correta, undefined);
    const ordem =
      req.body?.ordem === undefined ? undefined : toPositiveInt(req.body.ordem);

    if (req.body?.texto !== undefined && !texto) return fail(res, 400, "texto é obrigatório.");
    if (req.body?.correta !== undefined && typeof correta !== "boolean") {
      return fail(res, 400, "correta deve ser boolean.");
    }
    if (req.body?.ordem !== undefined && !ordem) return fail(res, 400, "ordem inválida.");

    const result = await query(
      `
      UPDATE alternativas_questao
      SET
        texto = COALESCE($2, texto),
        correta = COALESCE($3, correta),
        ordem = COALESCE($4, ordem)
      WHERE id = $1
      RETURNING *
      `,
      [
        alternativaId,
        texto === undefined ? null : texto,
        correta === undefined ? null : correta,
        ordem === undefined ? null : ordem,
      ]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Alternativa não encontrada.");
    }

    logDev(rid, "atualizarAlternativa OK", { alternativaId });

    return ok(res, result.rows[0], "Alternativa atualizada.");
  } catch (error) {
    logError(rid, "Erro em atualizarAlternativa", error);
    return fail(res, 500, "Erro ao atualizar alternativa.");
  }
}

async function removerAlternativa(req, res) {
  const rid = mkRid();

  try {
    const alternativaId = toPositiveInt(req.params.alternativa_id);

    if (!alternativaId) {
      return fail(res, 400, "alternativa_id inválido.");
    }

    const result = await query(
      `
      DELETE FROM alternativas_questao
      WHERE id = $1
      RETURNING id
      `,
      [alternativaId]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Alternativa não encontrada.");
    }

    logDev(rid, "removerAlternativa OK", { alternativaId });

    return ok(res, { id: alternativaId }, "Alternativa removida.");
  } catch (error) {
    logError(rid, "Erro em removerAlternativa", error);
    return fail(res, 500, "Erro ao remover alternativa.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 4) Publicação
 * ───────────────────────────────────────────────────────────── */

async function publicarQuestionario(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);

    if (!questionarioId) {
      return fail(res, 400, "questionario_id inválido.");
    }

    const questionario = await carregarQuestionarioPorId(query, questionarioId);

    if (!questionario) {
      return fail(res, 404, "Questionário não encontrado.");
    }

    const questoes = await carregarQuestoes(query, questionarioId);

    if (!questoes.length) {
      return fail(res, 400, "Não é possível publicar: adicione ao menos uma questão.");
    }

    const somaPesos = round2(
      questoes.reduce((total, questao) => total + Number(questao.peso || 0), 0)
    );

    if (somaPesos !== 10) {
      return fail(res, 400, "Não é possível publicar: a soma dos pesos deve fechar exatamente 10.", {
        soma_pesos: somaPesos,
      });
    }

    const questoesObjetivas = questoes.filter(
      (questao) => questao.tipo === "multipla_escolha"
    );

    if (questoesObjetivas.length) {
      const alternativas = await query(
        `
        SELECT
          questao_id,
          COUNT(*)::int AS total,
          SUM(CASE WHEN correta THEN 1 ELSE 0 END)::int AS corretas
        FROM alternativas_questao
        WHERE questao_id = ANY($1::int[])
        GROUP BY questao_id
        `,
        [questoesObjetivas.map((questao) => questao.id)]
      );

      const mapa = new Map(
        alternativas.rows.map((row) => [Number(row.questao_id), row])
      );

      for (const questao of questoesObjetivas) {
        const row = mapa.get(Number(questao.id));
        const total = Number(row?.total || 0);
        const corretas = Number(row?.corretas || 0);

        if (total < 2) {
          return fail(
            res,
            400,
            `Questão ${questao.id}: múltipla escolha precisa de pelo menos 2 alternativas.`
          );
        }

        if (corretas !== 1) {
          return fail(
            res,
            400,
            `Questão ${questao.id}: múltipla escolha precisa ter exatamente 1 alternativa correta.`
          );
        }
      }
    }

    const result = await query(
      `
      UPDATE questionarios_evento
      SET status = $2,
          atualizado_em = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [questionarioId, QUESTIONARIO_STATUS.PUBLICADO]
    );

    logDev(rid, "publicarQuestionario OK", {
      questionarioId,
      eventoId: questionario.evento_id,
    });

    return ok(res, result.rows[0], "Questionário publicado.");
  } catch (error) {
    logError(rid, "Erro em publicarQuestionario", error);
    return fail(res, 500, "Erro ao publicar questionário.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 5) Aluno: disponíveis/responder/tentativa
 * ───────────────────────────────────────────────────────────── */

async function listarDisponiveisParaUsuario(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = toPositiveInt(req.params.usuario_id);
    const authUserId = getUserId(req);

    if (!usuarioId) return fail(res, 400, "usuario_id inválido.");

    if (!isAdmin(req) && authUserId !== usuarioId) {
      return fail(res, 403, "Sem permissão para consultar este usuário.");
    }

    const result = await query(
      `
      SELECT
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(COALESCE(t.horario_inicio::time, '00:00'::time), 'HH24:MI') AS horario_inicio,
        to_char(COALESCE(t.horario_fim::time, '23:59'::time), 'HH24:MI') AS horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        q.id AS questionario_id,
        q.titulo AS questionario_titulo,
        q.descricao AS questionario_descricao,
        q.min_nota,
        q.tentativas_max,
        q.obrigatorio,
        q.status
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      JOIN questionarios_evento q ON q.evento_id = e.id
      WHERE i.usuario_id = $1
        AND q.status = $2
        AND q.obrigatorio = TRUE
      ORDER BY t.data_fim DESC, COALESCE(t.horario_fim, '23:59'::time) DESC, t.id DESC
      `,
      [usuarioId, QUESTIONARIO_STATUS.PUBLICADO]
    );

    const disponiveis = [];

    for (const row of result.rows || []) {
      const elegibilidade = await checarElegibilidadeAluno(query, {
        usuarioId,
        turmaId: Number(row.turma_id),
      });

      if (!elegibilidade.ok) continue;

      const tentativas = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = $4)::int AS enviadas,
          MAX(id)::int AS ultima_tentativa_id,
          MAX(nota)::numeric AS ultima_nota
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
        `,
        [
          Number(row.questionario_id),
          usuarioId,
          Number(row.turma_id),
          TENTATIVA_STATUS.ENVIADA,
        ]
      );

      const enviadas = Number(tentativas.rows?.[0]?.enviadas || 0);
      const tentativasMax =
        row.tentativas_max === null || row.tentativas_max === undefined
          ? null
          : Number(row.tentativas_max);

      disponiveis.push({
        ...row,
        elegivel: true,
        frequencia_percentual: elegibilidade.frequencia_percentual,
        presentes: elegibilidade.presentes,
        total_datas: elegibilidade.total_datas,
        fim_real: elegibilidade.fim_real,
        tentativas_enviadas: enviadas,
        tentativas_max: tentativasMax,
        bloqueado_por_tentativas:
          tentativasMax !== null ? enviadas >= tentativasMax : false,
        ultima_tentativa_id: tentativas.rows?.[0]?.ultima_tentativa_id ?? null,
        ultima_nota: tentativas.rows?.[0]?.ultima_nota ?? null,
      });
    }

    logDev(rid, "listarDisponiveisParaUsuario OK", {
      usuarioId,
      total: disponiveis.length,
    });

    return ok(res, disponiveis, "Questionários disponíveis carregados.");
  } catch (error) {
    logError(rid, "Erro em listarDisponiveisParaUsuario", error);
    return fail(res, 500, "Erro ao listar questionários disponíveis.");
  }
}

async function obterQuestionarioParaResponder(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = getUserId(req);

    if (!questionarioId || !turmaId || !usuarioId) {
      return fail(res, 400, "Parâmetros inválidos.");
    }

    const ctx = await questionarioPertenceATurma(query, questionarioId, turmaId);

    if (!ctx) {
      return fail(res, 404, "Questionário não pertence a esta turma.");
    }

    if (!isGestorQuestionario(req)) {
      const inscrito = await usuarioEstaInscrito(query, usuarioId, turmaId);

      if (!inscrito) {
        return fail(res, 403, "Você não está inscrito nesta turma.");
      }

      const elegibilidade = await checarElegibilidadeAluno(query, {
        usuarioId,
        turmaId,
      });

      if (!elegibilidade.ok) {
        return fail(res, 409, "Questionário indisponível para esta turma.", {
          motivo: elegibilidade.motivo,
        });
      }
    }

    const questionario = await carregarQuestionarioPorId(query, questionarioId);

    if (!questionario) {
      return fail(res, 404, "Questionário não encontrado.");
    }

    if (
      questionario.status !== QUESTIONARIO_STATUS.PUBLICADO &&
      !isGestorQuestionario(req)
    ) {
      return fail(res, 409, "Questionário ainda não foi publicado.");
    }

    const questoes = await carregarQuestoes(query, questionarioId);
    const alternativas = await carregarAlternativasPorQuestoes(
      query,
      questoes.map((questao) => questao.id)
    );

    const questoesMix = shuffle(questoes).map((questao) => {
      const alternativasDaQuestao =
        questao.tipo === "multipla_escolha"
          ? shuffle(
              alternativas.filter(
                (alternativa) => Number(alternativa.questao_id) === Number(questao.id)
              )
            )
          : [];

      return {
        id: questao.id,
        tipo: questao.tipo,
        enunciado: questao.enunciado,
        ordem: questao.ordem,
        peso: questao.peso,
        alternativas: alternativasDaQuestao.map((alternativa) => ({
          id: alternativa.id,
          questao_id: alternativa.questao_id,
          texto: alternativa.texto,
          ordem: alternativa.ordem,
        })),
      };
    });

    return ok(
      res,
      {
        id: questionario.id,
        titulo: questionario.titulo,
        descricao: questionario.descricao,
        min_nota: questionario.min_nota,
        tentativas_max: questionario.tentativas_max,
        turma_id: turmaId,
        questoes: questoesMix,
      },
      "Questionário carregado para resposta."
    );
  } catch (error) {
    logError(rid, "Erro em obterQuestionarioParaResponder", error);
    return fail(res, 500, "Erro ao obter questionário para resposta.");
  }
}

async function iniciarTentativa(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = getUserId(req);

    if (!questionarioId || !turmaId || !usuarioId) {
      return fail(res, 400, "Parâmetros inválidos.");
    }

    const ctx = await questionarioPertenceATurma(query, questionarioId, turmaId);

    if (!ctx) {
      return fail(res, 404, "Questionário não pertence a esta turma.");
    }

    if (!isGestorQuestionario(req)) {
      const inscrito = await usuarioEstaInscrito(query, usuarioId, turmaId);

      if (!inscrito) {
        return fail(res, 403, "Você não está inscrito nesta turma.");
      }

      const elegibilidade = await checarElegibilidadeAluno(query, {
        usuarioId,
        turmaId,
      });

      if (!elegibilidade.ok) {
        return fail(res, 409, "Você ainda não está elegível para responder.", {
          motivo: elegibilidade.motivo,
        });
      }

      if (ctx.status !== QUESTIONARIO_STATUS.PUBLICADO) {
        return fail(res, 409, "Questionário ainda não foi publicado.");
      }
    }

    const tentativasMax =
      ctx.tentativas_max === null || ctx.tentativas_max === undefined
        ? null
        : Number(ctx.tentativas_max);

    const resultado = await withTx(async ({ query: q }) => {
      const ultima = await q(
        `
        SELECT *
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [questionarioId, usuarioId, turmaId]
      );

      if (ultima.rowCount && ultima.rows[0].status === TENTATIVA_STATUS.INICIADA) {
        return {
          status: 200,
          data: ultima.rows[0],
          message: "Tentativa já iniciada.",
        };
      }

      if (tentativasMax !== null) {
        const total = await q(
          `
          SELECT COUNT(*)::int AS enviadas
          FROM tentativas_questionario
          WHERE questionario_id = $1
            AND usuario_id = $2
            AND turma_id = $3
            AND status = $4
          `,
          [questionarioId, usuarioId, turmaId, TENTATIVA_STATUS.ENVIADA]
        );

        const enviadas = Number(total.rows?.[0]?.enviadas || 0);

        if (enviadas >= tentativasMax) {
          return {
            status: 409,
            error: true,
            message: "Limite de tentativas atingido.",
            details: {
              tentativas_max: tentativasMax,
              tentativas_enviadas: enviadas,
            },
          };
        }
      }

      const insert = await q(
        `
        INSERT INTO tentativas_questionario (
          questionario_id,
          usuario_id,
          turma_id,
          status,
          iniciado_em
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
        `,
        [questionarioId, usuarioId, turmaId, TENTATIVA_STATUS.INICIADA]
      );

      return {
        status: 201,
        data: insert.rows[0],
        message: "Tentativa iniciada.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "iniciarTentativa OK", {
      questionarioId,
      turmaId,
      usuarioId,
      tentativaId: resultado?.data?.id,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em iniciarTentativa", error);
    return fail(res, 500, "Erro ao iniciar tentativa.");
  }
}

async function enviarTentativa(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = getUserId(req);
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!questionarioId || !turmaId || !usuarioId) {
      return fail(res, 400, "Parâmetros inválidos.");
    }

    const ctx = await questionarioPertenceATurma(query, questionarioId, turmaId);

    if (!ctx) {
      return fail(res, 404, "Questionário não pertence a esta turma.");
    }

    if (!isGestorQuestionario(req)) {
      const inscrito = await usuarioEstaInscrito(query, usuarioId, turmaId);

      if (!inscrito) {
        return fail(res, 403, "Você não está inscrito nesta turma.");
      }

      const elegibilidade = await checarElegibilidadeAluno(query, {
        usuarioId,
        turmaId,
      });

      if (!elegibilidade.ok) {
        return fail(res, 409, "Você ainda não está elegível para enviar.", {
          motivo: elegibilidade.motivo,
        });
      }

      if (ctx.status !== QUESTIONARIO_STATUS.PUBLICADO) {
        return fail(res, 409, "Questionário ainda não foi publicado.");
      }
    }

    const resultado = await withTx(async ({ query: q }) => {
      const tentativa = await q(
        `
        SELECT *
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [questionarioId, usuarioId, turmaId]
      );

      if (!tentativa.rowCount) {
        return {
          status: 400,
          error: true,
          message: "Nenhuma tentativa iniciada.",
        };
      }

      if (tentativa.rows[0].status === TENTATIVA_STATUS.ENVIADA) {
        return {
          status: 200,
          data: {
            ...tentativa.rows[0],
            ja_enviada: true,
          },
          message: "Tentativa já havia sido enviada.",
        };
      }

      const questionario = await carregarQuestionarioPorId(q, questionarioId);

      if (!questionario) {
        return {
          status: 404,
          error: true,
          message: "Questionário não encontrado.",
        };
      }

      const questoes = await carregarQuestoes(q, questionarioId);
      const questaoMap = new Map(questoes.map((questao) => [Number(questao.id), questao]));

      const questoesObjetivas = questoes.filter(
        (questao) => questao.tipo === "multipla_escolha"
      );

      const alternativas = await carregarAlternativasPorQuestoes(
        q,
        questoesObjetivas.map((questao) => questao.id)
      );

      const alternativaMap = new Map(
        alternativas.map((alternativa) => [
          Number(alternativa.id),
          {
            questao_id: Number(alternativa.questao_id),
            correta: alternativa.correta === true,
          },
        ])
      );

      const respostasValidas = [];

      for (const resposta of respostas) {
        const questaoId = toPositiveInt(resposta?.questao_id);
        if (!questaoId) continue;

        const questao = questaoMap.get(questaoId);
        if (!questao) continue;

        if (questao.tipo === "multipla_escolha") {
          const alternativaId = toPositiveInt(resposta?.alternativa_id);
          if (!alternativaId) continue;

          const alternativa = alternativaMap.get(alternativaId);

          if (!alternativa || alternativa.questao_id !== questaoId) continue;

          respostasValidas.push({
            questao_id: questaoId,
            alternativa_id: alternativaId,
            resposta_texto: null,
          });

          continue;
        }

        const texto = normalizeText(resposta?.resposta_texto);

        respostasValidas.push({
          questao_id: questaoId,
          alternativa_id: null,
          resposta_texto: texto || null,
        });
      }

      const tentativaId = tentativa.rows[0].id;

      await q(`DELETE FROM respostas_questionario WHERE tentativa_id = $1`, [
        tentativaId,
      ]);

      let totalPesoObjetivo = 0;
      let totalPontos = 0;

      for (const resposta of respostasValidas) {
        const questao = questaoMap.get(Number(resposta.questao_id));
        const peso = Number(questao?.peso || 0);

        let correta = null;
        let pontuacao = null;

        if (questao?.tipo === "multipla_escolha") {
          totalPesoObjetivo += peso;

          const alternativa = alternativaMap.get(Number(resposta.alternativa_id));
          const acertou =
            alternativa &&
            alternativa.questao_id === Number(resposta.questao_id) &&
            alternativa.correta === true;

          correta = Boolean(acertou);
          pontuacao = acertou ? peso : 0;
          totalPontos += pontuacao;
        }

        await q(
          `
          INSERT INTO respostas_questionario (
            tentativa_id,
            questao_id,
            alternativa_id,
            resposta_texto,
            correta,
            pontuacao
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            tentativaId,
            resposta.questao_id,
            resposta.alternativa_id,
            resposta.resposta_texto,
            correta,
            pontuacao,
          ]
        );
      }

      const nota =
        totalPesoObjetivo > 0
          ? round2((totalPontos / totalPesoObjetivo) * 100)
          : null;

      const update = await q(
        `
        UPDATE tentativas_questionario
        SET status = $2,
            nota = $3,
            enviado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [tentativaId, TENTATIVA_STATUS.ENVIADA, nota]
      );

      const minNota =
        questionario.min_nota === null || questionario.min_nota === undefined
          ? null
          : Number(questionario.min_nota);

      const aprovado = minNota !== null && nota !== null ? nota >= minNota : null;

      return {
        status: 200,
        data: {
          ...update.rows[0],
          aprovado,
          min_nota: minNota,
          resumo: {
            total_peso_objetivo: round2(totalPesoObjetivo),
            total_pontos: round2(totalPontos),
            respostas_recebidas: respostasValidas.length,
          },
        },
        message: "Tentativa enviada.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    if (resultado?.data?.aprovado === true) {
      try {
        await gerarNotificacaoDeAvaliacao(usuarioId, {
          turma_id: turmaId,
          evento_id: ctx.evento_id,
        });
      } catch (error) {
        logWarn(rid, "Falha ao gerar notificação de avaliação pós-questionário.", {
          message: error?.message || String(error),
        });
      }
    }

    logDev(rid, "enviarTentativa OK", {
      questionarioId,
      turmaId,
      usuarioId,
      nota: resultado?.data?.nota,
      aprovado: resultado?.data?.aprovado,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em enviarTentativa", error);
    return fail(res, 500, "Erro ao enviar tentativa.");
  }
}

async function obterMinhaTentativaPorTurma(req, res) {
  const rid = mkRid();

  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = getUserId(req);

    if (!questionarioId || !turmaId || !usuarioId) {
      return fail(res, 400, "Parâmetros inválidos.");
    }

    const ctx = await questionarioPertenceATurma(query, questionarioId, turmaId);

    if (!ctx) {
      return fail(res, 404, "Questionário não pertence a esta turma.");
    }

    if (!isGestorQuestionario(req)) {
      const inscrito = await usuarioEstaInscrito(query, usuarioId, turmaId);

      if (!inscrito) {
        return fail(res, 403, "Você não está inscrito nesta turma.");
      }
    }

    const result = await query(
      `
      SELECT *
      FROM tentativas_questionario
      WHERE questionario_id = $1
        AND usuario_id = $2
        AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (!result.rowCount) {
      return fail(res, 404, "Sem tentativa registrada.");
    }

    logDev(rid, "obterMinhaTentativaPorTurma OK", {
      questionarioId,
      turmaId,
      usuarioId,
      tentativaId: result.rows[0]?.id,
    });

    return ok(res, result.rows[0], "Tentativa carregada.");
  } catch (error) {
    logError(rid, "Erro em obterMinhaTentativaPorTurma", error);
    return fail(res, 500, "Erro ao obter tentativa.");
  }
}

module.exports = {
  criarOuObterRascunhoPorEvento,
  obterQuestionarioPorEvento,
  atualizarQuestionario,
  adicionarQuestao,
  atualizarQuestao,
  removerQuestao,
  adicionarAlternativa,
  atualizarAlternativa,
  removerAlternativa,
  publicarQuestionario,

  listarDisponiveisParaUsuario,
  obterQuestionarioParaResponder,
  iniciarTentativa,
  enviarTentativa,
  obterMinhaTentativaPorTurma,
};