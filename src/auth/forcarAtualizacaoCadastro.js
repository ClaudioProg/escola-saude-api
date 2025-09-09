// 📁 src/auth/forcarAtualizacaoCadastro.js
const db = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

async function forcarAtualizacaoCadastro(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: "Não autenticado." });

    const { rows } = await db.query(
      `SELECT id, cargo_id, unidade_id, data_nascimento, genero_id,
              orientacao_sexual_id, cor_raca_id, escolaridade_id, deficiencia_id
       FROM usuarios WHERE id = $1`,
      [userId]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ erro: "Usuário não encontrado." });

    const incompleto = isPerfilIncompleto(u);
    res.setHeader("X-Perfil-Incompleto", incompleto ? "1" : "0");
    req.perfilIncompleto = incompleto;

    next();
  } catch (e) {
    console.error("forcarAtualizacaoCadastro:", e);
    next(); // não derruba a requisição
  }
}

module.exports = forcarAtualizacaoCadastro;
