/* eslint-disable no-console */
// ✅ src/controllers/turmaController.js — PREMIUM/UNIFICADO (date-only safe)
"use strict";

/* =========================================================
   DB adapter resiliente + suporte a req.db
========================================================= */
const dbModule = require("../db");
const dbFallback = dbModule?.db ?? dbModule;

function getDb(req) {
  // server pode injetar req.db
  return req?.db ?? dbFallback;
}

async function query(reqOrDb, sql, params) {
  const db = typeof reqOrDb?.query === "function" ? reqOrDb : getDb(reqOrDb);
  if (typeof db?.query === "function") return db.query(sql, params);
  throw new Error("DB adapter inválido: db.query não encontrado.");
}

async function getClient(req) {
  const db = getDb(req);

  if (typeof db?.getClient === "function") return db.getClient();
  if (db?.pool?.connect) return db.pool.connect();
  if (typeof db?.connect === "function") return db.connect(); // fallback raro
  throw new Error("DB adapter inválido: db.getClient/pool.connect não encontrado.");
}

/* ───────────────── Config & Utils ───────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";
const logT = (...a) => IS_DEV && console.log("[TURMA]", ...a);
const warnT = (...a) => IS_DEV && console.warn("[TURMA]", ...a);
const errT = (...a) => console.error("[TURMA]", ...a);

const LIMITE_NOME_TURMA = 100;
const len = (s) => String(s ?? "").trim().length;
const nomeOk = (s) => len(s) <= LIMITE_NOME_TURMA;

const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHHMM = (s) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function assert(cond, msg, status = 400) {
  if (!cond) {
    const e = new Error(msg);
    e.status = status;
    throw e;
  }
}

function validarDatasPayload(datas) {
  if (!Array.isArray(datas) || datas.length === 0) {
    return { ok: false, msg: "Envie ao menos 1 data." };
  }
  for (const d of datas) {
    if (!d?.data || !isISODate(d.data)) {
      return { ok: false, msg: "Campo 'data' deve estar em formato YYYY-MM-DD." };
    }
    if (d.horario_inicio && !isHHMM(d.horario_inicio)) {
      return { ok: false, msg: "Campo 'horario_inicio' deve estar em HH:MM." };
    }
    if (d.horario_fim && !isHHMM(d.horario_fim)) {
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
  const [h1, m1] = String(hhmmIni).split(":").map(Number);
  const [h2, m2] = String(hhmmFim).split(":").map(Number);
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

/* ───────────────── Flag de assinante no vínculo turma_instrutor ───────────────── */
let _hasIsAssinanteTI = null;

async function hasIsAssinanteCol(client) {
  if (_hasIsAssinanteTI === null) {
    const q = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='turma_instrutor'
          AND column_name='is_assinante'
      ) AS ok;
    `
    );
    _hasIsAssinanteTI = !!q.rows?.[0]?.ok;
    logT("is_assinante em turma_instrutor:", _hasIsAssinanteTI ? "SIM" : "NÃO");
  }
  return _hasIsAssinanteTI;
}

async function marcarAssinanteEmTurmaInstrutor(client, turmaId, instrutorId) {
  const tid = toIntOrNull(turmaId);
  const iid = toIntOrNull(instrutorId);
  if (!tid || !iid) return;
  if (!(await hasIsAssinanteCol(client))) return;

  await client.query(`UPDATE turma_instrutor SET is_assinante = FALSE WHERE turma_id = $1`, [tid]);
  await client.query(
    `UPDATE turma_instrutor SET is_assinante = TRUE WHERE turma_id = $1 AND instrutor_id = $2`,
    [tid, iid]
  );
}

async function setAssinanteSilencioso(client, turmaId, instrutorAssinanteId) {
  const tid = toIntOrNull(turmaId);
  const iid = toIntOrNull(instrutorAssinanteId);
  if (!tid) return;

  const v = iid || null;

  // tentativas compat com schemas diferentes
  try {
    await client.query(`UPDATE turmas SET instrutor_assinante_id = $2 WHERE id = $1`, [tid, v]);
    return;
  } catch (_) {}

  try {
    await client.query(`UPDATE turmas SET assinante_instrutor_id = $2 WHERE id = $1`, [tid, v]);
  } catch (_) {}
}

/* =========================================================
   CRUD / Endpoints (turma)
========================================================= */

/** POST /api/turma (ou /api/turmas legado) */
async function criar(req, res) {
  const client = await getClient(req);
  try {
    const {
      evento_id,
      nome,
      vagas_total = null,

      // opcional:
      datas, // [{data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM'}]

      // NOVO: campos diretos (quando não há 'datas')
      data_inicio: di_payload,
      data_fim: df_payload,
      horario_inicio: hi_payload,
      horario_fim: hf_payload,

      instrutores = [],
      instrutor_assinante_id,
    } = req.body || {};

    logT("criar body:", {
      keys: Object.keys(req.body || {}),
      evento_id,
      nomeLen: len(nome),
      vagas_total,
      datasCount: Array.isArray(datas) ? datas.length : 0,
      instrutoresCount: Array.isArray(instrutores) ? instrutores.length : 0,
      instrutor_assinante_id,
    });

    const eventoId = toIntOrNull(evento_id);
    assert(eventoId, "Evento e nome são obrigatórios.");
    assert(nome && String(nome).trim(), "Evento e nome são obrigatórios.");

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
    let data_inicio = null;
    let data_fim = null;
    let horario_inicio = null;
    let horario_fim = null;
    let carga_int = null;

    const temDatas = Array.isArray(datas) && datas.length > 0;

    if (temDatas) {
      const v = validarDatasPayload(datas);
      if (!v.ok) return res.status(400).json({ erro: v.msg });

      datasOrdenadas = ordenarDatas(datas);
      data_inicio = datasOrdenadas[0].data;
      data_fim = datasOrdenadas[datasOrdenadas.length - 1].data;
      horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
      horario_fim = datasOrdenadas[0]?.horario_fim || null;
      carga_int = Math.round(somaHorasDatas(datasOrdenadas));
    } else {
      if (di_payload != null) assert(isISODate(di_payload), "data_inicio deve ser YYYY-MM-DD.");
      if (df_payload != null) assert(isISODate(df_payload), "data_fim deve ser YYYY-MM-DD.");
      if (hi_payload != null) assert(isHHMM(hi_payload), "horario_inicio deve ser HH:MM.");
      if (hf_payload != null) assert(isHHMM(hf_payload), "horario_fim deve ser HH:MM.");

      data_inicio = di_payload ?? null;
      data_fim = df_payload ?? di_payload ?? null;
      horario_inicio = hi_payload ?? null;
      horario_fim = hf_payload ?? null;
      carga_int = null;
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
      [
        eventoId,
        String(nome).trim(),
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        vagas_total,
        carga_int,
      ]
    );

    const turma_id = insTurma?.[0]?.id;
    logT("criar -> turma_id:", turma_id);

    if (temDatas) {
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
      logT("criar -> datas gravadas:", datasOrdenadas.length);
    } else {
      logT("criar -> criada sem encontros (datas_turma).");
    }

    if (Array.isArray(instrutores) && instrutores.length > 0) {
      for (const instrutorId of instrutores) {
        const iid = toIntOrNull(instrutorId);
        if (!iid) continue;
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, iid]
        );
      }
      logT("criar -> instrutores vinculados:", instrutores.length);
    }

    if (instrutor_assinante_id != null) {
      await setAssinanteSilencioso(client, turma_id, instrutor_assinante_id);
      await marcarAssinanteEmTurmaInstrutor(client, turma_id, instrutor_assinante_id);
      logT("criar -> assinante set:", instrutor_assinante_id);
    }

    await client.query("COMMIT");
    return res.status(201).json({ turma_id });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    errT("criar erro:", e);
    return res.status(e.status || 500).json({ erro: e.message || "Erro ao criar turma." });
  } finally {
    try { client.release?.(); } catch {}
  }
}

/** PUT /api/turma/:id (parcial; datas opcionais) */
async function atualizar(req, res) {
  const client = await getClient(req);
  try {
    const turma_id = toIntOrNull(req.params.id);
    assert(turma_id, "TURMA_ID_INVALIDO");

    const { nome, vagas_total = null, datas, instrutores, instrutor_assinante_id } = req.body || {};

    logT("atualizar:", {
      turma_id,
      bodyKeys: Object.keys(req.body || {}),
      datasCount: Array.isArray(datas) ? datas.length : "(nao enviado)",
    });

    if (nome != null && !nomeOk(nome)) {
      return res.status(422).json({
        erro: "VALIDACAO_TAMANHO",
        campo: "nome",
        limite: LIMITE_NOME_TURMA,
        recebido: len(nome),
        mensagem: `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres (recebido: ${len(nome)}).`,
      });
    }

    const veioDatas = Array.isArray(datas) && datas.length > 0;

    let datasOrdenadas = [];
    let data_inicio = null;
    let data_fim = null;
    let horario_inicio = null;
    let horario_fim = null;
    let carga_int = null;

    if (veioDatas) {
      const v = validarDatasPayload(datas);
      if (!v.ok) return res.status(400).json({ erro: v.msg });

      datasOrdenadas = ordenarDatas(datas);
      data_inicio = datasOrdenadas[0].data;
      data_fim = datasOrdenadas[datasOrdenadas.length - 1].data;
      horario_inicio = datasOrdenadas[0]?.horario_inicio || null;
      horario_fim = datasOrdenadas[0]?.horario_fim || null;
      carga_int = Math.round(somaHorasDatas(datasOrdenadas));
    }

    await client.query("BEGIN");

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
      setCols.push(`carga_horaria = $${params.length + 1}`);   params.push(carga_int);
    }

    if (setCols.length) {
      const up = await client.query(`UPDATE turmas SET ${setCols.join(", ")} WHERE id = $1`, params);
      logT("atualizar UPDATE rowCount:", up.rowCount, "| set:", setCols);
    } else {
      logT("atualizar: nada para atualizar em turmas.");
    }

    if (veioDatas) {
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
      logT("atualizar -> datas regravadas:", datasOrdenadas.length);
    }

    if (Array.isArray(instrutores)) {
      await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [turma_id]);
      let added = 0;
      for (const instrutorId of instrutores) {
        const iid = toIntOrNull(instrutorId);
        if (!iid) continue;
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turma_id, iid]
        );
        added++;
      }
      logT("atualizar -> instrutores set:", added);
    }

    if (instrutor_assinante_id !== undefined) {
      await setAssinanteSilencioso(client, turma_id, instrutor_assinante_id);
      await marcarAssinanteEmTurmaInstrutor(client, turma_id, instrutor_assinante_id);
      logT("atualizar -> assinante set:", instrutor_assinante_id);
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    errT("atualizar erro:", e);
    return res.status(e.status || 500).json({ erro: e.message || "Erro ao atualizar turma." });
  } finally {
    try { client.release?.(); } catch {}
  }
}

/** GET /api/turma/:id → turma completa p/ editar */
async function obter(req, res) {
  const turma_id = toIntOrNull(req.params.id);
  if (!turma_id) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  try {
    const base = await query(
      req,
      `
      SELECT 
        t.id,
        t.evento_id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,    'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim,    'HH24:MI') AS horario_fim,
        t.vagas_total,
        t.carga_horaria,

        t.instrutor_assinante_id,
        u.nome AS assinante_nome
      FROM turmas t
      LEFT JOIN usuarios u ON u.id = t.instrutor_assinante_id
      WHERE t.id = $1
      `,
      [turma_id]
    );

    if (!base.rowCount) return res.status(404).json({ erro: "Turma não encontrada." });
    const t = base.rows[0];

    const datasResult = await query(
      req,
      `
      SELECT
        to_char(data::date, 'YYYY-MM-DD') AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim,   'HH24:MI')  AS horario_fim
      FROM datas_turma
      WHERE turma_id = $1
      ORDER BY data
      `,
      [turma_id]
    );

    const datas = datasResult.rows.map((d) => ({
      data: d.data,
      horario_inicio: d.horario_inicio || null,
      horario_fim: d.horario_fim || null,
    }));

    const instrutoresResult = await query(
      req,
      `
      SELECT u.id, u.nome, u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      WHERE ti.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );

    let assinante_por_vinculo = null;
    try {
      const assinTI = await query(
        req,
        `
        SELECT u.id, u.nome
        FROM turma_instrutor ti
        JOIN usuarios u ON u.id = ti.instrutor_id
        WHERE ti.turma_id = $1 AND ti.is_assinante = TRUE
        LIMIT 1
        `,
        [turma_id]
      );
      assinante_por_vinculo = assinTI.rows?.[0] || null;
    } catch (_) {}

    return res.json({
      ...t,
      assinante_id: t.instrutor_assinante_id ?? null,
      instrutor_assinante_id: t.instrutor_assinante_id ?? null,
      assinante_por_vinculo,
      datas,
      instrutores: instrutoresResult.rows,
    });
  } catch (err) {
    errT("obter erro:", err);
    return res.status(500).json({ erro: "Erro ao obter turma." });
  }
}

/** GET /api/turma/:id/datas */
async function listarData(req, res) {
  const turmaId = toIntOrNull(req.params.id);
  if (!turmaId) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  try {
    const { rows } = await query(
      req,
      `
      SELECT 
        to_char(data::date, 'YYYY-MM-DD') AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim,   'HH24:MI')  AS horario_fim
      FROM datas_turma
      WHERE turma_id = $1
      ORDER BY data
      `,
      [turmaId]
    );

    const datas = rows.map((r) => ({
      data: r.data,
      horario_inicio: r.horario_inicio || null,
      horario_fim: r.horario_fim || null,
    }));

    return res.json(datas);
  } catch (err) {
    errT("listarData erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar datas da turma." });
  }
}

/** POST /api/turma/:id/instrutor */
async function adicionarInstrutor(req, res) {
  const turma_id = toIntOrNull(req.params.id);
  const instrutores = req.body?.instrutores;

  if (!turma_id) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });
  if (!Array.isArray(instrutores) || instrutores.length === 0) {
    return res.status(400).json({ erro: "Lista de instrutores inválida." });
  }

  try {
    const t = await query(req, `SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (!t.rowCount) return res.status(404).json({ erro: "Turma não encontrada." });

    let added = 0;
    for (const instrutor_id of instrutores) {
      const iid = toIntOrNull(instrutor_id);
      if (!iid) continue;
      await query(
        req,
        `INSERT INTO turma_instrutor (turma_id, instrutor_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [turma_id, iid]
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

/** GET /api/evento/:evento_id/turma (com datas e instrutores) */
async function listarPorEvento(req, res) {
  const evento_id = toIntOrNull(req.params.evento_id);
  if (!evento_id) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  try {
    const turmasResult = await query(
      req,
      `
      SELECT 
        t.id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,    'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim,    'HH24:MI') AS horario_fim,
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
    if (!turmas.length) return res.json([]);

    const turmaIds = turmas.map((t) => t.id);

    const datasResult = await query(
      req,
      `
      SELECT
        turma_id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim,   'HH24:MI')  AS horario_fim
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
        data: r.data,
        horario_inicio: r.horario_inicio || null,
        horario_fim: r.horario_fim || null,
      });
    }

    const instrutoresResult = await query(
      req,
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

        const min = datas[0]?.data || t.data_inicio || null;
        const max = datas[datas.length - 1]?.data || t.data_fim || null;

        const hiModa = moda(datas.map((d) => d.horario_inicio).filter(Boolean));
        const hfModa = moda(datas.map((d) => d.horario_fim).filter(Boolean));

        return {
          id: t.id,
          nome: t.nome,
          evento_titulo: t.evento_titulo,
          data_inicio: min,
          data_fim: max,
          horario_inicio: hiModa || t.horario_inicio || null,
          horario_fim: hfModa || t.horario_fim || null,
          vagas_total: Number(t.vagas_total ?? 0),
          carga_horaria: t.carga_horaria,
          carga_horaria_real,
          datas,
          instrutores: instrPorTurma[t.id] || [],
        };
      })
      .sort((a, b) => String(a.data_inicio || "").localeCompare(String(b.data_inicio || "")));

    return res.json(resposta);
  } catch (err) {
    errT("listarPorEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas." });
  }
}

/** GET /api/evento/:evento_id/turma-simples (legado) */
async function listarPorEventoSimples(req, res) {
  const evento_id = toIntOrNull(req.params.evento_id);
  if (!evento_id) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  try {
    const { rows } = await query(
      req,
      `
      SELECT 
        t.id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,    'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim,    'HH24:MI') AS horario_fim,
        t.vagas_total,
        t.carga_horaria,
        t.instrutor_assinante_id
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.horario_inicio NULLS LAST
      `,
      [evento_id]
    );

    const turmaIds = rows.map((t) => t.id);
    if (!turmaIds.length) return res.json([]);

    const datasResult = await query(
      req,
      `
      SELECT
        turma_id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim,   'HH24:MI')  AS horario_fim
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
        data: d.data,
        horario_inicio: d.horario_inicio || null,
        horario_fim: d.horario_fim || null,
      });
    }

    const instrutoresResult = await query(
      req,
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
        inicio: d.horario_inicio || t.horario_inicio || null,
        fim: d.horario_fim || t.horario_fim || null,
      }));

      const hiModa = moda(datas.map((d) => d.horario_inicio).filter(Boolean));
      const hfModa = moda(datas.map((d) => d.horario_fim).filter(Boolean));

      return {
        id: t.id,
        nome: t.nome,
        data_inicio: t.data_inicio || null,
        data_fim: t.data_fim || null,
        horario_inicio: hiModa || t.horario_inicio || null,
        horario_fim: hfModa || t.horario_fim || null,
        vagas_total: Number(t.vagas_total ?? 0),
        carga_horaria: t.carga_horaria,
        datas,
        encontros,
        instrutores: instrPorTurma[t.id] || [],
        qtd_encontros: datas.length,
        instrutor_assinante_id: t.instrutor_assinante_id ?? null,
        assinante_id: t.instrutor_assinante_id ?? null,
      };
    });

    return res.json(resposta);
  } catch (err) {
    errT("listarPorEventoSimples erro:", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}

/** GET /api/turma/:id/instrutor */
async function listarInstrutor(req, res) {
  const turma_id = toIntOrNull(req.params.id);
  if (!turma_id) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  try {
    const t = await query(req, `SELECT id FROM turmas WHERE id = $1`, [turma_id]);
    if (!t.rowCount) return res.status(404).json({ erro: "Turma não encontrada." });

    const resultado = await query(
      req,
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
    errT("listarInstrutor erro:", err);
    return res.status(500).json({ erro: "Erro ao listar instrutor(es) da turma." });
  }
}

async function obterDetalhe(req, res) {
  const turmaId = toIntOrNull(req.params.id);
  if (!turmaId) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  try {
    const resultado = await query(
      req,
      `
      SELECT 
        e.titulo AS titulo_evento,
        COALESCE(
          (SELECT string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome)
           FROM turma_instrutor ti
           JOIN usuarios u ON u.id = ti.instrutor_id
           WHERE ti.turma_id = t.id),
          'Instrutor não definido'
        ) AS nome_instrutor
      FROM turmas t
      JOIN eventos e ON t.evento_id = e.id
      WHERE t.id = $1
      `,
      [turmaId]
    );

    if (!resultado.rowCount) return res.status(404).json({ erro: "Turma não encontrada." });
    return res.json(resultado.rows[0]);
  } catch (err) {
    errT("obterDetalhe erro:", err);
    return res.status(500).json({ erro: "Erro ao obter detalhes da turma." });
  }
}

async function listarComUsuario(req, res) {
  try {
    const turmasResult = await query(
      req,
      `
      SELECT t.id, t.nome, t.evento_id, e.titulo AS titulo_evento
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      `
    );

    const turmas = turmasResult.rows;
    if (!turmas.length) return res.json([]);

    const turmaIds = turmas.map((t) => t.id);

    const datasResult = await query(
      req,
      `
      SELECT turma_id, to_char(data::date, 'YYYY-MM-DD') AS data
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data
      `,
      [turmaIds]
    );

    const minDataPorTurma = {};
    const maxDataPorTurma = {};
    for (const r of datasResult.rows) {
      if (!minDataPorTurma[r.turma_id]) minDataPorTurma[r.turma_id] = r.data;
      maxDataPorTurma[r.turma_id] = r.data;
    }

    let inscritosResult;
    try {
      inscritosResult = await query(
        req,
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
              AND p.turma_id = i.turma_id
              AND p.presente = TRUE
          ) AS presente
        FROM inscricoes i
        JOIN usuarios u ON u.id = i.usuario_id
        WHERE i.turma_id = ANY($1::int[])
        ORDER BY u.nome
        `,
        [turmaIds]
      );
    } catch (e) {
      warnT("listarComUsuario: fallback sem presencas/presente", e?.code);
      inscritosResult = await query(
        req,
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
        id: row.usuario_id,
        nome: row.nome,
        email: row.email,
        cpf: row.cpf,
        presente: row.presente === true,
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
        usuario: inscritosPorTurma[t.id] || [],
      }))
      .sort((a, b) => String(b.data_inicio || "").localeCompare(String(a.data_inicio || "")));

    return res.json(resposta);
  } catch (err) {
    errT("listarComUsuario erro:", err);
    return res.status(500).json({ erro: "Erro interno ao buscar turmas com usuarios." });
  }
}

/** DELETE /api/turma/:id */
async function excluir(req, res) {
  const turmaId = toIntOrNull(req.params.id);
  if (!turmaId) return res.status(400).json({ erro: "TURMA_ID_INVALIDO" });

  const client = await getClient(req);
  try {
    await client.query("BEGIN");

    const checkTurma = await client.query(`SELECT id FROM turmas WHERE id = $1`, [turmaId]);
    if (!checkTurma.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const { rows: [agg] } = await client.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM presencas    WHERE turma_id = $1) AS presencas,
        (SELECT COUNT(*)::int FROM certificados WHERE turma_id = $1) AS certificados,
        (SELECT COUNT(*)::int FROM inscricoes   WHERE turma_id = $1) AS inscricao
      `,
      [turmaId]
    );

    if ((agg?.presencas ?? 0) > 0 || (agg?.certificados ?? 0) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        erro: "TURMA_COM_REGISTROS",
        detalhe: "Turma possui presenças ou certificados. Exclusão bloqueada.",
        contagens: agg,
      });
    }

    if ((agg?.inscricao ?? 0) > 0) {
      await client.query(`DELETE FROM inscricoes WHERE turma_id = $1`, [turmaId]);
    }

    await client.query(`DELETE FROM turma_instrutor WHERE turma_id = $1`, [turmaId]);
    try { await client.query(`DELETE FROM datas_turma WHERE turma_id = $1`, [turmaId]); } catch (_) {}

    const delTurma = await client.query(`DELETE FROM turmas WHERE id = $1`, [turmaId]);
    if (!delTurma.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    await client.query("COMMIT");
    return res.json({ ok: true, mensagem: "Turma excluída com sucesso.", turma_id: turmaId });
  } catch (err) {
    errT("excluir erro:", err);
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ erro: "Erro ao excluir turma." });
  } finally {
    try { client.release?.(); } catch {}
  }
}

/* =========================================================
   Painel ADMIN — lista sem datas_turma (status por timestamp)
   GET /api/administrador/turma
========================================================= */
async function listarAdmin(req, res) {
  const db = getDb(req);

  try {
    const sql = `
      WITH instrutores_por_evento AS (
        SELECT
          ei.evento_id,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
              FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) AS instrutor
        FROM evento_instrutor ei
        LEFT JOIN usuarios u ON u.id = ei.instrutor_id
        GROUP BY ei.evento_id
      ),
      inscricao_por_turma AS (
        SELECT
          i.turma_id,
          COUNT(DISTINCT i.id)::int AS vagas_ocupadas
        FROM inscricoes i
        GROUP BY i.turma_id
      )
      SELECT
        t.id,
        t.nome,

        to_char(t.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim,    'YYYY-MM-DD') AS data_fim,

        to_char(COALESCE(t.horario_inicio, '08:00'::time), 'HH24:MI') AS horario_inicio,
        to_char(COALESCE(t.horario_fim,    '17:00'::time), 'HH24:MI') AS horario_fim,

        (
          to_char(COALESCE(t.horario_inicio, '08:00'::time), 'HH24:MI')
          || ' - ' ||
          to_char(COALESCE(t.horario_fim,    '17:00'::time), 'HH24:MI')
        ) AS horario,

        t.vagas_total::int AS vagas_total,
        COALESCE(ip.vagas_ocupadas, 0) AS vagas_ocupadas,

        e.id     AS evento_id,
        e.titulo AS evento_titulo,

        COALESCE(ie.instrutor, '[]'::json) AS instrutor,

        CASE
          WHEN now() < (t.data_inicio::timestamp + COALESCE(t.horario_inicio, '08:00'::time)) THEN 'programado'
          WHEN now() > (t.data_fim::timestamp    + COALESCE(t.horario_fim,    '17:00'::time)) THEN 'encerrado'
          ELSE 'em_andamento'
        END AS status

      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN instrutores_por_evento ie ON ie.evento_id = e.id
      LEFT JOIN inscricao_por_turma  ip ON ip.turma_id  = t.id
      ORDER BY t.data_inicio ASC, COALESCE(t.horario_inicio, '08:00'::time) ASC, t.id ASC;
    `;

    const { rows } = await db.query(sql);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("[turmaController][listarAdmin] Erro ao carregar turmas:", {
      rid: req?.requestId,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return res.status(500).json({
      erro: "Erro ao buscar turmas para o painel administrador.",
      requestId: res.getHeader?.("X-Request-Id"),
    });
  }
}

/* =========================================================
   EXPORTS (singular) + aliases retrocompat
========================================================= */
module.exports = {
  // ✅ singular (novo padrão)
  criar,
  atualizar,
  excluir,
  obter,
  listarPorEvento,
  listarPorEventoSimples,
  listarData,
  adicionarInstrutor,
  listarInstrutor,
  obterDetalhe,
  listarComUsuario,
  listarAdmin,

  // ♻️ aliases (retrocompat com seus nomes atuais)
  criarTurma: criar,
  atualizarTurma: atualizar,
  editarTurma: atualizar,
  excluirTurma: excluir,

  obterTurmaCompleta: obter,
  listarTurmasPorEvento: listarPorEvento,
  obterTurmasPorEvento: listarPorEventoSimples,

  listarDatasDaTurma: listarData,

  listarInstrutorDaTurma: listarInstrutor,
  listarinstrutorDaTurma: listarInstrutor,

  obterDetalhesTurma: obterDetalhe,

  listarTurmasComUsuarios: listarComUsuario,

  listarTurmasAdministrador: listarAdmin,
};
