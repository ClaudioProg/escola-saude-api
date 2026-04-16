// ✅ src/services/submissaoAdmin.js — PREMIUM++
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
    throw new Error(`Parâmetro obrigatório ausente/inválido: ${ctx}`);
  }
}

function coerceNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return v;
}

/** Normaliza boolean para "1" | "0" | undefined (para usar em querystring). */
function boolTo01(val) {
  if (val === true) return "1";
  if (val === false) return "0";
  return undefined;
}

/** Garante array. */
function ensureArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/** Remove entradas vazias de um array simples. */
function cleanArray(values = []) {
  return ensureArray(values).filter((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && !v.trim()) return false;
    return true;
  });
}

/** Remove campos undefined, null, "", [] da query. */
function compactQuery(obj = {}) {
  const out = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string" && !value.trim()) continue;

    if (Array.isArray(value)) {
      const cleaned = cleanArray(value);
      if (!cleaned.length) continue;
      out[key] = cleaned;
      continue;
    }

    out[key] = value;
  }

  return out;
}

/* ============================================================================
 * Listagem e detalhe
 * ==========================================================================*/

/**
 * Lista submissões com filtros opcionais.
 * @param {Object} [filtros]
 */
export const listarsubmissaoAdmin = (filtros = {}) => {
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

  const query = compactQuery({
    page,
    perPage,
    busca,
    ordenarPor,
    ordem,
    modalidade,
    parecerStatus,
    notaMin,
    notaMax,
    chamadaId: coerceNum(chamadaId),
    turmaId: coerceNum(turmaId),
    avaliadorId: coerceNum(avaliadorId),
    status: cleanArray(status),
    categoria: cleanArray(categoria),
    apenasComPoster: boolTo01(apenasComPoster),
    apenasSemPoster: boolTo01(apenasSemPoster),
    comPendencias: boolTo01(comPendencias),
  });

  return apiGet("/admin/submissao", { query });
};

/**
 * Obtém uma submissão específica.
 * @param {number|string} id
 * @param {Object} [opts]
 * @param {string} [opts.include]
 */
export const obterSubmissao = (id, opts = {}) => {
  assertId(id);

  const { include } = opts || {};
  const query = compactQuery({ include });

  return apiGet(`/submissao/${id}`, { query });
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

  return apiGet(`/admin/submissao/${id}/avaliadores`, {
    query: { tipo: tipo || "todos" },
  });
};

/**
 * Inclui avaliadores (pode enviar id único ou array).
 * @param {number|string} id
 * @param {Array|number|string} itens
 */
export const incluirAvaliadores = (id, itens) => {
  assertId(id);

  const payload = {
    itens: ensureArray(itens),
  };

  return apiPost(`/admin/submissao/${id}/avaliadores`, payload);
};

/**
 * Revoga um avaliador específico (soft-delete).
 * @param {number|string} id
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const revogarAvaliador = (id, { avaliadorId, tipo } = {}) => {
  assertId(id);
  assertId(avaliadorId, "avaliadorId");

  return apiDelete(`/admin/submissao/${id}/avaliadores`, {
    body: compactQuery({
      avaliadorId: coerceNum(avaliadorId),
      tipo,
    }),
  });
};

/**
 * Restaura um avaliador revogado.
 * @param {number|string} id
 * @param {{ avaliadorId: number|string, tipo?: string }} params
 */
export const restaurarAvaliador = (id, { avaliadorId, tipo } = {}) => {
  assertId(id);
  assertId(avaliadorId, "avaliadorId");

  return apiPatch(`/admin/submissao/${id}/avaliadores/restore`, compactQuery({
    avaliadorId: coerceNum(avaliadorId),
    tipo,
  }));
};

/* ============================================================================
 * Notas / avaliações
 * ==========================================================================*/

/**
 * Lista avaliações da submissão.
 * @param {number|string} id
 * @param {{ detalhe?: "min"|"full" }} [opts]
 */
export const listarAvaliacao = (id, opts = {}) => {
  assertId(id);

  const { detalhe } = opts || {};

  return apiGet(`/admin/submissao/${id}/avaliacao`, {
    query: compactQuery({ detalhe }),
  });
};

/**
 * Define se a nota fica visível ao autor.
 * @param {number|string} id
 * @param {boolean} visivel
 */
export const definirNotaVisivel = (id, visivel) => {
  assertId(id);

  return apiPost(`/admin/submissao/${id}/nota-visivel`, {
    visivel: !!visivel,
  });
};

/**
 * Recalcula a nota agregada da submissão.
 * @param {number|string} id
 */
export const recalcularNota = (id) => {
  assertId(id);
  return apiPost(`/admin/submissao/${id}/atualizar-nota`, {});
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
  return apiHead(`/submissao/${id}/poster`);
};

/**
 * Baixa o pôster da submissão (usa nome do servidor quando disponível).
 * @param {number|string} id
 */
export const baixarPoster = async (id) => {
  assertId(id);

  const { blob, filename } = await apiGetFile(`/submissao/${id}/poster`);
  downloadBlob(filename || `poster-${id}.bin`, blob);
};

/**
 * Baixa o pôster forçando um nome de arquivo.
 * @param {number|string} id
 * @param {string} nomeArquivo
 */
export const baixarPosterComo = async (id, nomeArquivo = "") => {
  assertId(id);

  const { blob, filename } = await apiGetFile(`/submissao/${id}/poster`);
  const finalName = String(nomeArquivo || filename || `poster-${id}.bin`).trim();

  downloadBlob(finalName || `poster-${id}.bin`, blob);
};