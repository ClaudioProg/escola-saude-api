// 📁 src/utils/data.js
/* eslint-disable no-console */

// Timezone padrão para exibição/formatos locais.
// OBS: Somente para formatação; o armazenamento/contrato de API continua em UTC.
const TZ_PADRAO = process.env.TZ_PADRAO || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────────
   HELPERS DE VALIDAÇÃO
   ────────────────────────────────────────────────────────────────── */

function _isValidYmdParts(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!Number.isInteger(yy) || yy < 1900 || yy > 2200) return false;
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isInteger(dd) || dd < 1 || dd > 31) return false;

  // valida dia real do mês usando UTC (não sofre fuso)
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  return (
    dt.getUTCFullYear() === yy &&
    dt.getUTCMonth() === mm - 1 &&
    dt.getUTCDate() === dd
  );
}

/** Retorna true se for string no formato YYYY-MM-DD (data sem hora) e for data real. */
function isIsoDateOnly(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-");
  return _isValidYmdParts(y, m, d);
}

/* ──────────────────────────────────────────────────────────────────
   PARSERS / SERIALIZERS
   ────────────────────────────────────────────────────────────────── */

/**
 * Tenta parsear uma string ISO (com ou sem Z).
 * Observação importante do JS:
 * - "YYYY-MM-DD" → interpretado como **UTC**.
 * - "YYYY-MM-DDTHH:mm" (sem Z) → interpretado no fuso **local do servidor**.
 * - Sufixo 'Z' → UTC explícito.
 *
 * Premium: se for date-only, retorna null (para evitar uso acidental de Date).
 */
function parseIsoToDate(s) {
  if (!s || typeof s !== "string") return null;

  // ✅ evita criar Date com date-only por acidente
  if (isIsoDateOnly(s)) return null;

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Retorna um Date a partir de ISO com Z em UTC (preferível). */
function parseUtc(isoUtc) {
  if (!isoUtc) return null;

  // aceita string ISO com Z
  if (typeof isoUtc === "string" && /z$/i.test(isoUtc)) {
    const d = new Date(isoUtc);
    return isNaN(d) ? null : d;
  }

  // fallback: tenta parse mesmo sem Z (menos recomendado)
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
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/* ──────────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR PARA EXIBIÇÃO
   ────────────────────────────────────────────────────────────────── */

/** Formata "YYYY-MM-DD" → "dd/MM/aaaa" sem criar Date (evita shift de fuso). */
function toBrDateOnlyString(yyyyMmDd) {
  if (!isIsoDateOnly(yyyyMmDd)) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

/** Formata Date/ISO para dd/MM/aaaa no fuso informado (padrão: America/Sao_Paulo). */
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

/** Formata Date/ISO para dd/MM/aaaa HH:mm (24h) no fuso informado. */
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

/* ──────────────────────────────────────────────────────────────────
   CONVERSÕES BR (dd/MM/aaaa) → ISO
   ────────────────────────────────────────────────────────────────── */

/** Converte dd/MM/aaaa para YYYY-MM-DD (somente data), validando data real. */
function brDateToIsoDate(dataBr) {
  if (!dataBr || typeof dataBr !== "string") return "";

  const [dd, mm, yyyy] = dataBr.split("/").map((x) => String(x || "").trim());
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";

  if (!_isValidYmdParts(yyyy, mm, dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte dd/MM/aaaa + HH:mm (hora local do servidor) → ISO UTC.
 * ⚠️ BACKEND: usa timezone do SISTEMA onde o Node está rodando.
 */
function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));

  const local = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(min) ? min : 0, 0, 0);
  if (isNaN(local)) return null;
  return local.toISOString();
}

/* ──────────────────────────────────────────────────────────────────
   OCORRÊNCIAS DE TURMA
   ────────────────────────────────────────────────────────────────── */

/** Formata Date (UTC) para "YYYY-MM-DD". */
function _formatYmd(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soma dias em UTC. */
function _addUtcDays(d, inc = 1) {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + inc);
  return nd;
}

/**
 * Gera lista de ocorrências "YYYY-MM-DD" para uma turma.
 * Prioridade:
 * 1) datasEspecificas: array de datas exatas (YYYY-MM-DD) → usa apenas essas
 * 2) diasSemana: array de números 0..6 (Dom..Sáb) → gera entre início/fim
 * 3) fallback: intervalo completo [data_inicio..data_fim]
 */
function gerarOcorrencias({ data_inicio, data_fim, datasEspecificas = [], diasSemana = [] }) {
  // 1) Datas específicas
  if (Array.isArray(datasEspecificas) && datasEspecificas.length) {
    const uniq = new Set(datasEspecificas.filter((s) => isIsoDateOnly(s)));
    return Array.from(uniq).sort();
  }

  // Preparar início/fim (date-only -> 00:00Z)
  const di = isIsoDateOnly(data_inicio) ? dateOnlyToUtcDate(data_inicio) : parseIsoToDate(data_inicio);
  const df = isIsoDateOnly(data_fim) ? dateOnlyToUtcDate(data_fim) : parseIsoToDate(data_fim);

  if (!(di instanceof Date) || isNaN(di) || !(df instanceof Date) || isNaN(df)) return [];
  if (di > df) return [];

  // 2) Dias da semana
  if (Array.isArray(diasSemana) && diasSemana.length) {
    const wanted = new Set(
      diasSemana
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    );

    const out = [];
    for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) {
      if (wanted.has(d.getUTCDay())) out.push(_formatYmd(d));
    }
    return out;
  }

  // 3) Intervalo completo
  const out = [];
  for (let d = new Date(di); d <= df; d = _addUtcDays(d, 1)) {
    out.push(_formatYmd(d));
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
   COMPATIBILIDADE (mantém suas funções antigas)
   ────────────────────────────────────────────────────────────────── */

function formatarDataBR(dataEntrada) {
  if (!dataEntrada) return "";
  return toBrDate(dataEntrada);
}

function formatarDataISO(dataBR) {
  return brDateToIsoDate(dataBR);
}

/* ──────────────────────────────────────────────────────────────────
   EXPORTS
   ────────────────────────────────────────────────────────────────── */

module.exports = {
  parseUtc,
  toIsoUtc,
  dateOnlyToUtcDate,

  toBrDateOnlyString,
  toBrDate,
  toBrDateTime,

  brDateToIsoDate,
  brDateTimeToIsoUtc,

  formatarDataBR,
  formatarDataISO,

  isIsoDateOnly,

  gerarOcorrencias,
};
