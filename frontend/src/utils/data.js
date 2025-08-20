// frontend/src/utils/data.js

// Zona padrão para exibição; usa a do navegador se disponível
const ZONA_PADRAO =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   DETECÇÃO / PARSE
   ────────────────────────────────────────────────────────────── */

export function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/** Constrói Date no fuso LOCAL do navegador. */
export function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
      return isNaN(dt) ? null : dt;
    }
    const dt = new Date(input); // respeita Z/offset se houver, senão assume local
    return isNaN(dt) ? null : dt;
  }

  const dt = new Date(input);
  return isNaN(dt) ? null : dt;
}

/* ──────────────────────────────────────────────────────────────
   FORMATAÇÃO pt-BR (exibição)
   ────────────────────────────────────────────────────────────── */

export function fmtData(dateIsoUtc, zone = ZONA_PADRAO) {
  const d = toLocalDate(dateIsoUtc);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d); // dd/mm/aaaa
}

export function fmtDataHora(dateIsoUtc, zone = ZONA_PADRAO) {
  const d = toLocalDate(dateIsoUtc);
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
  const [dd, mm, yyyy] = dataBr.split("/").map((x) => String(x || "").trim());
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "dd/MM/aaaa"+"HH:mm" (hora local do navegador) -> ISO UTC (com 'Z')
 * Ex.: "18/08/2025","14:30" → "2025-08-18T17:30:00.000Z" (depende do offset vigente)
 */
export function brDateTimeToIsoUtc(dataBr, horaBr = "00:00") {
  const isoDate = brDateToIsoDate(dataBr);
  if (!isoDate) return null;

  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, min] = (horaBr || "00:00").split(":").map((x) => parseInt(x, 10));
  const local = new Date(y, (m - 1), d, isNaN(hh) ? 0 : hh, isNaN(min) ? 0 : min, 0, 0);
  return isNaN(local) ? null : local.toISOString(); // ISO UTC com 'Z'
}

/* ──────────────────────────────────────────────────────────────
   FUNÇÕES LEGADAS (mantidas) → redirecionam pros helpers padronizados
   ────────────────────────────────────────────────────────────── */

/** (LEGADO) Formata data no padrão dd/mm/aaaa */
export function formatarDataBrasileira(dataISO) {
  // aceita Date, ISO com Z, "YYYY-MM-DD"
  if (!dataISO) return "";
  if (typeof dataISO === "string" && isDateOnly(dataISO)) {
    // evita fuso para data-only
    const [y, m, d] = dataISO.split("-");
    return `${d}/${m}/${y}`;
  }
  return fmtData(dataISO);
}

/** (LEGADO) Formata data+hora no padrão dd/mm/aaaa HH:MM */
export function formatarDataHoraBrasileira(dataISO) {
  if (!dataISO) return "";
  return fmtDataHora(dataISO);
}

/** (LEGADO) Converte para ISO (yyyy-mm-dd) aceitando string BR, Date, ISO */
export function formatarParaISO(data) {
  if (!data) return "";
  if (typeof data === "string" && data.includes("/")) {
    return brDateToIsoDate(data); // "dd/MM/aaaa" -> "YYYY-MM-DD"
  }
  if (typeof data === "string" && isDateOnly(data)) {
    return data; // já é "YYYY-MM-DD"
  }
  const d = toLocalDate(data);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ──────────────────────────────────────────────────────────────
   OUTROS (mantidos)
   ────────────────────────────────────────────────────────────── */

export function gerarIntervaloDeDatas(dataInicio, dataFim) {
  const ini = toLocalDate(dataInicio);
  const fim = toLocalDate(dataFim);
  if (!ini || !fim) return [];
  const datas = [];
  // garanta dia a dia sem mutar "ini" original
  for (let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()); d <= fim; d.setDate(d.getDate() + 1)) {
    datas.push(new Date(d));
  }
  return datas;
}

export function formatarCPF(cpf) {
  if (!cpf) return "";
  const num = String(cpf).replace(/\D/g, "");
  if (num.length !== 11) return cpf;
  return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
