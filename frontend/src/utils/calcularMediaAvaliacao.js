// 📁 src/utils/calcularMediaAvaliacao.js — v2.0

/**
 * Utilitário oficial para cálculo de média de avaliação.
 *
 * Contrato oficial:
 * - As notas já chegam em escala 0..10.
 * - Não converter nota 1..5 para 2..10.
 * - Não dobrar nota.
 *
 * Exemplo:
 * avaliacao = [
 *   {
 *     criterios: [
 *       { nota: 8 },
 *       { nota: 10 },
 *       { nota: 6 }
 *     ]
 *   }
 * ]
 *
 * Não usar:
 * - computeMedia5
 * - computeMedia10
 * - fator escala / 5
 * - nota1, nota2, nota3...
 * - nota em escala 1..5
 */

const STATUS_AVALIACAO = {
  SEM_AVALIACAO: "sem-avaliacao",
  PARCIAL: "parcial",
  COMPLETA: "completa",
};

function toPositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function toDecimalPlaces(value, fallback = 1) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    return fallback;
  }

  return Math.min(number, 6);
}

function normalizarNota10(value, clamp = true) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (!clamp) {
    return number;
  }

  return Math.max(0, Math.min(10, number));
}

function normalizarPesos(pesos, totalCriterios) {
  if (!Array.isArray(pesos) || pesos.length === 0) {
    return Array.from({ length: totalCriterios }, () => 1);
  }

  return Array.from({ length: totalCriterios }, (_item, index) => {
    const peso = Number(pesos[index] ?? 1);

    return Number.isFinite(peso) && peso > 0 ? peso : 1;
  });
}

function getNotasDoAvaliador(avaliador, totalCriterios, clamp) {
  const criterios = Array.isArray(avaliador?.criterios)
    ? avaliador.criterios
    : [];

  return Array.from({ length: totalCriterios }, (_item, index) => {
    return normalizarNota10(criterios[index]?.nota, clamp);
  });
}

function arredondar(value, casas) {
  const factor = 10 ** casas;

  return Math.round(value * factor) / factor;
}

function resolverStatusAvaliacao(recebidas, esperadas) {
  if (recebidas === 0) {
    return STATUS_AVALIACAO.SEM_AVALIACAO;
  }

  if (recebidas < esperadas) {
    return STATUS_AVALIACAO.PARCIAL;
  }

  return STATUS_AVALIACAO.COMPLETA;
}

/**
 * Calcula média de avaliação em escala 0..10.
 *
 * @param {Array<object>} avaliacao
 * @param {object} options
 * @param {number} [options.totalCriterio=4]
 * @param {number} [options.totalAvaliadorEsperado=2]
 * @param {number[]} [options.pesos]
 * @param {number} [options.casas=1]
 * @param {boolean} [options.clamp=true]
 */
export function calcularMediaAvaliacao(avaliacao = [], options = {}) {
  const {
    totalCriterio = 4,
    totalAvaliadorEsperado = 2,
    pesos,
    casas = 1,
    clamp = true,
  } = options || {};

  const criterioTotal = toPositiveInteger(totalCriterio, 4);
  const avaliadorEsperadoTotal = toPositiveInteger(totalAvaliadorEsperado, 2);
  const casasDecimais = toDecimalPlaces(casas, 1);
  const pesoPorCriterio = normalizarPesos(pesos, criterioTotal);
  const lista = Array.isArray(avaliacao) ? avaliacao : [];

  const detalhePorAvaliador = [];
  const detalhePorCriterio = Array.from({ length: criterioTotal }, () => ({
    somaNota10: 0,
    quantidade: 0,
  }));

  let recebidas = 0;
  let somaNota10PonderadaTotal = 0;
  let somaPesoTotal = 0;

  for (let avaliadorIndex = 0; avaliadorIndex < lista.length; avaliadorIndex += 1) {
    const notas = getNotasDoAvaliador(
      lista[avaliadorIndex],
      criterioTotal,
      clamp
    );

    const temNotaValida = notas.some((nota) => nota !== null);

    if (!temNotaValida) {
      detalhePorAvaliador.push({
        index: avaliadorIndex,
        notasValidas: 0,
        somaNota10Ponderada: 0,
        somaPeso: 0,
      });

      continue;
    }

    recebidas += 1;

    let somaNota10PonderadaAvaliador = 0;
    let somaPesoAvaliador = 0;
    let notasValidas = 0;

    for (let criterioIndex = 0; criterioIndex < criterioTotal; criterioIndex += 1) {
      const nota = notas[criterioIndex];

      if (nota === null) {
        continue;
      }

      const peso = pesoPorCriterio[criterioIndex];
      const valorPonderado = nota * peso;

      somaNota10PonderadaAvaliador += valorPonderado;
      somaNota10PonderadaTotal += valorPonderado;

      somaPesoAvaliador += peso;
      somaPesoTotal += peso;

      detalhePorCriterio[criterioIndex].somaNota10 += nota;
      detalhePorCriterio[criterioIndex].quantidade += 1;

      notasValidas += 1;
    }

    detalhePorAvaliador.push({
      index: avaliadorIndex,
      notasValidas,
      somaNota10Ponderada: somaNota10PonderadaAvaliador,
      somaPeso: somaPesoAvaliador,
    });
  }

  const media =
    somaPesoTotal > 0
      ? arredondar(somaNota10PonderadaTotal / somaPesoTotal, casasDecimais)
      : 0;

  return {
    media,
    escala: 10,
    recebidas,
    esperadas: avaliadorEsperadoTotal,
    totalCriterio: criterioTotal,
    status: resolverStatusAvaliacao(recebidas, avaliadorEsperadoTotal),
    somaNota10Ponderada: somaNota10PonderadaTotal,
    somaPeso: somaPesoTotal,
    detalhes: {
      porAvaliador: detalhePorAvaliador,
      porCriterio: detalhePorCriterio.map((item, index) => ({
        index,
        somaNota10: item.somaNota10,
        quantidade: item.quantidade,
      })),
    },
  };
}

export { STATUS_AVALIACAO };