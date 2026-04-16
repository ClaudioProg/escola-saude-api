// utils/notas.js
"use strict";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(x) {
  return clamp(Number(x), 0, 1);
}

function toNumber(v, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeDecimals(v, fallback = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.trunc(n), 0, 6);
}

function toCriterionKey(id) {
  if (id === undefined || id === null || id === "") return null;
  return String(id).trim();
}

function getItemCriterionId(item) {
  return item?.criterio_id ?? item?.criterio_oral_id ?? null;
}

/**
 * Calcula nota final em escala 0..10 normalizando itens que podem ter escalas diferentes.
 *
 * @param {Object} args
 * @param {Array} args.itens
 *   Ex.: [{ criterio_id, nota }] ou [{ criterio_oral_id, nota }]
 * @param {Array} args.criterios
 *   Ex.: [{ id, escala_min, escala_max, peso? }]
 * @param {Object} [opts]
 * @param {number} [opts.decimals=1]       Casas decimais do retorno
 * @param {boolean} [opts.withMeta=false]  Retorna metadados do cálculo
 * @returns {number|null|{nota:number|null, meta:Object}}
 */
function nota10Normalizada({ itens, criterios } = {}, opts = {}) {
  const decimals = toSafeDecimals(opts.decimals, 1);
  const withMeta = opts.withMeta === true;

  const itensArr = Array.isArray(itens) ? itens : [];
  const critArr = Array.isArray(criterios) ? criterios : [];

  const byId = new Map(
    critArr
      .map((c) => {
        const key = toCriterionKey(c?.id);
        return key ? [key, c] : null;
      })
      .filter(Boolean)
  );

  let somaPonderadaScore = 0; // score normalizado 0..1 ponderado
  let somaPesos = 0;
  let validCount = 0;
  let skippedCount = 0;

  for (const item of itensArr) {
    const itemCriterionId = toCriterionKey(getItemCriterionId(item));
    if (!itemCriterionId) {
      skippedCount += 1;
      continue;
    }

    const criterio = byId.get(itemCriterionId);
    if (!criterio) {
      skippedCount += 1;
      continue;
    }

    const min = toNumber(criterio.escala_min ?? 0);
    const max = toNumber(criterio.escala_max ?? 10);
    const notaBruta = toNumber(item?.nota);

    const pesoRaw = criterio?.peso;
    const peso = Number.isFinite(Number(pesoRaw)) ? Number(pesoRaw) : 1;

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      skippedCount += 1;
      continue;
    }

    if (!Number.isFinite(notaBruta)) {
      skippedCount += 1;
      continue;
    }

    if (!(peso > 0)) {
      skippedCount += 1;
      continue;
    }

    const score01 = clamp01((notaBruta - min) / (max - min));

    somaPonderadaScore += peso * score01;
    somaPesos += peso;
    validCount += 1;
  }

  const nota =
    somaPesos === 0
      ? null
      : Number((10 * (somaPonderadaScore / somaPesos)).toFixed(decimals));

  if (!withMeta) return nota;

  return {
    nota,
    meta: {
      validCount,
      skippedCount,
      totalItensRecebidos: itensArr.length,
      totalCriteriosRecebidos: critArr.length,
      pesoTotal: Number(somaPesos.toFixed(4)),
      score01:
        somaPesos === 0
          ? null
          : Number((somaPonderadaScore / somaPesos).toFixed(4)),
      decimals,
    },
  };
}

/**
 * Média simples de notas já em escala 0..10.
 * Ignora valores inválidos.
 *
 * @param {Array<number>} notas
 * @param {Object} [opts]
 * @param {number} [opts.decimals=1]
 * @returns {number|null}
 */
function mediaNotas10(notas = [], opts = {}) {
  const decimals = toSafeDecimals(opts.decimals, 1);

  const arr = Array.isArray(notas)
    ? notas.map((n) => toNumber(n)).filter(Number.isFinite)
    : [];

  if (!arr.length) return null;

  const soma = arr.reduce((acc, n) => acc + n, 0);
  return Number((soma / arr.length).toFixed(decimals));
}

module.exports = {
  clamp01,
  toNumber,
  nota10Normalizada,
  mediaNotas10,
};