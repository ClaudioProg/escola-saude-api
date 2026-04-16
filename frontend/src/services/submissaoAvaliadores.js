// ✅ src/services/submissaoAvaliadores.js — PREMIUM++
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

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
    throw new Error(`Parâmetro obrigatório ausente/inválido: ${ctx}`);
  }
}

function ensureArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function optStr(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  return s ? s : undefined;
}

function coerceNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+$/.test(s)) return Number(s);
  }

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
        prioridade:
          x.prioridade === null || x.prioridade === undefined
            ? undefined
            : coerceNum(x.prioridade),
      };

      if (!out.avaliadorId) {
        throw new Error("Item inválido: faltando avaliadorId.");
      }

      return out;
    }

    throw new Error("Item inválido em 'itens'.");
  });
}

function pickArrayPayload(r) {
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.data)) return r.data;
  if (Array.isArray(r?.items)) return r.items;
  if (Array.isArray(r?.rows)) return r.rows;
  if (Array.isArray(r?.resultado)) return r.resultado;
  if (Array.isArray(r?.submissoes)) return r.submissoes;
  return [];
}

/* ============================================================================
 * GET “quieto” – não poluir o console em 404/401/403
 * ==========================================================================*/

async function quietGet(url, opts = {}) {
  try {
    return await apiGet(url, {
      ...opts,
      on404: "silent",
      on401: "silent",
      on403: "silent",
      suppressGlobalError: true,
    });
  } catch {
    return null;
  }
}

/* ============================================================================
 * Normalizadores
 * ==========================================================================*/

function normalizeLinha(x) {
  if (!x || typeof x !== "object") return null;

  const id = coerceNum(x.id ?? x.submissao_id ?? x.trabalho_id);
  if (!id) return null;

  const titulo = x.titulo ?? x.trabalho_titulo ?? x.submissao_titulo ?? "—";
  const chamada = x.chamada_titulo ?? x.chamada ?? x.encontro ?? x.evento ?? "—";
  const linha = x.linha_tematica_nome ?? x.linha ?? x.area ?? x.eixo ?? "—";
  const status = x.status ?? x.situacao ?? x.etapa ?? "—";

  const tipoBruto = x.tipo ?? x.modalidade ?? "escrita";
  const tipo = String(tipoBruto || "escrita").trim().toLowerCase() || "escrita";

  const ja_avaliado = Boolean(
    x.ja_avaliado ??
      x.avaliado ??
      x.foi_avaliado ??
      x.minha_avaliacao_enviada ??
      (Array.isArray(x.minhas_avaliacao) && x.minhas_avaliacao.length > 0)
  );

  return {
    id,
    titulo,
    chamada_titulo: chamada,
    linha_tematica_nome: linha,
    status,
    tipo,
    ja_avaliado,
  };
}

function normalizeLista(arr) {
  const raw = ensureArray(arr);
  const mapped = raw.map(normalizeLinha).filter(Boolean);

  const seen = new Set();

  return mapped.filter((item) => {
    const key = `${item.id}-${item.tipo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ============================================================================
 * Listagem com fallback silencioso
 * ==========================================================================*/

/**
 * Tenta várias rotas conhecidas sem poluir o console.
 * Retorna [] se nada existir.
 */
export async function listarTrabalhosAtribuidosAoAvaliador() {
  const candidatos = [
    "/avaliador/submissao",
    "/avaliacao/atribuidas",
    "/submissao/atribuidas",
    "/avaliador/minhas-submissao",
    "/avaliador/pendentes",
    "/admin/submissao/para-mim",
    "/submissao/para-mim",
  ];

  for (const url of candidatos) {
    const r = await quietGet(url);
    const lista = pickArrayPayload(r);

    if (lista.length) {
      return normalizeLista(lista);
    }
  }

  return [];
}

/* ============================================================================
 * Atribuições (flex)
 * ==========================================================================*/

export const listarAtribuicao = (submissaoId, tipo = "todos") => {
  assertId(submissaoId, "submissaoId");

  return apiGet(`/admin/submissao/${submissaoId}/avaliadores`, {
    query: { tipo: optStr(tipo) || "todos" },
  });
};

export const incluirAvaliadoresFlex = (submissaoId, itens = []) => {
  assertId(submissaoId, "submissaoId");

  const payload = { itens: normalizeItens(itens) };
  return apiPost(`/admin/submissao/${submissaoId}/avaliadores`, payload);
};

export const revogarAvaliadorFlex = (submissaoId, { avaliadorId, tipo } = {}) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");

  return apiDelete(`/admin/submissao/${submissaoId}/avaliadores`, {
    body: {
      avaliadorId: coerceNum(avaliadorId),
      tipo: optStr(tipo),
    },
  });
};

export const restaurarAvaliadorFlex = (submissaoId, { avaliadorId, tipo } = {}) => {
  assertId(submissaoId, "submissaoId");
  assertId(avaliadorId, "avaliadorId");

  return apiPatch(`/admin/submissao/${submissaoId}/avaliadores/restore`, {
    avaliadorId: coerceNum(avaliadorId),
    tipo: optStr(tipo),
  });
};

export const atribuirAvaliador = (submissaoId, dados) => {
  assertId(submissaoId, "submissaoId");

  const [item] = normalizeItens([dados]);
  return apiPost(`/admin/submissao/${submissaoId}/avaliadores`, { itens: [item] });
};

export const trocarAvaliador = async (
  submissaoId,
  { deAvaliadorId, paraAvaliadorId, tipo } = {}
) => {
  assertId(submissaoId, "submissaoId");
  assertId(deAvaliadorId, "deAvaliadorId");
  assertId(paraAvaliadorId, "paraAvaliadorId");

  await revogarAvaliadorFlex(submissaoId, {
    avaliadorId: deAvaliadorId,
    tipo,
  });

  return atribuirAvaliador(submissaoId, {
    avaliadorId: paraAvaliadorId,
    tipo,
  });
};

/* ============================================================================
 * Lote
 * ==========================================================================*/

export const incluirAvaliadoresEmLote = (submissaoIds = [], itens = []) => {
  const ids = ensureArray(submissaoIds).map((i) => {
    assertId(i, "submissaoId");
    return coerceNum(i);
  });

  const payload = {
    submissaoIds: ids,
    itens: normalizeItens(itens),
  };

  return apiPost(`/admin/submissao/avaliadores/bulk-add`, payload);
};

export const revogarAvaliadorEmLote = (
  submissaoIds = [],
  { avaliadorId, tipo } = {}
) => {
  const ids = ensureArray(submissaoIds).map((i) => {
    assertId(i, "submissaoId");
    return coerceNum(i);
  });

  assertId(avaliadorId, "avaliadorId");

  return apiDelete(`/admin/submissao/avaliadores/bulk-revoke`, {
    body: {
      submissaoIds: ids,
      avaliadorId: coerceNum(avaliadorId),
      tipo: optStr(tipo),
    },
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

export const getResumoAtribuicao = (submissaoId) => {
  assertId(submissaoId, "submissaoId");

  return apiGet(`/admin/submissao/${submissaoId}/avaliadores/resumo`, {
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