/**
 * 📌 utils/gerarLinkGoogleAgenda.js — PREMIUM++
 *
 * Gera link do Google Calendar a partir de datas LOCAIS, sem “pulo de data”.
 * - Aceita: Date | "YYYY-MM-DD" | "YYYY-MM-DD HH:mm" | "YYYY-MM-DDTHH:mm(:ss?)"
 *           | ISO com Z/offset ("2025-09-03T14:00:00Z" | "2025-09-03T14:00:00-03:00")
 * - Detecta automaticamente eventos ALL-DAY quando ambas as entradas são apenas data.
 * - Sanitiza texto (remove chars de controle, normaliza quebras) e limita tamanho.
 * - Parâmetros opcionais: attendees[], rrule.
 */

const DEFAULT_TZ = "America/Sao_Paulo";

const MAX_TITLE = 300;
const MAX_DETAILS = 4000;
const MAX_LOCATION = 1000;

/* ──────────────────────────────────────────────────────────────
   Helpers de texto
   ────────────────────────────────────────────────────────────── */
function sanitizeText(input = "") {
  const s = String(input ?? "");
  const cleaned = s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "");
  return cleaned.replace(/\r\n?/g, "\n").trim();
}

function clampText(input, maxLen) {
  const s = sanitizeText(input);
  if (!Number.isFinite(maxLen) || maxLen <= 0) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/* ──────────────────────────────────────────────────────────────
   Helpers de data/hora
   ────────────────────────────────────────────────────────────── */
function isValidYmdParts(y, m, d) {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);

  if (!Number.isInteger(yy) || yy < 1900 || yy > 2200) return false;
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isInteger(dd) || dd < 1 || dd > 31) return false;

  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  return (
    dt.getUTCFullYear() === yy &&
    dt.getUTCMonth() === mm - 1 &&
    dt.getUTCDate() === dd
  );
}

function isAllDayLike(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-");
  return isValidYmdParts(y, m, d);
}

function hasExplicitOffsetOrZ(s) {
  return /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateToYMDLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Constrói Date no fuso LOCAL sem shift indesejado.
 * - ISO com Z/offset → respeita a zona embutida.
 * - "YYYY-MM-DD" → local 00:00.
 * - "YYYY-MM-DD[ T]HH:mm[:ss]" → local no horário informado.
 * - Date → retorna a própria instância (se válida).
 */
function toLocalDate(dateLike) {
  if (dateLike instanceof Date) {
    return isNaN(dateLike) ? new Date(NaN) : dateLike;
  }

  const s = String(dateLike || "").trim();
  if (!s) return new Date(NaN);

  if (hasExplicitOffsetOrZ(s)) {
    const d = new Date(s);
    return isNaN(d) ? new Date(NaN) : d;
  }

  if (isAllDayLike(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  const norm = s.replace(" ", "T");
  const m = norm.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!m) return new Date(NaN);

  const [, y, mo, d, HH, MM, SS = "00"] = m;
  if (!isValidYmdParts(y, mo, d)) return new Date(NaN);

  const hh = Number(HH);
  const mm = Number(MM);
  const ss = Number(SS);

  if (
    !Number.isInteger(hh) || hh < 0 || hh > 23 ||
    !Number.isInteger(mm) || mm < 0 || mm > 59 ||
    !Number.isInteger(ss) || ss < 0 || ss > 59
  ) {
    return new Date(NaN);
  }

  return new Date(Number(y), Number(mo) - 1, Number(d), hh, mm, ss, 0);
}

/** Date → YYYYMMDDTHHMMSSZ (UTC) para Google */
function toGoogleUtcStamp(d) {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** YYYY-MM-DD → YYYYMMDD */
function ymdToGoogleDate(ymd) {
  return ymd.replace(/-/g, "");
}

/** Converte entrada diversa para YYYY-MM-DD local */
function toYMD(input) {
  if (!input) return "";
  if (typeof input === "string" && isAllDayLike(input)) return input;

  const d = toLocalDate(input);
  if (isNaN(d)) return "";
  return dateToYMDLocal(d);
}

/* ──────────────────────────────────────────────────────────────
   Helpers de query
   ────────────────────────────────────────────────────────────── */
function setIf(url, key, value) {
  if (value === null || value === undefined) return;
  const v = String(value).trim();
  if (!v) return;
  url.searchParams.set(key, v);
}

function normalizeTz(tz) {
  const s = String(tz || DEFAULT_TZ).trim();
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: s });
    return s;
  } catch {
    return DEFAULT_TZ;
  }
}

function normalizeRRule(rrule) {
  const s = String(rrule || "").trim();
  if (!s) return "";
  if (!/^[A-Z0-9=;,_-]+$/i.test(s)) return "";
  return s.toUpperCase();
}

/* ──────────────────────────────────────────────────────────────
   API pública
   ────────────────────────────────────────────────────────────── */
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
  const title = clampText(titulo || "", MAX_TITLE);
  const details = clampText(descricao || "", MAX_DETAILS);
  const place = clampText(local || "", MAX_LOCATION);
  const tz = normalizeTz(ctz);

  const s = String(dataInicio || "").trim();
  const e = String(dataFim || "").trim();
  const isAllDay = isAllDayLike(s) && isAllDayLike(e);

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  setIf(url, "text", title);
  setIf(url, "details", details);
  setIf(url, "location", place);
  setIf(url, "ctz", tz);
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");

  if (isAllDay) {
    const [ys, ms, ds] = s.split("-").map(Number);
    const [ye, me, de] = e.split("-").map(Number);

    const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0);
    let end = new Date(ye, me - 1, de, 0, 0, 0, 0);

    if (isNaN(start) || isNaN(end)) {
      throw new Error("Datas inválidas para evento all-day.");
    }

    if (end <= start) {
      end = new Date(start.getTime());
    }
    end.setDate(end.getDate() + 1); // fim exclusivo

    url.searchParams.set(
      "dates",
      `${ymdToGoogleDate(dateToYMDLocal(start))}/${ymdToGoogleDate(dateToYMDLocal(end))}`
    );
  } else {
    const startLocal = toLocalDate(dataInicio);
    let endLocal = toLocalDate(dataFim);

    if (!(startLocal instanceof Date) || isNaN(startLocal)) {
      throw new Error("dataInicio inválida para gerar link do Google Agenda.");
    }

    if (!(endLocal instanceof Date) || isNaN(endLocal)) {
      endLocal = new Date(startLocal.getTime() + 90 * 60 * 1000);
    }

    if (endLocal <= startLocal) {
      endLocal = new Date(startLocal.getTime() + 60 * 1000);
    }

    url.searchParams.set(
      "dates",
      `${toGoogleUtcStamp(startLocal)}/${toGoogleUtcStamp(endLocal)}`
    );
  }

  if (Array.isArray(attendees) && attendees.length) {
    const emails = attendees
      .map((x) => String(x || "").trim())
      .filter((x) => x && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));

    if (emails.length) {
      url.searchParams.set("add", emails.join(","));
    }
  }

  const recur = normalizeRRule(rrule);
  if (recur) {
    url.searchParams.set("recur", `RRULE:${recur}`);
  }

  return url.toString();
}

/**
 * Atalho explícito para evento ALL-DAY.
 * Aceita YYYY-MM-DD ou Date.
 */
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
  const startYMD = toYMD(dataInicio);
  const endYMD = toYMD(dataFim);

  return gerarLinkGoogleAgenda({
    titulo,
    dataInicio: startYMD,
    dataFim: endYMD,
    descricao,
    local,
    ctz,
    attendees,
    rrule,
  });
}