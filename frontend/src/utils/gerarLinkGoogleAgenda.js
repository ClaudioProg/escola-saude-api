/**
 * utils/gerarLinkGoogleAgenda.js
 *
 * Gera link do Google Calendar a partir de datas LOCAIS
 * sem “voltar um dia” no Brasil. Robusto a vários formatos.
 */

/** Constrói um Date no FUSO LOCAL a partir de:
 *  - Date
 *  - "YYYY-MM-DD"
 *  - "YYYY-MM-DD HH:mm"
 *  - "YYYY-MM-DDTHH:mm"
 *  - "YYYY-MM-DDTHH:mm:ss"
 *  - ISO com Z/offset ("2025-09-03T14:00:00Z" | "2025-09-03T14:00:00-03:00")
 */
function toLocalDate(dateLike) {
  if (dateLike instanceof Date) return dateLike;

  const s = String(dateLike || "").trim();
  if (!s) return new Date(NaN);

  // Se vier ISO com Z/offset, respeita o horário real (não force local)
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
  }

  // Normaliza separador " " -> "T" e separa data/hora
  const norm = s.replace(" ", "T");
  const [datePart, timePartRaw = "00:00"] = norm.split("T");

  const [y, m, d] = (datePart || "").split("-").map((n) => parseInt(n, 10));
  const [HH = "00", MM = "00", SS = "00"] = (timePartRaw || "").split(":");

  const hh = parseInt(HH, 10) || 0;
  const mm = parseInt(MM, 10) || 0;
  const ss = parseInt(SS, 10) || 0;

  // Cria Date no fuso LOCAL
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss, 0);
}

/** Formata Date para o padrão do Google Calendar (UTC):
 *  YYYYMMDDTHHMMSSZ
 */
function toGoogleUtcStamp(d) {
  // toISOString() => "YYYY-MM-DDTHH:MM:SS.sssZ"
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/**
 * Gera um link para adicionar evento ao Google Agenda.
 * @param {Object} params
 * @param {string} params.titulo
 * @param {string|Date} params.dataInicio  - Local time
 * @param {string|Date} params.dataFim     - Local time
 * @param {string} [params.descricao=""]
 * @param {string} [params.local=""]
 * @param {string} [params.ctz="America/Sao_Paulo"] - Timezone de exibição
 * @returns {string}
 */
export function gerarLinkGoogleAgenda({
  titulo,
  dataInicio,
  dataFim,
  descricao = "",
  local = "",
  ctz = "America/Sao_Paulo",
}) {
  const startLocal = toLocalDate(dataInicio);
  let endLocal = toLocalDate(dataFim);

  if (!(startLocal instanceof Date) || Number.isNaN(startLocal.getTime())) {
    throw new Error("dataInicio inválida para gerar link do Google Agenda.");
  }

  // Se fim inválido, assume +90 min; se <= início, força +1 min
  if (!(endLocal instanceof Date) || Number.isNaN(endLocal.getTime())) {
    endLocal = new Date(startLocal.getTime() + 90 * 60 * 1000);
  }
  if (endLocal <= startLocal) {
    endLocal = new Date(startLocal.getTime() + 60 * 1000);
  }

  const inicioUTC = toGoogleUtcStamp(startLocal);
  const fimUTC = toGoogleUtcStamp(endLocal);

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", titulo || "");
  url.searchParams.set("dates", `${inicioUTC}/${fimUTC}`); // intervalo em UTC
  url.searchParams.set("details", descricao || "");
  url.searchParams.set("location", local || "");
  url.searchParams.set("ctz", ctz); // exibição na TZ desejada
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");

  return url.toString();
}
