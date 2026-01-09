/* eslint-disable no-console */

const dbModule = require("../db");
const { renderSignaturePng } = require("../utils/assinaturaAuto");

// ✅ compatível: module.exports = db  OU  module.exports = { db }
const db = dbModule?.db ?? dbModule;

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [v];
  return arr.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
}

function isInstrutorOuAdmin(perfis) {
  const roles = toArrayLower(perfis);
  return roles.includes("instrutor") || roles.includes("administrador") || roles.includes("admin");
}

/**
 * Busca usuário com tolerância a schemas:
 * - Se existir coluna "perfis" (array) usa; se não, não quebra.
 * - Sempre normaliza perfis/roles.
 */
async function getUsuarioById(id, t = db) {
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  // ✅ tentamos ler "perfis" (array). Se não existir, fazemos fallback sem ela.
  try {
    return await t.oneOrNone(
      `SELECT id, nome, email,
              COALESCE(LOWER(perfil),'') AS perfil_txt,
              perfis
         FROM usuarios
        WHERE id=$1
        LIMIT 1`,
      [userId]
    );
  } catch (e) {
    const msg = String(e?.message || "");
    // fallback: coluna perfis não existe
    if (msg.toLowerCase().includes("perfis") && msg.toLowerCase().includes("does not exist")) {
      return t.oneOrNone(
        `SELECT id, nome, email,
                COALESCE(LOWER(perfil),'') AS perfil_txt
           FROM usuarios
          WHERE id=$1
          LIMIT 1`,
        [userId]
      );
    }
    throw e;
  }
}

function perfisDoUsuario(row) {
  const out = [];

  if (row?.perfil_txt) out.push(String(row.perfil_txt).toLowerCase().trim());

  // Se existir coluna perfis e for array
  if (Array.isArray(row?.perfis)) {
    for (const p of row.perfis) out.push(String(p || "").toLowerCase().trim());
  }

  const norm = out.map((p) => p.trim()).filter(Boolean);
  return norm;
}

/**
 * Retorna dataURL da assinatura.
 * Se não existir e o usuário for instrutor/admin, gera assinatura automática e salva.
 */
async function getOrCreateAssinaturaDataUrl(usuario_id, t = db) {
  const userId = Number(usuario_id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  // 1) já existe?
  const a = await t.oneOrNone(
    `SELECT imagem_base64
       FROM assinaturas
      WHERE usuario_id=$1
      LIMIT 1`,
    [userId]
  );
  if (a?.imagem_base64) return a.imagem_base64;

  // 2) buscar usuário e checar permissão (uma vez só)
  const user = await getUsuarioById(userId, t);
  if (!user) return null;

  const roles = perfisDoUsuario(user);
  if (!isInstrutorOuAdmin(roles)) return null;

  // 3) gerar PNG cursivo e salvar (com limite de tamanho)
  try {
    const { buffer } = renderSignaturePng(user.nome || "Assinatura");

    // ✅ proteção: evita salvar base64 gigante por acidente
    if (!buffer || buffer.length > 512 * 1024) { // 512KB
      console.warn("[assinaturaAuto] buffer muito grande, ignorando:", buffer?.length);
      return null;
    }

    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    // upsert
    await t.none(
      `INSERT INTO assinaturas (usuario_id, imagem_base64)
       VALUES ($1,$2)
       ON CONFLICT (usuario_id)
       DO UPDATE SET imagem_base64=EXCLUDED.imagem_base64`,
      [userId, dataUrl]
    );

    return dataUrl;
  } catch (e) {
    console.warn("[assinaturaAuto] falha ao gerar:", e?.message || e);
    return null;
  }
}

module.exports = { getOrCreateAssinaturaDataUrl };
