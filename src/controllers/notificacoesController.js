// ✅ src/controllers/notificacoesController.js
const db = require("../db");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

// Se seu projeto já tem um util de data no backend, importe aqui.
// Caso contrário, usamos um fallback local abaixo.
let formatarDataBR = null;
try {
  // Ajuste o caminho se seu util real estiver em outro lugar
  ({ formatarDataBR } = require("../utils/data"));
} catch {
  // Fallback simples
  formatarDataBR = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
}

// Caso exista um serviço específico que liste avaliações pendentes:
let buscarAvaliacoesPendentes = null;
try {
  ({ buscarAvaliacoesPendentes } = require("./avaliacoesService"));
} catch {
  // Fallback no-ops; se não existir, apenas não gera essas notificações
  buscarAvaliacoesPendentes = async () => [];
}

/* ============================================================
 * 📥 Listar notificações não lidas do usuário logado
 * ============================================================ */
async function listarNotificacoes(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const result = await db.query(
      `SELECT id, tipo, titulo, mensagem, lida, criado_em
         FROM notificacoes
        WHERE usuario_id = $1 AND lida = false
        ORDER BY criado_em DESC`,
      [usuario_id]
    );

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      tipo: n.tipo || null,
      titulo: n.titulo || null,
      mensagem: n.mensagem,
      lida: n.lida,
      data: format(new Date(n.criado_em), "dd/MM/yyyy", { locale: ptBR }),
    }));

    return res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/* ============================================================
 * 📌 Criar notificação persistente (uso interno)
 * ============================================================ */
async function criarNotificacao(usuario_id, mensagem, extra = {}) {
  if (!usuario_id || !mensagem) return;

  const { tipo = null, titulo = null, turma_id = null, evento_id = null } = extra;

  try {
    await db.query(
      `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, turma_id, evento_id, lida, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, false, CURRENT_TIMESTAMP)`,
      [usuario_id, tipo, titulo, String(mensagem), turma_id, evento_id]
    );
  } catch (err) {
    console.error("❌ Erro ao criar notificação:", err.message);
  }
}

/* ============================================================
 * 🔢 Contar notificações não lidas
 * ============================================================ */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const result = await db.query(
      `SELECT COUNT(*) FROM notificacoes WHERE usuario_id = $1 AND lida = false`,
      [usuario_id]
    );

    const totalNaoLidas = parseInt(result.rows[0]?.count || "0", 10);
    return res.json({ totalNaoLidas });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err);
    return res.status(500).json({ erro: "Erro ao contar notificações." });
  }
}

/* ============================================================
 * ✅ Marcar uma notificação como lida
 * ============================================================ */
async function marcarComoLida(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const upd = await db.query(
      `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    if (upd.rowCount === 0) {
      return res.status(404).json({ erro: "Notificação não encontrada." });
    }
    return res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

/* ============================================================
 * 📝 Notificações de avaliação pendente (pós-evento)
 * ============================================================ */
async function gerarNotificacoesDeAvaliacao(usuario_id) {
  try {
    const pendentes = await buscarAvaliacoesPendentes(usuario_id);
    for (const av of pendentes) {
      // Evita duplicar a mesma notificação por turma
      const existe = await db.query(
        `SELECT 1 FROM notificacoes 
          WHERE usuario_id = $1 AND tipo = 'avaliacao' AND turma_id = $2`,
        [usuario_id, av.turma_id]
      );
      if (existe.rowCount > 0) continue;

      const dataInicio = formatarDataBR(av.data_inicio);
      const dataFim = formatarDataBR(av.data_fim);

      await criarNotificacao(
        usuario_id,
        `Você pode avaliar a turma que participou entre ${dataInicio} e ${dataFim}.`,
        {
          tipo: "avaliacao",
          titulo: `Avaliação disponível para "${av.nome_evento}"`,
          turma_id: av.turma_id,
          evento_id: av.evento_id || null,
        }
      );
    }
  } catch (err) {
    console.error("❌ Erro ao gerar notificações de avaliação:", err.message);
  }
}

/* ============================================================
 * 🎓 Notificações de certificado (elegibilidade ≥ 75%)
 *  → Não cria registro em "certificados" aqui; apenas notifica.
 * ============================================================ */
async function gerarNotificacoesDeCertificado(usuario_id) {
  try {
    // Seleciona turmas/evenos em que o usuário foi aluno, a turma já encerrou,
    // e o usuário atingiu presença >= 75%, e ainda NÃO tem certificado do tipo 'usuario'.
    //
    // total_dias_turma: DATE_PART('day', t.data_fim - t.data_inicio) + 1
    // dias_presentes:   COUNT(DISTINCT p.data_presenca)
    // presença:         dias_presentes::float / total_dias_turma::float
    const elegiveis = await db.query(
      `
      SELECT
        e.id          AS evento_id,
        e.titulo      AS nome_evento,
        t.id          AS turma_id,
        t.data_inicio,
        t.data_fim
      FROM turmas t
      JOIN eventos e           ON e.id = t.evento_id
      JOIN inscricoes i        ON i.turma_id = t.id AND i.usuario_id = $1
      LEFT JOIN certificados c ON c.usuario_id = $1 AND c.evento_id = e.id AND c.turma_id = t.id AND c.tipo = 'usuario'
      WHERE t.data_fim <= CURRENT_DATE            -- turma encerrada
        AND c.id IS NULL                          -- ainda sem certificado
        AND (
          (
            SELECT COUNT(DISTINCT p.data_presenca)
            FROM presencas p
            WHERE p.usuario_id = $1 AND p.turma_id = t.id AND p.presente = true
          )::float
          /
          NULLIF( (DATE_PART('day', (t.data_fim::timestamp - t.data_inicio::timestamp))::int + 1), 0 )::float
        ) >= 0.75
      ORDER BY t.data_fim DESC
      `,
      [usuario_id]
    );

    for (const row of elegiveis.rows) {
      // Evita duplicar notificação de certificado para a mesma turma/evento
      const jaNotificado = await db.query(
        `SELECT 1 FROM notificacoes
          WHERE usuario_id = $1 AND tipo = 'certificado'
            AND (turma_id = $2 OR evento_id = $3)
            AND lida = false`,
        [usuario_id, row.turma_id, row.evento_id]
      );
      if (jaNotificado.rowCount > 0) continue;

      await criarNotificacao(
        usuario_id,
        `Seu certificado do evento "${row.nome_evento}" já pode ser emitido.`,
        {
          tipo: "certificado",
          titulo: `Certificado disponível: ${row.nome_evento}`,
          turma_id: row.turma_id,
          evento_id: row.evento_id,
        }
      );
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
