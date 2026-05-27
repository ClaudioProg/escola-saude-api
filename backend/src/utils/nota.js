"use strict";

/**
 * 📁 src/utils/nota.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Calcular notas normalizadas em escala 0..10.
 * - Calcular média simples de notas já em escala 0..10.
 *
 * Contrato oficial:
 * - item.criterio_id
 * - criterio.id
 * - criterio.escala_min
 * - criterio.escala_max
 * - criterio.peso
 *
 * Não usar:
 * - criterio_oral_id
 * - múltiplos nomes para o mesmo identificador
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário aqui.
 */

/* =========================
   Helpers numéricos
========================= */

function toNumber(value, fallback = NaN) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  const number = toNumber(value, min);
  const safeMin = toNumber(min, 0);
  const safeMax = toNumber(max, safeMin);

  if (safeMax < safeMin) {
    return safeMin;
  }

  return Math.max(safeMin, Math.min(safeMax, number));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function toSafeDecimals(value, fallback = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return clamp(Math.trunc(number), 0, 6);
}

function toCriterionKey(id) {
  if (id === undefined || id === null || id === "") {
    return null;
  }

  const key = String(id).trim();

  return key || null;
}

function getItemCriterioId(item) {
  return item?.criterio_id ?? null;
}

/* =========================
   Nota normalizada
========================= */

/**
 * Calcula nota final em escala 0..10, normalizando itens que podem ter escalas diferentes.
 *
 * Exemplo de itens:
 *   [{ criterio_id, nota }]
 *
 * Exemplo de critérios:
 *   [{ id, escala_min, escala_max, peso }]
 *
 * @param {Object} args
 * @param {Array} args.itens
 * @param {Array} args.criterios
 * @param {Object} [options]
 * @param {number} [options.decimals=1]
 * @param {boolean} [options.withMeta=false]
 * @returns {number|null|{nota:number|null, meta:Object}}
 */
function calcularNota10Normalizada({ itens, criterios } = {}, options = {}) {
  const decimals = toSafeDecimals(options.decimals, 1);
  const withMeta = options.withMeta === true;

  const itensArr = Array.isArray(itens) ? itens : [];
  const criterioArr = Array.isArray(criterios) ? criterios : [];

  const criterioPorId = new Map(
    criterioArr
      .map((criterio) => {
        const key = toCriterionKey(criterio?.id);

        return key ? [key, criterio] : null;
      })
      .filter(Boolean)
  );

  let somaPonderadaScore = 0;
  let somaPeso = 0;
  let totalValido = 0;
  let totalIgnorado = 0;

  for (const item of itensArr) {
    const criterioId = toCriterionKey(getItemCriterioId(item));

    if (!criterioId) {
      totalIgnorado += 1;
      continue;
    }

    const criterio = criterioPorId.get(criterioId);

    if (!criterio) {
      totalIgnorado += 1;
      continue;
    }

    const escalaMin = toNumber(criterio.escala_min ?? 0);
    const escalaMax = toNumber(criterio.escala_max ?? 10);
    const notaBruta = toNumber(item?.nota);
    const peso = toNumber(criterio?.peso, 1);

    if (!Number.isFinite(escalaMin)) {
      totalIgnorado += 1;
      continue;
    }

    if (!Number.isFinite(escalaMax) || escalaMax <= escalaMin) {
      totalIgnorado += 1;
      continue;
    }

    if (!Number.isFinite(notaBruta)) {
      totalIgnorado += 1;
      continue;
    }

    if (!Number.isFinite(peso) || peso <= 0) {
      totalIgnorado += 1;
      continue;
    }

    const score01 = clamp01((notaBruta - escalaMin) / (escalaMax - escalaMin));

    somaPonderadaScore += peso * score01;
    somaPeso += peso;
    totalValido += 1;
  }

  const nota =
    somaPeso === 0
      ? null
      : Number((10 * (somaPonderadaScore / somaPeso)).toFixed(decimals));

  if (!withMeta) {
    return nota;
  }

  return {
    nota,
    meta: {
      totalValido,
      totalIgnorado,
      totalItemRecebido: itensArr.length,
      totalCriterioRecebido: criterioArr.length,
      pesoTotal: Number(somaPeso.toFixed(4)),
      score01:
        somaPeso === 0
          ? null
          : Number((somaPonderadaScore / somaPeso).toFixed(4)),
      decimals,
    },
  };
}

/* =========================
   Média simples
========================= */

/**
 * Calcula média simples de notas já em escala 0..10.
 * Ignora valores inválidos.
 *
 * @param {Array<number>} notas
 * @param {Object} [options]
 * @param {number} [options.decimals=1]
 * @returns {number|null}
 */
function calcularMediaNota10(notas = [], options = {}) {
  const decimals = toSafeDecimals(options.decimals, 1);

  const valores = Array.isArray(notas)
    ? notas.map((nota) => toNumber(nota)).filter(Number.isFinite)
    : [];

  if (!valores.length) {
    return null;
  }

  const soma = valores.reduce((acc, nota) => acc + nota, 0);

  return Number((soma / valores.length).toFixed(decimals));
}

/* =========================
   Export oficial
========================= */

module.exports = {
  calcularNota10Normalizada,
  calcularMediaNota10,

  clamp01,
  toNumber,
};