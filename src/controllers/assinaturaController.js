// src/controllers/assinaturaController.js
const db = require("../db");

/**
 * 🖋️ GET /api/assinatura
 * Retorna a assinatura (imagem base64) do usuário autenticado.
 */
async function getAssinatura(req, res) {
  const usuario_id = req.usuario?.id;
  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const r = await db.query(
      "SELECT imagem_base64 FROM assinaturas WHERE usuario_id = $1",
      [usuario_id]
    );
    const assinatura = r.rows[0]?.imagem_base64 || null;
    return res.status(200).json({ assinatura });
  } catch (e) {
    console.error("❌ Erro ao buscar assinatura:", e.message);
    return res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
}

/**
 * ✍️ POST /api/assinatura
 * Salva/atualiza a assinatura (data URL de imagem) do usuário autenticado.
 */
async function salvarAssinatura(req, res) {
  const usuario_id = req.usuario?.id;
  const { assinatura } = req.body;

  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });
  if (!assinatura) return res.status(400).json({ erro: "Assinatura é obrigatória." });

  // Aceita somente data URL de imagem (png/jpg/jpeg/webp/svg) por segurança
  const isDataUrl =
    typeof assinatura === "string" &&
    /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(assinatura);

  if (!isDataUrl) {
    return res
      .status(400)
      .json({ erro: "Assinatura inválida. Envie uma imagem em data URL (base64)." });
  }

  try {
    const existe = await db.query("SELECT 1 FROM assinaturas WHERE usuario_id = $1", [usuario_id]);

    if (existe.rowCount > 0) {
      await db.query(
        "UPDATE assinaturas SET imagem_base64 = $1, atualizado_em = NOW() WHERE usuario_id = $2",
        [assinatura, usuario_id]
      );
    } else {
      await db.query(
        "INSERT INTO assinaturas (usuario_id, imagem_base64, criado_em) VALUES ($1, $2, NOW())",
        [usuario_id, assinatura]
      );
    }

    return res.status(200).json({ mensagem: "Assinatura salva com sucesso." });
  } catch (e) {
    console.error("❌ Erro ao salvar assinatura:", e.message);
    return res.status(500).json({ erro: "Erro ao salvar assinatura." });
  }
}

/**
 * 📜 GET /api/assinaturas
 * Lista pessoas que possuem assinatura cadastrada.
 * Retorna somente metadados (sem a imagem) para preencher o dropdown de “2ª assinatura”.
 */
async function listarAssinaturas(req, res) {
  try {
    const { rows } = await db.query(
      `
      SELECT a.id, a.usuario_id, u.nome
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );
    return res.json(rows);
  } catch (e) {
    console.error("❌ Erro ao listar assinaturas:", e.message);
    return res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
  listarAssinaturas, // 👈 novo
};
