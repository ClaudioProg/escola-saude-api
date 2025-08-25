// 📁 src/controllers/eventosController.js
const { pool, query } = require('../db');

/* =====================================================================
   Helpers
   ===================================================================== */
function hhmm(s, fb = '') {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || '';
}
function iso(s) {
  return typeof s === 'string' ? s.slice(0, 10) : '';
}

/** Converte um array vindo do front:
 *    - aceita turmas[].datas: [{data, horario_inicio, horario_fim}]
 *    - ou turmas[].encontros: [{data, inicio, fim}]  OU array de strings "YYYY-MM-DD"
 * Retorna: [{ data, inicio, fim }] (HH:MM)
 */
function normalizeEncontrosEntrada(turma) {
  const baseHi = hhmm(turma?.horario_inicio || '08:00', '08:00');
  const baseHf = hhmm(turma?.horario_fim || '17:00', '17:00');

  const arr =
    Array.isArray(turma?.datas) && turma.datas.length
      ? turma.datas.map(e => ({
          data: iso(e?.data || ''),
          inicio: hhmm(e?.horario_inicio, baseHi),
          fim: hhmm(e?.horario_fim, baseHf),
        }))
      : Array.isArray(turma?.encontros) && turma.encontros.length
      ? turma.encontros.map(e => {
          if (typeof e === 'string') {
            return { data: iso(e), inicio: baseHi, fim: baseHf };
          }
          return {
            data: iso(e?.data || ''),
            inicio: hhmm(e?.inicio, baseHi),
            fim: hhmm(e?.fim, baseHf),
          };
        })
      : [];

  return arr.filter(e => e.data && e.inicio && e.fim);
}

/** SQL snippet que retorna JSON de datas reais (datas_turma) no shape esperado:
 * [
 *   { data: 'YYYY-MM-DD', horario_inicio: 'HH:MM', horario_fim: 'HH:MM' }, ...
 * ]
 */
const SQL_JSON_DATAS = `
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'data', to_char(dt.data, 'YYYY-MM-DD'),
          'horario_inicio', to_char(dt.horario_inicio, 'HH24:MI'),
          'horario_fim',   to_char(dt.horario_fim,   'HH24:MI')
        )
        ORDER BY dt.data ASC
      ),
      '[]'::json
    )
    FROM datas_turma dt
    WHERE dt.turma_id = t.id
  )
`;

/** SQL snippet de fallback (apenas datas) a partir de presenças;
 * horários herdados da turma.
 */
const SQL_JSON_DATAS_FALLBACK_PRESENCAS = `
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'data', to_char(p.data_presenca::date, 'YYYY-MM-DD'),
          'horario_inicio', to_char(t.horario_inicio, 'HH24:MI'),
          'horario_fim',   to_char(t.horario_fim,   'HH24:MI')
        )
        ORDER BY (p.data_presenca::date) ASC
      ),
      '[]'::json
    )
    FROM presencas p
    WHERE p.turma_id = t.id
  )
`;

/* =====================================================================
   📄 Listar todos os eventos (com turmas e suas DATAS reais)
   ===================================================================== */
async function listarEventos(req, res) {
  try {
    const usuarioId = req.usuario?.id || null;

    const result = await query(
      `
      SELECT 
        e.*,

        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
          FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS instrutor,

        (
          SELECT json_agg(
            json_build_object(
              'id', t.id,
              'nome', t.nome,
              'data_inicio', t.data_inicio,
              'data_fim', t.data_fim,
              'horario_inicio', t.horario_inicio,
              'horario_fim', t.horario_fim,
              'vagas_total', t.vagas_total,
              'carga_horaria', t.carga_horaria,
              'inscritos', (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id),

              -- ✅ DATAS reais (datas_turma) ou fallback por presenças; se ambas vazias, devolve []
              'datas', CASE 
                         WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id)
                           THEN ${SQL_JSON_DATAS}
                         WHEN EXISTS (SELECT 1 FROM presencas p WHERE p.turma_id = t.id)
                           THEN ${SQL_JSON_DATAS_FALLBACK_PRESENCAS}
                         ELSE '[]'::json
                       END
            )
            ORDER BY t.data_inicio, t.id
          )
          FROM turmas t
          WHERE t.evento_id = e.id
        ) AS turmas,

        (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
        (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
        (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
        (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,

        (SELECT MIN(t.data_inicio + t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS inicio_completo_geral,
        (SELECT MAX(t.data_fim    + t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS fim_completo_geral,

        (
          CASE
            WHEN CURRENT_TIMESTAMP < (
              SELECT MIN(t.data_inicio + t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id
            ) THEN 'programado'
            WHEN CURRENT_TIMESTAMP BETWEEN
              (SELECT MIN(t.data_inicio + t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id)
              AND
              (SELECT MAX(t.data_fim + t.horario_fim) FROM turmas t WHERE t.evento_id = e.id)
            THEN 'andamento'
            ELSE 'encerrado'
          END
        ) AS status,

        -- flags por usuário (se autenticado)
        (
          SELECT COUNT(*) > 0
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
          WHERE i.usuario_id = $1 AND t.evento_id = e.id
        ) AS ja_inscrito,

        (
          SELECT COUNT(*) > 0
          FROM evento_instrutor ei
          WHERE ei.evento_id = e.id
            AND ei.instrutor_id = $1
        ) AS ja_instrutor

      FROM eventos e
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u         ON u.id  = ei.instrutor_id
      GROUP BY e.id
      ORDER BY (SELECT MAX(t.data_fim + t.horario_fim) FROM turmas t WHERE t.evento_id = e.id) DESC;
    `,
      [usuarioId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar eventos:', err.stack || err.message);
    res.status(500).json({ erro: 'Erro ao listar eventos' });
  }
}

/* =====================================================================
   ➕ Criar evento (persiste turmas + datas_turma) — aceita datas/encontros
   ===================================================================== */
async function criarEvento(req, res) {
  const { titulo, descricao, local, tipo, unidade_id, publico_alvo, instrutor = [], turmas = [] } = req.body;

  if (!titulo?.trim()) return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  if (!descricao?.trim()) return res.status(400).json({ erro: "Campo 'descricao' é obrigatório." });
  if (!local?.trim()) return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  if (!tipo?.trim()) return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  if (!publico_alvo?.trim()) return res.status(400).json({ erro: "Campo 'publico_alvo' é obrigatório." });
  if (!unidade_id) return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });
  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    return res.status(400).json({ erro: 'Ao menos um instrutor deve ser selecionado.' });
  }
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ erro: 'Ao menos uma turma deve ser criada.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoResult = await client.query(
      `INSERT INTO eventos (titulo, descricao, local, tipo, unidade_id, publico_alvo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [titulo, descricao, local, tipo, unidade_id, publico_alvo]
    );
    const eventoId = eventoResult.rows[0].id;

    for (const instrutorId of instrutor) {
      await client.query(
        `INSERT INTO evento_instrutor (evento_id, instrutor_id) VALUES ($1, $2)`,
        [eventoId, instrutorId]
      );
    }

    for (const t of turmas) {
      const nome = (t?.nome || '').trim();
      const data_inicio = iso(t?.data_inicio);
      const data_fim = iso(t?.data_fim);
      const horario_inicio = hhmm(t?.horario_inicio || '08:00', '08:00');
      const horario_fim = hhmm(t?.horario_fim || '17:00', '17:00');
      const vagas_total = t?.vagas_total ?? t?.vagas ?? null;
      const carga_horaria = t?.carga_horaria != null ? Number(t.carga_horaria) : null;

      if (!nome || !data_inicio || !data_fim || vagas_total == null || carga_horaria == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }

      const turmaIns = await client.query(
        `INSERT INTO turmas (evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [eventoId, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria]
      );
      const turmaId = turmaIns.rows[0].id;

      const encontros = normalizeEncontrosEntrada({ ...t, horario_inicio, horario_fim });
      if (encontros.length) {
        for (const e of encontros) {
          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1, $2, $3, $4)`,
            [turmaId, e.data, e.inicio, e.fim]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ mensagem: 'Evento criado com sucesso', evento: eventoResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar evento:', err.message, err.stack);
    res.status(500).json({ erro: 'Erro ao criar evento' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar evento por ID (com turmas + datas reais)
   ===================================================================== */
async function buscarEventoPorId(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario?.id || null;
  const client = await pool.connect();

  try {
    const eventoResult = await client.query(`SELECT * FROM eventos WHERE id = $1`, [id]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }
    const evento = eventoResult.rows[0];

    const instrutorResult = await client.query(
      `SELECT u.id, u.nome
         FROM evento_instrutor ei
         JOIN usuarios u ON u.id = ei.instrutor_id
        WHERE ei.evento_id = $1`,
      [id]
    );

    const turmasResult = await client.query(
      `
      SELECT 
        t.id, t.nome, t.data_inicio, t.data_fim,
        t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria,
        (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos,

        -- ✅ datas reais
        CASE 
          WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id)
            THEN ${SQL_JSON_DATAS}
          WHEN EXISTS (SELECT 1 FROM presencas p WHERE p.turma_id = t.id)
            THEN ${SQL_JSON_DATAS_FALLBACK_PRESENCAS}
          ELSE '[]'::json
        END AS datas

      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio, t.id
      `,
      [id]
    );

    const jaInstrutorResult = await client.query(
      `SELECT COUNT(*) > 0 AS eh
         FROM evento_instrutor
        WHERE evento_id = $1 AND instrutor_id = $2`,
      [id, usuarioId]
    );
    const jaInscritoResult = await client.query(
      `SELECT COUNT(*) > 0 AS eh
         FROM inscricoes i
         JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
          AND t.evento_id = $2`,
      [usuarioId, id]
    );

    const eventoCompleto = {
      ...evento,
      instrutor: instrutorResult.rows,
      turmas: turmasResult.rows.map(r => ({ ...r, datas: r.datas || [] })),
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    };

    res.json(eventoCompleto);
  } catch (err) {
    console.error('❌ Erro ao buscar evento por ID:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar evento por ID' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas de um evento (traz datas reais)
   ===================================================================== */
async function listarTurmasDoEvento(req, res) {
  const { id } = req.params;

  try {
    const result = await query(
      `
      SELECT 
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.vagas_total,
        t.carga_horaria,
        (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos,

        e.titulo,
        e.descricao,
        e.local,

        COALESCE(
          array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL),
          '{}'
        ) AS instrutor,

        -- ✅ datas reais (com fallback por presenças)
        CASE 
          WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id)
            THEN ${SQL_JSON_DATAS}
          WHEN EXISTS (SELECT 1 FROM presencas p WHERE p.turma_id = t.id)
            THEN ${SQL_JSON_DATAS_FALLBACK_PRESENCAS}
          ELSE '[]'::json
        END AS datas

      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
      LEFT JOIN usuarios u ON u.id = ei.instrutor_id
      WHERE e.id = $1
      GROUP BY t.id, e.id
      ORDER BY t.data_inicio, t.id
    `,
      [id]
    );

    // Garante array (não null) no campo datas
    const turmas = result.rows.map(r => ({ ...r, datas: r.datas || [] }));
    res.json(turmas);
  } catch (err) {
    console.error('❌ Erro ao buscar turmas do evento:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar turmas do evento.' });
  }
}

/* =====================================================================
   🔄 Atualizar evento (recria turmas e datas_turma) — aceita datas/encontros
   ===================================================================== */
async function atualizarEvento(req, res) {
  const { id } = req.params;
  let { titulo, descricao, local, tipo, unidade_id, publico_alvo, instrutor = [], turmas = [] } = req.body;

  // normaliza instrutores
  instrutor = Array.isArray(instrutor)
    ? instrutor.map(i => (typeof i === 'object' ? i.id : i)).filter(Boolean)
    : [];

  if (
    !titulo?.trim() ||
    !descricao?.trim() ||
    !local?.trim() ||
    !tipo?.trim() ||
    !publico_alvo?.trim() ||
    !unidade_id ||
    !Array.isArray(instrutor) ||
    instrutor.length === 0 ||
    !Array.isArray(turmas) ||
    turmas.length === 0
  ) {
    return res.status(400).json({ erro: 'Todos os campos do evento são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      UPDATE eventos
         SET titulo = $1, descricao = $2, local = $3,
             tipo = $4, unidade_id = $5, publico_alvo = $6
       WHERE id = $7
       RETURNING *
    `,
      [titulo, descricao, local, tipo, unidade_id, publico_alvo, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    // Instrutores
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);
    for (const instrutorId of instrutor) {
      await client.query(
        `INSERT INTO evento_instrutor (evento_id, instrutor_id) VALUES ($1, $2)`,
        [id, instrutorId]
      );
    }

    // Limpa datas_turma das turmas do evento e depois as próprias turmas
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);

    // Recria turmas + datas
    for (const t of turmas) {
      const nome = (t?.nome || '').trim();
      const data_inicio = iso(t?.data_inicio);
      const data_fim = iso(t?.data_fim);
      const horario_inicio = hhmm(t?.horario_inicio || '08:00', '08:00');
      const horario_fim = hhmm(t?.horario_fim || '17:00', '17:00');
      const vagas_total = t?.vagas_total ?? t?.vagas ?? null;
      const carga_horaria = t?.carga_horaria != null ? Number(t.carga_horaria) : null;

      if (!nome || !data_inicio || !data_fim || vagas_total == null || carga_horaria == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }

      const ins = await client.query(
        `INSERT INTO turmas (
            evento_id, nome, data_inicio, data_fim,
            horario_inicio, horario_fim, vagas_total, carga_horaria
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [id, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria]
      );
      const turmaId = ins.rows[0].id;

      const encontros = normalizeEncontrosEntrada({ ...t, horario_inicio, horario_fim });
      if (encontros.length) {
        for (const e of encontros) {
          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1, $2, $3, $4)`,
            [turmaId, e.data, e.inicio, e.fim]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ mensagem: 'Evento atualizado com sucesso', evento: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error({
      local: 'PUT /api/eventos/:id',
      message: err.message,
      detail: err.detail,
      code: err.code,
      stack: err.stack,
    });
    res.status(500).json({ erro: 'Erro ao atualizar evento com turmas' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ❌ Excluir evento (limpa presenças, datas_turma, turmas e vínculos)
   ===================================================================== */
async function excluirEvento(req, res) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);

    const result = await client.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensagem: 'Inscrição excluída com sucesso', evento: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao excluir evento:', err.message);
    res.status(500).json({ erro: 'Erro ao excluir evento' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📅 Agenda (permanece baseada em intervalo geral)
   ===================================================================== */
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
    console.error('Erro ao buscar agenda:', err);
    res.status(500).json({ erro: 'Erro ao buscar agenda' });
  }
}

/* =====================================================================
   🔎 Listar eventos do instrutor logado (com datas reais)
   ===================================================================== */
async function listarEventosDoinstrutor(req, res) {
  const usuarioId = req.usuario?.id;
  const client = await pool.connect();

  try {
    const eventosResult = await client.query(
      `
      SELECT DISTINCT 
        e.*,
        CASE 
          WHEN CURRENT_TIMESTAMP < (
            SELECT MIN(t.data_inicio + t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP BETWEEN
            (SELECT MIN(t.data_inicio + t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id)
            AND
            (SELECT MAX(t.data_fim + t.horario_fim) FROM turmas t WHERE t.evento_id = e.id)
          THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM eventos e
      JOIN evento_instrutor ei ON ei.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY e.id
    `,
      [usuarioId]
    );

    const eventos = [];
    for (const evento of eventosResult.rows) {
      const turmasResult = await client.query(
        `
        SELECT 
          t.id, t.nome, t.data_inicio, t.data_fim,
          t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos,

          CASE 
            WHEN EXISTS (SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id)
              THEN ${SQL_JSON_DATAS}
            WHEN EXISTS (SELECT 1 FROM presencas p WHERE p.turma_id = t.id)
              THEN ${SQL_JSON_DATAS_FALLBACK_PRESENCAS}
            ELSE '[]'::json
          END AS datas

        FROM turmas t
        WHERE t.evento_id = $1
        ORDER BY t.data_inicio
        `,
        [evento.id]
      );

      const instrutorResult = await client.query(
        `
        SELECT u.id, u.nome
          FROM evento_instrutor ei
          JOIN usuarios u ON u.id = ei.instrutor_id
         WHERE ei.evento_id = $1
        `,
        [evento.id]
      );

      eventos.push({
        ...evento,
        instrutor: instrutorResult.rows,
        turmas: turmasResult.rows.map(r => ({ ...r, datas: r.datas || [] })),
      });
    }

    res.json(eventos);
  } catch (err) {
    console.error('❌ Erro ao buscar eventos do instrutor:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar eventos do instrutor' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📌 Listar datas da turma (endpoint utilitário)
   via=datas | via=presencas | via=intervalo
   ===================================================================== */
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || 'datas').toLowerCase();

  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: 'turma_id inválido' });
  }

  try {
    if (via === 'datas') {
      const sql = `
        SELECT 
          to_char(dt.data, 'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim,   'HH24:MI') AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id = $1
        ORDER BY dt.data ASC;
      `;
      const { rows } = await query(sql, [turmaId]);
      return res.json(rows);
    }

    if (via === 'presencas') {
      const sql = `
        SELECT DISTINCT
          to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,   'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC;
      `;
      const { rows } = await query(sql, [turmaId]);
      return res.json(rows);
    }

    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date    AS df,
          to_char(horario_inicio, 'HH24:MI') AS hi,
          to_char(horario_fim,   'HH24:MI') AS hf
        FROM turmas
        WHERE id = $1
      )
      SELECT
        to_char(gs::date, 'YYYY-MM-DD') AS data,
        t.hi AS horario_inicio,
        t.hf AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC;
    `;
    const { rows } = await query(sql, [turmaId]);
    return res.json(rows);
  } catch (erro) {
    console.error('❌ Erro ao buscar datas da turma:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar datas da turma.', detalhe: erro.message });
  }
}

/* ===================================================================== */
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
