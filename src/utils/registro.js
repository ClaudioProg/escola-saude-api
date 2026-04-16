// 📁 src/utils/registro.js
"use strict";

/**
 * Mantém apenas dígitos.
 * Sempre retorna string.
 *
 * @param {any} value
 * @param {Object} [opts]
 * @param {number} [opts.maxLen=50] - limita comprimento final por segurança
 * @returns {string}
 */
function normalizeRegistro(value, opts = {}) {
  const rawMaxLen = Number(opts.maxLen);
  const maxLen =
    Number.isFinite(rawMaxLen) && rawMaxLen >= 0
      ? Math.trunc(rawMaxLen)
      : 50;

  return String(value ?? "")
    .replace(/\D+/g, "")
    .slice(0, maxLen);
}

/**
 * Testa se a string é exatamente 6 dígitos.
 *
 * @param {any} value
 * @returns {boolean}
 */
function isRegistro6(value) {
  return /^\d{6}$/.test(String(value ?? ""));
}

/**
 * Deduplica preservando ordem.
 *
 * @param {Array<string>} arr
 * @returns {Array<string>}
 */
function uniquePreserveOrder(arr) {
  const seen = new Set();
  const out = [];

  for (const v of Array.isArray(arr) ? arr : []) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }

  return out;
}

/**
 * Quebra uma sequência de dígitos em blocos de 6.
 *
 * mode:
 * - "nonOverlapping" (padrão): 123456789012 -> 123456, 789012
 * - "sliding":                1234567      -> 123456, 234567
 *
 * @param {any} digitsRun
 * @param {"nonOverlapping"|"sliding"} [mode="nonOverlapping"]
 * @returns {string[]}
 */
function splitRunsIntoSix(digitsRun, mode = "nonOverlapping") {
  const run = normalizeRegistro(digitsRun, { maxLen: 10000 });
  const out = [];

  if (run.length < 6) return out;

  if (mode === "sliding") {
    for (let i = 0; i + 6 <= run.length; i += 1) {
      out.push(run.slice(i, i + 6));
    }
    return out;
  }

  for (let i = 0; i + 6 <= run.length; i += 6) {
    out.push(run.slice(i, i + 6));
  }

  return out;
}

/**
 * Normaliza uma lista de registros a partir de:
 * - string única
 * - CSV
 * - textarea
 * - array
 *
 * Regras:
 * - extrai runs de dígitos
 * - run = 6   -> mantém
 * - run > 6   -> quebra em blocos de 6
 * - run < 6   -> ignora
 *
 * @param {any} input
 * @param {Object} [opts]
 * @param {"nonOverlapping"|"sliding"} [opts.mode="nonOverlapping"]
 * @param {number} [opts.maxItems=5000]
 * @param {number} [opts.maxRunLength=10000]
 * @returns {string[]}
 */
function normalizeListaRegistros(input, opts = {}) {
  const mode =
    opts.mode === "sliding" ? "sliding" : "nonOverlapping";

  const rawMaxItems = Number(opts.maxItems);
  const maxItems =
    Number.isFinite(rawMaxItems) && rawMaxItems > 0
      ? Math.trunc(rawMaxItems)
      : 5000;

  const rawMaxRunLength = Number(opts.maxRunLength);
  const maxRunLength =
    Number.isFinite(rawMaxRunLength) && rawMaxRunLength > 0
      ? Math.trunc(rawMaxRunLength)
      : 10000;

  if (input === null || input === undefined || input === "") return [];

  const values = Array.isArray(input) ? input : [input];
  const coletados = [];

  for (const item of values) {
    if (coletados.length >= maxItems) break;

    const runs = String(item ?? "").match(/\d+/g) || [];

    for (const rawRun of runs) {
      if (coletados.length >= maxItems) break;

      const run = String(rawRun).slice(0, maxRunLength);

      if (run.length === 6) {
        coletados.push(run);
        continue;
      }

      if (run.length > 6) {
        const partes = splitRunsIntoSix(run, mode);
        for (const parte of partes) {
          if (coletados.length >= maxItems) break;
          coletados.push(parte);
        }
      }
    }
  }

  return uniquePreserveOrder(
    coletados.filter(isRegistro6)
  ).slice(0, maxItems);
}

/**
 * Retorna o primeiro registro válido encontrado, ou null.
 *
 * @param {any} input
 * @returns {string|null}
 */
function getPrimeiroRegistroValido(input) {
  const lista = normalizeListaRegistros(input, { maxItems: 1 });
  return lista[0] || null;
}

module.exports = {
  normalizeRegistro,
  normalizeListaRegistros,
  isRegistro6,
  splitRunsIntoSix,
  uniquePreserveOrder,
  getPrimeiroRegistroValido,
};