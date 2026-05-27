/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/eventoPublicoController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller público/consulta de eventos.
 *
 * Responsabilidades:
 * - listar eventos publicados/autorizados;
 * - listar eventos "para mim";
 * - buscar detalhe completo de evento;
 * - expor folder persistido no banco;
 * - expor programação PDF persistida no banco;
 * - listar agenda e eventos do organizador;
 * - avaliar elegibilidade de inscrição.
 *
 * Contratos oficiais:
 * - ../db exporta pool e query;
 * - req.user.perfil é a fonte oficial de perfil;
 * - perfil administrativo oficial: administrador;
 * - folder: eventos.folder_blob;
 * - programação: eventos.programacao_pdf_blob;
 * - date-only trafega como YYYY-MM-DD;
 * - URL oficial de evento: /api/evento;
 * - turmas são oficialmente servidas por /api/turma;
 * - tabela oficial de responsáveis: turma_responsavel;
 * - papel oficial de organizador: turma_responsavel.papel = 'organizador';
 * - tabela oficial de palestrantes: turma_palestrante;
 * - tabela oficial de assinantes: turma_certificado_assinante;
 * - sem fallback de schema;
 * - sem URL antiga como fonte funcional;
 * - sem /api/eventos;
 * - sem organizador_id;
 * - sem organizador_assinante_id.
 */

const { pool, query } = require("../db");
function normalizeRegistro(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\D/g, "")
    .trim();
}

if (!pool?.connect || typeof query !== "function") {
  throw new Error(
    "[eventoPublicoController] Contrato inválido: ../db deve exportar pool e query."
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

const PERFIL_ADMINISTRADOR = "administrador";
const PAPEL_ORGANIZADOR = "organizador";

const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

/* ───────────────────────────────────────────────────────────────
   Logger
─────────────────────────────────────────────────────────────── */

function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[EVT:PUBLIC][RID=${rid}]`;
  const hasExtra = extra && Object.keys(extra).length;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, hasExtra ? extra : "");
  }

  if (level === "info") {
    return console.log(`${prefix} • ${msg}`, hasExtra ? extra : "");
  }

  return console.log(`${prefix} ▶ ${msg}`, hasExtra ? extra : "");
}

const logStart = (rid, msg, extra) => log(rid, "start", msg, extra);
const logInfo = (rid, msg, extra) => log(rid, "info", msg, extra);
const logError = (rid, msg, err) => log(rid, "error", msg, err);

function memSnapshot(rid, label, extra = {}) {
  if (!IS_DEV) return;

  const m = process.memoryUsage();

  logInfo(rid, `[MEM] ${label}`, {
    rss_mb: Math.round(m.rss / 1024 / 1024),
    heap_total_mb: Math.round(m.heapTotal / 1024 / 1024),
    heap_used_mb: Math.round(m.heapUsed / 1024 / 1024),
    external_mb: Math.round(m.external / 1024 / 1024),
    ...extra,
  });
}

/* ───────────────────────────────────────────────────────────────
   Respostas
─────────────────────────────────────────────────────────────── */

function sendOk(
  res,
  { status = 200, message = "Operação realizada.", data = null, meta = null }
) {
  return res.status(status).json({
    ok: true,
    message,
    ...(data !== null ? { data } : {}),
    ...(meta !== null ? { meta } : {}),
  });
}

function sendError(
  res,
  {
    status = 500,
    code = "ERRO_INTERNO",
    message = "Erro interno.",
    rid = null,
    adminHint = null,
    error = null,
  }
) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...(rid ? { rid } : {}),
    ...(adminHint ? { adminHint } : {}),
    ...(IS_DEV && error
      ? {
          debug: {
            message: error?.message,
            code: error?.code,
            constraint: error?.constraint,
            detail: error?.detail,
            where: error?.where,
          },
        }
      : {}),
  });
}

/* ───────────────────────────────────────────────────────────────
   Helpers gerais
─────────────────────────────────────────────────────────────── */

function isAdmin(req) {
  return req.user?.perfil === PERFIL_ADMINISTRADOR;
}

function getUsuarioId(req) {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function uniqueInts(arr = []) {
  return [
    ...new Set(
      (arr || [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
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

function hhmm(value, fallback = "") {
  if (!value) return fallback;

  const str = String(value).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fallback;
}

function toYmd(value) {
  if (value == null) return null;

  if (typeof value === "string") {
    const s = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  }

  return null;
}

function toHm(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 5);
  }

  const d = new Date(value);

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
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "em",
    "para",
    "por",
    "a",
    "o",
    "as",
    "os",
    "à",
    "às",
    "ao",
    "aos",
  ]);

  const siglas = new Set([
    "SMS",
    "SUS",
    "CNPJ",
    "CPF",
    "RH",
    "TI",
    "UPA",
    "UBS",
    "SAMU",
  ]);

  const roman = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

  return s
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const clean = word.replace(/[()]/g, "");
      const upper = clean.toUpperCase();

      if (siglas.has(upper)) return upper;
      if (roman.test(clean)) return upper;

      const lower = clean.toLocaleLowerCase("pt-BR");

      if (index !== 0 && minusculas.has(lower)) return lower;

      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function safeFilename(name = "programacao.pdf") {
  const cleaned = String(name || "programacao.pdf")
    .replace(/["\r\n]/g, "")
    .trim();

  return cleaned || "programacao.pdf";
}

function getArquivoEventoUrls(eventoId) {
  return {
    folder_blob_url: `/api/evento/${eventoId}/folder`,
    programacao_pdf_blob_url: `/api/evento/${eventoId}/programacao`,
  };
}

function montarPessoaUsuario(row = {}) {
  return {
    id: Number(row.id),
    nome: row.nome,
    email: row.email || null,
    perfil: row.perfil || null,
  };
}

/* ───────────────────────────────────────────────────────────────
   Restrição / elegibilidade
─────────────────────────────────────────────────────────────── */

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

  const usuario = rows[0] || {};

  return {
    registro: usuario.registro || "",
    registro_norm: normalizeRegistro(usuario.registro || ""),
    cargo_id: Number(usuario.cargo_id) || null,
    unidade_id: Number(usuario.unidade_id) || null,
  };
}

function montarPublicoAlvoLabel(evento = {}) {
  const publico = String(evento?.publico_alvo || "").trim();

  if (publico) return publico;

  const cargos = Array.isArray(evento?.cargos_permitidos)
    ? evento.cargos_permitidos
    : [];

  const unidades = Array.isArray(evento?.unidades_permitidas)
    ? evento.unidades_permitidas
    : [];

  const countRegs = Number(evento?.count_registros_permitidos || 0);

  if (cargos.length) {
    return cargos
      .map((c) => normalizarTituloPtBr(c?.nome || c?.cargo || ""))
      .filter(Boolean)
      .join(", ");
  }

  if (unidades.length) {
    return unidades
      .map((u) => u?.nome)
      .filter(Boolean)
      .join(", ");
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
    ? evento.cargos_permitidos_ids.map(Number).filter(Number.isInteger)
    : [];

  const unidadesIdsPermitidas = Array.isArray(evento.unidades_permitidas_ids)
    ? evento.unidades_permitidas_ids.map(Number).filter(Number.isInteger)
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
      motivo_bloqueio:
        "Inscrição disponível apenas para servidores com registro válido.",
      publico_alvo_label: montarPublicoAlvoLabel(evento),
    };
  }

  if (evento.restrito_modo === MODO_LISTA) {
    const registros = Array.isArray(evento.registros_permitidos)
      ? evento.registros_permitidos
      : [];

    if (usuario.registro_norm && registros.includes(usuario.registro_norm)) {
      return {
        pode_se_inscrever: true,
        motivo_bloqueio: "",
        publico_alvo_label: montarPublicoAlvoLabel(evento),
      };
    }

    return {
      pode_se_inscrever: false,
      motivo_bloqueio:
        "Inscrição disponível apenas para servidores autorizados nesta lista.",
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
    motivo_bloqueio: `Inscrição disponível apenas para ${montarPublicoAlvoLabel(
      evento
    )}.`,
    publico_alvo_label: montarPublicoAlvoLabel(evento),
  };
}

async function avaliarElegibilidadeInscricao({ client, usuarioId, evento }) {
  const usuario = await getUsuarioContextoRestricao(client, usuarioId);

  return avaliarElegibilidadeInscricaoComContexto({
    usuario: {
      id: usuarioId,
      ...usuario,
    },
    evento,
  });
}

/* ───────────────────────────────────────────────────────────────
   Enriquecimento de eventos
─────────────────────────────────────────────────────────────── */

async function enriquecerEventosLista(client, usuarioId, eventosBase, rid) {
  const eventoIds = uniqueInts((eventosBase || []).map((evento) => evento.id));

  if (!eventoIds.length) return [];

  memSnapshot(rid, "enriquecerEventosLista:inicio", {
    eventos: eventoIds.length,
    usuarioId,
  });

  const usuarioCtx = await getUsuarioContextoRestricao(client, usuarioId);

  const [regsQ, organizadoresQ, cargosQ, unidadesQ] = await Promise.all([
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
        u.nome,
        u.email,
        u.perfil
      FROM turmas t
      JOIN turma_responsavel tr ON tr.turma_id = t.id
      JOIN usuarios u ON u.id = tr.usuario_id
      WHERE t.evento_id = ANY($1::int[])
        AND tr.papel = $2
      GROUP BY t.evento_id, u.id, u.nome, u.email, u.perfil
      ORDER BY t.evento_id, u.nome
      `,
      [eventoIds, PAPEL_ORGANIZADOR]
    ),

    client.query(
      `
      SELECT
        ec.evento_id,
        c.id,
        c.nome
      FROM evento_cargos ec
      JOIN cargos c ON c.id::text = ec.cargo
      WHERE ec.evento_id = ANY($1::int[])
      ORDER BY ec.evento_id, c.nome
      `,
      [eventoIds]
    ),

    client.query(
      `
      SELECT
        eu.evento_id,
        u.id,
        u.nome
      FROM evento_unidades eu
      JOIN unidades u ON u.id = eu.unidade_id
      WHERE eu.evento_id = ANY($1::int[])
      ORDER BY eu.evento_id, u.nome
      `,
      [eventoIds]
    ),
  ]);

  const registrosMap = new Map();

  for (const row of regsQ.rows || []) {
    const arr = registrosMap.get(row.evento_id) || [];
    arr.push(row.registro_norm);
    registrosMap.set(row.evento_id, arr);
  }

  const organizadoresMap = groupRows(organizadoresQ.rows || [], "evento_id");
  const cargosMap = groupRows(cargosQ.rows || [], "evento_id");
  const unidadesMap = groupRows(unidadesQ.rows || [], "evento_id");

  const eventos = (eventosBase || []).map((evento) => {
    const registros = registrosMap.get(evento.id) || [];

    const organizadores = (organizadoresMap.get(evento.id) || []).map((i) => ({
      id: Number(i.id),
      nome: i.nome,
      email: i.email || null,
      perfil: i.perfil || null,
    }));

    const cargos = (cargosMap.get(evento.id) || []).map((cargo) => ({
      id: Number(cargo.id),
      nome: normalizarTituloPtBr(cargo.nome),
    }));

    const unidades = (unidadesMap.get(evento.id) || []).map((unidade) => ({
      id: Number(unidade.id),
      nome: unidade.nome,
    }));

    const payload = {
      ...evento,
      ...getArquivoEventoUrls(evento.id),

      registros_permitidos: registros,
      count_registros_permitidos: registros.length,

      cargos_permitidos: cargos,
      cargos_permitidos_ids: cargos.map((c) => c.id),

      unidades_permitidas: unidades,
      unidades_permitidas_ids: unidades.map((u) => u.id),

      organizadores,
    };

    const elegibilidade = avaliarElegibilidadeInscricaoComContexto({
      usuario: {
        id: usuarioId,
        ...usuarioCtx,
      },
      evento: payload,
    });

    return {
      ...payload,
      pode_se_inscrever: elegibilidade.pode_se_inscrever,
      motivo_bloqueio: elegibilidade.motivo_bloqueio,
      publico_alvo_label: elegibilidade.publico_alvo_label,
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

  const { rows } = await client.query(
    `
    SELECT id, publicado
    FROM eventos
    WHERE id = $1
    `,
    [eventoId]
  );

  const evento = rows[0];

  if (!evento) {
    return {
      ok: false,
      motivo: "EVENTO_NAO_ENCONTRADO",
    };
  }

  if (admin) {
    return { ok: true };
  }

  if (!evento.publicado) {
    return {
      ok: false,
      motivo: "NAO_PUBLICADO",
    };
  }

  if (!usuarioId) {
    return {
      ok: false,
      motivo: "NAO_AUTENTICADO",
    };
  }

  return { ok: true };
}

/* ───────────────────────────────────────────────────────────────
   Query base de listagem
─────────────────────────────────────────────────────────────── */

function montarSqlListaEventos({ somentePublicados, incluirEventosDoorganizador }) {
  const filtro = somentePublicados
    ? incluirEventosDoorganizador
      ? `(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM minhas_turmas))`
      : `e.publicado = TRUE`
    : `TRUE`;

  return `
    WITH minhas_turmas AS (
      SELECT DISTINCT t.evento_id
      FROM turmas t
      JOIN turma_responsavel tr ON tr.turma_id = t.id
      WHERE tr.usuario_id = $2
        AND tr.papel = '${PAPEL_ORGANIZADOR}'
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
    agg_organizador AS (
      SELECT
        t.evento_id,
        TRUE AS ja_organizador
      FROM turmas t
      JOIN turma_responsavel tr ON tr.turma_id = t.id
      WHERE tr.usuario_id = $2
        AND tr.papel = '${PAPEL_ORGANIZADOR}'
      GROUP BY t.evento_id
    ),
    agora AS (
      SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS br_now
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
      e.visibilidade,
      e.criado_em,

      CASE
        WHEN e.folder_blob IS NOT NULL THEN 'blob'
        ELSE 'none'
      END AS folder_kind,
      e.folder_size,
      e.folder_updated_at,

      CASE
        WHEN e.programacao_pdf_blob IS NOT NULL THEN 'blob'
        ELSE 'none'
      END AS programacao_kind,
      e.programacao_pdf_size,
      e.programacao_pdf_nome_original,
      e.programacao_pdf_updated_at,

      at.data_inicio_geral,
      at.data_fim_geral,
      at.horario_inicio_geral,
      at.horario_fim_geral,

      CASE
        WHEN COALESCE(
          ad.inicio_real,
          at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
        ) IS NULL THEN 'sem_datas'
        WHEN a.br_now < COALESCE(
          ad.inicio_real,
          at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
        ) THEN 'programado'
        WHEN a.br_now <= COALESCE(
          ad.fim_real,
          at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
        ) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,

      COALESCE(ai.ja_inscrito, FALSE) AS ja_inscrito,
      COALESCE(atr.ja_organizador, FALSE) AS ja_organizador

    FROM eventos e
    CROSS JOIN agora a
    LEFT JOIN agg_turmas at ON at.evento_id = e.id
    LEFT JOIN agg_datas ad ON ad.evento_id = e.id
    LEFT JOIN agg_inscrito ai ON ai.evento_id = e.id
    LEFT JOIN agg_organizador atr ON atr.evento_id = e.id
    WHERE ${filtro}
    ORDER BY COALESCE(
      ad.fim_real,
      at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
    ) DESC NULLS LAST,
    e.id DESC
  `;
}

/* =====================================================================
   Listar eventos
===================================================================== */

async function listarEventos(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  logStart(rid, "listarEventos", { usuarioId, admin });

  const client = await pool.connect();

  try {
    memSnapshot(rid, "listarEventos:inicio", { usuarioId, admin });

    const sql = montarSqlListaEventos({
      somentePublicados: !admin,
      incluirEventosDoorganizador: true,
    });

    const { rows } = await client.query(sql, [usuarioId || 0, usuarioId || 0]);

    const eventos = await enriquecerEventosLista(client, usuarioId, rows || [], rid);

    memSnapshot(rid, "listarEventos:fim", {
      usuarioId,
      admin,
      count: eventos.length,
    });

    logInfo(rid, "listarEventos OK", { count: eventos.length });

    return sendOk(res, {
      message: "Eventos carregados.",
      data: eventos,
      meta: {
        total: eventos.length,
      },
    });
  } catch (err) {
    logError(rid, "listarEventos erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_LISTAR_ERRO",
      message: "Erro ao listar eventos.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   Listar eventos para mim
===================================================================== */

async function listarEventosParaMim(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return sendError(res, {
      status: 401,
      code: "NAO_AUTENTICADO",
      message: "Faça login para consultar os eventos disponíveis para você.",
      rid,
    });
  }

  const client = await pool.connect();

  try {
    logStart(rid, "listarEventosParaMim", { usuarioId });
    memSnapshot(rid, "listarEventosParaMim:inicio", { usuarioId });

    const sql = montarSqlListaEventos({
      somentePublicados: true,
      incluirEventosDoorganizador: false,
    });

    const { rows } = await client.query(sql, [usuarioId, usuarioId]);

    const eventos = await enriquecerEventosLista(client, usuarioId, rows || [], rid);

    memSnapshot(rid, "listarEventosParaMim:fim", {
      usuarioId,
      count: eventos.length,
    });

    logInfo(rid, "listarEventosParaMim OK", {
      count: eventos.length,
    });

    return sendOk(res, {
      message: "Eventos disponíveis para o usuário carregados.",
      data: eventos,
      meta: {
        total: eventos.length,
      },
    });
  } catch (err) {
    logError(rid, "listarEventosParaMim erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_PARA_MIM_ERRO",
      message: "Erro ao listar eventos disponíveis para o usuário.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   Folder do evento
===================================================================== */

async function obterFolderDoEvento(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).end();
  }

  try {
    const { rows } = await query(
      `
      SELECT
        folder_blob,
        folder_mime,
        folder_size,
        folder_updated_at
      FROM eventos
      WHERE id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).end();
    }

    const row = rows[0];

    if (!row.folder_blob) {
      res.setHeader("Cache-Control", IS_DEV ? "no-store" : "public, max-age=300");
      return res.status(204).end();
    }

    res.setHeader("Content-Type", row.folder_mime || "image/jpeg");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      IS_DEV ? "no-store" : "public, max-age=3600, stale-while-revalidate=86400"
    );

    if (row.folder_size) {
      res.setHeader("Content-Length", String(row.folder_size));
    }

    if (row.folder_updated_at) {
      res.setHeader("Last-Modified", new Date(row.folder_updated_at).toUTCString());
    }

    return res.status(200).send(row.folder_blob);
  } catch (err) {
    logError(rid, "obterFolderDoEvento erro", err);
    return res.status(500).end();
  }
}

/* =====================================================================
   Programação PDF do evento
===================================================================== */

async function obterProgramacaoDoEvento(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).end();
  }

  try {
    const { rows } = await query(
      `
      SELECT
        programacao_pdf_blob,
        programacao_pdf_mime,
        programacao_pdf_size,
        programacao_pdf_nome_original,
        programacao_pdf_updated_at
      FROM eventos
      WHERE id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).end();
    }

    const row = rows[0];

    if (!row.programacao_pdf_blob) {
      res.setHeader("Cache-Control", IS_DEV ? "no-store" : "public, max-age=300");
      return res.status(204).end();
    }

    const filename = safeFilename(row.programacao_pdf_nome_original || "programacao.pdf");

    res.setHeader("Content-Type", row.programacao_pdf_mime || "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader(
      "Cache-Control",
      IS_DEV ? "no-store" : "public, max-age=3600, stale-while-revalidate=86400"
    );

    if (row.programacao_pdf_size) {
      res.setHeader("Content-Length", String(row.programacao_pdf_size));
    }

    if (row.programacao_pdf_updated_at) {
      res.setHeader(
        "Last-Modified",
        new Date(row.programacao_pdf_updated_at).toUTCString()
      );
    }

    return res.status(200).send(row.programacao_pdf_blob);
  } catch (err) {
    logError(rid, "obterProgramacaoDoEvento erro", err);
    return res.status(500).end();
  }
}

/* ───────────────────────────────────────────────────────────────
   Helpers de turmas
─────────────────────────────────────────────────────────────── */

async function carregarTurmasComDetalhes(client, eventoId) {
  const turmasResult = await client.query(
    `
    SELECT
      id,
      evento_id,
      nome,
      data_inicio,
      data_fim,
      horario_inicio,
      horario_fim,
      vagas_total,
      carga_horaria
    FROM turmas
    WHERE evento_id = $1
    ORDER BY data_inicio NULLS LAST, id
    `,
    [eventoId]
  );

  const turmaIds = turmasResult.rows.map((turma) => Number(turma.id));

  if (!turmaIds.length) return [];

  const [
    datasAll,
    organizadoresAll,
    palestrantesAll,
    assinantesAll,
    inscritosAll,
  ] = await Promise.all([
    client.query(
      `
      SELECT
        turma_id,
        to_char(data::date, 'YYYY-MM-DD') AS data,
        to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(horario_fim, 'HH24:MI') AS horario_fim
      FROM datas_turma
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, data ASC
      `,
      [turmaIds]
    ),

    client.query(
      `
      SELECT
        tr.turma_id,
        u.id,
        u.nome,
        u.email,
        u.perfil
      FROM turma_responsavel tr
      JOIN usuarios u ON u.id = tr.usuario_id
      WHERE tr.turma_id = ANY($1::int[])
        AND tr.papel = $2
      ORDER BY tr.turma_id, u.nome
      `,
      [turmaIds, PAPEL_ORGANIZADOR]
    ),

    client.query(
      `
      SELECT
        id,
        turma_id,
        nome,
        usuario_id
      FROM turma_palestrante
      WHERE turma_id = ANY($1::int[])
      ORDER BY turma_id, nome ASC, id ASC
      `,
      [turmaIds]
    ),

    client.query(
      `
      SELECT
        tca.turma_id,
        tca.usuario_id,
        tca.ordem,
        u.nome,
        u.email,
        u.perfil
      FROM turma_certificado_assinante tca
      JOIN usuarios u ON u.id = tca.usuario_id
      WHERE tca.turma_id = ANY($1::int[])
      ORDER BY tca.turma_id, tca.ordem ASC
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
  ]);

  const datasByTurma = new Map();
  const organizadoresByTurma = new Map();
  const palestrantesByTurma = new Map();
  const assinantesByTurma = new Map();
  const inscritosByTurma = new Map();

  for (const row of datasAll.rows || []) {
    const arr = datasByTurma.get(row.turma_id) || [];

    arr.push({
      data: row.data,
      horario_inicio: row.horario_inicio,
      horario_fim: row.horario_fim,
    });

    datasByTurma.set(row.turma_id, arr);
  }

  for (const row of organizadoresAll.rows || []) {
    const arr = organizadoresByTurma.get(row.turma_id) || [];

    arr.push(montarPessoaUsuario(row));

    organizadoresByTurma.set(row.turma_id, arr);
  }

  for (const row of palestrantesAll.rows || []) {
    const arr = palestrantesByTurma.get(row.turma_id) || [];

    arr.push({
      id: Number(row.id),
      turma_id: Number(row.turma_id),
      nome: row.nome,
      usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
    });

    palestrantesByTurma.set(row.turma_id, arr);
  }

  for (const row of assinantesAll.rows || []) {
    const arr = assinantesByTurma.get(row.turma_id) || [];

    arr.push({
      id: Number(row.usuario_id),
      usuario_id: Number(row.usuario_id),
      nome: row.nome,
      email: row.email || null,
      perfil: row.perfil || null,
      ordem: Number(row.ordem),
    });

    assinantesByTurma.set(row.turma_id, arr);
  }

  for (const row of inscritosAll.rows || []) {
    inscritosByTurma.set(row.turma_id, Number(row.inscritos || 0));
  }

  return turmasResult.rows.map((turma) => {
    const datas = datasByTurma.get(turma.id) || [];
    const organizadores = organizadoresByTurma.get(turma.id) || [];
    const palestrantes = palestrantesByTurma.get(turma.id) || [];
    const assinantes = assinantesByTurma.get(turma.id) || [];
    const inscritos = inscritosByTurma.get(turma.id) || 0;

    const vagasTotal = Number.isFinite(Number(turma.vagas_total))
      ? Number(turma.vagas_total)
      : 0;

    return {
      ...turma,
      data_inicio: toYmd(turma.data_inicio),
      data_fim: toYmd(turma.data_fim),
      horario_inicio: toHm(turma.horario_inicio),
      horario_fim: toHm(turma.horario_fim),

      organizadores,
      palestrantes,
      assinantes,

      datas,
      datas_count: datas.length,

      inscritos,
      vagas_preenchidas: inscritos,
      vagas_disponiveis: Math.max(vagasTotal - inscritos, 0),
    };
  });
}

/* =====================================================================
   Buscar evento por ID
===================================================================== */

async function buscarEventoPorId(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, {
      status: 400,
      code: "EVENTO_ID_INVALIDO",
      message: "evento_id inválido.",
      rid,
    });
  }

  const client = await pool.connect();

  try {
    logStart(rid, "buscarEventoPorId", { id, usuarioId, admin });

    const eventoResult = await client.query(
      `
      SELECT
        id,
        titulo,
        descricao,
        local,
        criado_em,
        tipo,
        unidade_id,
        publico_alvo,
        restrito,
        restrito_modo,
        publicado,
        visibilidade,
        folder_mime,
        folder_size,
        folder_updated_at,
        programacao_pdf_mime,
        programacao_pdf_size,
        programacao_pdf_nome_original,
        programacao_pdf_updated_at,
        CASE WHEN folder_blob IS NOT NULL THEN TRUE ELSE FALSE END AS tem_folder,
        CASE WHEN programacao_pdf_blob IS NOT NULL THEN TRUE ELSE FALSE END AS tem_programacao
      FROM eventos
      WHERE id = $1
      `,
      [id]
    );

    if (!eventoResult.rowCount) {
      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    const evento = eventoResult.rows[0];

    if (!admin && !evento.publicado) {
      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    if (!admin) {
      const permissao = await podeVerEvento({
        client,
        usuarioId,
        eventoId: id,
        req,
      });

      if (!permissao.ok) {
        return sendError(res, {
          status: permissao.motivo === "NAO_PUBLICADO" ? 404 : 403,
          code:
            permissao.motivo === "NAO_PUBLICADO"
              ? "EVENTO_NAO_ENCONTRADO"
              : "EVENTO_ACESSO_NEGADO",
          message:
            permissao.motivo === "NAO_PUBLICADO"
              ? "Evento não encontrado."
              : "Acesso negado.",
          rid,
        });
      }
    }

    const [regsQ, cargosQ, unidadesQ, organizadoresEventoQ, questionarioResult] =
      await Promise.all([
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
          SELECT c.id, c.nome, c.codigo
          FROM evento_cargos ec
          JOIN cargos c ON c.id::text = ec.cargo
          WHERE ec.evento_id = $1
          ORDER BY c.nome
          `,
          [id]
        ),

        client.query(
          `
          SELECT u.id, u.nome
          FROM evento_unidades eu
          JOIN unidades u ON u.id = eu.unidade_id
          WHERE eu.evento_id = $1
          ORDER BY u.nome
          `,
          [id]
        ),

        client.query(
          `
          SELECT DISTINCT u.id, u.nome, u.email, u.perfil
          FROM turmas t
          JOIN turma_responsavel tr ON tr.turma_id = t.id
          JOIN usuarios u ON u.id = tr.usuario_id
          WHERE t.evento_id = $1
            AND tr.papel = $2
          ORDER BY u.nome
          `,
          [id, PAPEL_ORGANIZADOR]
        ),

        client.query(
          `
          SELECT
            id,
            status,
            obrigatorio,
            min_nota,
            tentativas_max,
            tempo_minutos
          FROM questionarios_evento
          WHERE evento_id = $1
          ORDER BY id DESC
          LIMIT 1
          `,
          [id]
        ),
      ]);

    const turmas = await carregarTurmasComDetalhes(client, id);

    const [jaOrganizadorResult, jaInscritoResult] = await Promise.all([
      client.query(
        `
        SELECT EXISTS(
          SELECT 1
          FROM turmas t
          JOIN turma_responsavel tr ON tr.turma_id = t.id
          WHERE t.evento_id = $1
            AND tr.usuario_id = $2
            AND tr.papel = $3
        ) AS eh
        `,
        [id, usuarioId || 0, PAPEL_ORGANIZADOR]
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

    const cargosPermitidos = (cargosQ.rows || []).map((cargo) => ({
      ...cargo,
      id: Number(cargo.id),
      nome: normalizarTituloPtBr(cargo.nome),
    }));

    const unidadesPermitidas = (unidadesQ.rows || []).map((unidade) => ({
      ...unidade,
      id: Number(unidade.id),
    }));

    const payloadBase = {
      ...evento,
      ...getArquivoEventoUrls(id),

      folder_kind: evento.tem_folder ? "blob" : "none",
      programacao_kind: evento.tem_programacao ? "blob" : "none",

      registros_permitidos: regsQ.rows.map((r) => r.registro_norm),
      count_registros_permitidos: regsQ.rows.length,

      cargos_permitidos: cargosPermitidos,
      cargos_permitidos_ids: cargosPermitidos.map((cargo) => cargo.id),

      unidades_permitidas: unidadesPermitidas,
      unidades_permitidas_ids: unidadesPermitidas.map((unidade) => unidade.id),
    };

    const elegibilidade = await avaliarElegibilidadeInscricao({
      client,
      usuarioId,
      evento: payloadBase,
    });

    const questionario = questionarioResult.rows?.[0] || null;

    const payload = {
      ...payloadBase,

      pode_se_inscrever: elegibilidade.pode_se_inscrever,
      motivo_bloqueio: elegibilidade.motivo_bloqueio,
      publico_alvo_label: elegibilidade.publico_alvo_label,

      pos_curso: questionario
        ? {
            questionario_id: questionario.id,
            status: questionario.status,
            obrigatorio: Boolean(questionario.obrigatorio),
            min_nota: questionario.min_nota,
            tentativas_max: questionario.tentativas_max,
            tempo_minutos: questionario.tempo_minutos,
          }
        : null,

      organizadores: organizadoresEventoQ.rows.map((row) => ({
        id: Number(row.id),
        nome: row.nome,
        email: row.email || null,
        perfil: row.perfil || null,
      })),

      turmas,

      ja_organizador: Boolean(jaOrganizadorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    };

    logInfo(rid, "buscarEventoPorId OK", {
      id,
      turmas: turmas.length,
      questionario_id: questionario?.id || null,
      pode_se_inscrever: elegibilidade.pode_se_inscrever,
    });

    return sendOk(res, {
      message: "Evento carregado.",
      data: payload,
    });
  } catch (err) {
    logError(rid, "buscarEventoPorId erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_BUSCAR_ERRO",
      message: "Erro ao buscar evento por ID.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   Agenda
===================================================================== */

async function getAgendaEventos(req, res) {
  const rid = mkRid();
  const admin = isAdmin(req);

  logStart(rid, "getAgendaEventos", { admin });

  try {
    const { rows } = await query(
      `
      WITH agg_datas AS (
        SELECT
          e.id AS evento_id,
          MIN(COALESCE(dt.data::date, t.data_inicio::date)) AS data_inicio,
          MAX(COALESCE(dt.data::date, t.data_fim::date)) AS data_fim,
          MIN(COALESCE(dt.horario_inicio, t.horario_inicio, '00:00'::time)) AS horario_inicio,
          MAX(COALESCE(dt.horario_fim, t.horario_fim, '23:59'::time)) AS horario_fim
        FROM eventos e
        JOIN turmas t ON t.evento_id = e.id
        LEFT JOIN datas_turma dt ON dt.turma_id = t.id
        WHERE ${admin ? "TRUE" : "e.publicado = TRUE"}
        GROUP BY e.id
      ),
      ocorrencias AS (
        SELECT
          e.id AS evento_id,
          COALESCE(
            (
              SELECT json_agg(d ORDER BY d)
              FROM (
                SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
                FROM turmas tx
                JOIN datas_turma dt ON dt.turma_id = tx.id
                WHERE tx.evento_id = e.id
              ) z
            ),
            '[]'::json
          ) AS ocorrencias
        FROM eventos e
      ),
      agora AS (
        SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS br_now
      )
      SELECT
        e.id,
        e.titulo,
        ad.data_inicio,
        ad.data_fim,
        ad.horario_inicio,
        ad.horario_fim,
        CASE
          WHEN ad.data_inicio IS NULL THEN 'sem_datas'
          WHEN a.br_now < ad.data_inicio::date + COALESCE(ad.horario_inicio, '00:00'::time)
            THEN 'programado'
          WHEN a.br_now <= ad.data_fim::date + COALESCE(ad.horario_fim, '23:59'::time)
            THEN 'andamento'
          ELSE 'encerrado'
        END AS status,
        COALESCE(o.ocorrencias, '[]'::json) AS ocorrencias
      FROM eventos e
      CROSS JOIN agora a
      JOIN agg_datas ad ON ad.evento_id = e.id
      LEFT JOIN ocorrencias o ON o.evento_id = e.id
      WHERE ${admin ? "TRUE" : "e.publicado = TRUE"}
      ORDER BY ad.data_fim DESC NULLS LAST, e.id DESC
      `
    );

    const agenda = (rows || []).map((row) => ({
      ...row,
      data_inicio: toYmd(row.data_inicio),
      data_fim: toYmd(row.data_fim),
      horario_inicio: toHm(row.horario_inicio),
      horario_fim: toHm(row.horario_fim),
      ocorrencias: Array.isArray(row.ocorrencias) ? row.ocorrencias : [],
    }));

    logInfo(rid, "getAgendaEventos OK", { count: agenda.length });

    return sendOk(res, {
      message: "Agenda de eventos carregada.",
      data: agenda,
      meta: {
        total: agenda.length,
      },
    });
  } catch (err) {
    logError(rid, "getAgendaEventos erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_AGENDA_ERRO",
      message: "Erro ao buscar agenda.",
      rid,
      error: err,
    });
  }
}

/* =====================================================================
   Eventos do organizador
===================================================================== */

async function listarEventosDoorganizador(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return sendError(res, {
      status: 401,
      code: "NAO_AUTENTICADO",
      message: "Faça login para consultar os eventos do organizador.",
      rid,
    });
  }

  const client = await pool.connect();

  logStart(rid, "listarEventosDoorganizador", { usuarioId });

  try {
    const eventosResult = await client.query(
      `
      WITH agora AS (
        SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS br_now
      )
      SELECT DISTINCT
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
        e.visibilidade,
        e.criado_em,

        CASE
          WHEN e.folder_blob IS NOT NULL THEN 'blob'
          ELSE 'none'
        END AS folder_kind,

        CASE
          WHEN e.programacao_pdf_blob IS NOT NULL THEN 'blob'
          ELSE 'none'
        END AS programacao_kind,

        CASE
          WHEN (
            SELECT MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time))
            FROM turmas t2
            JOIN datas_turma dt ON dt.turma_id = t2.id
            WHERE t2.evento_id = e.id
          ) IS NULL THEN 'sem_datas'

          WHEN a.br_now < (
            SELECT MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time))
            FROM turmas t2
            JOIN datas_turma dt ON dt.turma_id = t2.id
            WHERE t2.evento_id = e.id
          ) THEN 'programado'

          WHEN a.br_now <= (
            SELECT MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time))
            FROM turmas t2
            JOIN datas_turma dt ON dt.turma_id = t2.id
            WHERE t2.evento_id = e.id
          ) THEN 'andamento'

          ELSE 'encerrado'
        END AS status,

        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos

      FROM eventos e
      CROSS JOIN agora a
      JOIN turmas t ON t.evento_id = e.id
      JOIN turma_responsavel tr ON tr.turma_id = t.id
      WHERE tr.usuario_id = $1
        AND tr.papel = $2
        AND e.publicado = TRUE
      ORDER BY e.id DESC
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    const eventos = (eventosResult.rows || []).map((evento) => ({
      ...evento,
      ...getArquivoEventoUrls(evento.id),
    }));

    if (!eventos.length) {
      logInfo(rid, "listarEventosDoorganizador vazio");

      return sendOk(res, {
        message: "Nenhum evento encontrado para o organizador.",
        data: [],
        meta: {
          total: 0,
        },
      });
    }

    const eventoIds = eventos.map((evento) => Number(evento.id));

    const turmasResult = await client.query(
      `
      SELECT
        id,
        evento_id,
        nome,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        vagas_total,
        carga_horaria
      FROM turmas
      WHERE evento_id = ANY($1::int[])
      ORDER BY evento_id, data_inicio NULLS LAST, id
      `,
      [eventoIds]
    );

    const turmas = turmasResult.rows || [];
    const turmaIds = turmas.map((turma) => Number(turma.id));

    const [datasAll, organizadoresTurmaAll, palestrantesAll, assinantesAll, organizadoresEventoAll] =
      turmaIds.length
        ? await Promise.all([
            client.query(
              `
              SELECT
                turma_id,
                to_char(data::date, 'YYYY-MM-DD') AS data,
                to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
                to_char(horario_fim, 'HH24:MI') AS horario_fim
              FROM datas_turma
              WHERE turma_id = ANY($1::int[])
              ORDER BY turma_id, data ASC
              `,
              [turmaIds]
            ),

            client.query(
              `
              SELECT
                tr.turma_id,
                u.id,
                u.nome,
                u.email,
                u.perfil
              FROM turma_responsavel tr
              JOIN usuarios u ON u.id = tr.usuario_id
              WHERE tr.turma_id = ANY($1::int[])
                AND tr.papel = $2
              ORDER BY tr.turma_id, u.nome
              `,
              [turmaIds, PAPEL_ORGANIZADOR]
            ),

            client.query(
              `
              SELECT
                id,
                turma_id,
                nome,
                usuario_id
              FROM turma_palestrante
              WHERE turma_id = ANY($1::int[])
              ORDER BY turma_id, nome ASC, id ASC
              `,
              [turmaIds]
            ),

            client.query(
              `
              SELECT
                tca.turma_id,
                tca.usuario_id,
                tca.ordem,
                u.nome,
                u.email,
                u.perfil
              FROM turma_certificado_assinante tca
              JOIN usuarios u ON u.id = tca.usuario_id
              WHERE tca.turma_id = ANY($1::int[])
              ORDER BY tca.turma_id, tca.ordem ASC
              `,
              [turmaIds]
            ),

            client.query(
              `
              SELECT
                t.evento_id,
                u.id,
                u.nome,
                u.email,
                u.perfil
              FROM turmas t
              JOIN turma_responsavel tr ON tr.turma_id = t.id
              JOIN usuarios u ON u.id = tr.usuario_id
              WHERE t.evento_id = ANY($1::int[])
                AND tr.papel = $2
              GROUP BY t.evento_id, u.id, u.nome, u.email, u.perfil
              ORDER BY t.evento_id, u.nome
              `,
              [eventoIds, PAPEL_ORGANIZADOR]
            ),
          ])
        : [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    const organizadoresTurmaMap = new Map();
    const palestrantesMap = new Map();
    const assinantesMap = new Map();
    const organizadoresEventoMap = new Map();

    for (const row of datasAll.rows) {
      const arr = datasByTurma.get(row.turma_id) || [];

      arr.push({
        data: row.data,
        horario_inicio: row.horario_inicio,
        horario_fim: row.horario_fim,
      });

      datasByTurma.set(row.turma_id, arr);
    }

    for (const row of organizadoresTurmaAll.rows) {
      const arr = organizadoresTurmaMap.get(row.turma_id) || [];

      arr.push(montarPessoaUsuario(row));

      organizadoresTurmaMap.set(row.turma_id, arr);
    }

    for (const row of palestrantesAll.rows) {
      const arr = palestrantesMap.get(row.turma_id) || [];

      arr.push({
        id: Number(row.id),
        nome: row.nome,
        usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
      });

      palestrantesMap.set(row.turma_id, arr);
    }

    for (const row of assinantesAll.rows) {
      const arr = assinantesMap.get(row.turma_id) || [];

      arr.push({
        id: Number(row.usuario_id),
        usuario_id: Number(row.usuario_id),
        nome: row.nome,
        email: row.email || null,
        perfil: row.perfil || null,
        ordem: Number(row.ordem),
      });

      assinantesMap.set(row.turma_id, arr);
    }

    for (const row of organizadoresEventoAll.rows) {
      const arr = organizadoresEventoMap.get(row.evento_id) || [];

      arr.push({
        id: Number(row.id),
        nome: row.nome,
        email: row.email || null,
        perfil: row.perfil || null,
      });

      organizadoresEventoMap.set(row.evento_id, arr);
    }

    const turmasByEvento = new Map();

    for (const turma of turmas) {
      const arr = turmasByEvento.get(turma.evento_id) || [];

      arr.push({
        ...turma,
        data_inicio: toYmd(turma.data_inicio),
        data_fim: toYmd(turma.data_fim),
        horario_inicio: toHm(turma.horario_inicio),
        horario_fim: toHm(turma.horario_fim),

        datas: datasByTurma.get(turma.id) || [],
        datas_count: (datasByTurma.get(turma.id) || []).length,

        organizadores: organizadoresTurmaMap.get(turma.id) || [],
        palestrantes: palestrantesMap.get(turma.id) || [],
        assinantes: assinantesMap.get(turma.id) || [],
      });

      turmasByEvento.set(turma.evento_id, arr);
    }

    const out = eventos.map((evento) => ({
      ...evento,
      organizadores: organizadoresEventoMap.get(evento.id) || [],
      turmas: turmasByEvento.get(evento.id) || [],
    }));

    logInfo(rid, "listarEventosDoorganizador OK", {
      eventos: out.length,
    });

    return sendOk(res, {
      message: "Eventos do organizador carregados.",
      data: out,
      meta: {
        total: out.length,
      },
    });
  } catch (err) {
    logError(rid, "listarEventosDoorganizador erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_ORGANIZADOR_LISTAR_ERRO",
      message: "Erro ao buscar eventos do organizador.",
      rid,
      error: err,
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   Compatibilidade interna: listagens antigas ainda exportadas
   Observação: rotas oficiais de turma ficam em /api/turma.
===================================================================== */

async function listarTurmasDoEvento(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);
  const admin = isAdmin(req);

  if (!Number.isInteger(eventoId) || eventoId <= 0) {
    return sendError(res, {
      status: 400,
      code: "EVENTO_ID_INVALIDO",
      message: "evento_id inválido.",
      rid,
    });
  }

  logStart(rid, "listarTurmasDoEvento", { eventoId, admin });

  try {
    const evento = await query(
      `
      SELECT id
      FROM eventos
      WHERE id = $1
        ${admin ? "" : "AND publicado = TRUE"}
      LIMIT 1
      `,
      [eventoId]
    );

    if (!evento.rowCount) {
      return sendError(res, {
        status: 404,
        code: "EVENTO_NAO_ENCONTRADO",
        message: "Evento não encontrado.",
        rid,
      });
    }

    const turmas = await carregarTurmasComDetalhes({ query }, eventoId);

    return sendOk(res, {
      message: "Turmas do evento carregadas.",
      data: turmas,
      meta: {
        total: turmas.length,
      },
    });
  } catch (err) {
    logError(rid, "listarTurmasDoEvento erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_TURMA_LISTAR_ERRO",
      message: "Erro ao buscar turmas do evento.",
      rid,
      error: err,
    });
  }
}

async function listarTurmasSimples(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);

  if (!Number.isInteger(eventoId) || eventoId <= 0) {
    return sendError(res, {
      status: 400,
      code: "EVENTO_ID_INVALIDO",
      message: "evento_id inválido.",
      rid,
    });
  }

  try {
    const turmas = await carregarTurmasComDetalhes({ query }, eventoId);

    return sendOk(res, {
      message: "Turmas simples carregadas.",
      data: turmas,
      meta: {
        total: turmas.length,
      },
    });
  } catch (err) {
    logError(rid, "listarTurmasSimples erro", err);

    return sendError(res, {
      status: 500,
      code: "EVENTO_TURMA_SIMPLES_LISTAR_ERRO",
      message: "Falha ao listar turmas.",
      rid,
      error: err,
    });
  }
}

async function listarDatasDaTurma(req, res) {
  const rid = mkRid();
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "datas").toLowerCase();

  if (!Number.isInteger(turmaId) || turmaId <= 0) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  logStart(rid, "listarDatasDaTurma", { turmaId, via });

  try {
    if (via === "datas") {
      const { rows } = await query(
        `
        SELECT
          to_char(dt.data::date, 'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim, 'HH24:MI') AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id = $1
        ORDER BY dt.data ASC
        `,
        [turmaId]
      );

      return sendOk(res, {
        message: "Datas da turma carregadas.",
        data: rows,
        meta: {
          total: rows.length,
        },
      });
    }

    if (via === "presencas") {
      const { rows } = await query(
        `
        SELECT DISTINCT
          to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim, 'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC
        `,
        [turmaId]
      );

      return sendOk(res, {
        message: "Datas com presença da turma carregadas.",
        data: rows,
        meta: {
          total: rows.length,
        },
      });
    }

    const { rows } = await query(
      `
      WITH t AS (
        SELECT
          data_inicio::date AS data_inicio,
          data_fim::date AS data_fim,
          to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(horario_fim, 'HH24:MI') AS horario_fim
        FROM turmas
        WHERE id = $1
      )
      SELECT
        to_char(gs::date, 'YYYY-MM-DD') AS data,
        t.horario_inicio,
        t.horario_fim
      FROM t,
      generate_series(t.data_inicio, t.data_fim, interval '1 day') AS gs
      ORDER BY data ASC
      `,
      [turmaId]
    );

    return sendOk(res, {
      message: "Datas geradas da turma carregadas.",
      data: rows,
      meta: {
        total: rows.length,
      },
    });
  } catch (err) {
    logError(rid, "listarDatasDaTurma erro", err);

    return sendError(res, {
      status: 500,
      code: "TURMA_DATA_LISTAR_ERRO",
      message: "Erro ao buscar datas da turma.",
      rid,
      error: err,
    });
  }
}

/* =====================================================================
   Exports
===================================================================== */

module.exports = {
  listarEventos,
  listarEventosParaMim,
  obterFolderDoEvento,
  obterProgramacaoDoEvento,
  buscarEventoPorId,
  listarTurmasDoEvento,
  listarTurmasSimples,
  getAgendaEventos,
  listarEventosDoorganizador,
  listarDatasDaTurma,

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
};