/**
 * 📌 utils/gerarLinkGoogleAgenda.js (versão premium)
 *
 * Gera link do Google Calendar a partir de datas LOCAIS, sem “pulo de data”.
 * - Aceita: Date | "YYYY-MM-DD" | "YYYY-MM-DD HH:mm" | "YYYY-MM-DDTHH:mm(:ss?)"
 *           | ISO com Z/offset ("2025-09-03T14:00:00Z" | "2025-09-03T14:00:00-03:00")
 * - Detecta automaticamente eventos ALL-DAY quando ambas as entradas são apenas data.
 * - Sanitiza texto (remove chars de controle, normaliza quebras) e limita tamanho.
 * - Parâmetros opcionais (sem quebrar a API atual): attendees[], rrule.
 */

const DEFAULT_TZ = "America/Sao_Paulo";

// Limites conservadores
const MAX_TITLE = 300;
const MAX_DETAILS = 4000;
const MAX_LOCATION = 1000;

// ──────────────────────────────────────────────────────────────
// Helpers de texto (segurança / UX)
// ──────────────────────────────────────────────────────────────

/** Remove caracteres de controle (exceto \n e \t) e normaliza espaços/linhas. */
function sanitizeText(input = "") {
  const s = String(input);
  const cleaned = s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "");
  return cleaned.replace(/\r\n?/g, "\n").trim();
}

/** Aplica sanitize + corte por tamanho. */
function clampText(input, maxLen) {
  const s = sanitizeText(input);
  if (!Number.isFinite(maxLen) || maxLen <= 0) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// ──────────────────────────────────────────────────────────────
// Helpers de data/hora
// ──────────────────────────────────────────────────────────────

function isAllDayLike(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ISO com Z ou offset +HH:mm / -HH:mm
function hasExplicitOffsetOrZ(s) {
  return /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
}

/**
 * Constrói Date no fuso LOCAL sem shift indesejado.
 * - ISO com Z/offset → respeita a zona embutida.
 * - "YYYY-MM-DD" → local 00:00.
 * - "YYYY-MM-DD[ T]HH:mm[:ss]" → local no horário informado.
 * - Date → retorna a própria instância (se válida).
 */
function toLocalDate(dateLike) {
  if (dateLike instanceof Date) return isNaN(dateLike) ? new Date(NaN) : dateLike;

  const s = String(dateLike || "").trim();
  if (!s) return new Date(NaN);

  if (hasExplicitOffsetOrZ(s)) {
    const d = new Date(s);
    return isNaN(d) ? new Date(NaN) : d;
  }

  if (isAllDayLike(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0); // local
  }

  const norm = s.replace(" ", "T");
  const [datePart, timePartRaw = "00:00"] = norm.split("T");
  const [y, m, d] = (datePart || "").split("-").map((n) => parseInt(n, 10));
  const [HH = "00", MM = "00", SS = "00"] = (timePartRaw || "").split(":");

  const hh = parseInt(HH, 10) || 0;
  const mm = parseInt(MM, 10) || 0;
  const ss = parseInt(SS, 10) || 0;

  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss, 0); // local
}

/** Date → "YYYYMMDDTHHMMSSZ" (UTC) para Google */
function toGoogleUtcStamp(d) {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** "YYYY-MM-DD" → "YYYYMMDD" (all-day) */
function ymdToGoogleDate(ymd) {
  return ymd.replace(/-/g, "");
}

/** Converte entrada diversa para "YYYY-MM-DD" (local). */
function toYMD(input) {
  if (!input) return "";
  if (typeof input === "string" && isAllDayLike(input)) return input;

  const d = toLocalDate(input);
  if (isNaN(d)) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ──────────────────────────────────────────────────────────────
// Helpers de query
// ──────────────────────────────────────────────────────────────

/** Seta o param na URL apenas se houver valor não-vazio. */
function setIf(url, key, value) {
  if (value === null || value === undefined) return;
  const v = String(value).trim();
  if (!v) return;
  url.searchParams.set(key, v);
}

/** Validação mínima de timezone IANA (aceita algo como "Area/City"). */
function normalizeTz(tz) {
  const s = String(tz || DEFAULT_TZ).trim();
  return /^([A-Za-z_]+\/[A-Za-z0-9_\-+]+)$/.test(s) ? s : DEFAULT_TZ;
}

// ──────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────

/**
 * Gera um link do Google Calendar.
 *
 * @param {Object} params
 * @param {string} params.titulo
 * @param {string|Date} params.dataInicio  - Local time ou YMD
 * @param {string|Date} params.dataFim     - Local time ou YMD
 * @param {string} [params.descricao=""]
 * @param {string} [params.local=""]
 * @param {string} [params.ctz="America/Sao_Paulo"] - Timezone de exibição no Google
 * @param {string[]} [params.attendees]    - e-mails dos convidados (opcional)
 * @param {string} [params.rrule]          - RRULE (ex.: "FREQ=DAILY;COUNT=5") (opcional)
 * @returns {string}
 */
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

  const s = String(dataInicio || "");
  const e = String(dataFim || "");
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
    // Para all-day o Google usa [start, end) em YYYYMMDD/YYYYMMDD (end exclusivo)
    const [ys, ms, ds] = s.split("-").map(Number);
    const [ye, me, de] = e.split("-").map(Number);

    const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0);
    let end = new Date(ye, me - 1, de, 0, 0, 0, 0);

    if (isNaN(start) || isNaN(end)) {
      throw new Error("Datas inválidas para evento all-day.");
    }

    if (end <= start) {
      end = new Date(start.getTime());
      end.setDate(end.getDate() + 1);
    } else {
      // fim exclusivo: soma 1 dia
      end.setDate(end.getDate() + 1);
    }

    const startStr = ymdToGoogleDate(
      `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
        start.getDate()
      ).padStart(2, "0")}`
    );
    const endStr = ymdToGoogleDate(
      `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
        end.getDate()
      ).padStart(2, "0")}`
    );

    url.searchParams.set("dates", `${startStr}/${endStr}`);
  } else {
    // Com horário → transformar local → UTC (carimbo 'Z')
    const startLocal = toLocalDate(dataInicio);
    let endLocal = toLocalDate(dataFim);

    if (!(startLocal instanceof Date) || isNaN(startLocal)) {
      throw new Error("dataInicio inválida para gerar link do Google Agenda.");
    }

    // Fim ausente → +90min; fim <= início → +1min
    if (!(endLocal instanceof Date) || isNaN(endLocal)) {
      endLocal = new Date(startLocal.getTime() + 90 * 60 * 1000);
    }
    if (endLocal <= startLocal) {
      endLocal = new Date(startLocal.getTime() + 60 * 1000);
    }

    const inicioUTC = toGoogleUtcStamp(startLocal);
    const fimUTC = toGoogleUtcStamp(endLocal);
    url.searchParams.set("dates", `${inicioUTC}/${fimUTC}`);
  }

  // Convidados (opcional). Google aceita param "add" com e-mails separados por vírgula.
  if (Array.isArray(attendees) && attendees.length) {
    const emails = attendees
      .map((x) => String(x || "").trim())
      .filter((x) => x && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (emails.length) {
      url.searchParams.set("add", emails.join(","));
    }
  }

  // Recorrência (opcional): RRULE simples, ex.: "FREQ=DAILY;COUNT=5"
  if (rrule && /^[A-Z]+=[^;]+(?:;[A-Z]+=[^;]+)*$/.test(rrule)) {
    url.searchParams.set("recur", `RRULE:${rrule}`);
  }

  return url.toString();
}

/**
 * Atalho explícito para evento ALL-DAY.
 * Aceita "YYYY-MM-DD" ou Date (usaremos apenas a parte YMD local).
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
