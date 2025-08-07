const db = require('../db');
const { gerarNotificacoesDeCertificado } = require('./notificacoesController');

// Função utilitária para converter enum nota em número
function notaEnumParaNumero(valor) {
  switch ((valor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    case "otimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "pessimo": return 1;
    default: return null;
  }
}

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
    comentarios_finais
  } = req.body;
  const usuario_id = req.usuario.id;

  const obrigatorios = [
    'desempenho_instrutor', 'divulgacao_evento', 'recepcao', 'credenciamento',
    'material_apoio', 'pontualidade', 'sinalizacao_local', 'conteudo_temas',
    'estrutura_local', 'acessibilidade', 'limpeza', 'inscricao_online'
  ];
  
  for (const campo of obrigatorios) {
    if (!req.body[campo]) {
      return res.status(400).json({ erro: `Campo obrigatório '${campo}' faltando.` });
    }
  }
  
   try {
    const participou = await db.query(
      `SELECT 1 FROM presencas WHERE usuario_id = $1 AND turma_id = $2`,
      [usuario_id, turma_id]
    );
    if (participou.rowCount === 0) {
      return res.status(403).json({ erro: 'Você não participou desta turma' });
    }

    const existente = await db.query(
      'SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2',
      [usuario_id, turma_id]
    );
    if (existente.rowCount > 0) {
      return res.status(400).json({ erro: 'Você já avaliou esta turma' });
    }

    const result = await db.query(
      `INSERT INTO avaliacoes (
        usuario_id, turma_id, desempenho_instrutor, divulgacao_evento, recepcao, credenciamento, 
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas, estrutura_local, acessibilidade,
        limpeza, inscricao_online, exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        gostou_mais, sugestoes_melhoria, comentarios_finais, data_avaliacao
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, NOW()
      ) RETURNING *`,
      [
        usuario_id, turma_id, desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas, estrutura_local, acessibilidade,
        limpeza, inscricao_online, exposicao_trabalhos || null, apresentacao_oral_mostra || null,
        apresentacao_tcrs || null, oficinas || null, gostou_mais || null, sugestoes_melhoria || null,
        comentarios_finais || null
      ]
    );

// 🔔 Tenta gerar certificado + notificação (se elegível), sem quebrar o fluxo
try {
  await gerarNotificacoesDeCertificado(usuario_id);
} catch (e) {
  console.warn("⚠️ Erro ao gerar certificado (ignorado):", e.message);
}

// ✅ Retorna resposta ao frontend
res.status(201).json({
  mensagem: 'Avaliação registrada com sucesso.',
  avaliacao: result.rows[0]
});
  } catch (err) {
    console.error('❌ Erro ao registrar avaliação:', err);
    res.status(500).json({ erro: 'Erro ao registrar avaliação' });
  }
}

/**
 * 📋 Lista avaliações pendentes do usuário
 * @route GET /api/avaliacoes/disponiveis/:usuario_id
 */
async function listarAvaliacoesDisponiveis(req, res) {
  const { usuario_id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        e.id AS evento_id,
        e.titulo AS nome_evento,
        t.id AS turma_id,
        t.data_inicio,
        t.data_fim,
        t.horario_fim
      FROM inscricoes i
      INNER JOIN turmas t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN avaliacoes a 
        ON a.usuario_id = i.usuario_id AND a.turma_id = t.id
      WHERE i.usuario_id = $1
        AND EXISTS (
          SELECT 1 FROM presencas p
          WHERE p.usuario_id = i.usuario_id AND p.turma_id = i.turma_id
        )
        AND a.id IS NULL
        AND (
          t.data_fim < CURRENT_DATE
          OR (t.data_fim = CURRENT_DATE AND t.horario_fim < CURRENT_TIME)
        )
      ORDER BY t.data_fim DESC
    `, [usuario_id]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar avaliações disponíveis:', err);
    res.status(500).json({ erro: 'Erro ao buscar avaliações disponíveis' });
  }
}

/**
 * 📊 Avaliações de uma turma – Painel do instrutor
 * @route GET /api/avaliacoes/turma/:turma_id
 */
const NOTAS_EVENTO = [
  'divulgacao_evento', 'recepcao', 'credenciamento', 'material_apoio', 'pontualidade',
  'sinalizacao_local', 'conteudo_temas', 'estrutura_local', 'acessibilidade', 'limpeza',
  'inscricao_online'
];

async function avaliacoesPorTurma(req, res) {
  const { turma_id } = req.params;

  if (!turma_id || isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: 'ID de turma inválido' });
  }

  try {
    // 📊 Avaliações
    const result = await db.query(
      `SELECT u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade, a.sinalizacao_local,
        a.conteudo_temas, a.estrutura_local, a.acessibilidade, a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
        a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
        a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1`,
      [Number(turma_id)]
    );

    const avaliacoes = result.rows;

    const NOTAS_EVENTO = [
      'divulgacao_evento', 'recepcao', 'credenciamento', 'material_apoio', 'pontualidade',
      'sinalizacao_local', 'conteudo_temas', 'estrutura_local', 'acessibilidade', 'limpeza',
      'inscricao_online'
    ];

    const notaEnumParaNumero = (valor) => {
      switch ((valor || "").toLowerCase()) {
        case "otimo": return 5;
        case "bom": return 4;
        case "regular": return 3;
        case "ruim": return 2;
        case "pessimo": return 1;
        default: return null;
      }
    };

    function getNotaEvento(a) {
      let soma = 0, qtd = 0;
      NOTAS_EVENTO.forEach(campo => {
        const v = notaEnumParaNumero(a[campo]);
        if (v != null) {
          soma += v;
          qtd++;
        }
      });
      return qtd ? soma / qtd : null;
    }

    const notasEvento = avaliacoes.map(getNotaEvento).filter(v => v != null);
    const media_evento = notasEvento.length
      ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
      : null;

    const comentarios = avaliacoes
      .filter(a =>
        (a.desempenho_instrutor && a.desempenho_instrutor.trim()) ||
        (a.gostou_mais && a.gostou_mais.trim()) ||
        (a.sugestoes_melhoria && a.sugestoes_melhoria.trim()) ||
        (a.comentarios_finais && a.comentarios_finais.trim())
      )
      .map(a => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais
      }));

    // ✅ Novos dados: inscritos e presença
    const inscritosRes = await db.query(
      `SELECT COUNT(*) FROM inscricoes WHERE turma_id = $1`,
      [turma_id]
    );
    const total_inscritos = parseInt(inscritosRes.rows[0].count, 10);

    // 📆 Buscar intervalo de datas da turma
const turmaRes = await db.query(
  `SELECT data_inicio, data_fim FROM turmas WHERE id = $1`,
  [turma_id]
);
if (turmaRes.rowCount === 0) {
  return res.status(404).json({ erro: 'Turma não encontrada' });
}
const { data_inicio, data_fim } = turmaRes.rows[0];

// Gera as datas entre início e fim
function gerarIntervaloDeDatas(inicio, fim) {
  const datas = [];
  let atual = new Date(inicio);
  const fimDate = new Date(fim);
  while (atual <= fimDate) {
    datas.push(atual.toISOString().split("T")[0]);
    atual.setDate(atual.getDate() + 1);
  }
  return datas;
}
const datasTurma = gerarIntervaloDeDatas(data_inicio, data_fim);
const totalDias = datasTurma.length;

// 📊 Presenças da turma
const presencasRes = await db.query(
  `SELECT usuario_id, data_presenca FROM presencas WHERE turma_id = $1`,
  [turma_id]
);

// Agrupa por usuário e contabiliza
const mapaPresencas = {};
presencasRes.rows.forEach(({ usuario_id, data_presenca }) => {
  const dataStr = data_presenca.toISOString().split("T")[0];
  if (!mapaPresencas[usuario_id]) mapaPresencas[usuario_id] = new Set();
  mapaPresencas[usuario_id].add(dataStr);
});

let total_presentes = 0;
for (const usuario_id in mapaPresencas) {
  const qtdPresencas = mapaPresencas[usuario_id].size;
  const frequencia = totalDias > 0 ? (qtdPresencas / totalDias) * 100 : 0;
  if (frequencia >= 75) total_presentes++;
}


    const presenca_media = total_inscritos > 0
      ? ((total_presentes / total_inscritos) * 100).toFixed(0)
      : '0';

    res.json({
      turma_id: Number(turma_id),
      total_inscritos,
      total_presentes,
      presenca_media: Number(presenca_media),
      total_avaliacoes: avaliacoes.length,
      media_evento,
      comentarios,
      avaliacoes
    });
  } catch (err) {
    console.error('❌ Erro ao buscar avaliações da turma:', err);
    res.status(500).json({ erro: 'Erro ao buscar avaliações da turma' });
  }
}


/**
 * 📈 Avaliações de um evento – Painel do administrador
 * @route GET /api/avaliacoes/evento/:evento_id
 */
async function avaliacoesPorEvento(req, res) {
  const { evento_id } = req.params;

  try {
    const result = await db.query(
      `SELECT u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade, a.sinalizacao_local,
        a.conteudo_temas, a.estrutura_local, a.acessibilidade, a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
        a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
        a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais, a.desempenho_instrutor
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      JOIN turmas t ON t.id = a.turma_id
      WHERE t.evento_id = $1`,
      [Number(evento_id)]
    );

    const avaliacoes = result.rows;

    const notasinstrutor = avaliacoes
      .map(a => notaEnumParaNumero(a.desempenho_instrutor))
      .filter(v => v != null);
    const media_instrutor = notasinstrutor.length
      ? (notasinstrutor.reduce((acc, v) => acc + v, 0) / notasinstrutor.length).toFixed(1)
      : null;

    function getNotaEvento(a) {
      let soma = 0, qtd = 0;
      NOTAS_EVENTO.forEach(campo => {
        const v = notaEnumParaNumero(a[campo]);
        if (v != null) {
          soma += v;
          qtd++;
        }
      });
      return qtd ? soma / qtd : null;
    }

    const notasEvento = avaliacoes.map(getNotaEvento).filter(v => v != null);
    const media_evento = notasEvento.length
      ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
      : null;

      const comentarios = avaliacoes
      .filter(a =>
        (a.desempenho_instrutor && a.desempenho_instrutor.trim()) ||
        (a.gostou_mais && a.gostou_mais.trim()) ||
        (a.sugestoes_melhoria && a.sugestoes_melhoria.trim()) ||
        (a.comentarios_finais && a.comentarios_finais.trim())
      )
      .map(a => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais
      }));

    res.json({ evento_id: Number(evento_id), media_evento, media_instrutor, comentarios });
  } catch (err) {
    console.error('❌ Erro ao buscar avaliações do evento:', err);
    res.status(500).json({ erro: 'Erro ao buscar avaliações do evento' });
  }
}

module.exports = {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  avaliacoesPorTurma,
  avaliacoesPorEvento,
};
