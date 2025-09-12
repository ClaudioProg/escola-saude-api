// 📁 frontend/src/utils/data.js
// Padrões do projeto:
// - Datas "date-only" tratadas como string "YYYY-MM-DD" (sem Date()).
// - Quando precisar Date, construir SEMPRE com new Date(y, m-1, d, hh, mm, ss, ms) (local).
// - Exibição com Intl.DateTimeFormat("pt-BR") respeitando timeZone.
// - Conversões para API: normalizar para YMD estável e/ou ISO UTC ("Z") quando houver hora.

// Zona padrão para exibição; usa a do navegador se disponível
export const ZONA_PADRAO =
  (Intl.DateTimeFormat().resolvedOptions?.().timeZone) || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   DETECÇÃO / PARSE
   ────────────────────────────────────────────────────────────── */
export function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// ISO com meia-noite UTC (ex.: 2025-09-16T00:00:00.000Z)
export function isUtcMidnight(iso) {
  return (
    typeof iso === "string" &&
    /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.\d{1,3})?)?Z$/.test(iso)
  );
}

export function extractYMD(s) {
  return typeof s === "string" ? s.slice(0, 10) : "";
}

/** Constrói Date no fuso LOCAL do navegador (seguro para date-only). */
export function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return (isNaN(input) ? null : input);

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      // Construção local evitando timezone shift
      const [y, m, d] = input.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
      return isNaN(dt) ? null : dt;
    }
    // Respeita Z/offset se houver; sem offset assume local
    const dt = new Date(input);
    return isNaN(dt) ? null : dt;
  }

  const dt = new Date(input);
  return isNaN(dt) ? null : dt;
}

/* ──────────────────────────────────────────────────────────────
   HELPERS DE FORMATAÇÃO
   ────────────────────────────────────────────────────────────── */

/** "YYYY-MM-DD" → "dd/MM/aaaa" sem criar Date (evita shift). */
function fmtDateOnlyString(yyyyMmDd) {
  if (!isDateOnly(yyyyMmDd)) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

/** Normaliza qualquer entrada para um YMD estável no contexto local. */
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

export function fmtData(dateLike, zone = ZONA_PADRAO) {
  if (typeof dateLike === "string") {
    if (isDateOnly(dateLike)) return fmtDateOnlyString(dateLike);
    if (isUtcMidnight(dateLike)) return fmtDateOnlyString(extractYMD(dateLike));
  }
  const d = toLocalDate(dateLike);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d); // dd/mm/aaaa
}

export function fmtDataHora(dateLike, zone = ZONA_PADRAO) {
  // date-only ou midnight UTC -> mostrar só a data
  if (typeof dateLike === "string") {
    if (isDateOnly(dateLike) || isUtcMidnight(dateLike)) {
      return fmtData(dateLike, zone);
    }
  }
  const d = toLocalDate(dateLike);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d); // dd/mm/aaaa HH:mm
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
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "dd/MM/aaaa"+"HH:mm" (hora local do navegador) -> ISO UTC (com 'Z')
 * Ex.: "18/08/2025","14:30" → "2025-08-18T17:30:00.000Z" (dependendo do offset)
 */
export function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));
  // Construção LOCAL (evita pegar timezone de string ISO sem offset)
  const local = new Date(
    y, (m - 1), d,
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(min) ? min : 0,
    0, 0
  );
  return isNaN(local) ? null : local.toISOString(); // ISO UTC com 'Z'
}

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES LEGADAS (mantidas) → redirecionam pros helpers
   ────────────────────────────────────────────────────────────── */

export function formatarDataBrasileira(dataISO) {
  if (!dataISO) return "";
  if (typeof dataISO === "string") {
    if (isDateOnly(dataISO)) return fmtDateOnlyString(dataISO);
    if (isUtcMidnight(dataISO)) return fmtDateOnlyString(extractYMD(dataISO));
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
    if (data.includes("/")) return brDateToIsoDate(data); // "dd/MM/aaaa"
    if (isDateOnly(data)) return data; // já é YMD
    if (isUtcMidnight(data)) return extractYMD(data); // meia-noite Z -> YMD
  }
  // Qualquer outra coisa cai no cálculo local
  return toLocalYMD(data);
}

/* ──────────────────────────────────────────────────────────────
   OUTROS (mantidos + reforços de segurança)
   ────────────────────────────────────────────────────────────── */

/**
 * Gera um array de Date (local) entre início e fim, inclusive.
 * ⚠️ Evita new Date(\"YYYY-MM-DD\"); usa construções locais.
 */
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
    // Push de uma NOVA instância para evitar mutabilidade externa
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

/* ──────────────────────────────────────────────────────────────
   UTILITÁRIOS ADICIONAIS (não quebram compat)
   ────────────────────────────────────────────────────────────── */

/** Adiciona dias a um YMD sem criar Date a partir de string ISO */
export function addDaysYMD(ymd, days = 0) {
  if (!isDateOnly(ymd) || !Number.isFinite(days)) return ymd || "";
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(base)) return ymd;
  base.setDate(base.getDate() + days);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Diferença em dias (fim - inicio), ambos YMD. */
export function diffDaysYMD(ymdStart, ymdEnd) {
  if (!isDateOnly(ymdStart) || !isDateOnly(ymdEnd)) return NaN;
  const [ys, ms, ds] = ymdStart.split("-").map(Number);
  const [ye, me, de] = ymdEnd.split("-").map(Number);
  const s = new Date(ys, ms - 1, ds);
  const e = new Date(ye, me - 1, de);
  if (isNaN(s) || isNaN(e)) return NaN;
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((e - s) / MS);
}

/** Compara YMD (a<b:-1, a==b:0, a>b:1). */
export function compareYMD(a, b) {
  if (!isDateOnly(a) || !isDateOnly(b)) return NaN;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Verifica se ymd está no intervalo [ini, fim], ambos inclusive. */
export function isInRangeYMD(ymd, ini, fim) {
  if (!isDateOnly(ymd) || !isDateOnly(ini) || !isDateOnly(fim)) return false;
  return !(ymd < ini || ymd > fim);
}

/** Retorna YMD do \"agora\" no fuso local. */
export function nowLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parser simples de \"HH:mm\" → {hh, mm} seguros. */
export function parseHoraBr(hhmm = "00:00") {
  const [hh = "00", mm = "00"] = String(hhmm).split(":");
  const h = Math.max(0, Math.min(23, parseInt(hh, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mm, 10) || 0));
  return { hh: h, mm: m };
}
