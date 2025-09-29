/* eslint-disable no-console */
// 📁 src/instrutorController.js
const db = require("../db");

/**
 * 🔢 Helper SQL seguro p/ coluna enum -> nota 1..5 (numeric)
 * - SEMPRE castea o enum para text antes de comparar/converter
 * - Aceita "1..5" (com vírgula/ponto), e textos comuns (ótimo, bom, etc.)
 */
const SQL_MAP_NOTA = `
  CASE
    WHEN a.desempenho_instrutor IS NULL THEN NULL
    /* números "1..5" (com opcional ,00 ou .00 e espaços) */
    WHEN trim(a.desempenho_instrutor::text) ~ '^[1-5](?:[\\.,]0+)?$'
      THEN REPLACE(trim(a.desempenho_instrutor::text), ',', '.')::numeric
    /* textos (lowercase simplificado) */
    WHEN lower(a.desempenho_instrutor::text) IN ('ótimo','otimo','excelente','muito bom') THEN 5
    WHEN lower(a.desempenho_instrutor::text) = 'bom' THEN 4
    WHEN lower(a.desempenho_instrutor::text) IN ('regular','médio','medio') THEN 3
    WHEN lower(a.desempenho_instrutor::text) = 'ruim' THEN 2
    WHEN lower(a.desempenho_instrutor::text) IN ('péssimo','pessimo','muito ruim') THEN 1
    ELSE NULL
  END
`;

/**
 * 📋 Lista instrutores com médias/contadores
 * - NÃO usa mais a.palestrante_id/instrutor_id nas avaliações.
 * - Liga por evento_instrutor → turmas → avaliacoes (a.turma_id).
 */
async function listarInstrutor(req, res) {
  try {
    const sql = `
      WITH av_por_instrutor AS (
        SELECT
          ei.instrutor_id,
          ${SQL_MAP_NOTA} AS nota
        FROM evento_instrutor ei
        JOIN turmas t          ON t.evento_id = ei.evento_id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
      )
      SELECT 
        u.id, 
        u.nome, 
        u.email,

        /* Eventos distintos ministrados */
        (
          SELECT COUNT(DISTINCT ei.evento_id)
          FROM evento_instrutor ei
          WHERE ei.instrutor_id = u.id
        ) AS "eventosMinistrados",

        /* Turmas ligadas a esses eventos (informativo) */
        (
          SELECT COUNT(*)
          FROM evento_instrutor ei2
          JOIN turmas t2 ON t2.evento_id = ei2.evento_id
          WHERE ei2.instrutor_id = u.id
        ) AS "turmasVinculadas",

        /* Total de respostas com nota válida */
        (
          SELECT COUNT(av.nota)
          FROM av_por_instrutor av
          WHERE av.instrutor_id = u.id
            AND av.nota IS NOT NULL
        ) AS "totalRespostas",

        /* Média geral 1..5 (2 casas) */
        ROUND((
          SELECT AVG(av.nota)
          FROM av_por_instrutor av
          WHERE av.instrutor_id = u.id
        )::numeric, 2) AS media_avaliacao,

        /* Possui assinatura? */
        CASE WHEN s.imagem_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS "possuiAssinatura"

      FROM usuarios u
      LEFT JOIN assinaturas s ON s.usuario_id = u.id
      WHERE string_to_array(u.perfil, ',') && ARRAY['instrutor','administrador']
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
 * 📊 Eventos ministrados por instrutor (período, média e total de respostas)
 * @route GET /api/instrutor/:id/eventos-avaliacoes
 */
async function getEventosAvaliacoesPorInstrutor(req, res) {
  const { id } = req.params;
  try {
    const sql = `
      WITH respostas AS (
        SELECT
          e.id AS evento_id,
          ${SQL_MAP_NOTA} AS nota
        FROM evento_instrutor ei
        JOIN eventos e         ON e.id = ei.evento_id
        JOIN turmas  t         ON t.evento_id = e.id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
        WHERE ei.instrutor_id = $1
      )
      SELECT 
        e.id AS evento_id,
        e.titulo AS evento,
        MIN(t.data_inicio) AS data_inicio,
        MAX(t.data_fim)    AS data_fim,
        ROUND(AVG(r.nota)::numeric, 1) AS nota_media,
        COUNT(r.nota) AS total_respostas
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas  t ON t.evento_id = e.id
      LEFT JOIN respostas r ON r.evento_id = e.id
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
 * 📚 Turmas vinculadas ao instrutor (com dados do evento)
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
    const usuarioId = req.user?.id ?? req.usuario?.id;
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
