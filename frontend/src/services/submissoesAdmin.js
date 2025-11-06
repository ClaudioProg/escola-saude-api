// src/services/submissoesAdmin.js
import {
    apiGet, apiPost, apiPatch, apiDelete, apiGetFile, downloadBlob,
  } from "../services/api";
  
  /* ========= Listagem e detalhe ========= */
  export const listarSubmissoesAdmin = () =>
    apiGet("/admin/submissoes");
  
  export const obterSubmissao = (id) =>
    apiGet(`/submissoes/${id}`);
  
  /* ========= Avaliadores (flex) ========= */
  export const listarAvaliadores = (id, tipo = "todos") =>
    apiGet(`/admin/submissoes/${id}/avaliadores`, { query: { tipo } });
  
  export const incluirAvaliadores = (id, itens) =>
    apiPost(`/admin/submissoes/${id}/avaliadores`, { itens });
  
  export const revogarAvaliador = (id, { avaliadorId, tipo }) =>
    apiDelete(`/admin/submissoes/${id}/avaliadores`, {
      // body no DELETE é suportado na nossa api central
      body: { avaliadorId, tipo },
    });
  
  export const restaurarAvaliador = (id, { avaliadorId, tipo }) =>
    apiPatch(`/admin/submissoes/${id}/avaliadores/restore`, { avaliadorId, tipo });
  
  /* ========= Notas / avaliações ========= */
  export const listarAvaliacoes = (id) =>
    apiGet(`/admin/submissoes/${id}/avaliacoes`);
  
  export const definirNotaVisivel = (id, visivel) =>
    apiPost(`/admin/submissoes/${id}/nota-visivel`, { visivel });
  
  export const recalcularNota = (id) =>
    apiPost(`/admin/submissoes/${id}/atualizar-nota`, {});
  
  /* ========= Pôster ========= */
  export const baixarPoster = async (id) => {
    const { blob, filename } = await apiGetFile(`/submissoes/${id}/poster`);
    downloadBlob(filename || `poster-${id}.bin`, blob);
  };
  