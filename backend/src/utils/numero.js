"use strict";

/**
 * 📁 src/utils/numero.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Normalizar números inteiros com segurança.
 * - Evitar conversões ambíguas.
 * - Padronizar validação de IDs.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário aqui.
 */

function isBlankString(value) {
  return typeof value === "string" && value.trim() === "";
}

function normalizeBounds(options = {}) {
  const min = Number.isFinite(Number(options.min))
    ? Number(options.min)
    : Number.NEGATIVE_INFINITY;

  const max = Number.isFinite(Number(options.max))
    ? Number(options.max)
    : Number.POSITIVE_INFINITY;

  return {
    min,
    max,
  };
}

/**
 * Aceita apenas inteiros reais.
 *
 * Válidos:
 * - 10
 * - "10"
 * - "-5"
 *
 * Inválidos:
 * - 10.2
 * - "10.2"
 * - true
 * - ""
 * - null
 */
function toIntOrNull(value, options = {}) {
  const { min, max } = normalizeBounds(options);

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return null;
  }

  if (isBlankString(value)) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      return null;
    }

    if (value < min || value > max) {
      return null;
    }

    return value;
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!/^-?\d+$/.test(text)) {
      return null;
    }

    const number = Number(text);

    if (!Number.isSafeInteger(number)) {
      return null;
    }

    if (number < min || number > max) {
      return null;
    }

    return number;
  }

  return null;
}

/**
 * Versão tolerante: converte para número e trunca.
 *
 * Use apenas quando truncamento for desejado.
 *
 * Exemplos:
 * - "12.9" -> 12
 * - 12.9 -> 12
 */
function toTruncIntOrNull(value, options = {}) {
  const { min, max } = normalizeBounds(options);

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return null;
  }

  if (isBlankString(value)) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  const integer = Math.trunc(number);

  if (!Number.isSafeInteger(integer)) {
    return null;
  }

  if (integer < min || integer > max) {
    return null;
  }

  return integer;
}

/**
 * Normaliza ID positivo.
 *
 * Uso comum:
 * - params.id
 * - usuarioId
 * - eventoId
 * - turmaId
 */
function toPositiveIntOrNull(value) {
  return toIntOrNull(value, {
    min: 1,
  });
}

/**
 * Normaliza ID positivo usando truncamento.
 *
 * Use somente quando a origem puder vir como número decimal,
 * mas a regra de negócio aceitar truncar.
 */
function toPositiveTruncIntOrNull(value) {
  return toTruncIntOrNull(value, {
    min: 1,
  });
}

/**
 * Garante ID positivo ou lança erro operacional.
 */
function requirePositiveInt(value, fieldName = "id") {
  const id = toPositiveIntOrNull(value);

  if (!id) {
    const error = new Error(`${fieldName} inválido.`);
    error.code = "NUMERO-400-ID-INVALIDO";
    error.field = fieldName;
    throw error;
  }

  return id;
}

module.exports = {
  toIntOrNull,
  toTruncIntOrNull,
  toPositiveIntOrNull,
  toPositiveTruncIntOrNull,
  requirePositiveInt,
};