// src/services/submissoesAdmin.js
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiGetFile,
  apiHead,
  downloadBlob,
} from "../services/api";

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

/** Normaliza boolean para "1" | "0" | undefined (para usar em querystring). */
function boolTo01(val) {
  if (val === true) return "1";
  if (val === false) return "0";
  return undefined;
}

/** Garante array. Ex.: ensureArray(3) -> [3]; ensureArray([1,2]) -> [1,2] */
function ensureArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/* ============================================================================
 * Listagem e detalhe
 * ==========================================================================*/

/**
 * Lista submissões com filtros opcionais.
 * @param {Object} [filtros]
 * @param {number} [filtros.page]            - página (1-based)
 * @param {number} [filtros.perPage]         - itens por página
 * @param {string} [filtros.busca]           - termo livre
 * @param {string|string[]} [filtros.status] - status (ou array)
 * @param {string|string[]} [filtros.categoria]
 * @param {string} [filtros.modalidade]
 * @param {number|string} [filtros.chamadaId]
 * @param {number|string} [filtros.turmaId]
 * @param {string} [filtros.ordenarPor]      - coluna para ordenação
 * @param {"asc"|"desc"} [filtros.ordem]
 * @param {boolean} [filtros.apenasComPoster]
 * @param {boolean} [filtros.apenasSemPoster]
 * @param {number|string} [filtros.avaliadorId]
 * @param {string} [filtros.parecerStatus]   - ex.: "aprovado" | "reprovado" | "pendente"
 * @param {number} [filtros.notaMin]
 * @param {number} [filtros.notaMax]
 * @param {boolean} [filtros.comPendencias]
 */
export const listarSubmissoesAdmin = (filtros = {}) => {
  const {
    page,
    perPage,
    busca,
    status,
    categoria,
    modalidade,
    chamadaId,
    turmaId,
    ordenarPor,
    ordem,
    apenasComPoster,
    apenasSemPoster,
    avaliadorId,
    parecerStatus,
    notaMin,
    notaMax,
    comPendencias,
  } = filtros || {};

  // monta query sem enviar valores vazios/NaN (api.qs já ajuda, mas filtramos aqui tb)
  const query = {
    page,
    perPage,
    busca,
    ordenarPor,
    ordem,
    modalidade,
    parecerStatus,
    notaMin,
    notaMax,
    chamadaId,
    turmaId,
    avaliadorId,
    status: ensureArray(status),
    categoria: ensureArray(categoria),
    apenasComPoster: boolTo01(apenasComPoster),
    apenasSemPoster: boolTo01(apenasSemPoster),
    comPendencias: boolTo01(comPendencias),
  };

  return apiGet("/admin/submissoes", { query });
};

/**
 * Obtém uma submissão específica.
 * @param {number|string} id
 * @param {Object} [opts]
 * @param {string} [opts.include] - dica opcional para o backend (ex.: "avaliacoes,avaliadores")
 */
export const obterSubmissao = (id, opts = {}) => {
  assertId(id);
  const { include } = opts || {};
  const query = include ? { include } : undefined;
  return apiGet(`/submissoes/${id}`, { query });
};

/* ============================================================================
 * Avaliadores (flex)
 * ==========================================================================*/

/**
 * Lista avaliadores vinculados (ou potenciais) à submissão.
 * @param {number|string} id
 * @param {"todos"|"vinculados"|"disponiveis"} [tipo="todos"]
 */
export const listarAvaliadores = (id, tipo = "todos") => {
  assertId(id);
  return apiGet(`/admin/submissoes/${id}/avaliadores`, { query: { tipo } });
};

/**
 * Inclui avaliadores (pode enviar id único ou array).
 * @param {number|string} id
 * @param {Array|number|string} itens - ex.: [{avaliadorId, tipo}] OU ids simples
 */
export const incluirAvaliadores = (id, itens) => {
  assertId(id);
  const payload = { itens: ensureArray(itens) };
  return apiPost(`/admin/submissoes/${id}/avaliadores`, payload);
};

/**
 * Revoga um avaliador específico (soft-delete).
 * @param {number|string} id
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const revogarAvaliador = (id, { avaliadorId, tipo }) => {
  assertId(id);
  assertId(avaliadorId, "avaliadorId");
  // body no DELETE é suportado na nossa api central
  return apiDelete(`/admin/submissoes/${id}/avaliadores`, {
    body: { avaliadorId, tipo },
  });
};

/**
 * Restaura um avaliador revogado.
 * @param {number|string} id
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const restaurarAvaliador = (id, { avaliadorId, tipo }) => {
  assertId(id);
  assertId(avaliadorId, "avaliadorId");
  return apiPatch(`/admin/submissoes/${id}/avaliadores/restore`, {
    avaliadorId,
    tipo,
  });
};

/* ============================================================================
 * Notas / avaliações
 * ==========================================================================*/

/**
 * Lista avaliações da submissão.
 * @param {number|string} id
 * @param {{ detalhe?: "min"|"full" }} [opts]
 */
export const listarAvaliacoes = (id, opts = {}) => {
  assertId(id);
  const { detalhe } = opts || {};
  return apiGet(`/admin/submissoes/${id}/avaliacoes`, {
    query: detalhe ? { detalhe } : undefined,
  });
};

/**
 * Define se a nota fica visível ao autor.
 * @param {number|string} id
 * @param {boolean} visivel
 */
export const definirNotaVisivel = (id, visivel) => {
  assertId(id);
  return apiPost(`/admin/submissoes/${id}/nota-visivel`, {
    visivel: !!visivel,
  });
};

/**
 * Recalcula a nota agregada da submissão.
 * @param {number|string} id
 */
export const recalcularNota = (id) => {
  assertId(id);
  return apiPost(`/admin/submissoes/${id}/atualizar-nota`, {});
};

/* ============================================================================
 * Pôster
 * ==========================================================================*/

/**
 * Verifica rapidamente se há pôster anexado (HEAD).
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
export const existePoster = async (id) => {
  assertId(id);
  return apiHead(`/submissoes/${id}/poster`);
};

/**
 * Baixa o pôster da submissão (usa nome do servidor quando disponível).
 * @param {number|string} id
 */
export const baixarPoster = async (id) => {
  assertId(id);
  const { blob, filename } = await apiGetFile(`/submissoes/${id}/poster`);
  downloadBlob(filename || `poster-${id}.bin`, blob);
};

/**
 * Baixa o pôster forçando um nome de arquivo.
 * @param {number|string} id
 * @param {string} nomeArquivo - ex.: "poster-submissao-123.pdf"
 */
export const baixarPosterComo = async (id, nomeArquivo = "") => {
  assertId(id);
  const { blob, filename } = await apiGetFile(`/submissoes/${id}/poster`);
  const finalName = (nomeArquivo || filename || `poster-${id}.bin`).trim();
  downloadBlob(finalName, blob);
};
