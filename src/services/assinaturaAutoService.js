/* eslint-disable no-console */
"use strict";

// ✅ src/services/assinaturaAutoService.js — PREMIUM/UNIFICADO
const dbModule = require("../db");
const { renderSignaturePng } = require("../utils/assinaturaAuto");

/* ───────────────── DB compat resiliente ───────────────── */
// compatível com:
// module.exports = db
// OU
// module.exports = { db, query, oneOrNone, none, tx, getClient }
const db = dbModule?.db ?? dbModule;

const query =
  dbModule?.query ||
  db?.query?.bind?.(db) ||
  (typeof db?.query === "function" ? db.query.bind(db) : null);

if (typeof query !== "function") {
  console.error("[assinaturaAutoService] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em assinaturaAutoService.js (query ausente)");
}

/* ───────────────── Helpers DB compat ───────────────── */
async function qOneOrNone(conn, sql, params = []) {
  const target = conn || db;

  if (typeof target?.oneOrNone === "function") {
    return target.oneOrNone(sql, params);
  }

  if (typeof target?.query === "function") {
    const r = await target.query(sql, params);
    const rows = r?.rows || [];
    if (rows.length === 0) return null;
    if (rows.length > 1) {
      throw new Error(`Expected at most one row, got ${rows.length}`);
    }
    return rows[0];
  }

  throw new Error("Conexão DB inválida em qOneOrNone.");
}

async function qNone(conn, sql, params = []) {
  const target = conn || db;

  if (typeof target?.none === "function") {
    return target.none(sql, params);
  }

  if (typeof target?.query === "function") {
    await target.query(sql, params);
    return null;
  }

  throw new Error("Conexão DB inválida em qNone.");
}

/* ───────────────── Helpers gerais ───────────────── */
function toArrayLower(v) {
  if (!v) return [];

  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(",")
      : [v];

  return [...new Set(
    arr
      .map((p) => String(p || "").toLowerCase().trim())
      .filter(Boolean)
  )];
}

function isInstrutorOuAdmin(perfis) {
  const roles = toArrayLower(perfis);
  return (
    roles.includes("instrutor") ||
    roles.includes("administrador") ||
    roles.includes("admin")
  );
}

function isMissingColumnError(err, columnName) {
  const msg = String(err?.message || "").toLowerCase();
  const col = String(columnName || "").toLowerCase();

  return (
    err?.code === "42703" ||
    (msg.includes(col) && msg.includes("does not exist")) ||
    (msg.includes("coluna") && msg.includes(col) && msg.includes("não existe"))
  );
}

/**
 * Busca usuário com tolerância a schemas:
 * - tenta ler "perfis" (array) se existir
 * - cai para fallback sem quebrar se a coluna não existir
 */
async function getUsuarioById(id, conn = db) {
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  try {
    return await qOneOrNone(
      conn,
      `
      SELECT
        id,
        nome,
        email,
        COALESCE(LOWER(perfil), '') AS perfil_txt,
        perfis
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );
  } catch (e) {
    if (!isMissingColumnError(e, "perfis")) throw e;

    return qOneOrNone(
      conn,
      `
      SELECT
        id,
        nome,
        email,
        COALESCE(LOWER(perfil), '') AS perfil_txt
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );
  }
}

function perfisDoUsuario(row) {
  const out = [];

  if (row?.perfil_txt) {
    out.push(...toArrayLower(row.perfil_txt));
  }

  if (Array.isArray(row?.perfis)) {
    out.push(...toArrayLower(row.perfis));
  }

  return [...new Set(out.filter(Boolean))];
}

/**
 * Retorna a assinatura em dataURL.
 * Se não existir e o usuário for instrutor/admin, gera e salva automaticamente.
 *
 * @param {number|string} usuario_id
 * @param {object} [conn=db] conexão compatível com query/oneOrNone/none
 * @returns {Promise<string|null>}
 */
async function getOrCreateAssinaturaDataUrl(usuario_id, conn = db) {
  const userId = Number(usuario_id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  // 1) tenta buscar assinatura já cadastrada
  const assinatura = await qOneOrNone(
    conn,
    `
    SELECT imagem_base64
    FROM assinaturas
    WHERE usuario_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (assinatura?.imagem_base64) {
    return assinatura.imagem_base64;
  }

  // 2) busca usuário e confere permissão
  const user = await getUsuarioById(userId, conn);
  if (!user) return null;

  const roles = perfisDoUsuario(user);
  if (!isInstrutorOuAdmin(roles)) {
    return null;
  }

  // 3) gera a assinatura automática
  try {
    const { buffer } = renderSignaturePng(user.nome || "Assinatura");

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      console.warn("[assinaturaAutoService] buffer de assinatura inválido");
      return null;
    }

    // proteção contra tamanho exagerado
    if (buffer.length > 512 * 1024) {
      console.warn(
        "[assinaturaAutoService] buffer muito grande, ignorando:",
        buffer.length
      );
      return null;
    }

    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    // 4) upsert
    await qNone(
      conn,
      `
      INSERT INTO assinaturas (usuario_id, imagem_base64)
      VALUES ($1, $2)
      ON CONFLICT (usuario_id)
      DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
      `,
      [userId, dataUrl]
    );

    return dataUrl;
  } catch (e) {
    console.warn(
      "[assinaturaAutoService] falha ao gerar assinatura automática:",
      e?.message || e
    );
    return null;
  }
}

module.exports = {
  getOrCreateAssinaturaDataUrl,
  getUsuarioById,
  perfisDoUsuario,
};