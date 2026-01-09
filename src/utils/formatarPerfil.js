// src/utils/formatarPerfil.js

/**
 * Normaliza perfis/roles para array de strings em lowercase.
 *
 * Aceita:
 *  - string: "Administrador, Usuario"
 *  - array: ["Administrador", "Usuario"]
 *  - null / undefined
 *
 * @param {string | string[] | null | undefined} perfil
 * @returns {string[]} Array normalizado (ex: ["administrador", "usuario"])
 */
function formatarPerfil(perfil) {
  if (!perfil) return [];

  const arr = Array.isArray(perfil)
    ? perfil
    : typeof perfil === "string"
      ? perfil.split(",")
      : [];

  return arr
    .map((p) => String(p || "").toLowerCase().trim())
    .filter(Boolean);
}

module.exports = formatarPerfil;
