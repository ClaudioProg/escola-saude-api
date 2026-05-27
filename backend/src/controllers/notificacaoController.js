/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/notificacaoController.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Criar notificações.
 * - Listar notificações do usuário autenticado.
 * - Gerar resumo para badge/dashboard.
 * - Contar notificações não lidas.
 * - Marcar uma notificação como lida.
 * - Marcar todas as notificações como lidas.
 * - Gerar notificações de avaliação, certificado, reserva e submissão.
 *
 * Contrato oficial:
 * - Tabela: notificacoes
 * - Colunas oficiais:
 *   - id
 *   - usuario_id
 *   - tipo
 *   - titulo
 *   - mensagem
 *   - lida
 *   - criado_em
 *   - turma_id
 *   - evento_id
 *   - reserva_id
 *   - link
 *   - metadata
 *
 * Query oficial:
 * - apenas_nao_lida
 * - tipo
 * - limite
 * - deslocamento
 *
 * Padrão:
 * - Sem aliases.
 * - Sem fallback de DB.
 * - Sem descoberta dinâmica de colunas.
 * - Sem fallback notificacao/notificacoes.
 * - Sem fallback inscricao/inscricoes.
 * - Sem array puro como resposta de controller HTTP.
 * - Respostas ok/data/meta/code/message.
 */

const db = require("../db");
const { buscarAvaliacaoPendentes } = require("../services/avaliacaoService");

/* ─────────────────────────────────────────────────────────────
   Contrato obrigatório
────────────────────────────────────────────────────────────── */

if (
  !db ||
  typeof db.query !== "function" ||
  typeof db.oneOrNone !== "function" ||
  typeof db.one !== "function" ||
  typeof db.result !== "function"
) {
  throw new Error(
    "[notificacaoController] db deve exportar query(), oneOrNone(), one() e result()."
  );
}

if (typeof buscarAvaliacaoPendentes !== "function") {
  throw new Error(
    "[notificacaoController] buscarAvaliacaoPendentes deve ser uma função."
  );
}

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const TIPOS_NOTIFICACAO_OFICIAIS = new Set([
  "sistema",
  "aviso",
  "evento",
  "avaliacao",
  "certificado",
  "evento_lembrete_inicio",
  "inscricao",
  "reserva_aprovada",
  "reserva_rejeitada",
  "sala_confirmacao_uso",
  "submissao",
]);

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

/* ─────────────────────────────────────────────────────────────
   Helpers de resposta/log
────────────────────────────────────────────────────────────── */

function respostaOk(res, status, data = {}, extra = {}) {
  return res.status(status).json({
    ok: true,
    data,
    ...extra,
  });
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function logErro(scope, error, extra = {}) {
  console.error(`[notificacaoController.${scope}] ERRO`, {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    stack: error?.stack,
    ...extra,
  });
}

/* ─────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function criarErroNotificacao(message, code, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function getUsuarioId(req) {
  const id = Number(req?.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function exigirUsuarioId(req, res) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    respostaErro(
      res,
      401,
      "NOTIFICACAO-401-NAO-AUTENTICADO",
      "Usuário não autenticado."
    );

    return null;
  }

  return usuarioId;
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function toNonNegativeInt(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) return fallback;

  return number;
}

function toLimit(value) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) return LIMITE_PADRAO;

  return Math.min(number, LIMITE_MAXIMO);
}

function normalizeText(value, { max = 500, required = false } = {}) {
  const text = String(value ?? "").trim();

  if (!text) {
    if (required) {
      throw criarErroNotificacao(
        "Campo textual obrigatório ausente.",
        "NOTIFICACAO-400-TEXTO-OBRIGATORIO"
      );
    }

    return null;
  }

  return text.length > max ? text.slice(0, max) : text;
}

function normalizeTipo(value) {
  const tipo = String(value || "").trim().toLowerCase();

  if (!tipo) {
    return null;
  }

  if (!TIPOS_NOTIFICACAO_OFICIAIS.has(tipo)) {
    throw criarErroNotificacao(
      `Tipo de notificação inválido: ${tipo}.`,
      "NOTIFICACAO-400-TIPO-INVALIDO",
      { tipo }
    );
  }

  return tipo;
}

function normalizeBooleanQuery(value) {
  const text = String(value ?? "").trim().toLowerCase();

  return text === "1" || text === "true";
}

function formatarDataBrFromYmd(value) {
  const ymd = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";

  const [year, month, day] = ymd.split("-");

  return `${day}/${month}/${year}`;
}

function formatarDataBr(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatarDataBrFromYmd(value);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return formatter.format(date);
}

function formatSalaLabel(sala) {
  const value = String(sala || "").trim();

  if (value === "auditorio") return "Auditório";
  if (value === "sala_reuniao") return "Sala de Reunião";

  return value || "Sala";
}

function formatPeriodoLabel(periodo) {
  const value = String(periodo || "").trim();

  if (value === "manha") return "Manhã";
  if (value === "tarde") return "Tarde";
  if (value === "integral") return "Integral";

  return value || "Período";
}

function parseListQuery(query = {}) {
  const apenas_nao_lida = normalizeBooleanQuery(query.apenas_nao_lida);
  const tipo = query.tipo ? normalizeTipo(query.tipo) : null;
  const limite = toLimit(query.limite);
  const deslocamento = toNonNegativeInt(query.deslocamento, 0);

  return {
    apenas_nao_lida,
    tipo,
    limite,
    deslocamento,
  };
}

function getErrorStatus(error) {
  const code = String(error?.code || "");

  if (code.includes("-400-")) return 400;
  if (code.includes("-404-")) return 404;

  return 500;
}

function mapNotificacao(row = {}) {
  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensagem: row.mensagem,
    lida: row.lida === true,
    criado_em: row.criado_em,
    turma_id: row.turma_id ?? null,
    evento_id: row.evento_id ?? null,
    reserva_id: row.reserva_id ?? null,
    link: row.link ?? null,
    metadata: row.metadata ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────
   Idempotência
────────────────────────────────────────────────────────────── */

async function existeNotificacaoDuplicada({
  usuario_id,
  tipo,
  turma_id = null,
  evento_id = null,
  reserva_id = null,
  somente_nao_lida = true,
}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return false;

  const tipoNormalizado = normalizeTipo(tipo);

  const rows = await db.query(
    `
    SELECT 1
    FROM notificacoes
    WHERE usuario_id = $1
      AND tipo = $2
      AND ($3::int IS NULL OR turma_id = $3)
      AND ($4::int IS NULL OR evento_id = $4)
      AND ($5::int IS NULL OR reserva_id = $5)
      AND ($6::boolean IS FALSE OR lida = false)
    LIMIT 1
    `,
    [
      usuarioId,
      tipoNormalizado,
      turma_id ? Number(turma_id) : null,
      evento_id ? Number(evento_id) : null,
      reserva_id ? Number(reserva_id) : null,
      Boolean(somente_nao_lida),
    ]
  );

  return rows.length > 0;
}

/* ─────────────────────────────────────────────────────────────
   Criar notificação
────────────────────────────────────────────────────────────── */

async function criarNotificacao(usuario_id, mensagem, extra = {}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) {
    throw criarErroNotificacao(
      "Usuário da notificação é obrigatório.",
      "NOTIFICACAO-400-USUARIO-OBRIGATORIO"
    );
  }

  const mensagemNormalizada = normalizeText(mensagem, {
    max: 5000,
    required: true,
  });

  const tipo = normalizeTipo(extra?.tipo || "sistema");

  const titulo = normalizeText(extra?.titulo || "Notificação", {
    max: 255,
    required: true,
  });

  const turmaId =
    extra?.turma_id !== null && extra?.turma_id !== undefined
      ? toPositiveInt(extra.turma_id)
      : null;

  const eventoId =
    extra?.evento_id !== null && extra?.evento_id !== undefined
      ? toPositiveInt(extra.evento_id)
      : null;

  const reservaId =
    extra?.reserva_id !== null && extra?.reserva_id !== undefined
      ? toPositiveInt(extra.reserva_id)
      : null;

  const link = normalizeText(extra?.link, {
    max: 1000,
  });

  const metadata =
    extra?.metadata && typeof extra.metadata === "object"
      ? extra.metadata
      : null;

  const row = await db.one(
    `
    INSERT INTO notificacoes (
      usuario_id,
      tipo,
      titulo,
      mensagem,
      lida,
      turma_id,
      evento_id,
      reserva_id,
      link,
      metadata,
      criado_em
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      false,
      $5,
      $6,
      $7,
      $8,
      $9::jsonb,
      now()
    )
    RETURNING
      id,
      usuario_id,
      tipo,
      titulo,
      mensagem,
      lida,
      turma_id,
      evento_id,
      reserva_id,
      link,
      metadata,
      criado_em
    `,
    [
      usuarioId,
      tipo,
      titulo,
      mensagemNormalizada,
      turmaId,
      eventoId,
      reservaId,
      link,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return mapNotificacao(row);
}

/* ─────────────────────────────────────────────────────────────
   GET /api/notificacao
────────────────────────────────────────────────────────────── */

async function listarNotificacao(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  let params;

  try {
    params = parseListQuery(req.query);

    const where = ["usuario_id = $1"];
    const values = [usuarioId];

    if (params.apenas_nao_lida) {
      where.push("lida = false");
    }

    if (params.tipo) {
      values.push(params.tipo);
      where.push(`tipo = $${values.length}`);
    }

    const countResult = await db.one(
      `
      SELECT COUNT(*)::int AS total
      FROM notificacoes
      WHERE ${where.join(" AND ")}
      `,
      values
    );

    values.push(params.limite);
    const limiteParam = `$${values.length}`;

    values.push(params.deslocamento);
    const deslocamentoParam = `$${values.length}`;

    const rows = await db.query(
      `
      SELECT
        id,
        tipo,
        titulo,
        mensagem,
        lida,
        criado_em,
        turma_id,
        evento_id,
        reserva_id,
        link,
        metadata
      FROM notificacoes
      WHERE ${where.join(" AND ")}
      ORDER BY criado_em DESC NULLS LAST, id DESC
      LIMIT ${limiteParam}
      OFFSET ${deslocamentoParam}
      `,
      values
    );

    const linhas = Array.isArray(rows) ? rows : rows?.rows || [];
    const data = linhas.map(mapNotificacao);
    const total = Number(countResult.total || 0);

    return respostaOk(res, 200, data, {
  message: "Notificações carregadas com sucesso.",
  code: "NOTIFICACAO-200-LISTAR",
  meta: {
    total,
    count: data.length,
    limite: params.limite,
    deslocamento: params.deslocamento,
    tem_mais: params.deslocamento + data.length < total,
    apenas_nao_lida: params.apenas_nao_lida,
    tipo: params.tipo,
  },
});
  } catch (error) {
    logErro("listarNotificacao", error, {
      usuarioId,
      params,
    });

    return respostaErro(
      res,
      getErrorStatus(error),
      error?.code || "NOTIFICACAO-500-LISTAR",
      error?.message || "Erro ao buscar notificações."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/notificacao/resumo
────────────────────────────────────────────────────────────── */

async function resumoNotificacoes(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  try {
    const rows = await db.query(
      `
      SELECT
        tipo,
        COUNT(*)::int AS total,
        SUM(CASE WHEN lida = false THEN 1 ELSE 0 END)::int AS nao_lida
      FROM notificacoes
      WHERE usuario_id = $1
      GROUP BY tipo
      ORDER BY tipo ASC
      `,
      [usuarioId]
    );

    const por_tipo = {};
    let total = 0;
    let nao_lida = 0;

    const linhas = Array.isArray(rows) ? rows : rows?.rows || [];

for (const row of linhas) {
  const tipo = normalizeTipo(row.tipo);

  if (!tipo) {
    continue;
  }

  const subtotal = Number(row.total || 0);
  const subNaoLida = Number(row.nao_lida || 0);

  por_tipo[tipo] = {
    total: subtotal,
    nao_lida: subNaoLida,
  };

  total += subtotal;
  nao_lida += subNaoLida;
}

    return respostaOk(
  res,
  200,
  {
    total,
    nao_lida,
    por_tipo,
  },
  {
    message: "Resumo de notificações carregado com sucesso.",
    code: "NOTIFICACAO-200-RESUMO",
  }
);
  } catch (error) {
    logErro("resumoNotificacoes", error, {
      usuarioId,
    });

    return respostaErro(
      res,
      500,
      "NOTIFICACAO-500-RESUMO",
      "Erro ao buscar resumo das notificações."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/notificacao/nao-lida/total
────────────────────────────────────────────────────────────── */

async function contarNaoLidas(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  try {
    const row = await db.one(
      `
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN lida = false THEN 1 ELSE 0 END)::int AS nao_lida
      FROM notificacoes
      WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    return respostaOk(res, 200, {
      total: Number(row.total || 0),
      nao_lida: Number(row.nao_lida || 0),
    });
  } catch (error) {
    logErro("contarNaoLidas", error, {
      usuarioId,
    });

    return respostaErro(
      res,
      500,
      "NOTIFICACAO-500-CONTAR-NAO-LIDA",
      "Erro ao contar notificações."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   PATCH /api/notificacao/:id/lida
────────────────────────────────────────────────────────────── */

async function marcarComoLida(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  const id = toPositiveInt(req.params?.id);

  if (!id) {
    return respostaErro(
      res,
      400,
      "NOTIFICACAO-400-ID-INVALIDO",
      "ID de notificação inválido."
    );
  }

  try {
    const result = await db.result(
      `
      UPDATE notificacoes
      SET lida = true
      WHERE id = $1
        AND usuario_id = $2
      `,
      [id, usuarioId]
    );

    if (result.rowCount === 0) {
      return respostaErro(
        res,
        404,
        "NOTIFICACAO-404-NAO-ENCONTRADA",
        "Notificação não encontrada."
      );
    }

    return respostaOk(
      res,
      200,
      {
        id,
        lida: true,
      },
      {
        message: "Notificação marcada como lida.",
      }
    );
  } catch (error) {
    logErro("marcarComoLida", error, {
      usuarioId,
      id,
    });

    return respostaErro(
      res,
      500,
      "NOTIFICACAO-500-MARCAR-LIDA",
      "Erro ao atualizar notificação."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   PATCH /api/notificacao/lida/todas
────────────────────────────────────────────────────────────── */

async function marcarTodasComoLidas(req, res) {
  const usuarioId = exigirUsuarioId(req, res);

  if (!usuarioId) return null;

  try {
    const result = await db.result(
      `
      UPDATE notificacoes
      SET lida = true
      WHERE usuario_id = $1
        AND lida = false
      `,
      [usuarioId]
    );

    return respostaOk(
      res,
      200,
      {
        total_atualizada: result.rowCount || 0,
      },
      {
        message: "Todas as notificações foram marcadas como lidas.",
      }
    );
  } catch (error) {
    logErro("marcarTodasComoLidas", error, {
      usuarioId,
    });

    return respostaErro(
      res,
      500,
      "NOTIFICACAO-500-MARCAR-TODAS-LIDAS",
      "Erro ao atualizar notificações."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   Notificação de avaliação pendente
────────────────────────────────────────────────────────────── */

async function gerarNotificacaoDeAvaliacao(usuario_id, contexto = {}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return null;

  try {
    const pendentes = await buscarAvaliacaoPendentes(usuarioId);

    if (!Array.isArray(pendentes) || !pendentes.length) return null;

    const turmaContexto = contexto?.turma_id
      ? toPositiveInt(contexto.turma_id)
      : null;

    const eventoContexto = contexto?.evento_id
      ? toPositiveInt(contexto.evento_id)
      : null;

    const criadas = [];

    for (const avaliacao of pendentes) {
      const turmaId = toPositiveInt(avaliacao?.turma_id);
      const eventoId = toPositiveInt(avaliacao?.evento_id);
      const eventoTitulo = normalizeText(avaliacao?.evento_titulo, {
        max: 255,
      });

      if (turmaContexto && turmaId !== turmaContexto) continue;
      if (eventoContexto && eventoId !== eventoContexto) continue;
      if (!turmaId || !eventoId || !eventoTitulo) continue;

      const duplicada = await existeNotificacaoDuplicada({
        usuario_id: usuarioId,
        tipo: "avaliacao",
        turma_id: turmaId,
        evento_id: eventoId,
        somente_nao_lida: true,
      });

      if (duplicada) continue;

      const notificacao = await criarNotificacao(
        usuarioId,
        `Já está disponível a avaliação do evento "${eventoTitulo}".`,
        {
          tipo: "avaliacao",
          titulo: `Avaliação disponível: ${eventoTitulo}`,
          turma_id: turmaId,
          evento_id: eventoId,
          link: "/avaliacao",
        }
      );

      criadas.push(notificacao);
    }

    return criadas;
  } catch (error) {
    logErro("gerarNotificacaoDeAvaliacao", error, {
      usuarioId,
      contexto,
    });

    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Notificação de certificado
────────────────────────────────────────────────────────────── */

async function gerarNotificacaoDeCertificado(usuario_id, contexto = {}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return null;

  try {
    const turmaId = contexto?.turma_id ? toPositiveInt(contexto.turma_id) : null;
    const eventoId = contexto?.evento_id
      ? toPositiveInt(contexto.evento_id)
      : null;

    const eventoTitulo = normalizeText(contexto?.evento_titulo, {
      max: 255,
    });

    if (!turmaId || !eventoId || !eventoTitulo) {
      throw criarErroNotificacao(
        "Contexto de certificado incompleto.",
        "NOTIFICACAO-400-CERTIFICADO-CONTEXTO-INCOMPLETO"
      );
    }

    const duplicada = await existeNotificacaoDuplicada({
      usuario_id: usuarioId,
      tipo: "certificado",
      turma_id: turmaId,
      evento_id: eventoId,
      somente_nao_lida: true,
    });

    if (duplicada) return null;

    return criarNotificacao(
      usuarioId,
      `Seu certificado do evento "${eventoTitulo}" está disponível para download.`,
      {
        tipo: "certificado",
        titulo: `Certificado disponível: ${eventoTitulo}`,
        turma_id: turmaId,
        evento_id: eventoId,
        link: "/certificado",
      }
    );
  } catch (error) {
    logErro("gerarNotificacaoDeCertificado", error, {
      usuarioId,
      contexto,
    });

    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Notificação de reserva
────────────────────────────────────────────────────────────── */

async function gerarNotificacaoDeReservaAprovada({
  usuario_id,
  reserva_id,
  sala,
  data,
  periodo,
  finalidade,
  observacao,
}) {
  const usuarioId = toPositiveInt(usuario_id);
  const reservaId = toPositiveInt(reserva_id);

  if (!usuarioId || !reservaId) return null;

  try {
    const duplicada = await existeNotificacaoDuplicada({
      usuario_id: usuarioId,
      tipo: "reserva_aprovada",
      reserva_id: reservaId,
      somente_nao_lida: true,
    });

    if (duplicada) return null;

    const dataFmt = formatarDataBr(data);
    const salaLabel = formatSalaLabel(sala);
    const periodoLabel = formatPeriodoLabel(periodo);
    const finalidadeText = normalizeText(finalidade, { max: 255 });
    const observacaoText = normalizeText(observacao, { max: 1000 });

    const mensagemBase = finalidadeText
      ? `Sua solicitação "${finalidadeText}" para ${salaLabel}, em ${dataFmt}, no período ${periodoLabel}, foi aprovada.`
      : `Sua solicitação de uso da ${salaLabel}, em ${dataFmt}, no período ${periodoLabel}, foi aprovada.`;

    const mensagem = observacaoText
      ? `${mensagemBase} Observação: ${observacaoText}`
      : mensagemBase;

    return criarNotificacao(usuarioId, mensagem, {
      tipo: "reserva_aprovada",
      titulo: "Reserva aprovada",
      reserva_id: reservaId,
      link: "/reserva",
    });
  } catch (error) {
    logErro("gerarNotificacaoDeReservaAprovada", error, {
      usuarioId,
      reservaId,
    });

    return null;
  }
}

async function gerarNotificacaoDeReservaRejeitada({
  usuario_id,
  reserva_id,
  sala,
  data,
  periodo,
  finalidade,
  observacao,
}) {
  const usuarioId = toPositiveInt(usuario_id);
  const reservaId = toPositiveInt(reserva_id);

  if (!usuarioId || !reservaId) return null;

  try {
    const duplicada = await existeNotificacaoDuplicada({
      usuario_id: usuarioId,
      tipo: "reserva_rejeitada",
      reserva_id: reservaId,
      somente_nao_lida: true,
    });

    if (duplicada) return null;

    const dataFmt = formatarDataBr(data);
    const salaLabel = formatSalaLabel(sala);
    const periodoLabel = formatPeriodoLabel(periodo);
    const finalidadeText = normalizeText(finalidade, { max: 255 });
    const observacaoText = normalizeText(observacao, { max: 1000 });

    const mensagemBase = finalidadeText
      ? `Sua solicitação "${finalidadeText}" para ${salaLabel}, em ${dataFmt}, no período ${periodoLabel}, não foi aprovada.`
      : `Sua solicitação de uso da ${salaLabel}, em ${dataFmt}, no período ${periodoLabel}, não foi aprovada.`;

    const mensagem = observacaoText
      ? `${mensagemBase} Motivo/observação: ${observacaoText}`
      : mensagemBase;

    return criarNotificacao(usuarioId, mensagem, {
      tipo: "reserva_rejeitada",
      titulo: "Reserva não aprovada",
      reserva_id: reservaId,
      link: "/reserva",
    });
  } catch (error) {
    logErro("gerarNotificacaoDeReservaRejeitada", error, {
      usuarioId,
      reservaId,
    });

    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Notificações de submissão
────────────────────────────────────────────────────────────── */

async function notificarSubmissaoCriada({
  usuario_id,
  chamada_titulo,
  trabalho_titulo,
}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return null;

  const chamadaTitulo = normalizeText(chamada_titulo, {
    max: 255,
    required: true,
  });

  const trabalhoTitulo = normalizeText(trabalho_titulo, {
    max: 255,
    required: true,
  });

  return criarNotificacao(
    usuarioId,
    `Sua submissão "${trabalhoTitulo}" foi enviada para a chamada "${chamadaTitulo}".`,
    {
      tipo: "submissao",
      titulo: `Submissão criada: ${trabalhoTitulo}`,
      link: "/trabalho",
    }
  );
}

async function notificarPosterAtualizado({
  usuario_id,
  chamada_titulo,
  trabalho_titulo,
  arquivo_nome,
}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return null;

  const chamadaTitulo = normalizeText(chamada_titulo, {
    max: 255,
    required: true,
  });

  const trabalhoTitulo = normalizeText(trabalho_titulo, {
    max: 255,
    required: true,
  });

  const arquivoNome = normalizeText(arquivo_nome, {
    max: 255,
    required: true,
  });

  return criarNotificacao(
    usuarioId,
    `O pôster "${arquivoNome}" foi anexado/atualizado na submissão "${trabalhoTitulo}" da chamada "${chamadaTitulo}".`,
    {
      tipo: "submissao",
      titulo: `Pôster anexado: ${trabalhoTitulo}`,
      link: "/trabalho",
    }
  );
}

async function notificarStatusSubmissao({
  usuario_id,
  chamada_titulo,
  trabalho_titulo,
  status,
}) {
  const usuarioId = toPositiveInt(usuario_id);

  if (!usuarioId) return null;

  const chamadaTitulo = normalizeText(chamada_titulo, {
    max: 255,
    required: true,
  });

  const trabalhoTitulo = normalizeText(trabalho_titulo, {
    max: 255,
    required: true,
  });

  const statusOficial = normalizeText(status, {
    max: 80,
    required: true,
  });

  const mapaTitulo = {
    submetido: "Submissão enviada",
    em_avaliacao: "Em avaliação",
    aprovado_exposicao: "Selecionado para Exposição",
    aprovado_oral: "Selecionado para Apresentação Oral",
    reprovado: "Não selecionado",
  };

  const mapaMensagem = {
    submetido: `Sua submissão "${trabalhoTitulo}" foi enviada e aguarda avaliação na chamada "${chamadaTitulo}".`,
    em_avaliacao: `Sua submissão "${trabalhoTitulo}" está em avaliação na chamada "${chamadaTitulo}".`,
    aprovado_exposicao: `Parabéns! O trabalho "${trabalhoTitulo}" foi selecionado para Exposição na chamada "${chamadaTitulo}".`,
    aprovado_oral: `Parabéns! O trabalho "${trabalhoTitulo}" foi selecionado para Apresentação Oral na chamada "${chamadaTitulo}".`,
    reprovado: `O trabalho "${trabalhoTitulo}" não foi selecionado na chamada "${chamadaTitulo}".`,
  };

  const titulo = mapaTitulo[statusOficial];
  const mensagem = mapaMensagem[statusOficial];

  if (!titulo || !mensagem) {
    throw criarErroNotificacao(
      "Status de submissão inválido.",
      "NOTIFICACAO-400-SUBMISSAO-STATUS-INVALIDO",
      { status: statusOficial }
    );
  }

  return criarNotificacao(usuarioId, mensagem, {
    tipo: "submissao",
    titulo,
    link: "/trabalho",
    metadata: {
      status: statusOficial,
    },
  });
}

async function notificarClassificacaoDaChamada(chamada_id) {
  const chamadaId = toPositiveInt(chamada_id);

  if (!chamadaId) return null;

  try {
    const rows = await db.query(
      `
      SELECT
        s.id AS submissao_id,
        s.usuario_id,
        s.titulo AS trabalho_titulo,
        s.status,
        c.titulo AS chamada_titulo
      FROM trabalhos_submissoes s
      INNER JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.chamada_id = $1
      ORDER BY s.id ASC
      `,
      [chamadaId]
    );

    const criadas = [];

    for (const row of rows) {
      const notificacao = await notificarStatusSubmissao({
        usuario_id: row.usuario_id,
        chamada_titulo: row.chamada_titulo,
        trabalho_titulo: row.trabalho_titulo,
        status: row.status,
      });

      if (notificacao) criadas.push(notificacao);
    }

    return criadas;
  } catch (error) {
    logErro("notificarClassificacaoDaChamada", error, {
      chamadaId,
    });

    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Export oficial
────────────────────────────────────────────────────────────── */

module.exports = {
  listarNotificacao,
  resumoNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,

  criarNotificacao,
  gerarNotificacaoDeAvaliacao,
  gerarNotificacaoDeCertificado,
  gerarNotificacaoDeReservaAprovada,
  gerarNotificacaoDeReservaRejeitada,

  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
};