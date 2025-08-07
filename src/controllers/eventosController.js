const { pool, query } = require('../db');

// 📄 Listar todos os eventos com status e dados agregados
async function listarEventos(req, res) {
  try {
    const usuarioId = req.usuario?.id || null;
    const result = await query(`
      SELECT 
        e.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', u.id,
            'nome', u.nome
          )) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutor,
        (
          SELECT json_agg(json_build_object(
            'id', t.id,
            'nome', t.nome,
            'data_inicio', t.data_inicio,
            'data_fim', t.data_fim,
            'horario_inicio', t.horario_inicio,
            'horario_fim', t.horario_fim,
            'vagas_total', t.vagas_total,
            'carga_horaria', t.carga_horaria,
            'inscritos', (
              SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id
            )
          ))
          FROM turmas t
          WHERE t.evento_id = e.id
        ) AS turmas,
        (SELECT MIN(t.data_inicio) FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
        (SELECT MAX(t.data_fim) FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
        (SELECT MAX(t.horario_fim) FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
        (
  CASE
    WHEN CURRENT_TIMESTAMP < (
      SELECT MIN(t.data_inicio + t.horario_inicio)
      FROM turmas t
      WHERE t.evento_id = e.id
    ) THEN 'programado'
    
    WHEN CURRENT_TIMESTAMP BETWEEN
      (
        SELECT MIN(t.data_inicio + t.horario_inicio)
        FROM turmas t
        WHERE t.evento_id = e.id
      )
      AND
      (
        SELECT MAX(t.data_fim + t.horario_fim)
        FROM turmas t
        WHERE t.evento_id = e.id
      )
    THEN 'andamento'
    
    ELSE 'encerrado'
  END
) AS status,
        (
          SELECT COUNT(*) > 0
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
          WHERE i.usuario_id = $1 AND t.evento_id = e.id
        ) AS ja_inscrito
    
      FROM eventos e
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u ON u.id = ei.instrutor_id
      GROUP BY e.id
      ORDER BY 
        (SELECT MAX(t.data_fim) FROM turmas t WHERE t.evento_id = e.id) DESC,
        (SELECT MAX(t.horario_fim) FROM turmas t WHERE t.evento_id = e.id) DESC
    `, [usuarioId]);
     
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos:", err.stack || err.message);
    res.status(500).json({ erro: 'Erro ao listar eventos' });
  }
}

// ➕ Criar novo evento com logs detalhados
async function criarEvento(req, res) {
  const {
    titulo, descricao, local, tipo, unidade_id, publico_alvo,
    instrutor = [], turmas = []
  } = req.body;

  // ✅ Validação completa com logs
  if (!titulo?.trim()) {
    console.warn("⚠️ Campo 'titulo' ausente ou vazio.");
    return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  }
  if (!descricao?.trim()) {
    console.warn("⚠️ Campo 'descricao' ausente ou vazio.");
    return res.status(400).json({ erro: "Campo 'descricao' é obrigatório." });
  }
  if (!local?.trim()) {
    console.warn("⚠️ Campo 'local' ausente ou vazio.");
    return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  }
  if (!tipo?.trim()) {
    console.warn("⚠️ Campo 'tipo' ausente ou vazio.");
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  }
  if (!publico_alvo?.trim()) {
    console.warn("⚠️ Campo 'publico_alvo' ausente ou vazio.");
    return res.status(400).json({ erro: "Campo 'publico_alvo' é obrigatório." });
  }
  if (!unidade_id) {
    console.warn("⚠️ Campo 'unidade_id' ausente.");
    return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });
  }
  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    console.warn("⚠️ Lista de instrutor vazia ou inválida.");
    return res.status(400).json({ erro: "Ao menos um instrutor deve ser selecionado." });
  }
  if (!Array.isArray(turmas) || turmas.length === 0) {
    console.warn("⚠️ Lista de turmas vazia ou inválida.");
    return res.status(400).json({ erro: "Ao menos uma turma deve ser criada." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoResult = await client.query(`
      INSERT INTO eventos (
        titulo, descricao, local, tipo, unidade_id, publico_alvo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [titulo, descricao, local, tipo, unidade_id, publico_alvo]);

    const eventoId = eventoResult.rows[0].id;


    // 🔸 Inserir todos os instrutor
    for (const instrutorId of instrutor) {
      await client.query(`
        INSERT INTO evento_instrutor (evento_id, instrutor_id)
        VALUES ($1, $2)
      `, [eventoId, instrutorId]);
    }

    // 🔸 Inserir todas as turmas
    for (const [index, turma] of turmas.entries()) {
      const {
        nome, data_inicio, data_fim,
        horario_inicio, horario_fim,
        vagas_total, carga_horaria
      } = turma;

      if (
        !nome?.trim() || !data_inicio || !data_fim ||
        !horario_inicio || !horario_fim ||
        vagas_total == null || carga_horaria == null
      ) {
        console.warn("⚠️ Falha na validação de uma turma:", turma);
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }

      await client.query(`
        INSERT INTO turmas (
          evento_id, nome, data_inicio, data_fim,
          horario_inicio, horario_fim, vagas_total, carga_horaria
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        eventoId, nome, data_inicio, data_fim,
        horario_inicio, horario_fim, vagas_total, carga_horaria
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ mensagem: 'Evento criado com sucesso', evento: eventoResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao criar evento:", err.message, err.stack);
    res.status(500).json({ erro: 'Erro ao criar evento' });
  } finally {
    client.release();
  }
}


// 🔍 Buscar evento por ID
async function buscarEventoPorId(req, res) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const eventoResult = await client.query(`
      SELECT *
      FROM eventos
      WHERE id = $1
    `, [id]);

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }

    const evento = eventoResult.rows[0];

    const instrutorResult = await client.query(`
      SELECT u.id, u.nome
      FROM evento_instrutor ei
      JOIN usuarios u ON u.id = ei.instrutor_id
      WHERE ei.evento_id = $1
    `, [id]);

    const turmasResult = await client.query(`
      SELECT 
        id, nome, data_inicio, data_fim,
        horario_inicio, horario_fim,
        vagas_total, carga_horaria
      FROM turmas
      WHERE evento_id = $1
      ORDER BY data_inicio
    `, [id]);

    const eventoCompleto = {
      ...evento,
      instrutor: instrutorResult.rows,
      turmas: turmasResult.rows,
    };

    res.json(eventoCompleto);
  } catch (err) {
    console.error('❌ Erro ao buscar evento por ID:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar evento por ID' });
  } finally {
    client.release();
  }
}

async function listarDatasDaTurma(req, res) {
  const turmaId = req.params.id;

  try {
    const resultado = await db.query(
      `SELECT data, horario_inicio, horario_fim
       FROM datas_evento
       WHERE turma_id = $1
       ORDER BY data`,
      [turmaId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    console.error("❌ Erro ao buscar datas da turma:", erro);
    res.status(500).json({ erro: "Erro ao buscar datas da turma." });
  }
}

// 🔄 Atualizar evento com suas turmas e instrutor
async function atualizarEvento(req, res) {
  const { id } = req.params;
  const {
    titulo, descricao, local, tipo,
    unidade_id, publico_alvo,
    instrutor = [], turmas = []
  } = req.body;

  // ✅ Validação dos dados obrigatórios
  if (
    !titulo?.trim() || !descricao?.trim() || !local?.trim() || !tipo?.trim() ||
    !publico_alvo?.trim() || !unidade_id ||
    !Array.isArray(instrutor) || instrutor.length === 0 ||
    !Array.isArray(turmas) || turmas.length === 0
  ) {
    return res.status(400).json({ erro: 'Todos os campos do evento são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔄 Atualizar os dados principais do evento
    const result = await client.query(`
      UPDATE eventos
      SET titulo = $1, descricao = $2, local = $3,
          tipo = $4, unidade_id = $5, publico_alvo = $6
      WHERE id = $7
      RETURNING *
    `, [titulo, descricao, local, tipo, unidade_id, publico_alvo, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    // 🔄 Atualizar instrutor
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);

    for (const instrutorId of instrutor) {
      await client.query(`
        INSERT INTO evento_instrutor (evento_id, instrutor_id)
        VALUES ($1, $2)
      `, [id, instrutorId]);
    }

    // 🔄 Atualizar turmas
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);

    for (const turma of turmas) {
      const {
        nome, data_inicio, data_fim,
        horario_inicio, horario_fim,
        vagas_total, carga_horaria
      } = turma;

      if (
        !nome?.trim() || !data_inicio || !data_fim ||
        !horario_inicio || !horario_fim ||
        vagas_total == null || carga_horaria == null
      ) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }

      await client.query(`
        INSERT INTO turmas (
          evento_id, nome, data_inicio, data_fim,
          horario_inicio, horario_fim, vagas_total, carga_horaria
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id, nome, data_inicio, data_fim,
        horario_inicio, horario_fim, vagas_total, carga_horaria
      ]);
    }

    await client.query('COMMIT');
    res.json({ mensagem: 'Evento atualizado com sucesso', evento: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao atualizar evento com turmas:', err.message);
    res.status(500).json({ erro: 'Erro ao atualizar evento com turmas' });
  } finally {
    client.release();
  }
}

// ❌ Excluir evento
async function excluirEvento(req, res) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Excluir presenças ligadas às turmas do evento (se houver)
    await client.query(`
      DELETE FROM presencas
      WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)
    `, [id]);

    // Excluir turmas ligadas ao evento
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);

    // Excluir instrutor associados
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);

    // Excluir o próprio evento
    const result = await client.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensagem: 'Evento excluído com sucesso', evento: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao excluir evento:', err.message);
    res.status(500).json({ erro: 'Erro ao excluir evento' });
  } finally {
    client.release();
  }
}


// 📆 Listar turmas de um evento (por ID)
async function listarTurmasDoEvento(req, res) {
  const { id } = req.params;

  try {
    const result = await query(`
      SELECT 
        t.id, t.nome, t.data_inicio, t.data_fim,
        t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria,
        e.titulo, e.descricao, e.local,
        COALESCE(
          array_agg(DISTINCT u.nome) 
          FILTER (WHERE u.nome IS NOT NULL),
          '{}'
        ) AS instrutor
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u ON u.id = ei.instrutor_id
      WHERE e.id = $1
      GROUP BY t.id, e.id
      ORDER BY t.data_inicio
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar turmas do evento:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar turmas do evento.' });
  }
}



// 📅 Buscar eventos com status (para Agenda Geral)
async function getAgendaEventos(req, res) {
  try {
    const result = await query(`
      SELECT 
        e.id,
        e.titulo,
        MIN(t.data_inicio) AS data_inicio,
        MAX(t.data_fim) AS data_fim,
        CASE 
  WHEN CURRENT_TIMESTAMP < MIN(t.data_inicio + t.horario_inicio) THEN 'programado'
  WHEN CURRENT_TIMESTAMP BETWEEN MIN(t.data_inicio + t.horario_inicio)
                           AND MAX(t.data_fim + t.horario_fim) THEN 'andamento'
  ELSE 'encerrado'
END AS status
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      GROUP BY e.id, e.titulo
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
    res.status(500).json({ erro: 'Erro ao buscar agenda' });
  }
}


// 🔎 Listar eventos apenas do instrutor autenticado
async function listarEventosDoinstrutor(req, res) {
  const usuarioId = req.user.id;
  const client = await pool.connect();

  try {
    const eventosResult = await client.query(`
      SELECT DISTINCT 
  e.*,
  CASE 
    WHEN CURRENT_TIMESTAMP < (
      SELECT MIN(t.data_inicio + t.horario_inicio)
      FROM turmas t
      WHERE t.evento_id = e.id
    ) THEN 'programado'
    
    WHEN CURRENT_TIMESTAMP BETWEEN
      (
        SELECT MIN(t.data_inicio + t.horario_inicio)
        FROM turmas t
        WHERE t.evento_id = e.id
      )
      AND
      (
        SELECT MAX(t.data_fim + t.horario_fim)
        FROM turmas t
        WHERE t.evento_id = e.id
      )
    THEN 'andamento'
    
    ELSE 'encerrado'
  END AS status
FROM eventos e
JOIN evento_instrutor ei ON ei.evento_id = e.id
WHERE ei.instrutor_id = $1
ORDER BY e.id
    `, [usuarioId]);


    const eventos = [];

    for (const evento of eventosResult.rows) {
      // 🔄 Buscar turmas do evento
      const turmasResult = await client.query(`
        SELECT 
          t.id, t.nome, t.data_inicio, t.data_fim,
          t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          (
            SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id
          ) AS inscritos
        FROM turmas t
        WHERE t.evento_id = $1
        ORDER BY t.data_inicio
      `, [evento.id]);

      // 👤 Buscar instrutor associado
      const instrutorResult = await client.query(`
        SELECT u.id, u.nome
        FROM evento_instrutor ei
        JOIN usuarios u ON u.id = ei.instrutor_id
        WHERE ei.evento_id = $1
      `, [evento.id]);

      eventos.push({
        ...evento,
        instrutor: instrutorResult.rows,
        turmas: turmasResult.rows
      });
    }

    res.json(eventos);
  } catch (err) {
    console.error("❌ Erro ao buscar eventos do instrutor:", err.message);
    res.status(500).json({ erro: 'Erro ao buscar eventos do instrutor' });
  } finally {
    client.release();
  }
}


module.exports = {
  listarEventos,
  criarEvento,
  buscarEventoPorId,
  atualizarEvento,
  excluirEvento,
  listarTurmasDoEvento,
  getAgendaEventos,
  listarEventosDoinstrutor,
  listarDatasDaTurma,
};