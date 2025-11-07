// ✅ src/controllers/turmasController.js
/* eslint-disable no-console */
const db = require("../db");

/* ===== Config & Utils ===== */

const IS_DEV = process.env.NODE_ENV !== "production";
function logDev(...args) { if (IS_DEV) console.log(...args); }

const LIMITE_NOME_TURMA = 100;
const len = (s) => String(s ?? "").trim().length;
const nomeOk = (s) => len(s) <= LIMITE_NOME_TURMA;

function validarDatasPayload(datas) {
  if (!Array.isArray(datas) || datas.length === 0) {
    return { ok: false, msg: "Envie ao menos 1 data." };
  }
  for (const d of datas) {
    if (!d?.data || !/^\d{4}-\d{2}-\d{2}$/.test(d.data)) {
      return { ok: false, msg: "Campo 'data' deve estar em formato YYYY-MM-DD." };
    }
    if (d.horario_inicio && !/^\d{2}:\d{2}$/.test(d.horario_inicio)) {
      return { ok: false, msg: "Campo 'horario_inicio' deve estar em HH:MM." };
    }
    if (d.horario_fim && !/^\d{2}:\d{2}$/.test(d.horario_fim)) {
      return { ok: false, msg: "Campo 'horario_fim' deve estar em HH:MM." };
    }
  }
  return { ok: true };
}

function ordenarDatas(datas = []) {
  return [...datas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

function minutesBetween(hhmmIni, hhmmFim) {
  if (!hhmmIni || !hhmmFim) return 0;
  const [h1, m1] = hhmmIni.split(":").map(Number);
  const [h2, m2] = hhmmFim.split(":").map(Number);
  if (![h1, m1, h2, m2].every(Number.isFinite)) return 0;
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

// regra: se um encontro tiver ≥6h (360min), desconta 1h almoço
function somaHorasDatas(datas = []) {
  let totalMin = 0;
  for (const d of datas) {
    const mins = minutesBetween(d.horario_inicio, d.horario_fim);
    if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
  }
  return totalMin / 60;
}

// moda simples: pega o valor mais frequente; em empate, menor lexical
function moda(values = []) {
  const cnt = new Map();
  for (const v of values) {
    if (!v) continue;
    cnt.set(v, (cnt.get(v) || 0) + 1);
  }
  let best = null;
  let bestN = -1;
  for (const [v, n] of cnt.entries()) {
    if (n > bestN || (n === bestN && String(v) < String(best))) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/* ===== helpers internos ===== */

async function setAssinanteSilencioso(client, turmaId, instrutorAssinanteId) {
  if (!Number.isFinite(Number(instrutorAssinanteId))) return;
  // tenta coluna 'instrutor_assinante_id'
  try {
    await client.query(
      `UPDATE turmas SET instrutor_assinante_id = $2 WHERE id = $1`,
      [turmaId, instrutorAssinanteId]
    );
    return;
  } catch (_) {}
  // fallback: tenta 'assinante_instrutor_id'
  try {
    await client.query(
      `UPDATE turmas SET assinante_instrutor_id = $2 WHERE id = $1`,
      [turmaId, instrutorAssinanteId]
    );
  } catch (_) {
    // ignora silenciosamente se não existir coluna
  }
}

/* ===== 🎯 Criar turma ===== */
// POST /api/turmas
async function criarTurma(req, res) {
  const client = await db.getClient();
  try {
    const {
      evento_id,
      nome,
      vagas_total = null,
      datas = [], // [{data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM'}]
      instrutores = [],       // 👈 novo: lista de IDs
      instrutor_assinante_id  // 👈 novo: ID do instrutor que assina certificado
    } = req.body;

    if (!evento_id || !nome) {
      return res.status(400).json({ erro: "Evento e nome são obrigatórios." });
    }
    if (!nomeOk(nome)) {
      return res.status(422).json({
        erro: "VALIDACAO_TAMANHO",
        campo: "nome",
        limite: LIMITE_NOME_TURMA,
        recebido: len(nome),
        mensagem: `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres (recebido: ${len(nome)}).`,
      });
    }

    const v = validarDatasPayload(datas);
    if (!v.ok) return res.status(400).json({ erro: v.msg });

    // normaliza e ordena cronologicamente
    const datasOrdenadas = ordenarDatas(datas);

    const data_inicio = datasOrdenadas[0].data;
    const data_fim = datasOrdenadas[datasOrdenadas.length - 1].data;
    const horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
    const horario_fim    = datasOrdenadas[0]?.horario_fim || null;

    const carga_horaria_calc = somaHorasDatas(datasOrdenadas);
    const carga_horaria_int  = Math.round(carga_horaria_calc);

    await client.query("BEGIN");

    // cria turma
    const { rows: insTurma } = await client.query(
      `
      INSERT INTO turmas (
        evento_id,
        nome,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        vagas_total,
        carga_horaria
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        evento_id,
        String(nome).trim(),
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        vagas_total,
        carga_horaria_int,
      ]
    );
    const turma_id = insTurma[0].id;
    logDev("criarTurma -> nova turma id:", turma_id);

    // datas_turma
    const insertData = `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datasOrdenadas) {
      await client.query(insertData, [
        turma_id,
        d.data,
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    // 👇 vincula instrutores na turma
    if (Array.isArray(instrutores) && instrutores.length > 0) {
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, instrutorId]
        );
      }
    }

    // 👇 define assinante da turma (silencioso)
    if (instrutor_assinante_id) {
      await setAssinanteSilencioso(client, turma_id, Number(instrutor_assinante_id));
    }

    await client.query("COMMIT");
    return res.status(201).json({ turma_id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ criarTurma erro:", e);
    return res.status(500).json({ erro: "Erro ao criar turma." });
  } finally {
    client.release();
  }
}

/* ===== ✏️ Atualizar turma ===== */
// PUT /api/turmas/:id
async function atualizarTurma(req, res) {
  const client = await db.getClient();
  try {
    const turma_id = Number(req.params.id);
    if (!Number.isFinite(turma_id) || turma_id <= 0) {
      return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
    }

    const {
      nome,
      vagas_total = null,
      datas = [],
      instrutores,             // opcional: lista para substituir vínculos
      instrutor_assinante_id   // opcional: define/atualiza assinante
    } = req.body;

    if (nome != null && !nomeOk(nome)) {
      return res.status(422).json({
        erro: "VALIDACAO_TAMANHO",
        campo: "nome",
        limite: LIMITE_NOME_TURMA,
        recebido: len(nome),
        mensagem: `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres (recebido: ${len(nome)}).`,
      });
    }

    const v = validarDatasPayload(datas);
    if (!v.ok) return res.status(400).json({ erro: v.msg });

    const datasOrdenadas = ordenarDatas(datas);

    const data_inicio    = datasOrdenadas[0].data;
    const data_fim       = datasOrdenadas[datasOrdenadas.length - 1].data;
    const horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
    const horario_fim    = datasOrdenadas[0]?.horario_fim || null;

    const carga_horaria_calc = somaHorasDatas(datasOrdenadas);
    const carga_horaria_int  = Math.round(carga_horaria_calc);

    await client.query("BEGIN");

    // atualiza turma
    await client.query(
      `
      UPDATE turmas 
      SET 
        nome            = COALESCE($2, nome),
        vagas_total     = COALESCE($3, vagas_total),
        data_inicio     = $4,
        data_fim        = $5,
        horario_inicio  = $6,
        horario_fim     = $7,
        carga_horaria   = $8
      WHERE id = $1
      `,
      [
        turma_id,
        nome != null ? String(nome).trim() : null,
        vagas_total,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        carga_horaria_int,
      ]
    );

    // recria datas
    await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [turma_id]);

    const insertData = `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datasOrdenadas) {
      await client.query(insertData, [
        turma_id,
        d.data,
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    // substituir vínculos de instrutores, se enviado
    if (Array.isArray(instrutores)) {
      await client.query(`DELETE FROM turma_instrutor WHERE turma_id = $1`, [turma_id]);
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, instrutorId]
        );
      }
    }

    // atualizar assinante, se enviado
    if (instrutor_assinante_id != null) {
      await setAssinanteSilencioso(client, turma_id, Number(instrutor_assinante_id));
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ atualizarTurma erro:", e);
    return res.status(500).json({ erro: "Erro ao atualizar turma." });
  } finally {
    client.release();
  }
}

/* ===== ➕ Adicionar instrutor(es) à TURMA ===== */
// POST /api/turmas/:id/instrutores
async function adicionarInstrutor(req, res) {
  const turma_id = Number(req.params.id);
  const { instrutores } = req.body; // array de ids

  if (!Number.isFinite(turma_id)) {
    return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  }
  if (!Array.isArray(instrutores) || instrutores.length === 0) {
    return res.status(400).json({ erro: "Lista de instrutores inválida." });
  }

  try {
    const t = await db.query(`SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (t.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    for (const instrutor_id of instrutores) {
      await db.query(
        `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [turma_id, instrutor_id]
      );
    }

    return res.status(201).json({ mensagem: "Instrutor(es) adicionados à turma com sucesso." });
  } catch (err) {
    console.error("❌ adicionarInstrutor erro:", err);
    return res.status(500).json({ erro: "Erro ao adicionar instrutor à turma." });
  }
}

/* ===== 📋 Listar turmas por evento (com datas, vagas e instrutores) ===== */
// GET /api/eventos/:evento_id/turmas
// Usa datas_turma para período/horários reais.
async function listarTurmasPorEvento(req, res) {
  const { evento_id } = req.params;

  try {
    // (1) Turmas base
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
        t.carga_horaria,
        e.titulo AS evento_titulo
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
      `,
      [evento_id]
    );

    const turmas = turmasResult.rows;
    if (turmas.length === 0) return res.json([]);

    const turmaIds = turmas.map((t) => t.id);

    // (2) Datas reais
    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data, 
             to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
             to_char(horario_fim,   'HH24:MI')   AS horario_fim
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );

    const datasPorTurma = {};
    for (const r of datasResult.rows) {
      if (!datasPorTurma[r.turma_id]) datasPorTurma[r.turma_id] = [];
      datasPorTurma[r.turma_id].push({
        data: r.data.toISOString().slice(0, 10),
        horario_inicio: r.horario_inicio || null,
        horario_fim: r.horario_fim || null,
      });
    }

    // (3) Inscritos (detalhes)
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
      ORDER BY u.nome
      `,
      [turmaIds]
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

    // (4) Instrutores por turma
    const instrutoresResult = await db.query(
      `
      SELECT ti.turma_id, u.id, u.nome, u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      WHERE ti.turma_id = ANY($1::int[])
      ORDER BY ti.turma_id, u.nome
      `,
      [turmaIds]
    );
    const instrPorTurma = {};
    for (const r of instrutoresResult.rows) {
      if (!instrPorTurma[r.turma_id]) instrPorTurma[r.turma_id] = [];
      instrPorTurma[r.turma_id].push({ id: r.id, nome: r.nome, email: r.email });
    }

    // (5) Montagem final
    const resposta = turmas
      .map((t) => {
        const datas = datasPorTurma[t.id] || [];
        const carga_horaria_real = somaHorasDatas(datas);

        const min = datas[0]?.data || (t.data_inicio ? String(t.data_inicio).slice(0, 10) : null);
        const max = datas[datas.length - 1]?.data || (t.data_fim ? String(t.data_fim).slice(0, 10) : null);

        const hiModa = moda(datas.map((d) => d.horario_inicio).filter(Boolean));
        const hfModa = moda(datas.map((d) => d.horario_fim).filter(Boolean));

        const inscritos = inscritosPorTurma[t.id] || [];
        const totalInscritos = inscritos.length;
        const vagas_total = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
        const vagas_disponiveis = Math.max(0, vagas_total - totalInscritos);

        return {
          id: t.id,
          nome: t.nome,
          evento_titulo: t.evento_titulo,
          data_inicio: min,
          data_fim: max,
          horario_inicio: hiModa || (t.horario_inicio ? String(t.horario_inicio).slice(0, 5) : null),
          horario_fim:   hfModa || (t.horario_fim   ? String(t.horario_fim).slice(0, 5) : null),
          vagas_total,
          vagas_disponiveis,
          carga_horaria: t.carga_horaria,
          carga_horaria_real,
          datas,
          instrutores: instrPorTurma[t.id] || [],
          inscritos,
          inscritos_confirmados: totalInscritos,
          vagas_preenchidas: totalInscritos,
        };
      })
      .sort((a, b) => String(a.data_inicio || "").localeCompare(String(b.data_inicio || "")));

    return res.json(resposta);
  } catch (err) {
    console.error("❌ listarTurmasPorEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas." });
  }
}

/* ===== 🚀 Endpoint leve: obter apenas turmas de um evento (sem inscritos) ===== */
// GET /api/eventos/:evento_id/turmas-simples
async function obterTurmasPorEvento(req, res) {
  const { evento_id } = req.params;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        t.id, 
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        t.vagas_total,
        t.carga_horaria
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.horario_inicio NULLS LAST
      `,
      [evento_id]
    );

    const turmaIds = rows.map((t) => t.id);
    if (turmaIds.length === 0) return res.json([]);

    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data,
             to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
             to_char(horario_fim,   'HH24:MI')   AS horario_fim
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );

    const datasPorTurma = {};
    for (const d of datasResult.rows) {
      if (!datasPorTurma[d.turma_id]) datasPorTurma[d.turma_id] = [];
      datasPorTurma[d.turma_id].push({
        data: d.data.toISOString().slice(0, 10),
        horario_inicio: d.horario_inicio || null,
        horario_fim: d.horario_fim || null,
      });
    }

    // incluir instrutores por turma (útil no frontend leve)
    const instrutoresResult = await db.query(
      `
      SELECT ti.turma_id, u.id, u.nome
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      WHERE ti.turma_id = ANY($1::int[])
      ORDER BY ti.turma_id, u.nome
      `,
      [turmaIds]
    );
    const instrPorTurma = {};
    for (const r of instrutoresResult.rows) {
      if (!instrPorTurma[r.turma_id]) instrPorTurma[r.turma_id] = [];
      instrPorTurma[r.turma_id].push({ id: r.id, nome: r.nome });
    }

    const resposta = rows.map((t) => ({
      ...t,
      datas: datasPorTurma[t.id] || [],
      instrutores: instrPorTurma[t.id] || [],
    }));

    return res.json(resposta);
  } catch (err) {
    console.error("❌ obterTurmasPorEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}


/* ===== 👨‍🏫 Listar turmas do instrutor (com datas reais + presenças) ===== */
// GET /api/turmas/instrutor
async function listarTurmasDoInstrutor(req, res) {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });

    // (1) Turmas onde usuário é instrutor (via turma_instrutor)
    const turmasResult = await db.query(
      `
      SELECT 
        t.id,
        t.nome,
        t.data_inicio,
        t.data_fim,
        t.vagas_total,
        t.carga_horaria,
        e.id     AS evento_id,
        e.titulo AS evento_titulo
      FROM turma_instrutor ti
      JOIN turmas t  ON t.id = ti.turma_id
      JOIN eventos e ON e.id = t.evento_id
      WHERE ti.instrutor_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
      `,
      [usuarioId]
    );
    const turmas = turmasResult.rows;
    if (turmas.length === 0) return res.json([]);

    const turmaIds = turmas.map((t) => t.id);

    // (2) Datas reais
    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data, 
             to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
             to_char(horario_fim, 'HH24:MI')   AS horario_fim
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );
    const datasPorTurma = {};
    for (const r of datasResult.rows) {
      if (!datasPorTurma[r.turma_id]) datasPorTurma[r.turma_id] = [];
      datasPorTurma[r.turma_id].push({
        data: r.data.toISOString().slice(0, 10),
        horario_inicio: r.horario_inicio || null,
        horario_fim: r.horario_fim || null,
      });
    }

    // (3) Inscritos
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
      ORDER BY u.nome
      `,
      [turmaIds]
    );

    // (4) Presenças
    // Observação: alguns bancos têm 'data' e outros 'data_presenca'; aqui usamos data_presenca.
    // Se o seu tiver 'data', ajuste conforme necessário ou crie uma VIEW padronizada.
    let presencasResult;
    try {
      presencasResult = await db.query(
        `
        SELECT turma_id, usuario_id, data_presenca::date AS data, presente
        FROM presencas
        WHERE turma_id = ANY($1::int[])
        `,
        [turmaIds]
      );
    } catch {
      presencasResult = await db.query(
        `
        SELECT turma_id, usuario_id, data::date AS data, presente
        FROM presencas
        WHERE turma_id = ANY($1::int[])
        `,
        [turmaIds]
      );
    }

    // index de presenças p/ lookup rápido
    const mapaPresencas = {};
    for (const row of presencasResult.rows) {
      const dataStr = row.data.toISOString().slice(0, 10);
      const key = `${row.turma_id}-${row.usuario_id}-${dataStr}`;
      mapaPresencas[key] = row.presente === true;
    }

    const turmasComInscritos = turmas.map((turma) => {
      const datas = datasPorTurma[turma.id] || [];
      const min =
        datas[0]?.data ||
        (turma.data_inicio ? String(turma.data_inicio).slice(0, 10) : null);
      const max =
        datas[datas.length - 1]?.data ||
        (turma.data_fim ? String(turma.data_fim).slice(0, 10) : null);

      // limite para confirmar presença (até 48h depois do último dia)
      const fimTurma = max ? new Date(`${max}T23:59:59`) :
        turma.data_fim ? new Date(turma.data_fim) : new Date();
      fimTurma.setTime(fimTurma.getTime() + 48 * 60 * 60 * 1000);

      const inscritos = inscritosResult.rows
        .filter((r) => r.turma_id === turma.id)
        .map((inscrito) => {
          const datasPresenca = datas.map((d) => {
            const dataISO = d.data;
            const hoje = new Date();
            const dataAula = new Date(`${dataISO}T12:00:00`); // meio-dia evita DST
            const chave = `${turma.id}-${inscrito.usuario_id}-${dataISO}`;

            const presente = !!mapaPresencas[chave];
            const pode_confirmar = !presente && hoje <= fimTurma && dataAula < hoje;

            let status = "aguardando";
            if (presente) status = "presente";
            else if (dataAula < hoje) status = "faltou";

            return { data: dataISO, presente, status, pode_confirmar };
          });

          return {
            id: inscrito.usuario_id,
            nome: inscrito.nome,
            email: inscrito.email,
            cpf: inscrito.cpf,
            datas: datasPresenca,
          };
        });

      return { ...turma, data_inicio: min, data_fim: max, datas, inscritos };
    });

    // ordena pelo início da turma
    turmasComInscritos.sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)));

    return res.json(turmasComInscritos);
  } catch (error) {
    console.error("❌ listarTurmasDoInstrutor erro:", error);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

/* ===== 👥 Listar instrutor(es) da turma ===== */
// GET /api/turmas/:id/instrutores
async function listarInstrutorDaTurma(req, res) {
  const turma_id = Number(req.params.id);

  if (!Number.isFinite(turma_id)) {
    return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  }

  try {
    const t = await db.query(`SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (t.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const resultado = await db.query(
      `
      SELECT 
        u.id,
        u.nome,
        u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON ti.instrutor_id = u.id
      WHERE ti.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );

    return res.json(resultado.rows);
  } catch (err) {
    console.error("❌ listarInstrutorDaTurma erro:", err);
    return res.status(500).json({ erro: "Erro ao listar instrutor(es) da turma." });
  }
}

/* ===== 🗑️ Excluir turma ===== */
async function excluirTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!turmaId) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // 0) check turma
    const checkTurma = await client.query("SELECT id FROM turmas WHERE id = $1", [turmaId]);
    if (checkTurma.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    // 1) contagens relacionadas
    const { rows: [agg] } = await client.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM presencas    WHERE turma_id = $1) AS presencas,
        (SELECT COUNT(*)::int FROM certificados WHERE turma_id = $1) AS certificados,
        (SELECT COUNT(*)::int FROM inscricoes   WHERE turma_id = $1) AS inscricoes
      `,
      [turmaId]
    );

    // 2) não pode excluir se tem presencas/certificados
    if ((agg.presencas ?? 0) > 0 || (agg.certificados ?? 0) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro: "TURMA_COM_REGISTROS",
        detalhe: "Turma possui presenças ou certificados. Exclusão bloqueada.",
        contagens: agg,
      });
    }

    // 3) exclui inscrições
    if ((agg.inscricoes ?? 0) > 0) {
      await client.query("DELETE FROM inscricoes WHERE turma_id = $1", [turmaId]);
    }

    // 4) exclui vínculos de instrutores
    await client.query("DELETE FROM turma_instrutor WHERE turma_id = $1", [turmaId]);

    // 5) exclui datas_turma
    try {
      await client.query("DELETE FROM datas_turma WHERE turma_id = $1", [turmaId]);
    } catch (errDT) {
      logDev("excluirTurma: datas_turma ausente/legado:", errDT.message);
    }

    // 6) exclui a própria turma
    const delTurma = await client.query("DELETE FROM turmas WHERE id = $1", [turmaId]);
    if (delTurma.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    await client.query("COMMIT");
    return res.json({ ok: true, mensagem: "Turma excluída com sucesso.", turma_id: turmaId });
  } catch (err) {
    console.error("❌ excluirTurma erro:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ erro: "Erro ao excluir turma." });
  } finally {
    client.release();
  }
}

/* ===== 🔎 Obter título do evento e nomes dos instrutores ===== */
// GET /api/turmas/:id/detalhes
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
            FROM turma_instrutor ti
            JOIN usuarios u ON u.id = ti.instrutor_id
            WHERE ti.turma_id = t.id
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
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error("❌ obterDetalhesTurma erro:", err);
    return res.status(500).json({ erro: "Erro ao obter detalhes da turma." });
  }
}

/* ===== 📦 Listar todas as turmas com usuários ===== */
// GET /api/turmas
async function listarTurmasComUsuarios(req, res) {
  try {
    // Base de turmas
    const turmasResult = await db.query(
      `
      SELECT 
        t.id,
        t.nome,
        t.evento_id,
        e.titulo AS titulo_evento
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      `
    );
    const turmas = turmasResult.rows;
    if (turmas.length === 0) return res.json([]);

    const turmaIds = turmas.map((t) => t.id);

    // Datas reais
    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );

    const minDataPorTurma = {};
    const maxDataPorTurma = {};
    for (const r of datasResult.rows) {
      const dataIso = r.data.toISOString().slice(0, 10);
      if (!minDataPorTurma[r.turma_id]) minDataPorTurma[r.turma_id] = dataIso;
      maxDataPorTurma[r.turma_id] = dataIso;
    }

    // Inscritos + flag presença
    let inscritosResult;
    try {
      inscritosResult = await db.query(
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
        [turmaIds]
      );
    } catch {
      // fallback se a view/coluna variar
      inscritosResult = await db.query(
        `
        SELECT 
          i.turma_id,
          u.id AS usuario_id,
          u.nome,
          u.email,
          u.cpf,
          FALSE AS presente
        FROM inscricoes i
        JOIN usuarios u ON u.id = i.usuario_id
        WHERE i.turma_id = ANY($1::int[])
        ORDER BY u.nome
        `,
        [turmaIds]
      );
    }

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

    const resposta = turmas
      .map((t) => ([
        {
          id: t.id,
          nome: t.nome,
          evento_id: t.evento_id,
          titulo_evento: t.titulo_evento,
          data_inicio: minDataPorTurma[t.id] || null,
          data_fim: maxDataPorTurma[t.id] || null,
          usuarios: inscritosPorTurma[t.id] || [],
        }
      ][0]))
      .sort((a, b) => String(b.data_inicio || "").localeCompare(String(a.data_inicio || ""))); // mais novo primeiro

    return res.json(resposta);
  } catch (err) {
    console.error("❌ listarTurmasComUsuarios erro:", err);
    return res.status(500).json({ erro: "Erro interno ao buscar turmas com usuarios." });
  }
}

module.exports = {
  // nomes consistentes
  criarTurma,
  atualizarTurma,
  excluirTurma,
  listarTurmasPorEvento,
  adicionarInstrutor,         // agora por TURMA
  listarInstrutorDaTurma,
  obterDetalhesTurma,
  listarTurmasComUsuarios,
  listarTurmasDoInstrutor,
  obterTurmasPorEvento,

  // ✅ aliases retrocompatíveis
  editarTurma: atualizarTurma,
  adicionarinstrutor: adicionarInstrutor,
  listarinstrutorDaTurma: listarInstrutorDaTurma,
  listarTurmasComusuarios: listarTurmasComUsuarios,
  listarTurmasDoinstrutor: listarTurmasDoInstrutor,
};
