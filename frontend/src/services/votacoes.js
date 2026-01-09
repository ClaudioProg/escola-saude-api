// src/services/votacoes.js
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../services/api";

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

/** Normaliza string opcional (trim) e retorna undefined se vazia. */
function optStr(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  return s ? s : undefined;
}

/* ============================================================================
 * Público (eleitor)
 * ==========================================================================*/

/**
 * Lista votações abertas/elegíveis ao usuário atual.
 * Compat: mantém assinatura original (sem filtros).
 */
export const listarVotacoesElegiveis = () =>
  apiGet("/votacoes/abertas/mine");

/**
 * Envia voto do usuário.
 * @param {number|string} id       - id da votação
 * @param {{ opcaoId: number|string } & Record<string, any>} payload
 */
export const votar = (id, payload) => {
  assertId(id, "id (votação)");
  if (!payload || !payload.opcaoId) {
    throw new Error("payload.opcaoId é obrigatório para votar.");
  }
  return apiPost(`/votacoes/${id}/votar`, payload);
};

/* ============================================================================
 * Admin
 * ==========================================================================*/

/**
 * Lista votações (admin) com filtros opcionais.
 * Mantém a função original; agora aceita filtros sem quebrar uso atual.
 * @param {Object} [filtros]
 * @param {string} [filtros.busca]
 * @param {"rascunho"|"aberta"|"encerrada"} [filtros.status]
 * @param {number} [filtros.page]
 * @param {number} [filtros.perPage]
 * @param {string} [filtros.inicioDe]     - YYYY-MM-DD
 * @param {string} [filtros.inicioAte]    - YYYY-MM-DD
 * @param {string} [filtros.fimDe]        - YYYY-MM-DD
 * @param {string} [filtros.fimAte]       - YYYY-MM-DD
 */
export const adminListar = (filtros = {}) => {
  const {
    busca,
    status,
    page,
    perPage,
    inicioDe,
    inicioAte,
    fimDe,
    fimAte,
  } = filtros || {};
  return apiGet("/votacoes", {
    query: {
      busca: optStr(busca),
      status: optStr(status),
      page,
      perPage,
      inicioDe: optStr(inicioDe),
      inicioAte: optStr(inicioAte),
      fimDe: optStr(fimDe),
      fimAte: optStr(fimAte),
    },
  });
};

/**
 * Obtém uma votação específica (admin).
 * @param {number|string} id
 */
export const adminObter = (id) => {
  assertId(id, "id (votação)");
  return apiGet(`/votacoes/${id}`);
};

/**
 * Cria votação (admin).
 * @param {Object} data - { titulo, descricao, inicio, fim, ... }
 */
export const adminCriar = (data) => {
  if (!data || !data.titulo) {
    throw new Error("Título é obrigatório para criar uma votação.");
  }
  return apiPost("/votacoes", data);
};

/**
 * Atualiza votação (admin).
 * @param {number|string} id
 * @param {Object} data
 */
export const adminAtualizar = (id, data) => {
  assertId(id, "id (votação)");
  return apiPut(`/votacoes/${id}`, data || {});
};

/**
 * Cria opção de voto (admin).
 * @param {number|string} id
 * @param {{ titulo: string, descricao?: string }} data
 */
export const adminCriarOpcao = (id, data) => {
  assertId(id, "id (votação)");
  if (!data || !optStr(data.titulo)) {
    throw new Error("Título da opção é obrigatório.");
  }
  return apiPost(`/votacoes/${id}/opcoes`, data);
};

/**
 * Atualiza opção (admin).
 * @param {number|string} id        - votação
 * @param {number|string} opcaoId   - opção
 * @param {Object} data
 */
export const adminAtualizarOpcao = (id, opcaoId, data) => {
  assertId(id, "id (votação)");
  assertId(opcaoId, "opcaoId");
  return apiPut(`/votacoes/${id}/opcoes/${opcaoId}`, data || {});
};

/**
 * Altera status da votação (admin).
 * @param {number|string} id
 * @param {"rascunho"|"aberta"|"encerrada"} status
 */
export const adminStatus = (id, status) => {
  assertId(id, "id (votação)");
  const st = optStr(status);
  if (!st) throw new Error("status é obrigatório.");
  return apiPatch(`/votacoes/${id}/status`, { status: st });
};

/**
 * Ranking/resultado (admin).
 * @param {number|string} id
 * @param {{ top?: number }} [opts]
 */
export const adminRanking = (id, opts = {}) => {
  assertId(id, "id (votação)");
  const { top } = opts || {};
  return apiGet(`/votacoes/${id}/ranking`, {
    query: { top },
  });
};

/* ============================================================================
 * Extras seguros (opcionais, não quebram compat)
 * ==========================================================================*/

/** Exclui votação (admin). */
export const adminExcluir = (id) => {
  assertId(id, "id (votação)");
  return apiDelete(`/votacoes/${id}`);
};

/** Exclui opção (admin). */
export const adminExcluirOpcao = (id, opcaoId) => {
  assertId(id, "id (votação)");
  assertId(opcaoId, "opcaoId");
  return apiDelete(`/votacoes/${id}/opcoes/${opcaoId}`);
};
