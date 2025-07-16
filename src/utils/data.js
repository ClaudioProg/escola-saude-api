// 📅 Formata data no padrão dd/mm/aaaa
export function formatarDataBrasileira(dataISO) {
  if (!dataISO) return "";

  // Se já for objeto Date, converte pra string ISO
  if (dataISO instanceof Date) {
    if (isNaN(dataISO.getTime())) return "";
    const dia = String(dataISO.getDate()).padStart(2, "0");
    const mes = String(dataISO.getMonth() + 1).padStart(2, "0");
    const ano = dataISO.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Se for string, tenta dividir normalmente
  if (typeof dataISO === "string") {
    // Cobre formatos "yyyy-mm-ddTHH:MM:SS" ou só "yyyy-mm-dd"
    const partes = dataISO.split("T")[0].split("-");
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    }
    // Se não bate, tenta converter como Date
    const d = new Date(dataISO);
    if (isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Caso não seja string nem Date, tenta converter
  try {
    const d = new Date(dataISO);
    if (isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch {
    return "";
  }
}
