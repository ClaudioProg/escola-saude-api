const { pool, query } = require('../db');

async function listarEventos(req, res) {
  try {
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
    'inscritos', (
      SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id
    )
  ))
  FROM turmas t
  WHERE t.evento_id = e.id
) AS turmas,
        -- Datas consolidadas com base nas turmas
        (
          SELECT MIN(t.data_inicio)
          FROM turmas t
          WHERE t.evento_id = e.id
        ) AS data_inicio_geral,
        (
          SELECT MAX(t.data_fim)
          FROM turmas t
          WHERE t.evento_id = e.id
        ) AS data_fim_geral,
        (
          CASE
            WHEN CURRENT_DATE < (
              SELECT MIN(t.data_inicio)
              FROM turmas t
              WHERE t.evento_id = e.id
            ) THEN 'programado'
            WHEN CURRENT_DATE BETWEEN (
              SELECT MIN(t.data_inicio)
              FROM turmas t
              WHERE t.evento_id = e.id
            ) AND (
              SELECT MAX(t.data_fim)
              FROM turmas t
              WHERE t.evento_id = e.id
            ) THEN 'andamento'
            ELSE 'encerrado'
          END
        ) AS status
      FROM eventos e
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u ON u.id = ei.instrutor_id
      GROUP BY e.id
      ORDER BY data_inicio_geral
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos:", err.stack || err.message);
    res.status(500).json({ erro: 'Erro ao listar eventos' });
  }
}


// ➕ Criar novo evento
async function criarEvento(req, res) {
  const {
    titulo, descricao, local, tipo, unidade_id, publico_alvo,
    instrutor = [], turmas = []
  } = req.body;
  
  if (!titulo || !local || !tipo || !unidade_id) {
    return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Agora só insere os campos realmente existentes
    const eventoResult = await client.query(`
      INSERT INTO eventos (
        titulo, descricao, local, tipo, unidade_id, publico_alvo
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      titulo, descricao, local, tipo, unidade_id, publico_alvo
    ]);

    const eventoId = eventoResult.rows[0].id;

    // Insere instrutor do evento
    for (const instrutorId of instrutor) {
      await client.query(`
        INSERT INTO evento_instrutor (evento_id, instrutor_id)
        VALUES ($1, $2)
      `, [eventoId, instrutorId]);
    }

    // Insere turmas vinculadas ao evento
    for (let i = 0; i < turmas.length; i++) {
      const {
        nome, data_inicio, data_fim, horario_inicio,
        horario_fim, instrutor_id, vagas_total, carga_horaria
      } = turmas[i];

      if (!data_inicio || !data_fim || !horario_inicio || !horario_fim || !vagas_total || !carga_horaria) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }
     

      await client.query(`
        INSERT INTO turmas (
          evento_id, nome, data_inicio, data_fim,
          horario_inicio, horario_fim, instrutor_id, vagas_total, carga_horaria
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        eventoId, nome, data_inicio, data_fim,
        horario_inicio, horario_fim, instrutor_id, vagas_total, carga_horaria
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ mensagem: 'Evento criado com sucesso', evento: eventoResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Erro ao criar evento:", err.message);
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
    // 📌 Buscar dados do evento
    const eventoResult = await client.query(`
      SELECT *
      FROM eventos
      WHERE id = $1
    `, [id]);

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }

    const evento = eventoResult.rows[0];

    // 👤 Buscar instrutor do evento
    const instrutorResult = await client.query(`
      SELECT u.id, u.nome
      FROM evento_instrutor ei
      JOIN usuarios u ON u.id = ei.instrutor_id
      WHERE ei.evento_id = $1
    `, [id]);

    // 📆 Buscar turmas associadas
    const turmasResult = await client.query(`
      SELECT 
    id,
    nome,
    data_inicio,
    data_fim,
    horario_inicio,      // <-- CERTO
    horario_fim,         // <-- CERTO
    instrutor_id,
    vagas_total,
    carga_horaria
  FROM turmas
  WHERE evento_id = $1
  ORDER BY data_inicio
`, [id]);

    // 🔄 Monta objeto completo
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


async function atualizarEvento(req, res) {
  const { id } = req.params;
  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    instrutor = [],
    turmas = []
  } = req.body;

  if (!titulo || !local || !tipo || !unidade_id) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atualiza o evento principal (apenas os campos próprios do evento)
    const result = await client.query(`
      UPDATE eventos
      SET titulo = $1, descricao = $2, local = $3, tipo = $4, unidade_id = $5, publico_alvo = $6
      WHERE id = $7
      RETURNING *
    `, [
      titulo, descricao, local, tipo, unidade_id, publico_alvo, id
    ]);

    // Remove todos os instrutor associados
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);

    // Insere os instrutor novamente
    for (const instrutorId of instrutor) {
      await client.query(`
        INSERT INTO evento_instrutor (evento_id, instrutor_id)
        VALUES ($1, $2)
      `, [id, instrutorId]);
    }

    // Remove todas as turmas associadas ao evento
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);

    // Insere as turmas novamente
    for (const turma of turmas) {
      const {
        nome,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        instrutor_id,
        vagas_total,
        carga_horaria,
      } = turma;

      await client.query(`
        INSERT INTO turmas (
          evento_id, nome, data_inicio, data_fim,
          horario_inicio, horario_fim, instrutor_id, vagas_total, carga_horaria
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        id, nome, data_inicio, data_fim,
        horario_inicio, horario_fim, instrutor_id, vagas_total, carga_horaria
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
  const { id } = req.params; // No seu eventosRoute está como /:id/turmas

  try {
    const result = await query(`
      SELECT 
        e.id,
        e.titulo,
        e.descricao,
        t.data_inicio,
        t.data_fim,
        e.local,
        t.vagas_total,
        t.carga_horaria,
        COALESCE(array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL), '{}') AS instrutor
      FROM eventos e
      LEFT JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN usuarios u ON t.instrutor_id = u.id
      GROUP BY e.id
      ORDER BY t.data_inicio
    `);
   
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar turmas:', err);
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
          WHEN CURRENT_DATE < MIN(t.data_inicio) THEN 'programado'
          WHEN CURRENT_DATE BETWEEN MIN(t.data_inicio) AND MAX(t.data_fim) THEN 'andamento'
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
    // 🔍 Buscar eventos em que o usuário atua como instrutor
    const eventosResult = await client.query(`
      SELECT DISTINCT e.*
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      WHERE t.instrutor_id = $1
      ORDER BY t.data_inicio
    `, [usuarioId]);

    const eventos = await query(`
      SELECT 
        e.*,
        (
          SELECT json_agg(json_build_object(
            'id', t.id,
            'nome', t.nome,
            'data_inicio', t.data_inicio,
            'data_fim', t.data_fim,
            'horario_inicio', t.horario_inicio,
            'horario_fim', t.horario_fim,
            'vagas_total', t.vagas_total,
            'inscritos', (
              SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id
            )
          ))
          FROM turmas t
          WHERE t.evento_id = e.id
        ) AS turmas
      FROM eventos e
      ORDER BY e.data_inicio DESC
    `);
    

    for (const evento of eventosResult.rows) {
      // 🔄 Buscar instrutor do evento
      const instrutorResult = await client.query(`
        SELECT u.id, u.nome
        FROM evento_instrutor ei
        JOIN usuarios u ON u.id = ei.instrutor_id
        WHERE ei.evento_id = $1
      `, [evento.id]);

      // 🔄 Buscar turmas do evento
      const turmasResult = await client.query(`
        SELECT 
    id,
    nome,
    data_inicio,
    data_fim,
    horario_inicio,      // <-- CERTO
    horario_fim,         // <-- CERTO
    instrutor_id,
    vagas_total,
    carga_horaria
  FROM turmas
  WHERE evento_id = $1
  ORDER BY data_inicio
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
};