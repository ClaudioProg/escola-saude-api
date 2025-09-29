// 📁 src/instrutorController.js
/* eslint-disable no-console */
const db = require("../db");

/**
 * 🔢 Helper SQL: mapeia desempenho (texto/numérico) → nota 1..5
 * - Lida com textos: Ótimo/Excelente/Muito bom = 5; Bom = 4; Regular/Médio = 3; Ruim = 2; Péssimo/Muito ruim = 1
 * - Lida com valores '1'..'5' gravados como texto
 */
const SQL_MAP_NOTA = `
  CASE
    /* numérico salvo como texto */
    WHEN a.desempenho_instrutor IN ('5','4','3','2','1') THEN a.desempenho_instrutor::numeric
    /* textos (tolerando variações comuns) */
    WHEN a.desempenho_instrutor ILIKE 'ótimo' OR a.desempenho_instrutor ILIKE 'otimo'
      OR a.desempenho_instrutor ILIKE 'excelente' OR a.desempenho_instrutor ILIKE 'muito bom'
      THEN 5
    WHEN a.desempenho_instrutor ILIKE 'bom' THEN 4
    WHEN a.desempenho_instrutor ILIKE 'regular' OR a.desempenho_instrutor ILIKE 'médio'
      OR a.desempenho_instrutor ILIKE 'medio'
      THEN 3
    WHEN a.desempenho_instrutor ILIKE 'ruim' THEN 2
    WHEN a.desempenho_instrutor ILIKE 'péssimo' OR a.desempenho_instrutor ILIKE 'pessimo'
      OR a.desempenho_instrutor ILIKE 'muito ruim'
      THEN 1
    ELSE NULL
  END
`;

/**
 * 📋 Lista todos os instrutores com suas médias de avaliação e contadores
 * @route GET /api/usuarios/instrutor
 *
 * Observações:
 * - Usa COALESCE(a.palestrante_id, a.instrutor_id) para compatibilidade.
 * - Conta eventos distintos em que a pessoa foi instrutor.
 * - Média usa mapeamento robusto (texto/numérico) para desempenho do instrutor.
 */
async function listarInstrutor(req, res) {
  try {
    const sql = `
      SELECT 
        u.id, 
        u.nome, 
        u.email,

        /* Quantos eventos distintos a pessoa ministrou */
        (
          SELECT COUNT(DISTINCT ei.evento_id)
          FROM evento_instrutor ei
          WHERE ei.instrutor_id = u.id
        ) AS "eventosMinistrados",

        /* Total de turmas vinculadas a esses eventos (informativo) */
        (
          SELECT COUNT(*)
          FROM evento_instrutor ei2
          JOIN turmas t2 ON t2.evento_id = ei2.evento_id
          WHERE ei2.instrutor_id = u.id
        ) AS "turmasVinculadas",

        /* Total de respostas recebidas (desempenho_instrutor preenchido) */
        (
          SELECT COUNT(*)
          FROM avaliacoes a2
          WHERE COALESCE(a2.palestrante_id, a2.instrutor_id) = u.id
            AND (
              ${SQL_MAP_NOTA.replaceAll("a.", "a2.")}
            ) IS NOT NULL
        ) AS "totalRespostas",

        /* Média geral de desempenho (1..5) */
        ROUND(AVG(
          ${SQL_MAP_NOTA}
        )::numeric, 2) AS media_avaliacao,

        /* Possui assinatura? */
        CASE WHEN s.imagem_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS "possuiAssinatura"

      FROM usuarios u
      LEFT JOIN assinaturas s ON s.usuario_id = u.id
      LEFT JOIN avaliacoes a ON COALESCE(a.palestrante_id, a.instrutor_id) = u.id

      /* Pelo menos um desses perfis */
      WHERE string_to_array(u.perfil, ',') && ARRAY['instrutor', 'administrador']

      GROUP BY u.id, u.nome, u.email, s.imagem_base64
      ORDER BY u.nome;
    `;
    const { rows } = await db.query(sql);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar instrutor:", error);
    return res.status(500).json({ erro: "Erro ao buscar instrutor." });
  }
}

/**
 * 📊 Lista eventos ministrados por um instrutor com período, média e total de respostas
 * @route GET /api/instrutor/:id/eventos-avaliacoes
 *
 * Retorna por evento:
 *  - evento_id, evento (título)
 *  - data_inicio (mín) / data_fim (máx) das turmas do evento
 *  - nota_media (1..5, 1 casa)
 *  - total_respostas (quantas avaliações desse instrutor nesse evento)
 */
async function getEventosAvaliacoesPorInstrutor(req, res) {
  const { id } = req.params;
  try {
    const sql = `
      WITH respostas AS (
        SELECT
          e.id AS evento_id,
          ${SQL_MAP_NOTA} AS nota
        FROM eventos e
        JOIN turmas t           ON t.evento_id = e.id
        JOIN evento_instrutor ei ON ei.evento_id = e.id
        LEFT JOIN avaliacoes a   ON a.turma_id = t.id
                                AND COALESCE(a.palestrante_id, a.instrutor_id) = ei.instrutor_id
        WHERE ei.instrutor_id = $1
      )
      SELECT 
        e.id AS evento_id,
        e.titulo AS evento,
        MIN(t.data_inicio) AS data_inicio,
        MAX(t.data_fim)    AS data_fim,
        /* média 1 casa (já em escala 1..5) */
        ROUND(AVG(r.nota)::numeric, 1) AS nota_media,
        COUNT(r.nota) AS total_respostas
      FROM eventos e
      JOIN turmas t           ON t.evento_id = e.id
      JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN respostas r    ON r.evento_id = e.id
      WHERE ei.instrutor_id = $1
      GROUP BY e.id, e.titulo
      ORDER BY MIN(t.data_inicio) DESC NULLS LAST;
    `;
    const { rows } = await db.query(sql, [Number(id)]);
    return res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao buscar eventos do instrutor:", error.message);
    return res.status(500).json({ erro: "Erro ao buscar eventos ministrados." });
  }
}

/**
 * 📚 Lista turmas vinculadas a um instrutor (com nome do evento)
 * @route GET /api/instrutor/:id/turmas
 */
async function getTurmasComEventoPorInstrutor(req, res) {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        t.id AS id,
        t.nome AS nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        e.id     AS evento_id,
        e.titulo AS evento_nome,
        e.local  AS evento_local
      FROM evento_instrutor ei
      JOIN eventos e ON ei.evento_id = e.id
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio ASC NULLS LAST, t.id ASC
    `;
    const { rows } = await db.query(query, [Number(id)]);

    const turmasFormatadas = rows.map((t) => ({
      id: t.id,
      nome: t.nome,
      data_inicio: t.data_inicio,
      data_fim: t.data_fim,
      horario_inicio: t.horario_inicio,
      horario_fim: t.horario_fim,
      evento: {
        id: t.evento_id,
        nome: t.evento_nome,
        local: t.evento_local,
      },
    }));

    return res.json(turmasFormatadas);
  } catch (error) {
    console.error("❌ Erro ao buscar turmas do instrutor:", error.message);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

/**
 * 👤 “Minhas turmas” (instrutor autenticado)
 * @route GET /api/instrutor/minhas/turmas
 */
async function getMinhasTurmasInstrutor(req, res) {
  try {
    const usuarioId = req.user?.id ?? req.usuario?.id; // usa req.user por padrão
    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const sql = `
      SELECT 
        t.id, t.nome, t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
        e.id AS evento_id, e.titulo AS evento_nome, e.local AS evento_local
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio DESC NULLS LAST, t.id DESC
    `;
    const { rows } = await db.query(sql, [Number(usuarioId)]);

    const turmas = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      horario_inicio: r.horario_inicio,
      horario_fim: r.horario_fim,
      evento: { id: r.evento_id, nome: r.evento_nome, local: r.evento_local },
    }));

    return res.json(turmas);
  } catch (err) {
    console.error("❌ Erro ao buscar turmas do instrutor:", err.message);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

module.exports = {
  listarInstrutor,
  getEventosAvaliacoesPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,
};
