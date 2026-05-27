/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/presencaController.js — v2.0
 * Atualizado em: 14/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo de presença.
 *
 * Contratos aplicados:
 * - Mount esperado: /api/presenca
 * - Tabela oficial: presencas
 * - Tabela oficial de inscrição: inscricoes
 * - Sem tabela inscricao
 * - Sem resolveInscricaoTable
 * - Sem compat DB paralela
 * - Sem req.usuario
 * - Sem req.userId/auth.userId
 * - Sem perfil/perfis/roles/admin como múltiplas fontes
 * - Usuário autenticado oficial: req.user.id
 * - Perfil autenticado oficial: req.user.perfil
 * - Params/body oficiais:
 *   - usuario_id
 *   - turma_id
 *   - evento_id
 *   - data_presenca
 *   - presente
 *   - token
 * - Date-only oficial: YYYY-MM-DD
 * - Sem aceitar dd/mm/yyyy como contrato paralelo
 * - Envelope oficial:
 *   - { ok, data, message }
 *   - { ok:false, message, details? }
 * - Sem respostas { erro } ou { mensagem } soltas
 * - Sem ON CONFLICT dependente de constraint não confirmada
 * - PDF oficial mantido via PDFKit
 */

const db = require("../db");
const PDFDocument = require("pdfkit");
const jwt = require("jsonwebtoken");

let gerarNotificacaoDeAvaliacao = async () => {};
try {
  ({ gerarNotificacaoDeAvaliacao } = require("./notificacaoController"));
} catch {
  gerarNotificacaoDeAvaliacao = async () => {};
}

/* ─────────────────────────────────────────────────────────────
 * DB oficial
 * ───────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  console.error("[presencaController] db.query inválido:", db);
  throw new Error("db.query deve existir em backend/src/db.js.");
}

const query = db.query.bind(db);
const pool = db.pool || null;

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";
const PRESENCA_TOKEN_SECRET = process.env.PRESENCA_TOKEN_SECRET || "";

if (!PRESENCA_TOKEN_SECRET && !IS_DEV) {
  console.warn(
    "[presencaController] PRESENCA_TOKEN_SECRET ausente em produção."
  );
}

/* ─────────────────────────────────────────────────────────────
 * Logger
 * ───────────────────────────────────────────────────────────── */

function mkRid(prefix = "PRS") {
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
 * Envelope oficial
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

async function safeRollback(q) {
  try {
    await q("ROLLBACK");
  } catch {}
}

async function withTransaction(fn) {
  if (!pool || typeof pool.connect !== "function") {
    await query("BEGIN");

    try {
      const result = await fn(query);
      await query("COMMIT");
      return result;
    } catch (error) {
      await safeRollback(query);
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    const q = client.query.bind(client);

    await q("BEGIN");

    const result = await fn(q);

    await q("COMMIT");

    return result;
  } catch (error) {
    await safeRollback(client.query.bind(client));
    throw error;
  } finally {
    client.release();
  }
}

/* ─────────────────────────────────────────────────────────────
 * Helpers gerais
 * ───────────────────────────────────────────────────────────── */

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeBool(value, fallback = null) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateOnly(value) {
  const text = normalizeText(value);
  return isDateOnly(text) ? text : "";
}

function getUserId(req) {
  return toPositiveInt(req?.user?.id);
}

function getUserPerfil(req) {
  return normalizeText(req?.user?.perfil).toLowerCase();
}

function isAdministrador(req) {
  return getUserPerfil(req) === "administrador";
}

function isGestorPresenca(req) {
  const perfil = getUserPerfil(req);
  return perfil === "administrador" || perfil === "organizador";
}

function nowSPParts() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
}

function hojeSaoPaulo() {
  const parts = nowSPParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function agoraSaoPauloComparable() {
  const parts = nowSPParts();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function dateTimeLocal(dateOnly, time = "00:00") {
  if (!isDateOnly(dateOnly)) return null;

  const hora = normalizeText(time).slice(0, 5);

  if (!/^\d{2}:\d{2}$/.test(hora)) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatarDataBR(dateOnly) {
  const value = normalizeDateOnly(dateOnly);

  if (!value) return "—";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatarDataHoraBR(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function cpfProtegido(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length !== 11) {
    return value ? String(value) : null;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.***-**`;
}

/* ─────────────────────────────────────────────────────────────
 * Helpers de turma, inscrição e organizador
 * ───────────────────────────────────────────────────────────── */

async function buscarTurma(q, turmaId) {
  const result = await q(
    `
    SELECT
      t.id,
      t.evento_id,
      t.nome,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
      to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
      to_char(t.horario_fim::time, 'HH24:MI') AS horario_fim,
      t.carga_horaria,
      e.titulo AS evento_titulo,
      e.local AS evento_local
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return result.rows?.[0] || null;
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

async function usuarioEstaInscritoNoEvento(q, usuarioId, eventoId) {
  const result = await q(
    `
    SELECT
      i.turma_id,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim
    FROM inscricoes i
    JOIN turmas t ON t.id = i.turma_id
    WHERE i.usuario_id = $1
      AND t.evento_id = $2
    ORDER BY i.id DESC
    LIMIT 1
    `,
    [usuarioId, eventoId]
  );

  return result.rows?.[0] || null;
}

async function usuarioEhorganizadorDaTurma(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT 1
    FROM turma_responsavel
    WHERE turma_id = $1
      AND organizador_id = $2
    LIMIT 1
    `,
    [turmaId, usuarioId]
  );

  return result.rowCount > 0;
}

async function usuarioPodeVerTurma(q, req, turmaId) {
  const usuarioId = getUserId(req);

  if (!usuarioId) {
    return {
      ok: false,
      status: 401,
      message: "Não autenticado.",
    };
  }

  if (isAdministrador(req)) {
    return { ok: true };
  }

  if (getUserPerfil(req) === "organizador") {
    const vinculado = await usuarioEhorganizadorDaTurma(q, usuarioId, turmaId);

    if (vinculado) {
      return { ok: true };
    }

    return {
      ok: false,
      status: 403,
      message: "Acesso negado à turma.",
      details: {
        motivo: "organizador_SEM_VINCULO",
      },
    };
  }

  const inscrito = await usuarioEstaInscrito(q, usuarioId, turmaId);

  if (inscrito) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message: "Acesso negado à turma.",
    details: {
      motivo: "USUARIO_NAO_INSCRITO",
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * Datas reais da turma
 * ───────────────────────────────────────────────────────────── */

async function obterDatasDaTurma(q, turmaId) {
  const datas = await q(
    `
    SELECT
      to_char(data::date, 'YYYY-MM-DD') AS data,
      to_char(horario_inicio::time, 'HH24:MI') AS horario_inicio,
      to_char(horario_fim::time, 'HH24:MI') AS horario_fim
    FROM datas_turma
    WHERE turma_id = $1
    ORDER BY data ASC, horario_inicio ASC
    `,
    [turmaId]
  );

  if (datas.rowCount > 0) {
    return datas.rows || [];
  }

  const turma = await q(
    `
    SELECT
      to_char(data_inicio::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(horario_inicio::time, '08:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(horario_fim::time, '23:59'::time), 'HH24:MI') AS horario_fim
    FROM turmas
    WHERE id = $1
      AND data_inicio IS NOT NULL
    LIMIT 1
    `,
    [turmaId]
  );

  return turma.rows || [];
}

async function obterDatasOnlyDaTurma(q, turmaId) {
  const datas = await obterDatasDaTurma(q, turmaId);
  return datas.map((item) => item.data).filter(Boolean);
}

async function obterDataTurma(q, turmaId, dataPresenca) {
  const datas = await obterDatasDaTurma(q, turmaId);

  return datas.find((item) => item.data === dataPresenca) || null;
}

async function obterFimRealTurma(q, turmaId) {
  const result = await q(
    `
    WITH fim_datas AS (
      SELECT
        to_char(
          dt.data::date + dt.horario_fim::time,
          'YYYY-MM-DD HH24:MI:SS'
        ) AS fim_real
      FROM datas_turma dt
      WHERE dt.turma_id = $1
      ORDER BY dt.data DESC, dt.horario_fim DESC
      LIMIT 1
    ),
    fim_turma AS (
      SELECT
        to_char(
          t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time),
          'YYYY-MM-DD HH24:MI:SS'
        ) AS fim_real
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

/* ─────────────────────────────────────────────────────────────
 * Presença
 * ───────────────────────────────────────────────────────────── */

async function gravarPresenca(q, {
  usuarioId,
  turmaId,
  dataPresenca,
  presente,
  atualizarConfirmadoEm = true,
}) {
  const update = await q(
    `
    UPDATE presencas
    SET
      presente = $4,
      confirmado_em = CASE
        WHEN $5::boolean IS TRUE THEN NOW()
        ELSE confirmado_em
      END
    WHERE usuario_id = $1
      AND turma_id = $2
      AND data_presenca = $3::date
    RETURNING
      id,
      usuario_id,
      turma_id,
      to_char(data_presenca::date, 'YYYY-MM-DD') AS data_presenca,
      presente,
      confirmado_em
    `,
    [usuarioId, turmaId, dataPresenca, presente, atualizarConfirmadoEm]
  );

  if (update.rowCount > 0) {
    return update.rows[0];
  }

  const insert = await q(
    `
    INSERT INTO presencas (
      usuario_id,
      turma_id,
      data_presenca,
      presente,
      confirmado_em
    )
    VALUES ($1, $2, $3::date, $4, NOW())
    RETURNING
      id,
      usuario_id,
      turma_id,
      to_char(data_presenca::date, 'YYYY-MM-DD') AS data_presenca,
      presente,
      confirmado_em
    `,
    [usuarioId, turmaId, dataPresenca, presente]
  );

  return insert.rows[0];
}

async function contarPresencasUsuarioTurma(q, usuarioId, turmaId) {
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

async function verificarElegibilidadeParaAvaliacao(q, usuarioId, turmaId) {
  const rid = mkRid("ELIG");

  try {
    const fimReal = await obterFimRealTurma(q, turmaId);

    if (!fimReal) {
      return {
        ok: false,
        motivo: "TURMA_SEM_FIM_REAL",
      };
    }

    const agora = agoraSaoPauloComparable();

    if (agora < fimReal) {
      return {
        ok: false,
        motivo: "TURMA_NAO_ENCERRADA",
        fim_real: fimReal,
      };
    }

    const datas = await obterDatasOnlyDaTurma(q, turmaId);
    const totalDatas = datas.length;

    if (totalDatas <= 0) {
      return {
        ok: false,
        motivo: "TURMA_SEM_DATAS",
      };
    }

    const presentes = await contarPresencasUsuarioTurma(q, usuarioId, turmaId);
    const frequencia = totalDatas > 0 ? presentes / totalDatas : 0;

    if (frequencia < 0.75) {
      return {
        ok: false,
        motivo: "FREQUENCIA_INSUFICIENTE",
        presentes,
        total_datas: totalDatas,
        frequencia,
      };
    }

    const turma = await buscarTurma(q, turmaId);

    try {
      await gerarNotificacaoDeAvaliacao(usuarioId, {
        turma_id: turmaId,
        evento_id: turma?.evento_id || null,
      });
    } catch (error) {
      logWarn(rid, "Falha ao gerar notificação de avaliação.", {
        usuario_id: usuarioId,
        turma_id: turmaId,
        erro: error?.message || String(error),
      });
    }

    return {
      ok: true,
      motivo: null,
      usuario_id: usuarioId,
      turma_id: turmaId,
      evento_id: turma?.evento_id || null,
      presentes,
      total_datas: totalDatas,
      frequencia,
      frequencia_percentual: Math.round(frequencia * 100),
    };
  } catch (error) {
    logError(rid, "Erro ao verificar elegibilidade.", error);
    return {
      ok: false,
      motivo: "ERRO_INTERNO",
    };
  }
}

/* ─────────────────────────────────────────────────────────────
 * 1) Validação pública
 * ───────────────────────────────────────────────────────────── */

async function validarPresencaPublica(req, res) {
  const rid = mkRid();

  try {
    const eventoId = toPositiveInt(req.query?.evento_id);
    const usuarioId = toPositiveInt(req.query?.usuario_id);

    if (!eventoId || !usuarioId) {
      return fail(res, 400, "evento_id e usuario_id são obrigatórios.");
    }

    const result = await query(
      `
      SELECT 1
      FROM presencas p
      JOIN turmas t ON t.id = p.turma_id
      WHERE p.usuario_id = $1
        AND t.evento_id = $2
        AND p.presente = TRUE
      LIMIT 1
      `,
      [usuarioId, eventoId]
    );

    return ok(
      res,
      {
        presente: result.rowCount > 0,
      },
      "Validação de presença realizada."
    );
  } catch (error) {
    logError(rid, "Erro em validarPresencaPublica.", error);
    return fail(res, 500, "Erro ao validar presença.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 2) Usuário autenticado
 * ───────────────────────────────────────────────────────────── */

async function registrarPresenca(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = getUserId(req);
    const turmaId = toPositiveInt(req.body?.turma_id);
    const dataPresenca = normalizeDateOnly(
      req.body?.data_presenca || hojeSaoPaulo()
    );

    if (!usuarioId) return fail(res, 401, "Não autenticado.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");
    if (!dataPresenca) {
      return fail(res, 400, "data_presenca deve estar no formato YYYY-MM-DD.");
    }

    const resultado = await withTransaction(async (q) => {
      const turma = await buscarTurma(q, turmaId);

      if (!turma) {
        return {
          status: 404,
          error: true,
          message: "Turma não encontrada.",
        };
      }

      const inscrito = await usuarioEstaInscrito(q, usuarioId, turmaId);

      if (!inscrito) {
        return {
          status: 403,
          error: true,
          message: "Você não está inscrito nesta turma.",
        };
      }

      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Data fora das datas válidas da turma.",
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente: true,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 201,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença registrada com sucesso.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "registrarPresenca OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      data_presenca: dataPresenca,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em registrarPresenca.", error);
    return fail(res, 500, "Erro ao registrar presença.");
  }
}

async function confirmarPresencaViaQR(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = getUserId(req);
    const turmaId = toPositiveInt(req.body?.turma_id || req.params?.turma_id);
    const dataPresenca = hojeSaoPaulo();

    if (!usuarioId) return fail(res, 401, "Não autenticado.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");

    const resultado = await withTransaction(async (q) => {
      const turma = await buscarTurma(q, turmaId);

      if (!turma) {
        return {
          status: 404,
          error: true,
          message: "Turma não encontrada.",
        };
      }

      const inscrito = await usuarioEstaInscrito(q, usuarioId, turmaId);

      if (!inscrito) {
        return {
          status: 403,
          error: true,
          message: "Você não está inscrito nesta turma.",
        };
      }

      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Hoje não é uma data válida desta turma.",
        };
      }

      const inicio = dateTimeLocal(dataPresenca, dataTurma.horario_inicio);
      const permitidoDesde = new Date(inicio.getTime() - 30 * 60 * 1000);

      if (new Date() < permitidoDesde) {
        return {
          status: 409,
          error: true,
          message: `Confirmação disponível a partir de 30 minutos antes do início (${dataTurma.horario_inicio}).`,
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente: true,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 201,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença confirmada com sucesso.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "confirmarPresencaViaQR OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em confirmarPresencaViaQR.", error);
    return fail(res, 500, "Erro ao confirmar presença via QR.");
  }
}

async function confirmarPresencaViaToken(req, res) {
  const rid = mkRid();

  try {
    const token = normalizeText(req.body?.token);

    if (!token) {
      return fail(res, 400, "token é obrigatório.");
    }

    if (!PRESENCA_TOKEN_SECRET) {
      return fail(res, 500, "Configuração de token de presença indisponível.");
    }

    let payload;
    try {
      payload = jwt.verify(token, PRESENCA_TOKEN_SECRET);
    } catch {
      return fail(res, 400, "Token inválido ou expirado.");
    }

    const usuarioId = toPositiveInt(payload.usuario_id || payload.usuarioId || getUserId(req));
    const turmaId = toPositiveInt(payload.turma_id || payload.turmaId);
    const dataPresenca = normalizeDateOnly(payload.data_presenca || hojeSaoPaulo());

    if (!usuarioId) return fail(res, 401, "Não autenticado.");
    if (!turmaId) return fail(res, 400, "Token sem turma_id válido.");
    if (!dataPresenca) {
      return fail(res, 400, "Token sem data_presenca válida.");
    }

    const resultado = await withTransaction(async (q) => {
      const turma = await buscarTurma(q, turmaId);

      if (!turma) {
        return {
          status: 404,
          error: true,
          message: "Turma não encontrada.",
        };
      }

      const inscrito = await usuarioEstaInscrito(q, usuarioId, turmaId);

      if (!inscrito) {
        return {
          status: 403,
          error: true,
          message: "Usuário não inscrito nesta turma.",
        };
      }

      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Data fora das datas válidas da turma.",
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente: true,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 201,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença confirmada por token.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "confirmarPresencaViaToken OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      data_presenca: dataPresenca,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em confirmarPresencaViaToken.", error);
    return fail(res, 500, "Erro ao confirmar presença por token.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 3) Gestão manual
 * ───────────────────────────────────────────────────────────── */

async function registrarPresencaManual(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = toPositiveInt(req.body?.usuario_id);
    const turmaId = toPositiveInt(req.body?.turma_id);
    const dataPresenca = normalizeDateOnly(req.body?.data_presenca);
    const presente = normalizeBool(req.body?.presente, false);

    if (!usuarioId) return fail(res, 400, "usuario_id é obrigatório.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");
    if (!dataPresenca) {
      return fail(res, 400, "data_presenca deve estar no formato YYYY-MM-DD.");
    }

    const resultado = await withTransaction(async (q) => {
      const turma = await buscarTurma(q, turmaId);

      if (!turma) {
        return {
          status: 404,
          error: true,
          message: "Turma não encontrada.",
        };
      }

      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Data fora das datas válidas da turma.",
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente,
        atualizarConfirmadoEm: presente,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 201,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença manual registrada.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "registrarPresencaManual OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      data_presenca: dataPresenca,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em registrarPresencaManual.", error);
    return fail(res, 500, "Erro ao registrar presença manual.");
  }
}

async function confirmarPresencaManualHoje(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = toPositiveInt(req.body?.usuario_id);
    const turmaId = toPositiveInt(req.body?.turma_id);
    const dataPresenca = hojeSaoPaulo();

    if (!usuarioId) return fail(res, 400, "usuario_id é obrigatório.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");

    const resultado = await withTransaction(async (q) => {
      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Hoje não é uma data válida desta turma.",
        };
      }

      const inicio = dateTimeLocal(dataPresenca, dataTurma.horario_inicio);
      const permitidoDesde = new Date(inicio.getTime() - 30 * 60 * 1000);

      if (new Date() < permitidoDesde) {
        return {
          status: 409,
          error: true,
          message: `Confirmação disponível a partir de 30 minutos antes do início (${dataTurma.horario_inicio}).`,
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente: true,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 201,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença de hoje confirmada manualmente.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "confirmarPresencaManualHoje OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em confirmarPresencaManualHoje.", error);
    return fail(res, 500, "Erro ao confirmar presença manual de hoje.");
  }
}

async function validarPresencaManual(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = toPositiveInt(req.body?.usuario_id);
    const turmaId = toPositiveInt(req.body?.turma_id);
    const dataPresenca = normalizeDateOnly(req.body?.data_presenca);
    const presente = normalizeBool(req.body?.presente, true);

    if (!usuarioId) return fail(res, 400, "usuario_id é obrigatório.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");
    if (!dataPresenca) {
      return fail(res, 400, "data_presenca deve estar no formato YYYY-MM-DD.");
    }

    const resultado = await withTransaction(async (q) => {
      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente,
        atualizarConfirmadoEm: presente,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 200,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença validada.",
      };
    });

    logDev(rid, "validarPresencaManual OK", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      data_presenca: dataPresenca,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em validarPresencaManual.", error);
    return fail(res, 500, "Erro ao validar presença.");
  }
}

async function confirmarPresencaorganizador(req, res) {
  const rid = mkRid();

  try {
    const organizadorId = getUserId(req);
    const usuarioId = toPositiveInt(req.body?.usuario_id);
    const turmaId = toPositiveInt(req.body?.turma_id);
    const dataPresenca = normalizeDateOnly(req.body?.data_presenca);

    if (!organizadorId) return fail(res, 401, "Não autenticado.");
    if (!usuarioId) return fail(res, 400, "usuario_id é obrigatório.");
    if (!turmaId) return fail(res, 400, "turma_id é obrigatório.");
    if (!dataPresenca) {
      return fail(res, 400, "data_presenca deve estar no formato YYYY-MM-DD.");
    }

    const resultado = await withTransaction(async (q) => {
      if (!isAdministrador(req)) {
        const vinculado = await usuarioEhorganizadorDaTurma(q, organizadorId, turmaId);

        if (!vinculado) {
          return {
            status: 403,
            error: true,
            message: "Você não é organizador desta turma.",
          };
        }
      }

      const dataTurma = await obterDataTurma(q, turmaId, dataPresenca);

      if (!dataTurma) {
        return {
          status: 409,
          error: true,
          message: "Data fora das datas válidas da turma.",
        };
      }

      const fimAula = dateTimeLocal(dataPresenca, dataTurma.horario_fim);
      const limite = new Date(fimAula.getTime() + 48 * 60 * 60 * 1000);

      if (new Date() > limite) {
        return {
          status: 403,
          error: true,
          message: "O prazo de 48h para confirmação já expirou.",
        };
      }

      const presenca = await gravarPresenca(q, {
        usuarioId,
        turmaId,
        dataPresenca,
        presente: true,
      });

      const elegibilidade = await verificarElegibilidadeParaAvaliacao(
        q,
        usuarioId,
        turmaId
      );

      return {
        status: 200,
        data: {
          presenca,
          elegibilidade_avaliacao: elegibilidade,
        },
        message: "Presença confirmada pelo organizador.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "confirmarPresencaorganizador OK", {
      organizador_id: organizadorId,
      usuario_id: usuarioId,
      turma_id: turmaId,
      data_presenca: dataPresenca,
    });

    return ok(res, resultado.data, resultado.message, resultado.status);
  } catch (error) {
    logError(rid, "Erro em confirmarPresencaorganizador.", error);
    return fail(res, 500, "Erro ao confirmar presença pelo organizador.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 4) Listagens e relatórios
 * ───────────────────────────────────────────────────────────── */

async function listarTurmasDoorganizador(req, res) {
  const rid = mkRid();

  try {
    const organizadorId = getUserId(req);
    const statusFiltro = normalizeText(req.query?.status || "todos").toLowerCase();

    if (!organizadorId) {
      return fail(res, 401, "Não autenticado.");
    }

    const result = await query(
      `
      WITH base AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento_titulo,
          t.id AS turma_id,
          COALESCE(t.nome, 'Turma') AS turma_nome,
          to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
          to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim::time, 'HH24:MI') AS horario_fim,
          COALESCE((
            SELECT COUNT(*)::int
            FROM inscricoes i
            WHERE i.turma_id = t.id
          ), 0)::int AS inscritos_total,
          (NOW() AT TIME ZONE $2)::timestamp AS agora_sp,
          (t.data_inicio::date + COALESCE(t.horario_inicio::time, '00:00'::time))::timestamp AS inicio_ts,
          (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))::timestamp AS fim_ts
        FROM turma_responsavel ti
        JOIN turmas t ON t.id = ti.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE ti.organizador_id = $1
      )
      SELECT *
      FROM base
      ORDER BY data_inicio DESC, turma_id DESC
      `,
      [organizadorId, TZ]
    );

    const turmas = (result.rows || []).map((row) => {
      let status = "programado";

      if (row.agora_sp >= row.inicio_ts && row.agora_sp <= row.fim_ts) {
        status = "andamento";
      }

      if (row.agora_sp > row.fim_ts) {
        status = "encerrado";
      }

      return {
        evento_id: Number(row.evento_id),
        evento_titulo: row.evento_titulo,
        turma_id: Number(row.turma_id),
        turma_nome: row.turma_nome,
        periodo: {
          data_inicio: row.data_inicio,
          horario_inicio: row.horario_inicio,
          data_fim: row.data_fim,
          horario_fim: row.horario_fim,
        },
        status,
        inscritos_total: Number(row.inscritos_total || 0),
      };
    });

    const filtradas =
      statusFiltro === "programado" ||
      statusFiltro === "andamento" ||
      statusFiltro === "encerrado"
        ? turmas.filter((turma) => turma.status === statusFiltro)
        : turmas;

    logDev(rid, "listarTurmasDoorganizador OK", {
      organizador_id: organizadorId,
      total: turmas.length,
      filtradas: filtradas.length,
    });

    return ok(
      res,
      {
        organizador_id: organizadorId,
        total_turmas: turmas.length,
        status_filtro: statusFiltro,
        turmas: filtradas,
      },
      "Turmas do organizador carregadas."
    );
  } catch (error) {
    logError(rid, "Erro em listarTurmasDoorganizador.", error);
    return fail(res, 500, "Erro ao listar turmas do organizador.");
  }
}

async function obterDetalhesTurma(req, res) {
  const rid = mkRid();

  try {
    const turmaId = toPositiveInt(req.params?.turma_id);
    const usuarioId = getUserId(req);

    if (!turmaId) return fail(res, 400, "turma_id inválido.");
    if (!usuarioId) return fail(res, 401, "Não autenticado.");

    const acesso = await usuarioPodeVerTurma(query, req, turmaId);

    if (!acesso.ok) {
      return fail(res, acesso.status, acesso.message, acesso.details);
    }

    const turma = await buscarTurma(query, turmaId);

    if (!turma) {
      return fail(res, 404, "Turma não encontrada.");
    }

    const datas = await obterDatasOnlyDaTurma(query, turmaId);

    if (!isGestorPresenca(req)) {
      const presencas = await query(
        `
        SELECT
          to_char(data_presenca::date, 'YYYY-MM-DD') AS data_presenca,
          presente,
          confirmado_em
        FROM presencas
        WHERE turma_id = $1
          AND usuario_id = $2
        ORDER BY data_presenca ASC
        `,
        [turmaId, usuarioId]
      );

      return ok(
        res,
        {
          turma_id: turmaId,
          evento_id: turma.evento_id,
          datas,
          minhas_presencas: presencas.rows || [],
        },
        "Presenças da turma carregadas."
      );
    }

    const inscritos = await query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        u.email
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const presencas = await query(
      `
      SELECT
        usuario_id,
        to_char(data_presenca::date, 'YYYY-MM-DD') AS data_presenca,
        presente,
        confirmado_em
      FROM presencas
      WHERE turma_id = $1
      ORDER BY usuario_id ASC, data_presenca ASC
      `,
      [turmaId]
    );

    const presencaMap = new Map();

    for (const item of presencas.rows || []) {
      presencaMap.set(`${item.usuario_id}|${item.data_presenca}`, item);
    }

    const usuarios = (inscritos.rows || []).map((usuario) => {
      const presentes = [];

      const presencasPorData = datas.map((data) => {
        const item = presencaMap.get(`${usuario.usuario_id}|${data}`);
        const presente = item?.presente === true;

        if (presente) {
          presentes.push(data);
        }

        return {
          data,
          presente,
          confirmado_em: item?.confirmado_em || null,
        };
      });

      return {
        id: usuario.usuario_id,
        usuario_id: usuario.usuario_id,
        nome: usuario.nome,
        cpf_protegido: cpfProtegido(usuario.cpf),
        email: usuario.email || null,
        presencas: presencasPorData,
        datas_presentes: presentes,
        datas_ausencias: datas.filter((data) => !presentes.includes(data)),
      };
    });

    logDev(rid, "obterDetalhesTurma OK", {
      turma_id: turmaId,
      usuarios: usuarios.length,
    });

    return ok(
      res,
      {
        turma_id: turmaId,
        evento_id: turma.evento_id,
        datas,
        usuarios,
      },
      "Detalhes de presença da turma carregados."
    );
  } catch (error) {
    logError(rid, "Erro em obterDetalhesTurma.", error);
    return fail(res, 500, "Erro ao carregar detalhes de presença.");
  }
}

async function listarFrequenciasPorTurma(req, res) {
  const rid = mkRid();

  try {
    const turmaId = toPositiveInt(req.params?.turma_id);

    if (!turmaId) {
      return fail(res, 400, "turma_id inválido.");
    }

    const datas = await obterDatasOnlyDaTurma(query, turmaId);

    if (!datas.length) {
      return fail(res, 409, "Turma sem datas válidas.");
    }

    const inscritos = await query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const presencas = await query(
      `
      SELECT
        usuario_id,
        COUNT(DISTINCT data_presenca)::int AS presentes
      FROM presencas
      WHERE turma_id = $1
        AND presente = TRUE
      GROUP BY usuario_id
      `,
      [turmaId]
    );

    const mapa = new Map(
      (presencas.rows || []).map((row) => [
        Number(row.usuario_id),
        Number(row.presentes || 0),
      ])
    );

    const total = datas.length;

    const lista = (inscritos.rows || []).map((usuario) => {
      const presentes = mapa.get(Number(usuario.usuario_id)) || 0;
      const frequenciaDecimal = total > 0 ? presentes / total : 0;
      const frequenciaPercentual = Math.round(frequenciaDecimal * 100);

      return {
        usuario_id: usuario.usuario_id,
        nome: usuario.nome,
        cpf_protegido: cpfProtegido(usuario.cpf),
        total_encontros: total,
        presentes,
        ausencias: Math.max(0, total - presentes),
        frequencia_num: frequenciaPercentual,
        frequencia: `${frequenciaPercentual}%`,
        atingiu_frequencia_minima: frequenciaDecimal >= 0.75,
      };
    });

    logDev(rid, "listarFrequenciasPorTurma OK", {
      turma_id: turmaId,
      total: lista.length,
    });

    return ok(res, lista, "Frequências da turma carregadas.");
  } catch (error) {
    logError(rid, "Erro em listarFrequenciasPorTurma.", error);
    return fail(res, 500, "Erro ao listar frequências da turma.");
  }
}

async function exportarPresencasPdfPorTurma(req, res) {
  const rid = mkRid();

  try {
    const turmaId = toPositiveInt(req.params?.turma_id);

    if (!turmaId) {
      return fail(res, 400, "turma_id inválido.");
    }

    const turma = await buscarTurma(query, turmaId);

    if (!turma) {
      return fail(res, 404, "Turma não encontrada.");
    }

    const datas = await obterDatasDaTurma(query, turmaId);

    if (!datas.length) {
      return fail(res, 409, "Turma sem datas válidas para exportação.");
    }

    const inscritos = await query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const presencas = await query(
      `
      SELECT
        usuario_id,
        to_char(data_presenca::date, 'YYYY-MM-DD') AS data_presenca,
        presente,
        confirmado_em
      FROM presencas
      WHERE turma_id = $1
      ORDER BY usuario_id ASC, data_presenca ASC
      `,
      [turmaId]
    );

    const presencaMap = new Map();

    for (const item of presencas.rows || []) {
      presencaMap.set(`${item.usuario_id}|${item.data_presenca}`, item);
    }

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      info: {
        Title: `Lista de Presença - Turma ${turmaId}`,
        Author: "Plataforma Escola da Saúde",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="lista_presenca_turma_${turmaId}.pdf"`
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;

    function drawHeader() {
      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("LISTA DE PRESENÇA", margin, 24, {
          width: contentWidth,
          align: "center",
        });

      doc
        .moveTo(margin, 52)
        .lineTo(pageWidth - margin, 52)
        .lineWidth(1.5)
        .strokeColor("#0f766e")
        .stroke();

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`Evento: ${turma.evento_titulo || "—"}`, margin, 64, {
          width: contentWidth,
        });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#334155")
        .text(`Turma: ${turma.nome || "—"}`, margin, 82, { width: 360 })
        .text(
          `Período: ${formatarDataBR(turma.data_inicio)} a ${formatarDataBR(
            turma.data_fim
          )}`,
          margin + 365,
          82,
          { width: 210 }
        )
        .text(
          `Horário: ${turma.horario_inicio || "—"} às ${turma.horario_fim || "—"}`,
          margin + 580,
          82,
          { width: 160 }
        );

      if (turma.evento_local) {
        doc.text(`Local: ${turma.evento_local}`, margin, 98, {
          width: contentWidth,
        });
      }

      doc
        .fillColor("#64748b")
        .fontSize(9)
        .text(`Gerado em: ${formatarDataHoraBR(new Date())}`, margin, 112, {
          width: contentWidth,
          align: "right",
        });
    }

    function ensureSpace(y, needed = 40) {
      if (y + needed <= pageHeight - margin) return y;

      doc.addPage({
        size: "A4",
        layout: "landscape",
        margin,
      });

      drawHeader();
      return 132;
    }

    function drawTableHeader(y) {
      doc
        .save()
        .roundedRect(margin, y, contentWidth, 24, 8)
        .fill("#0f766e")
        .restore();

      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);

      const cols = [230, 110, 100, 170, contentWidth - 610];
      let x = margin + 8;

      ["Nome", "CPF", "Situação", "Confirmação", "Assinatura"].forEach(
        (label, index) => {
          doc.text(label, x, y + 7, {
            width: cols[index] - 12,
            ellipsis: true,
          });

          x += cols[index];
        }
      );

      return y + 30;
    }

    drawHeader();

    let y = 132;

    for (const dataTurma of datas) {
      y = ensureSpace(y, 48);

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(
          `Data da aula: ${formatarDataBR(
            dataTurma.data
          )} • Horário previsto: ${dataTurma.horario_inicio} às ${
            dataTurma.horario_fim
          }`,
          margin,
          y,
          { width: contentWidth }
        );

      y += 22;
      y = drawTableHeader(y);

      for (const inscrito of inscritos.rows || []) {
        y = ensureSpace(y, 28);

        const key = `${inscrito.usuario_id}|${dataTurma.data}`;
        const presenca = presencaMap.get(key);
        const presente = presenca?.presente === true;

        const status = presente ? "Presente" : "Ausente";
        const confirmacao = presente
          ? formatarDataHoraBR(presenca?.confirmado_em)
          : "—";
        const assinatura = presente ? "—" : "__________________________________";

        doc
          .save()
          .roundedRect(margin, y - 3, contentWidth, 24, 6)
          .fill(y % 2 === 0 ? "#f8fafc" : "#ffffff")
          .restore();

        doc.font("Helvetica").fontSize(9).fillColor("#0f172a");

        const cols = [230, 110, 100, 170, contentWidth - 610];
        let x = margin + 8;

        doc.text(inscrito.nome || "—", x, y + 5, {
          width: cols[0] - 12,
          ellipsis: true,
        });

        x += cols[0];

        doc.text(cpfProtegido(inscrito.cpf) || "—", x, y + 5, {
          width: cols[1] - 12,
          ellipsis: true,
        });

        x += cols[1];

        doc
          .fillColor(presente ? "#166534" : "#991b1b")
          .font("Helvetica-Bold")
          .text(status, x, y + 5, {
            width: cols[2] - 12,
            ellipsis: true,
          });

        x += cols[2];

        doc
          .fillColor("#0f172a")
          .font("Helvetica")
          .text(confirmacao, x, y + 5, {
            width: cols[3] - 12,
            ellipsis: true,
          });

        x += cols[3];

        doc.text(assinatura, x, y + 5, {
          width: cols[4] - 12,
          ellipsis: true,
        });

        y += 28;
      }

      y += 10;
    }

    doc.end();

    logDev(rid, "exportarPresencasPdfPorTurma OK", {
      turma_id: turmaId,
    });
  } catch (error) {
    logError(rid, "Erro em exportarPresencasPdfPorTurma.", error);

    if (!res.headersSent) {
      return fail(res, 500, "Erro ao gerar relatório em PDF.");
    }

    return undefined;
  }
}

async function listarTodasPresencasParaAdmin(_req, res) {
  const rid = mkRid();

  try {
    const result = await query(
      `
      SELECT
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim::time, 'HH24:MI') AS horario_fim,
        COUNT(i.id)::int AS inscritos_total
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN inscricoes i ON i.turma_id = t.id
      GROUP BY
        e.id,
        e.titulo,
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim
      ORDER BY e.titulo ASC, t.data_inicio ASC, t.id ASC
      `
    );

    const eventosMap = new Map();

    for (const row of result.rows || []) {
      if (!eventosMap.has(row.evento_id)) {
        eventosMap.set(row.evento_id, {
          evento_id: row.evento_id,
          titulo: row.evento_titulo,
          turmas: [],
        });
      }

      eventosMap.get(row.evento_id).turmas.push({
        id: row.turma_id,
        turma_id: row.turma_id,
        nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        horario_inicio: row.horario_inicio,
        horario_fim: row.horario_fim,
        inscritos_total: Number(row.inscritos_total || 0),
      });
    }

    logDev(rid, "listarTodasPresencasParaAdmin OK", {
      eventos: eventosMap.size,
    });

    return ok(
      res,
      {
        eventos: Array.from(eventosMap.values()),
      },
      "Presenças administrativas carregadas."
    );
  } catch (error) {
    logError(rid, "Erro em listarTodasPresencasParaAdmin.", error);
    return fail(res, 500, "Erro ao listar presenças administrativas.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * 5) Minhas presenças
 * ───────────────────────────────────────────────────────────── */

async function obterMeuResumoPresencas(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = getUserId(req);

    if (!usuarioId) {
      return fail(res, 401, "Não autenticado.");
    }

    const result = await query(
      `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        SELECT
          mt.turma_id,
          dt.data::date AS data_presenca
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        SELECT
          mt.turma_id,
          t.data_inicio::date AS data_presenca
        FROM minhas_turmas mt
        JOIN turmas t ON t.id = mt.turma_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM datas_turma dt
          WHERE dt.turma_id = mt.turma_id
        )
      ),
      pres AS (
        SELECT
          turma_id,
          data_presenca::date AS data_presenca,
          BOOL_OR(presente) AS presente
        FROM presencas
        WHERE usuario_id = $1
        GROUP BY turma_id, data_presenca::date
      )
      SELECT
        COUNT(*) FILTER (
          WHERE db.data_presenca <= CURRENT_DATE
            AND p.presente IS TRUE
        )::int AS presencas_total,
        COUNT(*) FILTER (
          WHERE db.data_presenca <= CURRENT_DATE
            AND COALESCE(p.presente, FALSE) IS NOT TRUE
        )::int AS faltas_total
      FROM datas_base db
      LEFT JOIN pres p
        ON p.turma_id = db.turma_id
       AND p.data_presenca = db.data_presenca
      `,
      [usuarioId]
    );

    return ok(
      res,
      {
        presencas_total: Number(result.rows?.[0]?.presencas_total || 0),
        faltas_total: Number(result.rows?.[0]?.faltas_total || 0),
      },
      "Resumo de presenças carregado."
    );
  } catch (error) {
    logError(rid, "Erro em obterMeuResumoPresencas.", error);
    return fail(res, 500, "Erro ao carregar resumo de presenças.");
  }
}

async function listarMinhasPresencas(req, res) {
  const rid = mkRid();

  try {
    const usuarioId = getUserId(req);

    if (!usuarioId) {
      return fail(res, 401, "Não autenticado.");
    }

    const result = await query(
      `
      WITH base AS (
        SELECT
          t.id AS turma_id,
          e.id AS evento_id,
          COALESCE(e.titulo, 'Evento') AS evento_titulo,
          COALESCE(t.nome, 'Turma') AS turma_nome,
          to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
          to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim::time, 'HH24:MI') AS horario_fim,
          (t.data_inicio::date + COALESCE(t.horario_inicio::time, '00:00'::time))::timestamp AS inicio_ts,
          (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))::timestamp AS fim_ts,
          COALESCE((
            SELECT COUNT(*)::int
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
          ), 0) AS total_encontros_datas_turma,
          COALESCE(SUM(CASE WHEN p.presente IS TRUE THEN 1 ELSE 0 END), 0)::int AS presentes_usuario,
          COALESCE(SUM(CASE WHEN p.presente IS FALSE THEN 1 ELSE 0 END), 0)::int AS ausencias_usuario,
          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.data_presenca IS NOT NULL THEN to_char(p.data_presenca::date, 'YYYY-MM-DD') END),
              NULL
            ),
            '{}'
          ) AS datas_registradas,
          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.presente IS TRUE THEN to_char(p.data_presenca::date, 'YYYY-MM-DD') END),
              NULL
            ),
            '{}'
          ) AS datas_presentes,
          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.presente IS FALSE THEN to_char(p.data_presenca::date, 'YYYY-MM-DD') END),
              NULL
            ),
            '{}'
          ) AS datas_ausencias,
          (NOW() AT TIME ZONE $2)::timestamp AS agora_sp
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        JOIN eventos e ON e.id = t.evento_id
        LEFT JOIN presencas p
          ON p.usuario_id = i.usuario_id
         AND p.turma_id = t.id
        WHERE i.usuario_id = $1
        GROUP BY
          t.id,
          e.id,
          e.titulo,
          t.nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim
      )
      SELECT *
      FROM base
      ORDER BY data_inicio DESC, turma_id DESC
      `,
      [usuarioId, TZ]
    );

    const turmas = (result.rows || []).map((row) => {
      const totalDatas = Number(row.total_encontros_datas_turma || 0);
      const totalEncontros = totalDatas > 0 ? totalDatas : 1;
      const presentes = Number(row.presentes_usuario || 0);
      const ausencias = Number(row.ausencias_usuario || 0);

      let status = "programado";

      if (row.agora_sp >= row.inicio_ts && row.agora_sp <= row.fim_ts) {
        status = "andamento";
      }

      if (row.agora_sp > row.fim_ts) {
        status = "encerrado";
      }

      const frequenciaDecimal =
        totalEncontros > 0 ? presentes / totalEncontros : 0;
      const frequencia = Math.round(frequenciaDecimal * 1000) / 10;

      return {
        evento_id: Number(row.evento_id),
        evento_titulo: row.evento_titulo,
        turma_id: Number(row.turma_id),
        turma_nome: row.turma_nome,
        periodo: {
          data_inicio: row.data_inicio,
          horario_inicio: row.horario_inicio,
          data_fim: row.data_fim,
          horario_fim: row.horario_fim,
        },
        status,
        total_encontros: totalEncontros,
        presentes,
        ausencias,
        pre_elegivel_avaliacao:
          status === "encerrado" && frequenciaDecimal >= 0.75,
        frequencia,
        datas: {
          registradas: Array.isArray(row.datas_registradas)
            ? row.datas_registradas
            : [],
          presentes: Array.isArray(row.datas_presentes)
            ? row.datas_presentes
            : [],
          ausencias: Array.isArray(row.datas_ausencias)
            ? row.datas_ausencias
            : [],
        },
      };
    });

    logDev(rid, "listarMinhasPresencas OK", {
      usuario_id: usuarioId,
      total: turmas.length,
    });

    return ok(
      res,
      {
        usuario_id: usuarioId,
        total_turmas: turmas.length,
        turmas,
      },
      "Minhas presenças carregadas."
    );
  } catch (error) {
    logError(rid, "Erro em listarMinhasPresencas.", error);
    return fail(res, 500, "Erro ao listar presenças do usuário.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * Exports oficiais
 * ───────────────────────────────────────────────────────────── */

module.exports = {
  validarPresencaPublica,

  listarMinhasPresencas,
  obterMeuResumoPresencas,

  registrarPresenca,
  confirmarPresencaViaQR,
  confirmarPresencaViaToken,

  registrarPresencaManual,
  confirmarPresencaManualHoje,
  validarPresencaManual,
  confirmarPresencaorganizador,

  listarTurmasDoorganizador,
  obterDetalhesTurma,
  listarFrequenciasPorTurma,
  exportarPresencasPdfPorTurma,
  listarTodasPresencasParaAdmin,
};