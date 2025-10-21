/* eslint-disable no-console */
const db = require("../db");
const { renderSignaturePng } = require("../utils/assinaturaAuto");

function isInstrutorOuAdmin(perfil) {
  const arr = Array.isArray(perfil) ? perfil : [perfil];
  return arr.map((p) => String(p || "").toLowerCase().trim())
           .some((p) => p === "instrutor" || p === "administrador");
}

async function getUsuarioById(id, t = db) {
  return t.oneOrNone(
    `SELECT id, nome, email,
            COALESCE(LOWER(perfil),'') AS perfil_txt,
            perfis
       FROM usuarios
      WHERE id=$1`,
    [id]
  );
}

function perfisDoUsuario(row) {
  const out = [];
  if (row?.perfil_txt) out.push(row.perfil_txt);
  if (Array.isArray(row?.perfis)) {
    for (const p of row.perfis) out.push(String(p || "").toLowerCase().trim());
  }
  return out.length ? out : [row?.perfil_txt || ""];
}

/** Retorna dataURL da assinatura; cria automática p/ instrutor/admin se não existir */
async function getOrCreateAssinaturaDataUrl(usuario_id, t = db) {
  // 1) já existe?
  const a = await t.oneOrNone(
    `SELECT imagem_base64 FROM assinaturas WHERE usuario_id=$1 LIMIT 1`,
    [usuario_id]
  );
  if (a?.imagem_base64) return a.imagem_base64;

  // 2) é instrutor/admin?
  const user = await getUsuarioById(usuario_id, t);
  if (!user) return null;
  if (!isInstrutorOuAdmin(perfisDoUsuario(user))) return null;

  // 3) gerar PNG cursivo e salvar
  try {
    const { buffer } = renderSignaturePng(user.nome || "Assinatura");
    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    // upsert
    await t.none(
      `INSERT INTO assinaturas (usuario_id, imagem_base64)
       VALUES ($1,$2)
       ON CONFLICT (usuario_id) DO UPDATE SET imagem_base64=EXCLUDED.imagem_base64`,
      [usuario_id, dataUrl]
    );

    return dataUrl;
  } catch (e) {
    console.warn("[assinaturaAuto] falha ao gerar:", e.message);
    return null;
  }
}

module.exports = { getOrCreateAssinaturaDataUrl };
