// 📁 src/controllers/salaController.js
/* eslint-disable no-console */
const { query, getClient } = require("../db");

const IS_PROD = process.env.NODE_ENV === "production";
const IS_DEV = !IS_PROD;

/* ======================================================================= */
/* Logs premium (com requestId)                                             */
/* ======================================================================= */
function rid() {
  return `rid=${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function log(r, ...a) {
  if (IS_DEV) console.log("[salas]", r, ...a);
}
function warn(r, ...a) {
  console.warn("[salas][WARN]", r, ...a);
}
function errlog(r, ...a) {
  console.error("[salas][ERR]", r, ...a);
}

/* ======================================================================= */
/* Helpers de data (sem surpresas de fuso)                                  */
/* - Trabalhamos com "datas-only" como string YYYY-MM-DD                    */
/* - Quando precisamos de Date, fixamos 12:00 local para não “pular dia”     */
/* ======================================================================= */

function isISODateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseISODateOnly(dateStr) {
  // "YYYY-MM-DD" -> Date local com 12:00 (evita offset)
  if (!isISODateOnly(dateStr)) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODateString(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hojeISO() {
  return toISODateString(new Date());
}

function isWeekend(dateStr) {
  const d = parseISODateOnly(dateStr);
  if (!d) return false;
  const dow = d.getDay(); // 0 domingo, 6 sábado
  return dow === 0 || dow === 6;
}

/* ======================================================================= */
/* Helpers de validação                                                     */
/* ======================================================================= */

function asInt(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function normStr(v, { max = 500 } = {}) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normSala(v) {
  const s = normStr(v, { max: 50 });
  if (!s) return null;
  // se você tem valores fixos, valide aqui:
  // const allowed = new Set(["auditorio", "sala_reuniao"]);
  // if (!allowed.has(s)) return null;
  return s;
}

function normPeriodo(v) {
  const p = normStr(v, { max: 20 });
  return p || null;
}

function capacidadeMaxSala(sala) {
  return sala === "auditorio" ? 60 : 30;
}

/* ======================================================================= */
/* Helper para ano/mês com fallback seguro                                  */
/* ======================================================================= */
function getAnoMesFromQuery(queryObj) {
  const now = new Date();
  let ano = asInt(queryObj.ano);
  let mes = asInt(queryObj.mes); // 1-12

  if (!ano || ano < 2000 || ano > 2100) ano = now.getFullYear();
  if (!mes || mes < 1 || mes > 12) mes = now.getMonth() + 1;

  return { ano, mes };
}

/* ======================================================================= */
/* Bloqueios (feriado/ponto/bloqueio interno)                               */
/* ======================================================================= */
async function datasBloqueadasISO(datasISO) {
  if (!Array.isArray(datasISO) || datasISO.length === 0) return new Set();

  const { rows } = await query(
    `
    SELECT data::date AS d, tipo
      FROM calendario_bloqueios
     WHERE data = ANY($1::date[])
       AND tipo = ANY(ARRAY[
         'feriado_nacional'::varchar,
         'feriado_municipal'::varchar,
         'ponto_facultativo'::varchar,
         'bloqueio_interno'::varchar
       ])
    `,
    [datasISO]
  );

  // d pode vir como Date (pg) ou string dependendo do driver/config
  const set = new Set(
    rows
      .map((r) => {
        if (!r?.d) return null;
        if (typeof r.d === "string") return r.d.slice(0, 10);
        if (r.d instanceof Date) return toISODateString(r.d);
        return null;
      })
      .filter(Boolean)
  );

  return set;
}

async function isDataBloqueada(dataISO) {
  const set = await datasBloqueadasISO([dataISO]);
  return set.has(dataISO);
}

/* ======================================================================= */
/* GET /api/salas/agenda-admin                                              */
/* Query params: ano, mes (1-12), sala (opcional)                           */
/* ======================================================================= */
async function listarAgendaAdmin(req, res) {
  const r = rid();
  try {
    const { ano, mes } = getAnoMesFromQuery(req.query);
    const sala = normSala(req.query.sala);

    log(r, "[listarAgendaAdmin] query:", { ano, mes, sala });

    // Reservas
    const params = [ano, mes];
    let sqlReservas = `
      SELECT
        id,
        sala,
        data::date AS data,
        periodo,
        qtd_pessoas,
        coffee_break,
        status,
        observacao_admin AS observacao,
        finalidade,
        solicitante_id
      FROM reservas_salas
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
    `;
    if (sala) {
      params.push(sala);
      sqlReservas += ` AND sala = $${params.length}`;
    }
    sqlReservas += ` ORDER BY data ASC, sala ASC, periodo ASC`;

    const { rows: reservas } = await query(sqlReservas, params);

    // Bloqueios
    const { rows: bloqueios } = await query(
      `
      SELECT id, data::date AS data, tipo, descricao
      FROM calendario_bloqueios
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
      ORDER BY data ASC
      `,
      [ano, mes]
    );

    const feriados = bloqueios.filter((b) =>
      ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(b.tipo)
    );
    const datas_bloqueadas = bloqueios.filter((b) => b.tipo === "bloqueio_interno");

    return res.json({ ano, mes, reservas, feriados, datas_bloqueadas });
  } catch (e) {
    errlog(r, "[listarAgendaAdmin] erro:", e?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao listar agenda das salas.", requestId: r });
  }
}

/* ======================================================================= */
/* GET /api/salas/agenda-usuario                                            */
/* Query params: ano, mes (1-12), sala (opcional)                           */
/* ======================================================================= */
async function listarAgendaUsuario(req, res) {
  const r = rid();
  try {
    const { ano, mes } = getAnoMesFromQuery(req.query);
    const sala = normSala(req.query.sala);
    const usuarioId = Number(req.user?.id);

    if (!usuarioId) return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });

    log(r, "[listarAgendaUsuario] query:", { ano, mes, sala, usuarioId });

    const params = [ano, mes, usuarioId];
let whereSala = "";
if (sala) {
  params.push(sala);
  whereSala = ` AND rs.sala = $${params.length}`;
}

const { rows: reservas } = await query(
  `
  SELECT
    rs.id,
    rs.sala,
    rs.data::date AS data,
    rs.periodo,
    rs.status,
    rs.qtd_pessoas,
    rs.coffee_break,

    -- ✅ privacidade: só devolve finalidade se for do usuário logado
    CASE WHEN rs.solicitante_id = $3 THEN rs.finalidade ELSE NULL END AS finalidade,

    rs.solicitante_id,

    -- ✅ flag pro frontend
    (rs.solicitante_id = $3) AS minha
  FROM reservas_salas rs
  WHERE EXTRACT(YEAR FROM rs.data) = $1
    AND EXTRACT(MONTH FROM rs.data) = $2

    -- ✅ remove canceladas/rejeitadas sem quebrar enum
    AND (rs.status IS NULL OR rs.status NOT IN ('cancelado'::status_reserva_sala, 'rejeitado'::status_reserva_sala))

    ${whereSala}
  ORDER BY rs.data, rs.sala, rs.periodo
  `,
  params
);

    const { rows: bloqueios } = await query(
      `
      SELECT id, data::date AS data, tipo, descricao
      FROM calendario_bloqueios
      WHERE EXTRACT(YEAR FROM data) = $1
        AND EXTRACT(MONTH FROM data) = $2
      ORDER BY data ASC
      `,
      [ano, mes]
    );

    const feriados = bloqueios.filter((b) =>
      ["feriado_nacional", "feriado_municipal", "ponto_facultativo"].includes(b.tipo)
    );
    const datas_bloqueadas = bloqueios.filter((b) => b.tipo === "bloqueio_interno");

    return res.json({ ano, mes, reservas, feriados, datas_bloqueadas });
  } catch (e) {
    errlog(r, "[listarAgendaUsuario] erro:", e?.message);
    errlog(r, "[listarAgendaUsuario] code:", e?.code);
    errlog(r, "[listarAgendaUsuario] stack:", e?.stack);
  
    return res.status(500).json({
      ok: false,
      erro: "Erro ao carregar disponibilidade das salas.",
      requestId: r,
      ...(IS_DEV ? { detalhe: e?.message, code: e?.code } : {}),
    });
  }
}

/* ======================================================================= */
/* POST /api/salas/solicitar (usuário)                                      */
/* body: { sala, data, periodo, qtd_pessoas, coffee_break, finalidade }     */
/* ======================================================================= */
async function solicitarReserva(req, res) {
  const r = rid();
  try {
    const usuarioId = Number(req.user?.id);
    if (!usuarioId) return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });

    const sala = normSala(req.body?.sala);
    const data = normStr(req.body?.data, { max: 10 });
    const periodo = normPeriodo(req.body?.periodo);
    const qtd_pessoas = asInt(req.body?.qtd_pessoas);
    const coffee_break = typeof req.body?.coffee_break === "boolean" ? req.body.coffee_break : false;
    const finalidade = normStr(req.body?.finalidade, { max: 500 });

    if (!sala || !isISODateOnly(data) || !periodo || !qtd_pessoas) {
      return res.status(400).json({
        ok: false,
        erro: "Sala, data (YYYY-MM-DD), período e quantidade são obrigatórios.",
        requestId: r,
      });
    }
    if (!finalidade) {
      return res.status(400).json({ ok: false, erro: "Informe a finalidade do uso da sala / evento.", requestId: r });
    }

    const cap = capacidadeMaxSala(sala);
    if (qtd_pessoas > cap) {
      return res.status(400).json({ ok: false, erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`, requestId: r });
    }
    if (isWeekend(data)) {
      return res.status(400).json({ ok: false, erro: "Não é possível agendar em sábados ou domingos.", requestId: r });
    }

    const bloqueada = await isDataBloqueada(data);
    if (bloqueada) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        requestId: r,
      });
    }

    try {
      const { rows } = await query(
        `
        INSERT INTO reservas_salas
          (sala, data, periodo, qtd_pessoas, coffee_break, solicitante_id, status, finalidade)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7)
        RETURNING *;
        `,
        [sala, data, periodo, qtd_pessoas, coffee_break, usuarioId, finalidade]
      );
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (e?.code === "23505") {
        return res.status(409).json({ ok: false, erro: "Este horário já está reservado para esta sala.", requestId: r });
      }
      throw e;
    }
  } catch (e) {
    errlog(r, "[solicitarReserva] erro:", e?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao solicitar reserva.", requestId: r });
  }
}

/* ======================================================================= */
/* PUT /api/salas/minhas/:id (usuário edita a própria solicitação)          */
/* body: { sala?, data?, periodo?, qtd_pessoas?, coffee_break?, finalidade?} */
/* ======================================================================= */
async function atualizarReservaUsuario(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });

    const userId = Number(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });

    const sel = await query(`SELECT * FROM reservas_salas WHERE id = $1`, [id]);
    const atual = sel.rows?.[0];
    if (!atual) return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });

    if (Number(atual.solicitante_id) !== Number(userId)) {
      return res.status(403).json({ ok: false, erro: "Você não pode alterar esta reserva.", requestId: r });
    }
    if (String(atual.status) !== "pendente") {
      return res.status(403).json({ ok: false, erro: "Edição permitida apenas enquanto pendente.", requestId: r });
    }

    const sala = normSala(req.body?.sala) ?? String(atual.sala);
    const dataAtualISO =
      typeof atual.data === "string"
        ? atual.data.slice(0, 10)
        : toISODateString(atual.data instanceof Date ? atual.data : new Date(atual.data));
    const data = normStr(req.body?.data, { max: 10 }) ?? dataAtualISO;

    const periodo = normPeriodo(req.body?.periodo) ?? String(atual.periodo);
    const qtd_pessoas = asInt(req.body?.qtd_pessoas) ?? Number(atual.qtd_pessoas);
    const coffee_break =
      typeof req.body?.coffee_break === "boolean" ? req.body.coffee_break : !!atual.coffee_break;
    const finalidade = (req.body?.finalidade != null)
      ? normStr(req.body.finalidade, { max: 500 })
      : normStr(atual.finalidade, { max: 500 });

    if (!sala || !isISODateOnly(data) || !periodo || !qtd_pessoas) {
      return res.status(400).json({
        ok: false,
        erro: "Sala, data (YYYY-MM-DD), período e quantidade são obrigatórios.",
        requestId: r,
      });
    }
    if (!finalidade) {
      return res.status(400).json({ ok: false, erro: "Informe a finalidade do uso da sala / evento.", requestId: r });
    }

    const cap = capacidadeMaxSala(sala);
    if (qtd_pessoas > cap) {
      return res.status(400).json({ ok: false, erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`, requestId: r });
    }

    const hoje = hojeISO();
    if (data < hoje) {
      return res.status(400).json({ ok: false, erro: "Não é possível agendar para data passada.", requestId: r });
    }
    if (isWeekend(data)) {
      return res.status(400).json({ ok: false, erro: "Não é possível agendar em sábados ou domingos.", requestId: r });
    }

    const bloqueada = await isDataBloqueada(data);
    if (bloqueada) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        requestId: r,
      });
    }

    // Conflito (exclui a própria reserva)
    const conflito = await query(
      `SELECT 1 FROM reservas_salas WHERE sala = $1 AND data = $2 AND periodo = $3 AND id <> $4 LIMIT 1`,
      [sala, data, periodo, id]
    );
    if (conflito.rowCount > 0) {
      return res.status(409).json({ ok: false, erro: "Já existe uma reserva para esta sala, data e período.", requestId: r });
    }

    const { rows } = await query(
      `
      UPDATE reservas_salas
         SET sala = $2,
             data = $3,
             periodo = $4,
             qtd_pessoas = $5,
             coffee_break = $6,
             finalidade = $7,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *;
      `,
      [id, sala, data, periodo, qtd_pessoas, coffee_break, finalidade]
    );

    return res.json(rows[0]);
  } catch (e) {
    errlog(r, "[atualizarReservaUsuario] erro:", e?.message);
    if (e?.code === "23505") {
      return res.status(409).json({ ok: false, erro: "Conflito de horário para esta sala.", requestId: r });
    }
    return res.status(500).json({ ok: false, erro: "Erro ao atualizar a solicitação.", requestId: r });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/minhas/:id (usuário exclui a própria solicitação)      */
/* ======================================================================= */
async function excluirReservaUsuario(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });

    const userId = Number(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });

    const sel = await query(`SELECT status, solicitante_id FROM reservas_salas WHERE id = $1`, [id]);
    const row = sel.rows?.[0];
    if (!row) return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });

    if (Number(row.solicitante_id) !== Number(userId)) {
      return res.status(403).json({ ok: false, erro: "Você não pode excluir esta reserva.", requestId: r });
    }
    if (String(row.status) !== "pendente") {
      return res.status(403).json({ ok: false, erro: "Exclusão permitida apenas enquanto pendente.", requestId: r });
    }

    const del = await query(`DELETE FROM reservas_salas WHERE id = $1`, [id]);
    if (!del.rowCount) return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });

    return res.status(204).end();
  } catch (e) {
    errlog(r, "[excluirReservaUsuario] erro:", e?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao excluir a solicitação.", requestId: r });
  }
}

/* ======================================================================= */
/* Helpers de recorrência para admin                                        */
/* - Retorna array de 'YYYY-MM-DD' (FUTURAS, sem incluir a base)            */
/* ======================================================================= */

function getDateByOrdemSemana(year, monthIndex, weekday, ordemSemana, ehUltimaSemana) {
  if (ehUltimaSemana) {
    const lastDay = new Date(year, monthIndex + 1, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;
    const day = lastDay.getDate() - diff;
    return new Date(year, monthIndex, day, 12, 0, 0);
  }

  const ordem = Number(ordemSemana) || 1;
  const firstDay = new Date(year, monthIndex, 1);
  const firstDow = firstDay.getDay();
  const delta = (weekday - firstDow + 7) % 7;
  let day = 1 + delta + (ordem - 1) * 7;

  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  if (day > lastDayOfMonth) {
    const lastDay = new Date(year, monthIndex + 1, 0);
    const lastDow = lastDay.getDay();
    const diff = (lastDow - weekday + 7) % 7;
    day = lastDay.getDate() - diff;
  }

  return new Date(year, monthIndex, day, 12, 0, 0);
}

function gerarDatasRecorrencia(dataBaseISO, recorrencia) {
  if (!isISODateOnly(dataBaseISO)) return [];
  if (!recorrencia || typeof recorrencia !== "object" || !recorrencia.tipo) return [];

  const tipo = String(recorrencia.tipo);

  // caso especial: "sempre" (mensal até limiteMeses)
  if (tipo === "sempre") {
    const limiteMeses = Math.min(Number(recorrencia.limiteMeses) || 24, 120);
    const base = parseISODateOnly(dataBaseISO);
    if (!base) return [];

    const datas = [];
    for (let i = 1; i <= limiteMeses; i++) {
      const d = new Date(base);
      const origDay = d.getDate();
      d.setMonth(d.getMonth() + i);

      // Se o mês “pular” (ex.: 31), ajusta pro último dia do mês
      if (d.getDate() !== origDay) {
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        d.setDate(last.getDate());
      }

      const iso = toISODateString(d);
      if (iso && iso !== dataBaseISO) datas.push(iso);
    }
    return datas;
  }

  const repeticao = Math.max(0, Number(recorrencia.repeticao) || 0);
  if (repeticao <= 0) return [];

  const baseDate = parseISODateOnly(dataBaseISO);
  if (!baseDate) return [];

  const results = [];

  // semanal
  if (tipo === "semanal" && recorrencia.semanal) {
    const intSem = Math.max(1, Number(recorrencia.semanal.intervaloSemanas) || 1);
    const diasSemana = Array.isArray(recorrencia.semanal.diasSemana) ? recorrencia.semanal.diasSemana : [];
    const diasSet = new Set(diasSemana.map((x) => Number(x)).filter((x) => x >= 0 && x <= 6));
    if (!diasSet.size) return [];

    const oneDayMs = 24 * 60 * 60 * 1000;
    const limiteDias = repeticao * 7 * intSem + 21;

    for (let i = 1; i <= limiteDias && results.length < repeticao; i++) {
      const d = new Date(baseDate.getTime() + i * oneDayMs);
      const diffDays = Math.floor((d - baseDate) / oneDayMs);
      const weekIndex = Math.floor(diffDays / 7);
      if (weekIndex % intSem !== 0) continue;
      if (!diasSet.has(d.getDay())) continue;

      const iso = toISODateString(d);
      if (iso && iso !== dataBaseISO) results.push(iso);
    }

    return results;
  }

  // mensal
  if (tipo === "mensal" && recorrencia.mensal) {
    const modo = String(recorrencia.mensal.modo || "dia_mes"); // 'dia_mes' | 'ordem_semana'
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();

    for (let i = 1; i <= repeticao; i++) {
      const targetMonthIndex = baseMonth + i;
      const year = baseYear + Math.floor(targetMonthIndex / 12);
      const month = targetMonthIndex % 12;

      let d;
      if (modo === "ordem_semana" && recorrencia.mensal.diaSemanaBaseIndex != null) {
        d = getDateByOrdemSemana(
          year,
          month,
          Number(recorrencia.mensal.diaSemanaBaseIndex),
          Number(recorrencia.mensal.ordemSemanaBase),
          !!recorrencia.mensal.ehUltimaSemana
        );
      } else {
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(Number(recorrencia.mensal.diaMesBase) || baseDate.getDate(), lastDay);
        d = new Date(year, month, day, 12, 0, 0);
      }

      const iso = toISODateString(d);
      if (iso && iso !== dataBaseISO) results.push(iso);
    }

    return results;
  }

  // anual
  if (tipo === "anual" && recorrencia.anual) {
    const modo = String(recorrencia.anual.modo || "dia_mes");
    const meses = Array.isArray(recorrencia.anual.meses) ? recorrencia.anual.meses : [];
    const mesesSorted = Array.from(new Set(meses.map((m) => Number(m)).filter((m) => m >= 0 && m <= 11))).sort(
      (a, b) => a - b
    );
    if (!mesesSorted.length) return [];

    const baseYear = baseDate.getFullYear();

    // percorre anos até preencher repeticao
    let yearOffset = 0;
    const maxYears = Math.min(50, repeticao * 3 + 3);

    while (results.length < repeticao && yearOffset <= maxYears) {
      const year = baseYear + yearOffset;

      for (const m of mesesSorted) {
        let d;
        if (modo === "ordem_semana" && recorrencia.anual.diaSemanaBaseIndex != null) {
          d = getDateByOrdemSemana(
            year,
            m,
            Number(recorrencia.anual.diaSemanaBaseIndex),
            Number(recorrencia.anual.ordemSemanaBase),
            !!recorrencia.anual.ehUltimaSemana
          );
        } else {
          const lastDay = new Date(year, m + 1, 0).getDate();
          const day = Math.min(Number(recorrencia.anual.diaMesBase) || baseDate.getDate(), lastDay);
          d = new Date(year, m, day, 12, 0, 0);
        }

        const iso = toISODateString(d);
        if (iso && iso > dataBaseISO) {
          results.push(iso);
          if (results.length >= repeticao) break;
        }
      }

      yearOffset += 1;
    }

    return results;
  }

  return [];
}

/* ======================================================================= */
/* POST /api/salas/admin/reservas (admin cria reserva + recorrência)        */
/* ======================================================================= */
async function criarReservaAdmin(req, res) {
  const r = rid();
  let client;

  try {
    const adminId = Number(req.user?.id);
    if (!adminId) return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });

    const sala = normSala(req.body?.sala);
    const data = normStr(req.body?.data, { max: 10 });
    const periodo = normPeriodo(req.body?.periodo);
    const qtd_pessoas = asInt(req.body?.qtd_pessoas);
    const coffee_break = typeof req.body?.coffee_break === "boolean" ? req.body.coffee_break : false;
    const status = normStr(req.body?.status, { max: 20 }) || "aprovado";
    const observacao = normStr(req.body?.observacao, { max: 1000 });
    const finalidade = normStr(req.body?.finalidade, { max: 500 });
    const recorrencia = req.body?.recorrencia && typeof req.body.recorrencia === "object" ? req.body.recorrencia : null;

    log(r, "[criarReservaAdmin] payload:", {
      sala,
      data,
      periodo,
      qtd_pessoas,
      coffee_break,
      status,
      finalidade: !!finalidade,
      temRecorrencia: !!recorrencia,
    });

    if (!sala || !isISODateOnly(data) || !periodo || !qtd_pessoas) {
      return res.status(400).json({
        ok: false,
        erro: "Sala, data (YYYY-MM-DD), período e quantidade são obrigatórios.",
        requestId: r,
      });
    }

    const cap = capacidadeMaxSala(sala);
    if (qtd_pessoas > cap) {
      return res.status(400).json({ ok: false, erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`, requestId: r });
    }

    // gera datas recorrentes
    let datasRecorrentes = [];
    try {
      datasRecorrentes = gerarDatasRecorrencia(data, recorrencia);
    } catch (eRec) {
      warn(r, "[criarReservaAdmin] recorrencia inválida, ignorando:", eRec?.message);
      datasRecorrentes = [];
    }

    const todasDatas = [data, ...datasRecorrentes].filter(isISODateOnly);
    const datasUnicas = Array.from(new Set(todasDatas)).sort(); // ordena

    // remove finais de semana + bloqueios
    const bloqueiosSet = await datasBloqueadasISO(datasUnicas);
    const datasValidas = datasUnicas.filter((dt) => !isWeekend(dt) && !bloqueiosSet.has(dt));

    if (datasValidas.length === 0) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhuma data válida para agendamento (todas caem em finais de semana ou feriados/bloqueios).",
        requestId: r,
      });
    }

    client = await getClient();
    await client.query("BEGIN");

    const insertSql = `
      INSERT INTO reservas_salas
        (sala, data, periodo, qtd_pessoas, coffee_break, solicitante_id, status, observacao_admin, finalidade)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const inseridas = [];
    const conflitos = [];

    for (const dt of datasValidas) {
      await client.query("SAVEPOINT sp_reserva");
      try {
        const { rows } = await client.query(insertSql, [
          sala,
          dt,
          periodo,
          qtd_pessoas,
          !!coffee_break,
          adminId,
          status,
          observacao || null,
          finalidade || null,
        ]);
        inseridas.push(rows[0]);
      } catch (eIns) {
        if (eIns?.code === "23505") {
          await client.query("ROLLBACK TO SAVEPOINT sp_reserva");
          conflitos.push(dt);
          continue;
        }
        throw eIns;
      }
    }

    if (conflitos.length > 0 && inseridas.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        erro: "Já existem reservas para esta sala em algumas das datas/períodos selecionados.",
        conflitos,
        requestId: r,
      });
    }

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, inseridas, conflitos });
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rb) {
      errlog(r, "[criarReservaAdmin] rollback erro:", rb?.message);
    }

    errlog(r, "[criarReservaAdmin] erro:", e?.message, e?.code ? `(code ${e.code})` : "");
    return res.status(500).json({
      ok: false,
      erro: "Erro ao criar reserva de sala.",
      requestId: r,
      ...(IS_DEV ? { detalhe: e?.message } : {}),
    });
  } finally {
    if (client) client.release();
  }
}

/* ======================================================================= */
/* PUT /api/salas/admin/reservas/:id (admin atualiza uma reserva)           */
/* ======================================================================= */
async function atualizarReservaAdmin(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });

    const status = normStr(req.body?.status, { max: 20 });
    const qtd_pessoas = req.body?.qtd_pessoas != null ? asInt(req.body.qtd_pessoas) : null;
    const coffee_break = typeof req.body?.coffee_break === "boolean" ? req.body.coffee_break : null;
    const observacao = req.body?.observacao != null ? normStr(req.body.observacao, { max: 1000 }) : null;
    const finalidade = req.body?.finalidade != null ? normStr(req.body.finalidade, { max: 500 }) : null;

    const { rows } = await query(
      `
      UPDATE reservas_salas
         SET status           = COALESCE($2, status),
             qtd_pessoas      = COALESCE($3, qtd_pessoas),
             coffee_break     = COALESCE($4, coffee_break),
             observacao_admin = COALESCE($5, observacao_admin),
             finalidade       = COALESCE($6, finalidade),
             updated_at       = NOW()
       WHERE id = $1
       RETURNING *;
      `,
      [id, status || null, qtd_pessoas, coffee_break, observacao, finalidade]
    );

    if (!rows?.[0]) return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    return res.json(rows[0]);
  } catch (e) {
    errlog(r, "[atualizarReservaAdmin] erro:", e?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao atualizar reserva.", requestId: r });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/admin/reservas/:id                                     */
/* ======================================================================= */
async function excluirReservaAdmin(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });

    const del = await query(`DELETE FROM reservas_salas WHERE id = $1`, [id]);
    if (!del.rowCount) return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });

    return res.status(204).end();
  } catch (e) {
    errlog(r, "[excluirReservaAdmin] erro:", e?.message);
    return res.status(500).json({ ok: false, erro: "Erro ao excluir reserva.", requestId: r });
  }
}

module.exports = {
  listarAgendaAdmin,
  listarAgendaUsuario,
  solicitarReserva,
  atualizarReservaUsuario,
  excluirReservaUsuario,
  criarReservaAdmin,
  atualizarReservaAdmin,
  excluirReservaAdmin,
};
