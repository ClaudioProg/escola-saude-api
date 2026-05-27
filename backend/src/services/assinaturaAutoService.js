/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/assinaturaAutoService.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Buscar assinatura cadastrada do usuário.
 * - Se não existir, gerar assinatura automática para qualquer usuário válido.
 * - Persistir a assinatura automática em assinaturas.imagem_base64.
 *
 * Contrato oficial:
 * - db exportado diretamente por src/db/index.js
 * - db.oneOrNone
 * - db.none
 * - usuarios.perfil é string única oficial
 *
 * Regra oficial:
 * - Qualquer usuário autenticado/identificado pode ter assinatura própria.
 * - A assinatura é necessária também para fluxos como termo de reserva de sala.
 *
 * Não usar:
 * - dbModule.db
 * - perfis
 * - roles
 * - role
 * - admin
 * - aliases de perfil
 * - fallbacks de schema
 */

const db = require("../db");
const { renderSignaturePng } = require("../utils/assinaturaAuto");

const MAX_SIGNATURE_BYTES = 512 * 1024;

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function normalizeUsuarioId(usuarioId) {
  const id = Number(usuarioId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function assinaturaToDataUrl(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  if (buffer.length > MAX_SIGNATURE_BYTES) {
    console.warn("[assinaturaAutoService] buffer de assinatura acima do limite", {
      bytes: buffer.length,
      limite: MAX_SIGNATURE_BYTES,
    });

    return null;
  }

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function normalizeNomeAssinatura(usuario) {
  const nome = String(usuario?.nome || "").replace(/\s+/g, " ").trim();
  const email = String(usuario?.email || "").trim();

  return nome || email || `Usuario_${usuario?.id}`;
}

/* ─────────────────────────────────────────
   Consultas
───────────────────────────────────────── */

async function getUsuarioById(usuarioId, conn = db) {
  const id = normalizeUsuarioId(usuarioId);

  if (!id) {
    return null;
  }

  return conn.oneOrNone(
    `
      SELECT
        id,
        nome,
        email,
        perfil
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
}

async function getAssinaturaByUsuarioId(usuarioId, conn = db) {
  const id = normalizeUsuarioId(usuarioId);

  if (!id) {
    return null;
  }

  return conn.oneOrNone(
    `
      SELECT
        usuario_id,
        imagem_base64
      FROM assinaturas
      WHERE usuario_id = $1
      LIMIT 1
    `,
    [id]
  );
}

async function salvarAssinaturaAutomatica(usuarioId, dataUrl, conn = db) {
  const id = normalizeUsuarioId(usuarioId);

  if (!id || !dataUrl) {
    return null;
  }

  await conn.none(
    `
      INSERT INTO assinaturas (
        usuario_id,
        imagem_base64
      )
      VALUES ($1, $2)
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        imagem_base64 = EXCLUDED.imagem_base64
    `,
    [id, dataUrl]
  );

  return dataUrl;
}

/* ─────────────────────────────────────────
   Service principal
───────────────────────────────────────── */

/**
 * Retorna a assinatura do usuário em dataURL.
 *
 * Se não existir assinatura cadastrada, gera uma assinatura automática e salva
 * no banco para qualquer usuário válido.
 *
 * @param {number|string} usuarioId
 * @param {object} [conn=db]
 * @returns {Promise<string|null>}
 */
async function getOrCreateAssinaturaDataUrl(usuarioId, conn = db) {
  const id = normalizeUsuarioId(usuarioId);

  if (!id) {
    return null;
  }

  const assinaturaExistente = await getAssinaturaByUsuarioId(id, conn);

  if (assinaturaExistente?.imagem_base64) {
    return assinaturaExistente.imagem_base64;
  }

  const usuario = await getUsuarioById(id, conn);

  if (!usuario) {
    return null;
  }

  try {
    const assinaturaRenderizada = renderSignaturePng(
      normalizeNomeAssinatura(usuario)
    );

    const dataUrl = assinaturaToDataUrl(assinaturaRenderizada?.buffer);

    if (!dataUrl) {
      console.warn("[assinaturaAutoService] assinatura automática inválida", {
        usuarioId: id,
      });

      return null;
    }

    await salvarAssinaturaAutomatica(id, dataUrl, conn);

    return dataUrl;
  } catch (error) {
    console.warn("[assinaturaAutoService] falha ao gerar assinatura automática", {
      usuarioId: id,
      message: error?.message,
    });

    return null;
  }
}

module.exports = {
  getOrCreateAssinaturaDataUrl,
  getUsuarioById,
  getAssinaturaByUsuarioId,
  salvarAssinaturaAutomatica,
};