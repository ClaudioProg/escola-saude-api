// ✅ src/controllers/assinaturaController.js
const db = require("../db");

const MAX_DATAURL_LEN = 2 * 1024 * 1024; // ~2MB em base64 (ajuste se precisar)

/**
 * Obtém o ID do usuário autenticado do request.
 */
function getUserId(req) {
  return req.usuario?.id ?? req.user?.id ?? null;
}

/**
 * 🖋️ GET /api/assinatura
 * Retorna a assinatura (data URL) do usuário autenticado.
 */
async function getAssinatura(req, res) {
  const usuario_id = getUserId(req);
  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const r = await db.query(
      "SELECT imagem_base64 FROM assinaturas WHERE usuario_id = $1 LIMIT 1",
      [usuario_id]
    );
    const assinatura = r.rows[0]?.imagem_base64 || null;
    return res.status(200).json({ assinatura });
  } catch (e) {
    console.error("❌ Erro ao buscar assinatura:", e);
    return res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
}

/**
 * ✍️ POST /api/assinatura
 * Salva/atualiza a assinatura (data URL de imagem) do usuário autenticado.
 */
async function salvarAssinatura(req, res) {
  const usuario_id = getUserId(req);
  const { assinatura } = req.body;

  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });
  if (!assinatura || typeof assinatura !== "string") {
    return res.status(400).json({ erro: "Assinatura é obrigatória." });
  }

  // Por segurança, **bloqueia SVG** (passível de payloads ativos) e aceita PNG/JPG/JPEG/WEBP
  const isAllowedDataUrl =
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(assinatura);

  if (!isAllowedDataUrl) {
    return res.status(400).json({
      erro:
        "Assinatura inválida. Envie uma imagem base64 nos formatos PNG, JPG/JPEG ou WEBP.",
    });
  }

  if (assinatura.length > MAX_DATAURL_LEN) {
    return res
      .status(413)
      .json({ erro: "Imagem muito grande. Envie um arquivo menor." });
  }

  try {
    const existe = await db.query(
      "SELECT 1 FROM assinaturas WHERE usuario_id = $1",
      [usuario_id]
    );

    if (existe.rowCount > 0) {
      await db.query(
        "UPDATE assinaturas SET imagem_base64 = $1, atualizado_em = NOW() WHERE usuario_id = $2",
        [assinatura.trim(), usuario_id]
      );
    } else {
      await db.query(
        "INSERT INTO assinaturas (usuario_id, imagem_base64, criado_em) VALUES ($1, $2, NOW())",
        [usuario_id, assinatura.trim()]
      );
    }

    return res.status(200).json({ mensagem: "Assinatura salva com sucesso." });
  } catch (e) {
    console.error("❌ Erro ao salvar assinatura:", e);
    return res.status(500).json({ erro: "Erro ao salvar assinatura." });
  }
}

/**
 * 📜 GET /api/assinatura/lista  (alias: /api/assinatura/todas)
 * Lista pessoas que possuem assinatura cadastrada (metadados para dropdown).
 * Retorna sem a imagem para não trafegar dado pesado desnecessário.
 */
async function listarAssinaturas(req, res) {
  try {
    const { rows } = await db.query(
      `
      SELECT
        a.usuario_id AS id,
        u.nome,
        COALESCE(u.cargo, NULL) AS cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    // Normaliza para o front:
    // { id, nome, cargo?, tem_assinatura: true }
    const lista = rows.map(r => ({
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
