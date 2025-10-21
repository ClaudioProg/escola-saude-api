// 📁 routes/notificacoesRoute.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const db = require("../db");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/**
 * 🔎 Helper: normaliza paginação com limites seguros
 */
function getPagination(req) {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const rawOffset = Number.parseInt(req.query.offset, 10);

  // limites razoáveis
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  return { limit, offset };
}

/**
 * ✅ GET /api/notificacoes
 * Lista notificações do usuário autenticado (mais recentes primeiro)
 * Suporta paginação via ?limit=&offset=
 */
router.get("/", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.user;
  const { limit, offset } = getPagination(req);

  try {
    const result = await db.query(
      `
      SELECT id, mensagem, lida, criado_em
        FROM notificacoes
       WHERE usuario_id = $1
       ORDER BY criado_em DESC
       LIMIT $2 OFFSET $3
      `,
      [usuario_id, limit, offset]
    );

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      mensagem: n.mensagem,
      lida: n.lida,
      data: format(new Date(n.criado_em), "dd/MM/yyyy", { locale: ptBR }),
    }));

    res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao listar notificações:", err);
    res.status(500).json({ erro: "Erro ao listar notificações." });
  }
});

/**
 * ✅ GET /api/notificacoes/nao-lidas/contagem
 * Total de notificações não lidas do usuário
 */
router.get("/nao-lidas/contagem", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.user;

  try {
    const { rows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
        FROM notificacoes
       WHERE usuario_id = $1
         AND lida = false
      `,
      [usuario_id]
    );

    res.status(200).json({ totalNaoLidas: rows[0]?.total ?? 0 });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err);
    res.status(500).json({ erro: "Erro ao contar notificações não lidas." });
  }
});

/**
 * ✅ PATCH /api/notificacoes/:id/lida
 * Marca uma notificação como lida (se pertencer ao usuário)
 */
router.patch("/:id/lida", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.user;

  // valida ID numérico
  const notificacao_id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(notificacao_id) || notificacao_id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const { rowCount } = await db.query(
      `
      UPDATE notificacoes
         SET lida = true
       WHERE id = $1
         AND usuario_id = $2
      `,
      [notificacao_id, usuario_id]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ erro: "Notificação não encontrada ou não pertence ao usuário." });
    }

    res.status(200).json({ sucesso: true, mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
});

/**
 * (Opcional) ✅ PATCH /api/notificacoes/lidas/todas
 * Marca TODAS as notificações do usuário como lidas
 */
router.patch("/lidas/todas", authMiddleware, async (req, res) => {
  const { id: usuario_id } = req.user;
  try {
    await db.query(
      `
      UPDATE notificacoes
         SET lida = true
       WHERE usuario_id = $1
         AND lida = false
      `,
      [usuario_id]
    );
    res.status(200).json({ sucesso: true, mensagem: "Todas as notificações foram marcadas como lidas." });
  } catch (err) {
    console.error("❌ Erro ao marcar todas como lidas:", err);
    res.status(500).json({ erro: "Erro ao atualizar notificações." });
  }
});

module.exports = router;
