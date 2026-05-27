/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/usuarioAssinaturaController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Obter assinatura vinculada ao usuário autenticado.
 *
 * Regra oficial:
 * - Permitido para perfis:
 *   - organizador
 *   - administrador
 *
 * Contrato oficial:
 * - req.userId = id do usuário autenticado
 * - req.perfil = perfil único oficial
 * - perfil é string única, não array
 *
 * Padrão:
 * - Sem aliases.
 * - Sem fallback de nomes.
 * - Sem múltiplas possibilidades de perfil.
 * - Sem leitura de perfil como array/CSV.
 * - Respostas diagnosticáveis.
 */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const PERFIS_AUTORIZADOS_ASSINATURA = new Set(["organizador", "administrador"]);

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function getUsuarioId(req) {
  const id = Number(req?.userId || req?.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getPerfil(req) {
  return String(req?.perfil || req?.user?.perfil || "").trim();
}

function possuiPerfilAutorizado(perfil) {
  return PERFIS_AUTORIZADOS_ASSINATURA.has(String(perfil || "").trim());
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

/* ──────────────────────────────────────────────────────────────
   GET /api/usuario/assinatura
────────────────────────────────────────────────────────────── */

async function obterAssinatura(req, res) {
  const usuarioId = getUsuarioId(req);
  const perfil = getPerfil(req);

  if (!usuarioId) {
    return respostaErro(
      res,
      401,
      "USUARIO-ASSINATURA-401-NAO-AUTENTICADO",
      "Usuário não autenticado."
    );
  }

  if (!possuiPerfilAutorizado(perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-ASSINATURA-403-PERFIL-NAO-AUTORIZADO",
      "Acesso restrito a organizador ou administrador.",
      {
        adminHint:
          "Esta rota exige perfil oficial organizador ou administrador no token autenticado.",
      }
    );
  }

  try {
    const result = await db.query(
      `
      SELECT
        imagem_base64 AS assinatura
      FROM assinaturas
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    return res.status(200).json({
      ok: true,
      code: "USUARIO-ASSINATURA-200-OK",
      message: result.rows?.length
        ? "Assinatura carregada com sucesso."
        : "Nenhuma assinatura cadastrada para este usuário.",
      data: {
        assinatura: result.rows?.[0]?.assinatura || null,
      },
    });
  } catch (err) {
    console.error("[usuarioAssinaturaController.obterAssinatura] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      usuarioId,
    });

    return respostaErro(
      res,
      500,
      "USUARIO-ASSINATURA-500-ERRO",
      "Erro ao buscar assinatura."
    );
  }
}

module.exports = {
  obterAssinatura,
};