const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const db = require("../db");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");
const { contarNaoLidas } = require("../controllers/notificacoesController");

// ✅ GET: Lista notificações do usuário autenticado
router.get("/", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.usuario;

  try {
    const result = await db.query(`
      SELECT id, mensagem, lida, criado_em
      FROM notificacoes
      WHERE usuario_id = $1
      ORDER BY criado_em DESC
      LIMIT 20
    `, [usuario_id]);

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      mensagem: n.mensagem,
      lida: n.lida,
      data: format(new Date(n.criado_em), "dd/MM/yyyy", { locale: ptBR }),
    }));

    res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao listar notificações:", err.message);
    res.status(500).json({ erro: "Erro ao listar notificações." });
  }
});

// ✅ PATCH: Marcar uma notificação como lida (apenas se pertencer ao usuário)
router.patch("/:id/lida", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.usuario;
  const { id: notificacao_id } = req.params;

  try {
    const { rowCount } = await db.query(`
      UPDATE notificacoes
      SET lida = true
      WHERE id = $1 AND usuario_id = $2
    `, [notificacao_id, usuario_id]);

    if (rowCount === 0) {
      return res.status(404).json({ erro: "Notificação não encontrada ou não pertence ao usuário." });
    }

    res.status(200).json({ sucesso: true, mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err.message);
    res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
});

// ✅ GET: Retorna o total de notificações não lidas
router.get("/nao-lidas/contagem", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.usuario;

  try {
    const { rows } = await db.query(`
      SELECT COUNT(*) FROM notificacoes
      WHERE usuario_id = $1 AND lida = false
    `, [usuario_id]);

    const totalNaoLidas = parseInt(rows[0].count, 10);
    res.status(200).json({ totalNaoLidas });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err.message);
    res.status(500).json({ erro: "Erro ao contar notificações não lidas." });
  }
});

module.exports = router;
