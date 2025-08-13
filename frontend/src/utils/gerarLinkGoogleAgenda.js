/**
 * Gera um link para adicionar um evento ao Google Agenda.
 * @param {Object} params - Detalhes do evento
 * @param {string} params.titulo - Título do evento
 * @param {string|Date} params.dataInicio - Data/hora de início (horário local)
 * @param {string|Date} params.dataFim - Data/hora de término (horário local)
 * @param {string} params.descricao - Descrição do evento
 * @param {string} params.local - Local do evento
 * @returns {string} URL formatada para o Google Calendar
 */
export function gerarLinkGoogleAgenda({ titulo, dataInicio, dataFim, descricao, local }) {
  const formatarDataLocal = (data) => {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    const horas = String(d.getHours()).padStart(2, "0");
    const minutos = String(d.getMinutes()).padStart(2, "0");
    const segundos = String(d.getSeconds()).padStart(2, "0");
    return `${ano}${mes}${dia}T${horas}${minutos}${segundos}`;
  };

  const inicio = formatarDataLocal(dataInicio);
  const fim = formatarDataLocal(dataFim);

  if (!inicio || !fim) return "";

  const url = new URL("https://www.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", titulo || "");
  url.searchParams.set("dates", `${inicio}/${fim}`);
  url.searchParams.set("details", descricao || "");
  url.searchParams.set("location", local || "");
  url.searchParams.set("sf", "true");
  url.searchParams.set("output", "xml");
  url.searchParams.set("ctz", "America/Sao_Paulo"); // mantém fuso de Brasília

  return url.toString();
}
