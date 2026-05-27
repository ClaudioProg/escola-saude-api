// 📁 src/utils/registro.js — v2.0
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Utilitário oficial para normalização de registro funcional.
 *
 * Regras:
 * - registro funcional é tratado como string numérica;
 * - remove pontuação, espaços e caracteres não numéricos;
 * - registro válido da plataforma possui exatamente 6 dígitos;
 * - listas podem vir de CSV, textarea, string única ou array;
 * - sequências maiores que 6 dígitos são quebradas em blocos fixos de 6;
 * - não usa modo deslizante para evitar falsos registros.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário aqui.
 */

const TAMANHO_REGISTRO = 6;
const MAX_REGISTRO_LEN = 20;
const MAX_LISTA_REGISTRO = 5000;
const MAX_RUN_LENGTH = 10000;

/* =========================
   Helpers internos
========================= */

function toPositiveInt(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function uniquePreserveOrder(lista) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(lista) ? lista : []) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }

  return out;
}

function somenteDigitos(value, maxLen = MAX_REGISTRO_LEN) {
  const safeMaxLen = toPositiveInt(maxLen, MAX_REGISTRO_LEN);

  return String(value ?? "")
    .replace(/\D+/g, "")
    .slice(0, safeMaxLen);
}

function quebrarEmBlocosDeRegistro(digitsRun) {
  const run = somenteDigitos(digitsRun, MAX_RUN_LENGTH);
  const out = [];

  if (run.length < TAMANHO_REGISTRO) {
    return out;
  }

  for (let index = 0; index + TAMANHO_REGISTRO <= run.length; index += TAMANHO_REGISTRO) {
    out.push(run.slice(index, index + TAMANHO_REGISTRO));
  }

  return out;
}

/* =========================
   API oficial
========================= */

/**
 * Mantém apenas dígitos.
 * Sempre retorna string.
 *
 * @param {any} value
 * @param {Object} [options]
 * @param {number} [options.maxLen=20]
 * @returns {string}
 */
function normalizarRegistro(value, options = {}) {
  const maxLen = toPositiveInt(options.maxLen, MAX_REGISTRO_LEN);

  return somenteDigitos(value, maxLen);
}

/**
 * Testa se o valor possui exatamente 6 dígitos.
 *
 * @param {any} value
 * @returns {boolean}
 */
function isRegistroValido(value) {
  return new RegExp(`^\\d{${TAMANHO_REGISTRO}}$`).test(String(value ?? ""));
}

/**
 * Normaliza uma lista de registros a partir de:
 * - string única;
 * - CSV;
 * - textarea;
 * - array.
 *
 * Regras:
 * - extrai sequências de dígitos;
 * - sequência com 6 dígitos: mantém;
 * - sequência maior que 6: quebra em blocos fixos de 6;
 * - sequência menor que 6: ignora;
 * - remove duplicados preservando ordem.
 *
 * @param {any} input
 * @param {Object} [options]
 * @param {number} [options.maxItems=5000]
 * @param {number} [options.maxRunLength=10000]
 * @returns {string[]}
 */
function normalizarListaRegistro(input, options = {}) {
  const maxItems = toPositiveInt(options.maxItems, MAX_LISTA_REGISTRO);
  const maxRunLength = toPositiveInt(options.maxRunLength, MAX_RUN_LENGTH);

  if (input === null || input === undefined || input === "") {
    return [];
  }

  const values = Array.isArray(input) ? input : [input];
  const coletados = [];

  for (const item of values) {
    if (coletados.length >= maxItems) {
      break;
    }

    const runs = String(item ?? "").match(/\d+/g) || [];

    for (const rawRun of runs) {
      if (coletados.length >= maxItems) {
        break;
      }

      const run = String(rawRun).slice(0, maxRunLength);

      if (run.length === TAMANHO_REGISTRO) {
        coletados.push(run);
        continue;
      }

      if (run.length > TAMANHO_REGISTRO) {
        const partes = quebrarEmBlocosDeRegistro(run);

        for (const parte of partes) {
          if (coletados.length >= maxItems) {
            break;
          }

          coletados.push(parte);
        }
      }
    }
  }

  return uniquePreserveOrder(
    coletados.filter(isRegistroValido)
  ).slice(0, maxItems);
}

/**
 * Retorna o primeiro registro válido encontrado, ou null.
 *
 * @param {any} input
 * @returns {string|null}
 */
function getPrimeiroRegistroValido(input) {
  const lista = normalizarListaRegistro(input, {
    maxItems: 1,
  });

  return lista[0] || null;
}

/* =========================
   Export oficial
========================= */

module.exports = {
  TAMANHO_REGISTRO,

  normalizarRegistro,
  normalizarListaRegistro,
  isRegistroValido,
  getPrimeiroRegistroValido,
};