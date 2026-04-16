/* eslint-disable no-console */
"use strict";

// ✅ src/services/eventoAcessoRegistroService.js — PREMIUM/UNIFICADO

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

if (!db || typeof db.query !== "function") {
  console.error("[eventoAcessoRegistroService] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em eventoAcessoRegistroService.js (query ausente)");
}

/* ──────────────────────────────────────────────────────────────
   Modos de restrição
────────────────────────────────────────────────────────────── */
const MODO_TODOS = "todos_servidores"; // precisa ter registro
const MODO_LISTA = "lista_registros"; // registro precisa estar na lista

/* ──────────────────────────────────────────────────────────────
   Motivos padronizados
────────────────────────────────────────────────────────────── */
const MOTIVOS = {
  DADOS_INVALIDOS: "DADOS_INVALIDOS",
  EVENTO_NAO_ENCONTRADO: "EVENTO_NAO_ENCONTRADO",
  USUARIO_NAO_ENCONTRADO: "USUARIO_NAO_ENCONTRADO",
  SEM_REGISTRO: "SEM_REGISTRO",
  REGISTRO_NAO_AUTORIZADO: "REGISTRO_NAO_AUTORIZADO",
  EVENTO_RESTRITO: "EVENTO_RESTRITO",
  MODO_RESTRICAO_INVALIDO: "MODO_RESTRICAO_INVALIDO",
};

const IS_DEV = process.env.NODE_ENV !== "production";

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function logInfo(msg, extra) {
  if (IS_DEV) console.log("[eventoAcessoRegistroService]", msg, extra || "");
}

function logWarn(msg, extra) {
  console.warn("[eventoAcessoRegistroService][WARN]", msg, extra || "");
}

function logError(msg, err, extra) {
  console.error("[eventoAcessoRegistroService][ERR]", msg, {
    message: err?.message || err,
    code: err?.code,
    stack: err?.stack,
    ...(extra || {}),
  });
}

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toPositiveIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeModo(v) {
  return String(v || "").trim().toLowerCase();
}

// normaliza o "registro" mantendo só dígitos
function normRegistro(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 20);
}

function uniqNumbers(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).map(Number).filter(Number.isFinite))];
}

/**
 * Normaliza arrays vindos do Postgres:
 * - array real: [1,2,3]
 * - texto PG: "{1,2,3}"
 * - texto comum: "1,2,3"
 */
function normalizePgIntArray(value) {
  if (Array.isArray(value)) {
    return uniqNumbers(value);
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (!raw) return [];

    // "{1,2,3}" -> ["1","2","3"]
    if (raw.startsWith("{") && raw.endsWith("}")) {
      const inner = raw.slice(1, -1).trim();
      if (!inner) return [];
      return uniqNumbers(inner.split(",").map((s) => s.trim()));
    }

    return uniqNumbers(raw.split(",").map((s) => s.trim()));
  }

  return [];
}

function buildEventoResumo(evento) {
  if (!evento) return null;

  return {
    id: evento.id,
    titulo: evento.titulo,
    restrito: !!evento.restrito,
    restrito_modo: normalizeModo(evento.restrito_modo) || null,
  };
}

/* ──────────────────────────────────────────────────────────────
   Carregadores
────────────────────────────────────────────────────────────── */
async function carregarEvento(id, t = db) {
  const eventoId = toPositiveIntOrNull(id);
  if (!eventoId) return null;

  const { rows } = await t.query(
    `
    SELECT
      id,
      titulo,
      COALESCE(restrito, false) AS restrito,
      restrito_modo,
      COALESCE(cargos_permitidos_ids, '{}')   AS cargos_permitidos_ids,
      COALESCE(unidades_permitidas_ids, '{}') AS unidades_permitidas_ids
    FROM eventos
    WHERE id = $1
    LIMIT 1
    `,
    [eventoId]
  );

  const row = rows?.[0] || null;
  if (!row) return null;

  return {
    id: toPositiveIntOrNull(row.id),
    titulo: row.titulo || null,
    restrito: row.restrito === true,
    restrito_modo: normalizeModo(row.restrito_modo),
    cargos_permitidos_ids: normalizePgIntArray(row.cargos_permitidos_ids),
    unidades_permitidas_ids: normalizePgIntArray(row.unidades_permitidas_ids),
  };
}

async function carregarUsuario(id, t = db) {
  const userId = toPositiveIntOrNull(id);
  if (!userId) return null;

  const { rows } = await t.query(
    `
    SELECT
      id,
      nome,
      registro,
      cargo_id,
      unidade_id
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  const row = rows?.[0] || null;
  if (!row) return null;

  return {
    id: toPositiveIntOrNull(row.id),
    nome: row.nome || null,
    registro: row.registro || null,
    cargo_id: toPositiveIntOrNull(row.cargo_id),
    unidade_id: toPositiveIntOrNull(row.unidade_id),
  };
}

/* ──────────────────────────────────────────────────────────────
   Regras de acesso
────────────────────────────────────────────────────────────── */
/**
 * Checagem de acesso por registro
 * - evento.restrito = false  → ok
 * - restrito_modo = "todos_servidores" → precisa ter registro
 * - restrito_modo = "lista_registros"  → precisa ter registro e estar em evento_registros
 * - modo vazio/qualquer outro          → valida por cargo/unidade; se não houver match, nega
 */
async function checarAcessoPorRegistro(usuario, evento, t = db) {
  if (!usuario || !evento) {
    return { ok: false, motivo: MOTIVOS.DADOS_INVALIDOS };
  }

  // sem restrição → ok
  if (!evento.restrito) {
    return { ok: true };
  }

  const regNorm = normRegistro(usuario.registro);
  const cargoId = toPositiveIntOrNull(usuario.cargo_id);
  const unidadeId = toPositiveIntOrNull(usuario.unidade_id);

  const cargosPermitidos = normalizePgIntArray(evento.cargos_permitidos_ids);
  const unidadesPermitidas = normalizePgIntArray(evento.unidades_permitidas_ids);
  const modo = normalizeModo(evento.restrito_modo);

  // 1) todos_servidores → precisa registro
  if (modo === MODO_TODOS) {
    if (!regNorm) {
      return { ok: false, motivo: MOTIVOS.SEM_REGISTRO };
    }
    return { ok: true };
  }

  // 2) lista_registros → precisa registro e estar em evento_registros
  if (modo === MODO_LISTA) {
    if (!regNorm) {
      return { ok: false, motivo: MOTIVOS.SEM_REGISTRO };
    }

    const { rowCount } = await t.query(
      `
      SELECT 1
      FROM evento_registros
      WHERE evento_id = $1
        AND registro_norm = $2
      LIMIT 1
      `,
      [evento.id, regNorm]
    );

    return rowCount > 0
      ? { ok: true }
      : { ok: false, motivo: MOTIVOS.REGISTRO_NAO_AUTORIZADO };
  }

  // 3) fallback por cargo/unidade
  const okCargo = cargoId != null && cargosPermitidos.includes(cargoId);
  const okUnidade = unidadeId != null && unidadesPermitidas.includes(unidadeId);

  if (okCargo || okUnidade) {
    return { ok: true };
  }

  // Se houver modo preenchido e desconhecido, registramos isso para auditoria.
  if (modo && modo !== MODO_TODOS && modo !== MODO_LISTA) {
    logWarn("Modo de restrição desconhecido; aplicando fallback cargo/unidade", {
      evento_id: evento.id,
      restrito_modo: modo,
      cargos_permitidos_ids: cargosPermitidos,
      unidades_permitidas_ids: unidadesPermitidas,
    });

    // mantém motivo principal funcional sem quebrar o sistema
    return { ok: false, motivo: MOTIVOS.EVENTO_RESTRITO };
  }

  return { ok: false, motivo: MOTIVOS.EVENTO_RESTRITO };
}

/* ──────────────────────────────────────────────────────────────
   API principal do serviço
────────────────────────────────────────────────────────────── */
/**
 * Retorna apenas o necessário (evita vazar registro/email)
 */
async function podeVerEvento({ usuarioId, eventoId }, t = db) {
  const uid = toPositiveIntOrNull(usuarioId);
  const eid = toPositiveIntOrNull(eventoId);

  if (!uid || !eid) {
    return {
      ok: false,
      motivo: MOTIVOS.DADOS_INVALIDOS,
      evento: null,
    };
  }

  try {
    const [usuario, evento] = await Promise.all([
      carregarUsuario(uid, t),
      carregarEvento(eid, t),
    ]);

    if (!evento) {
      return {
        ok: false,
        motivo: MOTIVOS.EVENTO_NAO_ENCONTRADO,
        evento: null,
      };
    }

    if (!usuario) {
      return {
        ok: false,
        motivo: MOTIVOS.USUARIO_NAO_ENCONTRADO,
        evento: buildEventoResumo(evento),
      };
    }

    const r = await checarAcessoPorRegistro(usuario, evento, t);

    const payload = {
      ...r,
      evento: buildEventoResumo(evento),
    };

    logInfo("podeVerEvento concluído", {
      usuarioId: uid,
      eventoId: eid,
      ok: payload.ok,
      motivo: payload.motivo || null,
      restrito: payload.evento?.restrito,
      restrito_modo: payload.evento?.restrito_modo,
    });

    return payload;
  } catch (err) {
    logError("Falha em podeVerEvento", err, {
      usuarioId: uid,
      eventoId: eid,
    });

    return {
      ok: false,
      motivo: MOTIVOS.DADOS_INVALIDOS,
      evento: null,
    };
  }
}

module.exports = {
  MODO_TODOS,
  MODO_LISTA,
  MOTIVOS,
  normRegistro,
  podeVerEvento,
  carregarEvento,
  carregarUsuario,
  checarAcessoPorRegistro,
};