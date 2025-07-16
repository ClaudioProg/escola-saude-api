const db = require("../db");

async function listarNotificacoes(req, res) {
  try {
    const usuario = req.usuario;
    if (!usuario || !usuario.id) {
      return res.status(401).json({ erro: "Não autorizado" });
    }

    const usuario_id = usuario.id;
    const perfil = usuario.perfil || [];

    const notificacoes = [];

    // 1. 📅 Eventos programados próximos
    const eventosQuery = `
      SELECT e.titulo, t.id AS turma_id, t.data_inicio
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      JOIN inscricoes i ON i.turma_id = t.id
      WHERE i.usuario_id = $1
        AND t.data_inicio BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
      ORDER BY t.data_inicio ASC
      LIMIT 2
    `;
    const { rows: eventos } = await db.query(eventosQuery, [usuario_id]);

    eventos.forEach((ev) => {
      notificacoes.push({
        tipo: "evento",
        mensagem: `📅 Você tem uma aula do evento "${ev.titulo}" em breve.`,
        data: new Date(ev.data_inicio).toLocaleDateString("pt-BR"),
        link: `/eventos`,
      });
    });

    // 2. ⭐ Avaliações recebidas (apenas instrutor)
    if (Array.isArray(perfil) && perfil.includes("instrutor")) {
      const avaliacoesQuery = `
        SELECT e.titulo, MAX(a.data_avaliacao) AS data
        FROM avaliacoes a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.instrutor_id = $1
        GROUP BY e.titulo
        ORDER BY data DESC
        LIMIT 2
      `;
      const { rows: avaliacoes } = await db.query(avaliacoesQuery, [usuario_id]);

      avaliacoes.forEach((av) => {
        notificacoes.push({
          tipo: "avaliacao",
          mensagem: `⭐ Você recebeu uma nova avaliação no evento "${av.titulo}".`,
          data: new Date(av.data).toLocaleDateString("pt-BR"),
          link: `/avaliacoes`,
        });
      });
    }

    // 3. 📜 Certificados emitidos
    const certificadosQuery = `
      SELECT c.id, e.titulo, c.gerado_em
      FROM certificados c
      JOIN eventos e ON e.id = c.evento_id
      WHERE c.usuario_id = $1
      ORDER BY c.gerado_em DESC
      LIMIT 2
    `;
    const { rows: certificados } = await db.query(certificadosQuery, [usuario_id]);

    certificados.forEach((c) => {
      notificacoes.push({
        tipo: "certificado",
        mensagem: `📜 Seu certificado do evento "${c.titulo}" está disponível.`,
        data: new Date(c.gerado_em).toLocaleDateString("pt-BR"),
        link: `/certificados`,
      });
    });

    // 🔄 Ordena do mais recente para o mais antigo
    notificacoes.sort((a, b) => {
      const dataA = new Date(a.data.split('/').reverse().join('-'));
      const dataB = new Date(b.data.split('/').reverse().join('-'));
      return dataB - dataA;
    });

    res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    res.status(500).json({ erro: "Erro ao buscar notificações" });
  }
}

module.exports = { listarNotificacoes };
