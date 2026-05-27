/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/jobs/lembreteEventoJob.js — v2.0
 * Atualizado em: 15/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Executar automaticamente os lembretes de início de curso/evento.
 *
 * Regra oficial:
 * - Todos os dias, a partir das 9h, verificar turmas que começam no dia seguinte.
 * - Enviar notificação interna e e-mail aos usuários inscritos.
 *
 * Segurança operacional:
 * - Sem dependência externa de cron.
 * - Sem executar em ambiente de teste.
 * - Sem executar em paralelo.
 * - Idempotência garantida por notificacoes_programadas.
 * - Se a API reiniciar depois das 9h, ainda executa naquele dia.
 *
 * Variáveis opcionais:
 * - LEMBRETE_EVENTO_JOB_ENABLED=false para desativar.
 * - LEMBRETE_EVENTO_JOB_INTERVAL_MS para alterar intervalo de checagem.
 * - LEMBRETE_EVENTO_JOB_HORA para alterar hora mínima de execução.
 */

const {
  executarLembretesInicioEvento,
} = require("../services/lembreteEventoService");

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const TIMEZONE_OFICIAL = "America/Sao_Paulo";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const DEFAULT_HORA_EXECUCAO = 9;

/* ─────────────────────────────────────────────────────────────
   Estado do job em memória
────────────────────────────────────────────────────────────── */

let intervalHandle = null;
let running = false;
let ultimoDiaExecutado = null;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

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

  return boolEnv("LEMBRETE_EVENTO_JOB_ENABLED", true);
}

function deveExecutarAgora() {
  const agora = obterAgoraSaoPaulo();
  const horaMinima = intEnv("LEMBRETE_EVENTO_JOB_HORA", DEFAULT_HORA_EXECUCAO, {
    min: 0,
    max: 23,
  });

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

/* ─────────────────────────────────────────────────────────────
   Execução
────────────────────────────────────────────────────────────── */

async function executarTickLembreteEventoJob(origem = "intervalo") {
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
      console.log("[lembreteEventoJob] Tick ignorado.", {
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
    console.log("[lembreteEventoJob] Executando lembretes de início de evento.", {
      origem,
      dia_execucao: decisao.agora.ymd,
      hora_execucao: `${String(decisao.agora.hora).padStart(2, "0")}:${String(
        decisao.agora.minuto
      ).padStart(2, "0")}`,
      timezone: TIMEZONE_OFICIAL,
    });

    const resultado = await executarLembretesInicioEvento({
      timezone: TIMEZONE_OFICIAL,
    });

    ultimoDiaExecutado = decisao.agora.ymd;

    console.log("[lembreteEventoJob] Execução concluída.", {
      dia_execucao: decisao.agora.ymd,
      data_referencia: resultado?.data?.data_referencia,
      resumo: resultado?.data?.resumo,
      code: resultado?.code,
    });

    return {
      ok: true,
      skipped: false,
      result: resultado,
    };
  } catch (error) {
    console.error("[lembreteEventoJob] Falha na execução.", {
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

/* ─────────────────────────────────────────────────────────────
   Start / Stop
────────────────────────────────────────────────────────────── */

function iniciarLembreteEventoJob() {
  if (!jobHabilitado()) {
    console.log("[lembreteEventoJob] Job desabilitado.");
    return null;
  }

  if (intervalHandle) {
    console.log("[lembreteEventoJob] Job já iniciado.");
    return intervalHandle;
  }

  const intervalMs = intEnv(
    "LEMBRETE_EVENTO_JOB_INTERVAL_MS",
    DEFAULT_INTERVAL_MS,
    {
      min: 60_000,
      max: 24 * 60 * 60 * 1000,
    }
  );

  console.log("[lembreteEventoJob] Job iniciado.", {
    timezone: TIMEZONE_OFICIAL,
    hora_minima: intEnv("LEMBRETE_EVENTO_JOB_HORA", DEFAULT_HORA_EXECUCAO, {
      min: 0,
      max: 23,
    }),
    intervalo_ms: intervalMs,
  });

  // Primeiro tick pouco depois do boot. Se o servidor subir depois das 9h,
  // executa no mesmo dia; se subir antes das 9h, aguarda os próximos ticks.
  setTimeout(() => {
    executarTickLembreteEventoJob("boot").catch((error) => {
      console.error("[lembreteEventoJob] Erro no tick inicial.", {
        message: error?.message,
        code: error?.code,
      });
    });
  }, 10_000).unref();

  intervalHandle = setInterval(() => {
    executarTickLembreteEventoJob("intervalo").catch((error) => {
      console.error("[lembreteEventoJob] Erro no tick periódico.", {
        message: error?.message,
        code: error?.code,
      });
    });
  }, intervalMs);

  intervalHandle.unref();

  return intervalHandle;
}

function pararLembreteEventoJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  running = false;

  console.log("[lembreteEventoJob] Job parado.");
}

module.exports = {
  iniciarLembreteEventoJob,
  pararLembreteEventoJob,
  executarTickLembreteEventoJob,

  _internals: {
    obterAgoraSaoPaulo,
    deveExecutarAgora,
  },
};