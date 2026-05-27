"use strict";

/**
 * 📁 src/utils/normalizarPerfil.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Utilitário oficial para normalização e validação de perfil.
 *
 * Perfis oficiais:
 * - usuario
 * - organizador
 * - administrador
 *
 * Contrato v2.0:
 * - perfil do usuário é sempre UM valor oficial;
 * - listas de perfis são permitidas apenas para autorização, nunca como valor
 *   gravado em usuário/sessão/token;
 * - não há aliases;
 * - não há fallback silencioso;
 * - não converter "admin" para "administrador";
 * - não aceitar role/roles/perfis como contrato alternativo.
 */

const PERFIL = Object.freeze({
  USUARIO: "usuario",
  organizador: "organizador",
  ADMINISTRADOR: "administrador",
});

const PERFIS_OFICIAIS = Object.freeze([
  PERFIL.USUARIO,
  PERFIL.organizador,
  PERFIL.ADMINISTRADOR,
]);

const PERFIL_OFICIAL = new Set(PERFIS_OFICIAIS);

function normalizarTextoPerfil(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

function erroPerfilInvalido(perfisInvalidos) {
  const invalidos = Array.isArray(perfisInvalidos)
    ? perfisInvalidos.filter(Boolean)
    : [perfisInvalidos].filter(Boolean);

  const erro = new Error(
    `Perfil inválido: ${invalidos.join(", ")}. Use apenas: ${PERFIS_OFICIAIS.join(
      ", "
    )}.`
  );

  erro.code = "PERFIL_INVALIDO";
  erro.perfis_invalidos = invalidos;

  return erro;
}

/**
 * Normaliza UM perfil.
 *
 * Uso:
 * - req.user.perfil
 * - token.perfil
 * - localStorage["perfil"]
 * - usuarios.perfil
 */
function normalizarPerfil(perfil) {
  const normalizado = normalizarTextoPerfil(perfil);

  return normalizado || null;
}

/**
 * Valida e retorna UM perfil oficial.
 */
function validarPerfilOficial(perfil) {
  const normalizado = normalizarPerfil(perfil);

  if (!normalizado || !PERFIL_OFICIAL.has(normalizado)) {
    throw erroPerfilInvalido(normalizado || "vazio");
  }

  return normalizado;
}

function isPerfilOficial(perfil) {
  const normalizado = normalizarPerfil(perfil);

  return Boolean(normalizado && PERFIL_OFICIAL.has(normalizado));
}

/**
 * Normaliza lista de perfis permitidos.
 *
 * Uso exclusivo:
 * - middlewares de autorização;
 * - checagens como authorize("administrador", "organizador").
 *
 * Aceita array ou argumentos vindos de rest/spread.
 * Não deve ser usado para representar o perfil do usuário.
 */
function normalizarPerfisPermitidos(perfis) {
  const lista = Array.isArray(perfis) ? perfis : [perfis];

  const normalizados = lista
    .flat()
    .map((item) => normalizarTextoPerfil(item))
    .filter(Boolean);

  return [...new Set(normalizados)];
}

/**
 * Valida lista de perfis permitidos para autorização.
 */
function validarPerfisPermitidos(perfis) {
  const lista = normalizarPerfisPermitidos(perfis);

  if (lista.length === 0) {
    throw erroPerfilInvalido("vazio");
  }

  const invalidos = lista.filter((item) => !PERFIL_OFICIAL.has(item));

  if (invalidos.length > 0) {
    throw erroPerfilInvalido(invalidos);
  }

  return lista;
}

function usuarioTemPerfil(usuarioPerfil, perfisPermitidos) {
  const perfil = validarPerfilOficial(usuarioPerfil);
  const permitidos = validarPerfisPermitidos(perfisPermitidos);

  return permitidos.includes(perfil);
}

module.exports = {
  PERFIL,
  PERFIS_OFICIAIS,
  PERFIL_OFICIAL,
  normalizarPerfil,
  validarPerfilOficial,
  isPerfilOficial,
  normalizarPerfisPermitidos,
  validarPerfisPermitidos,
  usuarioTemPerfil,
};