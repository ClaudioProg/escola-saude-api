/**
 * 📌 utils/gerarLinkGoogleAgenda.js
 *
 * Gera link do Google Calendar a partir de datas LOCAIS, sem “pulo de data”.
 * - Aceita: Date | "YYYY-MM-DD" | "YYYY-MM-DD HH:mm" | "YYYY-MM-DDTHH:mm(:ss?)"
 *           | ISO com Z/offset ("2025-09-03T14:00:00Z" | "2025-09-03T14:00:00-03:00")
 * - Detecta automaticamente eventos ALL-DAY quando ambas as entradas são apenas data.
 * - Sanitiza texto para segurança (remove chars de controle, normaliza quebras).
 * - Encurta campos para evitar URLs excessivamente longas.
 */

const DEFAULT_TZ = "America/Sao_Paulo";

// limites conservadores para querystring (Google aceita mais, mas evitamos excessos)
const MAX_TITLE = 300;
const MAX_DETAILS = 4000;
const MAX_LOCATION = 1000;

/* ──────────────────────────────────────────────────────────────
   Helpers de texto (segurança / UX)
   ────────────────────────────────────────────────────────────── */

/** Remove caracteres de controle (exceto \n) e normaliza espaços. */
function sanitizeText(input = "") {
  const s = String(input);
  // Remove controles (0x00–0x1F e 0x7F), preservando \n (0x0A) e \t (0x09)
  const cleaned = s.replace(
    /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g,
    ""
  );
  // Normaliza CRLF/CR para LF e comprime espaços em excesso
  return cleaned.replace(/\r\n?/g, "\n").trim();
}

/** Aplica sanitize + corte por tamanho. */
function clampText(input, maxLen) {
  const s = sanitizeText(input);
  if (!Number.isFinite(maxLen) || maxLen <= 0) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/* ──────────────────────────────────────────────────────────────
   Helpers de data/hora
   ────────────────────────────────────────────────────────────── */

function isAllDayLike(s) {
  // Ex.: "2025-11-03" (sem horas)
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function hasExplicitOffsetOrZ(s) {
  // ISO com Z ou offset +HH:mm / -HH:mm
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
}

/**
 * Constrói Date no FUSO LOCAL a partir de diversos formatos sem causar shift.
 * - Se ISO com Z/offset → respeita a zona da string (Date interpreta corretamente).
 * - Se "YYYY-MM-DD" → constrói local 00:00.
 * - Se "YYYY-MM-DD[ T]HH:mm[:ss]" → constrói local no horário informado.
 * - Se Date → retorna a mesma instância (válida).
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

  // Normaliza " " para "T" e parseia HH:mm(:ss)?
  const norm = s.replace(" ", "T");
  const [datePart, timePartRaw = "00:00"] = norm.split("T");
  const [y, m, d] = (datePart || "").split("-").map((n) => parseInt(n, 10));
  const [HH = "00", MM = "00", SS = "00"] = (timePartRaw || "").split(":");

  const hh = parseInt(HH, 10) || 0;
  const mm = parseInt(MM, 10) || 0;
  const ss = parseInt(SS, 10) || 0;

  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss, 0); // local
}

/** Formata Date → "YYYYMMDDTHHMMSSZ" (UTC) para Google */
function toGoogleUtcStamp(d) {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** Formata YMD → "YYYYMMDD" (all-day) */
function ymdToGoogleDate(ymd) {
  return ymd.replace(/-/g, "");
}

/* ──────────────────────────────────────────────────────────────
   API pública
   ────────────────────────────────────────────────────────────── */

/**
 * Gera um link do Google Calendar.
 * Se `dataInicio` e `dataFim` forem "YYYY-MM-DD", o evento é criado como ALL-DAY,
 * usando o formato "YYYYMMDD/YYYYMMDD" (sem timezone).
 *
 * @param {Object} params
 * @param {string} params.titulo
 * @param {string|Date} params.dataInicio - Local time ou YMD
 * @param {string|Date} params.dataFim    - Local time ou YMD
 * @param {string} [params.descricao=""]
 * @param {string} [params.local=""]
 * @param {string} [params.ctz="America/Sao_Paulo"] - Timezone de exibição no Google
 * @returns {string}
 */
export function gerarLinkGoogleAgenda({
  titulo,
  dataInicio,
  dataFim,
  descricao = "",
  local = "",
  ctz = DEFAULT_TZ,
}) {
  const title = clampText(titulo || "", MAX_TITLE);
  const details = clampText(descricao || "", MAX_DETAILS);
  const place = clampText(local || "", MAX_LOCATION);

  const s = String(dataInicio || "");
  const e = String(dataFim || "");

  // Se ambos são YMD puros → evento ALL-DAY
  const isAllDay = isAllDayLike(s) && isAllDayLike(e);

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("details", details);
  url.searchParams.set("location", place);
  url.searchParams.set("ctz", ctz);
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");

  if (isAllDay) {
    // Google espera intervalo [start,end) em formato YYYYMMDD/YYYMMDD (end exclusivo).
    // Se a pessoa passar o mesmo dia, incrementamos 1 dia no fim.
    const startYMD = s;
    const endYMD = e;

    const [ys, ms, ds] = startYMD.split("-").map(Number);
    const [ye, me, de] = endYMD.split("-").map(Number);

    const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0);
    let end = new Date(ye, me - 1, de, 0, 0, 0, 0);

    if (end <= start) {
      end = new Date(start.getTime());
      end.setDate(end.getDate() + 1);
    } else {
      // Para all-day, Google usa end EXCLUSIVO (dia seguinte ao fim visual).
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
    return url.toString();
  }

  // Caso contrário → evento com horário (carimbo UTC)
  const startLocal = toLocalDate(dataInicio);
  let endLocal = toLocalDate(dataFim);

  if (!(startLocal instanceof Date) || Number.isNaN(startLocal.getTime())) {
    throw new Error("dataInicio inválida para gerar link do Google Agenda.");
  }

  // Se fim inválido → +90 min; se <= início → +1 min
  if (!(endLocal instanceof Date) || Number.isNaN(endLocal.getTime())) {
    endLocal = new Date(startLocal.getTime() + 90 * 60 * 1000);
  }
  if (endLocal <= startLocal) {
    endLocal = new Date(startLocal.getTime() + 60 * 1000);
  }

  const inicioUTC = toGoogleUtcStamp(startLocal);
  const fimUTC = toGoogleUtcStamp(endLocal);
  url.searchParams.set("dates", `${inicioUTC}/${fimUTC}`);

  return url.toString();
}

/**
 * Atalho para criar evento ALL-DAY explicitamente.
 * Aceita "YYYY-MM-DD" ou Date (usaremos apenas a parte YMD local).
 */
export function gerarLinkGoogleAgendaAllDay({
  titulo,
  dataInicio,
  dataFim,
  descricao = "",
  local = "",
  ctz = DEFAULT_TZ,
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
  });
}

/** Converte entrada diversa para YMD local estável. */
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
