// src/services/votacoes.js
import api from "./api";

export const listarVotacoesElegiveis = () => api.get("/votacoes/abertas/mine").then(r => r.data);
export const votar = (id, payload) => api.post(`/votacoes/${id}/votar`, payload).then(r => r.data);

// Admin
export const adminListar = () => api.get("/votacoes").then(r => r.data);
export const adminObter  = (id) => api.get(`/votacoes/${id}`).then(r => r.data);
export const adminCriar  = (data) => api.post("/votacoes", data).then(r => r.data);
export const adminAtualizar = (id, data) => api.put(`/votacoes/${id}`, data).then(r => r.data);
export const adminCriarOpcao = (id, data) => api.post(`/votacoes/${id}/opcoes`, data).then(r => r.data);
export const adminAtualizarOpcao = (id, opcaoId, data) => api.put(`/votacoes/${id}/opcoes/${opcaoId}`, data).then(r => r.data);
export const adminStatus = (id, status) => api.patch(`/votacoes/${id}/status`, { status }).then(r => r.data);
export const adminRanking = (id) => api.get(`/votacoes/${id}/ranking`).then(r => r.data);
