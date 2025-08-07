//notificacoesController
const db = require("../db");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");
const { formatarDataBR } = require("../utils/data");
const { buscarAvaliacoesPendentes } = require('./avaliacoesService');

/**
 * 📥 Listar notificações do usuário logado (não lidas)
 */
async function listarNotificacoes(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const result = await db.query(
      `SELECT id, mensagem, lida, criado_em
       FROM notificacoes
       WHERE usuario_id = $1 AND lida = false
       ORDER BY criado_em DESC`,
      [usuario_id]
    );

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      mensagem: n.mensagem,
      lida: n.lida,
      data: format(new Date(n.criado_em), "dd/MM/yyyy", { locale: ptBR }),
    }));

    res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/**
 * 📌 Criar notificação persistente no banco
 */
async function criarNotificacao(usuario_id, mensagem) {
  if (!usuario_id || !mensagem) return;

  try {
    await db.query(
      `
      INSERT INTO notificacoes (usuario_id, mensagem, lida, criado_em)
      VALUES ($1, $2, false, CURRENT_TIMESTAMP)
    `,
      [usuario_id, String(mensagem)]
    );
  } catch (err) {
    console.error("❌ Erro ao criar notificação:", err.message);
  }
}

/**
 * 🔢 Contar notificações não lidas
 */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.usuario.id;

    const result = await db.query(
      `SELECT COUNT(*) FROM notificacoes WHERE usuario_id = $1 AND lida = false`,
      [usuario_id]
    );

    const totalNaoLidas = parseInt(result.rows[0].count, 10) || 0;

    res.json({ totalNaoLidas });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err);
    res.status(500).json({ erro: "Erro ao contar notificações." });
  }
}

async function marcarComoLida(req, res) {
  const usuario_id = req.usuario.id;
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
    res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

async function gerarNotificacoesDeAvaliacao(usuario_id) {
  const avaliacoesPendentes = await buscarAvaliacoesPendentes(usuario_id);

  for (const avaliacao of avaliacoesPendentes) {
    const existe = await db.query(
      `SELECT 1 FROM notificacoes 
       WHERE usuario_id = $1 AND tipo = 'avaliacao' AND turma_id = $2`,
      [usuario_id, avaliacao.turma_id]
    );

    if (existe.rowCount === 0) {
      const dataInicio = formatarDataBR(avaliacao.data_inicio);
      const dataFim = formatarDataBR(avaliacao.data_fim);
      await db.query(
        `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, turma_id)
         VALUES ($1, 'avaliacao', $2, $3, $4)`,
        [
          usuario_id,
          `Avaliação disponível para "${avaliacao.nome_evento}"`,
          `Você pode avaliar a turma que participou entre ${dataInicio} e ${dataFim}.`,
          avaliacao.turma_id
        ]
      );
    }
  }
}

async function gerarNotificacoesDeCertificado(usuario_id) {
  try {
    const result = await db.query(
      `SELECT a.turma_id, e.id AS evento_id, e.titulo AS nome_evento, t.data_inicio, t.data_fim
       FROM avaliacoes a
       JOIN turmas t ON t.id = a.turma_id
       JOIN eventos e ON e.id = t.evento_id
       LEFT JOIN certificados c ON c.usuario_id = a.usuario_id AND c.evento_id = e.id
       WHERE a.usuario_id = $1
         AND EXISTS (
           SELECT 1 FROM presencas p 
           WHERE p.usuario_id = a.usuario_id 
             AND p.turma_id = a.turma_id 
           GROUP BY p.usuario_id, p.turma_id
           HAVING COUNT(*) * 1.0 / (t.data_fim - t.data_inicio + 1) >= 0.75
         )
         AND c.id IS NULL`,
      [usuario_id]
    );

    for (const row of result.rows) {
      try {
        await db.query(
          `INSERT INTO certificados (usuario_id, evento_id, gerado_em)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [usuario_id, row.evento_id]
        );

        await db.query(
          `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem)
           VALUES ($1, 'certificado', $2, $3)`,
          [
            usuario_id,
            `Certificado disponível: ${row.nome_evento}`,
            `Seu certificado do evento "${row.nome_evento}" já está disponível para download.`
          ]
        );
      } catch (err) {
        console.warn("⚠️ Erro ao gerar certificado ou notificação:", err.message);
      }
    }
  } catch (err) {
    console.error("❌ Erro geral em gerarNotificacoesDeCertificado:", err.message);
  }
}

module.exports = {
  listarNotificacoes,
  criarNotificacao,
  contarNaoLidas,
  marcarComoLida,
  gerarNotificacoesDeAvaliacao,
  gerarNotificacoesDeCertificado,
};
