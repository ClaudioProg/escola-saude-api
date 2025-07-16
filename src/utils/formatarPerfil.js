// src/utils/formatarPerfil.js

/**
 * Formata o perfil para string minúscula e separada por vírgula
 * Aceita array ou string simples
 * @param {string | string[]} perfil
 * @returns {string[]} perfil em formato array
 */
function formatarPerfil(perfil) {
    if (Array.isArray(perfil)) return perfil;
    if (typeof perfil === 'string') {
      return perfil.split(',').map(p => p.trim());
    }
    return [];
  }
  
  module.exports = formatarPerfil;
  