/**
 * Gera um link para adicionar um evento ao Google Agenda.
 * @param {Object} params - Detalhes do evento
 * @param {string} params.titulo - Título do evento
 * @param {string|Date} params.dataInicio - Data/hora de início
 * @param {string|Date} params.dataFim - Data/hora de término
 * @param {string} params.descricao - Descrição do evento
 * @param {string} params.local - Local do evento
 * @returns {string} URL formatada para o Google Calendar
 */
export function gerarLinkGoogleAgenda({ titulo, dataInicio, dataFim, descricao, local }) {
  const formatarData = (data) => {
    const d = new Date(data);
    return isNaN(d.getTime()) ? "" : d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  };

  const inicioUTC = formatarData(dataInicio);
  const fimUTC = formatarData(dataFim);

  if (!inicioUTC || !fimUTC) return "";

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", titulo || "");
  url.searchParams.set("dates", `${inicioUTC}/${fimUTC}`);
  url.searchParams.set("details", descricao || "");
  url.searchParams.set("location", local || "");
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");

  return url.toString();
}

