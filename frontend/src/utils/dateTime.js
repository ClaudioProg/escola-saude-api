// 📁 frontend/src/utils/dateTime.js — v2.0
//
// Utilitário oficial de data/hora do frontend.
//
// Regras:
// - Data "date-only" trafega como string "YYYY-MM-DD".
// - Nunca usar new Date("YYYY-MM-DD").
// - Prazo local/parede trafega como "YYYY-MM-DD HH:mm:ss" sem fuso.
// - Exibição deve preservar o dia.
// - Comparações YMD devem ser feitas por string quando possível.
// - Quando Date for necessário, construir explicitamente por partes.
//
// Não usar:
// - funções legadas
// - aliases antigos
// - múltiplos nomes para a mesma formatação

export const ZONA_PADRAO = "America/Sao_Paulo";

const MS_DIA = 24 * 60 * 60 * 1000;

/* ─────────────────────────────────────────
   Validação
───────────────────────────────────────── */

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

export function isDateOnly(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-");

  return isValidYmdParts(year, month, day);
}

export function isYearMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isHhmm(value) {
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

export function isHhmmss(value) {
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

export function isUtcMidnight(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.\d{1,3})?)?Z$/.test(value)
  );
}

export function isWallDateTime(value) {
  if (typeof value !== "string") return false;

  const text = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return false;
  }

  const [ymd, time] = text.split(/\s+/);

  return isDateOnly(ymd) && (isHhmm(time) || isHhmmss(time));
}

export function isIsoWithTimezone(value) {
  return (
    typeof value === "string" &&
    (/[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value))
  );
}

/* ─────────────────────────────────────────
   Extração / normalização
───────────────────────────────────────── */

export function extractYmd(value) {
  const ymd = typeof value === "string" ? value.slice(0, 10) : "";

  return isDateOnly(ymd) ? ymd : "";
}

export function normalizeDateOnly(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (isDateOnly(value)) return value;
    if (isUtcMidnight(value)) return extractYmd(value);
    if (isWallDateTime(value)) return extractYmd(value);

    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

export function dateOnlyToLocalDate(value) {
  if (!isDateOnly(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateOnlyToUtcDate(value) {
  if (!isDateOnly(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDate(input) {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      return dateOnlyToLocalDate(input);
    }

    const date = new Date(input);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(input);

  return Number.isNaN(date.getTime()) ? null : date;
}

/* ─────────────────────────────────────────
   Formatação
───────────────────────────────────────── */

function formatDateOnlyBr(value) {
  if (!isDateOnly(value)) return "";

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

export function formatWallDateTimeBr(value) {
  if (!isWallDateTime(value)) return "";

  const [ymd, time] = value.trim().split(/\s+/);
  const [year, month, day] = ymd.split("-");
  const [hour, minute] = time.split(":");

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function formatWallDateOnlyBr(value) {
  if (!isWallDateTime(value)) return "";

  const [ymd] = value.trim().split(/\s+/);

  return formatDateOnlyBr(ymd);
}

function formatWithIntl(date, options) {
  try {
    return new Intl.DateTimeFormat("pt-BR", options).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    if (options.hour !== undefined) {
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");

      return `${day}/${month}/${year} ${hour}:${minute}`;
    }

    return `${day}/${month}/${year}`;
  }
}

export function formatDateBr(value, zone = ZONA_PADRAO) {
  if (typeof value === "string") {
    if (isDateOnly(value)) return formatDateOnlyBr(value);
    if (isUtcMidnight(value)) return formatDateOnlyBr(extractYmd(value));
    if (isWallDateTime(value)) return formatWallDateOnlyBr(value);
  }

  const date = toDate(value);

  if (!date) return "";

  return formatWithIntl(date, {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeBr(value, zone = ZONA_PADRAO) {
  if (typeof value === "string") {
    if (isDateOnly(value) || isUtcMidnight(value)) {
      return formatDateBr(value, zone);
    }

    if (isWallDateTime(value)) {
      return formatWallDateTimeBr(value);
    }
  }

  const date = toDate(value);

  if (!date) return "";

  return formatWithIntl(date, {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ─────────────────────────────────────────
   Conversões BR / ISO
───────────────────────────────────────── */

export function brDateToIsoDate(value) {
  if (!value || typeof value !== "string") return "";

  const parts = value.split("/");

  if (parts.length !== 3) return "";

  const [day, month, year] = parts.map((part) => String(part || "").trim());

  if (!/^\d{2}$/.test(day)) return "";
  if (!/^\d{2}$/.test(month)) return "";
  if (!/^\d{4}$/.test(year)) return "";

  if (!isValidYmdParts(year, month, day)) return "";

  return `${year}-${month}-${day}`;
}

export function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);

  if (!isoDate) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  const [hourRaw = "00", minuteRaw = "00"] = String(horaBr || "00:00").split(":");

  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const local = new Date(year, month - 1, day, hour, minute, 0, 0);

  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/* ─────────────────────────────────────────
   Wall datetime / input datetime-local
───────────────────────────────────────── */

export function datetimeLocalToWall(value) {
  if (!value) return "";

  const text = String(value).trim().replace("T", " ");

  if (!text) return "";

  const normalized = text.length === 16 ? `${text}:00` : text;

  return isWallDateTime(normalized) ? normalized : "";
}

export function wallToDatetimeLocal(value) {
  if (!isWallDateTime(value)) return "";

  const [ymd, time] = value.trim().split(/\s+/);
  const [hour, minute] = time.split(":");

  return `${ymd}T${hour}:${minute}`;
}

export function isoToDatetimeLocalInZone(iso, zone = ZONA_PADRAO) {
  if (!iso || typeof iso !== "string") return "";
  if (!isIsoWithTimezone(iso)) return "";

  try {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);

    const get = (type) =>
      parts.find((part) => part.type === type)?.value?.padStart?.(2, "0") || "";

    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");

    if (!year || !month || !day || !hour || !minute) return "";

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────
   Intervalo / cálculo YMD
───────────────────────────────────────── */

export function gerarIntervaloDeDatas(dataInicio, dataFim) {
  const inicio = normalizeDateOnly(dataInicio);
  const fim = normalizeDateOnly(dataFim);

  if (!isDateOnly(inicio) || !isDateOnly(fim)) return [];
  if (inicio > fim) return [];

  const start = dateOnlyToUtcDate(inicio);
  const end = dateOnlyToUtcDate(fim);

  if (!start || !end) return [];

  const datas = [];

  for (
    let cursor = new Date(start.getTime());
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");

    datas.push(`${year}-${month}-${day}`);
  }

  return datas;
}

export function addDaysYMD(ymd, days = 0) {
  if (!isDateOnly(ymd)) return ymd || "";

  const increment = Number(days);

  if (!Number.isFinite(increment)) return ymd;

  const date = dateOnlyToUtcDate(ymd);

  if (!date) return ymd;

  date.setUTCDate(date.getUTCDate() + Math.trunc(increment));

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function diffDaysYMD(startYmd, endYmd) {
  if (!isDateOnly(startYmd) || !isDateOnly(endYmd)) return NaN;

  const start = dateOnlyToUtcDate(startYmd);
  const end = dateOnlyToUtcDate(endYmd);

  if (!start || !end) return NaN;

  return Math.round((end.getTime() - start.getTime()) / MS_DIA);
}

export function compareYMD(a, b) {
  if (!isDateOnly(a) || !isDateOnly(b)) return NaN;
  if (a === b) return 0;

  return a < b ? -1 : 1;
}

export function isInRangeYMD(ymd, inicio, fim) {
  if (!isDateOnly(ymd) || !isDateOnly(inicio) || !isDateOnly(fim)) {
    return false;
  }

  return ymd >= inicio && ymd <= fim;
}

export function nowYmdInZone(zone = ZONA_PADRAO) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
}

/* ─────────────────────────────────────────
   Hora / idade
───────────────────────────────────────── */

export function parseHoraBr(value = "00:00") {
  const [hourRaw = "00", minuteRaw = "00"] = String(value).split(":");

  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);

  return {
    hh: Number.isInteger(hour) ? Math.max(0, Math.min(23, hour)) : 0,
    mm: Number.isInteger(minute) ? Math.max(0, Math.min(59, minute)) : 0,
  };
}

export function idadeDe(nascimentoYmd, hojeYmd = nowYmdInZone()) {
  const nascimento = extractYmd(String(nascimentoYmd ?? ""));

  if (!isDateOnly(nascimento)) return null;
  if (!isDateOnly(hojeYmd)) return null;

  const [birthYear, birthMonth, birthDay] = nascimento.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = hojeYmd.split("-").map(Number);

  let idade = todayYear - birthYear;

  const monthDiff = todayMonth - birthMonth;

  if (monthDiff < 0 || (monthDiff === 0 && todayDay < birthDay)) {
    idade -= 1;
  }

  return idade >= 0 && idade < 140 ? idade : null;
}

/* ─────────────────────────────────────────
   Outros utilitários
───────────────────────────────────────── */

export function formatarCPF(cpf) {
  if (!cpf) return "";

  const num = String(cpf).replace(/\D/g, "");

  if (num.length !== 11) return String(cpf);

  return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}