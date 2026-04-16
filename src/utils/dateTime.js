/* eslint-disable no-console */
"use strict";

const { DateTime } = require("luxon");

// Zona padrão somente para EXIBIÇÃO / interpretação local controlada
// Armazenamento e contrato continuam em UTC
const TZ_PADRAO = process.env.TZ_PADRAO || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   VALIDADORES / PRIMITIVAS
────────────────────────────────────────────────────────────── */

function _isValidYmdParts(y, m, d) {
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

function isIsoDateOnly(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-");
  return _isValidYmdParts(y, m, d);
}

function isHhmm(s) {
  if (typeof s !== "string" || !/^\d{2}:\d{2}$/.test(s)) return false;
  const [hh, mm] = s.split(":").map(Number);
  return (
    Number.isInteger(hh) &&
    Number.isInteger(mm) &&
    hh >= 0 &&
    hh <= 23 &&
    mm >= 0 &&
    mm <= 59
  );
}

function isHhmmss(s) {
  if (typeof s !== "string" || !/^\d{2}:\d{2}:\d{2}$/.test(s)) return false;
  const [hh, mm, ss] = s.split(":").map(Number);
  return (
    Number.isInteger(hh) &&
    Number.isInteger(mm) &&
    Number.isInteger(ss) &&
    hh >= 0 &&
    hh <= 23 &&
    mm >= 0 &&
    mm <= 59 &&
    ss >= 0 &&
    ss <= 59
  );
}

/* ──────────────────────────────────────────────────────────────
   HELPERS INTERNOS
────────────────────────────────────────────────────────────── */

function _asDate(input) {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "string") {
    const d = parseIsoToDate(input);
    return d;
  }
  return null;
}

function _normalizeDateOnlyToYmd(input) {
  if (typeof input === "string" && isIsoDateOnly(input)) return input;

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function _formatYmdFromUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function _addUtcDays(date, inc = 1) {
  const nd = new Date(date.getTime());
  nd.setUTCDate(nd.getUTCDate() + inc);
  return nd;
}

function _parseHora(hora) {
  const raw = String(hora || "").trim();

  if (!raw) return { hh: 0, mm: 0, ss: 0, ok: true };

  if (isHhmm(raw)) {
    const [hh, mm] = raw.split(":").map(Number);
    return { hh, mm, ss: 0, ok: true };
  }

  if (isHhmmss(raw)) {
    const [hh, mm, ss] = raw.split(":").map(Number);
    return { hh, mm, ss, ok: true };
  }

  return { hh: 0, mm: 0, ss: 0, ok: false };
}

function _normalizeRange(a, b) {
  return a <= b ? [a, b] : [b, a];
}

/* ──────────────────────────────────────────────────────────────
   PARSE / SERIALIZAÇÃO (UTC)
────────────────────────────────────────────────────────────── */

/**
 * Evita a armadilha: "YYYY-MM-DD" não vira Date automaticamente.
 * Para date-only, use dateOnlyToUtcDate().
 */
function parseIsoToDate(s) {
  if (!s || typeof s !== "string") return null;
  if (isIsoDateOnly(s)) return null;

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aceita ISO UTC preferencialmente. */
function parseUtc(isoUtc) {
  if (!isoUtc) return null;
  const d = new Date(isoUtc);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoUtc(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function dateOnlyToUtcDate(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) return null;
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/* ──────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR (EXIBIÇÃO) — sem shift em date-only
────────────────────────────────────────────────────────────── */

function toBrDateOnlyString(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

function toBrDate(input, timeZone = TZ_PADRAO) {
  if (typeof input === "string" && isIsoDateOnly(input)) {
    return toBrDateOnlyString(input);
  }

  const d = _asDate(input);
  if (!d) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function toBrDateTime(input, timeZone = TZ_PADRAO) {
  if (typeof input === "string" && isIsoDateOnly(input)) {
    return toBrDate(input, timeZone);
  }

  const d = _asDate(input);
  if (!d) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/* ──────────────────────────────────────────────────────────────
   CONVERSÕES BR → ISO
────────────────────────────────────────────────────────────── */

function brDateToIsoDate(dataBr) {
  if (!dataBr || typeof dataBr !== "string") return "";

  const [dd, mm, yyyy] = dataBr.split("/").map((x) => String(x || "").trim());

  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) {
    return "";
  }

  if (!_isValidYmdParts(yyyy, mm, dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte "dd/MM/aaaa" + "HH:mm[:ss]" interpretando a hora na TZ_PADRAO
 * e devolve ISO UTC.
 */
function brDateTimeToIsoUtc(dataBr, horaBr = "00:00", zone = TZ_PADRAO) {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const { hh, mm, ss, ok } = _parseHora(horaBr);
  if (!ok) return null;

  const [y, m, d] = isoDate.split("-").map(Number);

  const dt = DateTime.fromObject(
    {
      year: y,
      month: m,
      day: d,
      hour: hh,
      minute: mm,
      second: ss,
      millisecond: 0,
    },
    { zone }
  );

  if (!dt.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

/* ──────────────────────────────────────────────────────────────
   GERAÇÃO DE OCORRÊNCIAS DE TURMA (date-only)
────────────────────────────────────────────────────────────── */

/**
 * prioridade:
 * 1) datasEspecificas
 * 2) diasSemana
 * 3) intervalo completo
 */
function gerarOcorrencias({ data_inicio, data_fim, datasEspecificas = [], diasSemana = [] }) {
  if (Array.isArray(datasEspecificas) && datasEspecificas.length) {
    const uniq = new Set(
      datasEspecificas
        .map((s) => _normalizeDateOnlyToYmd(s))
        .filter((s) => isIsoDateOnly(s))
    );
    return Array.from(uniq).sort();
  }

  const diYmd = _normalizeDateOnlyToYmd(data_inicio);
  const dfYmd = _normalizeDateOnlyToYmd(data_fim);

  if (!isIsoDateOnly(diYmd) || !isIsoDateOnly(dfYmd)) return [];

  const di = dateOnlyToUtcDate(diYmd);
  const df = dateOnlyToUtcDate(dfYmd);

  if (!di || !df || di > df) return [];

  if (Array.isArray(diasSemana) && diasSemana.length) {
    const wanted = new Set(
      diasSemana
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    );

    const out = [];
    for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) {
      if (wanted.has(d.getUTCDay())) {
        out.push(_formatYmdFromUtcDate(d));
      }
    }
    return out;
  }

  const out = [];
  for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) {
    out.push(_formatYmdFromUtcDate(d));
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   VERIFICAÇÕES DE CONFLITO (date-only + hh:mm)
────────────────────────────────────────────────────────────── */

function rangesDeDatasSobrepoem(aIni, aFim, bIni, bFim, opts = {}) {
  const { inclusive = true } = opts;

  const ai0 = _normalizeDateOnlyToYmd(aIni);
  const af0 = _normalizeDateOnlyToYmd(aFim);
  const bi0 = _normalizeDateOnlyToYmd(bIni);
  const bf0 = _normalizeDateOnlyToYmd(bFim);

  if (!isIsoDateOnly(ai0) || !isIsoDateOnly(af0) || !isIsoDateOnly(bi0) || !isIsoDateOnly(bf0)) {
    return false;
  }

  const [ai, af] = _normalizeRange(ai0, af0);
  const [bi, bf] = _normalizeRange(bi0, bf0);

  return inclusive ? !(af < bi || bf < ai) : af > bi && bf > ai;
}

function horasSobrepoem(h1i, h1f, h2i, h2f, opts = {}) {
  const { inclusive = false } = opts;

  const A0 = String(h1i || "").slice(0, 5);
  const B0 = String(h1f || "").slice(0, 5);
  const C0 = String(h2i || "").slice(0, 5);
  const D0 = String(h2f || "").slice(0, 5);

  if (!isHhmm(A0) || !isHhmm(B0) || !isHhmm(C0) || !isHhmm(D0)) return false;

  const [A, B] = _normalizeRange(A0, B0);
  const [C, D] = _normalizeRange(C0, D0);

  return inclusive ? A <= D && C <= B : A < D && C < B;
}

function turmasConflitam(t1, t2, opts = {}) {
  return (
    rangesDeDatasSobrepoem(
      t1?.data_inicio,
      t1?.data_fim,
      t2?.data_inicio,
      t2?.data_fim,
      { inclusive: true, ...opts }
    ) &&
    horasSobrepoem(
      t1?.horario_inicio,
      t1?.horario_fim,
      t2?.horario_inicio,
      t2?.horario_fim,
      { inclusive: false, ...opts }
    )
  );
}

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES ZONADAS (Luxon)
────────────────────────────────────────────────────────────── */

/**
 * Converte:
 * - data "YYYY-MM-DD" + hora "HH:mm"|"HH:mm:ss"
 * ou
 * - brIso "dd/MM/yyyy HH:mm[:ss]"
 * para DateTime zonado.
 */
function dateHourToZoned({ data, hora, brIso, zone = TZ_PADRAO }) {
  if (brIso) {
    const s = String(brIso).trim();

    let dt = DateTime.fromFormat(s, "dd/MM/yyyy HH:mm:ss", { zone });
    if (!dt.isValid) dt = DateTime.fromFormat(s, "dd/MM/yyyy HH:mm", { zone });

    return dt;
  }

  if (!isIsoDateOnly(data)) {
    return DateTime.invalid("Data inválida (esperado YYYY-MM-DD)");
  }

  const { hh, mm, ss, ok } = _parseHora(hora);
  if (!ok) {
    return DateTime.invalid("Hora inválida (esperado HH:mm ou HH:mm:ss)");
  }

  const [Y, M, D] = data.split("-").map(Number);

  return DateTime.fromObject(
    {
      year: Y,
      month: M,
      day: D,
      hour: hh,
      minute: mm,
      second: ss,
      millisecond: 0,
    },
    { zone }
  );
}

function nowZoned(zone = TZ_PADRAO) {
  return DateTime.now().setZone(zone);
}

function canSubmitUntil(deadlineZoned, now = nowZoned()) {
  if (!deadlineZoned || typeof deadlineZoned.toMillis !== "function") return false;
  if (!deadlineZoned.isValid) return false;
  if (!now || !now.isValid) return false;
  return now.toMillis() <= deadlineZoned.toMillis();
}

function fmt(dt, zone = TZ_PADRAO) {
  if (!dt || typeof dt.toISO !== "function") {
    return { valid: false, reason: "not_a_datetime" };
  }

  if (!dt.isValid) {
    return {
      valid: false,
      reason: dt.invalidReason,
      explanation: dt.invalidExplanation,
    };
  }

  const z = dt.setZone(zone);

  return {
    valid: true,
    zoned: z.toISO({ suppressMilliseconds: true }),
    utc: z.toUTC().toISO({ suppressMilliseconds: true }),
    epoch: z.toMillis(),
    zone,
  };
}

/* ──────────────────────────────────────────────────────────────
   ALIASES DE COMPATIBILIDADE
────────────────────────────────────────────────────────────── */

function formatarDataBR(dataEntrada) {
  return dataEntrada ? toBrDate(dataEntrada) : "";
}

function formatarDataISO(dataBR) {
  return brDateToIsoDate(dataBR);
}

/* ──────────────────────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────────────────────── */

module.exports = {
  // base
  TZ_PADRAO,

  // validadores
  isIsoDateOnly,
  isHhmm,
  isHhmmss,

  // parse/serialize UTC
  parseIsoToDate,
  parseUtc,
  toIsoUtc,
  dateOnlyToUtcDate,

  // exibição pt-BR
  toBrDateOnlyString,
  toBrDate,
  toBrDateTime,

  // conversões BR
  brDateToIsoDate,
  brDateTimeToIsoUtc,

  // ocorrências
  gerarOcorrencias,

  // conflitos
  rangesDeDatasSobrepoem,
  horasSobrepoem,
  turmasConflitam,

  // zonado (Luxon)
  dateHourToZoned,
  nowZoned,
  canSubmitUntil,
  fmt,

  // compat
  formatarDataBR,
  formatarDataISO,
};