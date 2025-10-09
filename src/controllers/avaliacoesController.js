// 📁 src/controllers/avaliacoesController.js
/* eslint-disable no-console */
const db = require("../db");
const { gerarNotificacoesDeCertificado } = require("./notificacoesController");

// ---------------------------- Utils ----------------------------

// Converte enum/valor textual para número (5..1)
function notaEnumParaNumero(valor) {
  if (valor == null) return null;
  const raw = String(valor).trim();

  // se já veio número (ou texto "1".."5")
  const n = Number(raw.replace(",", "."));
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;

  // normaliza para comparar textos
  const v = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

  switch (v) {
    case "otimo":
    case "excelente":
    case "muito bom":
      return 5;
    case "bom":
      return 4;
    case "regular":
    case "medio":
    case "médio":
      return 3;
    case "ruim":
      return 2;
    case "pessimo":
    case "péssimo":
    case "muito ruim":
      return 1;
    default:
      return null;
  }
}

// Formata Date/string para "YYYY-MM-DD" SEM UTC/ISO (evita voltar 1 dia)
function toYMDLocal(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Gera intervalo de dias inclusivo entre duas datas (Date/string) em "YYYY-MM-DD"
function gerarIntervaloYMD(inicioLike, fimLike) {
  const ini = inicioLike instanceof Date ? new Date(inicioLike) : new Date(inicioLike);
  const fim = fimLike instanceof Date ? new Date(fimLike) : new Date(fimLike);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return [];

  ini.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  const out = [];
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    out.push(toYMDLocal(d));
  }
  return out;
}

// Campos de “notas de evento” (exclui desempenho do instrutor)
const NOTAS_EVENTO = [
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

// Média das notas de evento para uma avaliação
function mediaNotasEventoDe(aval) {
  let soma = 0;
  let n = 0;
  for (const campo of NOTAS_EVENTO) {
    const v = notaEnumParaNumero(aval[campo]);
    if (v != null) {
      soma += v;
      n++;
    }
  }
  return n ? soma / n : null;
}

// ---------------------------- Handlers ----------------------------

/**
 * ✅ Envia avaliação de um evento
 * @route POST /api/avaliacoes
 */
async function enviarAvaliacao(req, res) {
  const {
    evento_id,
    turma_id,
    desempenho_instrutor,
    divulgacao_evento,
    recepcao,
    credenciamento,
    material_apoio,
    pontualidade,
    sinalizacao_local,
    conteudo_temas,
    estrutura_local,
    acessibilidade,
    limpeza,
    inscricao_online,
    exposicao_trabalhos,
    apresentacao_oral_mostra,
    apresentacao_tcrs,
    oficinas,
    gostou_mais,
    sugestoes_melhoria,
    comentarios_finais,
  } = req.body;

  const usuario_id = req.user?.id ?? req.usuario?.id;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Não autenticado." });
  }
  if (!turma_id || Number.isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: "turma_id inválido." });
  }
  if (evento_id && Number.isNaN(Number(evento_id))) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }

  const obrigatorios = [
    "desempenho_instrutor",
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

  for (const campo of obrigatorios) {
    if (!req.body[campo]) {
      return res.status(400).json({ erro: `Campo obrigatório '${campo}' faltando.` });
    }
  }

  try {
    // Verifica se participou (tem presença em qualquer dia da turma)
    const participou = await db.query(
      `SELECT 1
         FROM presencas
        WHERE usuario_id = $1
          AND turma_id   = $2
        LIMIT 1`,
      [usuario_id, Number(turma_id)]
    );
    if (participou.rowCount === 0) {
      return res.status(403).json({ erro: "Você não participou desta turma." });
    }

    // Evita duplicidade
    const existente = await db.query(
      `SELECT 1
         FROM avaliacoes
        WHERE usuario_id = $1
          AND turma_id   = $2
        LIMIT 1`,
      [usuario_id, Number(turma_id)]
    );
    if (existente.rowCount > 0) {
      return res.status(400).json({ erro: "Você já avaliou esta turma." });
    }

    // Persiste avaliação
    const insertRes = await db.query(
      `INSERT INTO avaliacoes (
        usuario_id, turma_id,
        desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas, estrutura_local, acessibilidade,
        limpeza, inscricao_online, exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        gostou_mais, sugestoes_melhoria, comentarios_finais, data_avaliacao
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, NOW()
      )
      RETURNING *`,
      [
        usuario_id,
        Number(turma_id),
        desempenho_instrutor,
        divulgacao_evento,
        recepcao,
        credenciamento,
        material_apoio,
        pontualidade,
        sinalizacao_local,
        conteudo_temas,
        estrutura_local,
        acessibilidade,
        limpeza,
        inscricao_online,
        exposicao_trabalhos || null,
        apresentacao_oral_mostra || null,
        apresentacao_tcrs || null,
        oficinas || null,
        gostou_mais || null,
        sugestoes_melhoria || null,
        comentarios_finais || null,
      ]
    );

    const avaliacao = insertRes.rows[0];
    console.log("[avaliacoes] avaliação registrada", {
      avaliacao_id: avaliacao?.id,
      usuario_id,
      turma_id: Number(turma_id),
    });

    // 🔔 Gera notificação/certificado se elegível (best-effort, focado na turma)
    try {
      // Recomendado: assinatura (usuario_id, turma_id)
      await gerarNotificacoesDeCertificado(usuario_id, Number(turma_id));
    } catch (e) {
      console.warn("⚠️ Erro ao agendar/gerar certificado:", e?.stack || e?.message || e);
    }

    return res.status(201).json({
      mensagem: "Avaliação registrada com sucesso. Se elegível, seu certificado será liberado.",
      avaliacao,
    });
  } catch (err) {
    console.error("❌ Erro ao registrar avaliação:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao registrar avaliação." });
  }
}

/**
 * 📋 Lista avaliações pendentes do usuário
 * @route GET /api/avaliacoes/disponiveis/:usuario_id
 */
async function listarAvaliacoesDisponiveis(req, res) {
  const { usuario_id } = req.params;

  if (!usuario_id || Number.isNaN(Number(usuario_id))) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  try {
    const result = await db.query(
      `
      SELECT 
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id,
        t.data_inicio,
        t.data_fim,
        t.horario_fim
      FROM inscricoes i
      INNER JOIN turmas  t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      LEFT  JOIN avaliacoes a 
             ON a.usuario_id = i.usuario_id
            AND a.turma_id   = t.id
      WHERE i.usuario_id = $1
        -- participou (qualquer dia de presença)
        AND EXISTS (
          SELECT 1 FROM presencas p
           WHERE p.usuario_id = i.usuario_id
             AND p.turma_id   = i.turma_id
           LIMIT 1
        )
        -- ainda não avaliou
        AND a.id IS NULL
        -- turma finalizada (fim + horario_fim já passou)
        AND (
             t.data_fim < CURRENT_DATE
          OR (t.data_fim = CURRENT_DATE AND t.horario_fim < CURRENT_TIME)
        )
      ORDER BY t.data_fim DESC
      `,
      [Number(usuario_id)]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar avaliações disponíveis:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações disponíveis." });
  }
}

/**
 * 🧑‍🏫 Avaliações da turma **do instrutor logado** (para a página do instrutor)
 * @route GET /api/avaliacoes/turma/:turma_id
 */
async function listarPorTurmaParaInstrutor(req, res) {
  const user = req.user ?? req.usuario ?? {};
  const usuarioId = Number(user.id);
  const perfis = Array.isArray(user.perfil)
    ? user.perfil.map(String)
    : String(user.perfil || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const { turma_id } = req.params;

  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });
  if (!turma_id || Number.isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  try {
    const isAdmin = perfis.includes("administrador");

    // Só exige vínculo se NÃO for admin
    if (!isAdmin) {
      const chk = await db.query(
        `SELECT 1
           FROM turmas t
          WHERE t.id = $2
            AND EXISTS (
                  SELECT 1
                    FROM evento_instrutor ei
                   WHERE ei.evento_id = t.evento_id
                     AND ei.instrutor_id = $1
                 )
          LIMIT 1`,
        [usuarioId, Number(turma_id)]
      );
      if (chk.rowCount === 0) {
        return res.status(403).json({ erro: "Acesso negado à turma." });
      }
    }

    const { rows } = await db.query(
      `SELECT
         id,
         turma_id,
         usuario_id,
         desempenho_instrutor,
         divulgacao_evento, recepcao, credenciamento, material_apoio,
         pontualidade, sinalizacao_local, conteudo_temas,
         estrutura_local, acessibilidade, limpeza, inscricao_online,
         exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
         gostou_mais, sugestoes_melhoria, comentarios_finais,
         data_avaliacao
       FROM avaliacoes
      WHERE turma_id = $1
      ORDER BY id DESC`,
      [Number(turma_id)]
    );

    // headers de debug
    res.setHeader("X-Debug-User", String(usuarioId));
    res.setHeader("X-Debug-Perfis", perfis.join(","));
    res.setHeader("X-Debug-Avaliacoes-Count", String(rows.length));

    console.log(`[avaliacoes] turma=${turma_id} rows=${rows.length}`);

    return res.json(rows);
  } catch (err) {
    console.error("❌ listarPorTurmaParaInstrutor:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/**
 * 📊 Avaliações de uma turma – Painel do administrador (todas as respostas)
 * @route GET /api/avaliacoes/turma/:turma_id/all
 *
 * Mantido para uso administrativo/analítico (retorna objeto com agregados).
 */
async function avaliacoesPorTurma(req, res) {
  const { turma_id } = req.params;

  if (!turma_id || Number.isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  try {
    // 📊 Todas as avaliações da turma (sem filtro de instrutor)
    const result = await db.query(
      `SELECT u.nome,
              a.desempenho_instrutor,
              a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
              a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
              a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
              a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
              a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
         FROM avaliacoes a
         JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.turma_id = $1`,
      [Number(turma_id)]
    );

    const avaliacoes = result.rows;

    // ⭐ Médias
    const notasInstrutor = avaliacoes
      .map((a) => notaEnumParaNumero(a.desempenho_instrutor))
      .filter((v) => v != null);
    const media_instrutor =
      notasInstrutor.length
        ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
        : null;

    const notasEvento = avaliacoes
      .map((a) => mediaNotasEventoDe(a))
      .filter((v) => v != null);
    const media_evento =
      notasEvento.length
        ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
        : null;

    // 🗨️ Comentários
    const comentarios = avaliacoes
      .filter(
        (a) =>
          (a.desempenho_instrutor && a.desempenho_instrutor.trim()) ||
          (a.gostou_mais && a.gostou_mais.trim()) ||
          (a.sugestoes_melhoria && a.sugestoes_melhoria.trim()) ||
          (a.comentarios_finais && a.comentarios_finais.trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    // 👥 Total de inscritos
    const inscritosRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM inscricoes WHERE turma_id = $1`,
      [Number(turma_id)]
    );
    const total_inscritos = inscritosRes.rows[0]?.total ?? 0;

    // 🗓️ Datas da turma
    const turmaRes = await db.query(
      `SELECT data_inicio, data_fim FROM turmas WHERE id = $1`,
      [Number(turma_id)]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const { data_inicio, data_fim } = turmaRes.rows[0];
    const datasTurma = gerarIntervaloYMD(data_inicio, data_fim);
    const totalDias = datasTurma.length;

    // ✅ Presenças (datas em YMD local)
    const presencasRes = await db.query(
      `SELECT usuario_id, data_presenca
         FROM presencas
        WHERE turma_id = $1`,
      [Number(turma_id)]
    );

    const mapaPresencas = Object.create(null); // { usuario_id: Set<YMD> }
    for (const { usuario_id, data_presenca } of presencasRes.rows) {
      const ymd = toYMDLocal(data_presenca);
      if (!ymd) continue;
      if (!mapaPresencas[usuario_id]) mapaPresencas[usuario_id] = new Set();
      mapaPresencas[usuario_id].add(ymd);
    }

    // Presença “válida” (>= 75% dos dias)
    let total_presentes = 0;
    if (totalDias > 0) {
      for (const uid of Object.keys(mapaPresencas)) {
        const qtd = mapaPresencas[uid].size;
        const freq = (qtd / totalDias) * 100;
        if (freq >= 75) total_presentes++;
      }
    }

    const presenca_media =
      total_inscritos > 0 ? Math.round((total_presentes / total_inscritos) * 100) : 0;

    return res.json({
      turma_id: Number(turma_id),
      total_inscritos,
      total_presentes,
      presenca_media, // %
      total_avaliacoes: avaliacoes.length,
      media_evento,
      media_instrutor,
      comentarios,
      avaliacoes,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar avaliações da turma:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/**
 * 📈 Avaliações de um evento – Painel do administrador
 * @route GET /api/avaliacoes/evento/:evento_id
 */
async function avaliacoesPorEvento(req, res) {
  const { evento_id } = req.params;

  if (!evento_id || Number.isNaN(Number(evento_id))) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }

  try {
    const result = await db.query(
      `SELECT u.nome,
              a.desempenho_instrutor,
              a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
              a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
              a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
              a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
              a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
         FROM avaliacoes a
         JOIN usuarios u ON u.id = a.usuario_id
         JOIN turmas   t ON t.id = a.turma_id
        WHERE t.evento_id = $1`,
      [Number(evento_id)]
    );

    const avaliacoes = result.rows;

    const notasInstrutor = avaliacoes
      .map((a) => notaEnumParaNumero(a.desempenho_instrutor))
      .filter((v) => v != null);
    const media_instrutor =
      notasInstrutor.length
        ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
        : null;

    const notasEvento = avaliacoes
      .map((a) => mediaNotasEventoDe(a))
      .filter((v) => v != null);
    const media_evento =
      notasEvento.length
        ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
        : null;

    const comentarios = avaliacoes
      .filter(
        (a) =>
          (a.desempenho_instrutor && a.desempenho_instrutor.trim()) ||
          (a.gostou_mais && a.gostou_mais.trim()) ||
          (a.sugestoes_melhoria && a.sugestoes_melhoria.trim()) ||
          (a.comentarios_finais && a.comentarios_finais.trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    return res.json({
      evento_id: Number(evento_id),
      media_evento,
      media_instrutor,
      comentarios,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar avaliações do evento:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar avaliações do evento." });
  }
}

module.exports = {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  listarPorTurmaParaInstrutor, // ✅ para página do Instrutor
  avaliacoesPorTurma,          // (admin) todas as respostas da turma
  avaliacoesPorEvento,         // (admin) agregado por evento
};
