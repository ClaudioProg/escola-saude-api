// 📁 src/utils/perfil.js — v2.0
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Utilitário oficial para validação de perfil institucional.
 *
 * Função:
 * - Verificar se o perfil institucional do usuário está completo.
 * - Listar campos obrigatórios faltantes.
 *
 * Regra oficial de obrigatoriedade:
 * - cargo_id
 * - unidade_id
 * - data_nascimento
 * - escolaridade_id
 * - deficiencia_id
 *
 * Campos opcionais:
 * - genero_id
 * - orientacao_sexual_id
 * - cor_raca_id
 * - registro
 *
 * Não usar aqui:
 * - autorização por perfil
 * - middleware de permissão
 * - aliases admin/administrador
 * - req.usuario
 * - req.auth
 * - roles/role/perfis
 */

const { isIsoDateOnly } = require("./dateUtils");
const { toPositiveIntOrNull } = require("./numero");

/* =========================
   Constantes
========================= */

const CAMPO_OBRIGATORIO_PERFIL = [
  "cargo_id",
  "unidade_id",
  "data_nascimento",
  "escolaridade_id",
  "deficiencia_id",
];

const CAMPO_OPCIONAL_PERFIL = [
  "genero_id",
  "orientacao_sexual_id",
  "cor_raca_id",
  "registro",
];

/* =========================
   Helpers
========================= */

function isEmptyValue(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string" && !value.trim()) {
    return true;
  }

  return false;
}

function isValidPerfilId(value) {
  return toPositiveIntOrNull(value) !== null;
}

function normalizeDateOnlyFromValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

function isValidDataNascimento(value) {
  const ymd = normalizeDateOnlyFromValue(value);

  return isIsoDateOnly(ymd);
}

function isCampoPerfilValido(usuario, campo) {
  const value = usuario?.[campo];

  if (isEmptyValue(value)) {
    return false;
  }

  if (campo === "data_nascimento") {
    return isValidDataNascimento(value);
  }

  return isValidPerfilId(value);
}

/* =========================
   Perfil completo
========================= */

function camposFaltantesPerfil(usuario) {
  if (!usuario || typeof usuario !== "object") {
    return [...CAMPO_OBRIGATORIO_PERFIL];
  }

  return CAMPO_OBRIGATORIO_PERFIL.filter(
    (campo) => !isCampoPerfilValido(usuario, campo)
  );
}

function isPerfilIncompleto(usuario) {
  return camposFaltantesPerfil(usuario).length > 0;
}

function isPerfilCompleto(usuario) {
  return !isPerfilIncompleto(usuario);
}

/* =========================
   Export oficial
========================= */

module.exports = {
  CAMPO_OBRIGATORIO_PERFIL,
  CAMPO_OPCIONAL_PERFIL,

  isPerfilIncompleto,
  isPerfilCompleto,
  camposFaltantesPerfil,
};