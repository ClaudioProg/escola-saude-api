const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const db = require("../db"); // ✅ garantir acesso ao banco
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

router.get("/", authMiddleware, async (req, res) => {
  const { id: usuario_id, perfil } = req.usuario;

  try {
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
        data: format(new Date(ev.data_inicio), "dd/MM/yyyy", { locale: ptBR }),
        link: `/eventos`,
      });
    });

    // 2. ⭐ Avaliações recebidas (se instrutor)
    if (perfil.includes("instrutor")) {
      const avaliacoesQuery = `
        SELECT t.evento_id, e.titulo, MAX(a.data_avaliacao) AS data
        FROM avaliacoes a
        JOIN turmas t ON t.id = a.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE a.instrutor_id = $1
        GROUP BY t.evento_id, e.titulo
        ORDER BY data DESC
        LIMIT 2
      `;
      const { rows: avaliacoes } = await db.query(avaliacoesQuery, [usuario_id]);

      avaliacoes.forEach((av) => {
        notificacoes.push({
          tipo: "avaliacao",
          mensagem: `⭐ Você recebeu uma nova avaliação no evento "${av.titulo}".`,
          data: format(new Date(av.data), "dd/MM/yyyy", { locale: ptBR }),
          link: `/avaliacoes`,
        });
      });
    }

    // 3. 📜 Certificados emitidos recentemente
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
  data: format(new Date(c.gerado_em), "dd/MM/yyyy", { locale: ptBR }),
  link: `/certificados`,
});
});

    // 4. 🔄 Ordenar por data (mais recentes primeiro)
    notificacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao carregar notificações:", err.message);
    res.status(500).json({ erro: "Erro ao carregar notificações." });
  }
});

module.exports = router;
