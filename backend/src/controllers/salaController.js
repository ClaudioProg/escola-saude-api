"use strict";

/**
 * 📁 backend/src/controllers/salaController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Agendamento / reserva de salas.
 *
 * Contrato oficial de banco atual:
 * - reservas_salas
 * - calendario_bloqueios
 * - assinaturas
 * - usuarios
 *
 * Enums oficiais confirmados:
 * - status_reserva_sala:
 *   pendente | aprovado | rejeitado | cancelado | bloqueado
 *
 * - tipo_sala:
 *   auditorio | sala_reuniao
 *
 * - periodo_sala:
 *   manha | tarde
 *
 * Diretrizes v2.0:
 * - sem status "confirmado" enquanto não existir no banco;
 * - sem aliases "excluido/excluída/excluida";
 * - sem delete real para cancelamento/rejeição operacional;
 * - slot ocupado somente por pendente, aprovado ou bloqueado;
 * - rejeitado/cancelado liberam slot, mas preservam histórico;
 * - respostas padrão ok/data/message/code/meta;
 * - erros padrão ok:false/data:null/message/code/adminHint/details/requestId;
 * - anti-fuso com date-only YYYY-MM-DD;
 * - PDF do termo preservado;
 * - recorrência administrativa preservada.
 */

const { query, getClient } = require("../db");
const {
  gerarNotificacaoDeReservaAprovada,
  gerarNotificacaoDeReservaRejeitada,
} = require("./notificacaoController");

const {
  diagnosticarSolicitacoesConfirmacaoUsoSala,
  executarSolicitacoesConfirmacaoUsoSala,
  confirmarUsoReservaSala,
  diagnosticarCancelamentosSemConfirmacaoUsoSala,
  executarCancelamentosSemConfirmacaoUsoSala,
} = require("../services/confirmacaoUsoSalaService");

const IS_PROD = process.env.NODE_ENV === "production";
const IS_DEV = !IS_PROD;

/* =========================================================================
   Contratos oficiais
=========================================================================== */

const SALAS_OFICIAIS = Object.freeze({
  AUDITORIO: "auditorio",
  SALA_REUNIAO: "sala_reuniao",
});

const PERIODOS_OFICIAIS = Object.freeze({
  MANHA: "manha",
  TARDE: "tarde",
});

const STATUS_RESERVA = Object.freeze({
  PENDENTE: "pendente",
  APROVADO: "aprovado",
  REJEITADO: "rejeitado",
  CANCELADO: "cancelado",
  BLOQUEADO: "bloqueado",
});

const STATUS_OFICIAL = new Set(Object.values(STATUS_RESERVA));
const STATUS_OCUPA_SLOT = new Set([
  STATUS_RESERVA.PENDENTE,
  STATUS_RESERVA.APROVADO,
  STATUS_RESERVA.BLOQUEADO,
]);

const TIPOS_BLOQUEIO_OFICIAIS = new Set([
  "feriado_nacional",
  "feriado_municipal",
  "ponto_facultativo",
  "bloqueio_interno",
]);

/* =========================================================================
   Resposta padrão / logs
=========================================================================== */

function gerarRequestId(prefix = "sala") {
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
  console.error(`[salaController][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

function logDev(requestId, contexto, payload = null) {
  if (!IS_DEV) return;

  if (payload) {
    console.log(`[salaController][${requestId}] ${contexto}`, payload);
  } else {
    console.log(`[salaController][${requestId}] ${contexto}`);
  }
}

/* =========================================================================
   Helpers gerais
=========================================================================== */

function asInt(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) ? n : null;
}

function asPositiveInt(value) {
  const n = asInt(value);
  return n && n > 0 ? n : null;
}

function normalizarDataBaseConfirmacao(value) {
  const data = String(value || "").trim();

  if (!data) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const error = new Error("A data_base deve estar no formato YYYY-MM-DD.");
    error.code = "DATA_BASE_INVALIDA";
    error.httpStatus = 400;
    throw error;
  }

  return data;
}

function normalizarLimiteConfirmacao(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const limite = Number.parseInt(String(value), 10);

  if (!Number.isInteger(limite) || limite <= 0) {
    const error = new Error("O limite deve ser um número inteiro positivo.");
    error.code = "LIMITE_INVALIDO";
    error.httpStatus = 400;
    throw error;
  }

  return Math.min(limite, 1000);
}

function montarOptionsConfirmacao(req) {
  const fonte = req.method === "GET" ? req.query || {} : req.body || {};

  const dataBase = normalizarDataBaseConfirmacao(fonte.data_base);
  const limite = normalizarLimiteConfirmacao(fonte.limite);

  return {
    ...(dataBase ? { data_base: dataBase } : {}),
    ...(limite ? { limite } : {}),
  };
}

function normStr(value, { max = 500 } = {}) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
}

function normBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normSala(value) {
  const sala = normStr(value, { max: 50 });

  if (!sala) return null;

  if (sala === SALAS_OFICIAIS.AUDITORIO) return sala;
  if (sala === SALAS_OFICIAIS.SALA_REUNIAO) return sala;

  return null;
}

function normPeriodo(value) {
  const periodo = normStr(value, { max: 20 });

  if (!periodo) return null;

  if (periodo === PERIODOS_OFICIAIS.MANHA) return periodo;
  if (periodo === PERIODOS_OFICIAIS.TARDE) return periodo;

  return null;
}

function normStatusReserva(value, fallback = null) {
  const status = normStr(value, { max: 40 });

  if (!status) return fallback;

  const normalized = status.toLowerCase();

  return STATUS_OFICIAL.has(normalized) ? normalized : null;
}

function isStatusOcupaSlot(status) {
  return STATUS_OCUPA_SLOT.has(String(status || "").toLowerCase());
}

function isStatusAprovado(status) {
  return String(status || "").toLowerCase() === STATUS_RESERVA.APROVADO;
}

function isStatusPendente(status) {
  return String(status || "").toLowerCase() === STATUS_RESERVA.PENDENTE;
}

function isStatusFinal(status) {
  return [STATUS_RESERVA.REJEITADO, STATUS_RESERVA.CANCELADO].includes(
    String(status || "").toLowerCase()
  );
}

function capacidadeMaxSala(sala) {
  if (sala === SALAS_OFICIAIS.AUDITORIO) return 60;
  if (sala === SALAS_OFICIAIS.SALA_REUNIAO) return 30;
  return 0;
}

function labelSala(sala) {
  if (sala === SALAS_OFICIAIS.AUDITORIO) return "Auditório";
  if (sala === SALAS_OFICIAIS.SALA_REUNIAO) return "Sala de Reunião";
  return "Sala";
}

function labelPeriodo(periodo) {
  if (periodo === PERIODOS_OFICIAIS.MANHA) return "Manhã";
  if (periodo === PERIODOS_OFICIAIS.TARDE) return "Tarde";
  return "Período";
}

function sanitizeBase64(value) {
  const raw = String(value || "").trim();

  if (!raw) return null;

  const cleaned = raw
    .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "")
    .trim();

  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;

  return cleaned;
}

/* =========================================================================
   Helpers de data anti-fuso
=========================================================================== */

function isISODateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseISODateOnly(dateStr) {
  if (!isISODateOnly(dateStr)) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODateString(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return null;
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function hojeISO() {
  return toISODateString(new Date());
}

function dateValueToISO(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.slice(0, 10);

    if (isISODateOnly(text)) return text;
  }

  if (value instanceof Date) return toISODateString(value);

  const date = new Date(value);

  return toISODateString(date);
}

function isWeekend(dateStr) {
  const date = parseISODateOnly(dateStr);

  if (!date) return false;

  const day = date.getDay();

  return day === 0 || day === 6;
}

function formatDateBR(value) {
  const iso = dateValueToISO(value);

  if (!iso) return "—";

  const [year, month, day] = iso.split("-");

  return `${day}/${month}/${year}`;
}

function formatDateTimeBR(value) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} às ${hour}:${minute}`;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function compareMonthKey(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function getUserAgendaWindow() {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth() + 1;

  const minMesKey = monthKey(anoAtual, 1);

  let maxAno = anoAtual;
  let maxMes = 12;

  if (mesAtual === 11) {
    maxAno = anoAtual + 1;
    maxMes = 1;
  }

  if (mesAtual === 12) {
    maxAno = anoAtual + 1;
    maxMes = 2;
  }

  return {
    anoAtual,
    mesAtual,
    minMesKey,
    maxMesKey: monthKey(maxAno, maxMes),
    hoje: hojeISO(),
  };
}

function isYearMonthAllowedForUsuario(year, month) {
  if (!year || !month) return false;

  const { minMesKey, maxMesKey } = getUserAgendaWindow();
  const target = monthKey(year, month);

  return (
    compareMonthKey(target, minMesKey) >= 0 &&
    compareMonthKey(target, maxMesKey) <= 0
  );
}

function isDateAllowedForUsuario(dateISO) {
  if (!isISODateOnly(dateISO)) return false;

  const { maxMesKey, hoje } = getUserAgendaWindow();
  const [yearStr, monthStr] = dateISO.split("-");
  const target = monthKey(Number(yearStr), Number(monthStr));

  if (dateISO < hoje) return false;

  return compareMonthKey(target, maxMesKey) <= 0;
}

function getAnoMesFromQuery(queryObj) {
  const now = new Date();

  let ano = asInt(queryObj?.ano);
  let mes = asInt(queryObj?.mes);

  if (!ano || ano < 2000 || ano > 2100) ano = now.getFullYear();
  if (!mes || mes < 1 || mes > 12) mes = now.getMonth() + 1;

  return { ano, mes };
}

/* =========================================================================
   Assinaturas
=========================================================================== */

async function getAssinaturaById(assinaturaId) {
  const id = asPositiveInt(assinaturaId);

  if (!id) return null;

  const { rows } = await query(
    `
      SELECT id, usuario_id, imagem_base64
        FROM assinaturas
       WHERE id = $1
       LIMIT 1
    `,
    [id]
  );

  return rows?.[0] || null;
}

async function getAssinaturaByUsuarioId(usuarioId) {
  const id = asPositiveInt(usuarioId);

  if (!id) return null;

  const { rows } = await query(
    `
      SELECT id, usuario_id, imagem_base64
        FROM assinaturas
       WHERE usuario_id = $1
       LIMIT 1
    `,
    [id]
  );

  return rows?.[0] || null;
}

async function upsertAssinaturaUsuario(client, usuarioId, imagemBase64) {
  const userId = asPositiveInt(usuarioId);
  const base64 = sanitizeBase64(imagemBase64);

  if (!userId || !base64) return null;

  const { rows } = await client.query(
    `
      INSERT INTO assinaturas (usuario_id, imagem_base64)
      VALUES ($1, $2)
      ON CONFLICT (usuario_id)
      DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
      RETURNING id, usuario_id, imagem_base64
    `,
    [userId, base64]
  );

  return rows?.[0] || null;
}

async function resolveAssinaturaParaSolicitacao(client, usuarioId, body) {
  const termoAceito = normBoolean(body?.termo_aceito, false);
  const assinaturaIdInformada = asPositiveInt(body?.assinatura_id);
  const assinaturaBase64 = sanitizeBase64(body?.assinatura_base64);

  if (!termoAceito) {
    return {
      termoAceito: false,
      termoAssinadoEm: null,
      assinaturaId: null,
    };
  }

  let assinatura = null;

  if (assinaturaIdInformada) {
    assinatura = await getAssinaturaById(assinaturaIdInformada);

    if (!assinatura || Number(assinatura.usuario_id) !== Number(usuarioId)) {
      const err = new Error("Assinatura inválida para este usuário.");
      err.httpStatus = 400;
      err.code = "ASSINATURA_INVALIDA";
      throw err;
    }
  }

  if (!assinatura && assinaturaBase64) {
    assinatura = await upsertAssinaturaUsuario(
      client,
      usuarioId,
      assinaturaBase64
    );
  }

  if (!assinatura) {
    assinatura = await getAssinaturaByUsuarioId(usuarioId);
  }

  if (!assinatura?.id) {
    const err = new Error("Assinatura digital obrigatória para o termo.");
    err.httpStatus = 400;
    err.code = "ASSINATURA_OBRIGATORIA";
    throw err;
  }

  const termoAssinadoEm = body?.termo_assinado_em
    ? new Date(body.termo_assinado_em)
    : new Date();

  if (Number.isNaN(termoAssinadoEm.getTime())) {
    const err = new Error("Data/hora de assinatura inválida.");
    err.httpStatus = 400;
    err.code = "TERMO_ASSINADO_EM_INVALIDO";
    throw err;
  }

  return {
    termoAceito: true,
    termoAssinadoEm,
    assinaturaId: assinatura.id,
  };
}

/* =========================================================================
   Bloqueios / feriados
=========================================================================== */

async function datasBloqueadasISO(datasISO) {
  if (!Array.isArray(datasISO) || datasISO.length === 0) return new Set();

  const validas = datasISO.filter(isISODateOnly);

  if (validas.length === 0) return new Set();

  const { rows } = await query(
    `
      SELECT data::date AS data, tipo
        FROM calendario_bloqueios
       WHERE data = ANY($1::date[])
         AND tipo = ANY($2::text[])
    `,
    [validas, Array.from(TIPOS_BLOQUEIO_OFICIAIS)]
  );

  return new Set(
    (rows || [])
      .map((row) => dateValueToISO(row.data))
      .filter(Boolean)
  );
}

async function isDataBloqueada(dataISO) {
  const set = await datasBloqueadasISO([dataISO]);
  return set.has(dataISO);
}

/* =========================================================================
   Consultas comuns
=========================================================================== */

function mapReserva(row, usuarioId = null) {
  const status = String(row.status || "").toLowerCase();
  const dataISO = dateValueToISO(row.data);

  return {
    ...row,
    data: dataISO,
    pendente_aprovacao: isStatusPendente(status),
    aprovado: isStatusAprovado(status),
    ocupa_slot: isStatusOcupaSlot(status),
    finalizada_sem_ocupar: isStatusFinal(status),
    minha:
      usuarioId != null
        ? Number(row.solicitante_id) === Number(usuarioId)
        : Boolean(row.minha),
  };
}

async function existeConflitoReserva({
  sala,
  data,
  periodo,
  ignorarReservaId = null,
  client = null,
}) {
  const executor = client || { query };

  const params = [
    sala,
    data,
    periodo,
    Array.from(STATUS_OCUPA_SLOT),
  ];

  let extra = "";

  if (ignorarReservaId) {
    params.push(ignorarReservaId);
    extra = `AND id <> $${params.length}`;
  }

  const { rowCount } = await executor.query(
    `
      SELECT 1
        FROM reservas_salas
       WHERE sala = $1
         AND data = $2::date
         AND periodo = $3
         AND status::text = ANY($4::text[])
         ${extra}
       LIMIT 1
    `,
    params
  );

  return rowCount > 0;
}

function validarDadosReservaUsuario(body, fallback = {}) {
  const sala = normSala(body?.sala ?? fallback.sala);
  const data = normStr(body?.data ?? fallback.data, { max: 10 });
  const periodo = normPeriodo(body?.periodo ?? fallback.periodo);
  const qtdPessoas = asPositiveInt(body?.qtd_pessoas ?? fallback.qtd_pessoas);
  const coffeeBreak =
    body?.coffee_break !== undefined
      ? normBoolean(body.coffee_break, false)
      : Boolean(fallback.coffee_break);
  const finalidade =
    body?.finalidade !== undefined
      ? normStr(body.finalidade, { max: 500 })
      : normStr(fallback.finalidade, { max: 500 });

  if (!sala || !isISODateOnly(data) || !periodo || !qtdPessoas) {
    return {
      ok: false,
      message: "Sala, data, período e quantidade de pessoas são obrigatórios.",
      code: "DADOS_OBRIGATORIOS",
    };
  }

  if (!finalidade) {
    return {
      ok: false,
      message: "Informe a finalidade do uso da sala ou evento.",
      code: "FINALIDADE_OBRIGATORIA",
    };
  }

  const capacidade = capacidadeMaxSala(sala);

  if (qtdPessoas > capacidade) {
    return {
      ok: false,
      message: `Capacidade máxima para esta sala é de ${capacidade} pessoas.`,
      code: "CAPACIDADE_EXCEDIDA",
    };
  }

  if (!isDateAllowedForUsuario(data)) {
    return {
      ok: false,
      message: "A data escolhida está fora da janela permitida para agendamento.",
      code: "DATA_FORA_DA_JANELA",
    };
  }

  if (isWeekend(data)) {
    return {
      ok: false,
      message: "Não é possível agendar em sábados ou domingos.",
      code: "FIM_DE_SEMANA_NAO_PERMITIDO",
    };
  }

  return {
    ok: true,
    data: {
      sala,
      data,
      periodo,
      qtd_pessoas: qtdPessoas,
      coffee_break: coffeeBreak,
      finalidade,
    },
  };
}

/* =========================================================================
   GET /api/sala/agenda-admin
=========================================================================== */

async function listarAgendaAdmin(req, res) {
  const requestId = gerarRequestId("sala-agenda-admin");

  try {
    const { ano, mes } = getAnoMesFromQuery(req.query);
    const sala = normSala(req.query?.sala);

    const params = [ano, mes];
    let filtroSala = "";

    if (sala) {
      params.push(sala);
      filtroSala = `AND rs.sala = $${params.length}`;
    }

    logDev(requestId, "listarAgendaAdmin", { ano, mes, sala });

    const { rows: reservasRaw } = await query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.qtd_pessoas,
          rs.coffee_break,
          rs.status,
          rs.observacao_admin AS observacao,
          rs.finalidade,
          rs.solicitante_id,
          rs.aprovador_id,
rs.termo_aceito,
rs.termo_assinado_em,
rs.assinatura_id,
rs.confirmacao_solicitada_em,
rs.confirmado_em,
rs.confirmado_por,
rs.cancelado_em,
rs.cancelado_por,
rs.motivo_cancelamento,
rs.created_at,
rs.updated_at,
us.nome AS solicitante_nome,
ua.nome AS aprovador_nome
        FROM reservas_salas rs
        LEFT JOIN usuarios us ON us.id = rs.solicitante_id
        LEFT JOIN usuarios ua ON ua.id = rs.aprovador_id
        WHERE EXTRACT(YEAR FROM rs.data) = $1
          AND EXTRACT(MONTH FROM rs.data) = $2
          ${filtroSala}
        ORDER BY rs.data ASC, rs.sala ASC, rs.periodo ASC, rs.created_at DESC NULLS LAST
      `,
      params
    );

    const { rows: bloqueios } = await query(
      `
        SELECT id, data::date AS data, tipo, descricao
          FROM calendario_bloqueios
         WHERE EXTRACT(YEAR FROM data) = $1
           AND EXTRACT(MONTH FROM data) = $2
         ORDER BY data ASC, id ASC
      `,
      [ano, mes]
    );

    const reservas = reservasRaw.map((row) => mapReserva(row));

    const feriados = bloqueios
      .filter((row) =>
        ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(
          row.tipo
        )
      )
      .map((row) => ({
        ...row,
        data: dateValueToISO(row.data),
      }));

    const datas_bloqueadas = bloqueios
      .filter((row) => row.tipo === "bloqueio_interno")
      .map((row) => ({
        ...row,
        data: dateValueToISO(row.data),
      }));

    return sucesso(res, {
      data: {
        ano,
        mes,
        reservas,
        feriados,
        datas_bloqueadas,
      },
      message: "Agenda administrativa das salas carregada com sucesso.",
      code: "SALAS_AGENDA_ADMIN_LISTADA",
      meta: {
        totalReservas: reservas.length,
        totalFeriados: feriados.length,
        totalBloqueios: datas_bloqueadas.length,
      },
    });
  } catch (error) {
    logErro(requestId, "Erro ao listar agenda admin", error);

    return falha(res, {
      status: 500,
      message: "Erro ao listar agenda das salas.",
      code: "SALAS_AGENDA_ADMIN_ERRO",
      adminHint:
        "Verifique reservas_salas, calendario_bloqueios, enums tipo_sala/status_reserva_sala/periodo_sala e joins com usuarios.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   GET /api/sala/agenda-usuario
=========================================================================== */

async function listarAgendaUsuario(req, res) {
  const requestId = gerarRequestId("sala-agenda-usuario");

  try {
    const usuarioId = asPositiveInt(req.user?.id);

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint: "Middleware de autenticação não populou req.user.id.",
        requestId,
      });
    }

    const { ano, mes } = getAnoMesFromQuery(req.query);
    const sala = normSala(req.query?.sala);

    if (!isYearMonthAllowedForUsuario(ano, mes)) {
      return falha(res, {
        status: 403,
        message: "Este mês não está disponível para visualização na agenda.",
        code: "MES_FORA_DA_JANELA",
        adminHint:
          "A janela atual permite o ano vigente e, em novembro/dezembro, janeiro/fevereiro do ano seguinte.",
        requestId,
      });
    }

    const params = [ano, mes, usuarioId];
    let filtroSala = "";

    if (sala) {
      params.push(sala);
      filtroSala = `AND rs.sala = $${params.length}`;
    }

    const { rows: reservasRaw } = await query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.status,
          rs.qtd_pessoas,
          rs.coffee_break,
rs.termo_aceito,
rs.termo_assinado_em,
rs.assinatura_id,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.confirmacao_solicitada_em
  ELSE NULL
END AS confirmacao_solicitada_em,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.confirmado_em
  ELSE NULL
END AS confirmado_em,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.confirmado_por
  ELSE NULL
END AS confirmado_por,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.cancelado_em
  ELSE NULL
END AS cancelado_em,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.cancelado_por
  ELSE NULL
END AS cancelado_por,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.motivo_cancelamento
  ELSE NULL
END AS motivo_cancelamento,
rs.created_at,
rs.updated_at,
CASE
  WHEN rs.solicitante_id = $3 THEN rs.finalidade
  ELSE NULL
END AS finalidade,
rs.solicitante_id,
(rs.solicitante_id = $3) AS minha
        FROM reservas_salas rs
        WHERE EXTRACT(YEAR FROM rs.data) = $1
          AND EXTRACT(MONTH FROM rs.data) = $2
          AND (
            rs.solicitante_id = $3
            OR rs.status::text = ANY($4::text[])
          )
          ${filtroSala}
        ORDER BY rs.data ASC, rs.sala ASC, rs.periodo ASC, rs.created_at DESC NULLS LAST
      `,
      [...params, Array.from(STATUS_OCUPA_SLOT)]
    );

    const { rows: bloqueios } = await query(
      `
        SELECT id, data::date AS data, tipo, descricao
          FROM calendario_bloqueios
         WHERE EXTRACT(YEAR FROM data) = $1
           AND EXTRACT(MONTH FROM data) = $2
         ORDER BY data ASC, id ASC
      `,
      [ano, mes]
    );

    const reservas = reservasRaw.map((row) => mapReserva(row, usuarioId));

    const feriados = bloqueios
      .filter((row) =>
        ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(
          row.tipo
        )
      )
      .map((row) => ({
        ...row,
        data: dateValueToISO(row.data),
      }));

    const datas_bloqueadas = bloqueios
      .filter((row) => row.tipo === "bloqueio_interno")
      .map((row) => ({
        ...row,
        data: dateValueToISO(row.data),
      }));

    return sucesso(res, {
      data: {
        ano,
        mes,
        reservas,
        feriados,
        datas_bloqueadas,
      },
      message: "Agenda das salas carregada com sucesso.",
      code: "SALAS_AGENDA_USUARIO_LISTADA",
      meta: {
        totalReservas: reservas.length,
      },
    });
  } catch (error) {
    logErro(requestId, "Erro ao listar agenda do usuário", error);

    return falha(res, {
      status: 500,
      message: "Erro ao carregar disponibilidade das salas.",
      code: "SALAS_AGENDA_USUARIO_ERRO",
      adminHint:
        "Verifique reservas_salas, calendario_bloqueios e enum status_reserva_sala.",
      details: {
        dbCode: error?.code,
        ...(IS_DEV ? { detail: error?.message } : {}),
      },
      requestId,
    });
  }
}

/* =========================================================================
   POST /api/sala/solicitar
=========================================================================== */

async function solicitarReserva(req, res) {
  const requestId = gerarRequestId("sala-solicitar");
  let client;

  try {
    const usuarioId = asPositiveInt(req.user?.id);

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint: "Middleware de autenticação não populou req.user.id.",
        requestId,
      });
    }

    const validacao = validarDadosReservaUsuario(req.body || {});

    if (!validacao.ok) {
      return falha(res, {
        status: 400,
        message: validacao.message,
        code: validacao.code,
        requestId,
      });
    }

    const payload = validacao.data;

    const bloqueada = await isDataBloqueada(payload.data);

    if (bloqueada) {
      return falha(res, {
        status: 400,
        message:
          "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        code: "DATA_BLOQUEADA",
        requestId,
      });
    }

    client = await getClient();
    await client.query("BEGIN");

    const conflito = await existeConflitoReserva({
      sala: payload.sala,
      data: payload.data,
      periodo: payload.periodo,
      client,
    });

    if (conflito) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 409,
        message: "Este horário já está reservado para esta sala.",
        code: "CONFLITO_RESERVA",
        requestId,
      });
    }

    const assinaturaInfo = await resolveAssinaturaParaSolicitacao(
      client,
      usuarioId,
      req.body || {}
    );

    const { rows } = await client.query(
      `
        INSERT INTO reservas_salas
          (
            sala,
            data,
            periodo,
            qtd_pessoas,
            coffee_break,
            solicitante_id,
            status,
            finalidade,
            termo_aceito,
            termo_assinado_em,
            assinatura_id
          )
        VALUES
          ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `,
      [
        payload.sala,
        payload.data,
        payload.periodo,
        payload.qtd_pessoas,
        payload.coffee_break,
        usuarioId,
        STATUS_RESERVA.PENDENTE,
        payload.finalidade,
        assinaturaInfo.termoAceito,
        assinaturaInfo.termoAssinadoEm,
        assinaturaInfo.assinaturaId,
      ]
    );

    await client.query("COMMIT");

    return sucesso(res, {
      status: 201,
      data: mapReserva(rows[0], usuarioId),
      message: "Solicitação de reserva enviada com sucesso.",
      code: "SALAS_RESERVA_SOLICITADA",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    const httpStatus = error?.httpStatus || 500;

    logErro(requestId, "Erro ao solicitar reserva", error);

    return falha(res, {
      status: httpStatus,
      message:
        httpStatus >= 500
          ? "Erro ao solicitar reserva."
          : error?.message || "Não foi possível solicitar a reserva.",
      code: error?.code || "SALAS_SOLICITAR_ERRO",
      adminHint:
        httpStatus >= 500
          ? "Verifique constraint única de reservas_salas, assinatura_id e enum status_reserva_sala."
          : null,
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

/* =========================================================================
   PUT /api/sala/minhas/:id
=========================================================================== */

async function atualizarReservaUsuario(req, res) {
  const requestId = gerarRequestId("sala-atualizar-usuario");
  let client;

  try {
    const id = asPositiveInt(req.params?.id);
    const usuarioId = asPositiveInt(req.user?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        requestId,
      });
    }

    client = await getClient();
    await client.query("BEGIN");

    const atualResult = await client.query(
      `
        SELECT *
          FROM reservas_salas
         WHERE id = $1
         FOR UPDATE
      `,
      [id]
    );

    const atual = atualResult.rows?.[0];

    if (!atual) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    if (Number(atual.solicitante_id) !== Number(usuarioId)) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 403,
        message: "Você não pode alterar esta reserva.",
        code: "SEM_PERMISSAO",
        requestId,
      });
    }

    if (String(atual.status) !== STATUS_RESERVA.PENDENTE) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 403,
        message: "A edição é permitida apenas enquanto a solicitação estiver pendente.",
        code: "EDICAO_APENAS_PENDENTE",
        requestId,
      });
    }

    const fallback = {
      ...atual,
      data: dateValueToISO(atual.data),
    };

    const validacao = validarDadosReservaUsuario(req.body || {}, fallback);

    if (!validacao.ok) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 400,
        message: validacao.message,
        code: validacao.code,
        requestId,
      });
    }

    const payload = validacao.data;

    const bloqueada = await isDataBloqueada(payload.data);

    if (bloqueada) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 400,
        message:
          "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        code: "DATA_BLOQUEADA",
        requestId,
      });
    }

    const conflito = await existeConflitoReserva({
      sala: payload.sala,
      data: payload.data,
      periodo: payload.periodo,
      ignorarReservaId: id,
      client,
    });

    if (conflito) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 409,
        message: "Já existe uma reserva para esta sala, data e período.",
        code: "CONFLITO_RESERVA",
        requestId,
      });
    }

    const { rows } = await client.query(
      `
        UPDATE reservas_salas
           SET sala = $2,
               data = $3::date,
               periodo = $4,
               qtd_pessoas = $5,
               coffee_break = $6,
               finalidade = $7,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *;
      `,
      [
        id,
        payload.sala,
        payload.data,
        payload.periodo,
        payload.qtd_pessoas,
        payload.coffee_break,
        payload.finalidade,
      ]
    );

    await client.query("COMMIT");

    return sucesso(res, {
      data: mapReserva(rows[0], usuarioId),
      message: "Solicitação de reserva atualizada com sucesso.",
      code: "SALAS_RESERVA_USUARIO_ATUALIZADA",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    logErro(requestId, "Erro ao atualizar reserva do usuário", error);

    return falha(res, {
      status: 500,
      message: "Erro ao atualizar a solicitação de reserva.",
      code: "SALAS_RESERVA_USUARIO_ATUALIZAR_ERRO",
      adminHint:
        "Verifique constraint única de reservas_salas e enum status_reserva_sala.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

/* =========================================================================
   DELETE /api/sala/minhas/:id
   Soft cancel: status = cancelado
=========================================================================== */

async function excluirReservaUsuario(req, res) {
  const requestId = gerarRequestId("sala-cancelar-usuario");

  try {
    const id = asPositiveInt(req.params?.id);
    const usuarioId = asPositiveInt(req.user?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        requestId,
      });
    }

    const atual = await query(
      `
        SELECT id, status, solicitante_id
          FROM reservas_salas
         WHERE id = $1
         LIMIT 1
      `,
      [id]
    );

    const row = atual.rows?.[0];

    if (!row) {
      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    if (Number(row.solicitante_id) !== Number(usuarioId)) {
      return falha(res, {
        status: 403,
        message: "Você não pode cancelar esta reserva.",
        code: "SEM_PERMISSAO",
        requestId,
      });
    }

    if (String(row.status) !== STATUS_RESERVA.PENDENTE) {
      return falha(res, {
        status: 403,
        message: "Cancelamento pelo usuário é permitido apenas enquanto pendente.",
        code: "CANCELAMENTO_APENAS_PENDENTE",
        requestId,
      });
    }

    const { rows } = await query(
      `
        UPDATE reservas_salas
           SET status = $2,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *;
      `,
      [id, STATUS_RESERVA.CANCELADO]
    );

    return sucesso(res, {
      data: mapReserva(rows[0], usuarioId),
      message: "Solicitação cancelada com sucesso.",
      code: "SALAS_RESERVA_USUARIO_CANCELADA",
    });
  } catch (error) {
    logErro(requestId, "Erro ao cancelar reserva do usuário", error);

    return falha(res, {
      status: 500,
      message: "Erro ao cancelar a solicitação.",
      code: "SALAS_RESERVA_USUARIO_CANCELAR_ERRO",
      adminHint: "Verifique status_reserva_sala e integridade da reserva.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   Recorrência administrativa
=========================================================================== */

function getDateByOrdemSemana(
  year,
  monthIndex,
  weekday,
  ordemSemana,
  ehUltimaSemana
) {
  if (ehUltimaSemana) {
    const lastDay = new Date(year, monthIndex + 1, 0, 12, 0, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;
    const day = lastDay.getDate() - diff;

    return new Date(year, monthIndex, day, 12, 0, 0);
  }

  const ordem = Number(ordemSemana) || 1;
  const firstDay = new Date(year, monthIndex, 1, 12, 0, 0);
  const firstDow = firstDay.getDay();
  const delta = (weekday - firstDow + 7) % 7;

  let day = 1 + delta + (ordem - 1) * 7;

  const lastDayOfMonth = new Date(year, monthIndex + 1, 0, 12, 0, 0).getDate();

  if (day > lastDayOfMonth) {
    const lastDay = new Date(year, monthIndex + 1, 0, 12, 0, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;

    day = lastDay.getDate() - diff;
  }

  return new Date(year, monthIndex, day, 12, 0, 0);
}

function gerarDatasRecorrencia(dataBaseISO, recorrencia) {
  if (!isISODateOnly(dataBaseISO)) return [];
  if (!recorrencia || typeof recorrencia !== "object" || !recorrencia.tipo) {
    return [];
  }

  const tipo = String(recorrencia.tipo);

  if (tipo === "sempre") {
    const limiteMeses = Math.min(Number(recorrencia.limiteMeses) || 24, 120);
    const base = parseISODateOnly(dataBaseISO);

    if (!base) return [];

    const datas = [];

    for (let index = 1; index <= limiteMeses; index += 1) {
      const date = new Date(base);
      const originalDay = date.getDate();

      date.setMonth(date.getMonth() + index);

      if (date.getDate() !== originalDay) {
        const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0);
        date.setDate(last.getDate());
      }

      const iso = toISODateString(date);

      if (iso && iso !== dataBaseISO) {
        datas.push(iso);
      }
    }

    return datas;
  }

  const repeticao = Math.max(0, Number(recorrencia.repeticao) || 0);

  if (repeticao <= 0) return [];

  const baseDate = parseISODateOnly(dataBaseISO);

  if (!baseDate) return [];

  const results = [];

  if (tipo === "semanal" && recorrencia.semanal) {
    const intervaloSemanas = Math.max(
      1,
      Number(recorrencia.semanal.intervaloSemanas) || 1
    );

    const diasSemana = Array.isArray(recorrencia.semanal.diasSemana)
      ? recorrencia.semanal.diasSemana
      : [];

    const diasSet = new Set(
      diasSemana.map(Number).filter((day) => day >= 0 && day <= 6)
    );

    if (!diasSet.size) return [];

    const oneDayMs = 24 * 60 * 60 * 1000;
    const limiteDias = repeticao * 7 * intervaloSemanas + 21;

    for (
      let index = 1;
      index <= limiteDias && results.length < repeticao;
      index += 1
    ) {
      const date = new Date(baseDate.getTime() + index * oneDayMs);
      const diffDays = Math.floor((date - baseDate) / oneDayMs);
      const weekIndex = Math.floor(diffDays / 7);

      if (weekIndex % intervaloSemanas !== 0) continue;
      if (!diasSet.has(date.getDay())) continue;

      const iso = toISODateString(date);

      if (iso && iso !== dataBaseISO) results.push(iso);
    }

    return results;
  }

  if (tipo === "mensal" && recorrencia.mensal) {
    const modo = String(recorrencia.mensal.modo || "dia_mes");
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();

    for (let index = 1; index <= repeticao; index += 1) {
      const targetMonthIndex = baseMonth + index;
      const year = baseYear + Math.floor(targetMonthIndex / 12);
      const month = targetMonthIndex % 12;

      let date;

      if (
        modo === "ordem_semana" &&
        recorrencia.mensal.diaSemanaBaseIndex != null
      ) {
        date = getDateByOrdemSemana(
          year,
          month,
          Number(recorrencia.mensal.diaSemanaBaseIndex),
          Number(recorrencia.mensal.ordemSemanaBase),
          Boolean(recorrencia.mensal.ehUltimaSemana)
        );
      } else {
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0).getDate();
        const day = Math.min(
          Number(recorrencia.mensal.diaMesBase) || baseDate.getDate(),
          lastDay
        );

        date = new Date(year, month, day, 12, 0, 0);
      }

      const iso = toISODateString(date);

      if (iso && iso !== dataBaseISO) results.push(iso);
    }

    return results;
  }

  if (tipo === "anual" && recorrencia.anual) {
    const modo = String(recorrencia.anual.modo || "dia_mes");
    const meses = Array.isArray(recorrencia.anual.meses)
      ? recorrencia.anual.meses
      : [];

    const mesesSorted = Array.from(
      new Set(meses.map(Number).filter((month) => month >= 0 && month <= 11))
    ).sort((a, b) => a - b);

    if (!mesesSorted.length) return [];

    const baseYear = baseDate.getFullYear();

    let yearOffset = 0;
    const maxYears = Math.min(50, repeticao * 3 + 3);

    while (results.length < repeticao && yearOffset <= maxYears) {
      const year = baseYear + yearOffset;

      for (const month of mesesSorted) {
        let date;

        if (
          modo === "ordem_semana" &&
          recorrencia.anual.diaSemanaBaseIndex != null
        ) {
          date = getDateByOrdemSemana(
            year,
            month,
            Number(recorrencia.anual.diaSemanaBaseIndex),
            Number(recorrencia.anual.ordemSemanaBase),
            Boolean(recorrencia.anual.ehUltimaSemana)
          );
        } else {
          const lastDay = new Date(year, month + 1, 0, 12, 0, 0).getDate();
          const day = Math.min(
            Number(recorrencia.anual.diaMesBase) || baseDate.getDate(),
            lastDay
          );

          date = new Date(year, month, day, 12, 0, 0);
        }

        const iso = toISODateString(date);

        if (iso && iso > dataBaseISO) {
          results.push(iso);

          if (results.length >= repeticao) break;
        }
      }

      yearOffset += 1;
    }

    return results;
  }

  return [];
}

/* =========================================================================
   POST /api/sala/admin/reservas
=========================================================================== */

async function criarReservaAdmin(req, res) {
  const requestId = gerarRequestId("sala-admin-criar");
  let client;

  try {
    const adminId = asPositiveInt(req.user?.id);

    if (!adminId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        requestId,
      });
    }

    const sala = normSala(req.body?.sala);
    const data = normStr(req.body?.data, { max: 10 });
    const periodo = normPeriodo(req.body?.periodo);
    const qtdPessoas = asPositiveInt(req.body?.qtd_pessoas);
    const coffeeBreak = normBoolean(req.body?.coffee_break, false);
    const status = normStatusReserva(req.body?.status, STATUS_RESERVA.APROVADO);
    const observacao = normStr(req.body?.observacao, { max: 1000 });
    const finalidade = normStr(req.body?.finalidade, { max: 500 });
    const recorrencia =
      req.body?.recorrencia && typeof req.body.recorrencia === "object"
        ? req.body.recorrencia
        : null;

    if (!sala || !isISODateOnly(data) || !periodo || !qtdPessoas) {
      return falha(res, {
        status: 400,
        message: "Sala, data, período e quantidade de pessoas são obrigatórios.",
        code: "DADOS_OBRIGATORIOS",
        requestId,
      });
    }

    if (!status) {
      return falha(res, {
        status: 400,
        message: "Status inválido para reserva de sala.",
        code: "STATUS_INVALIDO",
        requestId,
      });
    }

    const capacidade = capacidadeMaxSala(sala);

    if (qtdPessoas > capacidade) {
      return falha(res, {
        status: 400,
        message: `Capacidade máxima para esta sala é de ${capacidade} pessoas.`,
        code: "CAPACIDADE_EXCEDIDA",
        requestId,
      });
    }

    let datasRecorrentes = [];

    try {
      datasRecorrentes = gerarDatasRecorrencia(data, recorrencia);
    } catch (error) {
      logDev(requestId, "Recorrência inválida ignorada", {
        message: error?.message,
      });
      datasRecorrentes = [];
    }

    const datasUnicas = Array.from(
      new Set([data, ...datasRecorrentes].filter(isISODateOnly))
    ).sort();

    const bloqueiosSet = await datasBloqueadasISO(datasUnicas);

    const datasValidas = datasUnicas.filter(
      (dateISO) => !isWeekend(dateISO) && !bloqueiosSet.has(dateISO)
    );

    if (datasValidas.length === 0) {
      return falha(res, {
        status: 400,
        message:
          "Nenhuma data válida para agendamento. Todas caem em final de semana, feriado ou bloqueio.",
        code: "SEM_DATA_VALIDA",
        requestId,
      });
    }

    client = await getClient();
    await client.query("BEGIN");

    const inseridas = [];
    const conflitos = [];

    for (const dateISO of datasValidas) {
      await client.query("SAVEPOINT sp_reserva");

      try {
        const conflito = await existeConflitoReserva({
          sala,
          data: dateISO,
          periodo,
          client,
        });

        if (conflito) {
          await client.query("ROLLBACK TO SAVEPOINT sp_reserva");
          conflitos.push(dateISO);
          continue;
        }

        const aprovadorId = isStatusAprovado(status) ? adminId : null;

        const { rows } = await client.query(
          `
            INSERT INTO reservas_salas
              (
                sala,
                data,
                periodo,
                qtd_pessoas,
                coffee_break,
                solicitante_id,
                status,
                observacao_admin,
                finalidade,
                aprovador_id,
                termo_aceito
              )
            VALUES
              ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, false)
            RETURNING *;
          `,
          [
            sala,
            dateISO,
            periodo,
            qtdPessoas,
            coffeeBreak,
            adminId,
            status,
            observacao,
            finalidade,
            aprovadorId,
          ]
        );

        inseridas.push(mapReserva(rows[0]));
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT sp_reserva");

        if (error?.code === "23505") {
          conflitos.push(dateISO);
          continue;
        }

        throw error;
      }
    }

    if (inseridas.length === 0) {
      await client.query("ROLLBACK");

      return falha(res, {
        status: 409,
        message:
          "Não foi possível criar reserva. Todas as datas válidas possuem conflito.",
        code: "TODAS_DATAS_COM_CONFLITO",
        details: { conflitos },
        requestId,
      });
    }

    await client.query("COMMIT");

    return sucesso(res, {
      status: 201,
      data: {
        inseridas,
        conflitos,
      },
      message:
        conflitos.length > 0
          ? "Reservas criadas, com algumas datas ignoradas por conflito."
          : "Reserva criada com sucesso.",
      code: "SALAS_ADMIN_RESERVA_CRIADA",
      meta: {
        totalInseridas: inseridas.length,
        totalConflitos: conflitos.length,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    logErro(requestId, "Erro ao criar reserva admin", error);

    return falha(res, {
      status: 500,
      message: "Erro ao criar reserva de sala.",
      code: "SALAS_ADMIN_RESERVA_CRIAR_ERRO",
      adminHint:
        "Verifique enum status_reserva_sala, constraint única de slot, tipo_sala e periodo_sala.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

/* =========================================================================
   PUT /api/sala/admin/reservas/:id
=========================================================================== */

async function atualizarReservaAdmin(req, res) {
  const requestId = gerarRequestId("sala-admin-atualizar");

  try {
    const id = asPositiveInt(req.params?.id);
    const adminId = asPositiveInt(req.user?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    if (!adminId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        requestId,
      });
    }

    const atualResult = await query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.finalidade,
          rs.observacao_admin,
          rs.solicitante_id,
          rs.aprovador_id,
          rs.status
        FROM reservas_salas rs
        WHERE rs.id = $1
        LIMIT 1
      `,
      [id]
    );

    const atual = atualResult.rows?.[0];

    if (!atual) {
      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    const status =
      req.body?.status !== undefined
        ? normStatusReserva(req.body.status, null)
        : null;

    if (req.body?.status !== undefined && !status) {
      return falha(res, {
        status: 400,
        message: "Status inválido para reserva de sala.",
        code: "STATUS_INVALIDO",
        requestId,
      });
    }

    const qtdPessoas =
      req.body?.qtd_pessoas !== undefined
        ? asPositiveInt(req.body.qtd_pessoas)
        : null;

    const coffeeBreak =
      req.body?.coffee_break !== undefined
        ? normBoolean(req.body.coffee_break, false)
        : null;

    const observacao =
      req.body?.observacao !== undefined
        ? normStr(req.body.observacao, { max: 1000 })
        : null;

    const finalidade =
      req.body?.finalidade !== undefined
        ? normStr(req.body.finalidade, { max: 500 })
        : null;

    if (qtdPessoas != null) {
      const capacidade = capacidadeMaxSala(String(atual.sala));

      if (qtdPessoas > capacidade) {
        return falha(res, {
          status: 400,
          message: `Capacidade máxima para esta sala é de ${capacidade} pessoas.`,
          code: "CAPACIDADE_EXCEDIDA",
          requestId,
        });
      }
    }

    const aprovaAgora = status === STATUS_RESERVA.APROVADO;
    const aprovadorId = aprovaAgora ? adminId : null;

    const { rows } = await query(
      `
        UPDATE reservas_salas
           SET status = COALESCE($2::status_reserva_sala, status),
               qtd_pessoas = COALESCE($3, qtd_pessoas),
               coffee_break = COALESCE($4, coffee_break),
               observacao_admin = COALESCE($5, observacao_admin),
               finalidade = COALESCE($6, finalidade),
               aprovador_id = CASE
                                WHEN $7::bigint IS NOT NULL THEN $7
                                ELSE aprovador_id
                              END,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *;
      `,
      [
        id,
        status,
        qtdPessoas,
        coffeeBreak,
        observacao,
        finalidade,
        aprovadorId,
      ]
    );

    const reserva = rows?.[0];

    if (!reserva) {
      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    if (status === STATUS_RESERVA.APROVADO) {
      await gerarNotificacaoDeReservaAprovada({
        usuario_id: reserva.solicitante_id,
        reserva_id: reserva.id,
        sala: reserva.sala,
        data: dateValueToISO(reserva.data),
        periodo: reserva.periodo,
        finalidade: reserva.finalidade,
        observacao: reserva.observacao_admin ?? null,
      });
    }

    if (status === STATUS_RESERVA.REJEITADO) {
      await gerarNotificacaoDeReservaRejeitada({
        usuario_id: reserva.solicitante_id,
        reserva_id: reserva.id,
        sala: reserva.sala,
        data: dateValueToISO(reserva.data),
        periodo: reserva.periodo,
        finalidade: reserva.finalidade,
        observacao: reserva.observacao_admin ?? null,
      });
    }

    return sucesso(res, {
      data: mapReserva(reserva),
      message: "Reserva atualizada com sucesso.",
      code: "SALAS_ADMIN_RESERVA_ATUALIZADA",
    });
  } catch (error) {
    logErro(requestId, "Erro ao atualizar reserva admin", error);

    return falha(res, {
      status: 500,
      message: "Erro ao atualizar reserva.",
      code: "SALAS_ADMIN_RESERVA_ATUALIZAR_ERRO",
      adminHint:
        "Verifique enum status_reserva_sala, campos atualizados e notificações.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   DELETE /api/sala/admin/reservas/:id
   v2.0: cancelamento lógico, não delete real
=========================================================================== */

async function excluirReservaAdmin(req, res) {
  const requestId = gerarRequestId("sala-admin-cancelar");

  try {
    const id = asPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    const { rows } = await query(
      `
        UPDATE reservas_salas
           SET status = $2,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *;
      `,
      [id, STATUS_RESERVA.CANCELADO]
    );

    const reserva = rows?.[0];

    if (!reserva) {
      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: mapReserva(reserva),
      message: "Reserva cancelada com sucesso.",
      code: "SALAS_ADMIN_RESERVA_CANCELADA",
    });
  } catch (error) {
    logErro(requestId, "Erro ao cancelar reserva admin", error);

    return falha(res, {
      status: 500,
      message: "Erro ao cancelar reserva.",
      code: "SALAS_ADMIN_RESERVA_CANCELAR_ERRO",
      adminHint:
        "Verifique enum status_reserva_sala. O cancelamento admin deve preservar histórico.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   GET /api/sala/admin/reservas/:id/termo-pdf
=========================================================================== */

async function visualizarTermoReservaAdmin(req, res) {
  const requestId = gerarRequestId("sala-termo-pdf");

  try {
    const id = asPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    const { rows } = await query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.qtd_pessoas,
          rs.coffee_break,
          rs.status,
          rs.finalidade,
          rs.observacao_admin,
          rs.solicitante_id,
          rs.aprovador_id,
          rs.termo_aceito,
          rs.termo_assinado_em,
          rs.assinatura_id,
          us.nome AS solicitante_nome,
          ua.nome AS aprovador_nome,
          a.imagem_base64
        FROM reservas_salas rs
        LEFT JOIN usuarios us ON us.id = rs.solicitante_id
        LEFT JOIN usuarios ua ON ua.id = rs.aprovador_id
        LEFT JOIN assinaturas a ON a.id = rs.assinatura_id
        WHERE rs.id = $1
        LIMIT 1
      `,
      [id]
    );

    const reserva = rows?.[0];

    if (!reserva) {
      return falha(res, {
        status: 404,
        message: "Reserva não encontrada.",
        code: "RESERVA_NAO_ENCONTRADA",
        requestId,
      });
    }

    if (
      !reserva.termo_aceito ||
      !reserva.termo_assinado_em ||
      !reserva.assinatura_id
    ) {
      return falha(res, {
        status: 400,
        message: "Esta reserva ainda não possui termo assinado disponível.",
        code: "TERMO_NAO_ASSINADO",
        requestId,
      });
    }

    let PDFDocument;

    try {
      PDFDocument = require("pdfkit");
    } catch (error) {
      logErro(requestId, "PDFKit ausente", error);

      return falha(res, {
        status: 500,
        message: "Dependência PDFKit não encontrada no servidor.",
        code: "PDFKIT_AUSENTE",
        adminHint: "Instale/verifique a dependência pdfkit no backend.",
        requestId,
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="termo-reserva-${id}.pdf"`
    );
    res.setHeader("Cache-Control", "no-store");

    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50,
      },
      info: {
        Title: `Termo de Uso das Salas - Reserva ${id}`,
        Author: "Escola da Saúde",
      },
    });

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth =
      pageWidth - doc.page.margins.left - doc.page.margins.right;

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE DE SANTOS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#334155");
    doc.text("ESCOLA DA SAÚDE", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827");
    doc.text("TERMO DE USO DAS SALAS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#475569");
    doc.text("Escola da Saúde / SMS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(1.5);

    doc.font("Helvetica").fontSize(11).fillColor("#1f2937");
    doc.text(
      "Este Termo tem por objetivo regulamentar o uso do Auditório e da Sala de Reuniões da Escola da Saúde da Secretaria Municipal de Saúde de Santos (SMS), estabelecendo as responsabilidades e condições para sua utilização.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text("1. Finalidade de Uso");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(
      "As salas destinam-se, prioritariamente, às atividades de Educação Permanente em Saúde.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("2. Responsabilidades do Responsável pelo Evento");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);

    const bullets = [
      "Chegar 30 minutos antes para preparar a sala, ligar equipamentos e organizar o espaço.",
      "O notebook deve ser acessado com o SSHD do responsável. Em caso de visitante, utilizar o SSHD do servidor solicitante.",
      "Coffee break será autorizado somente se informado na reserva. Deve ser montado apenas na sacada externa. Alimentos, descartáveis e limpeza são de responsabilidade do solicitante.",
      "Não é permitido o consumo de alimentos no interior da sala.",
      "Ao final do evento, devolver a sala às condições originais, recolocar mesas e cadeiras, desligar equipamentos e avisar à equipe da Escola sobre o término do uso.",
      "A Escola dispõe de bebedouro, não disponibilizando copos descartáveis.",
      "Horário de funcionamento: 8h às 17h.",
    ];

    bullets.forEach((item) => {
      doc.text(`• ${item}`, {
        align: "justify",
        width: contentWidth,
        indent: 10,
      });
      doc.moveDown(0.35);
    });

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text("3. Disposições Finais");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(
      "De acordo com a Ordem de Serviço Nº 007/2020 – GAB/SMS, a Escola da Saúde é responsável pelo gerenciamento, divulgação institucional, autorização e apoio às atividades de educação permanente em saúde no âmbito da SMS.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(0.5);
    doc.text(
      "Ao assinar este termo, o responsável declara estar ciente das normas acima e compromete-se a cumpri-las integralmente.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(1.3);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
    doc.text(`NOME DO EVENTO: ${reserva.finalidade || "—"}`);
    doc.moveDown(0.4);
    doc.text(`DATA: ${formatDateBR(reserva.data)}`);
    doc.moveDown(0.4);
    doc.text(`SALA: ${labelSala(reserva.sala)}`);
    doc.moveDown(0.4);
    doc.text(`PERÍODO: ${labelPeriodo(reserva.periodo)}`);
    doc.moveDown(0.4);
    doc.text(`SOLICITANTE: ${reserva.solicitante_nome || "—"}`);
    doc.moveDown(0.4);

    if (reserva.aprovador_nome) {
      doc.text(`APROVADO POR: ${reserva.aprovador_nome}`);
      doc.moveDown(0.4);
    }

    const assinaturaBase64 = sanitizeBase64(reserva.imagem_base64);

    if (assinaturaBase64) {
      try {
        const imgBuffer = Buffer.from(assinaturaBase64, "base64");

        doc.moveDown(1.8);

        const assinaturaY = doc.y;

        doc.image(imgBuffer, doc.page.margins.left + 60, assinaturaY, {
          fit: [220, 90],
          align: "left",
          valign: "center",
        });

        doc.moveDown(4.2);
      } catch (error) {
        logDev(requestId, "Assinatura inválida para PDF", {
          message: error?.message,
        });
        doc.moveDown(2.5);
      }
    } else {
      doc.moveDown(2.5);
    }

    doc
      .moveTo(doc.page.margins.left + 40, doc.y)
      .lineTo(doc.page.margins.left + 300, doc.y)
      .strokeColor("#94a3b8")
      .stroke();

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
    doc.text(reserva.solicitante_nome || "—", doc.page.margins.left + 60, doc.y, {
      width: 240,
      align: "center",
    });

    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#475569");
    doc.text(
      `Assinado digitalmente em ${formatDateTimeBR(
        reserva.termo_assinado_em
      )}`,
      doc.page.margins.left + 40,
      doc.y,
      {
        width: 280,
        align: "center",
      }
    );

    doc.end();
  } catch (error) {
    logErro(requestId, "Erro ao gerar termo PDF", error);

    if (!res.headersSent) {
      return falha(res, {
        status: 500,
        message: "Erro ao gerar o PDF do termo.",
        code: "TERMO_PDF_ERRO",
        adminHint:
          "Verifique PDFKit, assinatura base64, dados da reserva e joins com usuários/assinaturas.",
        details: {
          dbCode: error?.code,
          constraint: error?.constraint,
        },
        requestId,
      });
    }

    res.end();
  }
}

/* =========================================================================
   GET /api/sala/confirmacao-uso/diagnostico
=========================================================================== */

async function diagnosticarConfirmacaoUsoSala(req, res) {
  const requestId = gerarRequestId("sala-confirmacao-diagnostico");

  try {
    const options = montarOptionsConfirmacao(req);

    const resultado = await diagnosticarSolicitacoesConfirmacaoUsoSala(options);

    return sucesso(res, {
      data: resultado.data,
      message: resultado.message,
      code: resultado.code,
      meta: resultado.meta,
    });
  } catch (error) {
    logErro(requestId, "Erro ao diagnosticar confirmação de uso de sala", error);

    return falha(res, {
      status: error?.httpStatus || 500,
      message:
        error?.httpStatus && error?.httpStatus < 500
          ? error.message
          : "Erro ao diagnosticar confirmações de uso de sala.",
      code: error?.code || "SALAS_CONFIRMACAO_USO_DIAGNOSTICO_ERRO",
      adminHint:
        error?.httpStatus && error?.httpStatus < 500
          ? null
          : "Verifique reservas_salas, usuarios, notificacoes_programadas e a janela de confirmação de 7 dias a 48 horas.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   POST /api/sala/confirmacao-uso/executar
=========================================================================== */

async function executarConfirmacaoUsoSala(req, res) {
  const requestId = gerarRequestId("sala-confirmacao-executar");

  try {
    const options = montarOptionsConfirmacao(req);

    const resultado = await executarSolicitacoesConfirmacaoUsoSala(options);

    return sucesso(res, {
      data: resultado.data,
      message: resultado.message,
      code: resultado.code,
      meta: resultado.meta,
    });
  } catch (error) {
    logErro(requestId, "Erro ao executar confirmação de uso de sala", error);

    return falha(res, {
      status: error?.httpStatus || 500,
      message:
        error?.httpStatus && error?.httpStatus < 500
          ? error.message
          : "Erro ao executar solicitações de confirmação de uso de sala.",
      code: error?.code || "SALAS_CONFIRMACAO_USO_EXECUTAR_ERRO",
      adminHint:
        error?.httpStatus && error?.httpStatus < 500
          ? null
          : "Verifique SMTP, mailer, notificacoes, notificacoes_programadas e reservas_salas.confirmacao_solicitada_em.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   POST /api/sala/minhas/:id/confirmar-uso
=========================================================================== */

async function confirmarUsoSalaUsuario(req, res) {
  const requestId = gerarRequestId("sala-confirmar-uso-usuario");

  try {
    const reservaId = asPositiveInt(req.params?.id);
    const usuarioId = asPositiveInt(req.user?.id);

    if (!reservaId) {
      return falha(res, {
        status: 400,
        message: "ID da reserva inválido.",
        code: "ID_INVALIDO",
        requestId,
      });
    }

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint: "Middleware de autenticação não populou req.user.id.",
        requestId,
      });
    }

    const resultado = await confirmarUsoReservaSala({
      reservaId,
      usuarioId,
    });

    return sucesso(res, {
      data: resultado,
      message: resultado?.ja_confirmada
        ? "O uso desta sala já havia sido confirmado."
        : "Uso da sala confirmado com sucesso.",
      code: resultado?.ja_confirmada
        ? "SALAS_USO_JA_CONFIRMADO"
        : "SALAS_USO_CONFIRMADO",
    });
  } catch (error) {
    logErro(requestId, "Erro ao confirmar uso da sala pelo usuário", error);

    return falha(res, {
      status: error?.httpStatus || 500,
      message:
        error?.httpStatus && error?.httpStatus < 500
          ? error.message
          : "Erro ao confirmar uso da sala.",
      code: error?.code || "SALAS_CONFIRMAR_USO_ERRO",
      adminHint:
        error?.httpStatus && error?.httpStatus < 500
          ? null
          : "Verifique reservas_salas.status, solicitante_id, confirmado_em e janela de confirmação.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   GET /api/sala/confirmacao-uso/cancelamento/diagnostico
=========================================================================== */

async function diagnosticarCancelamentoSemConfirmacaoSala(req, res) {
  const requestId = gerarRequestId("sala-cancelamento-confirmacao-diagnostico");

  try {
    const options = montarOptionsConfirmacao(req);

    const resultado = await diagnosticarCancelamentosSemConfirmacaoUsoSala(
      options
    );

    return sucesso(res, {
      data: resultado.data,
      message: resultado.message,
      code: resultado.code,
      meta: resultado.meta,
    });
  } catch (error) {
    logErro(
      requestId,
      "Erro ao diagnosticar cancelamentos sem confirmação de sala",
      error
    );

    return falha(res, {
      status: error?.httpStatus || 500,
      message:
        error?.httpStatus && error?.httpStatus < 500
          ? error.message
          : "Erro ao diagnosticar cancelamentos por falta de confirmação.",
      code:
        error?.code ||
        "SALAS_CANCELAMENTO_SEM_CONFIRMACAO_DIAGNOSTICO_ERRO",
      adminHint:
        error?.httpStatus && error?.httpStatus < 500
          ? null
          : "Verifique reservas_salas aprovadas, confirmacao_solicitada_em, confirmado_em, cancelado_em e data da reserva.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   POST /api/sala/confirmacao-uso/cancelamento/executar
=========================================================================== */

async function executarCancelamentoSemConfirmacaoSala(req, res) {
  const requestId = gerarRequestId("sala-cancelamento-confirmacao-executar");

  try {
    const options = montarOptionsConfirmacao(req);

    const resultado = await executarCancelamentosSemConfirmacaoUsoSala(options);

    return sucesso(res, {
      data: resultado.data,
      message: resultado.message,
      code: resultado.code,
      meta: resultado.meta,
    });
  } catch (error) {
    logErro(
      requestId,
      "Erro ao executar cancelamentos sem confirmação de sala",
      error
    );

    return falha(res, {
      status: error?.httpStatus || 500,
      message:
        error?.httpStatus && error?.httpStatus < 500
          ? error.message
          : "Erro ao executar cancelamentos por falta de confirmação.",
      code:
        error?.code ||
        "SALAS_CANCELAMENTO_SEM_CONFIRMACAO_EXECUTAR_ERRO",
      adminHint:
        error?.httpStatus && error?.httpStatus < 500
          ? null
          : "Verifique status_reserva_sala, permissões, notificações e envio de e-mail de cancelamento.",
      details: {
        dbCode: error?.code,
        constraint: error?.constraint,
      },
      requestId,
    });
  }
}

module.exports = {
  listarAgendaAdmin,
  listarAgendaUsuario,
  solicitarReserva,
  atualizarReservaUsuario,
  excluirReservaUsuario,
  criarReservaAdmin,
  atualizarReservaAdmin,
  excluirReservaAdmin,
  visualizarTermoReservaAdmin,

  diagnosticarConfirmacaoUsoSala,
  executarConfirmacaoUsoSala,
  confirmarUsoSalaUsuario,
  diagnosticarCancelamentoSemConfirmacaoSala,
  executarCancelamentoSemConfirmacaoSala,
};