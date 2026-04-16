// utils/number.js
"use strict";

function isBlankString(v) {
  return typeof v === "string" && v.trim() === "";
}

function normalizeBounds(opts = {}) {
  const min =
    Number.isFinite(Number(opts.min)) ? Number(opts.min) : Number.NEGATIVE_INFINITY;

  const max =
    Number.isFinite(Number(opts.max)) ? Number(opts.max) : Number.POSITIVE_INFINITY;

  return { min, max };
}

/**
 * Aceita apenas inteiros reais.
 *
 * Exemplos válidos:
 * - 10
 * - "10"
 * - "-5"
 *
 * Exemplos inválidos:
 * - 10.2
 * - "10.2"
 * - true
 * - ""
 * - null
 */
function toIntOrNull(v, opts = {}) {
  const { min, max } = normalizeBounds(opts);

  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return null;
  if (isBlankString(v)) return null;

  if (typeof v === "number") {
    if (!Number.isInteger(v)) return null;
    if (v < min || v > max) return null;
    return v;
  }

  if (typeof v === "string") {
    const s = v.trim();

    // aceita apenas string inteira decimal simples
    if (!/^-?\d+$/.test(s)) return null;

    const n = Number(s);
    if (!Number.isSafeInteger(n)) return null;
    if (n < min || n > max) return null;

    return n;
  }

  return null;
}

/**
 * Versão tolerante: converte para número e trunca.
 * Use só quando truncamento for desejado de verdade.
 *
 * Exemplos:
 * - "12.9" -> 12
 * - 12.9 -> 12
 */
function toTruncIntOrNull(v, opts = {}) {
  const { min, max } = normalizeBounds(opts);

  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return null;
  if (isBlankString(v)) return null;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);
  if (!Number.isSafeInteger(i)) return null;
  if (i < min || i > max) return null;

  return i;
}

module.exports = {
  toIntOrNull,
  toTruncIntOrNull,
};