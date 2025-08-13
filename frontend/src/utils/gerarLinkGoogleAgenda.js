/**
 * utils/calendarLinks.js
 *
 * Gera link do Google Calendar a partir de datas locais,
 * evitando o problema de "voltar um dia" no Brasil.
 */

/**
 * Constrói um Date no FUSO LOCAL a partir de:
 *  - Date
 *  - "YYYY-MM-DD"
 *  - "YYYY-MM-DD HH:mm"
 *  - "YYYY-MM-DDTHH:mm"
 */
function toLocalDate(dateLike) {
  if (dateLike instanceof Date) return dateLike;

  const s = String(dateLike || "").trim();
  if (!s) return new Date(NaN);

  // Normaliza separador de data/hora para "T"
  const norm = s.replace(" ", "T");
  const [datePart, timePart = "00:00"] = norm.split("T");

  const [y, m, d] = (datePart || "").split("-").map(Number);
  const [hhStr = "00", mmStr = "00"] = (timePart || "").split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  // Cria Date no fuso LOCAL (ano, mês-1, dia, hora, minuto)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

/**
 * Formata Date para o padrão do Google Calendar:
 *  - Com horário: YYYYMMDDTHHMMSSZ (UTC)
 */
function toGoogleUtcStamp(d) {
  // toISOString() => "YYYY-MM-DDTHH:MM:SS.sssZ"
  // Remove -, :, e .sss
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/**
 * Gera um link para adicionar um evento ao Google Agenda.
 * @param {Object} params
 * @param {string} params.titulo        - Título do evento
 * @param {string|Date} params.dataInicio - Data/hora de início (horário local)
 * @param {string|Date} params.dataFim    - Data/hora de término (horário local)
 * @param {string} [params.descricao]   - Descrição
 * @param {string} [params.local]       - Local
 * @param {string} [params.ctz="America/Sao_Paulo"] - Timezone do calendário
 * @returns {string} URL para o Google Calendar
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

  if (Number.isNaN(startLocal.getTime())) {
    throw new Error("dataInicio inválida para gerar link do Google Agenda.");
  }
  if (Number.isNaN(endLocal.getTime())) {
    // Se não veio dataFim válida, assume +1 hora
    endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
  }
  if (endLocal <= startLocal) {
    // Garante término > início (mínimo +1 minuto)
    endLocal = new Date(startLocal.getTime() + 60 * 1000);
  }

  const inicioUTC = toGoogleUtcStamp(startLocal); // YYYYMMDDTHHMMSSZ
  const fimUTC = toGoogleUtcStamp(endLocal);

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", titulo || "");
  url.searchParams.set("dates", `${inicioUTC}/${fimUTC}`); // intervalo UTC
  url.searchParams.set("details", descricao || "");
  url.searchParams.set("location", local || "");
  url.searchParams.set("ctz", ctz); // exibe na TZ desejada na UI
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");

  return url.toString();
}
