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
/* - Quando precisamos de Date, fixamos 12:00 local para não “pular dia”    */
/* ======================================================================= */

function isISODateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseISODateOnly(dateStr) {
  if (!isISODateOnly(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
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
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function formatDateBR(dateValue) {
  if (!dateValue) return "—";

  if (typeof dateValue === "string" && isISODateOnly(dateValue)) {
    const [y, m, d] = dateValue.split("-");
    return `${d}/${m}/${y}`;
  }

  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function formatDateTimeBR(dateValue) {
  if (!dateValue) return "—";
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
}

/* ======================================================================= */
/* Regra anual progressiva do usuário                                       */
/* - Ano atual inteiro visível/liberado                                     */
/* - Novembro: libera janeiro do próximo ano                                */
/* - Dezembro: libera janeiro e fevereiro do próximo ano                    */
/* - Solicitação/edição continuam proibindo datas passadas                  */
/* ======================================================================= */

function monthKey(ano, mes) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function compareMonthKey(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function getUserAgendaWindow() {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth() + 1;

  const minMesKey = monthKey(anoAtual, 1);

  let maxAno = anoAtual;
  let maxMes = 12;

  if (mesAtual === 11) {
    maxAno = anoAtual + 1;
    maxMes = 1;
  }

  if (mesAtual === 12) {
    maxAno = anoAtual + 1;
    maxMes = 2;
  }

  const maxMesKey = monthKey(maxAno, maxMes);

  return {
    anoAtual,
    mesAtual,
    minMesKey,
    maxMesKey,
    hoje: hojeISO(),
  };
}

function isYearMonthAllowedForUsuario(ano, mes) {
  if (!ano || !mes) return false;
  const { minMesKey, maxMesKey } = getUserAgendaWindow();
  const alvo = monthKey(ano, mes);
  return compareMonthKey(alvo, minMesKey) >= 0 && compareMonthKey(alvo, maxMesKey) <= 0;
}

function isDateAllowedForUsuario(dataISO) {
  if (!isISODateOnly(dataISO)) return false;

  const { maxMesKey, hoje } = getUserAgendaWindow();
  const [anoStr, mesStr] = dataISO.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (!ano || !mes) return false;

  const alvoMesKey = monthKey(ano, mes);

  if (dataISO < hoje) return false;

  return compareMonthKey(alvoMesKey, maxMesKey) <= 0;
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
  const allowed = new Set(["auditorio", "sala_reuniao"]);
  if (!allowed.has(s)) return null;
  return s;
}

function normPeriodo(v) {
  const p = normStr(v, { max: 20 });
  if (!p) return null;
  const allowed = new Set(["manha", "tarde"]);
  return allowed.has(p) ? p : null;
}

function normBoolean(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function capacidadeMaxSala(sala) {
  return sala === "auditorio" ? 60 : 30;
}

function sanitizeBase64(v) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;
  return cleaned;
}

function isStatusAprovado(status) {
  return ["aprovado", "confirmado"].includes(String(status || "").toLowerCase());
}

function isStatusPendente(status) {
  return ["pendente", "em_analise", "solicitado"].includes(String(status || "").toLowerCase());
}

function isStatusFinalNaoDisponivel(status) {
  return ["cancelado", "rejeitado"].includes(String(status || "").toLowerCase());
}

/* ======================================================================= */
/* Helper para ano/mês com fallback seguro                                  */
/* ======================================================================= */
function getAnoMesFromQuery(queryObj) {
  const now = new Date();
  let ano = asInt(queryObj.ano);
  let mes = asInt(queryObj.mes);

  if (!ano || ano < 2000 || ano > 2100) ano = now.getFullYear();
  if (!mes || mes < 1 || mes > 12) mes = now.getMonth() + 1;

  return { ano, mes };
}

/* ======================================================================= */
/* Assinaturas                                                              */
/* ======================================================================= */

async function getAssinaturaById(assinaturaId) {
  const id = asInt(assinaturaId);
  if (!id) return null;

  const { rows } = await query(
    `
    SELECT id, usuario_id, imagem_base64
      FROM assinaturas
     WHERE id = $1
     LIMIT 1
    `,
    [id]
  );

  return rows?.[0] || null;
}

async function getAssinaturaByUsuarioId(usuarioId) {
  const id = asInt(usuarioId);
  if (!id) return null;

  const { rows } = await query(
    `
    SELECT id, usuario_id, imagem_base64
      FROM assinaturas
     WHERE usuario_id = $1
     LIMIT 1
    `,
    [id]
  );

  return rows?.[0] || null;
}

async function upsertAssinaturaUsuario(client, usuarioId, imagemBase64) {
  const userId = asInt(usuarioId);
  const base64 = sanitizeBase64(imagemBase64);

  if (!userId || !base64) return null;

  const { rows } = await client.query(
    `
    INSERT INTO assinaturas (usuario_id, imagem_base64)
    VALUES ($1, $2)
    ON CONFLICT (usuario_id)
    DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
    RETURNING id, usuario_id, imagem_base64
    `,
    [userId, base64]
  );

  return rows?.[0] || null;
}

async function resolveAssinaturaParaSolicitacao(client, usuarioId, body) {
  const termoAceito = normBoolean(body?.termo_aceito, false);
  const assinaturaIdInformada = asInt(body?.assinatura_id);
  const assinaturaBase64 = sanitizeBase64(body?.assinatura_base64);

  if (!termoAceito) {
    return {
      termoAceito: false,
      termoAssinadoEm: null,
      assinaturaId: null,
      assinaturaBase64: null,
    };
  }

  let assinatura = null;

  if (assinaturaIdInformada) {
    assinatura = await getAssinaturaById(assinaturaIdInformada);
    if (!assinatura || Number(assinatura.usuario_id) !== Number(usuarioId)) {
      throw Object.assign(new Error("Assinatura inválida para este usuário."), {
        httpStatus: 400,
      });
    }
  }

  if (!assinatura && assinaturaBase64) {
    assinatura = await upsertAssinaturaUsuario(client, usuarioId, assinaturaBase64);
  }

  if (!assinatura) {
    assinatura = await getAssinaturaByUsuarioId(usuarioId);
  }

  if (!assinatura?.id) {
    throw Object.assign(new Error("Assinatura digital obrigatória para o termo."), {
      httpStatus: 400,
    });
  }

  const termoAssinadoEm = body?.termo_assinado_em
    ? new Date(body.termo_assinado_em)
    : new Date();

  if (Number.isNaN(termoAssinadoEm.getTime())) {
    throw Object.assign(new Error("Data/hora de assinatura inválida."), {
      httpStatus: 400,
    });
  }

  return {
    termoAceito: true,
    termoAssinadoEm,
    assinaturaId: assinatura.id,
    assinaturaBase64: assinatura.imagem_base64 || assinaturaBase64 || null,
  };
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

    const params = [ano, mes];
    let sqlReservas = `
      SELECT
        rs.id,
        rs.sala,
        rs.data::date AS data,
        rs.periodo,
        rs.qtd_pessoas,
        rs.coffee_break,
        rs.status,
        rs.observacao_admin AS observacao,
        rs.finalidade,
        rs.solicitante_id,
        rs.aprovador_id,
        rs.termo_aceito,
        rs.termo_assinado_em,
        rs.assinatura_id,
        rs.created_at,
        rs.updated_at,
        us.nome AS solicitante_nome,
        ua.nome AS aprovador_nome
      FROM reservas_salas rs
      LEFT JOIN usuarios us ON us.id = rs.solicitante_id
      LEFT JOIN usuarios ua ON ua.id = rs.aprovador_id
      WHERE EXTRACT(YEAR FROM rs.data) = $1
        AND EXTRACT(MONTH FROM rs.data) = $2
    `;

    if (sala) {
      params.push(sala);
      sqlReservas += ` AND rs.sala = $${params.length}`;
    }

    sqlReservas += ` ORDER BY rs.data ASC, rs.sala ASC, rs.periodo ASC`;

    const { rows: reservasRaw } = await query(sqlReservas, params);

    const reservas = reservasRaw.map((row) => ({
      ...row,
      pendente_aprovacao: isStatusPendente(row.status),
      aprovado_confirmado: isStatusAprovado(row.status),
      rejeitado_ou_cancelado: isStatusFinalNaoDisponivel(row.status),
    }));

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
    return res.status(500).json({
      ok: false,
      erro: "Erro ao listar agenda das salas.",
      requestId: r,
    });
  }
}

/* ======================================================================= */
/* GET /api/salas/agenda-usuario                                            */
/* Query params: ano, mes (1-12), sala (opcional)                           */
/* - mostra reservas de outros apenas se ainda ocuparem slot                */
/* - mostra as do próprio usuário inclusive canceladas/rejeitadas           */
/* ======================================================================= */
async function listarAgendaUsuario(req, res) {
  const r = rid();
  try {
    const { ano, mes } = getAnoMesFromQuery(req.query);
    const sala = normSala(req.query.sala);
    const usuarioId = Number(req.user?.id);

    if (!usuarioId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    if (!isYearMonthAllowedForUsuario(ano, mes)) {
      return res.status(403).json({
        ok: false,
        erro: "Este mês não está disponível para visualização na agenda do usuário.",
        requestId: r,
      });
    }

    log(r, "[listarAgendaUsuario] query:", { ano, mes, sala, usuarioId });

    const params = [ano, mes, usuarioId];
    let whereSala = "";

    if (sala) {
      params.push(sala);
      whereSala = ` AND rs.sala = $${params.length}`;
    }

    const { rows: reservasRaw } = await query(
      `
      SELECT
        rs.id,
        rs.sala,
        rs.data::date AS data,
        rs.periodo,
        rs.status,
        rs.qtd_pessoas,
        rs.coffee_break,
        rs.termo_aceito,
        rs.termo_assinado_em,
        rs.assinatura_id,
        rs.created_at,
        rs.updated_at,

        CASE
          WHEN rs.solicitante_id = $3 THEN rs.finalidade
          ELSE NULL
        END AS finalidade,

        rs.solicitante_id,
        (rs.solicitante_id = $3) AS minha
      FROM reservas_salas rs
      WHERE EXTRACT(YEAR FROM rs.data) = $1
        AND EXTRACT(MONTH FROM rs.data) = $2
        AND (
          rs.solicitante_id = $3
          OR rs.status IS NULL
          OR rs.status NOT IN ('cancelado'::status_reserva_sala, 'rejeitado'::status_reserva_sala)
        )
        ${whereSala}
      ORDER BY rs.data, rs.sala, rs.periodo, rs.created_at DESC NULLS LAST, rs.id DESC
      `,
      params
    );

    const reservas = reservasRaw.map((row) => ({
      ...row,
      pendente_aprovacao: isStatusPendente(row.status),
      aprovado_confirmado: isStatusAprovado(row.status),
      rejeitado_ou_cancelado: isStatusFinalNaoDisponivel(row.status),
    }));

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
/* body: {                                                                  */
/*   sala, data, periodo, qtd_pessoas, coffee_break, finalidade,            */
/*   observacao?, termo_aceito?, termo_assinado_em?, assinatura_id?,        */
/*   assinatura_base64?                                                     */
/* }                                                                        */
/* ======================================================================= */
async function solicitarReserva(req, res) {
  const r = rid();
  let client;

  try {
    const usuarioId = Number(req.user?.id);
    if (!usuarioId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    const sala = normSala(req.body?.sala);
    const data = normStr(req.body?.data, { max: 10 });
    const periodo = normPeriodo(req.body?.periodo);
    const qtd_pessoas = asInt(req.body?.qtd_pessoas);
    const coffee_break = normBoolean(req.body?.coffee_break, false);
    const finalidade = normStr(req.body?.finalidade, { max: 500 });

    if (!sala || !isISODateOnly(data) || !periodo || !qtd_pessoas) {
      return res.status(400).json({
        ok: false,
        erro: "Sala, data (YYYY-MM-DD), período e quantidade são obrigatórios.",
        requestId: r,
      });
    }

    if (!finalidade) {
      return res.status(400).json({
        ok: false,
        erro: "Informe a finalidade do uso da sala / evento.",
        requestId: r,
      });
    }

    const cap = capacidadeMaxSala(sala);
    if (qtd_pessoas > cap) {
      return res.status(400).json({
        ok: false,
        erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`,
        requestId: r,
      });
    }

    if (!isDateAllowedForUsuario(data)) {
      return res.status(400).json({
        ok: false,
        erro: "A data escolhida está fora da janela permitida para agendamento do usuário.",
        requestId: r,
      });
    }

    if (isWeekend(data)) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em sábados ou domingos.",
        requestId: r,
      });
    }

    const bloqueada = await isDataBloqueada(data);
    if (bloqueada) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        requestId: r,
      });
    }

    client = await getClient();
    await client.query("BEGIN");

    const assinaturaInfo = await resolveAssinaturaParaSolicitacao(client, usuarioId, req.body);

    try {
      const { rows } = await client.query(
        `
        INSERT INTO reservas_salas
          (
            sala,
            data,
            periodo,
            qtd_pessoas,
            coffee_break,
            solicitante_id,
            status,
            finalidade,
            termo_aceito,
            termo_assinado_em,
            assinatura_id
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8, $9, $10)
        RETURNING *;
        `,
        [
          sala,
          data,
          periodo,
          qtd_pessoas,
          coffee_break,
          usuarioId,
          finalidade,
          assinaturaInfo.termoAceito,
          assinaturaInfo.termoAssinadoEm,
          assinaturaInfo.assinaturaId,
        ]
      );

      await client.query("COMMIT");
      return res.status(201).json(rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      if (e?.code === "23505") {
        return res.status(409).json({
          ok: false,
          erro: "Este horário já está reservado para esta sala.",
          requestId: r,
        });
      }
      throw e;
    }
  } catch (e) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch (_) {
      //
    }

    const httpStatus = e?.httpStatus || 500;
    errlog(r, "[solicitarReserva] erro:", e?.message);

    return res.status(httpStatus).json({
      ok: false,
      erro: httpStatus >= 500 ? "Erro ao solicitar reserva." : e.message,
      requestId: r,
      ...(IS_DEV ? { detalhe: e?.message } : {}),
    });
  } finally {
    if (client) client.release();
  }
}

/* ======================================================================= */
/* PUT /api/salas/minhas/:id (usuário edita a própria solicitação)          */
/* body: { sala?, data?, periodo?, qtd_pessoas?, coffee_break?, finalidade?}*/
/* ======================================================================= */
async function atualizarReservaUsuario(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) {
      return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });
    }

    const userId = Number(req.user?.id);
    if (!userId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    const sel = await query(`SELECT * FROM reservas_salas WHERE id = $1`, [id]);
    const atual = sel.rows?.[0];

    if (!atual) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    if (Number(atual.solicitante_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        erro: "Você não pode alterar esta reserva.",
        requestId: r,
      });
    }

    if (String(atual.status) !== "pendente") {
      return res.status(403).json({
        ok: false,
        erro: "Edição permitida apenas enquanto pendente.",
        requestId: r,
      });
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
    const finalidade =
      req.body?.finalidade != null
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
      return res.status(400).json({
        ok: false,
        erro: "Informe a finalidade do uso da sala / evento.",
        requestId: r,
      });
    }

    const cap = capacidadeMaxSala(sala);
    if (qtd_pessoas > cap) {
      return res.status(400).json({
        ok: false,
        erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`,
        requestId: r,
      });
    }

    if (!isDateAllowedForUsuario(data)) {
      return res.status(400).json({
        ok: false,
        erro: "A data escolhida está fora da janela permitida para agendamento do usuário.",
        requestId: r,
      });
    }

    if (isWeekend(data)) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em sábados ou domingos.",
        requestId: r,
      });
    }

    const bloqueada = await isDataBloqueada(data);
    if (bloqueada) {
      return res.status(400).json({
        ok: false,
        erro: "Não é possível agendar em feriados, pontos facultativos ou datas bloqueadas.",
        requestId: r,
      });
    }

    const conflito = await query(
      `
      SELECT 1
        FROM reservas_salas
       WHERE sala = $1
         AND data = $2
         AND periodo = $3
         AND id <> $4
         AND (status IS NULL OR status NOT IN ('cancelado'::status_reserva_sala, 'rejeitado'::status_reserva_sala))
       LIMIT 1
      `,
      [sala, data, periodo, id]
    );

    if (conflito.rowCount > 0) {
      return res.status(409).json({
        ok: false,
        erro: "Já existe uma reserva para esta sala, data e período.",
        requestId: r,
      });
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
      return res.status(409).json({
        ok: false,
        erro: "Conflito de horário para esta sala.",
        requestId: r,
      });
    }
    return res.status(500).json({
      ok: false,
      erro: "Erro ao atualizar a solicitação.",
      requestId: r,
    });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/minhas/:id (usuário cancela a própria solicitação)     */
/* - soft delete: preserva histórico para o calendário                      */
/* ======================================================================= */
async function excluirReservaUsuario(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) {
      return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });
    }

    const userId = Number(req.user?.id);
    if (!userId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    const sel = await query(
      `SELECT id, status, solicitante_id FROM reservas_salas WHERE id = $1`,
      [id]
    );
    const row = sel.rows?.[0];

    if (!row) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    if (Number(row.solicitante_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        erro: "Você não pode excluir esta reserva.",
        requestId: r,
      });
    }

    if (String(row.status) !== "pendente") {
      return res.status(403).json({
        ok: false,
        erro: "Exclusão permitida apenas enquanto pendente.",
        requestId: r,
      });
    }

    const { rows } = await query(
      `
      UPDATE reservas_salas
         SET status = 'cancelado',
             updated_at = NOW()
       WHERE id = $1
       RETURNING *;
      `,
      [id]
    );

    if (!rows?.[0]) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    return res.status(200).json({
      ok: true,
      mensagem: "Solicitação cancelada com sucesso.",
      reserva: rows[0],
      requestId: r,
    });
  } catch (e) {
    errlog(r, "[excluirReservaUsuario] erro:", e?.message);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao excluir a solicitação.",
      requestId: r,
    });
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

  if (tipo === "sempre") {
    const limiteMeses = Math.min(Number(recorrencia.limiteMeses) || 24, 120);
    const base = parseISODateOnly(dataBaseISO);
    if (!base) return [];

    const datas = [];
    for (let i = 1; i <= limiteMeses; i += 1) {
      const d = new Date(base);
      const origDay = d.getDate();
      d.setMonth(d.getMonth() + i);

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

  if (tipo === "semanal" && recorrencia.semanal) {
    const intSem = Math.max(1, Number(recorrencia.semanal.intervaloSemanas) || 1);
    const diasSemana = Array.isArray(recorrencia.semanal.diasSemana)
      ? recorrencia.semanal.diasSemana
      : [];
    const diasSet = new Set(diasSemana.map((x) => Number(x)).filter((x) => x >= 0 && x <= 6));
    if (!diasSet.size) return [];

    const oneDayMs = 24 * 60 * 60 * 1000;
    const limiteDias = repeticao * 7 * intSem + 21;

    for (let i = 1; i <= limiteDias && results.length < repeticao; i += 1) {
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

  if (tipo === "mensal" && recorrencia.mensal) {
    const modo = String(recorrencia.mensal.modo || "dia_mes");
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();

    for (let i = 1; i <= repeticao; i += 1) {
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

  if (tipo === "anual" && recorrencia.anual) {
    const modo = String(recorrencia.anual.modo || "dia_mes");
    const meses = Array.isArray(recorrencia.anual.meses) ? recorrencia.anual.meses : [];
    const mesesSorted = Array.from(
      new Set(meses.map((m) => Number(m)).filter((m) => m >= 0 && m <= 11))
    ).sort((a, b) => a - b);

    if (!mesesSorted.length) return [];

    const baseYear = baseDate.getFullYear();
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
    if (!adminId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    const sala = normSala(req.body?.sala);
    const data = normStr(req.body?.data, { max: 10 });
    const periodo = normPeriodo(req.body?.periodo);
    const qtd_pessoas = asInt(req.body?.qtd_pessoas);
    const coffee_break = normBoolean(req.body?.coffee_break, false);
    const status = normStr(req.body?.status, { max: 20 }) || "aprovado";
    const observacao = normStr(req.body?.observacao, { max: 1000 });
    const finalidade = normStr(req.body?.finalidade, { max: 500 });
    const recorrencia =
      req.body?.recorrencia && typeof req.body.recorrencia === "object"
        ? req.body.recorrencia
        : null;

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
      return res.status(400).json({
        ok: false,
        erro: `Capacidade máxima para esta sala é de ${cap} pessoas.`,
        requestId: r,
      });
    }

    let datasRecorrentes = [];
    try {
      datasRecorrentes = gerarDatasRecorrencia(data, recorrencia);
    } catch (eRec) {
      warn(r, "[criarReservaAdmin] recorrencia inválida, ignorando:", eRec?.message);
      datasRecorrentes = [];
    }

    const todasDatas = [data, ...datasRecorrentes].filter(isISODateOnly);
    const datasUnicas = Array.from(new Set(todasDatas)).sort();

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
        (
          sala,
          data,
          periodo,
          qtd_pessoas,
          coffee_break,
          solicitante_id,
          status,
          observacao_admin,
          finalidade,
          aprovador_id,
          termo_aceito
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
      RETURNING *;
    `;

    const inseridas = [];
    const conflitos = [];

    for (const dt of datasValidas) {
      await client.query("SAVEPOINT sp_reserva");
      try {
        const aprovadorId = isStatusAprovado(status) ? adminId : null;

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
          aprovadorId,
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
    if (!id) {
      return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });
    }

    const adminId = Number(req.user?.id);
    if (!adminId) {
      return res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: r });
    }

    const status = normStr(req.body?.status, { max: 20 });
    const qtd_pessoas = req.body?.qtd_pessoas != null ? asInt(req.body.qtd_pessoas) : null;
    const coffee_break =
      typeof req.body?.coffee_break === "boolean" ? req.body.coffee_break : null;
    const observacao =
      req.body?.observacao != null ? normStr(req.body.observacao, { max: 1000 }) : null;
    const finalidade =
      req.body?.finalidade != null ? normStr(req.body.finalidade, { max: 500 }) : null;

    const aprovaAgora = isStatusAprovado(status);
    const aprovadorId = aprovaAgora ? adminId : null;

    const { rows } = await query(
      `
      UPDATE reservas_salas
         SET status           = COALESCE($2, status),
             qtd_pessoas      = COALESCE($3, qtd_pessoas),
             coffee_break     = COALESCE($4, coffee_break),
             observacao_admin = COALESCE($5, observacao_admin),
             finalidade       = COALESCE($6, finalidade),
             aprovador_id     = CASE
                                  WHEN $7::bigint IS NOT NULL THEN $7
                                  WHEN $2 IN ('rejeitado', 'cancelado') THEN NULL
                                  ELSE aprovador_id
                                END,
             updated_at       = NOW()
       WHERE id = $1
       RETURNING *;
      `,
      [id, status || null, qtd_pessoas, coffee_break, observacao, finalidade, aprovadorId]
    );

    if (!rows?.[0]) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    return res.json(rows[0]);
  } catch (e) {
    errlog(r, "[atualizarReservaAdmin] erro:", e?.message);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao atualizar reserva.",
      requestId: r,
    });
  }
}

/* ======================================================================= */
/* DELETE /api/salas/admin/reservas/:id                                     */
/* - soft delete: preserva histórico para o calendário                      */
/* ======================================================================= */
async function excluirReservaAdmin(req, res) {
  const r = rid();
  try {
    const id = asInt(req.params?.id);
    if (!id) {
      return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });
    }

    const { rows } = await query(
      `
      UPDATE reservas_salas
         SET status = 'cancelado',
             aprovador_id = NULL,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *;
      `,
      [id]
    );

    if (!rows?.[0]) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    return res.status(200).json({
      ok: true,
      mensagem: "Reserva cancelada com sucesso.",
      reserva: rows[0],
      requestId: r,
    });
  } catch (e) {
    errlog(r, "[excluirReservaAdmin] erro:", e?.message);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao excluir reserva.",
      requestId: r,
    });
  }
}

/* ======================================================================= */
/* GET /api/salas/admin/reservas/:id/termo-pdf                              */
/* - Gera o PDF do termo sob demanda                                        */
/* ======================================================================= */
async function visualizarTermoReservaAdmin(req, res) {
  const r = rid();

  try {
    const id = asInt(req.params?.id);
    if (!id) {
      return res.status(400).json({ ok: false, erro: "ID inválido.", requestId: r });
    }

    const { rows } = await query(
      `
      SELECT
        rs.id,
        rs.sala,
        rs.data::date AS data,
        rs.periodo,
        rs.qtd_pessoas,
        rs.coffee_break,
        rs.status,
        rs.finalidade,
        rs.observacao_admin,
        rs.solicitante_id,
        rs.aprovador_id,
        rs.termo_aceito,
        rs.termo_assinado_em,
        rs.assinatura_id,
        us.nome AS solicitante_nome,
        ua.nome AS aprovador_nome,
        a.imagem_base64
      FROM reservas_salas rs
      LEFT JOIN usuarios us ON us.id = rs.solicitante_id
      LEFT JOIN usuarios ua ON ua.id = rs.aprovador_id
      LEFT JOIN assinaturas a ON a.id = rs.assinatura_id
      WHERE rs.id = $1
      LIMIT 1
      `,
      [id]
    );

    const reserva = rows?.[0];
    if (!reserva) {
      return res.status(404).json({ ok: false, erro: "Reserva não encontrada.", requestId: r });
    }

    if (!reserva.termo_aceito || !reserva.termo_assinado_em || !reserva.assinatura_id) {
      return res.status(400).json({
        ok: false,
        erro: "Esta reserva ainda não possui termo assinado disponível.",
        requestId: r,
      });
    }

    let PDFDocument;
    try {
      PDFDocument = require("pdfkit");
    } catch (e) {
      errlog(r, "[visualizarTermoReservaAdmin] pdfkit ausente:", e?.message);
      return res.status(500).json({
        ok: false,
        erro: "Dependência PDFKit não encontrada no servidor.",
        requestId: r,
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="termo-reserva-${id}.pdf"`);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      info: {
        Title: `Termo de Uso das Salas - Reserva ${id}`,
        Author: "Escola da Saúde",
      },
    });

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE DE SANTOS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#334155");
    doc.text("ESCOLA DA SAÚDE", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827");
    doc.text("TERMO DE USO DAS SALAS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10).fillColor("#475569");
    doc.text("Escola da Saúde / SMS", {
      align: "center",
      width: contentWidth,
    });

    doc.moveDown(1.5);

    doc.font("Helvetica").fontSize(11).fillColor("#1f2937");
    doc.text(
      "Este Termo tem por objetivo regulamentar o uso do Auditório e da Sala de Reuniões da Escola da Saúde da Secretaria Municipal de Saúde de Santos (SMS), estabelecendo as responsabilidades e condições para sua utilização.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text("1. Finalidade de Uso");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(
      "As salas destinam-se, prioritariamente, às atividades de Educação Permanente em Saúde.",
      { align: "justify", width: contentWidth }
    );

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text("2. Responsabilidades do Responsável pelo Evento");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);

    const bullets = [
      "Chegar 30 minutos antes para preparar a sala (ligar equipamentos, organizar espaço).",
      "O notebook deve ser acessado com o SSHD do responsável (em caso de visitante, utilizar o SSHD do servidor solicitante).",
      "Coffee break: será autorizado somente se informado na reserva; deve ser montado apenas na sacada externa; os alimentos, descartáveis e a limpeza são de responsabilidade do solicitante; o lixo deve ser descartado no contentor ao final do corredor do mesmo andar.",
      "Não é permitido o consumo de alimentos no interior da sala.",
      "Ao final do evento, devolver a sala às condições originais: recolocar mesas e cadeiras, desligar equipamentos e avisar à equipe da Escola sobre o término do uso.",
      "A Escola dispõe de bebedouro, não disponibilizando copos descartáveis.",
      "Horário de funcionamento: 8h às 17h.",
    ];

    bullets.forEach((item) => {
      doc.text(`• ${item}`, {
        align: "justify",
        width: contentWidth,
        indent: 10,
      });
      doc.moveDown(0.35);
    });

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).text("3. Disposições Finais");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).text(
      "De acordo com a Ordem de Serviço Nº 007/2020 – GAB/SMS, a Escola da Saúde é responsável pelo gerenciamento, divulgação institucional, autorização e apoio às atividades de educação permanente em saúde no âmbito da SMS.",
      {
        align: "justify",
        width: contentWidth,
      }
    );
    doc.moveDown(0.5);
    doc.text(
      "Ao assinar este termo, o responsável declara estar ciente das normas acima e compromete-se a cumpri-las integralmente.",
      {
        align: "justify",
        width: contentWidth,
      }
    );

    doc.moveDown(1.3);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
    doc.text(`NOME DO EVENTO: ${reserva.finalidade || "—"}`);
    doc.moveDown(0.4);
    doc.text(`DATA: ${formatDateBR(reserva.data)}`);
    doc.moveDown(0.4);
    doc.text(`SALA: ${reserva.sala === "auditorio" ? "Auditório" : "Sala de Reunião"}`);
    doc.moveDown(0.4);
    doc.text(`PERÍODO: ${reserva.periodo === "manha" ? "Manhã" : "Tarde"}`);
    doc.moveDown(0.4);
    doc.text(`SOLICITANTE: ${reserva.solicitante_nome || "—"}`);
    doc.moveDown(0.4);
    if (reserva.aprovador_nome) {
      doc.text(`APROVADO POR: ${reserva.aprovador_nome}`);
      doc.moveDown(0.4);
    }

    const assinaturaBase64 = sanitizeBase64(reserva.imagem_base64);
    if (assinaturaBase64) {
      try {
        const imgBuffer = Buffer.from(assinaturaBase64, "base64");

        doc.moveDown(1.8);

        const assinaturaY = doc.y;
        doc.image(imgBuffer, doc.page.margins.left + 60, assinaturaY, {
          fit: [220, 90],
          align: "left",
          valign: "center",
        });

        doc.moveDown(4.2);
      } catch (eImg) {
        warn(r, "[visualizarTermoReservaAdmin] assinatura inválida para PDF:", eImg?.message);
        doc.moveDown(2.5);
      }
    } else {
      doc.moveDown(2.5);
    }

    doc.moveTo(doc.page.margins.left + 40, doc.y)
      .lineTo(doc.page.margins.left + 300, doc.y)
      .strokeColor("#94a3b8")
      .stroke();

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827");
    doc.text(reserva.solicitante_nome || "—", doc.page.margins.left + 60, doc.y, {
      width: 240,
      align: "center",
    });

    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#475569");
    doc.text(
      `Assinado digitalmente em ${formatDateTimeBR(reserva.termo_assinado_em)}`,
      doc.page.margins.left + 40,
      doc.y,
      {
        width: 280,
        align: "center",
      }
    );

    doc.end();
  } catch (e) {
    errlog(r, "[visualizarTermoReservaAdmin] erro:", e?.message);
    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        erro: "Erro ao gerar o PDF do termo.",
        requestId: r,
      });
    }
    res.end();
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
  visualizarTermoReservaAdmin,
};