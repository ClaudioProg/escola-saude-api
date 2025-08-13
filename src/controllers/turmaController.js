// ✅ src/controllers/turmasController.js
const db = require('../db');

// 🎯 Criar uma nova turma
async function criarTurma(req, res) {
  const {
    evento_id,
    nome,
    data_inicio,
    data_fim,
    horario_inicio,
    horario_fim,
    vagas_total,
  } = req.body;

  if (
    !evento_id ||
    !nome ||
    !data_inicio ||
    !data_fim ||
    !horario_inicio ||
    !horario_fim ||
    vagas_total == null
  ) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }
  if (isNaN(Number(vagas_total)) || Number(vagas_total) < 1) {
    return res.status(400).json({ erro: 'Vagas totais deve ser número maior que zero.' });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO turmas (
        evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
        vagas_total, vagas_disponiveis
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *
      `,
      [evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, Number(vagas_total)]
    );

    return res
      .status(201)
      .json({ mensagem: 'Turma cadastrada com sucesso', turma: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao cadastrar turma:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar turma.' });
  }
}

// ✏️ Atualizar turma existente
async function editarTurma(req, res) {
  const { id } = req.params;
  const {
    evento_id,
    nome,
    data_inicio,
    data_fim,
    horario_inicio,
    horario_fim,
    vagas_total,
  } = req.body;

  if (
    !evento_id ||
    !nome ||
    !data_inicio ||
    !data_fim ||
    !horario_inicio ||
    !horario_fim ||
    vagas_total == null
  ) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }
  if (isNaN(Number(vagas_total)) || Number(vagas_total) < 1) {
    return res.status(400).json({ erro: 'Vagas totais deve ser número maior que zero.' });
  }

  try {
    const result = await db.query(
      `
      UPDATE turmas
         SET evento_id      = $1,
             nome           = $2,
             data_inicio    = $3,
             data_fim       = $4,
             horario_inicio = $5,
             horario_fim    = $6,
             vagas_total    = $7
       WHERE id = $8
       RETURNING *
      `,
      [evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, Number(vagas_total), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    return res.json({ mensagem: 'Turma atualizada com sucesso', turma: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao atualizar turma:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar turma.' });
  }
}

// ➕ Adicionar instrutor(es) a um evento
async function adicionarInstrutor(req, res) {
  const { id: evento_id } = req.params;
  const { instrutores } = req.body; // espere um array de ids em "instrutores"

  if (!Array.isArray(instrutores) || instrutores.length === 0) {
    return res.status(400).json({ erro: 'Lista de instrutores inválida.' });
  }

  try {
    const eventoExiste = await db.query('SELECT id FROM eventos WHERE id = $1', [evento_id]);
    if (eventoExiste.rowCount === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    // insere apenas os que ainda não existem (idempotente)
    for (const instrutor_id of instrutores) {
      const existe = await db.query(
        `SELECT 1 FROM evento_instrutor WHERE evento_id = $1 AND instrutor_id = $2`,
        [evento_id, instrutor_id]
      );
      if (existe.rowCount === 0) {
        await db.query(
          `INSERT INTO evento_instrutor (evento_id, instrutor_id) VALUES ($1, $2)`,
          [evento_id, instrutor_id]
        );
      }
    }

    return res.status(201).json({ mensagem: 'Instrutor(es) adicionados com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao adicionar instrutor:', err);
    return res.status(500).json({ erro: 'Erro ao adicionar instrutor.' });
  }
}

// 📋 Listar turmas por evento (com vagas disponíveis e inscritos)
async function listarTurmasPorEvento(req, res) {
  const { evento_id } = req.params;

  try {
    // 1) Turmas + vagas disponíveis calculadas
    const turmasResult = await db.query(
      `
      SELECT 
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.vagas_total,
        GREATEST(t.vagas_total - COUNT(i.id), 0) AS vagas_disponiveis
      FROM turmas t
      LEFT JOIN inscricoes i ON i.turma_id = t.id
      WHERE t.evento_id = $1
      GROUP BY t.id
      ORDER BY t.data_inicio
      `,
      [evento_id]
    );

    const turmas = turmasResult.rows;

    if (turmas.length === 0) {
      return res.json([]);
    }

    // 2) Inscritos por turma
    const inscritosResult = await db.query(
      `
      SELECT 
        i.turma_id,
        u.id   AS usuario_id,
        u.nome,
        u.email,
        u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = ANY($1::int[])
      `,
      [turmas.map((t) => t.id)]
    );

    const inscritosPorTurma = {};
    for (const row of inscritosResult.rows) {
      if (!inscritosPorTurma[row.turma_id]) inscritosPorTurma[row.turma_id] = [];
      inscritosPorTurma[row.turma_id].push({
        id: row.usuario_id,
        nome: row.nome,
        email: row.email,
        cpf: row.cpf,
      });
    }

    // 3) Monta resposta
    const turmasComInscritos = turmas.map((turma) => ({
      ...turma,
      inscritos: inscritosPorTurma[turma.id] || [],
    }));

    return res.json(turmasComInscritos);
  } catch (err) {
    console.error('❌ Erro ao buscar turmas:', err);
    return res.status(500).json({ erro: 'Erro ao buscar turmas.' });
  }
}

// 👨‍🏫 Listar turmas do instrutor autenticado com presença detalhada
async function listarTurmasDoInstrutor(req, res) {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    const turmasResult = await db.query(
      `
      SELECT 
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.vagas_total,
        e.id     AS evento_id,
        e.titulo AS evento_titulo
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t  ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio ASC
      `,
      [usuarioId]
    );
    const turmas = turmasResult.rows;

    if (turmas.length === 0) {
      return res.json([]);
    }

    // Inscritos
    const inscritosResult = await db.query(
      `
      SELECT 
        i.turma_id,
        u.id AS usuario_id,
        u.nome,
        u.email,
        u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = ANY($1::int[])
      `,
      [turmas.map((t) => t.id)]
    );

    // Presenças
    const presencasResult = await db.query(
      `
      SELECT turma_id, usuario_id, data_presenca::date AS data_presenca
      FROM presencas
      WHERE turma_id = ANY($1::int[])
      `,
      [turmas.map((t) => t.id)]
    );

    // Index de presenças: chave "turma-usuario-dataISO"
    const mapaPresencas = {};
    for (const row of presencasResult.rows) {
      const dataStr = new Date(row.data_presenca).toISOString().split('T')[0];
      const chave = `${row.turma_id}-${row.usuario_id}-${dataStr}`;
      mapaPresencas[chave] = true;
    }

    const gerarDatas = (inicio, fim) => {
      const datas = [];
      let atual = new Date(inicio);
      const ultimo = new Date(fim);
      while (atual <= ultimo) {
        datas.push(new Date(atual).toISOString().split('T')[0]);
        atual.setDate(atual.getDate() + 1);
      }
      return datas;
    };

    const turmasComInscritos = turmas.map((turma) => {
      const datas = gerarDatas(turma.data_inicio, turma.data_fim);

      // limite de confirmação até 48h após o fim da turma
      const fimTurma = new Date(turma.data_fim);
      fimTurma.setDate(fimTurma.getDate() + 2);

      const inscritos = inscritosResult.rows
        .filter((r) => r.turma_id === turma.id)
        .map((inscrito) => {
          const datasPresenca = datas.map((data) => {
            const hoje = new Date();
            const dataAula = new Date(data);
            const chave = `${turma.id}-${inscrito.usuario_id}-${data}`;

            const presente = !!mapaPresencas[chave];
            const pode_confirmar = !presente && hoje <= fimTurma && dataAula < hoje;

            let status = 'aguardando';
            if (presente) status = 'presente';
            else if (dataAula < hoje) status = 'faltou';

            return { data, presente, status, pode_confirmar };
          });

          return {
            id: inscrito.usuario_id,
            nome: inscrito.nome,
            email: inscrito.email,
            cpf: inscrito.cpf,
            datas: datasPresenca,
          };
        });

      return { ...turma, inscritos };
    });

    return res.json(turmasComInscritos);
  } catch (error) {
    console.error('❌ Erro em listarTurmasDoInstrutor:', error);
    return res.status(500).json({ erro: 'Erro ao buscar turmas do instrutor.' });
  }
}

// 👥 Listar instrutor(es) da turma (instrutores do evento da turma)
async function listarInstrutorDaTurma(req, res) {
  const { id: turma_id } = req.params;

  try {
    const turma = await db.query(`SELECT evento_id FROM turmas WHERE id = $1`, [turma_id]);
    if (turma.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    const evento_id = turma.rows[0].evento_id;

    const resultado = await db.query(
      `
      SELECT 
        u.id,
        u.nome,
        u.email
      FROM evento_instrutor ei
      JOIN usuarios u ON ei.instrutor_id = u.id
      WHERE ei.evento_id = $1
      ORDER BY u.nome
      `,
      [evento_id]
    );

    return res.json(resultado.rows);
  } catch (err) {
    console.error('❌ Erro ao listar instrutor da turma:', err);
    return res.status(500).json({ erro: 'Erro ao listar instrutor.' });
  }
}

// 🗑️ Excluir turma
async function excluirTurma(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM turmas WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }
    return res.json({ mensagem: 'Turma excluída com sucesso.', turma: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao excluir turma:', err);
    return res.status(500).json({ erro: 'Erro ao excluir turma.' });
  }
}

// 🔎 Obter título do evento e nomes dos instrutores
async function obterDetalhesTurma(req, res) {
  const { id } = req.params;

  try {
    const resultado = await db.query(
      `
      SELECT 
        e.titulo AS titulo_evento,
        COALESCE(
          (
            SELECT string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome)
            FROM evento_instrutor ei
            JOIN usuarios u ON u.id = ei.instrutor_id
            WHERE ei.evento_id = e.id
          ),
          'Instrutor não definido'
        ) AS nome_instrutor
      FROM turmas t
      JOIN eventos e ON t.evento_id = e.id
      WHERE t.id = $1
      `,
      [id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao obter detalhes da turma:', err);
    return res.status(500).json({ erro: 'Erro ao obter detalhes da turma.' });
  }
}

// 📦 Listar todas as turmas com usuários (nome, email, CPF, presença)
async function listarTurmasComUsuarios(req, res) {
  try {
    const turmasResult = await db.query(
      `
      SELECT 
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.evento_id,
        e.titulo AS titulo_evento
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      ORDER BY t.data_inicio DESC
      `
    );
    const turmas = turmasResult.rows;

    if (turmas.length === 0) {
      return res.json([]);
    }

    // Para marcar presença sem duplicar, usamos EXISTS
    const inscritosResult = await db.query(
      `
      SELECT 
        i.turma_id,
        u.id AS usuario_id,
        u.nome,
        u.email,
        u.cpf,
        EXISTS (
          SELECT 1 FROM presencas p
          WHERE p.usuario_id = u.id
            AND p.turma_id   = i.turma_id
            AND p.presente   = TRUE
        ) AS presente
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = ANY($1::int[])
      ORDER BY u.nome
      `,
      [turmas.map((t) => t.id)]
    );

    const inscritosPorTurma = {};
    for (const row of inscritosResult.rows) {
      if (!inscritosPorTurma[row.turma_id]) inscritosPorTurma[row.turma_id] = [];
      inscritosPorTurma[row.turma_id].push({
        id: row.usuario_id,
        nome: row.nome,
        email: row.email,
        cpf: row.cpf,
        presente: row.presente === true,
      });
    }

    const turmasComUsuarios = turmas.map((turma) => ({
      ...turma,
      usuarios: inscritosPorTurma[turma.id] || [],
    }));

    return res.json(turmasComUsuarios);
  } catch (err) {
    console.error('❌ Erro ao buscar turmas com usuarios:', err);
    return res.status(500).json({ erro: 'Erro interno ao buscar turmas com usuarios.' });
  }
}

module.exports = {
  // nomes consistentes
  criarTurma,
  editarTurma,
  excluirTurma,
  listarTurmasPorEvento,
  adicionarInstrutor,
  listarInstrutorDaTurma,
  obterDetalhesTurma,
  listarTurmasComUsuarios,
  listarTurmasDoInstrutor,

  // ✅ aliases para compatibilidade retroativa com nomes antigos
  adicionarinstrutor: adicionarInstrutor,
  listarinstrutorDaTurma: listarInstrutorDaTurma,
  listarTurmasComusuarios: listarTurmasComUsuarios,
  listarTurmasDoinstrutor: listarTurmasDoInstrutor,
};
