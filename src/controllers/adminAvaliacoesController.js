// ✅ src/controllers/adminAvaliacoesController.js
/* eslint-disable no-console */
const { query } = require("../db");

// Campos padronizados
const CAMPOS_OBJETIVOS = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "desempenho_instrutor",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];
const CAMPOS_TEXTOS = ["gostou_mais", "sugestoes_melhoria", "comentarios_finais"];
const CAMPOS_MEDIA_OFICIAL = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

// Converte respostas textuais em nota 1..5 (para agregação no Node)
function toScore(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  const num = Number(s.replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;
  const map = {
    "ótimo": 5, otimo: 5, excelente: 5, "muito bom": 5,
    bom: 4,
    regular: 3, médio: 3, medio: 3,
    ruim: 2,
    "péssimo": 1, pessimo: 1, "muito ruim": 1,
  };
  if (map[s] != null) return map[s];
  return null;
}
function media(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Number(m.toFixed(2));
}

/**
 * GET /api/admin/avaliacoes/eventos
 * Lista eventos que possuem turmas e ao menos 1 avaliação registrada (somatório nas turmas).
 */
exports.listarEventosComAvaliacoes = async (_req, res) => {
  try {
    const sql = `
      WITH turmas_com_count AS (
        SELECT t.id, t.evento_id, t.nome,
               COUNT(a.id) AS total_respostas,
               MIN(t.data_inicio) AS di, MAX(t.data_fim) AS df
          FROM turmas t
          LEFT JOIN avaliacoes a ON a.turma_id = t.id
         GROUP BY t.id
      ),
      eventos_agreg AS (
        SELECT e.id,
               e.titulo AS titulo,
               MIN(t.di) AS di,
               MAX(t.df) AS df,
               SUM(t.total_respostas)::int AS total_respostas
          FROM eventos e
          JOIN turmas_com_count t ON t.evento_id = e.id
         GROUP BY e.id, e.titulo
      )
      SELECT *
        FROM eventos_agreg
       WHERE total_respostas > 0
       ORDER BY di DESC NULLS LAST, id DESC;
    `;
    const { rows } = await query(sql, []);
    res.json(rows || []);
  } catch (err) {
    console.error("listarEventosComAvaliacoes:", err);
    res.status(500).json({ error: "Erro ao listar eventos com avaliações." });
  }
};

/**
 * GET /api/admin/avaliacoes/evento/:evento_id
 * Retorna:
 *  - respostas: lista flatten com (__turmaId, __turmaNome, usuario_id, usuario_nome, campos objetivos/textos, criado_em)
 *  - agregados: { total, medias por campo, dist por campo, textos, mediaOficial }
 *  - turmas: [{id, nome, total_respostas}]
 */
exports.obterAvaliacoesDoEvento = async (req, res) => {
  const eventoId = Number(req.params.evento_id);
  if (!Number.isFinite(eventoId)) return res.status(400).json({ error: "evento_id inválido" });

  try {
    // 1) Turmas do evento + contagem
    const turmasSql = `
      SELECT t.id, t.nome,
             COUNT(a.id)::int AS total_respostas
        FROM turmas t
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
       WHERE t.evento_id = $1
       GROUP BY t.id, t.nome
       ORDER BY t.id;
    `;
    const { rows: turmas } = await query(turmasSql, [eventoId]);

    // 2) Respostas (todas as turmas do evento)
    const respostasSql = `
    SELECT 
      a.id,
      a.turma_id,
      t.nome AS turma_nome,
      a.usuario_id,
      u.nome AS usuario_nome,
      a.data_avaliacao AS criado_em,

      -- Campos objetivos...
        ${CAMPOS_OBJETIVOS.map((c) => `COALESCE(a.${c}, NULL) AS ${c}`).join(", ")},

        -- Textos
        ${CAMPOS_TEXTOS.map((c) => `COALESCE(a.${c}, NULL) AS ${c}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE t.evento_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC;
    `;
    const { rows: respostasRaw } = await query(respostasSql, [eventoId]);

    const respostas = (respostasRaw || []).map((r) => ({
      ...r,
      __turmaId: r.turma_id,
      __turmaNome: r.turma_nome,
    }));

    // 3) Agregação no Node (robusto a campos textuais/numéricos)
    const dist = {};
    const medias = {};
    CAMPOS_OBJETIVOS.forEach((c) => (dist[c] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }));

    for (const r of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const s = toScore(r[campo]);
        if (s != null) {
          const k = String(Math.round(s));
          dist[campo][k] = (dist[campo][k] || 0) + 1;
        }
      }
    }
    for (const campo of CAMPOS_OBJETIVOS) {
      const linha = dist[campo];
      const expanded = [
        ...Array(linha[1]).fill(1),
        ...Array(linha[2]).fill(2),
        ...Array(linha[3]).fill(3),
        ...Array(linha[4]).fill(4),
        ...Array(linha[5]).fill(5),
      ];
      medias[campo] = media(expanded);
    }

    const textos = {};
    for (const c of CAMPOS_TEXTOS) {
      textos[c] = respostas
        .map((r) => (r[c] ?? r[c]?.texto ?? r[c]?.comentario))
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
    }

    const arrOficial = CAMPOS_MEDIA_OFICIAL.map((c) => medias[c]).filter((x) => Number.isFinite(x));
    const mediaOficial = media(arrOficial);

    res.json({
      respostas,
      agregados: {
        total: respostas.length,
        dist,
        medias,
        textos,
        mediaOficial,
      },
      turmas,
    });
  } catch (err) {
    console.error("obterAvaliacoesDoEvento:", err);
    res.status(500).json({ error: "Erro ao obter avaliações do evento." });
  }
};

/**
 * GET /api/admin/avaliacoes/turma/:turma_id
 * Lista respostas de uma turma específica (útil para deep-link ou auditoria).
 */
exports.obterAvaliacoesDaTurma = async (req, res) => {
  const turmaId = Number(req.params.turma_id);
  if (!Number.isFinite(turmaId)) return res.status(400).json({ error: "turma_id inválido" });

  try {
    const sql = `
    SELECT 
      a.id,
      a.turma_id,
      t.nome AS turma_nome,
      a.usuario_id,
      u.nome AS usuario_nome,
      a.data_avaliacao AS criado_em,
      ${CAMPOS_OBJETIVOS.map((c) => `COALESCE(a.${c}, NULL) AS ${c}`).join(", ")},
      ${CAMPOS_TEXTOS.map((c) => `COALESCE(a.${c}, NULL) AS ${c}`).join(", ")}
    FROM avaliacoes a
    JOIN turmas t ON t.id = a.turma_id
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.turma_id = $1
    ORDER BY a.data_avaliacao DESC, a.id DESC;
  `;
    const { rows } = await query(sql, [turmaId]);
    res.json(rows || []);
  } catch (err) {
    console.error("obterAvaliacoesDaTurma:", err);
    res.status(500).json({ error: "Erro ao obter avaliações da turma." });
  }
};
