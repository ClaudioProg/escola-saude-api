const db = require('../db');

// Função utilitária para converter enum nota em número
function notaEnumParaNumero(valor) {
  switch ((valor || "").toLowerCase()) {
    case "ótimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "péssimo": return 1;
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
    comentarios_finais
  } = req.body;
  const usuario_id = req.usuario.id;

  // Validação básica
  if (
    !evento_id || !turma_id || !desempenho_instrutor ||
    !divulgacao_evento // ... pode fazer para todos se quiser
  ) {
    return res.status(400).json({ erro: "Campos obrigatórios faltando." });
  }

  try {
    // Verifica se o usuário participou da turma
    const participou = await db.query(
      `SELECT 1 FROM presencas WHERE usuario_id = $1 AND turma_id = $2`,
      [usuario_id, turma_id]
    );
    if (participou.rowCount === 0) {
      return res.status(403).json({ erro: 'Você não participou desta turma' });
    }

    // Verifica se já avaliou
    const existente = await db.query(
      'SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2',
      [usuario_id, turma_id]
    );
    if (existente.rowCount > 0) {
      return res.status(400).json({ erro: 'Você já avaliou esta turma' });
    }

    // Insere a avaliação (todos os campos, menos id/data)
    const result = await db.query(
      `INSERT INTO avaliacoes (
        usuario_id, turma_id, desempenho_instrutor, divulgacao_evento, recepcao, credenciamento, 
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas, estrutura_local, acessibilidade,
        limpeza, inscricao_online, exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        comentarios_finais, data_avaliacao
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW()
      ) RETURNING *`,
      [
        usuario_id, turma_id, desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas, estrutura_local, acessibilidade,
        limpeza, inscricao_online, exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        comentarios_finais
      ]
    );

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
 * 📊 Avaliações de uma turma – Painel do instrutor
 * @route GET /api/avaliacoes/turma/:turma_id
 */
const NOTAS_EVENTO = [
  'divulgacao_evento',
  'recepcao',
  'credenciamento',
  'material_apoio',
  'pontualidade',
  'sinalizacao_local',
  'conteudo_temas',
  'estrutura_local',
  'acessibilidade',
  'limpeza',
  'inscricao_online',
  'exposicao_trabalhos',
  'apresentacao_oral_mostra',
  'apresentacao_tcrs',
  'oficinas'
];

async function avaliacoesPorTurma(req, res) {
  const { turma_id } = req.params;

  if (!turma_id || isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: 'ID de turma inválido' });
  }

  try {
    const result = await db.query(
      `SELECT u.nome,
        a.desempenho_instrutor,
        a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade, a.sinalizacao_local,
        a.conteudo_temas, a.estrutura_local, a.acessibilidade, a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
        a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
        a.comentarios_finais as comentario
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1`,
      [Number(turma_id)]
    );

    const avaliacoes = result.rows;

    // Corrigido: converte enum para número ANTES de calcular
    const notasinstrutor = avaliacoes
      .map(a => notaEnumParaNumero(a.desempenho_instrutor))
      .filter(v => v != null);
    const media_instrutor = notasinstrutor.length
      ? (notasinstrutor.reduce((acc, v) => acc + v, 0) / notasinstrutor.length).toFixed(1)
      : null;

    // Calcula média do evento (todas as outras colunas do tipo nota_enum)
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

    // Comentários
    const comentarios = avaliacoes
      .filter(a => a.comentario && a.comentario.trim())
      .map(a => ({ nome: a.nome, comentario: a.comentario }));

    res.json({
      turma_id: Number(turma_id),
      media_evento,
      media_instrutor,
      comentarios
    });
  } catch (err) {
    console.error('❌ Erro ao buscar avaliações da turma:', err);
    res.status(500).json({ erro: 'Erro ao buscar avaliações da turma' });
  }
}

/**
 * 📈 Avaliações de um evento – Painel do administradoristrador
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
        a.comentarios_finais as comentario
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.usuario_id
      JOIN turmas t ON t.id = a.turma_id
      WHERE t.evento_id = $1`,
      [Number(evento_id)]
    );

    const avaliacoes = result.rows;

    // Mesma lógica que acima
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

    // Comentários
    const comentarios = avaliacoes
      .filter(a => a.comentario && a.comentario.trim())
      .map(a => ({ nome: a.nome, comentario: a.comentario }));

    res.json({
      evento_id: Number(evento_id),
      media_evento,
      media_instrutor,
      comentarios
    });
  } catch (err) {
    console.error('❌ Erro ao buscar avaliações do evento:', err);
    res.status(500).json({ erro: 'Erro ao buscar avaliações do evento' });
  }
}

module.exports = {
  enviarAvaliacao,
  avaliacoesPorTurma,
  avaliacoesPorEvento,
};
