// 📅 Formata data no padrão dd/mm/aaaa
export function formatarDataBrasileira(dataISO) {
  if (!dataISO) return "";

  // Se já for objeto Date
  if (dataISO instanceof Date) {
    if (isNaN(dataISO.getTime())) return "";
    const dia = String(dataISO.getDate()).padStart(2, "0");
    const mes = String(dataISO.getMonth() + 1).padStart(2, "0");
    const ano = dataISO.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Se for string
  if (typeof dataISO === "string") {
    // Caso especial: formato puro "yyyy-mm-dd" → evita fuso
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
      const [ano, mes, dia] = dataISO.split("-");
      return `${dia}/${mes}/${ano}`;
    }

    // Formato "yyyy-mm-ddTHH:MM:SS"
    const partes = dataISO.split("T")[0].split("-");
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    }

    // Fallback usando Date
    const d = new Date(dataISO);
    if (isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  // Caso não seja string nem Date
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

// 📆 Gera array de datas entre dois dias (inclui início e fim)
export function gerarIntervaloDeDatas(dataInicio, dataFim) {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return [];

  const datas = [];
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    datas.push(new Date(d));
  }
  return datas;
}

// 🧾 Formata CPF para XXX.XXX.XXX-XX
export function formatarCPF(cpf) {
  if (!cpf) return "";
  const num = String(cpf).replace(/\D/g, "");
  if (num.length !== 11) return cpf;
  return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// 🕒 Formata data+hora no padrão dd/mm/aaaa HH:MM
export function formatarDataHoraBrasileira(dataISO) {
  if (!dataISO) return "";

  let d;
  if (dataISO instanceof Date) {
    d = dataISO;
  } else {
    // Evita problema de fuso para datas puras sem hora
    if (typeof dataISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
      const [ano, mes, dia] = dataISO.split("-");
      d = new Date(Number(ano), Number(mes) - 1, Number(dia), 0, 0, 0);
    } else {
      d = new Date(dataISO);
    }
  }
  if (isNaN(d.getTime())) return "";

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, "0");
  const minutos = String(d.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

// 📅 Converte para ISO (yyyy-mm-dd) aceitando string BR ou objeto Date
export function formatarParaISO(data) {
  if (!data) return "";

  // Se for string dd/mm/aaaa
  if (typeof data === "string" && data.includes("/")) {
    const [dia, mes, ano] = data.split("/");
    if (!dia || !mes || !ano) return "";
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  // Se já for string yyyy-mm-dd → retorna direto
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }

  // Se for objeto Date ou string ISO completa
  const d = new Date(data);
  if (isNaN(d.getTime())) return "";

  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
