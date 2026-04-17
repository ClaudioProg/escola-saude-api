/* eslint-disable no-console */
"use strict";

// ✅ src/controllers/eventoPublicoController.js
// - Controller público/consulta de eventos
// - Separado do controller administrativo
// - Mantém compat com schema atual
// - Lista leve + detalhe sob demanda
// - Date-only safe
// - Logs e snapshots de memória

const dbMod = require("../db");
const { normalizeRegistro } = require("../utils/registro");

const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function" || !pool?.connect) {
  console.error("[eventoPublicoController] db inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em src/controllers/eventoPublicoController.js (pool/query ausentes)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ====================== Logger util (RID) ====================== */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _log(rid, level, msg, extra) {
  const hasExtra = extra && Object.keys(extra).length;
  const prefix = `[EVT:PUBLIC][RID=${rid}]`;

  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, hasExtra ? extra : "");
  }
  if (level === "info") {
    return console.log(`${prefix} • ${msg}`, hasExtra ? extra : "");
  }
  return console.log(`${prefix} ▶ ${msg}`, hasExtra ? extra : "");
}

const logStart = (rid, msg, extra) => _log(rid, "start", msg, extra);
const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

function memSnapshot(rid, label, extra = {}) {
  const m = process.memoryUsage();
  logInfo(rid, `[MEM] ${label}`, {
    rss_mb: Math.round(m.rss / 1024 / 1024),
    heap_total_mb: Math.round(m.heapTotal / 1024 / 1024),
    heap_used_mb: Math.round(m.heapUsed / 1024 / 1024),
    external_mb: Math.round(m.external / 1024 / 1024),
    ...extra,
  });
}

/* ====================== Helpers gerais ====================== */
function uniqueInts(arr = []) {
  return [...new Set(arr.map(Number).filter(Number.isFinite))];
}

function groupRows(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const k = row[key];
    const arr = map.get(k) || [];
    arr.push(row);
    map.set(k, arr);
  }
  return map;
}

function hhmm(s, fb = "") {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || "";
}

function toYmd(v) {
  if (v == null) return null;

  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return null;
  }

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function toHm(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 5);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normalizarTituloPtBr(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const s = raw.replace(/\s+/g, " ");

  const minusculas = new Set([
    "de", "da", "do", "das", "dos",
    "e", "em", "para", "por",
    "a", "o", "as", "os",
    "à", "às", "ao", "aos",
  ]);

  const siglas = new Set(["SMS", "SUS", "CNPJ", "CPF", "RH", "TI", "UPA", "UBS", "SAMU"]);
  const roman = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

  const words = s.split(" ").filter(Boolean);

  return words
    .map((w, idx) => {
      const clean = w.replace(/[()]/g, "");
      const upper = clean.toUpperCase();

      if (siglas.has(upper)) return upper;
      if (roman.test(clean)) return upper;

      const lower = clean.toLocaleLowerCase("pt-BR");
      if (idx !== 0 && minusculas.has(lower)) return lower;

      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function getPerfisFromReq(req) {
  const raw = req.user?.perfil ?? req.user?.perfis ?? [];
  if (Array.isArray(raw)) return raw.map((p) => String(p).toLowerCase());

  return String(raw)
    .split(",")
    .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(req) {
  return getPerfisFromReq(req).includes("administrador");
}

const getUsuarioId = (req) => req.user?.id ?? null;

function isMissingRelationOrColumn(err) {
  const c = err && (err.code || err?.original?.code);
  return c === "42P01" || c === "42703";
}

async function tryQueryWithFallback(client, primary, fallback) {
  try {
    return await client.query(primary.text, primary.values || []);
  } catch (e) {
    if (e.code === "42703") return await client.query(fallback.text, fallback.values || []);
    throw e;
  }
}

function extrairDatasDaTurma(t) {
  if (Array.isArray(t?.datas) && t.datas.length) {
    return t.datas.map((d) => ({
      data: toYmd(d?.data),
      horario_inicio: hhmm(d?.horario_inicio || ""),
      horario_fim: hhmm(d?.horario_fim || ""),
    }));
  }

  if (Array.isArray(t?.encontros) && t.encontros.length) {
    return t.encontros.map((e) =>
      typeof e === "string"
        ? { data: toYmd(e), horario_inicio: null, horario_fim: null }
        : {
            data: toYmd(e?.data),
            horario_inicio: hhmm(e?.inicio || ""),
            horario_fim: hhmm(e?.fim || ""),
          }
    );
  }

  return [];
}

/* ====================== Restrição / Elegibilidade ====================== */
const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

async function getUsuarioContextoRestricao(client, usuarioId) {
  if (!usuarioId) {
    return {
      registro: "",
      registro_norm: "",
      cargo_id: null,
      unidade_id: null,
    };
  }

  const { rows } = await client.query(
    `
    SELECT registro, cargo_id, unidade_id
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  const u = rows?.[0] || {};
  return {
    registro: u.registro || "",
    registro_norm: normalizeRegistro(u.registro || ""),
    cargo_id: Number(u.cargo_id) || null,
    unidade_id: Number(u.unidade_id) || null,
  };
}

function montarPublicoAlvoLabel(evento = {}) {
  const publico = String(evento?.publico_alvo || "").trim();
  if (publico) return publico;

  const cargos = Array.isArray(evento?.cargos_permitidos) ? evento.cargos_permitidos : [];
  const unidades = Array.isArray(evento?.unidades_permitidas) ? evento.unidades_permitidas : [];
  const countRegs = Number(evento?.count_registros_permitidos || 0);

  if (cargos.length) {
    return cargos
      .map((c) => normalizarTituloPtBr(c?.nome || c?.cargo || ""))
      .filter(Boolean)
      .join(", ");
  }

  if (unidades.length) {
    return unidades.map((u) => u?.nome).filter(Boolean).join(", ");
  }

  if (countRegs > 0) return "lista específica de servidores";
  if (evento?.restrito_modo === MODO_TODOS) return "servidores com registro válido";

  return "público específico";
}

function avaliarElegibilidadeInscricaoComContexto({ usuario, evento }) {
  if (!evento) {
    return {
      pode_se_inscrever: false,
      motivo_bloqueio: "Evento não encontrado.",
      publico_alvo_label: "",
    };
  }

  if (!evento.publicado) {
    return {
      pode_se_inscrever: false,
      motivo_bloqueio: "Evento ainda não publicado.",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (!evento.restrito) {
    return {
      pode_se_inscrever: true,
      motivo_bloqueio: "",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (!usuario?.id) {
    return {
      pode_se_inscrever: false,
      motivo_bloqueio: "Faça login para verificar elegibilidade de inscrição.",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  const cargosIdsPermitidos = Array.isArray(evento.cargos_permitidos_ids)
    ? evento.cargos_permitidos_ids.map(Number).filter(Number.isFinite)
    : [];

  const unidadesIdsPermitidas = Array.isArray(evento.unidades_permitidas_ids)
    ? evento.unidades_permitidas_ids.map(Number).filter(Number.isFinite)
    : [];

  if (evento.restrito_modo === MODO_TODOS) {
    if (usuario.registro_norm) {
      return {
        pode_se_inscrever: true,
        motivo_bloqueio: "",
        publico_alvo_label: montarPublicoAlvoLabel(evento),
      };
    }

    return {
      pode_se_inscrever: false,
      motivo_bloqueio: "Inscrição disponível apenas para servidores com registro válido.",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (evento.restrito_modo === MODO_LISTA) {
    const regs = Array.isArray(evento.registros_permitidos)
      ? evento.registros_permitidos
      : [];

    if (usuario.registro_norm && regs.includes(usuario.registro_norm)) {
      return {
        pode_se_inscrever: true,
        motivo_bloqueio: "",
        publico_alvo_label: montarPublicoAlvoLabel(evento),
      };
    }

    return {
      pode_se_inscrever: false,
      motivo_bloqueio: "Inscrição disponível apenas para servidores autorizados nesta lista.",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (usuario.cargo_id && cargosIdsPermitidos.includes(Number(usuario.cargo_id))) {
    return {
      pode_se_inscrever: true,
      motivo_bloqueio: "",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (
    usuario.unidade_id != null &&
    unidadesIdsPermitidas.includes(Number(usuario.unidade_id))
  ) {
    return {
      pode_se_inscrever: true,
      motivo_bloqueio: "",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  return {
    pode_se_inscrever: false,
    motivo_bloqueio: `Inscrição disponível apenas para ${montarPublicoAlvoLabel(evento)}.`,
    publico_alvo_label: montarPublicoAlvoLabel(evento),
  };
}

async function avaliarElegibilidadeInscricao({ client, usuarioId, evento }) {
  const usuario = await getUsuarioContextoRestricao(client, usuarioId);
  return avaliarElegibilidadeInscricaoComContexto({
    usuario: { id: usuarioId, ...usuario },
    evento,
  });
}

async function enriquecerEventosLista(client, usuarioId, eventosBase, rid) {
  const eventoIds = uniqueInts((eventosBase || []).map((e) => e.id));
  if (!eventoIds.length) return [];

  memSnapshot(rid, "enriquecerEventosLista:inicio", {
    eventos: eventoIds.length,
    usuarioId,
  });

  const usuarioCtx = await getUsuarioContextoRestricao(client, usuarioId);

  const allCargoIds = uniqueInts(
    (eventosBase || []).flatMap((e) =>
      Array.isArray(e?.cargos_permitidos_ids) ? e.cargos_permitidos_ids : []
    )
  );

  const allUnidadeIds = uniqueInts(
    (eventosBase || []).flatMap((e) =>
      Array.isArray(e?.unidades_permitidas_ids) ? e.unidades_permitidas_ids : []
    )
  );

  const [regsQ, instrQ, cargosQ, unidadesQ] = await Promise.all([
    client.query(
      `
      SELECT evento_id, registro_norm
      FROM evento_registros
      WHERE evento_id = ANY($1::int[])
      ORDER BY evento_id, registro_norm
      `,
      [eventoIds]
    ),
    client.query(
      `
      SELECT
        t.evento_id,
        u.id,
        u.nome
      FROM turmas t
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      JOIN usuarios u ON u.id = ti.instrutor_id
      WHERE t.evento_id = ANY($1::int[])
      GROUP BY t.evento_id, u.id, u.nome
      ORDER BY t.evento_id, u.nome
      `,
      [eventoIds]
    ),
    allCargoIds.length
      ? client.query(
          `
          SELECT id, nome
          FROM cargos
          WHERE id = ANY($1::int[])
          ORDER BY nome
          `,
          [allCargoIds]
        )
      : Promise.resolve({ rows: [] }),
    allUnidadeIds.length
      ? client.query(
          `
          SELECT id, nome
          FROM unidades
          WHERE id = ANY($1::int[])
          ORDER BY nome
          `,
          [allUnidadeIds]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const regsMap = new Map();
  for (const row of regsQ.rows || []) {
    const arr = regsMap.get(row.evento_id) || [];
    arr.push(row.registro_norm);
    regsMap.set(row.evento_id, arr);
  }

  const instrMap = groupRows(instrQ.rows || [], "evento_id");

  const cargoById = new Map(
    (cargosQ.rows || []).map((c) => [
      Number(c.id),
      { id: Number(c.id), nome: normalizarTituloPtBr(c.nome) },
    ])
  );

  const unidadeById = new Map(
    (unidadesQ.rows || []).map((u) => [
      Number(u.id),
      { id: Number(u.id), nome: u.nome },
    ])
  );

  const eventos = (eventosBase || []).map((evento) => {
    const registros = regsMap.get(evento.id) || [];

    const instrutores = (instrMap.get(evento.id) || []).map((i) => ({
      id: Number(i.id),
      nome: i.nome,
    }));

    const cargos = (Array.isArray(evento.cargos_permitidos_ids)
      ? evento.cargos_permitidos_ids
      : []
    )
      .map((id) => cargoById.get(Number(id)))
      .filter(Boolean);

    const unidades = (Array.isArray(evento.unidades_permitidas_ids)
      ? evento.unidades_permitidas_ids
      : []
    )
      .map((id) => unidadeById.get(Number(id)))
      .filter(Boolean);

    const payload = {
      ...evento,
      registros_permitidos: registros,
      count_registros_permitidos: registros.length,
      cargos_permitidos: cargos,
      unidades_permitidas: unidades,
      instrutor: instrutores,
    };

    const eleg = avaliarElegibilidadeInscricaoComContexto({
      usuario: {
        id: usuarioId,
        ...usuarioCtx,
      },
      evento: payload,
    });

    return {
      ...payload,
      pode_se_inscrever: eleg.pode_se_inscrever,
      motivo_bloqueio: eleg.motivo_bloqueio,
      publico_alvo_label: eleg.publico_alvo_label,
    };
  });

  memSnapshot(rid, "enriquecerEventosLista:fim", {
    eventos: eventos.length,
    usuarioId,
  });

  return eventos;
}

async function podeVerEvento({ client, usuarioId, eventoId, req }) {
  const admin = isAdmin(req);

  const evQ = await client.query(
    `
    SELECT id, publicado
    FROM eventos
    WHERE id = $1
    `,
    [eventoId]
  );

  const evento = evQ.rows[0];
  if (!evento) return { ok: false, motivo: "EVENTO_NAO_ENCONTRADO" };

  if (admin) return { ok: true };
  if (!evento.publicado) return { ok: false, motivo: "NAO_PUBLICADO" };
  if (!usuarioId) return { ok: false, motivo: "NAO_AUTENTICADO" };

  return { ok: true };
}

/* =====================================================================
   📄 Listar todos os eventos (resumo)
===================================================================== */
async function listarEventos(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);
  logStart(rid, "listarEventos", { usuarioId, admin });

  const client = await pool.connect();
  try {
    memSnapshot(rid, "listarEventos:inicio", { usuarioId, admin });

    const baseWithBlob = `
      WITH minhas_turmas AS (
        SELECT DISTINCT t.evento_id
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $2
      ),
      agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      ),
      agg_inscrito AS (
        SELECT
          t.evento_id,
          TRUE AS ja_inscrito
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
        GROUP BY t.evento_id
      ),
      agg_instrutor AS (
        SELECT
          t.evento_id,
          TRUE AS ja_instrutor
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $2
        GROUP BY t.evento_id
      )
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.local,
        e.tipo,
        e.unidade_id,
        e.publico_alvo,
        e.publicado,
        e.restrito,
        e.restrito_modo,
        e.folder_url,
        e.programacao_pdf_url,
        e.cargos_permitidos_ids,
        e.unidades_permitidas_ids,
        e.criado_em,

        ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
        CASE
          WHEN e.folder_blob IS NOT NULL THEN 'blob'
          WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
          ELSE 'none'
        END AS folder_kind,

        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,

        COALESCE(ai.ja_inscrito, FALSE) AS ja_inscrito,
        COALESCE(atr.ja_instrutor, FALSE) AS ja_instrutor

      FROM eventos e
      LEFT JOIN agg_turmas at ON at.evento_id = e.id
      LEFT JOIN agg_datas ad ON ad.evento_id = e.id
      LEFT JOIN agg_inscrito ai ON ai.evento_id = e.id
      LEFT JOIN agg_instrutor atr ON atr.evento_id = e.id
      WHERE ${admin ? "TRUE" : "(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM minhas_turmas))"}
      ORDER BY COALESCE(
        ad.fim_real,
        at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
      ) DESC NULLS LAST,
      e.id DESC
    `;

    const baseWithoutBlob = `
      WITH minhas_turmas AS (
        SELECT DISTINCT t.evento_id
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $2
      ),
      agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      ),
      agg_inscrito AS (
        SELECT
          t.evento_id,
          TRUE AS ja_inscrito
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
        GROUP BY t.evento_id
      ),
      agg_instrutor AS (
        SELECT
          t.evento_id,
          TRUE AS ja_instrutor
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $2
        GROUP BY t.evento_id
      )
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.local,
        e.tipo,
        e.unidade_id,
        e.publico_alvo,
        e.publicado,
        e.restrito,
        e.restrito_modo,
        e.folder_url,
        e.programacao_pdf_url,
        e.cargos_permitidos_ids,
        e.unidades_permitidas_ids,
        e.criado_em,

        ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
        CASE
          WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
          ELSE 'none'
        END AS folder_kind,

        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,

        COALESCE(ai.ja_inscrito, FALSE) AS ja_inscrito,
        COALESCE(atr.ja_instrutor, FALSE) AS ja_instrutor

      FROM eventos e
      LEFT JOIN agg_turmas at ON at.evento_id = e.id
      LEFT JOIN agg_datas ad ON ad.evento_id = e.id
      LEFT JOIN agg_inscrito ai ON ai.evento_id = e.id
      LEFT JOIN agg_instrutor atr ON atr.evento_id = e.id
      WHERE ${admin ? "TRUE" : "(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM minhas_turmas))"}
      ORDER BY COALESCE(
        ad.fim_real,
        at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
      ) DESC NULLS LAST,
      e.id DESC
    `;

    let rows;
    try {
      ({ rows } = await client.query(baseWithBlob, [usuarioId, usuarioId]));
    } catch (err) {
      if (err?.code !== "42703") throw err;
      ({ rows } = await client.query(baseWithoutBlob, [usuarioId, usuarioId]));
    }

    const eventosComElegibilidade = await enriquecerEventosLista(
      client,
      usuarioId,
      rows || [],
      rid
    );

    memSnapshot(rid, "listarEventos:fim", {
      usuarioId,
      admin,
      count: eventosComElegibilidade.length,
    });

    logInfo(rid, "listarEventos OK", { count: eventosComElegibilidade.length });
    return res.json(eventosComElegibilidade);
  } catch (err) {
    logError(rid, "listarEventos erro", err);
    return res.status(500).json({
      erro: "Erro ao listar eventos",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🆕 Listar “para mim”
===================================================================== */
async function listarEventosParaMim(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) {
    return res.status(401).json({ ok: false, erro: "NAO_AUTENTICADO" });
  }

  const client = await pool.connect();
  try {
    logStart(rid, "listarEventosParaMim", { usuarioId });
    memSnapshot(rid, "listarEventosParaMim:inicio", { usuarioId });

    const sqlWithBlob = `
      WITH base AS (
        SELECT
          e.id,
          e.titulo,
          e.descricao,
          e.local,
          e.tipo,
          e.unidade_id,
          e.publico_alvo,
          e.publicado,
          e.restrito,
          e.restrito_modo,
          e.folder_url,
          e.programacao_pdf_url,
          e.cargos_permitidos_ids,
          e.unidades_permitidas_ids,
          e.criado_em,

          ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
          CASE
            WHEN e.folder_blob IS NOT NULL THEN 'blob'
            WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
            ELSE 'none'
          END AS folder_kind

        FROM eventos e
        WHERE e.publicado = TRUE
      ),
      agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      ),
      agg_inscrito AS (
        SELECT
          t.evento_id,
          TRUE AS ja_inscrito
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
        GROUP BY t.evento_id
      ),
      agg_instrutor AS (
        SELECT
          t.evento_id,
          TRUE AS ja_instrutor
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $1
        GROUP BY t.evento_id
      )
      SELECT
        b.*,
        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,

        COALESCE(ai.ja_inscrito, FALSE) AS ja_inscrito,
        COALESCE(atr.ja_instrutor, FALSE) AS ja_instrutor

      FROM base b
      LEFT JOIN agg_turmas at ON at.evento_id = b.id
      LEFT JOIN agg_datas ad ON ad.evento_id = b.id
      LEFT JOIN agg_inscrito ai ON ai.evento_id = b.id
      LEFT JOIN agg_instrutor atr ON atr.evento_id = b.id
      ORDER BY b.titulo ASC, b.id DESC
    `;

    const sqlWithoutBlob = `
      WITH base AS (
        SELECT
          e.id,
          e.titulo,
          e.descricao,
          e.local,
          e.tipo,
          e.unidade_id,
          e.publico_alvo,
          e.publicado,
          e.restrito,
          e.restrito_modo,
          e.folder_url,
          e.programacao_pdf_url,
          e.cargos_permitidos_ids,
          e.unidades_permitidas_ids,
          e.criado_em,

          ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
          CASE
            WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
            ELSE 'none'
          END AS folder_kind

        FROM eventos e
        WHERE e.publicado = TRUE
      ),
      agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      ),
      agg_inscrito AS (
        SELECT
          t.evento_id,
          TRUE AS ja_inscrito
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
        GROUP BY t.evento_id
      ),
      agg_instrutor AS (
        SELECT
          t.evento_id,
          TRUE AS ja_instrutor
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE ti.instrutor_id = $1
        GROUP BY t.evento_id
      )
      SELECT
        b.*,
        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,

        COALESCE(ai.ja_inscrito, FALSE) AS ja_inscrito,
        COALESCE(atr.ja_instrutor, FALSE) AS ja_instrutor

      FROM base b
      LEFT JOIN agg_turmas at ON at.evento_id = b.id
      LEFT JOIN agg_datas ad ON ad.evento_id = b.id
      LEFT JOIN agg_inscrito ai ON ai.evento_id = b.id
      LEFT JOIN agg_instrutor atr ON atr.evento_id = b.id
      ORDER BY b.titulo ASC, b.id DESC
    `;

    let rows;
    try {
      ({ rows } = await client.query(sqlWithBlob, [usuarioId]));
    } catch (err) {
      if (err?.code !== "42703") throw err;
      ({ rows } = await client.query(sqlWithoutBlob, [usuarioId]));
    }

    const eventosComElegibilidade = await enriquecerEventosLista(
      client,
      usuarioId,
      rows || [],
      rid
    );

    memSnapshot(rid, "listarEventosParaMim:fim", {
      usuarioId,
      count: eventosComElegibilidade.length,
    });

    logInfo(rid, "listarEventosParaMim OK", {
      count: eventosComElegibilidade.length,
    });

    return res.json({
      ok: true,
      eventos: eventosComElegibilidade,
    });
  } catch (err) {
    logError(rid, "listarEventosParaMim erro", err);
    return res.status(500).json({
      ok: false,
      erro: "ERRO_INTERNO",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🖼️ Folder do evento
===================================================================== */
async function obterFolderDoEvento(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  const client = await pool.connect();
  try {
    let r;

    try {
      r = await client.query(
        `
        SELECT folder_blob, folder_mime, folder_url
        FROM eventos
        WHERE id = $1
        `,
        [id]
      );
    } catch (e) {
      if (e?.code === "42703") {
        r = await client.query(
          `
          SELECT folder_url
          FROM eventos
          WHERE id = $1
          `,
          [id]
        );
      } else {
        throw e;
      }
    }

    if (!r.rowCount) return res.status(404).end();
    const row = r.rows[0];

    if (row.folder_blob) {
      res.setHeader("Content-Type", row.folder_mime || "image/jpeg");
      res.setHeader("Cache-Control", IS_DEV ? "no-store" : "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(row.folder_blob);
    }

    if (row.folder_url) {
      res.setHeader(
        "Cache-Control",
        IS_DEV ? "no-store" : "public, max-age=3600, stale-while-revalidate=86400"
      );
      return res.redirect(302, row.folder_url);
    }

    res.setHeader(
      "Cache-Control",
      IS_DEV ? "no-store" : "public, max-age=3600, stale-while-revalidate=86400"
    );
    return res.status(204).end();
  } catch (e) {
    logError(rid, "obterFolderDoEvento erro", e);
    return res.status(500).end();
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar por ID
===================================================================== */
async function buscarEventoPorId(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido" });
  }

  const client = await pool.connect();
  try {
    logStart(rid, "buscarEventoPorId", { id, usuarioId, admin });

    const eventoResult = await client.query(
      `
      SELECT *
      FROM eventos
      WHERE id = $1
      `,
      [id]
    );

    if (eventoResult.rowCount === 0) {
      return res.status(404).json({ erro: "Evento não encontrado" });
    }

    const evento = eventoResult.rows[0];

    if (!admin && !evento.publicado) {
      return res.status(404).json({ erro: "NAO_PUBLICADO" });
    }

    if (!admin) {
      const can = await podeVerEvento({ client, usuarioId, eventoId: id, req });
      if (!can.ok) {
        return res.status(can.motivo === "NAO_PUBLICADO" ? 404 : 403).json({
          erro: can.motivo === "NAO_PUBLICADO" ? "Evento não encontrado" : "Acesso negado.",
        });
      }
    }

    const [regsQ, cargosRows, unidadesRows, instrEventoQ] = await Promise.all([
      client.query(
        `
        SELECT registro_norm
        FROM evento_registros
        WHERE evento_id = $1
        ORDER BY registro_norm
        `,
        [id]
      ),
      client.query(
        `
        SELECT id, nome, codigo
        FROM cargos
        WHERE id = ANY($1)
        ORDER BY nome
        `,
        [Array.isArray(evento.cargos_permitidos_ids) ? evento.cargos_permitidos_ids : []]
      ),
      client.query(
        `
        SELECT id, nome
        FROM unidades
        WHERE id = ANY($1)
        ORDER BY nome
        `,
        [Array.isArray(evento.unidades_permitidas_ids) ? evento.unidades_permitidas_ids : []]
      ),
      client.query(
        `
        SELECT DISTINCT u.id, u.nome
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        JOIN usuarios u ON u.id = ti.instrutor_id
        WHERE t.evento_id = $1
        ORDER BY u.nome
        `,
        [id]
      ),
    ]);

    const turmasResult = await tryQueryWithFallback(
      client,
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria, instrutor_assinante_id
          FROM turmas
          WHERE evento_id = $1
          ORDER BY data_inicio NULLS LAST, id
        `,
        values: [id],
      },
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria
          FROM turmas
          WHERE evento_id = $1
          ORDER BY data_inicio NULLS LAST, id
        `,
        values: [id],
      }
    );

    const turmaIds = turmasResult.rows.map((t) => t.id);

    const [datasAll, instrAll, inscritosAll] = turmaIds.length
      ? await Promise.all([
          client.query(
            `
            SELECT turma_id,
                   to_char(data::date,'YYYY-MM-DD') AS data,
                   to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                   to_char(horario_fim,'HH24:MI')   AS horario_fim
            FROM datas_turma
            WHERE turma_id = ANY($1::int[])
            ORDER BY turma_id, data ASC
            `,
            [turmaIds]
          ),
          client.query(
            `
            SELECT ti.turma_id, u.id, u.nome, u.email
            FROM turma_instrutor ti
            JOIN usuarios u ON u.id = ti.instrutor_id
            WHERE ti.turma_id = ANY($1::int[])
            ORDER BY ti.turma_id, u.nome
            `,
            [turmaIds]
          ),
          client.query(
            `
            SELECT turma_id, COUNT(*)::int AS inscritos
            FROM inscricoes
            WHERE turma_id = ANY($1::int[])
            GROUP BY turma_id
            `,
            [turmaIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({
        data: r.data,
        horario_inicio: r.horario_inicio,
        horario_fim: r.horario_fim,
      });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrByTurma = new Map();
    for (const r of instrAll.rows) {
      const arr = instrByTurma.get(r.turma_id) || [];
      arr.push({
        id: r.id,
        nome: r.nome,
        email: r.email,
      });
      instrByTurma.set(r.turma_id, arr);
    }

    const inscritosByTurma = new Map();
    for (const r of inscritosAll.rows) {
      inscritosByTurma.set(r.turma_id, Number(r.inscritos || 0));
    }

    const turmas = turmasResult.rows.map((t) => {
      const datas = datasByTurma.get(t.id) || [];
      const instrutores = instrByTurma.get(t.id) || [];
      const inscritos = inscritosByTurma.get(t.id) || 0;

      const vagasTotal = Number.isFinite(Number(t.vagas_total))
        ? Number(t.vagas_total)
        : 0;

      const assinanteId = Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")
        ? Number(t.instrutor_assinante_id)
        : null;

      const assinante = Number.isFinite(assinanteId)
        ? instrutores.find((i) => i.id === assinanteId) || null
        : null;

      return {
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),

        instrutores,
        instrutor_assinante: assinante,
        instrutor_assinante_id: assinante ? assinante.id : null,

        datas,
        encontros_count: datas.length,

        inscritos,
        vagas_preenchidas: inscritos,
        vagas_disponiveis: Math.max(vagasTotal - inscritos, 0),
      };
    });

    const [jaInstrutorResult, jaInscritoResult] = await Promise.all([
      client.query(
        `
        SELECT EXISTS(
          SELECT 1
          FROM turmas t
          JOIN turma_instrutor ti ON ti.turma_id = t.id
          WHERE t.evento_id = $1
            AND ti.instrutor_id = $2
        ) AS eh
        `,
        [id, usuarioId || 0]
      ),
      client.query(
        `
        SELECT EXISTS(
          SELECT 1
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
          WHERE t.evento_id = $1
            AND i.usuario_id = $2
        ) AS eh
        `,
        [id, usuarioId || 0]
      ),
    ]);

    let qz = { rows: [] };
    try {
      qz = await client.query(
        `
        SELECT id, status, obrigatorio, min_nota, tentativas_max, tempo_minutos
        FROM questionarios_evento
        WHERE evento_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [id]
      );
    } catch (e) {
      if (e?.code === "42P01" || e?.code === "42703") {
        logWarn(rid, "questionarios_evento indisponível neste ambiente (ignorado)", {
          code: e.code,
        });
        qz = { rows: [] };
      } else {
        throw e;
      }
    }

    const payloadBase = {
      ...evento,
      folder_blob_url: `/api/eventos/${id}/folder`,
      registros_permitidos: regsQ.rows.map((r) => r.registro_norm),
      count_registros_permitidos: regsQ.rows.length,
      cargos_permitidos_ids: Array.isArray(evento.cargos_permitidos_ids)
        ? evento.cargos_permitidos_ids
        : [],
      unidades_permitidas_ids: Array.isArray(evento.unidades_permitidas_ids)
        ? evento.unidades_permitidas_ids
        : [],
      cargos_permitidos: (cargosRows.rows || []).map((c) => ({
        ...c,
        nome: normalizarTituloPtBr(c.nome),
      })),
      unidades_permitidas: unidadesRows.rows,
    };

    const eleg = await avaliarElegibilidadeInscricao({
      client,
      usuarioId,
      evento: payloadBase,
    });

    logInfo(rid, "buscarEventoPorId OK", {
      id,
      turmas: turmas.length,
      questionario_id: qz.rows?.[0]?.id ?? null,
      pode_se_inscrever: eleg.pode_se_inscrever,
    });

    return res.json({
      ...payloadBase,
      pode_se_inscrever: eleg.pode_se_inscrever,
      motivo_bloqueio: eleg.motivo_bloqueio,
      publico_alvo_label: eleg.publico_alvo_label,

      pos_curso: qz.rows?.[0]
        ? {
            questionario_id: qz.rows[0].id,
            status: qz.rows[0].status,
            obrigatorio: !!qz.rows[0].obrigatorio,
            min_nota: qz.rows[0].min_nota,
            tentativas_max: qz.rows[0].tentativas_max,
            tempo_minutos: qz.rows[0].tempo_minutos,
          }
        : null,

      instrutor: instrEventoQ.rows,
      turmas,
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    });
  } catch (err) {
    logError(rid, "buscarEventoPorId erro", err);
    return res.status(500).json({
      erro: "Erro ao buscar evento por ID",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas do evento
===================================================================== */
async function listarTurmasDoEvento(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);
  const admin = isAdmin(req);

  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return res.status(400).json({ erro: "evento_id inválido" });
  }

  logStart(rid, "listarTurmasDoEvento", { eventoId, admin });

  try {
    const base = await query(
      `
      SELECT
        t.id, t.evento_id, t.nome,
        t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria, t.instrutor_assinante_id,
        e.titulo, e.descricao, e.local
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      WHERE e.id = $1
        ${admin ? "" : "AND e.publicado = TRUE"}
      ORDER BY t.data_inicio NULLS LAST, t.id
      `,
      [eventoId]
    ).catch(async (e) => {
      if (e.code !== "42703") throw e;

      return query(
        `
        SELECT
          t.id, t.evento_id, t.nome,
          t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          e.titulo, e.descricao, e.local
        FROM eventos e
        JOIN turmas t ON t.evento_id = e.id
        WHERE e.id = $1
          ${admin ? "" : "AND e.publicado = TRUE"}
        ORDER BY t.data_inicio NULLS LAST, t.id
        `,
        [eventoId]
      );
    });

    const turmaIds = base.rows.map((r) => r.id);

    const [datasAll, instrAll, inscritosAll] = turmaIds.length
      ? await Promise.all([
          query(
            `
            SELECT turma_id,
                   to_char(data::date,'YYYY-MM-DD') AS data,
                   to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                   to_char(horario_fim,'HH24:MI')   AS horario_fim
            FROM datas_turma
            WHERE turma_id = ANY($1::int[])
            ORDER BY turma_id, data ASC
            `,
            [turmaIds]
          ),
          query(
            `
            SELECT ti.turma_id, u.id, u.nome, u.email
            FROM turma_instrutor ti
            JOIN usuarios u ON u.id = ti.instrutor_id
            WHERE ti.turma_id = ANY($1::int[])
            ORDER BY ti.turma_id, u.nome
            `,
            [turmaIds]
          ),
          query(
            `
            SELECT turma_id, COUNT(*)::int AS inscritos
            FROM inscricoes
            WHERE turma_id = ANY($1::int[])
            GROUP BY turma_id
            `,
            [turmaIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({
        data: r.data,
        horario_inicio: r.horario_inicio,
        horario_fim: r.horario_fim,
      });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrByTurma = new Map();
    for (const r of instrAll.rows) {
      const arr = instrByTurma.get(r.turma_id) || [];
      arr.push({
        id: r.id,
        nome: r.nome,
        email: r.email,
      });
      instrByTurma.set(r.turma_id, arr);
    }

    const inscritosByTurma = new Map();
    for (const r of inscritosAll.rows) {
      inscritosByTurma.set(r.turma_id, Number(r.inscritos || 0));
    }

    const turmas = base.rows.map((r) => {
      const datas = datasByTurma.get(r.id) || [];
      const instrutores = instrByTurma.get(r.id) || [];
      const inscritos = inscritosByTurma.get(r.id) || 0;

      const vagasTotal = Number.isFinite(Number(r.vagas_total))
        ? Number(r.vagas_total)
        : 0;
      const vagasDisponiveis = Math.max(vagasTotal - inscritos, 0);

      const hasAssCol = Object.prototype.hasOwnProperty.call(r, "instrutor_assinante_id");
      const assId = hasAssCol ? Number(r.instrutor_assinante_id) : null;
      const assinante = Number.isFinite(assId)
        ? instrutores.find((i) => i.id === assId) || null
        : null;

      return {
        id: r.id,
        evento_id: r.evento_id,
        nome: r.nome,
        titulo: r.titulo,
        descricao: r.descricao,
        local: r.local,
        vagas_total: r.vagas_total,
        carga_horaria: r.carga_horaria,
        data_inicio: toYmd(r.data_inicio),
        data_fim: toYmd(r.data_fim),
        horario_inicio: toHm(r.horario_inicio),
        horario_fim: toHm(r.horario_fim),

        instrutores,
        instrutor_assinante_id: hasAssCol ? (r.instrutor_assinante_id || null) : null,
        instrutor_assinante: assinante,

        datas,
        encontros_count: datas.length,

        inscritos,
        vagas_preenchidas: inscritos,
        vagas_disponiveis: vagasDisponiveis,
      };
    });

    logInfo(rid, "listarTurmasDoEvento OK", { turmas: turmas.length });
    return res.json(turmas);
  } catch (err) {
    logError(rid, "listarTurmasDoEvento erro", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}

/* =====================================================================
   🔁 Turmas simples
===================================================================== */
async function listarTurmasSimples(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);

  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return res.status(400).json({ erro: "Parâmetro 'id' inválido." });
  }

  try {
    const primary = `
      SELECT
        t.id,
        t.nome,
        t.vagas_total,
        t.carga_horaria,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        COALESCE((SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id), 0) AS inscritos,
        COALESCE((SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id), 0) AS encontros_count,
        COALESCE((
          SELECT json_agg(json_build_object(
                   'data',          to_char(dt.data,'YYYY-MM-DD'),
                   'horario_inicio',to_char(dt.horario_inicio,'HH24:MI'),
                   'horario_fim',   to_char(dt.horario_fim,'HH24:MI')
                 ) ORDER BY dt.data)
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ), '[]'::json) AS datas,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome)
          FROM turma_instrutor ti
          JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE ti.turma_id = t.id
        ), '[]'::json) AS instrutores,
        t.instrutor_assinante_id
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
    `;

    const fallback = `
      SELECT
        t.id,
        t.nome,
        t.vagas_total,
        t.carga_horaria,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        COALESCE((SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id), 0) AS inscritos,
        COALESCE((SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id), 0) AS encontros_count,
        COALESCE((
          SELECT json_agg(json_build_object(
                   'data',          to_char(dt.data,'YYYY-MM-DD'),
                   'horario_inicio',to_char(dt.horario_inicio,'HH24:MI'),
                   'horario_fim',   to_char(dt.horario_fim,'HH24:MI')
                 ) ORDER BY dt.data)
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ), '[]'::json) AS datas,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome)
          FROM turma_instrutor ti
          JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE ti.turma_id = t.id
        ), '[]'::json) AS instrutores,
        NULL::int AS instrutor_assinante_id
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
    `;

    let rows;
    try {
      ({ rows } = await query(primary, [eventoId]));
    } catch (e) {
      if (e.code !== "42703") throw e;
      ({ rows } = await query(fallback, [eventoId]));
    }

    const out = (rows || []).map((t) => {
      const inscritos = Number(t.inscritos || 0);
      const vagasTotal = Number.isFinite(Number(t.vagas_total))
        ? Number(t.vagas_total)
        : 0;

      return {
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),
        vagas_preenchidas: inscritos,
        vagas_disponiveis: Math.max(vagasTotal - inscritos, 0),
      };
    });

    return res.json(out);
  } catch (err) {
    logError(rid, "listarTurmasSimples erro", err);
    return res.status(500).json({ erro: "Falha ao listar turmas." });
  }
}

/* =====================================================================
   📆 Agenda
===================================================================== */
async function getAgendaEventos(req, res) {
  const rid = mkRid();
  logStart(rid, "getAgendaEventos");

  const sql = `
    SELECT
      e.id,
      e.titulo,
      MIN(t.data_inicio) AS data_inicio,
      MAX(t.data_fim) AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim) AS horario_fim,
      CASE
        WHEN CURRENT_TIMESTAMP::timestamp < MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time)) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM turmas tx
          JOIN datas_turma dt ON dt.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(dt.data::date,'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN datas_turma dt ON dt.turma_id = tx.id
            WHERE tx.evento_id = e.id
          ) z1
        )
        WHEN EXISTS (
          SELECT 1
          FROM turmas tx
          JOIN presencas p ON p.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(p.data_presenca::date,'YYYY-MM-DD') AS d
            FROM turmas tx
            JOIN presencas p ON p.turma_id = tx.id
            WHERE tx.evento_id = e.id
          ) z2
        )
        ELSE '[]'::json
      END AS ocorrencias
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    GROUP BY e.id, e.titulo
    ORDER BY MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) DESC NULLS LAST
  `;

  try {
    const { rows } = await query(sql, []);
    const out = (rows || []).map((r) => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));

    logInfo(rid, "getAgendaEventos OK", { count: out.length });
    return res.json(out);
  } catch (err) {
    logError(rid, "getAgendaEventos erro", err);
    return res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
}

/* =====================================================================
   👩‍🏫 Eventos do instrutor
===================================================================== */
async function listarEventosDoinstrutor(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

  const client = await pool.connect();
  logStart(rid, "listarEventosDoinstrutor", { usuarioId });

  try {
    const eventosResult = await client.query(
      `
      SELECT DISTINCT
        e.*,
        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            (
              SELECT MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time))
              FROM turmas t
              JOIN datas_turma dt ON dt.turma_id = t.id
              WHERE t.evento_id = e.id
            ),
            (
              SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time, '00:00'::time))
              FROM turmas t
              WHERE t.evento_id = e.id
            )
          ) THEN 'programado'

          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            (
              SELECT MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time))
              FROM turmas t
              JOIN datas_turma dt ON dt.turma_id = t.id
              WHERE t.evento_id = e.id
            ),
            (
              SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
              FROM turmas t
              WHERE t.evento_id = e.id
            )
          ) THEN 'andamento'

          ELSE 'encerrado'
        END AS status,
        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      WHERE ti.instrutor_id = $1
        AND e.publicado = TRUE
      ORDER BY e.id DESC
      `,
      [usuarioId]
    );

    const eventos = eventosResult.rows || [];
    if (!eventos.length) {
      logInfo(rid, "listarEventosDoinstrutor vazio");
      return res.json([]);
    }

    const eventoIds = eventos.map((e) => e.id);

    const turmasResult = await tryQueryWithFallback(
      client,
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria, instrutor_assinante_id
          FROM turmas
          WHERE evento_id = ANY($1::int[])
          ORDER BY evento_id, data_inicio NULLS LAST, id
        `,
        values: [eventoIds],
      },
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria
          FROM turmas
          WHERE evento_id = ANY($1::int[])
          ORDER BY evento_id, data_inicio NULLS LAST, id
        `,
        values: [eventoIds],
      }
    );

    const turmas = turmasResult.rows || [];
    const turmaIds = turmas.map((t) => t.id);

    const [datasAll, instrByTurmaAll, instrEventoAll] = turmaIds.length
      ? await Promise.all([
          client.query(
            `
            SELECT turma_id,
                   to_char(data::date,'YYYY-MM-DD') AS data,
                   to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                   to_char(horario_fim,'HH24:MI')   AS horario_fim
            FROM datas_turma
            WHERE turma_id = ANY($1::int[])
            ORDER BY turma_id, data ASC
            `,
            [turmaIds]
          ),
          client.query(
            `
            SELECT ti.turma_id, u.id, u.nome, u.email
            FROM turma_instrutor ti
            JOIN usuarios u ON u.id = ti.instrutor_id
            WHERE ti.turma_id = ANY($1::int[])
            ORDER BY ti.turma_id, u.nome
            `,
            [turmaIds]
          ),
          client.query(
            `
            SELECT t.evento_id, u.id, u.nome
            FROM turmas t
            JOIN turma_instrutor ti ON ti.turma_id = t.id
            JOIN usuarios u ON u.id = ti.instrutor_id
            WHERE t.evento_id = ANY($1::int[])
            GROUP BY t.evento_id, u.id, u.nome
            ORDER BY t.evento_id, u.nome
            `,
            [eventoIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({
        data: r.data,
        horario_inicio: r.horario_inicio,
        horario_fim: r.horario_fim,
      });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrTurmaMap = new Map();
    for (const r of instrByTurmaAll.rows) {
      const arr = instrTurmaMap.get(r.turma_id) || [];
      arr.push({
        id: r.id,
        nome: r.nome,
        email: r.email,
      });
      instrTurmaMap.set(r.turma_id, arr);
    }

    const instrEventoMap = new Map();
    for (const r of instrEventoAll.rows) {
      const arr = instrEventoMap.get(r.evento_id) || [];
      arr.push({
        id: r.id,
        nome: r.nome,
      });
      instrEventoMap.set(r.evento_id, arr);
    }

    const turmasByEvento = new Map();
    for (const t of turmas) {
      const arr = turmasByEvento.get(t.evento_id) || [];
      const instrutores = instrTurmaMap.get(t.id) || [];

      const assinanteId = Object.prototype.hasOwnProperty.call(
        t,
        "instrutor_assinante_id"
      )
        ? Number(t.instrutor_assinante_id)
        : null;

      const assinante = Number.isFinite(assinanteId)
        ? instrutores.find((i) => i.id === assinanteId) || null
        : null;

      arr.push({
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),
        datas: datasByTurma.get(t.id) || [],
        encontros_count: (datasByTurma.get(t.id) || []).length,
        instrutores,
        instrutor_assinante_id: assinante ? assinante.id : null,
        instrutor_assinante: assinante,
      });

      turmasByEvento.set(t.evento_id, arr);
    }

    const out = eventos.map((e) => ({
      ...e,
      instrutor: instrEventoMap.get(e.id) || [],
      turmas: turmasByEvento.get(e.id) || [],
    }));

    logInfo(rid, "listarEventosDoinstrutor OK", { eventos: out.length });
    return res.json(out);
  } catch (err) {
    logError(rid, "listarEventosDoinstrutor erro", err);
    return res.status(500).json({
      erro: "Erro ao buscar eventos do instrutor",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📅 Datas da turma
===================================================================== */
async function listarDatasDaTurma(req, res) {
  const rid = mkRid();
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "datas").toLowerCase();

  if (!Number.isFinite(turmaId) || turmaId <= 0) {
    return res.status(400).json({ erro: "turma_id inválido" });
  }

  logStart(rid, "listarDatasDaTurma", { turmaId, via });

  try {
    if (via === "datas") {
      const sql = `
        SELECT
          to_char(dt.data,'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim,'HH24:MI') AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id = $1
        ORDER BY dt.data ASC
      `;

      const { rows } = await query(sql, [turmaId]);
      logInfo(rid, "listarDatasDaTurma/datas OK", { count: rows.length });
      return res.json(rows);
    }

    if (via === "presencas") {
      const sqlA = `
        SELECT DISTINCT
          to_char(p.data::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC
      `;

      const sqlB = `
        SELECT DISTINCT
          to_char(p.data_presenca::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC
      `;

      try {
        const { rows } = await query(sqlA, [turmaId]);
        logInfo(rid, "listarDatasDaTurma/presencas A OK", { count: rows.length });
        return res.json(rows);
      } catch (e1) {
        try {
          const { rows } = await query(sqlB, [turmaId]);
          logInfo(rid, "listarDatasDaTurma/presencas B OK", { count: rows.length });
          return res.json(rows);
        } catch {
          logWarn(rid, "listarDatasDaTurma/presencas vazio");
          return res.json([]);
        }
      }
    }

    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date AS df,
          to_char(horario_inicio,'HH24:MI') AS hi,
          to_char(horario_fim,'HH24:MI') AS hf
        FROM turmas
        WHERE id = $1
      )
      SELECT
        to_char(gs::date,'YYYY-MM-DD') AS data,
        t.hi AS horario_inicio,
        t.hf AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC
    `;

    const { rows } = await query(sql, [turmaId]);
    logInfo(rid, "listarDatasDaTurma/generate_series OK", { count: rows.length });
    return res.json(rows);
  } catch (erro) {
    logError(rid, "listarDatasDaTurma erro", erro);
    return res.status(500).json({
      erro: "Erro ao buscar datas da turma.",
      ...(IS_DEV
        ? {
            detalhe: erro?.message,
            code: erro?.code,
            constraint: erro?.constraint,
            detail: erro?.detail,
            where: erro?.where,
          }
        : {}),
    });
  }
}

/* =====================================================================
   ✅ Exports do controller público
===================================================================== */
module.exports = {
  listarEventos,
  listarEventosParaMim,
  obterFolderDoEvento,
  buscarEventoPorId,
  listarTurmasDoEvento,
  listarTurmasSimples,
  getAgendaEventos,
  listarEventosDoinstrutor,
  listarDatasDaTurma,

  // compartilhados/úteis
  getUsuarioContextoRestricao,
  montarPublicoAlvoLabel,
  avaliarElegibilidadeInscricao,
  avaliarElegibilidadeInscricaoComContexto,
  enriquecerEventosLista,
  podeVerEvento,
  normalizarTituloPtBr,
  toYmd,
  toHm,
  hhmm,
  extrairDatasDaTurma,
};