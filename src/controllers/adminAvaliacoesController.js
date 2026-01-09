// ✅ src/controllers/adminAvaliacoesController.js
/* eslint-disable no-console */
const dbFallback = require("../db");

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

// ✅ Media oficial (conforme sua regra): NÃO inclui desempenho_instrutor, e ignora campos extras
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

function getDb(req) {
  return req?.db ?? dbFallback;
}

/* =========================
   Helpers (premium)
========================= */
// Converte respostas textuais/numéricas em nota 1..5
function toScore(v) {
  if (v == null) return null;
  const s0 = String(v).trim();
  if (!s0) return null;

  const s = s0.toLowerCase();
  const num = Number(s.replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;

  const map = {
    "ótimo": 5,
    otimo: 5,
    excelente: 5,
    "muito bom": 5,
    bom: 4,
    regular: 3,
    "médio": 3,
    medio: 3,
    ruim: 2,
    "péssimo": 1,
    pessimo: 1,
    "muito ruim": 1,
  };
  return map[s] ?? null;
}

// média ponderada a partir de distribuição (evita arrays gigantes)
function mediaFromDist(distLinha) {
  const n1 = distLinha["1"] || 0;
  const n2 = distLinha["2"] || 0;
  const n3 = distLinha["3"] || 0;
  const n4 = distLinha["4"] || 0;
  const n5 = distLinha["5"] || 0;
  const total = n1 + n2 + n3 + n4 + n5;
  if (!total) return null;
  const soma = 1 * n1 + 2 * n2 + 3 * n3 + 4 * n4 + 5 * n5;
  return Number((soma / total).toFixed(2));
}

function pickText(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  // se algum dia virar JSON/texto estruturado:
  if (typeof v === "object") {
    const t = v.texto ?? v.comentario ?? v.value ?? null;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

function safeIntParam(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* =========================
   GET /api/admin/avaliacoes/eventos
   Lista eventos que possuem turmas e ao menos 1 avaliação registrada (somatório nas turmas).
========================= */
exports.listarEventosComAvaliacoes = async (req, res) => {
  try {
    const db = getDb(req);

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

    const { rows } = await db.query(sql, []);
    return res.json(rows || []);
  } catch (err) {
    console.error("[adminAvaliacoes] listarEventosComAvaliacoes:", err?.message || err);
    return res.status(500).json({ error: "Erro ao listar eventos com avaliações." });
  }
};

/* =========================
   GET /api/admin/avaliacoes/evento/:evento_id
   Retorna:
    - respostas: flatten com (__turmaId, __turmaNome, usuario_id, usuario_nome, campos objetivos/textos, criado_em)
    - agregados: { total, dist, medias, textos, mediaOficial }
    - turmas: [{id, nome, total_respostas}]
========================= */
exports.obterAvaliacoesDoEvento = async (req, res) => {
  const eventoId = safeIntParam(req.params.evento_id);
  if (!eventoId) return res.status(400).json({ error: "evento_id inválido" });

  try {
    const db = getDb(req);

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
    const { rows: turmas } = await db.query(turmasSql, [eventoId]);

    // 2) Respostas (todas as turmas do evento)
    const respostasSql = `
      SELECT 
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE t.evento_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC;
    `;
    const { rows: respostasRaw } = await db.query(respostasSql, [eventoId]);

    const respostas = (respostasRaw || []).map((r) => ({
      ...r,
      __turmaId: r.turma_id,
      __turmaNome: r.turma_nome,
    }));

    // 3) Agregação premium (sem explode de memória)
    const dist = {};
    const medias = {};

    for (const c of CAMPOS_OBJETIVOS) dist[c] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

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
      medias[campo] = mediaFromDist(dist[campo]);
    }

    const textos = {};
    for (const c of CAMPOS_TEXTOS) {
      textos[c] = respostas.map((r) => pickText(r[c])).filter(Boolean);
    }

    // médiaOficial = média simples das médias oficiais (mantém seu comportamento)
    const mediasOficiais = CAMPOS_MEDIA_OFICIAL.map((c) => medias[c]).filter((x) => Number.isFinite(x));
    const mediaOficial =
      mediasOficiais.length > 0
        ? Number((mediasOficiais.reduce((a, b) => a + b, 0) / mediasOficiais.length).toFixed(2))
        : null;

    return res.json({
      respostas,
      agregados: {
        total: respostas.length,
        dist,
        medias,
        textos,
        mediaOficial,
      },
      turmas: turmas || [],
    });
  } catch (err) {
    console.error("[adminAvaliacoes] obterAvaliacoesDoEvento:", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter avaliações do evento." });
  }
};

/* =========================
   GET /api/admin/avaliacoes/turma/:turma_id
   Lista respostas de uma turma específica (útil para deep-link ou auditoria).
   (Mantém compat: retorna array puro)
========================= */
exports.obterAvaliacoesDaTurma = async (req, res) => {
  const turmaId = safeIntParam(req.params.turma_id);
  if (!turmaId) return res.status(400).json({ error: "turma_id inválido" });

  try {
    const db = getDb(req);

    const sql = `
      SELECT 
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC;
    `;

    const { rows } = await db.query(sql, [turmaId]);
    return res.json(rows || []);
  } catch (err) {
    console.error("[adminAvaliacoes] obterAvaliacoesDaTurma:", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter avaliações da turma." });
  }
};
