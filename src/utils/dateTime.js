/* eslint-disable no-console */
const { DateTime } = require("luxon");

// Zona padrão somente para EXIBIÇÃO (armazenamento/contrato segue UTC)
const TZ_PADRAO = process.env.TZ_PADRAO || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   VALIDADORES / PRIMITIVAS
   ────────────────────────────────────────────────────────────── */

function _isValidYmdParts(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!Number.isInteger(yy) || yy < 1900 || yy > 2200) return false;
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isInteger(dd) || dd < 1 || dd > 31) return false;
  const dt = new Date(Date.UTC(yy, mm - 1, dd)); // UTC para não sofrer fuso
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

/* ──────────────────────────────────────────────────────────────
   PARSE / SERIALIZAÇÃO (UTC)
   ────────────────────────────────────────────────────────────── */

/** Evita cair em armadilha: "YYYY-MM-DD" → retorna null (não cria Date). */
function parseIsoToDate(s) {
  if (!s || typeof s !== "string") return null;
  if (isIsoDateOnly(s)) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Aceita ISO com Z preferencialmente (UTC). */
function parseUtc(isoUtc) {
  if (!isoUtc) return null;
  if (typeof isoUtc === "string" && /z$/i.test(isoUtc)) {
    const d = new Date(isoUtc);
    return isNaN(d) ? null : d;
  }
  const d = new Date(isoUtc);
  return isNaN(d) ? null : d;
}

function toIsoUtc(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  return date.toISOString();
}

function dateOnlyToUtcDate(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) return null;
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/* ──────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR (exibição) — sem shift em date-only
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
  const d = input instanceof Date ? input : parseIsoToDate(input);
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
  const d = input instanceof Date ? input : parseIsoToDate(input);
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
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";
  if (!_isValidYmdParts(yyyy, mm, dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/** Converte "dd/MM/aaaa"+"HH:mm" (hora local do servidor) → ISO UTC. */
function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;
  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  const local = new Date(
    y, m - 1, d,
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(min) ? min : 0,
    0, 0
  );
  if (isNaN(local)) return null;
  return local.toISOString();
}

/* ──────────────────────────────────────────────────────────────
   GERAÇÃO DE OCORRÊNCIAS DE TURMA (date-only)
   ────────────────────────────────────────────────────────────── */

function _formatYmd(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function _addUtcDays(d, inc = 1) {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + inc);
  return nd;
}

/** datasEspecificas > diasSemana > intervalo completo */
function gerarOcorrencias({ data_inicio, data_fim, datasEspecificas = [], diasSemana = [] }) {
  if (Array.isArray(datasEspecificas) && datasEspecificas.length) {
    const uniq = new Set(datasEspecificas.filter((s) => isIsoDateOnly(s)));
    return Array.from(uniq).sort();
  }
  const di = isIsoDateOnly(data_inicio) ? dateOnlyToUtcDate(data_inicio) : parseIsoToDate(data_inicio);
  const df = isIsoDateOnly(data_fim) ? dateOnlyToUtcDate(data_fim) : parseIsoToDate(data_fim);
  if (!(di instanceof Date) || isNaN(di) || !(df instanceof Date) || isNaN(df)) return [];
  if (di > df) return [];
  if (Array.isArray(diasSemana) && diasSemana.length) {
    const wanted = new Set(
      diasSemana.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    );
    const out = [];
    for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) {
      if (wanted.has(d.getUTCDay())) out.push(_formatYmd(d));
    }
    return out;
  }
  const out = [];
  for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) out.push(_formatYmd(d));
  return out;
}

/* ──────────────────────────────────────────────────────────────
   VERIFICAÇÕES DE CONFLITO (date-only + hh:mm)
   ────────────────────────────────────────────────────────────── */

function _isYmd(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function _isHhmm(s) { return typeof s === "string" && /^\d{2}:\d{2}/.test(s); }
const _ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const _hhmm = (s) => (typeof s === "string" && s.length >= 5 ? s.slice(0, 5) : "");

function _normalizeRange(a, b) { return a <= b ? [a, b] : [b, a]; }

/** Sobreposição de datas (YYYY-MM-DD). `inclusive` default: true. */
function rangesDeDatasSobrepoem(aIni, aFim, bIni, bFim, opts = {}) {
  const { inclusive = true } = opts;
  const ai0 = _ymd(aIni), af0 = _ymd(aFim), bi0 = _ymd(bIni), bf0 = _ymd(bFim);
  if (!_isYmd(ai0) || !_isYmd(af0) || !_isYmd(bi0) || !_isYmd(bf0)) return false;
  const [ai, af] = _normalizeRange(ai0, af0);
  const [bi, bf] = _normalizeRange(bi0, bf0);
  return inclusive ? !(af < bi || bf < ai) : (af > bi && bf > ai);
}

/** Sobreposição de horários (HH:mm). `inclusive` default: false. */
function horasSobrepoem(h1i, h1f, h2i, h2f, opts = {}) {
  const { inclusive = false } = opts;
  const A0 = _hhmm(h1i), B0 = _hhmm(h1f), C0 = _hhmm(h2i), D0 = _hhmm(h2f);
  if (!_isHhmm(A0) || !_isHhmm(B0) || !_isHhmm(C0) || !_isHhmm(D0)) return false;
  const [A, B] = _normalizeRange(A0, B0);
  const [C, D] = _normalizeRange(C0, D0);
  return inclusive ? (A <= D && C <= B) : (A < D && C < B);
}

/** Conflito de turmas = datas se sobrepõem E horários se sobrepõem */
function turmasConflitam(t1, t2, opts = {}) {
  return (
    rangesDeDatasSobrepoem(t1?.data_inicio, t1?.data_fim, t2?.data_inicio, t2?.data_fim, { inclusive: true, ...opts }) &&
    horasSobrepoem(t1?.horario_inicio, t1?.horario_fim, t2?.horario_inicio, t2?.horario_fim, { inclusive: false, ...opts })
  );
}

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES ZONADAS (Luxon) — exibição/validação de prazos
   ────────────────────────────────────────────────────────────── */

function _parseHora(hora) {
  let hh = 0, mm = 0, ss = 0;
  if (typeof hora === "string" && hora.trim()) {
    const parts = hora.trim().split(":").map((x) => Number(x));
    hh = Number.isFinite(parts[0]) ? parts[0] : 0;
    mm = Number.isFinite(parts[1]) ? parts[1] : 0;
    ss = Number.isFinite(parts[2]) ? parts[2] : 0;
  }
  return { hh, mm, ss };
}

/**
 * Converte (data-only "YYYY-MM-DD", hora "HH:mm"|"HH:mm:ss") OU "dd/MM/yyyy HH:mm[:ss]" → DateTime zonado.
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
  const [Y, M, D] = data.split("-").map((x) => Number(x));
  const { hh, mm, ss } = _parseHora(hora);
  return DateTime.fromObject({ year: Y, month: M, day: D, hour: hh, minute: mm, second: ss }, { zone });
}

function nowZoned(zone = TZ_PADRAO) { return DateTime.now().setZone(zone); }

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
    return { valid: false, reason: dt.invalidReason, explanation: dt.invalidExplanation };
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
   ALIAS DE COMPATIBILIDADE
   ────────────────────────────────────────────────────────────── */

function formatarDataBR(dataEntrada) { return dataEntrada ? toBrDate(dataEntrada) : ""; }
function formatarDataISO(dataBR) { return brDateToIsoDate(dataBR); }

/* ──────────────────────────────────────────────────────────────
   EXPORTS
   ────────────────────────────────────────────────────────────── */

module.exports = {
  // base
  TZ_PADRAO,

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
  isIsoDateOnly,
};
