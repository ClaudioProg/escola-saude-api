/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/turmaController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial de turmas.
 *
 * Responsabilidades:
 * - criar, editar, obter e excluir turmas;
 * - listar turmas por evento;
 * - listar datas oficiais da turma;
 * - listar ocorrências da turma;
 * - gerenciar organizadores vinculados à turma;
 * - gerenciar palestrantes opcionais, inclusive externos;
 * - gerenciar assinantes oficiais do certificado da turma;
 * - preservar histórico operacional.
 *
 * Contratos oficiais:
 * - tabela oficial de inscrições: inscricoes;
 * - tabela oficial de datas: datas_turma;
 * - tabela oficial de responsáveis: turma_responsavel;
 * - tabela oficial de palestrantes: turma_palestrante;
 * - tabela oficial de assinantes: turma_certificado_assinante;
 * - organizador obrigatório: turma_responsavel.papel = 'organizador';
 * - palestrante opcional: turma_palestrante.nome;
 * - assinatura obrigatória: Rafaella Pitol, ID 17;
 * - Fábio Lopez, ID 2474, opcional e último quando selecionado;
 * - date-only trafega como YYYY-MM-DD;
 * - horário de parede trafega como HH:mm;
 * - resposta padrão: ok/message/data/meta;
 * - sem req.db;
 * - sem tabela inscricao;
 * - sem aliases de payload;
 * - sem encontros/inicio/fim como contrato.
 */

const { pool, query: dbQuery } = require("../db");

if (!pool?.connect || typeof dbQuery !== "function") {
  throw new Error(
    "[turmaController] Contrato inválido: ../db deve exportar pool e query."
  );
}

/* ───────────────────────────────────────────────────────────────
   Config
─────────────────────────────────────────────────────────────── */

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";
const LIMITE_NOME_TURMA = 200;

const VIA_DATAS = "datas";
const VIA_PRESENCAS = "presencas";
const VIA_INTERVALO = "intervalo";

const VIAS_PERMITIDAS = new Set([VIA_DATAS, VIA_PRESENCAS, VIA_INTERVALO]);

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;

const PAPEL_ORGANIZADOR = "organizador";
const PAPEL_PALESTRANTE = "palestrante";

const PERFIS_RESPONSAVEIS_VALIDOS = new Set([
  "organizador",
  "administrador",
]);

/* ───────────────────────────────────────────────────────────────
   Logger
─────────────────────────────────────────────────────────────── */

function mkRid(prefix = "TURMA") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "TURMA") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function log(rid, level, message, extra) {
  const prefix = `[TURMA][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${message}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${message}`, extra || "");
  }

  if (IS_DEV) {
    return console.log(`${prefix} • ${message}`, extra || "");
  }

  return undefined;
}

const logInfo = (rid, message, extra) => log(rid, "info", message, extra);
const logWarn = (rid, message, extra) => log(rid, "warn", message, extra);
const logError = (rid, message, error) => log(rid, "error", message, error);

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
    details = null,
    adminHint = null,
    error = null,
  }
) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...(rid ? { rid } : {}),
    ...(details ? { details } : {}),
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
   Helpers
─────────────────────────────────────────────────────────────── */

function createHttpError(message, status = 400, code = "REQUISICAO_INVALIDA") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function assertOrThrow(
  condition,
  message,
  status = 400,
  code = "REQUISICAO_INVALIDA"
) {
  if (!condition) {
    throw createHttpError(message, status, code);
  }
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toPositiveIntArray(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => {
          if (item && typeof item === "object") {
            return item.usuario_id || item.id;
          }

          return item;
        })
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateOnly(value) {
  if (typeof value !== "string") return null;

  const s = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  return null;
}

function normalizeTime(value, fallback = null) {
  if (typeof value !== "string") return fallback;

  const s = value.trim();

  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);

  return fallback;
}

function minutesBetween(horarioInicio, horarioFim) {
  const inicio = normalizeTime(horarioInicio);
  const fim = normalizeTime(horarioFim);

  if (!inicio || !fim) return 0;

  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);

  if (![h1, m1, h2, m2].every(Number.isFinite)) return 0;

  return h2 * 60 + m2 - (h1 * 60 + m1);
}

function calcularCargaHoraria(datas = []) {
  let totalMinutos = 0;

  for (const item of datas || []) {
    const minutos = minutesBetween(item?.horario_inicio, item?.horario_fim);

    if (minutos > 0) {
      totalMinutos += minutos >= 360 ? minutos - 60 : minutos;
    }
  }

  return Math.max(1, Math.round(totalMinutos / 60));
}

function ordenarDatas(datas = []) {
  return [...datas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

function validarDatasPayload(datas) {
  if (!Array.isArray(datas) || datas.length === 0) {
    return "Informe ao menos uma data para a turma.";
  }

  const datasNormalizadas = [];

  for (const item of datas) {
    const data = normalizeDateOnly(item?.data);
    const horarioInicio = normalizeTime(item?.horario_inicio);
    const horarioFim = normalizeTime(item?.horario_fim);

    if (!data) return "Campo data deve estar em formato YYYY-MM-DD.";
    if (!horarioInicio) return "Campo horario_inicio deve estar em HH:mm.";
    if (!horarioFim) return "Campo horario_fim deve estar em HH:mm.";

    if (horarioFim <= horarioInicio) {
      return "horario_fim deve ser maior que horario_inicio.";
    }

    datasNormalizadas.push({
      data,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    });
  }

  const unicas = new Set(datasNormalizadas.map((item) => item.data));

  if (unicas.size !== datasNormalizadas.length) {
    return "Há datas duplicadas na turma.";
  }

  return "";
}

function normalizeDatasPayload(datas = []) {
  return ordenarDatas(
    (Array.isArray(datas) ? datas : [])
      .map((item) => ({
        data: normalizeDateOnly(item?.data),
        horario_inicio: normalizeTime(item?.horario_inicio),
        horario_fim: normalizeTime(item?.horario_fim),
      }))
      .filter((item) => item.data && item.horario_inicio && item.horario_fim)
  );
}

function normalizarVia(value) {
  const via = String(value || VIA_DATAS).trim().toLowerCase();

  if (!VIAS_PERMITIDAS.has(via)) return VIA_DATAS;

  return via;
}

function dedupeDatas(rows = []) {
  const seen = new Set();
  const out = [];

  for (const row of rows || []) {
    const data = normalizeDateOnly(row?.data);
    const horarioInicio = normalizeTime(row?.horario_inicio, "00:00");
    const horarioFim = normalizeTime(row?.horario_fim, "23:59");

    if (!data || seen.has(data)) continue;

    seen.add(data);

    out.push({
      data,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    });
  }

  return out.sort((a, b) => a.data.localeCompare(b.data));
}

function localNowSql() {
  return `NOW() AT TIME ZONE '${TZ}'`;
}

function normalizarPalestrantesPayload(value) {
  if (!Array.isArray(value)) return [];

  const out = [];

  for (const item of value) {
    if (typeof item === "string") {
      const nome = item.trim();

      if (nome) {
        out.push({
          nome,
          usuario_id: null,
        });
      }

      continue;
    }

    if (item && typeof item === "object") {
      const nome = String(item.nome || "").trim();
      const usuarioId = toPositiveInt(item.usuario_id || item.id);

      if (nome || usuarioId) {
        out.push({
          nome: nome || null,
          usuario_id: usuarioId || null,
        });
      }
    }
  }

  return out;
}

function normalizarAssinantesObrigatorios(assinantes = []) {
  const ids = toPositiveIntArray(assinantes);
  const pediuFabio = ids.includes(FABIO_LOPEZ_ID);

  const selecionados = ids.filter(
    (id) => id !== RAFAELLA_PITOL_ID && id !== FABIO_LOPEZ_ID
  );

  const base = selecionados.slice(0, pediuFabio ? 1 : 2);

  if (pediuFabio) {
    return [...base, RAFAELLA_PITOL_ID, FABIO_LOPEZ_ID];
  }

  return [...base, RAFAELLA_PITOL_ID];
}

function montarResumoDatas(datas) {
  const normalizadas = normalizeDatasPayload(datas);

  return {
    data_inicio: normalizadas[0]?.data || null,
    data_fim: normalizadas.at(-1)?.data || null,
    horario_inicio: normalizadas[0]?.horario_inicio || null,
    horario_fim: normalizadas[0]?.horario_fim || null,
    carga_horaria: calcularCargaHoraria(normalizadas),
    datas: normalizadas,
  };
}

/* ───────────────────────────────────────────────────────────────
   Leitura base
─────────────────────────────────────────────────────────────── */

async function carregarTurmaBase(turmaId) {
  const result = await dbQuery(
    `
    SELECT
      id,
      evento_id,
      nome,
      to_char(data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(data_fim::date, 'YYYY-MM-DD') AS data_fim,
      to_char(horario_inicio, 'HH24:MI') AS horario_inicio,
      to_char(horario_fim, 'HH24:MI') AS horario_fim,
      vagas_total,
      carga_horaria
    FROM turmas
    WHERE id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return result.rows?.[0] || null;
}

async function carregarDatasOficiais(turmaId) {
  const result = await dbQuery(
    `
    SELECT
      to_char(dt.data::date, 'YYYY-MM-DD') AS data,
      to_char(
        COALESCE(dt.horario_inicio, t.horario_inicio, '00:00'::time),
        'HH24:MI'
      ) AS horario_inicio,
      to_char(
        COALESCE(dt.horario_fim, t.horario_fim, '23:59'::time),
        'HH24:MI'
      ) AS horario_fim
    FROM datas_turma dt
    JOIN turmas t ON t.id = dt.turma_id
    WHERE dt.turma_id = $1
    ORDER BY dt.data ASC
    `,
    [turmaId]
  );

  return dedupeDatas(result.rows || []);
}

async function carregarDatasPorPresenca(turmaId) {
  const result = await dbQuery(
    `
    SELECT DISTINCT
      to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(t.horario_fim, '23:59'::time), 'HH24:MI') AS horario_fim
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    WHERE p.turma_id = $1
    ORDER BY 1 ASC
    `,
    [turmaId]
  );

  return dedupeDatas(result.rows || []);
}

async function carregarDatasPorIntervalo(turmaBase) {
  if (!turmaBase?.data_inicio || !turmaBase?.data_fim) {
    throw createHttpError(
      "Turma sem data_inicio/data_fim configuradas.",
      409,
      "TURMA_SEM_INTERVALO"
    );
  }

  const result = await dbQuery(
    `
    WITH t AS (
      SELECT
        $1::date AS data_inicio,
        $2::date AS data_fim,
        $3::time AS horario_inicio,
        $4::time AS horario_fim
    )
    SELECT
      to_char(gs::date, 'YYYY-MM-DD') AS data,
      to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
      to_char(t.horario_fim, 'HH24:MI') AS horario_fim
    FROM t,
    generate_series(t.data_inicio, t.data_fim, interval '1 day') AS gs
    ORDER BY 1 ASC
    `,
    [
      turmaBase.data_inicio,
      turmaBase.data_fim,
      turmaBase.horario_inicio || "00:00",
      turmaBase.horario_fim || "23:59",
    ]
  );

  return dedupeDatas(result.rows || []);
}

async function resolverDatasTurma(turmaId, via = VIA_DATAS, rid = null) {
  const turmaBase = await carregarTurmaBase(turmaId);

  if (!turmaBase) {
    throw createHttpError("Turma não encontrada.", 404, "TURMA_NAO_ENCONTRADA");
  }

  let data = [];
  let source = "";

  if (via === VIA_INTERVALO) {
    data = await carregarDatasPorIntervalo(turmaBase);
    source = "intervalo";

    logInfo(rid || mkRid(), "resolverDatasTurma via=intervalo", {
      turma_id: turmaId,
      total: data.length,
    });

    return { data, source, turma: turmaBase };
  }

  if (via === VIA_PRESENCAS) {
    data = await carregarDatasPorPresenca(turmaId);
    source = "presencas";

    if (!data.length) {
      data = await carregarDatasPorIntervalo(turmaBase);
      source = "intervalo";
    }

    return { data, source, turma: turmaBase };
  }

  data = await carregarDatasOficiais(turmaId);
  source = "datas_turma";

  if (!data.length) {
    data = await carregarDatasPorPresenca(turmaId);
    source = data.length ? "presencas" : "intervalo";

    if (!data.length) {
      data = await carregarDatasPorIntervalo(turmaBase);
    }
  }

  return { data, source, turma: turmaBase };
}

async function validarUsuariosOrganizadorOuAdministrador(client, usuarioIds = []) {
  const ids = toPositiveIntArray(usuarioIds);

  if (!ids.length) return [];

  const result = await client.query(
    `
    SELECT id, nome, email, perfil
    FROM usuarios
    WHERE id = ANY($1::int[])
    ORDER BY nome ASC
    `,
    [ids]
  );

  const encontrados = result.rows || [];
  const encontradosIds = new Set(encontrados.map((row) => Number(row.id)));

  const ausentes = ids.filter((id) => !encontradosIds.has(Number(id)));

  if (ausentes.length) {
    throw createHttpError(
      `Usuário(s) não encontrado(s): ${ausentes.join(", ")}.`,
      400,
      "USUARIO_RESPONSAVEL_NAO_ENCONTRADO"
    );
  }

  const invalidos = encontrados.filter(
    (row) => !PERFIS_RESPONSAVEIS_VALIDOS.has(String(row.perfil || ""))
  );

  if (invalidos.length) {
    throw createHttpError(
      "Organizadores, palestrantes vinculados e assinantes devem ser usuários com perfil organizador ou administrador.",
      400,
      "USUARIO_RESPONSAVEL_PERFIL_INVALIDO"
    );
  }

  return encontrados;
}

async function carregarOrganizadoresDaTurma(turmaId) {
  const result = await dbQuery(
    `
    SELECT
      u.id,
      u.nome,
      u.email,
      u.perfil
    FROM turma_responsavel tr
    JOIN usuarios u ON u.id = tr.usuario_id
    WHERE tr.turma_id = $1
      AND tr.papel = $2
    ORDER BY u.nome ASC
    `,
    [turmaId, PAPEL_ORGANIZADOR]
  );

  return result.rows || [];
}

async function carregarPalestrantesDaTurma(turmaId) {
  const result = await dbQuery(
    `
    SELECT
      id,
      turma_id,
      nome,
      usuario_id
    FROM turma_palestrante
    WHERE turma_id = $1
    ORDER BY nome ASC, id ASC
    `,
    [turmaId]
  );

  return result.rows || [];
}

async function carregarAssinantesDaTurma(turmaId) {
  const result = await dbQuery(
    `
    SELECT
      tca.id,
      tca.turma_id,
      tca.usuario_id,
      tca.ordem,
      u.nome,
      u.email,
      u.perfil
    FROM turma_certificado_assinante tca
    JOIN usuarios u ON u.id = tca.usuario_id
    WHERE tca.turma_id = $1
    ORDER BY tca.ordem ASC
    `,
    [turmaId]
  );

  return result.rows || [];
}

async function carregarInscritosPorTurmas(turmaIds = []) {
  if (!turmaIds.length) return new Map();

  const result = await dbQuery(
    `
    SELECT turma_id, COUNT(*)::int AS total
    FROM inscricoes
    WHERE turma_id = ANY($1::int[])
    GROUP BY turma_id
    `,
    [turmaIds]
  );

  const map = new Map();

  for (const row of result.rows || []) {
    map.set(Number(row.turma_id), Number(row.total || 0));
  }

  return map;
}

async function carregarOrganizadoresPorTurmas(turmaIds = []) {
  if (!turmaIds.length) return new Map();

  const result = await dbQuery(
    `
    SELECT
      tr.turma_id,
      u.id,
      u.nome,
      u.email,
      u.perfil
    FROM turma_responsavel tr
    JOIN usuarios u ON u.id = tr.usuario_id
    WHERE tr.turma_id = ANY($1::bigint[])
      AND tr.papel = $2
    ORDER BY tr.turma_id, u.nome ASC
    `,
    [turmaIds, PAPEL_ORGANIZADOR]
  );

  const map = new Map();

  for (const row of result.rows || []) {
    const turmaId = Number(row.turma_id);
    const arr = map.get(turmaId) || [];

    arr.push({
      id: Number(row.id),
      nome: row.nome,
      email: row.email,
      perfil: row.perfil,
    });

    map.set(turmaId, arr);
  }

  return map;
}

async function carregarPalestrantesPorTurmas(turmaIds = []) {
  if (!turmaIds.length) return new Map();

  const result = await dbQuery(
    `
    SELECT
      id,
      turma_id,
      nome,
      usuario_id
    FROM turma_palestrante
    WHERE turma_id = ANY($1::bigint[])
    ORDER BY turma_id, nome ASC, id ASC
    `,
    [turmaIds]
  );

  const map = new Map();

  for (const row of result.rows || []) {
    const turmaId = Number(row.turma_id);
    const arr = map.get(turmaId) || [];

    arr.push({
      id: Number(row.id),
      nome: row.nome,
      usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
    });

    map.set(turmaId, arr);
  }

  return map;
}

async function carregarAssinantesPorTurmas(turmaIds = []) {
  if (!turmaIds.length) return new Map();

  const result = await dbQuery(
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
    WHERE tca.turma_id = ANY($1::bigint[])
    ORDER BY tca.turma_id, tca.ordem ASC
    `,
    [turmaIds]
  );

  const map = new Map();

  for (const row of result.rows || []) {
    const turmaId = Number(row.turma_id);
    const arr = map.get(turmaId) || [];

    arr.push({
      id: Number(row.usuario_id),
      usuario_id: Number(row.usuario_id),
      nome: row.nome,
      email: row.email,
      perfil: row.perfil,
      ordem: Number(row.ordem),
    });

    map.set(turmaId, arr);
  }

  return map;
}

async function carregarDatasPorTurmas(turmaIds = []) {
  if (!turmaIds.length) return new Map();

  const result = await dbQuery(
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
  );

  const map = new Map();

  for (const row of result.rows || []) {
    const turmaId = Number(row.turma_id);
    const arr = map.get(turmaId) || [];

    arr.push({
      data: row.data,
      horario_inicio: row.horario_inicio,
      horario_fim: row.horario_fim,
    });

    map.set(turmaId, arr);
  }

  return map;
}

function montarTurmaResposta({
  turma,
  datas = [],
  organizadores = [],
  palestrantes = [],
  assinantes = [],
  inscritos = 0,
}) {
  const datasOrdenadas = dedupeDatas(datas);
  const vagasTotal = Number(turma?.vagas_total || 0);

  return {
    id: Number(turma.id),
    evento_id: Number(turma.evento_id),
    nome: turma.nome,
    evento_titulo: turma.evento_titulo || null,

    data_inicio: datasOrdenadas[0]?.data || turma.data_inicio || null,
    data_fim: datasOrdenadas.at(-1)?.data || turma.data_fim || null,
    horario_inicio:
      datasOrdenadas[0]?.horario_inicio || turma.horario_inicio || null,
    horario_fim: datasOrdenadas[0]?.horario_fim || turma.horario_fim || null,

    vagas_total: vagasTotal,
    carga_horaria: Number(turma.carga_horaria || 0),

    organizadores,
    palestrantes,
    assinantes,

    datas: datasOrdenadas,
    datas_count: datasOrdenadas.length,

    inscritos: Number(inscritos || 0),
    vagas_preenchidas: Number(inscritos || 0),
    vagas_disponiveis: Math.max(vagasTotal - Number(inscritos || 0), 0),
  };
}

/* ───────────────────────────────────────────────────────────────
   Persistência auxiliar
─────────────────────────────────────────────────────────────── */

async function salvarDatasTurma(client, turmaId, datas) {
  const erro = validarDatasPayload(datas);
  if (erro) throw createHttpError(erro, 400, "TURMA_DATA_INVALIDA");

  const normalizadas = normalizeDatasPayload(datas);

  await client.query(`DELETE FROM datas_turma WHERE turma_id = $1`, [turmaId]);

  for (const item of normalizadas) {
    await client.query(
      `
      INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
      `,
      [turmaId, item.data, item.horario_inicio, item.horario_fim]
    );
  }

  return normalizadas;
}

async function salvarResponsaveisTurma(client, turmaId, organizadores) {
  const organizadorIds = toPositiveIntArray(organizadores);

  if (!organizadorIds.length) {
    throw createHttpError(
      "Informe ao menos um organizador para a turma.",
      400,
      "TURMA_SEM_ORGANIZADOR"
    );
  }

  await validarUsuariosOrganizadorOuAdministrador(client, organizadorIds);

  await client.query(
    `
    DELETE FROM turma_responsavel
    WHERE turma_id = $1
      AND papel = $2
    `,
    [turmaId, PAPEL_ORGANIZADOR]
  );

  for (const organizadorId of organizadorIds) {
    await client.query(
      `
      INSERT INTO turma_responsavel (
        turma_id,
        usuario_id,
        papel
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (turma_id, usuario_id, papel)
      DO NOTHING
      `,
      [turmaId, organizadorId, PAPEL_ORGANIZADOR]
    );
  }

  return organizadorIds;
}

async function salvarPalestrantesTurma(client, turmaId, palestrantes) {
  const payload = normalizarPalestrantesPayload(palestrantes);

  const usuariosVinculados = payload
    .map((item) => item.usuario_id)
    .filter(Boolean);

  if (usuariosVinculados.length) {
    await validarUsuariosOrganizadorOuAdministrador(client, usuariosVinculados);
  }

  await client.query(`DELETE FROM turma_palestrante WHERE turma_id = $1`, [
    turmaId,
  ]);

  for (const item of payload) {
    let nome = item.nome;

    if (!nome && item.usuario_id) {
      const usuario = await client.query(
        `
        SELECT nome
        FROM usuarios
        WHERE id = $1
        LIMIT 1
        `,
        [item.usuario_id]
      );

      nome = usuario.rows?.[0]?.nome || null;
    }

    if (!nome) continue;

    await client.query(
      `
      INSERT INTO turma_palestrante (
        turma_id,
        nome,
        usuario_id
      )
      VALUES ($1, $2, $3)
      `,
      [turmaId, nome, item.usuario_id || null]
    );
  }

  return payload;
}

async function salvarAssinantesTurma(client, turmaId, assinantes) {
  const assinantesFinais = normalizarAssinantesObrigatorios(assinantes);

  if (!assinantesFinais.includes(RAFAELLA_PITOL_ID)) {
    throw createHttpError(
      "Rafaella Pitol deve compor obrigatoriamente a lista de assinantes.",
      400,
      "RAFAELLA_ASSINATURA_OBRIGATORIA"
    );
  }

  if (assinantesFinais.length < 1 || assinantesFinais.length > 3) {
    throw createHttpError(
      "A turma deve ter de 1 a 3 assinantes.",
      400,
      "TURMA_ASSINANTES_QUANTIDADE_INVALIDA"
    );
  }

  await validarUsuariosOrganizadorOuAdministrador(client, assinantesFinais);

  await client.query(
    `DELETE FROM turma_certificado_assinante WHERE turma_id = $1`,
    [turmaId]
  );

  for (let index = 0; index < assinantesFinais.length; index += 1) {
    await client.query(
      `
      INSERT INTO turma_certificado_assinante (
        turma_id,
        usuario_id,
        ordem
      )
      VALUES ($1, $2, $3)
      `,
      [turmaId, assinantesFinais[index], index + 1]
    );
  }

  return assinantesFinais;
}

/* ───────────────────────────────────────────────────────────────
   CRUD
─────────────────────────────────────────────────────────────── */

async function criar(req, res) {
  const rid = reqRid(req);
  const client = await pool.connect();

  try {
    const body = req.body || {};

    const eventoId = toPositiveInt(body.evento_id);
    const nome = String(body.nome || "").trim();
    const vagasTotal = toPositiveInt(body.vagas_total);
    const organizadores = toPositiveIntArray(body.organizadores);
    const palestrantes = normalizarPalestrantesPayload(body.palestrantes);
    const assinantes = toPositiveIntArray(body.assinantes);
    const datas = normalizeDatasPayload(body.datas);

    logInfo(rid, "criar:start", {
      evento_id: eventoId,
      nome_length: nome.length,
      datas: datas.length,
      organizadores: organizadores.length,
      palestrantes: palestrantes.length,
      assinantes: assinantes.length,
    });

    assertOrThrow(eventoId, "evento_id é obrigatório.", 400, "EVENTO_ID_OBRIGATORIO");
    assertOrThrow(nome, "nome é obrigatório.", 400, "TURMA_NOME_OBRIGATORIO");
    assertOrThrow(
      nome.length <= LIMITE_NOME_TURMA,
      `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres.`,
      422,
      "TURMA_NOME_MUITO_LONGO"
    );
    assertOrThrow(
      vagasTotal,
      "vagas_total é obrigatório.",
      400,
      "TURMA_VAGAS_OBRIGATORIAS"
    );

    const erroDatas = validarDatasPayload(datas);
    assertOrThrow(!erroDatas, erroDatas, 400, "TURMA_DATA_INVALIDA");

    await client.query("BEGIN");

    const eventoCheck = await client.query(
      `
      SELECT id
      FROM eventos
      WHERE id = $1
      LIMIT 1
      `,
      [eventoId]
    );

    if (!eventoCheck.rowCount) {
      throw createHttpError("Evento não encontrado.", 404, "EVENTO_NAO_ENCONTRADO");
    }

    const resumo = montarResumoDatas(datas);

    const insert = await client.query(
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
        eventoId,
        nome,
        resumo.data_inicio,
        resumo.data_fim,
        resumo.horario_inicio,
        resumo.horario_fim,
        vagasTotal,
        resumo.carga_horaria,
      ]
    );

    const turmaId = Number(insert.rows[0]?.id);

    if (!turmaId) {
      throw createHttpError(
        "Falha ao criar turma: id não retornado.",
        500,
        "TURMA_ID_NAO_RETORNADO"
      );
    }

    await salvarDatasTurma(client, turmaId, datas);
    await salvarResponsaveisTurma(client, turmaId, organizadores);
    await salvarPalestrantesTurma(client, turmaId, palestrantes);
    await salvarAssinantesTurma(client, turmaId, assinantes);

    await client.query("COMMIT");

    logInfo(rid, "criar:ok", {
      turma_id: turmaId,
      evento_id: eventoId,
    });

    return sendOk(res, {
      status: 201,
      message: "Turma criada com sucesso.",
      data: {
        id: turmaId,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "criar erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "TURMA_CRIAR_ERRO",
      message: error.status ? error.message : "Erro ao criar turma.",
      rid,
      error,
    });
  } finally {
    client.release();
  }
}

async function atualizar(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);
  const client = await pool.connect();

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const body = req.body || {};

    const nome =
      typeof body.nome === "undefined" ? undefined : String(body.nome || "").trim();

    const vagasTotal =
      typeof body.vagas_total === "undefined"
        ? undefined
        : toPositiveInt(body.vagas_total);

    const veioDatas = Array.isArray(body.datas);
    const datas = veioDatas ? normalizeDatasPayload(body.datas) : null;

    const veioOrganizadores = Array.isArray(body.organizadores);
    const organizadores = veioOrganizadores
      ? toPositiveIntArray(body.organizadores)
      : null;

    const veioPalestrantes = Array.isArray(body.palestrantes);
    const palestrantes = veioPalestrantes
      ? normalizarPalestrantesPayload(body.palestrantes)
      : null;

    const veioAssinantes = Array.isArray(body.assinantes);
    const assinantes = veioAssinantes ? toPositiveIntArray(body.assinantes) : null;

    logInfo(rid, "atualizar:start", {
      turma_id: turmaId,
      veio_nome: typeof nome !== "undefined",
      veio_vagas: typeof vagasTotal !== "undefined",
      veio_datas: veioDatas,
      veio_organizadores: veioOrganizadores,
      veio_palestrantes: veioPalestrantes,
      veio_assinantes: veioAssinantes,
    });

    if (typeof nome !== "undefined") {
      assertOrThrow(nome, "nome não pode ficar vazio.", 400, "TURMA_NOME_INVALIDO");
      assertOrThrow(
        nome.length <= LIMITE_NOME_TURMA,
        `O nome da turma pode ter no máximo ${LIMITE_NOME_TURMA} caracteres.`,
        422,
        "TURMA_NOME_MUITO_LONGO"
      );
    }

    if (typeof body.vagas_total !== "undefined") {
      assertOrThrow(vagasTotal, "vagas_total inválido.", 400, "TURMA_VAGAS_INVALIDAS");
    }

    if (veioDatas) {
      const erroDatas = validarDatasPayload(datas);
      assertOrThrow(!erroDatas, erroDatas, 400, "TURMA_DATA_INVALIDA");
    }

    await client.query("BEGIN");

    const exists = await client.query(
      `
      SELECT id
      FROM turmas
      WHERE id = $1
      FOR UPDATE
      `,
      [turmaId]
    );

    if (!exists.rowCount) {
      throw createHttpError("Turma não encontrada.", 404, "TURMA_NAO_ENCONTRADA");
    }

    const setCols = [];
    const params = [turmaId];

    function addSet(column, value) {
      params.push(value);
      setCols.push(`${column} = $${params.length}`);
    }

    if (typeof nome !== "undefined") addSet("nome", nome);
    if (typeof vagasTotal !== "undefined") addSet("vagas_total", vagasTotal);

    if (veioDatas) {
      const resumo = montarResumoDatas(datas);

      addSet("data_inicio", resumo.data_inicio);
      addSet("data_fim", resumo.data_fim);
      addSet("horario_inicio", resumo.horario_inicio);
      addSet("horario_fim", resumo.horario_fim);
      addSet("carga_horaria", resumo.carga_horaria);
    }

    if (setCols.length) {
      await client.query(
        `
        UPDATE turmas
        SET ${setCols.join(", ")}
        WHERE id = $1
        `,
        params
      );
    }

    if (veioDatas) {
      await salvarDatasTurma(client, turmaId, datas);
    }

    if (veioOrganizadores) {
      await salvarResponsaveisTurma(client, turmaId, organizadores);
    }

    if (veioPalestrantes) {
      await salvarPalestrantesTurma(client, turmaId, palestrantes);
    }

    if (veioAssinantes) {
      await salvarAssinantesTurma(client, turmaId, assinantes);
    }

    await client.query("COMMIT");

    logInfo(rid, "atualizar:ok", {
      turma_id: turmaId,
    });

    return sendOk(res, {
      message: "Turma atualizada com sucesso.",
      data: {
        id: turmaId,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "atualizar erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "TURMA_ATUALIZAR_ERRO",
      message: error.status ? error.message : "Erro ao atualizar turma.",
      rid,
      error,
    });
  } finally {
    client.release();
  }
}

async function obter(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const turma = await carregarTurmaBase(turmaId);

    if (!turma) {
      return sendError(res, {
        status: 404,
        code: "TURMA_NAO_ENCONTRADA",
        message: "Turma não encontrada.",
        rid,
      });
    }

    const [datas, organizadores, palestrantes, assinantes, inscritosMap] =
      await Promise.all([
        carregarDatasOficiais(turmaId),
        carregarOrganizadoresDaTurma(turmaId),
        carregarPalestrantesDaTurma(turmaId),
        carregarAssinantesDaTurma(turmaId),
        carregarInscritosPorTurmas([turmaId]),
      ]);

    const payload = montarTurmaResposta({
      turma,
      datas,
      organizadores,
      palestrantes,
      assinantes,
      inscritos: inscritosMap.get(turmaId) || 0,
    });

    return sendOk(res, {
      message: "Turma carregada.",
      data: payload,
    });
  } catch (error) {
    logError(rid, "obter erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_OBTER_ERRO",
      message: "Erro ao obter turma.",
      rid,
      error,
    });
  }
}

async function excluir(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);
  const client = await pool.connect();

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    await client.query("BEGIN");

    const exists = await client.query(
      `
      SELECT id
      FROM turmas
      WHERE id = $1
      FOR UPDATE
      `,
      [turmaId]
    );

    if (!exists.rowCount) {
      throw createHttpError("Turma não encontrada.", 404, "TURMA_NAO_ENCONTRADA");
    }

    const uso = await client.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM inscricoes WHERE turma_id = $1) AS inscricoes,
        (SELECT COUNT(*)::int FROM presencas WHERE turma_id = $1) AS presencas,
        (SELECT COUNT(*)::int FROM certificados WHERE turma_id = $1) AS certificados
      `,
      [turmaId]
    );

    const contagens = uso.rows[0] || {};

    if (
      Number(contagens.inscricoes || 0) > 0 ||
      Number(contagens.presencas || 0) > 0 ||
      Number(contagens.certificados || 0) > 0
    ) {
      throw createHttpError(
        "Turma possui inscrições, presenças ou certificados e não pode ser excluída fisicamente.",
        409,
        "TURMA_COM_HISTORICO"
      );
    }

    await client.query(`DELETE FROM turma_certificado_assinante WHERE turma_id = $1`, [
      turmaId,
    ]);
    await client.query(`DELETE FROM turma_palestrante WHERE turma_id = $1`, [
      turmaId,
    ]);
    await client.query(`DELETE FROM turma_responsavel WHERE turma_id = $1`, [
      turmaId,
    ]);
    await client.query(`DELETE FROM datas_turma WHERE turma_id = $1`, [turmaId]);
    await client.query(`DELETE FROM turmas WHERE id = $1`, [turmaId]);

    await client.query("COMMIT");

    return sendOk(res, {
      message: "Turma excluída com sucesso.",
      data: {
        id: turmaId,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "excluir erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "TURMA_EXCLUIR_ERRO",
      message: error.status ? error.message : "Erro ao excluir turma.",
      rid,
      details:
        error.code === "TURMA_COM_HISTORICO"
          ? {
              regra:
                "Turmas com histórico operacional devem ser preservadas para auditoria.",
            }
          : null,
      error,
    });
  } finally {
    client.release();
  }
}

/* ───────────────────────────────────────────────────────────────
   Listagens
─────────────────────────────────────────────────────────────── */

async function listarPorEvento(req, res) {
  const rid = reqRid(req);
  const eventoId = toPositiveInt(req.params.id);

  if (!eventoId) {
    return sendError(res, {
      status: 400,
      code: "EVENTO_ID_INVALIDO",
      message: "evento_id inválido.",
      rid,
    });
  }

  try {
    const result = await dbQuery(
      `
      SELECT
        t.id,
        t.evento_id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim, 'HH24:MI') AS horario_fim,
        t.vagas_total,
        t.carga_horaria,
        e.titulo AS evento_titulo
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.horario_inicio NULLS LAST, t.id
      `,
      [eventoId]
    );

    const turmas = result.rows || [];
    const turmaIds = turmas.map((turma) => Number(turma.id));

    const [
      datasMap,
      organizadoresMap,
      palestrantesMap,
      assinantesMap,
      inscritosMap,
    ] = await Promise.all([
      carregarDatasPorTurmas(turmaIds),
      carregarOrganizadoresPorTurmas(turmaIds),
      carregarPalestrantesPorTurmas(turmaIds),
      carregarAssinantesPorTurmas(turmaIds),
      carregarInscritosPorTurmas(turmaIds),
    ]);

    const data = turmas.map((turma) =>
      montarTurmaResposta({
        turma,
        datas: datasMap.get(Number(turma.id)) || [],
        organizadores: organizadoresMap.get(Number(turma.id)) || [],
        palestrantes: palestrantesMap.get(Number(turma.id)) || [],
        assinantes: assinantesMap.get(Number(turma.id)) || [],
        inscritos: inscritosMap.get(Number(turma.id)) || 0,
      })
    );

    return sendOk(res, {
      message: "Turmas do evento carregadas.",
      data,
      meta: {
        evento_id: eventoId,
        total: data.length,
      },
    });
  } catch (error) {
    logError(rid, "listarPorEvento erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_LISTAR_POR_EVENTO_ERRO",
      message: "Erro ao listar turmas do evento.",
      rid,
      error,
    });
  }
}

async function listarPorEventoSimples(req, res) {
  const rid = reqRid(req);
  const eventoId = toPositiveInt(req.params.id);

  if (!eventoId) {
    return sendError(res, {
      status: 400,
      code: "EVENTO_ID_INVALIDO",
      message: "evento_id inválido.",
      rid,
    });
  }

  try {
    const result = await dbQuery(
      `
      SELECT
        t.id,
        t.evento_id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim, 'HH24:MI') AS horario_fim,
        t.vagas_total,
        t.carga_horaria,
        COALESCE((SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id), 0) AS inscritos,
        COALESCE((SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id), 0) AS datas_count,
        COALESCE((
          SELECT json_agg(json_build_object(
            'data', to_char(dt.data, 'YYYY-MM-DD'),
            'horario_inicio', to_char(dt.horario_inicio, 'HH24:MI'),
            'horario_fim', to_char(dt.horario_fim, 'HH24:MI')
          ) ORDER BY dt.data)
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ), '[]'::json) AS datas,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', u.id,
            'nome', u.nome,
            'email', u.email,
            'perfil', u.perfil
          ) ORDER BY u.nome)
          FROM turma_responsavel tr
          JOIN usuarios u ON u.id = tr.usuario_id
          WHERE tr.turma_id = t.id
            AND tr.papel = 'organizador'
        ), '[]'::json) AS organizadores,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', tp.id,
            'nome', tp.nome,
            'usuario_id', tp.usuario_id
          ) ORDER BY tp.nome, tp.id)
          FROM turma_palestrante tp
          WHERE tp.turma_id = t.id
        ), '[]'::json) AS palestrantes,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', u.id,
            'usuario_id', u.id,
            'nome', u.nome,
            'email', u.email,
            'perfil', u.perfil,
            'ordem', tca.ordem
          ) ORDER BY tca.ordem)
          FROM turma_certificado_assinante tca
          JOIN usuarios u ON u.id = tca.usuario_id
          WHERE tca.turma_id = t.id
        ), '[]'::json) AS assinantes
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.horario_inicio NULLS LAST, t.id
      `,
      [eventoId]
    );

    const data = (result.rows || []).map((turma) => {
      const organizadores = Array.isArray(turma.organizadores)
        ? turma.organizadores
        : [];
      const palestrantes = Array.isArray(turma.palestrantes)
        ? turma.palestrantes
        : [];
      const assinantes = Array.isArray(turma.assinantes) ? turma.assinantes : [];
      const datas = Array.isArray(turma.datas) ? turma.datas : [];

      return montarTurmaResposta({
        turma,
        datas,
        organizadores,
        palestrantes,
        assinantes,
        inscritos: Number(turma.inscritos || 0),
      });
    });

    return sendOk(res, {
      message: "Turmas simples do evento carregadas.",
      data,
      meta: {
        evento_id: eventoId,
        total: data.length,
      },
    });
  } catch (error) {
    logError(rid, "listarPorEventoSimples erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_LISTAR_SIMPLES_ERRO",
      message: "Erro ao listar turmas simples do evento.",
      rid,
      error,
    });
  }
}

async function listarAdmin(req, res) {
  const rid = reqRid(req);

  try {
    const result = await dbQuery(
      `
      WITH organizadores_por_turma AS (
        SELECT
          tr.turma_id,
          COALESCE(
            json_agg(
              json_build_object(
                'id', u.id,
                'nome', u.nome,
                'email', u.email,
                'perfil', u.perfil
              )
              ORDER BY u.nome
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) AS organizadores
        FROM turma_responsavel tr
        JOIN usuarios u ON u.id = tr.usuario_id
        WHERE tr.papel = 'organizador'
        GROUP BY tr.turma_id
      ),
      palestrantes_por_turma AS (
        SELECT
          tp.turma_id,
          COALESCE(
            json_agg(
              json_build_object(
                'id', tp.id,
                'nome', tp.nome,
                'usuario_id', tp.usuario_id
              )
              ORDER BY tp.nome, tp.id
            ),
            '[]'::json
          ) AS palestrantes
        FROM turma_palestrante tp
        GROUP BY tp.turma_id
      ),
      assinantes_por_turma AS (
        SELECT
          tca.turma_id,
          COALESCE(
            json_agg(
              json_build_object(
                'id', u.id,
                'usuario_id', u.id,
                'nome', u.nome,
                'email', u.email,
                'perfil', u.perfil,
                'ordem', tca.ordem
              )
              ORDER BY tca.ordem
            ),
            '[]'::json
          ) AS assinantes
        FROM turma_certificado_assinante tca
        JOIN usuarios u ON u.id = tca.usuario_id
        GROUP BY tca.turma_id
      ),
      inscricoes_por_turma AS (
        SELECT
          turma_id,
          COUNT(*)::int AS vagas_ocupadas
        FROM inscricoes
        GROUP BY turma_id
      )
      SELECT
        t.id,
        t.evento_id,
        t.nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
        to_char(t.horario_fim, 'HH24:MI') AS horario_fim,
        t.vagas_total,
        COALESCE(i.vagas_ocupadas, 0) AS vagas_ocupadas,
        t.carga_horaria,
        e.titulo AS evento_titulo,
        COALESCE(opt.organizadores, '[]'::json) AS organizadores,
        COALESCE(ppt.palestrantes, '[]'::json) AS palestrantes,
        COALESCE(apt.assinantes, '[]'::json) AS assinantes,
        CASE
          WHEN ${localNowSql()} < (t.data_inicio::timestamp + COALESCE(t.horario_inicio, '00:00'::time))
            THEN 'programado'
          WHEN ${localNowSql()} <= (t.data_fim::timestamp + COALESCE(t.horario_fim, '23:59'::time))
            THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN organizadores_por_turma opt ON opt.turma_id = t.id
      LEFT JOIN palestrantes_por_turma ppt ON ppt.turma_id = t.id
      LEFT JOIN assinantes_por_turma apt ON apt.turma_id = t.id
      LEFT JOIN inscricoes_por_turma i ON i.turma_id = t.id
      ORDER BY t.data_inicio ASC NULLS LAST, t.horario_inicio ASC NULLS LAST, t.id ASC
      `
    );

    return sendOk(res, {
      message: "Turmas administrativas carregadas.",
      data: result.rows || [],
      meta: {
        total: result.rows?.length || 0,
      },
    });
  } catch (error) {
    logError(rid, "listarAdmin erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_ADMIN_LISTAR_ERRO",
      message: "Erro ao buscar turmas para o painel administrador.",
      rid,
      error,
    });
  }
}

async function listarComUsuario(req, res) {
  const rid = reqRid(req);

  try {
    const turmasResult = await dbQuery(
      `
      SELECT
        t.id,
        t.evento_id,
        t.nome,
        e.titulo AS titulo_evento,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      ORDER BY t.data_inicio DESC NULLS LAST, t.id DESC
      `
    );

    const turmas = turmasResult.rows || [];
    const turmaIds = turmas.map((turma) => Number(turma.id));

    if (!turmaIds.length) {
      return sendOk(res, {
        message: "Nenhuma turma encontrada.",
        data: [],
        meta: {
          total: 0,
        },
      });
    }

    const inscritosResult = await dbQuery(
      `
      SELECT
        i.turma_id,
        u.id AS usuario_id,
        u.nome,
        u.email,
        u.cpf,
        EXISTS (
          SELECT 1
          FROM presencas p
          WHERE p.usuario_id = u.id
            AND p.turma_id = i.turma_id
            AND p.presente = TRUE
        ) AS presente
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = ANY($1::int[])
      ORDER BY u.nome ASC
      `,
      [turmaIds]
    );

    const usuariosPorTurma = new Map();

    for (const row of inscritosResult.rows || []) {
      const turmaId = Number(row.turma_id);
      const arr = usuariosPorTurma.get(turmaId) || [];

      arr.push({
        id: Number(row.usuario_id),
        nome: row.nome,
        email: row.email,
        cpf: row.cpf,
        presente: row.presente === true,
      });

      usuariosPorTurma.set(turmaId, arr);
    }

    const data = turmas.map((turma) => ({
      id: Number(turma.id),
      evento_id: Number(turma.evento_id),
      nome: turma.nome,
      titulo_evento: turma.titulo_evento,
      data_inicio: turma.data_inicio,
      data_fim: turma.data_fim,
      usuario: usuariosPorTurma.get(Number(turma.id)) || [],
    }));

    return sendOk(res, {
      message: "Turmas com usuários carregadas.",
      data,
      meta: {
        total: data.length,
      },
    });
  } catch (error) {
    logError(rid, "listarComUsuario erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_USUARIO_LISTAR_ERRO",
      message: "Erro ao buscar turmas com usuários.",
      rid,
      error,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Datas / ocorrências
─────────────────────────────────────────────────────────────── */

async function listarDatasDaTurma(req, res) {
  const rid = reqRid(req, "TURMA-DATA");
  const turmaId = toPositiveInt(req.params.id);
  const via = normalizarVia(req.query?.via);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const { data, source } = await resolverDatasTurma(turmaId, via, rid);

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(data.length));
    res.setHeader("X-Datas-Handler", "turmaController:v2:listarDatasDaTurma");
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate");

    return sendOk(res, {
      message: "Datas da turma carregadas.",
      data,
      meta: {
        turma_id: turmaId,
        via,
        source,
        total: data.length,
      },
    });
  } catch (error) {
    logError(rid, "listarDatasDaTurma erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "TURMA_DATA_LISTAR_ERRO",
      message:
        error.status === 404
          ? "Turma não encontrada."
          : error.status === 409
            ? "Turma inválida para geração de datas."
            : "Erro ao buscar datas da turma.",
      rid,
      adminHint:
        error.status === 409
          ? "Verifique se a turma possui datas em datas_turma ou intervalo data_inicio/data_fim."
          : null,
      error,
    });
  }
}

async function listarOcorrenciasTurma(req, res) {
  const rid = reqRid(req, "TURMA-OCORRENCIA");
  const turmaId = toPositiveInt(req.params.id);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const { data, source } = await resolverDatasTurma(turmaId, VIA_DATAS, rid);

    const ocorrencias = Array.from(
      new Set(data.map((item) => item.data).filter(isDateOnly))
    ).sort();

    res.setHeader("X-Datas-Source", source);
    res.setHeader("X-Datas-Count", String(ocorrencias.length));
    res.setHeader("X-Datas-Handler", "turmaController:v2:listarOcorrenciasTurma");
    res.setHeader("Cache-Control", "private, no-cache, must-revalidate");

    return sendOk(res, {
      message: "Ocorrências da turma carregadas.",
      data: ocorrencias,
      meta: {
        turma_id: turmaId,
        source,
        total: ocorrencias.length,
      },
    });
  } catch (error) {
    logError(rid, "listarOcorrenciasTurma erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "TURMA_OCORRENCIA_LISTAR_ERRO",
      message:
        error.status === 404
          ? "Turma não encontrada."
          : error.status === 409
            ? "Turma inválida para geração de ocorrências."
            : "Erro ao buscar ocorrências da turma.",
      rid,
      error,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Organizadores
─────────────────────────────────────────────────────────────── */

async function adicionarOrganizador(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);
  const organizadores = toPositiveIntArray(req.body?.organizadores);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  if (!organizadores.length) {
    return sendError(res, {
      status: 400,
      code: "ORGANIZADOR_LISTA_INVALIDA",
      message: "Lista de organizadores inválida.",
      rid,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const turma = await client.query(
      `
      SELECT id
      FROM turmas
      WHERE id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    if (!turma.rowCount) {
      throw createHttpError("Turma não encontrada.", 404, "TURMA_NAO_ENCONTRADA");
    }

    await validarUsuariosOrganizadorOuAdministrador(client, organizadores);

    let adicionados = 0;

    for (const organizadorId of organizadores) {
      const result = await client.query(
        `
        INSERT INTO turma_responsavel (
          turma_id,
          usuario_id,
          papel
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (turma_id, usuario_id, papel)
        DO NOTHING
        RETURNING turma_id
        `,
        [turmaId, organizadorId, PAPEL_ORGANIZADOR]
      );

      if (result.rowCount) adicionados += 1;
    }

    await client.query("COMMIT");

    return sendOk(res, {
      status: 201,
      message: "Organizador(es) adicionados à turma com sucesso.",
      data: {
        turma_id: turmaId,
        adicionados,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    logError(rid, "adicionarOrganizador erro", error);

    return sendError(res, {
      status: error.status || 500,
      code: error.code || "turma_responsavel_ADICIONAR_ERRO",
      message: error.status ? error.message : "Erro ao adicionar organizador à turma.",
      rid,
      error,
    });
  } finally {
    client.release();
  }
}

async function listarOrganizadores(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const turma = await carregarTurmaBase(turmaId);

    if (!turma) {
      return sendError(res, {
        status: 404,
        code: "TURMA_NAO_ENCONTRADA",
        message: "Turma não encontrada.",
        rid,
      });
    }

    const data = await carregarOrganizadoresDaTurma(turmaId);

    return sendOk(res, {
      message: "Organizadores da turma carregados.",
      data,
      meta: {
        turma_id: turmaId,
        total: data.length,
      },
    });
  } catch (error) {
    logError(rid, "listarOrganizadores erro", error);

    return sendError(res, {
      status: 500,
      code: "turma_responsavel_LISTAR_ERRO",
      message: "Erro ao listar organizadores da turma.",
      rid,
      error,
    });
  }
}

async function obterDetalhe(req, res) {
  const rid = reqRid(req);
  const turmaId = toPositiveInt(req.params.id);

  if (!turmaId) {
    return sendError(res, {
      status: 400,
      code: "TURMA_ID_INVALIDO",
      message: "turma_id inválido.",
      rid,
    });
  }

  try {
    const result = await dbQuery(
      `
      SELECT
        t.id,
        t.evento_id,
        t.nome,
        e.titulo AS titulo_evento,
        COALESCE(
          (
            SELECT string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome)
            FROM turma_responsavel tr
            JOIN usuarios u ON u.id = tr.usuario_id
            WHERE tr.turma_id = t.id
              AND tr.papel = 'organizador'
          ),
          'Organizador não definido'
        ) AS nome_organizador
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    if (!result.rowCount) {
      return sendError(res, {
        status: 404,
        code: "TURMA_NAO_ENCONTRADA",
        message: "Turma não encontrada.",
        rid,
      });
    }

    return sendOk(res, {
      message: "Detalhes da turma carregados.",
      data: result.rows[0],
    });
  } catch (error) {
    logError(rid, "obterDetalhe erro", error);

    return sendError(res, {
      status: 500,
      code: "TURMA_DETALHE_OBTER_ERRO",
      message: "Erro ao obter detalhes da turma.",
      rid,
      error,
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   Exports oficiais
─────────────────────────────────────────────────────────────── */

module.exports = {
  criar,
  atualizar,
  excluir,
  obter,

  listarPorEvento,
  listarPorEventoSimples,
  listarAdmin,
  listarComUsuario,

  listarDatasDaTurma,
  listarOcorrenciasTurma,

  adicionarOrganizador,
  listarOrganizadores,
  obterDetalhe,

  resolverDatasTurma,
  carregarDatasOficiais,
  carregarDatasPorPresenca,
  carregarDatasPorIntervalo,
};