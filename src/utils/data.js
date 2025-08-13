// 📅 Converte Date ou string ISO para dd/mm/aaaa, evitando problemas de fuso
function formatarDataBR(dataEntrada) {
  if (!dataEntrada) return "";

  // Se já for Date válido
  if (dataEntrada instanceof Date && !isNaN(dataEntrada.getTime())) {
    const dia = String(dataEntrada.getDate()).padStart(2, "0");
    const mes = String(dataEntrada.getMonth() + 1).padStart(2, "0");
    const ano = dataEntrada.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Se for string no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm
  if (typeof dataEntrada === "string") {
    const partes = dataEntrada.split("T")[0].split("-");
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
    }
  }

  return "";
}

// 📅 Converte dd/mm/aaaa para YYYY-MM-DD
function formatarDataISO(dataBR) {
  if (!dataBR || typeof dataBR !== "string") return "";

  const [dia, mes, ano] = dataBR.split("/");
  if (!dia || !mes || !ano) return "";

  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

module.exports = {
  formatarDataBR,
  formatarDataISO
};
