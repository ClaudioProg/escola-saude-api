// 📁 frontend/src/utils/dateTime.js
// Padrões do projeto:
// - Datas "date-only" tratadas como string "YYYY-MM-DD" (sem Date()).
// - Quando precisar Date, construir SEMPRE com new Date(y, m-1, d, hh, mm, ss, ms) (local).
// - Exibição com Intl.DateTimeFormat("pt-BR") respeitando timeZone.
// - Conversões para API: normalizar para YMD estável e/ou ISO UTC ("Z") quando houver hora.
// - Prazo "parede" (Brasília) trafega como "YYYY-MM-DD HH:mm[:ss]" (SEM fuso).

/* ──────────────────────────────────────────────────────────────
   ZONA PADRÃO (fonte única)
   ────────────────────────────────────────────────────────────── */
export const ZONA_PADRAO = "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   VALIDADORES DE DATA
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

/* ──────────────────────────────────────────────────────────────
   DETECÇÃO / PARSE
   ────────────────────────────────────────────────────────────── */
export function isDateOnly(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split("-");
  return isValidYmdParts(y, m, d);
}

export function isYearMonth(str) {
  return typeof str === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(str);
}

// ISO com meia-noite UTC (ex.: 2025-09-16T00:00:00.000Z)
export function isUtcMidnight(iso) {
  return (
    typeof iso === "string" &&
    /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.\d{1,3})?)?Z$/.test(iso)
  );
}

// "YYYY-MM-DD HH:mm[:ss]" (parede; sem fuso)
export function isWallDateTime(str) {
  if (
    typeof str !== "string" ||
    !/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)
  ) {
    return false;
  }

  const [ymd] = str.trim().split(/\s+/);
  return isDateOnly(ymd);
}

// ISO com fuso (termina com 'Z' ou offset +hh:mm / -hh:mm)
export function isIsoWithTz(str) {
  return (
    typeof str === "string" &&
    (/[zZ]$/.test(str) || /[+-]\d{2}:\d{2}$/.test(str))
  );
}

export function extractYMD(s) {
  const out = typeof s === "string" ? s.slice(0, 10) : "";
  return isDateOnly(out) ? out : "";
}

/** Constrói Date no fuso LOCAL do navegador (seguro para date-only). */
export function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
      return isNaN(dt) ? null : dt;
    }

    const dt = new Date(input);
    return isNaN(dt) ? null : dt;
  }

  const dt = new Date(input);
  return isNaN(dt) ? null : dt;
}

/* ──────────────────────────────────────────────────────────────
   HELPERS DE FORMATAÇÃO (sem criar Date p/ date-only/wall)
   ────────────────────────────────────────────────────────────── */
function fmtDateOnlyString(yyyyMmDd) {
  if (!isDateOnly(yyyyMmDd)) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD HH:mm[:ss]" → "dd/MM/aaaa HH:mm" (parede; sem Date) */
export function fmtWallDateTime(wall) {
  if (!isWallDateTime(wall)) return "";

  const [ymd, hm] = wall.trim().split(/\s+/);
  const [y, m, d] = ymd.split("-");
  const [hh, mm] = hm.split(":");

  return `${d}/${m}/${y} ${hh}:${mm}`;
}

function wallToBrDateOnly(wall) {
  if (!isWallDateTime(wall)) return "";
  const [ymd] = wall.trim().split(/\s+/);
  return fmtDateOnlyString(ymd);
}

/** Normaliza qualquer entrada para YMD estável no contexto local. */
function toLocalYMD(input) {
  if (!input) return "";
  if (isDateOnly(input)) return input;
  if (isUtcMidnight(input)) return extractYMD(input);

  const d = toLocalDate(input);
  if (!d) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ──────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR (exibição)
   ────────────────────────────────────────────────────────────── */
function safeFmt(date, opts) {
  try {
    return new Intl.DateTimeFormat("pt-BR", opts).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    if (opts.hour !== undefined) {
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }

    return `${d}/${m}/${y}`;
  }
}

export function fmtData(dateLike, zone = ZONA_PADRAO) {
  if (typeof dateLike === "string") {
    if (isDateOnly(dateLike)) return fmtDateOnlyString(dateLike);
    if (isUtcMidnight(dateLike)) return fmtDateOnlyString(extractYMD(dateLike));
    if (isWallDateTime(dateLike)) return wallToBrDateOnly(dateLike);
  }

  const d = toLocalDate(dateLike);
  if (!d) return "";

  return safeFmt(d, {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtDataHora(dateLike, zone = ZONA_PADRAO) {
  if (typeof dateLike === "string") {
    if (isDateOnly(dateLike) || isUtcMidnight(dateLike)) return fmtData(dateLike, zone);
    if (isWallDateTime(dateLike)) return fmtWallDateTime(dateLike);
  }

  const d = toLocalDate(dateLike);
  if (!d) return "";

  return safeFmt(d, {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ──────────────────────────────────────────────────────────────
   CONVERSÕES BR → ISO/UTC (envio para API)
   ────────────────────────────────────────────────────────────── */
/** "dd/MM/aaaa" -> "YYYY-MM-DD" */
export function brDateToIsoDate(dataBr) {
  if (!dataBr || typeof dataBr !== "string") return "";

  const parts = dataBr.split("/");
  if (parts.length !== 3) return "";

  const [dd, mm, yyyy] = parts.map((x) => String(x || "").trim());

  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) {
    return "";
  }

  if (!isValidYmdParts(yyyy, mm, dd)) return "";

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "dd/MM/aaaa"+"HH:mm" (hora local do navegador) -> ISO UTC (com 'Z')
 */
export function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));

  const local = new Date(
    y,
    m - 1,
    d,
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(min) ? min : 0,
    0,
    0
  );

  return isNaN(local) ? null : local.toISOString();
}

/* ──────────────────────────────────────────────────────────────
   SUPORTE A "PAREDE" (Brasília) NO FRONT
   ────────────────────────────────────────────────────────────── */
export function datetimeLocalToBrWall(datetimeLocal) {
  if (!datetimeLocal) return "";

  const s = String(datetimeLocal).trim().replace("T", " ");
  if (!s) return "";

  return s.length === 16 ? `${s}:00` : s;
}

export function wallToDatetimeLocal(wall) {
  if (!isWallDateTime(wall)) return "";

  const [ymd, hm] = wall.trim().split(/\s+/);
  const [hh, mm] = hm.split(":");
  return `${ymd}T${hh}:${mm}`;
}

/**
 * Converte ISO (com Z/offset) para "YYYY-MM-DDTHH:mm" na zona informada
 * (para usar em <input type="datetime-local">)
 */
export function isoToDatetimeLocalInZone(iso, zone = ZONA_PADRAO) {
  if (!iso || typeof iso !== "string") return "";
  if (!isIsoWithTz(iso)) return "";

  try {
    const d = new Date(iso);
    if (isNaN(d)) return "";

    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(d);

    const get = (t) => parts.find((p) => p.type === t)?.value?.padStart?.(2, "0") || "";

    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES LEGADAS (mantidas)
   ────────────────────────────────────────────────────────────── */
export function formatarDataBrasileira(dataISO) {
  if (!dataISO) return "";

  if (typeof dataISO === "string") {
    if (isDateOnly(dataISO)) return fmtDateOnlyString(dataISO);
    if (isUtcMidnight(dataISO)) return fmtDateOnlyString(extractYMD(dataISO));
    if (isWallDateTime(dataISO)) return wallToBrDateOnly(dataISO);
  }

  return fmtData(dataISO);
}

export function formatarDataHoraBrasileira(dataISO) {
  if (!dataISO) return "";
  return fmtDataHora(dataISO);
}

/** Converte para ISO (yyyy-mm-dd) aceitando string BR, Date, ISO */
export function formatarParaISO(data) {
  if (!data) return "";

  if (typeof data === "string") {
    if (data.includes("/")) return brDateToIsoDate(data);
    if (isDateOnly(data)) return data;
    if (isUtcMidnight(data)) return extractYMD(data);
    if (isWallDateTime(data)) return extractYMD(data);
  }

  return toLocalYMD(data);
}

/* ──────────────────────────────────────────────────────────────
   OUTROS
   ────────────────────────────────────────────────────────────── */
export function gerarIntervaloDeDatas(dataInicio, dataFim) {
  const ymdIni = toLocalYMD(dataInicio);
  const ymdFim = toLocalYMD(dataFim);

  if (!ymdIni || !ymdFim) return [];

  const [yi, mi, di] = ymdIni.split("-").map(Number);
  const [yf, mf, df] = ymdFim.split("-").map(Number);

  const ini = new Date(yi, mi - 1, di, 0, 0, 0, 0);
  const fim = new Date(yf, mf - 1, df, 0, 0, 0, 0);

  if (isNaN(ini) || isNaN(fim) || ini > fim) return [];

  const datas = [];

  for (let d = new Date(ini.getTime()); d <= fim; d.setDate(d.getDate() + 1)) {
    datas.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  }

  return datas;
}

export function formatarCPF(cpf) {
  if (!cpf) return "";

  const num = String(cpf).replace(/\D/g, "");
  if (num.length !== 11) return cpf;

  return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function addDaysYMD(ymd, days = 0) {
  if (!isDateOnly(ymd) || !Number.isFinite(days)) return ymd || "";

  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(y, m - 1, d, 12, 0, 0, 0); // meio-dia evita edge de DST
  if (isNaN(base)) return ymd;

  base.setDate(base.getDate() + days);

  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");

  return `${yy}-${mm}-${dd}`;
}

export function diffDaysYMD(ymdStart, ymdEnd) {
  if (!isDateOnly(ymdStart) || !isDateOnly(ymdEnd)) return NaN;

  const [ys, ms, ds] = ymdStart.split("-").map(Number);
  const [ye, me, de] = ymdEnd.split("-").map(Number);

  const s = new Date(ys, ms - 1, ds, 12, 0, 0, 0);
  const e = new Date(ye, me - 1, de, 12, 0, 0, 0);

  if (isNaN(s) || isNaN(e)) return NaN;

  const MS = 24 * 60 * 60 * 1000;
  return Math.round((e.getTime() - s.getTime()) / MS);
}

export function compareYMD(a, b) {
  if (!isDateOnly(a) || !isDateOnly(b)) return NaN;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isInRangeYMD(ymd, ini, fim) {
  if (!isDateOnly(ymd) || !isDateOnly(ini) || !isDateOnly(fim)) return false;
  return !(ymd < ini || ymd > fim);
}

export function nowLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseHoraBr(hhmm = "00:00") {
  const [hh = "00", mm = "00"] = String(hhmm).split(":");

  const h = Math.max(0, Math.min(23, parseInt(hh, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mm, 10) || 0));

  return { hh: h, mm: m };
}

export function idadeDe(nascimentoISO) {
  const d = String(nascimentoISO ?? "").slice(0, 10);
  if (!isDateOnly(d)) return null;

  const [Y, M, D] = d.split("-").map(Number);
  const hoje = new Date();

  let idade = hoje.getFullYear() - Y;
  const m = hoje.getMonth() + 1 - M;

  if (m < 0 || (m === 0 && hoje.getDate() < D)) idade--;

  return idade >= 0 && idade < 140 ? idade : null;
}