/* eslint-disable no-console */
// ✅ src/controllers/presencasController.js — PREMIUM (robusto, date-only safe, idempotente, logs com RID, compat DB)
const dbMod = require("../db");
const PDFDocument = require("pdfkit");
const jwt = require("jsonwebtoken");

// opcional: usado apenas em PDF e mensagens legíveis
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");

// ✅ pós-presença (best-effort)
const { gerarNotificacoesDeAvaliacao } = require("./notificacoesController");

// Compat DB: { pool, query } ou export direto
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[presencasController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em presencasController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* =====================================================================
   Logger premium (RID)
===================================================================== */
function mkRid(prefix = "PRS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function _log(rid, level, msg, extra) {
  const p = `[${rid}]`;
  if (level === "error") return console.error(`${p} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (level === "warn") return console.warn(`${p} ⚠ ${msg}`, extra || "");
  if (level === "info") return IS_DEV ? console.log(`${p} • ${msg}`, extra || "") : undefined;
  return IS_DEV ? console.log(`${p} ▶ ${msg}`, extra || "") : undefined;
}
const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

/* =====================================================================
   Secrets
===================================================================== */
const PRESENCA_TOKEN_SECRET = process.env.PRESENCA_TOKEN_SECRET || "troque_em_producao";
if (!process.env.PRESENCA_TOKEN_SECRET && !IS_DEV) {
  // em produção, alertar (mas não derrubar)
  console.warn("[presencasController] ⚠ PRESENCA_TOKEN_SECRET ausente (use env var em produção).");
}

/* =====================================================================
   Date-only safe helpers (sem “pulo”)
   - Internamente comparamos 'YYYY-MM-DD' (strings)
   - Quando precisar de Date (PDF/janela), usamos horário fixo ou TZ explícito
===================================================================== */
function hojeYMD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((o, p) => ((o[p.type] = p.value), o), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizarDataEntrada(valor) {
  if (!valor) return null;
  const v = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function ymd(val) {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Date seguro para "dia" (meio-dia) — evita pulo ao formatar */
function localDateFromYMD(ymdStr) {
  return ymdStr ? new Date(`${ymdStr}T12:00:00`) : null;
}

/** Date de janela em SP (para regras de -30min/+48h). */
function dateTimeSP(ymdStr, hhmm = "00:00") {
  // -03:00 é suficiente para Santos; se quiser DST histórico, aí precisa lib de TZ.
  return new Date(`${ymdStr}T${String(hhmm).slice(0, 5)}:00-03:00`);
}

/* =====================================================================
   DB helpers
===================================================================== */
async function buscarEventoIdDaTurma(turma_id) {
  const rid = mkRid("EVT");
  const id = Number(turma_id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("turma_id inválido.");

  try {
    const { rows } = await query(`SELECT evento_id FROM turmas WHERE id = $1`, [id]);
    if (!rows?.length) throw new Error("Turma não encontrada.");
    return rows[0].evento_id;
  } catch (e) {
    logError(rid, "buscarEventoIdDaTurma", e);
    throw e;
  }
}

/** Datas reais da turma (prioriza datas_turma; fallback: período da turma) -> array 'YYYY-MM-DD' ordenado */
async function obterDatasDaTurma(turma_id) {
  const tid = Number(turma_id);
  if (!Number.isFinite(tid) || tid <= 0) return [];

  // 1) datas_turma
  const datasQ = await query(
    `SELECT to_char(data::date,'YYYY-MM-DD') AS d
       FROM datas_turma
      WHERE turma_id = $1
      ORDER BY data ASC`,
    [tid]
  );
  if ((datasQ?.rowCount ?? 0) > 0) {
    return (datasQ.rows || []).map((r) => r.d).filter(Boolean);
  }

  // 2) fallback: período da turma
  const t = await query(
    `SELECT to_char(data_inicio::date,'YYYY-MM-DD') AS di,
            to_char(data_fim::date,'YYYY-MM-DD')    AS df
       FROM turmas
      WHERE id = $1`,
    [tid]
  );
  if (!t?.rows?.length) return [];

  const di = t.rows[0].di;
  const df = t.rows[0].df;
  if (!di || !df) return [];

  const out = [];
  for (let d = localDateFromYMD(di); d <= localDateFromYMD(df); d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Mapa de presenças TRUE por (usuario|data) para a turma */
async function mapearPresencasTrue(turma_id) {
  const tid = Number(turma_id);
  const presQ = await query(
    `SELECT usuario_id, to_char(data_presenca::date,'YYYY-MM-DD') AS d, presente
       FROM presencas
      WHERE turma_id = $1`,
    [tid]
  );
  const map = new Map();
  for (const r of presQ.rows || []) {
    if (r.presente === true) {
      map.set(`${String(r.usuario_id)}|${r.d}`, true);
    }
  }
  return map;
}

/** Mapa detalhado de presenças por (usuario|data) com timestamp de confirmação */
async function mapearPresencasDetalhe(turma_id) {
  const tid = Number(turma_id);
  const presQ = await query(
    `SELECT usuario_id,
            to_char(data_presenca::date,'YYYY-MM-DD') AS data_dia,
            presente,
            confirmado_em
       FROM presencas
      WHERE turma_id = $1`,
    [tid]
  );

  const map = new Map(); // "usuario|YYYY-MM-DD" -> { presente, confirmado_em }
  for (const r of presQ.rows || []) {
    const k = `${String(r.usuario_id)}|${r.data_dia}`;
    const v = { presente: r.presente === true, confirmado_em: r.confirmado_em || null };
    const prev = map.get(k);

    if (!prev) {
      map.set(k, v);
      continue;
    }

    // prioridade: presente=true > false; depois confirmado_em mais recente
    if (!prev.presente && v.presente) {
      map.set(k, v);
      continue;
    }
    if (prev.presente === v.presente) {
      const a = prev.confirmado_em ? new Date(prev.confirmado_em).getTime() : 0;
      const b = v.confirmado_em ? new Date(v.confirmado_em).getTime() : 0;
      if (b > a) map.set(k, v);
    }
  }

  return map;
}

/** Horário de início na data (datas_turma > turmas) -> "HH:MM" */
async function horarioInicioNaData(turma_id, dataYMD) {
  try {
    const q1 = await query(
      `SELECT to_char(horario_inicio::time,'HH24:MI') AS hi
         FROM datas_turma
        WHERE turma_id = $1 AND data::date = $2::date
        LIMIT 1`,
      [Number(turma_id), dataYMD]
    );
    if (q1?.rows?.[0]?.hi) return q1.rows[0].hi;

    const q2 = await query(
      `SELECT to_char(horario_inicio::time,'HH24:MI') AS hi
         FROM turmas
        WHERE id = $1
        LIMIT 1`,
      [Number(turma_id)]
    );
    return q2?.rows?.[0]?.hi || "08:00";
  } catch {
    return "08:00";
  }
}

/** Horário de fim na data (datas_turma > turmas) -> "HH:MM" */
async function horarioFimNaData(turma_id, dataYMD) {
  try {
    const q1 = await query(
      `SELECT to_char(horario_fim::time,'HH24:MI') AS hf
         FROM datas_turma
        WHERE turma_id = $1 AND data::date = $2::date
        LIMIT 1`,
      [Number(turma_id), dataYMD]
    );
    if (q1?.rows?.[0]?.hf) return q1.rows[0].hf;

    const q2 = await query(
      `SELECT to_char(horario_fim::time,'HH24:MI') AS hf
         FROM turmas
        WHERE id = $1
        LIMIT 1`,
      [Number(turma_id)]
    );
    return q2?.rows?.[0]?.hf || "23:59";
  } catch {
    return "23:59";
  }
}

/* =====================================================================
   Elegibilidade para avaliação (>=75% + turma encerrada)
   - IMPORTANTE: não depende de JSON em notificacoes (evita schema mismatch)
   - dispara gerarNotificacoesDeAvaliacao(usuario_id) (compat com seu controller)
   - idempotência fica a cargo de buscarAvaliacoesPendentes + dedupe do notif controller
===================================================================== */
async function obterFimRealDaTurma(turma_id) {
  const sql = `
    WITH base AS (
      SELECT
        (
          SELECT (dt.data::date + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time))
          FROM datas_turma dt
          JOIN turmas t ON t.id = dt.turma_id
          WHERE dt.turma_id = $1
          ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
          LIMIT 1
        ) AS fim_dt,
        (
          SELECT (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
          FROM turmas t
          WHERE t.id = $1
          LIMIT 1
        ) AS fim_tb
    )
    SELECT COALESCE(fim_dt, fim_tb) AS fim_real FROM base;
  `;
  const q = await query(sql, [Number(turma_id)]);
  return q.rows?.[0]?.fim_real ? new Date(q.rows[0].fim_real) : null;
}

async function verificarElegibilidadeParaAvaliacao(usuario_id, turma_id) {
  const rid = mkRid("ELIG");
  const uid = Number(usuario_id);
  const tid = Number(turma_id);

  try {
    if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) return;

    // 1) turma encerrou (fim real)
    const fimReal = await obterFimRealDaTurma(tid);
    if (!fimReal) {
      logWarn(rid, "turma sem fim_real", { turma_id: tid });
      return;
    }
    if (new Date() < fimReal) {
      logInfo(rid, "ainda não encerrou", { turma_id: tid, fimReal: fimReal.toISOString() });
      return;
    }

    // 2) total encontros
    const datas = await obterDatasDaTurma(tid);
    if (!datas.length) {
      logWarn(rid, "turma sem datas", { turma_id: tid });
      return;
    }

    // 3) presenças distintas do usuário
    const presRes = await query(
      `SELECT COUNT(DISTINCT data_presenca::date) AS presentes
         FROM presencas
        WHERE turma_id = $1 AND usuario_id = $2 AND presente = TRUE`,
      [tid, uid]
    );
    const presentes = Number.parseInt(presRes.rows?.[0]?.presentes || "0", 10);
    const freq = presentes / datas.length;

    if (freq < 0.75) {
      logInfo(rid, "freq insuficiente", { turma_id: tid, usuario_id: uid, presentes, total: datas.length, freq });
      return;
    }

    // 4) best-effort: gera notifs (dedupe dentro do notificacoesController)
    try {
      await gerarNotificacoesDeAvaliacao(uid);
      logInfo(rid, "gerarNotificacoesDeAvaliacao OK", { usuario_id: uid, turma_id: tid, freq });
    } catch (e) {
      logWarn(rid, "falha gerarNotificacoesDeAvaliacao (não bloqueante)", e?.message || e);
    }
  } catch (err) {
    logError(rid, "verificarElegibilidadeParaAvaliacao", err);
  }
}

/* =====================================================================
   PATCH/POST handlers
===================================================================== */

/* ------------------------------------------------------------------ *
 * PATCH /api/presencas/confirmar  (instrutor)
 * Body: { usuario_id, turma_id, data }
 * ------------------------------------------------------------------ */
async function confirmarPresencaInstrutor(req, res) {
  const rid = mkRid();
  const { usuario_id, turma_id, data } = req.body || {};
  const instrutor_id = Number(req.user?.id);

  if (!usuario_id || !turma_id || !data) {
    return res.status(400).json({ erro: "Campos obrigatórios não informados." });
  }

  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  const dataISO = normalizarDataEntrada(data);

  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) {
    return res.status(400).json({ erro: "usuario_id/turma_id inválidos." });
  }
  if (!dataISO) {
    return res.status(400).json({ erro: "Data inválida. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  try {
    // garante que este instrutor ministra a turma (evento_instrutor -> turmas)
    const okInstrutor = await query(
      `
      SELECT 1
        FROM evento_instrutor ei
        JOIN turmas t ON t.evento_id = ei.evento_id
       WHERE t.id = $1 AND ei.instrutor_id = $2
       LIMIT 1
      `,
      [tid, instrutor_id]
    );
    if ((okInstrutor?.rowCount ?? 0) === 0) {
      return res.status(403).json({ erro: "Acesso negado. Você não é instrutor desta turma." });
    }

    // prazo 48h após horário_fim do dia confirmado (datas_turma > turmas)
    const hf = await horarioFimNaData(tid, dataISO); // "HH:MM"
    const fimAula = dateTimeSP(dataISO, hf);
    const limite = new Date(fimAula.getTime() + 48 * 60 * 60 * 1000);

    if (new Date() > limite) {
      return res.status(403).json({ erro: "O prazo de 48h para confirmação já expirou." });
    }

    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
      `,
      [uid, tid, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(uid, tid);
    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    logError(rid, "confirmarPresencaInstrutor", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas  (aluno/monitor)
 * Body: { evento_id, data }
 * ------------------------------------------------------------------ */
async function registrarPresenca(req, res) {
  const rid = mkRid();
  const { evento_id, data } = req.body || {};
  const usuario_id = Number(req.user?.id);

  if (!evento_id || !data) {
    return res.status(400).json({ erro: "Evento e data são obrigatórios." });
  }

  const eventoId = Number(evento_id);
  const dataISO = normalizarDataEntrada(data);

  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }
  if (!dataISO) {
    return res.status(400).json({ erro: "Data inválida. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  try {
    // turma onde este usuário está inscrito (no evento)
    const insc = await query(
      `
      SELECT i.turma_id,
             to_char(t.data_inicio::date,'YYYY-MM-DD') AS di,
             to_char(t.data_fim::date,'YYYY-MM-DD')    AS df
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
       WHERE i.usuario_id = $1 AND t.evento_id = $2
       LIMIT 1
      `,
      [usuario_id, eventoId]
    );
    if ((insc?.rowCount ?? 0) === 0) {
      return res.status(403).json({ erro: "Você não está inscrito neste evento." });
    }

    const turma_id = Number(insc.rows[0].turma_id);
    const di = insc.rows[0].di;
    const df = insc.rows[0].df;

    if (di && df && (dataISO < di || dataISO > df)) {
      return res.status(400).json({ erro: "Data fora do período desta turma." });
    }

    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
      `,
      [usuario_id, turma_id, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    return res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    logError(rid, "registrarPresenca", err);
    return res.status(500).json({ erro: "Erro ao registrar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmarPresencaViaQR
 * Aceita body { turma_id } ou param :turma_id (rotas legadas)
 * Valida por datas_turma; se vazio, cai no intervalo da turma.
 * 🟢 Libera 30 minutos ANTES do horário de início.
 * ------------------------------------------------------------------ */
async function confirmarPresencaViaQR(req, res) {
  const rid = mkRid();
  const usuario_id = Number(req.user?.id);
  const turma_id = Number(req.params.turma_id || req.body?.turma_id);

  try {
    if (!Number.isFinite(usuario_id) || usuario_id <= 0) return res.status(401).json({ erro: "Não autenticado." });
    if (!Number.isFinite(turma_id) || turma_id <= 0) return res.status(400).json({ erro: "turma_id é obrigatório." });

    // precisa estar inscrito na turma
    const insc = await query(`SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`, [
      usuario_id,
      turma_id,
    ]);
    if ((insc?.rowCount ?? 0) === 0) {
      return res.status(403).json({ erro: "Você não está inscrito nesta turma." });
    }

    const hoje = hojeYMD(); // yyyy-mm-dd em SP

    // datas reais da turma (ou período)
    const datas = await obterDatasDaTurma(turma_id);
    if (!datas.length) return res.status(400).json({ erro: "Turma sem datas válidas." });

    if (!datas.includes(hoje)) {
      return res.status(409).json({ erro: "Hoje não está dentro do período desta turma." });
    }

    // janela: -30 min do início
    const hi = await horarioInicioNaData(turma_id, hoje);
    const allowedAt = dateTimeSP(hoje, hi);
    allowedAt.setMinutes(allowedAt.getMinutes() - 30);

    if (new Date() < allowedAt) {
      return res.status(409).json({
        erro: `Confirmação disponível a partir de 30 minutos antes do início (${hi}).`,
      });
    }

    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
      `,
      [usuario_id, turma_id, hoje]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    return res.status(201).json({ sucesso: true, mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    logError(rid, "confirmarPresencaViaQR", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-via-token (token assinado)
 * Body: { token }
 * ------------------------------------------------------------------ */
async function confirmarViaToken(req, res) {
  const rid = mkRid();
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ erro: "Token ausente." });

    let payload;
    try {
      payload = jwt.verify(token, PRESENCA_TOKEN_SECRET); // { turmaId, usuarioId? }
    } catch {
      return res.status(400).json({ erro: "Token inválido ou expirado." });
    }

    const usuario_id = Number(payload.usuarioId || req.user?.id);
    const turma_id = Number(payload.turmaId);

    if (!Number.isFinite(usuario_id) || usuario_id <= 0) return res.status(401).json({ erro: "Não autenticado." });
    if (!Number.isFinite(turma_id) || turma_id <= 0) return res.status(400).json({ erro: "Token sem turma." });

    // injeta para reusar fluxo QR
    req.body = { ...(req.body || {}), turma_id };
    req.user = { ...(req.user || {}), id: usuario_id };
    return confirmarPresencaViaQR(req, res);
  } catch (err) {
    logError(rid, "confirmarViaToken", err);
    return res.status(500).json({ erro: "Erro ao confirmar via token." });
  }
}

/**
 * Confirma presença por token (idempotente), usada por fluxos externos.
 * Parâmetros: { usuario_id, turma_id, data_ref:'YYYY-MM-DD' }
 */
async function confirmarPresencaViaToken({ usuario_id, turma_id, data_ref }) {
  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  const dataISO = normalizarDataEntrada(data_ref);

  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) {
    return { ok: false, mensagem: "Parâmetros inválidos." };
  }
  if (!dataISO) return { ok: false, mensagem: "Data inválida." };

  const datas = await obterDatasDaTurma(tid);
  if (!datas.includes(dataISO)) return { ok: false, mensagem: "Data fora das datas válidas da turma." };

  await query(
    `
    INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
    VALUES ($1, $2, $3, TRUE, NOW())
    ON CONFLICT (usuario_id, turma_id, data_presenca)
    DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
    `,
    [uid, tid, dataISO]
  );

  try {
    await verificarElegibilidadeParaAvaliacao(uid, tid);
  } catch {}

  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/registrar-manual (instrutor/admin)
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function registrarManual(req, res) {
  const rid = mkRid();
  const { usuario_id, turma_id, data_presenca } = req.body || {};

  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  const dataISO = normalizarDataEntrada(data_presenca);

  if (!uid || !tid || !data_presenca) {
    return res.status(400).json({ erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca." });
  }
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) {
    return res.status(400).json({ erro: "usuario_id/turma_id inválidos." });
  }
  if (!dataISO) {
    return res.status(400).json({ erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  try {
    const datas = await obterDatasDaTurma(tid);
    if (datas.length && !datas.includes(dataISO)) {
      return res.status(400).json({ erro: "Data fora das datas válidas desta turma." });
    }

    // manual = pendente (presente=false) até validar
    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = FALSE
      `,
      [uid, tid, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(uid, tid);
    return res.status(201).json({ mensagem: "Presença registrada manualmente como pendente." });
  } catch (err) {
    logError(rid, "registrarManual", err);
    return res.status(500).json({ erro: "Erro ao registrar presença manual." });
  }
}

/* ------------------------------------------------------------------ *
 * PATCH/PUT /api/presencas/validar
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function validarPresenca(req, res) {
  const rid = mkRid();
  const { usuario_id, turma_id, data_presenca } = req.body || {};

  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  const dataISO = normalizarDataEntrada(data_presenca);

  if (!usuario_id || !turma_id || !data_presenca) {
    return res.status(400).json({ erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca." });
  }
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) {
    return res.status(400).json({ erro: "usuario_id/turma_id inválidos." });
  }
  if (!dataISO) return res.status(400).json({ erro: "Data inválida." });

  try {
    const upd = await query(
      `
      UPDATE presencas
         SET presente = TRUE, confirmado_em = NOW()
       WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3::date
   RETURNING usuario_id, turma_id, to_char(data_presenca::date,'YYYY-MM-DD') AS data_presenca, presente, confirmado_em
      `,
      [uid, tid, dataISO]
    );

    if ((upd?.rowCount ?? 0) === 0) {
      return res.status(404).json({ erro: "Presença não encontrada para validação." });
    }

    await verificarElegibilidadeParaAvaliacao(uid, tid);
    return res.json({ mensagem: "Presença validada com sucesso.", presenca: upd.rows[0] });
  } catch (err) {
    logError(rid, "validarPresenca", err);
    return res.status(500).json({ erro: "Erro ao validar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-hoje (admin)
 * Body: { usuario_id, turma_id }
 * - libera -30min
 * - valida se HOJE é dia válido da turma
 * ------------------------------------------------------------------ */
async function confirmarHojeManual(req, res) {
  const rid = mkRid();
  const { usuario_id, turma_id } = req.body || {};

  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  if (!uid || !tid) return res.status(400).json({ erro: "Dados incompletos." });

  const hoje = hojeYMD();

  try {
    // gate: -30 min
    const hi = await horarioInicioNaData(tid, hoje);
    const allowedAt = dateTimeSP(hoje, hi);
    allowedAt.setMinutes(allowedAt.getMinutes() - 30);
    if (new Date() < allowedAt) {
      return res.status(409).json({
        erro: `Administrador só pode lançar presença de hoje a partir de 30 minutos antes do início (${hi}).`,
      });
    }

    const datas = await obterDatasDaTurma(tid);
    if (!datas.includes(hoje)) {
      return res.status(400).json({ erro: "Hoje não é um dia válido desta turma." });
    }

    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
      `,
      [uid, tid, hoje]
    );

    await verificarElegibilidadeParaAvaliacao(uid, tid);
    return res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    logError(rid, "confirmarHojeManual", err);
    return res.status(500).json({ erro: "Erro ao registrar presença manual." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/frequencias
 * ------------------------------------------------------------------ */
async function listaPresencasTurma(req, res) {
  const rid = mkRid();
  const turma_id = Number(req.params.turma_id);

  try {
    const datas = await obterDatasDaTurma(turma_id);
    if (!datas.length) return res.status(400).json({ erro: "Turma sem datas válidas." });

    const insc = await query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf
        FROM inscricoes i
        JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.turma_id = $1
       ORDER BY u.nome
      `,
      [turma_id]
    );

    const presMap = await mapearPresencasTrue(turma_id);

    const resultado = (insc.rows || []).map((u) => {
      const presentes = datas.filter((d) => presMap.get(`${String(u.usuario_id)}|${d}`)).length;
      const total = datas.length;
      const freqPct = total > 0 ? (presentes / total) * 100 : 0;

      return {
        usuario_id: u.usuario_id,
        nome: u.nome,
        cpf: u.cpf,
        total_encontros: total,
        presentes,
        ausencias: Math.max(0, total - presentes),
        frequencia: `${Math.round(freqPct)}%`,
        presente: freqPct >= 75,
      };
    });

    return res.json(resultado);
  } catch (err) {
    logError(rid, "listaPresencasTurma", err);
    return res.status(500).json({ erro: "Erro ao buscar presenças da turma." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/detalhes
 * ------------------------------------------------------------------ */
async function relatorioPresencasPorTurma(req, res) {
  const rid = mkRid("PRSDET");
  const turma_id = Number(req.params.turma_id);
  const strict = String(req.query.strict || "").trim() === "1";

  try {
    logInfo(rid, "INICIO", { turma_id });

    const turmaQ = await query(`SELECT id, evento_id FROM turmas WHERE id = $1 LIMIT 1`, [turma_id]);
    if ((turmaQ?.rowCount ?? 0) === 0) {
      logWarn(rid, "Turma não encontrada", { turma_id });
      if (strict) return res.status(404).json({ erro: "Turma não encontrada." });
      return res.status(200).json({ turma_id, evento_id: null, datas: [], usuarios: [] });
    }

    const eventoId = turmaQ.rows[0].evento_id || null;

    const datasArr = await obterDatasDaTurma(turma_id);

    const usuariosQ = await query(
      `
      SELECT u.id, u.nome, u.cpf
        FROM inscricoes i
        JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.turma_id = $1
       ORDER BY u.nome
      `,
      [turma_id]
    );

    const presDetMap = await mapearPresencasDetalhe(turma_id);

    const usuariosArr = (usuariosQ.rows || []).map((u) => {
      const presentesDatas = [];
      const presencas = datasArr.map((data) => {
        const key = `${String(u.id)}|${data}`;
        const info = presDetMap.get(key);
        const presente = !!info?.presente;
        if (presente) presentesDatas.push(data);
        return { data, presente, confirmado_em: info?.confirmado_em || null };
      });

      const presentesSet = new Set(presentesDatas);
      const ausenciasDatas = datasArr.filter((d) => !presentesSet.has(d));

      return {
        id: u.id,
        nome: u.nome,
        cpf: u.cpf,
        presencas,
        datas_presentes: presentesDatas,
        datas_ausencias: ausenciasDatas,
      };
    });

    return res.json({
      turma_id,
      evento_id: eventoId,
      datas: datasArr,
      usuarios: usuariosArr,
    });
  } catch (err) {
    logError(rid, "relatorioPresencasPorTurma", err);
    return res.status(500).json({
      erro: "Erro ao gerar relatório de presenças.",
      ...(IS_DEV ? { detalhe: err?.message, rid } : {}),
    });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/pdf
 * - "aguardando" até +30min do início
 * - otimizado: indexa presenças (não faz find dentro do loop)
 * ------------------------------------------------------------------ */
async function exportarPresencasPDF(req, res) {
  const rid = mkRid("PRSPDF");
  const turma_id = Number(req.params.turma_id);

  try {
    const turmaRes = await query(
      `SELECT nome, to_char(horario_inicio::time,'HH24:MI') AS hi
         FROM turmas
        WHERE id = $1`,
      [turma_id]
    );
    if ((turmaRes?.rowCount ?? 0) === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    const turma = turmaRes.rows[0];
    const horarioInicio = (turma.hi || "08:00").slice(0, 5);

    const datasTurma = await obterDatasDaTurma(turma_id);

    const insc = await query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf
        FROM usuarios u
        JOIN inscricoes i ON i.usuario_id = u.id
       WHERE i.turma_id = $1
       ORDER BY u.nome
      `,
      [turma_id]
    );

    const pres = await query(
      `SELECT usuario_id, to_char(data_presenca::date,'YYYY-MM-DD') AS d, presente
         FROM presencas
        WHERE turma_id = $1`,
      [turma_id]
    );

    const presMap = new Map(); // "uid|date" -> presente(bool)
    for (const p of pres.rows || []) presMap.set(`${String(p.usuario_id)}|${p.d}`, p.presente === true);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Disposition", `attachment; filename="presencas_turma_${turma_id}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.fontSize(16).text(`Relatório de Presenças – ${turma.nome}`, { align: "center" });
    doc.moveDown();

    // cabeçalho
    doc.fontSize(12).text("Nome", 50, doc.y, { continued: true });
    doc.text("CPF", 250, doc.y, { continued: true });

    datasTurma.forEach((data) => {
      const ddmm = format(localDateFromYMD(data), "dd/MM", { locale: ptBR });
      doc.text(ddmm, doc.x + 20, doc.y, { continued: true });
    });
    doc.moveDown();

    const agora = new Date();

    for (const inscrito of insc.rows || []) {
      doc.text(inscrito.nome, 50, doc.y, { width: 180, continued: true });
      doc.text(inscrito.cpf || "", 250, doc.y, { continued: true });

      for (const data of datasTurma) {
        const k = `${String(inscrito.usuario_id)}|${data}`;
        const presente = presMap.get(k);

        let simbolo = "F";
        if (presente === true) simbolo = "P";
        else {
          // aguardando até +30min do início
          const limite = new Date(`${data}T${horarioInicio}:00`);
          limite.setMinutes(limite.getMinutes() + 30);
          if (agora < limite && presente === undefined) simbolo = "...";
        }

        doc.text(simbolo, doc.x + 20, doc.y, { continued: true });
      }

      doc.moveDown();
    }

    doc.end();
  } catch (err) {
    logError(rid, "exportarPresencasPDF", err);
    return res.status(500).json({ erro: "Erro ao gerar relatório em PDF." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-simples
 * Body: { usuario_id, turma_id, data | data_presenca }
 * ------------------------------------------------------------------ */
async function confirmarPresencaSimples(req, res) {
  const rid = mkRid();
  const { usuario_id, turma_id } = req.body || {};
  const dataInput = req.body?.data_presenca || req.body?.data;

  const uid = Number(usuario_id);
  const tid = Number(turma_id);
  const dataISO = normalizarDataEntrada(dataInput);

  if (!uid || !tid || !dataInput) return res.status(400).json({ erro: "Dados obrigatórios não informados." });
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(tid) || tid <= 0) {
    return res.status(400).json({ erro: "usuario_id/turma_id inválidos." });
  }
  if (!dataISO) return res.status(400).json({ erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa." });

  const perfilRaw = req.user?.perfis || req.user?.perfil || "";
  const perfil = Array.isArray(perfilRaw) ? perfilRaw.join(",") : String(perfilRaw);
  const isAdmin = perfil.toLowerCase().includes("administrador");

  // retroatividade (admin): até 60 dias
  const hoje = localDateFromYMD(hojeYMD());
  const d = localDateFromYMD(dataISO);
  const diffDias = Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
  if (isAdmin && diffDias > 60) {
    return res.status(403).json({ erro: "Administradores só podem confirmar presenças retroativas em até 60 dias." });
  }

  try {
    // valida data contra datas reais (se existir)
    const datas = await obterDatasDaTurma(tid);
    if (datas.length && !datas.includes(dataISO)) {
      return res.status(400).json({ erro: "Data fora das datas válidas desta turma." });
    }

    await query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, confirmado_em)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, confirmado_em = NOW()
      `,
      [uid, tid, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(uid, tid);
    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    logError(rid, "confirmarPresencaSimples", err);
    return res.status(500).json({ erro: "Erro interno ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/admin/listar-tudo
 * - retorna datas/horários date-only safe (YYYY-MM-DD + HH:MM)
 * ------------------------------------------------------------------ */
async function listarTodasPresencasParaAdmin(req, res) {
  const rid = mkRid("PRSADM");
  try {
    const result = await query(
      `
      SELECT 
        e.id   AS evento_id,
        e.titulo AS evento_titulo,
        t.id   AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        to_char(t.horario_inicio::time,'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim::time,'HH24:MI')    AS horario_fim
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ORDER BY e.titulo, t.data_inicio
      `
    );

    const eventosMap = {};
    for (const row of result.rows || []) {
      const eventoId = row.evento_id;
      if (!eventosMap[eventoId]) {
        eventosMap[eventoId] = { evento_id: eventoId, titulo: row.evento_titulo, turmas: [] };
      }
      eventosMap[eventoId].turmas.push({
        id: row.turma_id,
        nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        horario_inicio: row.horario_inicio,
        horario_fim: row.horario_fim,
      });
    }

    return res.json({ eventos: Object.values(eventosMap) });
  } catch (err) {
    logError(rid, "listarTodasPresencasParaAdmin", err);
    return res.status(500).json({ erro: "Erro ao listar presenças." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/minhas
 * - mantém seu SQL (está ótimo) e só padroniza logs/erros
 * ------------------------------------------------------------------ */
async function obterMinhasPresencas(req, res) {
  const rid = mkRid("PRSME");
  const usuario_id = Number(req.user?.id);
  if (!Number.isFinite(usuario_id) || usuario_id <= 0) return res.status(401).json({ erro: "Não autenticado." });

  try {
    const sql = `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.nome AS turma_nome,
          t.evento_id,
          e.titulo AS evento_titulo,
          t.data_inicio::date AS di_raw,
          t.data_fim::date     AS df_raw,
          t.horario_inicio,
          t.horario_fim
        FROM inscricoes i
        JOIN turmas t  ON t.id = i.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT
          mt.turma_id,
          (dt.data::date) AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT
          mt.turma_id,
          gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      horarios_calc AS (
        SELECT
          mt.turma_id,
          (
            SELECT to_char(x.hi, 'HH24:MI') FROM (
              SELECT dt.horario_inicio AS hi, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = mt.turma_id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, hi
              LIMIT 1
            ) x
          ) AS hi_freq,
          (
            SELECT to_char(x.hf, 'HH24:MI') FROM (
              SELECT dt.horario_fim AS hf, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = mt.turma_id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, hf
              LIMIT 1
            ) x
          ) AS hf_freq
        FROM minhas_turmas mt
      ),
      pres AS (
        SELECT p.turma_id, p.data_presenca::date AS d, BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
      agregada AS (
        SELECT
          mt.turma_id,
          mt.turma_nome,
          mt.evento_id,
          mt.evento_titulo,
          MIN(db.d) AS di,
          MAX(db.d) AS df,
          COALESCE(hc.hi_freq, to_char(mt.horario_inicio, 'HH24:MI'), '08:00') AS hi,
          COALESCE(hc.hf_freq, to_char(mt.horario_fim, 'HH24:MI'), '17:00') AS hf,
          COUNT(*) AS total_encontros,
          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE) AS realizados,
          COUNT(*) FILTER (WHERE p.presente IS TRUE) AS presentes_total,
          COUNT(*) FILTER (WHERE p.presente IS TRUE AND db.d <= CURRENT_DATE) AS presentes_passados,
          COUNT(*) FILTER (
            WHERE (db.d <= CURRENT_DATE) AND COALESCE(p.presente, FALSE) IS NOT TRUE
          ) AS ausencias,
          ARRAY_AGG( to_char(db.d, 'YYYY-MM-DD') ORDER BY db.d )
            FILTER (WHERE p.presente IS TRUE) AS datas_presentes,
          ARRAY_AGG( to_char(db.d, 'YYYY-MM-DD') ORDER BY db.d )
            FILTER (WHERE (db.d <= CURRENT_DATE) AND COALESCE(p.presente, FALSE) IS NOT TRUE)
            AS datas_ausentes
        FROM minhas_turmas mt
        JOIN datas_base   db ON db.turma_id = mt.turma_id
        LEFT JOIN pres     p ON p.turma_id  = mt.turma_id AND p.d = db.d
        LEFT JOIN horarios_calc hc ON hc.turma_id = mt.turma_id
        GROUP BY
          mt.turma_id, mt.turma_nome, mt.evento_id, mt.evento_titulo,
          hc.hi_freq, hc.hf_freq, mt.horario_inicio, mt.horario_fim
      )
      SELECT
        turma_id,
        turma_nome,
        evento_id,
        evento_titulo,
        to_char(di, 'YYYY-MM-DD') AS data_inicio,
        to_char(df, 'YYYY-MM-DD') AS data_fim,
        hi AS horario_inicio,
        hf AS horario_fim,
        total_encontros,
        realizados,
        presentes_passados,
        ausencias,
        ROUND(
          CASE WHEN realizados > 0
               THEN (presentes_passados::numeric / realizados) * 100
               ELSE 0 END, 1
        ) AS frequencia_atual,
        ROUND(
          CASE WHEN total_encontros > 0
               THEN (presentes_passados::numeric / total_encontros) * 100
               ELSE 0 END, 1
        ) AS frequencia_total,
        CASE
          WHEN CURRENT_DATE < di THEN 'agendado'
          WHEN CURRENT_DATE > df THEN 'encerrado'
          ELSE 'andamento'
        END AS status,
        (CURRENT_DATE > df)
          AND (presentes_passados::numeric / NULLIF(total_encontros,0) >= 0.75) AS elegivel_avaliacao,
        COALESCE(datas_presentes, '{}') AS datas_presentes,
        COALESCE(datas_ausentes,  '{}') AS datas_ausentes
      FROM agregada
      ORDER BY df DESC, turma_id DESC
    `;

    const { rows } = await query(sql, [usuario_id]);

    return res.json({
      usuario_id,
      total_turmas: rows.length,
      turmas: rows.map((r) => ({
        turma_id: r.turma_id,
        turma_nome: r.turma_nome,
        evento_id: r.evento_id,
        evento_titulo: r.evento_titulo,
        periodo: {
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          horario_inicio: r.horario_inicio,
          horario_fim: r.horario_fim,
        },
        total_encontros: Number(r.total_encontros) || 0,
        encontros_realizados: Number(r.realizados) || 0,
        presentes: Number(r.presentes_passados) || 0,
        ausencias: Number(r.ausencias) || 0,
        frequencia: Number(r.frequencia_atual) || 0,
        frequencia_total: Number(r.frequencia_total) || 0,
        status: r.status,
        elegivel_avaliacao: !!r.elegivel_avaliacao,
        datas: { presentes: r.datas_presentes || [], ausentes: r.datas_ausentes || [] },
        base: { atual: Number(r.realizados) || 0, total: Number(r.total_encontros) || 0 },
      })),
    });
  } catch (err) {
    logError(rid, "obterMinhasPresencas", err);
    return res.status(500).json({ erro: "Erro ao carregar suas presenças." });
  }
}

/* =====================================================================
   Exportações (mantém nomes/assinaturas do seu route)
===================================================================== */
module.exports = {
  confirmarPresencaInstrutor,
  confirmarPresencaSimples,
  registrarPresenca,
  confirmarPresencaViaQR,
  confirmarViaToken,
  registrarManual,
  validarPresenca,
  confirmarHojeManual,
  listaPresencasTurma,
  relatorioPresencasPorTurma,
  exportarPresencasPDF,
  listarTodasPresencasParaAdmin,
  obterMinhasPresencas,
  confirmarPresencaViaToken, // função util externa (mantida)
};
