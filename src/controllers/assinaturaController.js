// ✅ src/controllers/assinaturaController.js
/* eslint-disable no-console */
const db = require("../db");

const MAX_DATAURL_TOTAL = 6 * 1024 * 1024; // 6MB: limite para a string toda (prefixo + base64)
const MAX_BASE64_BYTES   = 4 * 1024 * 1024; // 4MB: tamanho só do payload base64 (ajuste se quiser)

/** Obtém o ID do usuário autenticado do request. */
function getUserId(req) {
  return req.usuario?.id ?? req.user?.id ?? null;
}

/** Extrai apenas a parte base64 de um DataURL (sem o cabeçalho). */
function extractBase64Payload(dataUrl) {
  const m = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);
  return m ? m[1] : null;
}

/** 🖋️ GET /api/assinatura — retorna a assinatura dataURL do usuário */
async function getAssinatura(req, res) {
  const usuario_id = getUserId(req);
  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const r = await db.query(
      "SELECT imagem_base64 FROM assinaturas WHERE usuario_id = $1 LIMIT 1",
      [usuario_id]
    );
    const assinatura = r.rows?.[0]?.imagem_base64 || null;
    return res.status(200).json({ assinatura });
  } catch (e) {
    console.error("❌ Erro ao buscar assinatura:", e);
    return res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
}

/** ✍️ POST /api/assinatura — salva/atualiza dataURL */
async function salvarAssinatura(req, res) {
  const usuario_id = getUserId(req);
  const { assinatura } = req.body;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }
  if (!assinatura || typeof assinatura !== "string") {
    return res.status(400).json({ erro: "Assinatura é obrigatória." });
  }

  // Bloqueia SVG; aceita PNG/JPG/JPEG/WEBP
  const isAllowedDataUrl =
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(assinatura);
  if (!isAllowedDataUrl) {
    return res.status(400).json({
      erro:
        "Assinatura inválida. Envie uma imagem base64 nos formatos PNG, JPG/JPEG ou WEBP.",
    });
  }

  // Limites (string toda e payload base64)
  if (assinatura.length > MAX_DATAURL_TOTAL) {
    return res.status(413).json({ erro: "Imagem muito grande (limite 6MB)." });
  }
  const b64 = extractBase64Payload(assinatura);
  if (!b64) {
    return res.status(400).json({ erro: "Data URL inválida." });
  }
  if (b64.length > MAX_BASE64_BYTES * 1.37) {
    // base64 ~ 4/3, então comparo com fator 1.37 para folga
    return res.status(413).json({ erro: "Imagem muito grande (payload > 4MB)." });
  }

  const payload = assinatura.trim();

  try {
    // Tenta UPSERT (precisa de UNIQUE em assinaturas(usuario_id))
    try {
      await db.query(
        `
        INSERT INTO assinaturas (usuario_id, imagem_base64)
        VALUES ($1, $2)
        ON CONFLICT (usuario_id)
        DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
        `,
        [usuario_id, payload]
      );
    } catch (upsertErr) {
      // Se não houver UNIQUE em usuario_id, cai no fallback:
      // 1) tenta UPDATE
      const upd = await db.query(
        "UPDATE assinaturas SET imagem_base64 = $1 WHERE usuario_id = $2",
        [payload, usuario_id]
      );
      if (upd.rowCount === 0) {
        // 2) se não atualizou nada, faz INSERT simples
        await db.query(
          "INSERT INTO assinaturas (usuario_id, imagem_base64) VALUES ($1, $2)",
          [usuario_id, payload]
        );
      }
    }

    return res.status(200).json({ mensagem: "Assinatura salva com sucesso." });
  } catch (e) {
    // loga com detalhes úteis
    console.error("❌ Erro ao salvar assinatura:", {
      message: e?.message,
      code: e?.code,
      detail: e?.detail,
      table: e?.table,
      constraint: e?.constraint,
      stack: e?.stack,
    });
    return res.status(500).json({ erro: "Erro ao salvar assinatura." });
  }
}

/** 📜 GET /api/assinatura/lista — lista metadados (sem imagem) */
async function listarAssinaturas(req, res) {
  try {
    const { rows } = await db.query(
      `
      SELECT a.usuario_id AS id, u.nome, COALESCE(u.cargo, NULL) AS cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: true,
    }));

    return res.json(lista);
  } catch (e) {
    console.error("❌ Erro ao listar assinaturas:", e);
    return res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
  listarAssinaturas,
};
