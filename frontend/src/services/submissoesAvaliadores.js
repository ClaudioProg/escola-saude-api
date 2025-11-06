// src/services/submissoesAvaliadores.js
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

export const listarAtribuicoes = (submissaoId, tipo = "todos") =>
  apiGet(`/admin/submissoes/${submissaoId}/avaliadores`, { query: { tipo } });

export const incluirAvaliadoresFlex = (submissaoId, itens = []) =>
  apiPost(`/admin/submissoes/${submissaoId}/avaliadores`, { itens });

export const revogarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) =>
  apiDelete(`/admin/submissoes/${submissaoId}/avaliadores`, {
    body: { avaliadorId, tipo },
  });

export const restaurarAvaliadorFlex = (submissaoId, { avaliadorId, tipo }) =>
  apiPatch(`/admin/submissoes/${submissaoId}/avaliadores/restore`, {
    avaliadorId, tipo,
  });

export const listarElegiveis = () =>
  apiGet(`/usuarios/avaliadores`, { query: { roles: "instrutor,administrador" } });
