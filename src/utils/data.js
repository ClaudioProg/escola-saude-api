// 📅 Formata data no padrão dd/mm/aaaa
function formatarDataBrasileira(dataISO) {
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
    const partes = dataISO.split("T")[0].split("-");
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    }
    const d = new Date(dataISO);
    if (isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  return "";
}

// 📅 Converte "2025-07-24" para "24/07/2025"
function formatarDataBR(dataISO) {
  if (!dataISO) return "";

  try {
    const data = new Date(dataISO);
    if (isNaN(data.getTime())) return "";
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch {
    return "";
  }
}

// 📅 Converte "24/07/2025" para "2025-07-24"
function formatarDataISO(dataBR) {
  if (!dataBR || typeof dataBR !== "string") return "";

  const [dia, mes, ano] = dataBR.split("/");
  if (!dia || !mes || !ano) return "";

  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

module.exports = {
  formatarDataBR,
  formatarDataISO,
  formatarDataBrasileira,
};
