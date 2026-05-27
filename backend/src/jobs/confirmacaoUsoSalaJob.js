/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/jobs/confirmacaoUsoSalaJob.js — v2.0
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Executar automaticamente o fluxo de confirmação de uso das salas.
 *
 * Regras oficiais:
 * - Reservas aprovadas devem receber solicitação de confirmação entre 7 dias e 48 horas antes.
 * - Reservas aprovadas que passaram do prazo sem confirmação podem ser canceladas automaticamente.
 *
 * Rotinas executadas:
 * 1. Solicitar confirmação de uso:
 *    - e-mail;
 *    - notificação interna;
 *    - controle anti-duplicidade em notificacoes_programadas;
 *    - marca reservas_salas.confirmacao_solicitada_em.
 *
 * 2. Cancelar reservas sem confirmação:
 *    - status = cancelado;
 *    - cancelado_em;
 *    - motivo_cancelamento;
 *    - notificação interna;
 *    - e-mail de cancelamento.
 *
 * Segurança operacional:
 * - Não executa em ambiente de teste.
 * - Não executa em paralelo.
 * - Executa uma vez por dia após a hora mínima.
 * - Se o servidor reiniciar depois das 9h, ainda executa naquele dia.
 *
 * Variáveis opcionais:
 * - CONFIRMACAO_USO_SALA_JOB_ENABLED=false para desativar.
 * - CONFIRMACAO_USO_SALA_JOB_HORA=9 para definir hora mínima.
 * - CONFIRMACAO_USO_SALA_JOB_INTERVAL_MS=1800000 para intervalo de checagem.
 * - CONFIRMACAO_USO_SALA_JOB_CANCELAMENTO_ENABLED=false para desativar cancelamento automático.
 * - LOG_JOBS=true para logs de ticks ignorados.
 */

const {
  executarSolicitacoesConfirmacaoUsoSala,
  executarCancelamentosSemConfirmacaoUsoSala,
} = require("../services/confirmacaoUsoSalaService");

/* =========================================================================
   Constantes oficiais
=========================================================================== */

const TIMEZONE_OFICIAL = "America/Sao_Paulo";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const DEFAULT_HORA_EXECUCAO = 9;

/* =========================================================================
   Estado em memória
=========================================================================== */

let intervalHandle = null;
let running = false;
let ultimoDiaExecutado = null;

/* =========================================================================
   Helpers
=========================================================================== */

function boolEnv(name, fallback = true) {
  const raw = process.env[name];

  if (raw == null || raw === "") {
    return fallback;
  }

  const value = String(raw).trim().toLowerCase();

  if (["false", "0", "nao", "não", "n", "off"].includes(value)) {
    return false;
  }

  if (["true", "1", "sim", "s", "yes", "y", "on"].includes(value)) {
    return true;
  }

  return fallback;
}

function intEnv(name, fallback, options = {}) {
  const value = Number.parseInt(process.env[name], 10);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  const min = Number.isFinite(options.min) ? options.min : null;
  const max = Number.isFinite(options.max) ? options.max : null;

  if (min != null && value < min) return fallback;
  if (max != null && value > max) return fallback;

  return value;
}

function obterAgoraSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_OFICIAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const mapa = Object.fromEntries(
    partes
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value])
  );

  return {
    ymd: `${mapa.year}-${mapa.month}-${mapa.day}`,
    hora: Number.parseInt(mapa.hour, 10),
    minuto: Number.parseInt(mapa.minute, 10),
    segundo: Number.parseInt(mapa.second, 10),
  };
}

function jobHabilitado() {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  return boolEnv("CONFIRMACAO_USO_SALA_JOB_ENABLED", true);
}

function cancelamentoAutomaticoHabilitado() {
  return boolEnv("CONFIRMACAO_USO_SALA_JOB_CANCELAMENTO_ENABLED", true);
}

function deveExecutarAgora() {
  const agora = obterAgoraSaoPaulo();

  const horaMinima = intEnv(
    "CONFIRMACAO_USO_SALA_JOB_HORA",
    DEFAULT_HORA_EXECUCAO,
    {
      min: 0,
      max: 23,
    }
  );

  if (agora.hora < horaMinima) {
    return {
      executar: false,
      motivo: "antes_da_hora_minima",
      agora,
      horaMinima,
    };
  }

  if (ultimoDiaExecutado === agora.ymd) {
    return {
      executar: false,
      motivo: "ja_executado_hoje",
      agora,
      horaMinima,
    };
  }

  if (running) {
    return {
      executar: false,
      motivo: "execucao_em_andamento",
      agora,
      horaMinima,
    };
  }

  return {
    executar: true,
    motivo: "apto",
    agora,
    horaMinima,
  };
}

/* =========================================================================
   Execução
=========================================================================== */

async function executarTickConfirmacaoUsoSalaJob(origem = "intervalo") {
  if (!jobHabilitado()) {
    return {
      ok: true,
      skipped: true,
      reason: "job_desabilitado",
    };
  }

  const decisao = deveExecutarAgora();

  if (!decisao.executar) {
    if (process.env.LOG_JOBS === "true") {
      console.log("[confirmacaoUsoSalaJob] Tick ignorado.", {
        origem,
        motivo: decisao.motivo,
        dia: decisao.agora?.ymd,
        hora: decisao.agora?.hora,
        minuto: decisao.agora?.minuto,
      });
    }

    return {
      ok: true,
      skipped: true,
      reason: decisao.motivo,
    };
  }

  running = true;

  try {
    console.log("[confirmacaoUsoSalaJob] Executando fluxo de confirmação de uso de sala.", {
      origem,
      dia_execucao: decisao.agora.ymd,
      hora_execucao: `${String(decisao.agora.hora).padStart(2, "0")}:${String(
        decisao.agora.minuto
      ).padStart(2, "0")}`,
      timezone: TIMEZONE_OFICIAL,
    });

    const resultadoSolicitacoes = await executarSolicitacoesConfirmacaoUsoSala({
      timezone: TIMEZONE_OFICIAL,
    });

    let resultadoCancelamentos = null;

    if (cancelamentoAutomaticoHabilitado()) {
      resultadoCancelamentos =
        await executarCancelamentosSemConfirmacaoUsoSala({
          timezone: TIMEZONE_OFICIAL,
        });
    } else {
      resultadoCancelamentos = {
        ok: true,
        code: "SALA-CANCELAMENTO-SEM-CONFIRMACAO-JOB-DESABILITADO",
        message:
          "Cancelamento automático por falta de confirmação está desabilitado por variável de ambiente.",
        data: {
          dryRun: false,
          resumo: {
            total: 0,
            cancelados: 0,
            ignorados: 0,
            erros: 0,
          },
          itens: [],
        },
        meta: {
          timezone: TIMEZONE_OFICIAL,
        },
      };
    }

    ultimoDiaExecutado = decisao.agora.ymd;

    console.log("[confirmacaoUsoSalaJob] Execução concluída.", {
      dia_execucao: decisao.agora.ymd,
      solicitacoes: resultadoSolicitacoes?.data?.resumo || null,
      cancelamentos: resultadoCancelamentos?.data?.resumo || null,
      cancelamento_automatico_habilitado: cancelamentoAutomaticoHabilitado(),
    });

    return {
      ok: true,
      skipped: false,
      result: {
        solicitacoes: resultadoSolicitacoes,
        cancelamentos: resultadoCancelamentos,
      },
    };
  } catch (error) {
    console.error("[confirmacaoUsoSalaJob] Falha na execução.", {
      origem,
      message: error?.message,
      code: error?.code,
      stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    });

    return {
      ok: false,
      skipped: false,
      error,
    };
  } finally {
    running = false;
  }
}

/* =========================================================================
   Start / Stop
=========================================================================== */

function iniciarConfirmacaoUsoSalaJob() {
  if (!jobHabilitado()) {
    console.log("[confirmacaoUsoSalaJob] Job desabilitado.");
    return null;
  }

  if (intervalHandle) {
    console.log("[confirmacaoUsoSalaJob] Job já iniciado.");
    return intervalHandle;
  }

  const intervalMs = intEnv(
    "CONFIRMACAO_USO_SALA_JOB_INTERVAL_MS",
    DEFAULT_INTERVAL_MS,
    {
      min: 60_000,
      max: 24 * 60 * 60 * 1000,
    }
  );

  console.log("[confirmacaoUsoSalaJob] Job iniciado.", {
    timezone: TIMEZONE_OFICIAL,
    hora_minima: intEnv(
      "CONFIRMACAO_USO_SALA_JOB_HORA",
      DEFAULT_HORA_EXECUCAO,
      {
        min: 0,
        max: 23,
      }
    ),
    intervalo_ms: intervalMs,
    cancelamento_automatico_habilitado: cancelamentoAutomaticoHabilitado(),
  });

  setTimeout(() => {
    executarTickConfirmacaoUsoSalaJob("boot").catch((error) => {
      console.error("[confirmacaoUsoSalaJob] Erro no tick inicial.", {
        message: error?.message,
        code: error?.code,
      });
    });
  }, 10_000).unref();

  intervalHandle = setInterval(() => {
    executarTickConfirmacaoUsoSalaJob("intervalo").catch((error) => {
      console.error("[confirmacaoUsoSalaJob] Erro no tick periódico.", {
        message: error?.message,
        code: error?.code,
      });
    });
  }, intervalMs);

  intervalHandle.unref();

  return intervalHandle;
}

function pararConfirmacaoUsoSalaJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  running = false;

  console.log("[confirmacaoUsoSalaJob] Job parado.");
}

/* =========================================================================
   Export oficial
=========================================================================== */

module.exports = {
  iniciarConfirmacaoUsoSalaJob,
  pararConfirmacaoUsoSalaJob,
  executarTickConfirmacaoUsoSalaJob,

  _internals: {
    obterAgoraSaoPaulo,
    deveExecutarAgora,
    cancelamentoAutomaticoHabilitado,
  },
};