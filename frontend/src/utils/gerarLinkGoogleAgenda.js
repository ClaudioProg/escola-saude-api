// 📁 src/utils/gerarLinkGoogleAgenda.js — v2.0

import {
  addDaysYMD,
  datetimeLocalToWall,
  extractYmd,
  isDateOnly,
  isIsoWithTimezone,
  isWallDateTime,
} from "./dateTime";

/**
 * Gera link do Google Calendar com proteção anti-fuso.
 *
 * Regras:
 * - "YYYY-MM-DD" + "YYYY-MM-DD" => evento all-day.
 * - "YYYY-MM-DD HH:mm[:ss]" => horário de parede com ctz.
 * - "YYYY-MM-DDTHH:mm[:ss]" => tratado como horário de parede.
 * - ISO com Z/offset ou Date => instante absoluto convertido para UTC.
 *
 * Não usar:
 * - Date local para interpretar horário de parede da plataforma.
 * - helpers duplicados de data.
 */

const DEFAULT_TZ = "America/Sao_Paulo";

const MAX_TITLE = 300;
const MAX_DETAILS = 4000;
const MAX_LOCATION = 1000;
const MAX_ATTENDEES = 50;

function sanitizeText(input = "") {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function clampText(input, maxLength) {
  const text = sanitizeText(input);

  if (!Number.isFinite(maxLength) || maxLength <= 0) {
    return text;
  }

  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function normalizeTz(tz) {
  const value = String(tz || DEFAULT_TZ).trim();

  try {
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: value,
    });

    return value;
  } catch {
    return DEFAULT_TZ;
  }
}

function normalizeRRule(rrule) {
  const value = String(rrule || "").trim();

  if (!value) {
    return "";
  }

  if (!/^[A-Z0-9=;,_-]+$/i.test(value)) {
    return "";
  }

  return value.toUpperCase();
}

function setIf(url, key, value) {
  if (value === null || value === undefined) {
    return;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return;
  }

  url.searchParams.set(key, normalized);
}

function ymdToGoogleDate(ymd) {
  return String(ymd || "").replace(/-/g, "");
}

function wallToGoogleLocalStamp(wall) {
  if (!isWallDateTime(wall)) {
    return "";
  }

  const [ymd, time] = wall.trim().split(/\s+/);
  const [hour = "00", minute = "00", second = "00"] = time.split(":");

  return `${ymd.replace(/-/g, "")}T${hour}${minute}${second}`;
}

function normalizeToWallDateTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  const normalized = datetimeLocalToWall(value);

  if (isWallDateTime(normalized)) {
    return normalized;
  }

  const text = String(value).trim().replace("T", " ");

  if (text.length === 16 && isWallDateTime(`${text}:00`)) {
    return `${text}:00`;
  }

  if (isWallDateTime(text)) {
    return text.length === 16 ? `${text}:00` : text;
  }

  return "";
}

function isInstantInput(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return typeof value === "string" && isIsoWithTimezone(value);
}

function toGoogleUtcStamp(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function addMinutesToWall(wall, minutes) {
  if (!isWallDateTime(wall)) {
    return "";
  }

  const [ymd, time] = wall.trim().split(/\s+/);
  const [year, month, day] = ymd.split("-").map(Number);
  const [hourRaw = "00", minuteRaw = "00", secondRaw = "00"] = time.split(":");

  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const increment = Number(minutes);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    !Number.isFinite(increment)
  ) {
    return "";
  }

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute + Math.trunc(increment), second)
  );

  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");

  return `${yy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function normalizeAttendees(attendees) {
  if (!Array.isArray(attendees)) {
    return [];
  }

  const seen = new Set();
  const emails = [];

  for (const item of attendees) {
    const email = String(item || "").trim().toLowerCase();

    if (!email || seen.has(email)) {
      continue;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      continue;
    }

    seen.add(email);
    emails.push(email);

    if (emails.length >= MAX_ATTENDEES) {
      break;
    }
  }

  return emails;
}

function resolveDatesParam({ dataInicio, dataFim }) {
  const inicioTexto = String(dataInicio || "").trim();
  const fimTexto = String(dataFim || "").trim();

  const isAllDay = isDateOnly(inicioTexto) && isDateOnly(fimTexto);

  if (isAllDay) {
    const inicio = inicioTexto;
    const fimInclusivo = fimTexto >= inicioTexto ? fimTexto : inicioTexto;
    const fimExclusivo = addDaysYMD(fimInclusivo, 1);

    return `${ymdToGoogleDate(inicio)}/${ymdToGoogleDate(fimExclusivo)}`;
  }

  const inicioWall = normalizeToWallDateTime(dataInicio);
  const fimWall = normalizeToWallDateTime(dataFim);

  if (inicioWall) {
    const fimResolvido =
      fimWall && fimWall > inicioWall ? fimWall : addMinutesToWall(inicioWall, 90);

    return `${wallToGoogleLocalStamp(inicioWall)}/${wallToGoogleLocalStamp(
      fimResolvido
    )}`;
  }

  if (isInstantInput(dataInicio)) {
    const inicioUtc = toGoogleUtcStamp(dataInicio);

    if (!inicioUtc) {
      throw new Error("dataInicio inválida para gerar link do Google Agenda.");
    }

    let fimUtc = "";

    if (isInstantInput(dataFim)) {
      fimUtc = toGoogleUtcStamp(dataFim);
    }

    if (!fimUtc || fimUtc <= inicioUtc) {
      const inicioDate =
        dataInicio instanceof Date ? dataInicio : new Date(dataInicio);

      fimUtc = toGoogleUtcStamp(new Date(inicioDate.getTime() + 90 * 60 * 1000));
    }

    return `${inicioUtc}/${fimUtc}`;
  }

  throw new Error("dataInicio inválida para gerar link do Google Agenda.");
}

export function gerarLinkGoogleAgenda({
  titulo,
  dataInicio,
  dataFim,
  descricao = "",
  local = "",
  ctz = DEFAULT_TZ,
  attendees,
  rrule,
}) {
  const title = clampText(titulo || "Evento", MAX_TITLE);
  const details = clampText(descricao || "", MAX_DETAILS);
  const place = clampText(local || "", MAX_LOCATION);
  const tz = normalizeTz(ctz);

  const url = new URL("https://www.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("sf", "true");

  setIf(url, "text", title);
  setIf(url, "details", details);
  setIf(url, "location", place);
  setIf(url, "ctz", tz);

  url.searchParams.set(
    "dates",
    resolveDatesParam({
      dataInicio,
      dataFim,
    })
  );

  const emails = normalizeAttendees(attendees);

  if (emails.length) {
    url.searchParams.set("add", emails.join(","));
  }

  const recur = normalizeRRule(rrule);

  if (recur) {
    url.searchParams.set("recur", `RRULE:${recur}`);
  }

  return url.toString();
}

export function gerarLinkGoogleAgendaAllDay({
  titulo,
  dataInicio,
  dataFim,
  descricao = "",
  local = "",
  ctz = DEFAULT_TZ,
  attendees,
  rrule,
}) {
  const inicio = extractYmd(String(dataInicio ?? ""));
  const fim = extractYmd(String(dataFim ?? "")) || inicio;

  if (!isDateOnly(inicio)) {
    throw new Error("dataInicio inválida para evento all-day.");
  }

  return gerarLinkGoogleAgenda({
    titulo,
    dataInicio: inicio,
    dataFim: isDateOnly(fim) ? fim : inicio,
    descricao,
    local,
    ctz,
    attendees,
    rrule,
  });
}