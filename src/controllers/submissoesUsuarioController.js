/* eslint-disable no-console */
"use strict";

/**
 * Tudo que é comum permanece no Admin.
 * Este controlador apenas delega para o Admin para evitar duplicação.
 */
const admin = require("./submissoesAdminController");

// Rotas de “usuário” (autenticadas, mas não exigem admin)
async function listarMinhas(req, res) {
  return admin.listarMinhas(req, res);
}

// Detalhe da submissão (autor, avaliador ou admin)
async function obterSubmissao(req, res) {
  return admin.obterSubmissao(req, res);
}

// Download do pôster (público) — mantemos no Admin e só repassamos
async function baixarBanner(req, res) {
  return admin.baixarBanner(req, res);
}

module.exports = {
  listarMinhas,
  obterSubmissao,
  baixarBanner,
};
