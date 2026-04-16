// src/utils/formatarPerfil.js
"use strict";

/**
 * Normaliza perfis/roles para array de strings em lowercase.
 *
 * Aceita:
 * - string: "Administrador, Usuario"
 * - string com separadores mistos: "Administrador; Usuario | Instrutor"
 * - array: ["Administrador", "Usuario"]
 * - null / undefined
 *
 * Regras:
 * - trim
 * - lowercase
 * - remove vazios
 * - remove duplicados
 * - aplica aliases conhecidos
 *
 * Exemplo:
 *   formatarPerfil("Admin, Usuario, admin")
 *   -> ["administrador", "usuario"]
 */

const ROLE_ALIASES = {
  admin: "administrador",
};

function uniq(arr) {
  return [...new Set(arr)];
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "";
  return ROLE_ALIASES[value] || value;
}

function splitPerfisString(value) {
  return String(value || "")
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatarPerfil(perfil) {
  if (!perfil) return [];

  const arr = Array.isArray(perfil)
    ? perfil
    : typeof perfil === "string"
      ? splitPerfisString(perfil)
      : [];

  return uniq(
    arr
      .map((item) => normalizeRole(item))
      .filter(Boolean)
  );
}

module.exports = formatarPerfil;
module.exports.default = formatarPerfil;
module.exports.normalizeRole = normalizeRole;
module.exports.uniq = uniq;