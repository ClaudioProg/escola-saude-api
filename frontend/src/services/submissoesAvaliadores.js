// src/services/submissoesAvaliadores.js
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

/* ============================================================================
 * Utils locais
 * ==========================================================================*/

/** Garante que o id seja válido (número finito ou string não vazia). */
function assertId(id, ctx = "id") {
  if (
    id === null ||
    id === undefined ||
    (typeof id === "number" && !Number.isFinite(id)) ||
    (typeof id === "string" && id.trim() === "")
  ) {
    throw new Error(`Parâmetro obrigatório ausente/ inválido: ${ctx}`);
  }
}

/** Normaliza para array. Ex.: ensureArray(3) → [3] */
function ensureArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/** Normaliza string opcional (trim) e retorna undefined se vazia. */
function optStr(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  return s ? s : undefined;
}

/* ============================================================================
 * Atribuições (flex)
 * ==========================================================================*/

/**
 * Lista avaliadores atribuídos (ou potenciais) de uma submissão.
 * @param {number|string} submissaoId
 * @param {"todos"|"vinculados"|"disponiveis"} [tipo="todos"]
 */
export const listarAtribuicoes = (submissaoId, tipo = "todos") => {
  assertId(submissaoId, "submissaoId");
  return apiGet(`/admin/submissoes/${submissaoId}/avaliadores`, {
    query: { tipo: optStr(tipo) || "todos" },
  });
};

/**
 * Inclui avaliadores (pode ser id único, array de ids ou objetos).
 * @param {number|string} submissaoId
 * @param {Array|number|string} itens - Ex.: [1,2] OU [{ avaliadorId, tipo }]
 */
export const incluirAvaliadoresFlex = (submissaoId, itens = []) => {
  assertId(submissaoId, "submissaoId");
  const payload = { itens: ensureArray(itens) };
  return apiPost(`/admin/submissoes/${submissaoId}/avaliadores`, payload);
};

/**
 * Revoga (soft-delete) um avaliador de uma submissão.
 * @param {number|string} submissaoId
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const revogarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");
  return apiDelete(`/admin/submissoes/${submissaoId}/avaliadores`, {
    // nossa API central aceita body em DELETE
    body: { avaliadorId, tipo: optStr(tipo) },
  });
};

/**
 * Restaura um avaliador revogado.
 * @param {number|string} submissaoId
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const restaurarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");
  return apiPatch(`/admin/submissoes/${submissaoId}/avaliadores/restore`, {
    avaliadorId,
    tipo: optStr(tipo),
  });
};

/* ============================================================================
 * Elegíveis
 * ==========================================================================*/

/**
 * Lista usuários elegíveis para atuar como avaliadores.
 * (Compat: mantém assinatura original, roles padrão fixo.)
 */
export const listarElegiveis = () =>
  apiGet(`/usuarios/avaliadores`, {
    query: { roles: "instrutor,administrador" },
  });

/**
 * Versão com filtros opcionais (sem quebrar a anterior).
 * @param {Object} [filtros]
 * @param {string|string[]} [filtros.roles]        - ex.: "instrutor,administrador" ou ["instrutor","administrador"]
 * @param {string} [filtros.busca]                 - termo livre (nome/email)
 * @param {number} [filtros.page]                  - paginação
 * @param {number} [filtros.perPage]
 * @param {string} [filtros.unidadeId]
 * @param {string} [filtros.area]                  - especialidade/área
 */
export const listarElegiveisComFiltro = (filtros = {}) => {
  const { roles, busca, page, perPage, unidadeId, area } = filtros || {};
  const rolesParam = Array.isArray(roles) ? roles.join(",") : optStr(roles);

  return apiGet(`/usuarios/avaliadores`, {
    query: {
      roles: rolesParam || "instrutor,administrador",
      busca: optStr(busca),
      page,
      perPage,
      unidadeId: optStr(unidadeId),
      area: optStr(area),
    },
  });
};
