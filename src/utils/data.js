// 📁 src/utils/data.js

// Timezone padrão para exibição/formatos locais.
// OBS: Somente para formatação; o armazenamento/contrato de API continua em UTC.
const TZ_PADRAO = process.env.TZ_PADRAO || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────────
   VALIDADORES / PARSERS BÁSICOS
   ────────────────────────────────────────────────────────────────── */

/** Retorna true se for string no formato YYYY-MM-DD (data sem hora). */
function isIsoDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Tenta parsear uma string ISO (com ou sem Z). Se vier sem Z, o Date assume local do servidor. */
function parseIsoToDate(s) {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Retorna um Date a partir de ISO com Z em UTC (preferível). */
function parseUtc(isoUtc) {
  if (!isoUtc) return null;
  // Exige 'Z' no fim para garantir UTC explícito
  if (typeof isoUtc === "string" && /z$/i.test(isoUtc)) {
    const d = new Date(isoUtc);
    return isNaN(d) ? null : d;
  }
  // Se não tiver Z, tenta parse e assume como Date válido (mas recomendamos sempre enviar com Z)
  const d = new Date(isoUtc);
  return isNaN(d) ? null : d;
}

/** Serializa Date (UTC) para ISO 8601 com 'Z'. */
function toIsoUtc(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  return date.toISOString(); // sempre com Z (UTC)
}

/** Converte YYYY-MM-DD para Date "início do dia" em UTC. */
function dateOnlyToUtcDate(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) return null;
  // meia-noite UTC
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/* ──────────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR PARA EXIBIÇÃO (casos em que o backend precise)
   ────────────────────────────────────────────────────────────────── */

/** Formata Date/ISO para dd/MM/aaaa no fuso informado (padrão: America/Sao_Paulo). */
function toBrDate(input, timeZone = TZ_PADRAO) {
  let d = input instanceof Date ? input : parseIsoToDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Formata Date/ISO para dd/MM/aaaa HH:mm (24h) no fuso informado. */
function toBrDateTime(input, timeZone = TZ_PADRAO) {
  let d = input instanceof Date ? input : parseIsoToDate(input);
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

/* ──────────────────────────────────────────────────────────────────
   CONVERSÕES BR (strings do tipo dd/MM/aaaa) → ISO
   ────────────────────────────────────────────────────────────────── */

/** Converte dd/MM/aaaa para YYYY-MM-DD (somente data). */
function brDateToIsoDate(dataBr) {
  if (!dataBr || typeof dataBr !== "string") return "";
  const [dd, mm, yyyy] = dataBr.split("/").map((x) => String(x || "").trim());
  if (!dd || !mm || !yyyy) return "";
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte dd/MM/aaaa + HH:mm (hora local do servidor) → ISO UTC.
 * ⚠️ BACKEND: esta função usa o timezone do SISTEMA onde o Node está rodando.
 * Se você precisa converter especificamente com "America/Sao_Paulo" independente do servidor,
 * prefira fazer a conversão no FRONTEND (onde sabemos a zona do usuário) e enviar ISO UTC pronto.
 */
function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));

  // Cria Date como LOCAL do servidor (não do usuário), depois converte para UTC via toISOString.
  const local = new Date(y, (m - 1), d, isNaN(hh) ? 0 : hh, isNaN(min) ? 0 : min, 0, 0);
  if (isNaN(local)) return null;
  return local.toISOString(); // retorna UTC com Z
}

/* ──────────────────────────────────────────────────────────────────
   COMPATIBILIDADE (mantém suas funções antigas)
   ────────────────────────────────────────────────────────────────── */

/** (LEGADO) Converte Date ou string ISO para dd/MM/aaaa. */
function formatarDataBR(dataEntrada) {
  if (!dataEntrada) return "";
  // Reaproveita toBrDate (usa TZ padrão)
  return toBrDate(dataEntrada);
}

/** (LEGADO) Converte dd/MM/aaaa para YYYY-MM-DD. */
function formatarDataISO(dataBR) {
  return brDateToIsoDate(dataBR);
}

/* ──────────────────────────────────────────────────────────────────
   EXPORTS
   ────────────────────────────────────────────────────────────────── */

module.exports = {
  // Contrato API (recomendado)
  parseUtc,           // ISO (com Z) -> Date
  toIsoUtc,           // Date -> ISO (com Z)
  dateOnlyToUtcDate,  // "YYYY-MM-DD" -> Date (00:00Z)

  // Formatação pt-BR (útil em e-mails/logs do backend)
  toBrDate,           // Date/ISO -> "dd/MM/aaaa"
  toBrDateTime,       // Date/ISO -> "dd/MM/aaaa HH:mm"

  // Converters BR <-> ISO date-only
  brDateToIsoDate,    // "dd/MM/aaaa" -> "YYYY-MM-DD"
  brDateTimeToIsoUtc, // "dd/MM/aaaa"+"HH:mm" -> ISO UTC (atenção ao timezone do servidor)

  // Legado (mantidos)
  formatarDataBR,
  formatarDataISO,

  // Utils
  isIsoDateOnly,
};
