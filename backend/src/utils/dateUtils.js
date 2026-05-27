/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/utils/dateUtils.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Utilitário oficial de data/hora com proteção anti-fuso.
 *
 * Regras centrais:
 * - "YYYY-MM-DD" é date-only e NÃO deve virar Date automaticamente.
 * - Date-only deve ser mantido como string sempre que possível.
 * - Conversão para Date/UTC só deve ocorrer quando explicitamente necessário.
 * - Horário local deve ser interpretado com zona controlada.
 * - Exibição pt-BR de date-only não pode deslocar o dia.
 *
 * Não usar:
 * - new Date("YYYY-MM-DD")
 * - aliases de compatibilidade
 * - múltiplos nomes para a mesma função
 */

const { DateTime } = require("luxon");

const TZ_PADRAO = process.env.TZ_PADRAO || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   Validadores / primitivas
────────────────────────────────────────────────────────────── */

function isValidTimeZone(zone) {
  if (!zone || typeof zone !== "string") {
    return false;
  }

  return DateTime.now().setZone(zone).isValid;
}

function getSafeTimeZone(zone = TZ_PADRAO) {
  return isValidTimeZone(zone) ? zone : "America/Sao_Paulo";
}

function isValidYmdParts(year, month, day) {
  const yy = Number(year);
  const mm = Number(month);
  const dd = Number(day);

  if (!Number.isInteger(yy) || yy < 1900 || yy > 2200) return false;
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isInteger(dd) || dd < 1 || dd > 31) return false;

  const date = new Date(Date.UTC(yy, mm - 1, dd));

  return (
    date.getUTCFullYear() === yy &&
    date.getUTCMonth() === mm - 1 &&
    date.getUTCDate() === dd
  );
}

function isIsoDateOnly(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-");

  return isValidYmdParts(year, month, day);
}

function isHhmm(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hour, minute] = value.split(":").map(Number);

  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function isHhmmss(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) return false;

  const [hour, minute, second] = value.split(":").map(Number);

  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number.isInteger(second) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

/* ──────────────────────────────────────────────────────────────
   Helpers internos
────────────────────────────────────────────────────────────── */

function asDate(input) {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "string") {
    return parseIsoToDate(input);
  }

  return null;
}

function normalizeDateOnlyToYmd(input) {
  if (typeof input === "string" && isIsoDateOnly(input)) {
    return input;
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const year = input.getUTCFullYear();
    const month = String(input.getUTCMonth() + 1).padStart(2, "0");
    const day = String(input.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

function formatYmdFromUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addUtcDays(date, increment = 1) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + increment);

  return nextDate;
}

function parseHora(hora) {
  const raw = String(hora || "").trim();

  if (!raw) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      ok: true,
    };
  }

  if (isHhmm(raw)) {
    const [hour, minute] = raw.split(":").map(Number);

    return {
      hour,
      minute,
      second: 0,
      ok: true,
    };
  }

  if (isHhmmss(raw)) {
    const [hour, minute, second] = raw.split(":").map(Number);

    return {
      hour,
      minute,
      second,
      ok: true,
    };
  }

  return {
    hour: 0,
    minute: 0,
    second: 0,
    ok: false,
  };
}

function normalizeRange(start, end) {
  return start <= end ? [start, end] : [end, start];
}

/* ──────────────────────────────────────────────────────────────
   Parse / serialização UTC
────────────────────────────────────────────────────────────── */

/**
 * Converte ISO com horário para Date.
 *
 * Importante:
 * - Se receber "YYYY-MM-DD", retorna null de propósito.
 * - Para date-only, use dateOnlyToUtcDate explicitamente.
 */
function parseIsoToDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (isIsoDateOnly(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseUtc(isoUtc) {
  if (!isoUtc) {
    return null;
  }

  const date = new Date(isoUtc);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoUtc(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function dateOnlyToUtcDate(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) {
    return null;
  }

  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/* ──────────────────────────────────────────────────────────────
   Formatação pt-BR sem shift em date-only
────────────────────────────────────────────────────────────── */

function toBrDateOnlyString(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) {
    return "";
  }

  const [year, month, day] = yyyyMmDd.split("-");

  return `${day}/${month}/${year}`;
}

function toBrDate(input, timeZone = TZ_PADRAO) {
  if (typeof input === "string" && isIsoDateOnly(input)) {
    return toBrDateOnlyString(input);
  }

  const date = asDate(input);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getSafeTimeZone(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toBrDateTime(input, timeZone = TZ_PADRAO) {
  if (typeof input === "string" && isIsoDateOnly(input)) {
    return toBrDate(input, timeZone);
  }

  const date = asDate(input);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getSafeTimeZone(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/* ──────────────────────────────────────────────────────────────
   Conversões BR → ISO
────────────────────────────────────────────────────────────── */

function brDateToIsoDate(dataBr) {
  if (!dataBr || typeof dataBr !== "string") {
    return "";
  }

  const [day, month, year] = dataBr
    .split("/")
    .map((item) => String(item || "").trim());

  if (!/^\d{2}$/.test(day)) return "";
  if (!/^\d{2}$/.test(month)) return "";
  if (!/^\d{4}$/.test(year)) return "";

  if (!isValidYmdParts(year, month, day)) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

/**
 * Converte "dd/MM/aaaa" + "HH:mm[:ss]" interpretando a hora na zona informada.
 * Retorna ISO UTC.
 */
function brDateTimeToIsoUtc(dataBr, horaBr = "00:00", zone = TZ_PADRAO) {
  const isoDate = brDateToIsoDate(dataBr);

  if (!isoDate) {
    return null;
  }

  const parsedHora = parseHora(horaBr);

  if (!parsedHora.ok) {
    return null;
  }

  const [year, month, day] = isoDate.split("-").map(Number);

  const dateTime = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour: parsedHora.hour,
      minute: parsedHora.minute,
      second: parsedHora.second,
      millisecond: 0,
    },
    {
      zone: getSafeTimeZone(zone),
    }
  );

  if (!dateTime.isValid) {
    return null;
  }

  return dateTime.toUTC().toISO({
    suppressMilliseconds: true,
  });
}

/* ──────────────────────────────────────────────────────────────
   Geração de ocorrências de turma date-only
────────────────────────────────────────────────────────────── */

/**
 * Prioridade:
 * 1. datasEspecificas
 * 2. diasSemana
 * 3. intervalo completo
 */
function gerarOcorrencias({
  data_inicio,
  data_fim,
  datasEspecificas = [],
  diasSemana = [],
}) {
  if (Array.isArray(datasEspecificas) && datasEspecificas.length) {
    const uniqueDates = new Set(
      datasEspecificas
        .map((item) => normalizeDateOnlyToYmd(item))
        .filter((item) => isIsoDateOnly(item))
    );

    return Array.from(uniqueDates).sort();
  }

  const dataInicioYmd = normalizeDateOnlyToYmd(data_inicio);
  const dataFimYmd = normalizeDateOnlyToYmd(data_fim);

  if (!isIsoDateOnly(dataInicioYmd) || !isIsoDateOnly(dataFimYmd)) {
    return [];
  }

  const dataInicio = dateOnlyToUtcDate(dataInicioYmd);
  const dataFim = dateOnlyToUtcDate(dataFimYmd);

  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    return [];
  }

  if (Array.isArray(diasSemana) && diasSemana.length) {
    const diasDesejados = new Set(
      diasSemana
        .map((item) => Number(item))
        .filter(
          (item) => Number.isInteger(item) && item >= 0 && item <= 6
        )
    );

    const ocorrencias = [];

    for (
      let date = new Date(dataInicio);
      date <= dataFim;
      date = addUtcDays(date, 1)
    ) {
      if (diasDesejados.has(date.getUTCDay())) {
        ocorrencias.push(formatYmdFromUtcDate(date));
      }
    }

    return ocorrencias;
  }

  const ocorrencias = [];

  for (
    let date = new Date(dataInicio);
    date <= dataFim;
    date = addUtcDays(date, 1)
  ) {
    ocorrencias.push(formatYmdFromUtcDate(date));
  }

  return ocorrencias;
}

/* ──────────────────────────────────────────────────────────────
   Verificações de conflito date-only + HH:mm
────────────────────────────────────────────────────────────── */

function rangesDeDatasSobrepoem(dataInicioA, dataFimA, dataInicioB, dataFimB, opts = {}) {
  const { inclusive = true } = opts;

  const inicioA = normalizeDateOnlyToYmd(dataInicioA);
  const fimA = normalizeDateOnlyToYmd(dataFimA);
  const inicioB = normalizeDateOnlyToYmd(dataInicioB);
  const fimB = normalizeDateOnlyToYmd(dataFimB);

  if (
    !isIsoDateOnly(inicioA) ||
    !isIsoDateOnly(fimA) ||
    !isIsoDateOnly(inicioB) ||
    !isIsoDateOnly(fimB)
  ) {
    return false;
  }

  const [aInicio, aFim] = normalizeRange(inicioA, fimA);
  const [bInicio, bFim] = normalizeRange(inicioB, fimB);

  return inclusive
    ? !(aFim < bInicio || bFim < aInicio)
    : aFim > bInicio && bFim > aInicio;
}

function horasSobrepoem(horaInicioA, horaFimA, horaInicioB, horaFimB, opts = {}) {
  const { inclusive = false } = opts;

  const inicioA = String(horaInicioA || "").slice(0, 5);
  const fimA = String(horaFimA || "").slice(0, 5);
  const inicioB = String(horaInicioB || "").slice(0, 5);
  const fimB = String(horaFimB || "").slice(0, 5);

  if (
    !isHhmm(inicioA) ||
    !isHhmm(fimA) ||
    !isHhmm(inicioB) ||
    !isHhmm(fimB)
  ) {
    return false;
  }

  const [aInicio, aFim] = normalizeRange(inicioA, fimA);
  const [bInicio, bFim] = normalizeRange(inicioB, fimB);

  return inclusive
    ? aInicio <= bFim && bInicio <= aFim
    : aInicio < bFim && bInicio < aFim;
}

function turmasConflitam(turmaA, turmaB, opts = {}) {
  return (
    rangesDeDatasSobrepoem(
      turmaA?.data_inicio,
      turmaA?.data_fim,
      turmaB?.data_inicio,
      turmaB?.data_fim,
      {
        inclusive: true,
        ...opts,
      }
    ) &&
    horasSobrepoem(
      turmaA?.horario_inicio,
      turmaA?.horario_fim,
      turmaB?.horario_inicio,
      turmaB?.horario_fim,
      {
        inclusive: false,
        ...opts,
      }
    )
  );
}

/* ──────────────────────────────────────────────────────────────
   Funções zonadas Luxon
────────────────────────────────────────────────────────────── */

/**
 * Converte:
 * - data "YYYY-MM-DD" + hora "HH:mm" | "HH:mm:ss"
 * ou
 * - brIso "dd/MM/yyyy HH:mm[:ss]"
 * para DateTime zonado.
 */
function dateHourToZoned({ data, hora, brIso, zone = TZ_PADRAO }) {
  const safeZone = getSafeTimeZone(zone);

  if (brIso) {
    const input = String(brIso).trim();

    let dateTime = DateTime.fromFormat(input, "dd/MM/yyyy HH:mm:ss", {
      zone: safeZone,
    });

    if (!dateTime.isValid) {
      dateTime = DateTime.fromFormat(input, "dd/MM/yyyy HH:mm", {
        zone: safeZone,
      });
    }

    return dateTime;
  }

  if (!isIsoDateOnly(data)) {
    return DateTime.invalid("Data inválida. Esperado YYYY-MM-DD.");
  }

  const parsedHora = parseHora(hora);

  if (!parsedHora.ok) {
    return DateTime.invalid("Hora inválida. Esperado HH:mm ou HH:mm:ss.");
  }

  const [year, month, day] = data.split("-").map(Number);

  return DateTime.fromObject(
    {
      year,
      month,
      day,
      hour: parsedHora.hour,
      minute: parsedHora.minute,
      second: parsedHora.second,
      millisecond: 0,
    },
    {
      zone: safeZone,
    }
  );
}

function nowZoned(zone = TZ_PADRAO) {
  return DateTime.now().setZone(getSafeTimeZone(zone));
}

function canSubmitUntil(deadlineZoned, now = nowZoned()) {
  if (!deadlineZoned || typeof deadlineZoned.toMillis !== "function") {
    return false;
  }

  if (!deadlineZoned.isValid) {
    return false;
  }

  if (!now || !now.isValid) {
    return false;
  }

  return now.toMillis() <= deadlineZoned.toMillis();
}

function formatDateTimeDiagnostic(dateTime, zone = TZ_PADRAO) {
  if (!dateTime || typeof dateTime.toISO !== "function") {
    return {
      valid: false,
      reason: "not_a_datetime",
    };
  }

  if (!dateTime.isValid) {
    return {
      valid: false,
      reason: dateTime.invalidReason,
      explanation: dateTime.invalidExplanation,
    };
  }

  const safeZone = getSafeTimeZone(zone);
  const zoned = dateTime.setZone(safeZone);

  return {
    valid: true,
    zoned: zoned.toISO({
      suppressMilliseconds: true,
    }),
    utc: zoned.toUTC().toISO({
      suppressMilliseconds: true,
    }),
    epoch: zoned.toMillis(),
    zone: safeZone,
  };
}

/* ──────────────────────────────────────────────────────────────
   Exports oficiais
────────────────────────────────────────────────────────────── */

module.exports = {
  TZ_PADRAO,

  isValidTimeZone,
  getSafeTimeZone,

  isIsoDateOnly,
  isHhmm,
  isHhmmss,

  parseIsoToDate,
  parseUtc,
  toIsoUtc,
  dateOnlyToUtcDate,

  toBrDateOnlyString,
  toBrDate,
  toBrDateTime,

  brDateToIsoDate,
  brDateTimeToIsoUtc,

  gerarOcorrencias,

  rangesDeDatasSobrepoem,
  horasSobrepoem,
  turmasConflitam,

  dateHourToZoned,
  nowZoned,
  canSubmitUntil,
  formatDateTimeDiagnostic,
};