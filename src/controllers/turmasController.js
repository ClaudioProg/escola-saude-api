/* eslint-disable no-console */
// ✅ src/controllers/turmasController.js — UNIFICADO
const db = require("../db");

/* ───────────────── Config & Utils ───────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";
const logT = (...a) => IS_DEV && console.log("[TURMA]", ...a);
const warnT = (...a) => IS_DEV && console.warn("[TURMA]", ...a);
const errT = (...a) => console.error("[TURMA]", ...a);

const LIMITE_NOME_TURMA = 100;
const len = (s) => String(s ?? "").trim().length;
const nomeOk = (s) => len(s) <= LIMITE_NOME_TURMA;

function validarDatasPayload(datas) {
  if (!Array.isArray(datas) || datas.length === 0) {
    // 🔄 Para ATUALIZAÇÃO, quem decide se valida é quem chama.
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

// regra: se um encontro tiver ≥6h (360min), desconta 1h de almoço
function somaHorasDatas(datas = []) {
  let totalMin = 0;
  for (const d of datas) {
    const mins = minutesBetween(d.horario_inicio, d.horario_fim);
    if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
  }
  return totalMin / 60;
}

// moda simples
function moda(values = []) {
  const cnt = new Map();
  for (const v of values) {
    if (!v) continue;
    cnt.set(v, (cnt.get(v) || 0) + 1);
  }
  let best = null, bestN = -1;
  for (const [v, n] of cnt.entries()) {
    if (n > bestN || (n === bestN && String(v) < String(best))) {
      best = v; bestN = n;
    }
  }
  return best;
}

/* ───────────────── Flag de assinante no vínculo turma_instrutor ───────────────── */
let _hasIsAssinanteTI = null;
async function hasIsAssinanteCol(client) {
  if (_hasIsAssinanteTI === null) {
    const q = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'turma_instrutor'
          AND column_name = 'is_assinante'
      ) AS ok;
    `);
    _hasIsAssinanteTI = !!q.rows?.[0]?.ok;
    logT("is_assinante em turma_instrutor:", _hasIsAssinanteTI ? "SIM" : "NÃO");
  }
  return _hasIsAssinanteTI;
}

async function marcarAssinanteEmTurmaInstrutor(client, turmaId, instrutorId) {
  if (!Number.isFinite(Number(instrutorId))) return;
  if (!(await hasIsAssinanteCol(client))) return;
  await client.query(`UPDATE turma_instrutor SET is_assinante = FALSE WHERE turma_id = $1`, [turmaId]);
  await client.query(
    `UPDATE turma_instrutor SET is_assinante = TRUE WHERE turma_id = $1 AND instrutor_id = $2`,
    [turmaId, instrutorId]
  );
}

async function setAssinanteSilencioso(client, turmaId, instrutorAssinanteId) {
  if (!Number.isFinite(Number(instrutorAssinanteId))) return;
  try {
    await client.query(`UPDATE turmas SET instrutor_assinante_id = $2 WHERE id = $1`, [turmaId, instrutorAssinanteId]);
    return;
  } catch (_) {}
  try {
    await client.query(`UPDATE turmas SET assinante_instrutor_id = $2 WHERE id = $1`, [turmaId, instrutorAssinanteId]);
  } catch (_) {}
}

/* ───────────────── CRUD de turmas ───────────────── */
// POST /api/turmas
async function criarTurma(req, res) {
  const client = await db.getClient();
  try {
    const {
      evento_id,
      nome,
      vagas_total = null,
      // agora OPCIONAL:
      datas, // [{data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM'}]
      // NOVOS campos diretos (opcionais) para casos sem 'datas'
      data_inicio: di_payload,
      data_fim: df_payload,
      horario_inicio: hi_payload,
      horario_fim: hf_payload,

      instrutores = [],
      instrutor_assinante_id,
    } = req.body;

    logT("criarTurma body:", {
      keys: Object.keys(req.body || {}),
      evento_id,
      nomeLen: len(nome),
      vagas_total,
      datasCount: Array.isArray(datas) ? datas.length : 0,
      instrutoresCount: Array.isArray(instrutores) ? instrutores.length : 0,
      instrutor_assinante_id,
    });

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

    let datasOrdenadas = [];
    let data_inicio = null, data_fim = null, horario_inicio = null, horario_fim = null, carga_int = null;

    // ✅ Se vier 'datas' NÃO vazias, validamos e calculamos tudo por elas
    const temDatas = Array.isArray(datas) && datas.length > 0;
    if (temDatas) {
      const v = validarDatasPayload(datas);
      if (!v.ok) return res.status(400).json({ erro: v.msg });

      datasOrdenadas = ordenarDatas(datas);
      data_inicio    = datasOrdenadas[0].data;
      data_fim       = datasOrdenadas[datasOrdenadas.length - 1].data;
      horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
      horario_fim    = datasOrdenadas[0]?.horario_fim    || null;
      carga_int      = Math.round(somaHorasDatas(datasOrdenadas));
    } else {
      // ✅ Sem 'datas': usamos o que vier direto no payload (ou deixamos NULL)
      data_inicio    = di_payload ?? null;
      data_fim       = df_payload ?? di_payload ?? null;
      horario_inicio = hi_payload ?? null;
      horario_fim    = hf_payload ?? null;
      carga_int      = null; // sem encontros não inferimos carga
    }

    await client.query("BEGIN");

    const { rows: insTurma } = await client.query(
      `
      INSERT INTO turmas (
        evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
        vagas_total, carga_horaria
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [evento_id, String(nome).trim(), data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_int]
    );
    const turma_id = insTurma[0].id;
    logT("criarTurma -> turma_id:", turma_id);

    // 📅 Grava datas_turma SOMENTE se 'datas' vieram
    if (temDatas) {
      const insertData = `
        INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
        VALUES ($1, $2, $3, $4)
      `;
      for (const d of datasOrdenadas) {
        await client.query(insertData, [turma_id, d.data, d.horario_inicio || null, d.horario_fim || null]);
      }
      logT("criarTurma -> datas gravadas:", datasOrdenadas.length);
    } else {
      logT("criarTurma -> nenhuma 'datas' enviada; criada sem encontros.");
    }

    // vínculos de instrutores (inalterado)
    if (Array.isArray(instrutores) && instrutores.length > 0) {
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, instrutorId]
        );
      }
      logT("criarTurma -> instrutores vinculados:", instrutores.length);
    }

    // assinante (atualizado para marcar também no vínculo)
if (instrutor_assinante_id) {
  await setAssinanteSilencioso(client, turma_id, Number(instrutor_assinante_id));
  await marcarAssinanteEmTurmaInstrutor(client, turma_id, Number(instrutor_assinante_id));
  logT("criarTurma -> assinante set:", instrutor_assinante_id);
}

    await client.query("COMMIT");
    return res.status(201).json({ turma_id });
  } catch (e) {
    await client.query("ROLLBACK");
    errT("criarTurma erro:", e);
    return res.status(500).json({ erro: "Erro ao criar turma." });
  } finally {
    client.release();
  }
}

// PUT /api/turmas/:id  (AGORA aceita atualização parcial sem datas)
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
      datas,                  // opcional para atualização parcial
      instrutores,            // opcional: substitui vínculos
      instrutor_assinante_id, // opcional
    } = req.body;

    logT("atualizarTurma id:", turma_id, "bodyKeys:", Object.keys(req.body || {}), "datasCount:", Array.isArray(datas) ? datas.length : "(nao enviado)");

    if (nome != null && !nomeOk(nome)) {
      return res.status(422).json({
        erro: "VALIDACAO_TAMANHO",
        campo: "nome",
        limite: LIMITE_NOME_TURMA,
        recebido: len(nome),
        mensagem: `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres (recebido: ${len(nome)}).`,
      });
    }

    // Se datas vieram e tiverem conteúdo -> valida e prepara; caso contrário, atualização parcial SEM mexer em datas
    let datasOrdenadas = [];
    let data_inicio = null, data_fim = null, horario_inicio = null, horario_fim = null, carga_int = null;
    const veioDatas = Array.isArray(datas) && datas.length > 0;

    if (veioDatas) {
      const v = validarDatasPayload(datas);
      if (!v.ok) return res.status(400).json({ erro: v.msg });

      datasOrdenadas = ordenarDatas(datas);
      data_inicio    = datasOrdenadas[0].data;
      data_fim       = datasOrdenadas[datasOrdenadas.length - 1].data;
      horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
      horario_fim    = datasOrdenadas[0]?.horario_fim || null;
      carga_int      = Math.round(somaHorasDatas(datasOrdenadas));
    }

    await client.query("BEGIN");

    // Monta UPDATE dinâmico (parcial)
    const setCols = [];
    const params = [turma_id];

    if (nome != null) {
      setCols.push(`nome = $${params.length + 1}`);
      params.push(String(nome).trim());
    }
    if (vagas_total != null) {
      setCols.push(`vagas_total = $${params.length + 1}`);
      params.push(vagas_total);
    }
    if (veioDatas) {
      setCols.push(`data_inicio = $${params.length + 1}`); params.push(data_inicio);
      setCols.push(`data_fim = $${params.length + 1}`);    params.push(data_fim);
      setCols.push(`horario_inicio = $${params.length + 1}`); params.push(horario_inicio);
      setCols.push(`horario_fim = $${params.length + 1}`);    params.push(horario_fim);
      setCols.push(`carga_horaria = $${params.length + 1}`);  params.push(carga_int);
    }

    if (setCols.length > 0) {
      const up = await client.query(
        `UPDATE turmas SET ${setCols.join(", ")} WHERE id = $1`,
        params
      );
      logT("atualizarTurma UPDATE rowCount:", up.rowCount, "| set:", setCols);
    } else {
      logT("atualizarTurma: nada para atualizar em turmas (campos de corpo ausentes).");
    }

    // Regrava datas_turma SOMENTE se o payload trouxe datas
    if (veioDatas) {
      await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [turma_id]);
      const insertData = `
        INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
        VALUES ($1, $2, $3, $4)
      `;
      for (const d of datasOrdenadas) {
        await client.query(insertData, [turma_id, d.data, d.horario_inicio || null, d.horario_fim || null]);
      }
      logT("atualizarTurma -> datas regravadas:", datasOrdenadas.length);
    }

    // Substitui vínculos de instrutores se enviado
    if (Array.isArray(instrutores)) {
      await client.query(`DELETE FROM turma_instrutor WHERE turma_id = $1`, [turma_id]);
      let added = 0;
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, instrutorId]
        );
        added++;
      }
      logT("atualizarTurma -> instrutores set:", added);
    }
    // se houver assinante informado, marca flag também no vínculo

if (instrutor_assinante_id != null) {
  await setAssinanteSilencioso(client, turma_id, Number(instrutor_assinante_id));
  await marcarAssinanteEmTurmaInstrutor(client, turma_id, Number(instrutor_assinante_id));
  logT("atualizarTurma -> assinante set:", instrutor_assinante_id);
}

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    errT("atualizarTurma erro:", e);
    return res.status(500).json({ erro: "Erro ao atualizar turma." });
  } finally {
    client.release();
  }
}

// GET /api/turmas/:id  → turma completa para o “Editar”
async function obterTurmaCompleta(req, res) {
  const turma_id = Number(req.params.id);
  if (!Number.isFinite(turma_id)) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  try {
    const { rows, rowCount } = await db.query(
      `
      SELECT 
        t.id, t.evento_id, t.nome,
        t.data_inicio, t.data_fim,
        t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria,
        COALESCE(t.instrutor_assinante_id, t.assinante_instrutor_id) AS instrutor_assinante_id,
        u.nome AS assinante_nome
      FROM turmas t
      LEFT JOIN usuarios u ON u.id = COALESCE(t.instrutor_assinante_id, t.assinante_instrutor_id)
      WHERE t.id = $1
      `,
      [turma_id]
    );
    if (rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });
    const t = rows[0];
    logT("obterTurmaCompleta base:", { id: t.id, nome: t.nome });

    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data,
             to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
             to_char(horario_fim,   'HH24:MI')   AS horario_fim
      FROM datas_turma
      WHERE turma_id = $1
      ORDER BY data
      `,
      [turma_id]
    );
    const datas = datasResult.rows.map((d) => ({
      data: d.data.toISOString().slice(0, 10),
      horario_inicio: d.horario_inicio || null,
      horario_fim: d.horario_fim || null,
    }));

    const instrutoresResult = await db.query(
      `
      SELECT u.id, u.nome, u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      WHERE ti.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );

    // busca o assinante marcado por vínculo (is_assinante = true)
const assinTI = await db.query(`
  SELECT u.id, u.nome
  FROM turma_instrutor ti
  JOIN usuarios u ON u.id = ti.instrutor_id
  WHERE ti.turma_id = $1 AND ti.is_assinante = TRUE
  LIMIT 1
`, [turma_id]);

    return res.json({
      ...t,
      horario_inicio: t.horario_inicio ? String(t.horario_inicio).slice(0, 5) : null,
      horario_fim: t.horario_fim ? String(t.horario_fim).slice(0, 5) : null,
      assinante_id: t.instrutor_assinante_id ?? null,
      instrutor_assinante_id: t.instrutor_assinante_id ?? null,
      assinante_nome: t.assinante_nome ?? null,
      assinante_por_vinculo: assinTI.rows?.[0] || null,
      datas,
      instrutores: instrutoresResult.rows,
    });
  } catch (err) {
    errT("obterTurmaCompleta erro:", err);
    return res.status(500).json({ erro: "Erro ao obter turma." });
  }
}

// GET /api/turmas/:id/datas
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!Number.isFinite(turmaId) || turmaId <= 0) {
    return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT 
        data::date AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim,   'HH24:MI') AS horario_fim
      FROM datas_turma
      WHERE turma_id = $1
      ORDER BY data
      `,
      [turmaId]
    );

    const datas = rows.map((r) => ({
      data: r.data.toISOString().slice(0, 10),
      horario_inicio: r.horario_inicio || null,
      horario_fim: r.horario_fim || null,
    }));

    return res.json(datas);
  } catch (err) {
    errT("listarDatasDaTurma erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar datas da turma." });
  }
}

/* ───── vínculos de instrutores ───── */
async function adicionarInstrutor(req, res) {
  const turma_id = Number(req.params.id);
  const { instrutores } = req.body;
  if (!Number.isFinite(turma_id)) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  if (!Array.isArray(instrutores) || instrutores.length === 0) {
    return res.status(400).json({ erro: "Lista de instrutores inválida." });
  }
  try {
    const t = await db.query(`SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (t.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    let added = 0;
    for (const instrutor_id of instrutores) {
      await db.query(
        `INSERT INTO turma_instrutor (turma_id, instrutor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [turma_id, instrutor_id]
      );
      added++;
    }
    logT("adicionarInstrutor -> adições:", added);
    return res.status(201).json({ mensagem: "Instrutor(es) adicionados à turma com sucesso." });
  } catch (err) {
    errT("adicionarInstrutor erro:", err);
    return res.status(500).json({ erro: "Erro ao adicionar instrutor à turma." });
  }
}

/* ───── listagens ───── */
async function listarTurmasPorEvento(req, res) {
  const { evento_id } = req.params;
  try {
    const turmasResult = await db.query(
      `
      SELECT 
        t.id, t.nome, t.data_inicio, t.data_fim,
        t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria,
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

    const resposta = turmas
      .map((t) => {
        const datas = datasPorTurma[t.id] || [];
        const carga_horaria_real = somaHorasDatas(datas);
        const min = datas[0]?.data || (t.data_inicio ? String(t.data_inicio).slice(0, 10) : null);
        const max = datas[datas.length - 1]?.data || (t.data_fim ? String(t.data_fim).slice(0, 10) : null);

        const hiModa = moda(datas.map((d) => d.horario_inicio).filter(Boolean));
        const hfModa = moda(datas.map((d) => d.horario_fim).filter(Boolean));

        return {
          id: t.id,
          nome: t.nome,
          evento_titulo: t.evento_titulo,
          data_inicio: min,
          data_fim: max,
          horario_inicio: hiModa || (t.horario_inicio ? String(t.horario_inicio).slice(0, 5) : null),
          horario_fim:   hfModa || (t.horario_fim   ? String(t.horario_fim   ).slice(0, 5) : null),
          vagas_total: Number(t.vagas_total ?? 0),
          carga_horaria: t.carga_horaria,
          carga_horaria_real,
          datas,
          instrutores: instrPorTurma[t.id] || [],
        };
      })
      .sort((a, b) => String(a.data_inicio || "").localeCompare(String(b.data_inicio || "")));

    logT("listarTurmasPorEvento count:", resposta.length);
    return res.json(resposta);
  } catch (err) {
    errT("listarTurmasPorEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas." });
  }
}

// GET /api/eventos/:evento_id/turmas-simples (leve, mas com datas)
async function obterTurmasPorEvento(req, res) {
  const { evento_id } = req.params;
  try {
    const { rows } = await db.query(
      `
      SELECT 
        t.id, t.nome, t.data_inicio, t.data_fim,
        t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria,
        COALESCE(t.instrutor_assinante_id, t.assinante_instrutor_id) AS instrutor_assinante_id
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

    const resposta = rows.map((t) => {
      const datas = datasPorTurma[t.id] || [];

      const encontros = datas.map((d) => ({
        data: d.data,
        inicio: d.horario_inicio || (t.horario_inicio ? String(t.horario_inicio).slice(0,5) : null),
        fim:    d.horario_fim    || (t.horario_fim    ? String(t.horario_fim   ).slice(0,5) : null),
      }));

      const hiModa = moda(datas.map((d) => d.horario_inicio).filter(Boolean));
      const hfModa = moda(datas.map((d) => d.horario_fim).filter(Boolean));

      return {
        id: t.id,
        nome: t.nome,
        data_inicio: t.data_inicio ? String(t.data_inicio).slice(0, 10) : null,
        data_fim:    t.data_fim    ? String(t.data_fim).slice(0, 10)    : null,
        horario_inicio: hiModa || (t.horario_inicio ? String(t.horario_inicio).slice(0, 5) : null),
        horario_fim:    hfModa || (t.horario_fim    ? String(t.horario_fim   ).slice(0, 5) : null),
        vagas_total: Number(t.vagas_total ?? 0),
        carga_horaria: t.carga_horaria,
        datas,
        encontros,
        _datas: datas,
        instrutores: instrPorTurma[t.id] || [],
        qtd_encontros: datas.length,
        instrutor_assinante_id: t.instrutor_assinante_id ?? null,
        assinante_id: t.instrutor_assinante_id ?? null,
      };
    });

    logT("obterTurmasPorEvento count:", resposta.length);
    return res.json(resposta);
  } catch (err) {
    errT("obterTurmasPorEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}

/* ───── outras utilidades ───── */
async function listarInstrutorDaTurma(req, res) {
  const turma_id = Number(req.params.id);
  if (!Number.isFinite(turma_id)) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  try {
    const t = await db.query(`SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (t.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });
    const resultado = await db.query(
      `
      SELECT u.id, u.nome, u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON ti.instrutor_id = u.id
      WHERE ti.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );
    return res.json(resultado.rows);
  } catch (err) {
    errT("listarInstrutorDaTurma erro:", err);
    return res.status(500).json({ erro: "Erro ao listar instrutor(es) da turma." });
  }
}

async function obterDetalhesTurma(req, res) {
  const { id } = req.params;
  try {
    const resultado = await db.query(
      `
      SELECT 
        e.titulo AS titulo_evento,
        COALESCE(
          (SELECT string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome)
           FROM turma_instrutor ti JOIN usuarios u ON u.id = ti.instrutor_id
           WHERE ti.turma_id = t.id),
          'Instrutor não definido'
        ) AS nome_instrutor
      FROM turmas t
      JOIN eventos e ON t.evento_id = e.id
      WHERE t.id = $1
      `,
      [id]
    );
    if (resultado.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });
    return res.json(resultado.rows[0]);
  } catch (err) {
    errT("obterDetalhesTurma erro:", err);
    return res.status(500).json({ erro: "Erro ao obter detalhes da turma." });
  }
}

async function listarTurmasComUsuarios(req, res) {
  try {
    const turmasResult = await db.query(
      `
      SELECT t.id, t.nome, t.evento_id, e.titulo AS titulo_evento
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      `
    );
    const turmas = turmasResult.rows;
    if (turmas.length === 0) return res.json([]);
    const turmaIds = turmas.map((t) => t.id);

    const datasResult = await db.query(
      `
      SELECT turma_id, data::date AS data
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );
    const minDataPorTurma = {}, maxDataPorTurma = {};
    for (const r of datasResult.rows) {
      const dataIso = r.data.toISOString().slice(0, 10);
      if (!minDataPorTurma[r.turma_id]) minDataPorTurma[r.turma_id] = dataIso;
      maxDataPorTurma[r.turma_id] = dataIso;
    }

    let inscritosResult;
    try {
      inscritosResult = await db.query(
        `
        SELECT 
          i.turma_id, u.id AS usuario_id, u.nome, u.email, u.cpf,
          EXISTS (
            SELECT 1 FROM presencas p
            WHERE p.usuario_id = u.id AND p.turma_id = i.turma_id AND p.presente = TRUE
          ) AS presente
        FROM inscricoes i
        JOIN usuarios u ON u.id = i.usuario_id
        WHERE i.turma_id = ANY($1::int[])
        ORDER BY u.nome
        `,
        [turmaIds]
      );
    } catch {
      inscritosResult = await db.query(
        `
        SELECT i.turma_id, u.id AS usuario_id, u.nome, u.email, u.cpf, FALSE AS presente
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
        id: row.usuario_id, nome: row.nome, email: row.email, cpf: row.cpf, presente: row.presente === true,
      });
    }

    const resposta = turmas
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        evento_id: t.evento_id,
        titulo_evento: t.titulo_evento,
        data_inicio: minDataPorTurma[t.id] || null,
        data_fim: maxDataPorTurma[t.id] || null,
        usuarios: inscritosPorTurma[t.id] || [],
      }))
      .sort((a, b) => String(b.data_inicio || "").localeCompare(String(a.data_inicio || "")));

    logT("listarTurmasComUsuarios count:", resposta.length);
    return res.json(resposta);
  } catch (err) {
    errT("listarTurmasComUsuarios erro:", err);
    return res.status(500).json({ erro: "Erro interno ao buscar turmas com usuarios." });
  }
}

// DELETE /api/turmas/:id
async function excluirTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!turmaId) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const checkTurma = await client.query("SELECT id FROM turmas WHERE id = $1", [turmaId]);
    if (checkTurma.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const { rows: [agg] } = await client.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM presencas    WHERE turma_id = $1) AS presencas,
        (SELECT COUNT(*)::int FROM certificados WHERE turma_id = $1) AS certificados,
        (SELECT COUNT(*)::int FROM inscricoes   WHERE turma_id = $1) AS inscricoes
      `,
      [turmaId]
    );

    if ((agg.presencas ?? 0) > 0 || (agg.certificados ?? 0) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro: "TURMA_COM_REGISTROS",
        detalhe: "Turma possui presenças ou certificados. Exclusão bloqueada.",
        contagens: agg,
      });
    }

    if ((agg.inscricoes ?? 0) > 0) {
      await client.query("DELETE FROM inscricoes WHERE turma_id = $1", [turmaId]);
    }
    await client.query("DELETE FROM turma_instrutor WHERE turma_id = $1", [turmaId]);
    try { await client.query("DELETE FROM datas_turma WHERE turma_id = $1", [turmaId]); } catch {}

    const delTurma = await client.query("DELETE FROM turmas WHERE id = $1", [turmaId]);
    if (delTurma.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    await client.query("COMMIT");
    return res.json({ ok: true, mensagem: "Turma excluída com sucesso.", turma_id: turmaId });
  } catch (err) {
    errT("excluirTurma erro:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ erro: "Erro ao excluir turma." });
  } finally {
    client.release();
  }
}

/* ───────────────── Exports (inclui aliases) ───────────────── */
module.exports = {
  // principais
  criarTurma,
  atualizarTurma,
  excluirTurma,
  listarTurmasPorEvento,
  obterTurmasPorEvento,
  obterTurmaCompleta,
  adicionarInstrutor,
  listarInstrutorDaTurma,
  obterDetalhesTurma,
  listarTurmasComUsuarios,
  listarDatasDaTurma,

  // aliases (retrocompat)
  editarTurma: atualizarTurma,
  adicionarinstrutor: adicionarInstrutor,
  listarinstrutorDaTurma: listarInstrutorDaTurma,
  listarTurmasDoinstrutor: () => {}, // removido aqui; use endpoints novos
};
