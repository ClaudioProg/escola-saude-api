// ✅ src/services/votacao.js — PREMIUM++
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./api";

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
    throw new Error(`Parâmetro obrigatório ausente/inválido: ${ctx}`);
  }
}

function coerceNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return v;
}

/** Normaliza string opcional (trim) e retorna undefined se vazia. */
function optStr(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  return s ? s : undefined;
}

/** Remove campos vazios/undefined/null da query/body simples. */
function compactObject(obj = {}) {
  const out = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    out[key] = value;
  }

  return out;
}

/* ============================================================================
 * Público (eleitor)
 * ==========================================================================*/

/**
 * Lista votações abertas/elegíveis ao usuário atual.
 * Compat: mantém assinatura original (sem filtros).
 */
export const listarVotacaoElegiveis = () => apiGet("/votacao/abertas/mine");

/**
 * Envia voto do usuário.
 * @param {number|string} id
 * @param {{ opcaoId: number|string } & Record<string, any>} payload
 */
export const votar = (id, payload) => {
  assertId(id, "id (votação)");

  const opcaoId = coerceNum(payload?.opcaoId);
  if (!payload || opcaoId === null || opcaoId === undefined || opcaoId === "") {
    throw new Error("payload.opcaoId é obrigatório para votar.");
  }

  return apiPost(`/votacao/${id}/votar`, {
    ...payload,
    opcaoId,
  });
};

/* ============================================================================
 * Admin
 * ==========================================================================*/

/**
 * Lista votações (admin) com filtros opcionais.
 * @param {Object} [filtros]
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

  return apiGet("/votacao", {
    query: compactObject({
      busca: optStr(busca),
      status: optStr(status),
      page,
      perPage,
      inicioDe: optStr(inicioDe),
      inicioAte: optStr(inicioAte),
      fimDe: optStr(fimDe),
      fimAte: optStr(fimAte),
    }),
  });
};

/**
 * Obtém uma votação específica (admin).
 * @param {number|string} id
 */
export const adminObter = (id) => {
  assertId(id, "id (votação)");
  return apiGet(`/votacao/${id}`);
};

/**
 * Cria votação (admin).
 * @param {Object} data
 */
export const adminCriar = (data) => {
  if (!data || !optStr(data.titulo)) {
    throw new Error("Título é obrigatório para criar uma votação.");
  }

  return apiPost("/votacao", data);
};

/**
 * Atualiza votação (admin).
 * @param {number|string} id
 * @param {Object} data
 */
export const adminAtualizar = (id, data) => {
  assertId(id, "id (votação)");
  return apiPut(`/votacao/${id}`, data || {});
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

  return apiPost(`/votacao/${id}/opcao`, data);
};

/**
 * Atualiza opção (admin).
 * @param {number|string} id
 * @param {number|string} opcaoId
 * @param {Object} data
 */
export const adminAtualizarOpcao = (id, opcaoId, data) => {
  assertId(id, "id (votação)");
  assertId(opcaoId, "opcaoId");

  return apiPut(`/votacao/${id}/opcao/${opcaoId}`, data || {});
};

/**
 * Altera status da votação (admin).
 * @param {number|string} id
 * @param {"rascunho"|"aberta"|"encerrada"} status
 */
export const adminStatus = (id, status) => {
  assertId(id, "id (votação)");

  const st = optStr(status);
  if (!st) {
    throw new Error("status é obrigatório.");
  }

  return apiPatch(`/votacao/${id}/status`, { status: st });
};

/**
 * Ranking/resultado (admin).
 * @param {number|string} id
 * @param {{ top?: number }} [opts]
 */
export const adminRanking = (id, opts = {}) => {
  assertId(id, "id (votação)");

  const { top } = opts || {};

  return apiGet(`/votacao/${id}/ranking`, {
    query: compactObject({
      top: coerceNum(top),
    }),
  });
};

/* ============================================================================
 * Extras seguros (opcionais, não quebram compat)
 * ==========================================================================*/

/** Exclui votação (admin). */
export const adminExcluir = (id) => {
  assertId(id, "id (votação)");
  return apiDelete(`/votacao/${id}`);
};

/** Exclui opção (admin). */
export const adminExcluirOpcao = (id, opcaoId) => {
  assertId(id, "id (votação)");
  assertId(opcaoId, "opcaoId");
  return apiDelete(`/votacao/${id}/opcao/${opcaoId}`);
};