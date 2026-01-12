// ✅ src/services/submissoesAvaliadores.js
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

/* ============================================================================
 * Utils locais
 * ==========================================================================*/

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

function ensureArray(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function optStr(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  return s ? s : undefined;
}

function coerceNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return v;
}

function normalizeItens(itens = []) {
  const arr = ensureArray(itens);
  return arr.map((x) => {
    if (typeof x === "number" || (typeof x === "string" && x.trim())) {
      return { avaliadorId: coerceNum(x) };
    }
    if (x && typeof x === "object") {
      const out = {
        avaliadorId: coerceNum(x.avaliadorId ?? x.id ?? x.usuario_id),
        tipo: optStr(x.tipo),
        papel: optStr(x.papel),
        prioridade: coerceNum(x.prioridade),
      };
      if (!out.avaliadorId) throw new Error("Item inválido: faltando avaliadorId.");
      return out;
    }
    throw new Error("Item inválido em 'itens'.");
  });
}

/* ============================================================================
 * GET “quieto” – não poluir o console em 404/401/403
 * ==========================================================================*/

async function quietGet(url, opts = {}) {
  try {
    const r = await apiGet(url, {
      ...opts,
      on404: "silent",
      on401: "silent",
      on403: "silent",
      suppressGlobalError: true,
    });
    return r;
  } catch (e) {
    // qualquer erro diferente de 404/401/403 também fica “quieto” aqui
    return null;
  }
}

/* Normalizadores de resposta para vários formatos possíveis */
function normalizeLinha(x) {
  if (!x || typeof x !== "object") return null;

  // possíveis aliases de campos
  const id = coerceNum(x.id ?? x.submissao_id ?? x.trabalho_id);
  const titulo = x.titulo ?? x.trabalho_titulo ?? x.submissao_titulo;
  const chamada = x.chamada_titulo ?? x.chamada ?? x.encontro ?? x.evento;
  const linha = x.linha_tematica_nome ?? x.linha ?? x.area ?? x.eixo;
  const status = x.status ?? x.situacao ?? x.etapa;
  const tipo = (x.tipo ?? x.modalidade ?? "").toString().toLowerCase();
  const ja_avaliado = Boolean(
    x.ja_avaliado ??
      x.avaliado ??
      x.foi_avaliado ??
      x.minha_avaliacao_enviada ??
      (Array.isArray(x.minhas_avaliacoes) && x.minhas_avaliacoes.length > 0)
  );

  if (!id) return null;
  return {
    id,
    titulo: titulo ?? "—",
    chamada_titulo: chamada ?? "—",
    linha_tematica_nome: linha ?? "—",
    status: status ?? "—",
    tipo: tipo || "escrita",
    ja_avaliado,
  };
}

function normalizeLista(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const n = normalizeLinha(x);
    if (n) out.push(n);
  }
  // dedup (por id+tipo)
  const seen = new Set();
  return out.filter((s) => {
    const k = `${s.id}-${s.tipo}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ============================================================================
 * Listagem com fallback silencioso
 * ==========================================================================*/

/**
 * Tenta várias rotas conhecidas sem poluir o console. Retorna [] se nada existir.
 * Ordem pensada para “avaliador” primeiro, depois genéricas:
 */
export async function listarTrabalhosAtribuidosAoAvaliador() {
  const candidatos = [
    "/avaliador/submissoes",
    "/avaliacoes/atribuidas",
    "/submissoes/atribuidas",
    "/avaliador/minhas-submissoes",
    "/avaliador/pendentes",
    // extras “genéricos” (ajuste se tiver algo equivalente no seu backend)
    "/admin/submissoes/para-mim",
    "/submissoes/para-mim",
  ];

  for (const url of candidatos) {
    const r = await quietGet(url);
    const data = r?.data ?? r;
    if (data && Array.isArray(data) && data.length) {
      return normalizeLista(data);
    }
  }
  // se alguma rota retornar lista vazia, devolvemos [] sem erro
  return [];
}

/* ============================================================================
 * Atribuições (flex)
 * ==========================================================================*/

export const listarAtribuicoes = (submissaoId, tipo = "todos") => {
  assertId(submissaoId, "submissaoId");
  return apiGet(`/admin/submissoes/${submissaoId}/avaliadores`, {
    query: { tipo: optStr(tipo) || "todos" },
  });
};

export const incluirAvaliadoresFlex = (submissaoId, itens = []) => {
  assertId(submissaoId, "submissaoId");
  const payload = { itens: normalizeItens(itens) };
  return apiPost(`/admin/submissoes/${submissaoId}/avaliadores`, payload);
};

export const revogarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");
  return apiDelete(`/admin/submissoes/${submissaoId}/avaliadores`, {
    body: { avaliadorId: coerceNum(avaliadorId), tipo: optStr(tipo) },
  });
};

export const restaurarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");
  return apiPatch(`/admin/submissoes/${submissaoId}/avaliadores/restore`, {
    avaliadorId: coerceNum(avaliadorId),
    tipo: optStr(tipo),
  });
};

export const atribuirAvaliador = (submissaoId, dados) => {
  assertId(submissaoId, "submissaoId");
  const [item] = normalizeItens([dados]);
  return apiPost(`/admin/submissoes/${submissaoId}/avaliadores`, { itens: [item] });
};

export const trocarAvaliador = async (submissaoId, { deAvaliadorId, paraAvaliadorId, tipo }) => {
  assertId(submissaoId, "submissaoId");
  assertId(deAvaliadorId, "deAvaliadorId");
  assertId(paraAvaliadorId, "paraAvaliadorId");
  await revogarAvaliadorFlex(submissaoId, { avaliadorId: deAvaliadorId, tipo });
  return atribuirAvaliador(submissaoId, { avaliadorId: paraAvaliadorId, tipo });
};

/* ============================================================================
 * Lote
 * ==========================================================================*/

export const incluirAvaliadoresEmLote = (submissaoIds = [], itens = []) => {
  const ids = ensureArray(submissaoIds).map((i) => {
    assertId(i, "submissaoId");
    return coerceNum(i);
  });
  const payload = { submissaoIds: ids, itens: normalizeItens(itens) };
  return apiPost(`/admin/submissoes/avaliadores/bulk-add`, payload);
};

export const revogarAvaliadorEmLote = (submissaoIds = [], { avaliadorId, tipo }) => {
  const ids = ensureArray(submissaoIds).map((i) => {
    assertId(i, "submissaoId");
    return coerceNum(i);
  });
  assertId(avaliadorId, "avaliadorId");
  return apiDelete(`/admin/submissoes/avaliadores/bulk-revoke`, {
    body: { submissaoIds: ids, avaliadorId: coerceNum(avaliadorId), tipo: optStr(tipo) },
  });
};

/* ============================================================================
 * Elegíveis
 * ==========================================================================*/

export const listarElegiveis = () =>
  apiGet(`/usuarios/avaliadores`, {
    query: { roles: "instrutor,administrador" },
  });

export const listarElegiveisComFiltro = (filtros = {}) => {
  const { roles, busca, page, perPage, unidadeId, area } = filtros || {};
  const rolesParam = Array.isArray(roles) ? roles.join(",") : optStr(roles);

  return apiGet(`/usuarios/avaliadores`, {
    query: {
      roles: rolesParam || "instrutor,administrador",
      busca: optStr(busca),
      page,
      perPage,
      unidadeId: coerceNum(unidadeId) ?? optStr(unidadeId),
      area: optStr(area),
    },
  });
};

/* ============================================================================
 * Resumos / contagens
 * ==========================================================================*/

export const getResumoAtribuicoes = (submissaoId) => {
  assertId(submissaoId, "submissaoId");
  return apiGet(`/admin/submissoes/${submissaoId}/avaliadores/resumo`, {
    on401: "silent",
    on403: "silent",
    on404: "silent",
    suppressGlobalError: true,
  });
};

export const contarPendentesDoAvaliador = () =>
  apiGet(`/avaliador/pendencias/contagem`, {
    on401: "silent",
    on403: "silent",
    on404: "silent",
    suppressGlobalError: true,
  });
