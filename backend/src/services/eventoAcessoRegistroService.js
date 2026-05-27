/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/eventoAcessoRegistroService.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Serviço oficial de acesso/elegibilidade para eventos restritos.
 *
 * Responsabilidades:
 * - verificar se um usuário pode acessar/ver um evento;
 * - verificar restrição por registro funcional;
 * - verificar restrição por lista nominal de registros;
 * - verificar restrição por cargo;
 * - verificar restrição por unidade;
 * - permitir uso dentro de transações com client PostgreSQL opcional;
 * - centralizar a regra para evento público, inscrição e demais fluxos.
 *
 * Regras oficiais:
 * - administrador pode acessar quando permitirAdministrador=true;
 * - exigirPublicado=true bloqueia evento não publicado para usuários comuns;
 * - evento não restrito libera acesso;
 * - restrito_modo = "todos_servidores" exige registro funcional;
 * - restrito_modo = "lista_registros" exige registro funcional autorizado;
 * - restrito_modo nulo/vazio valida cargo/unidade nas tabelas oficiais;
 * - restrito_modo desconhecido nega por configuração inválida.
 *
 * Fontes oficiais:
 * - eventos;
 * - evento_registros;
 * - evento_cargos;
 * - evento_unidades;
 * - usuarios.
 *
 * Contratos oficiais:
 * - ../db exporta query;
 * - conn opcional pode ser client PostgreSQL com .query;
 * - registro normalizado vem de ../utils/registro.normalizarRegistro;
 * - perfil administrativo oficial: "administrador".
 *
 * Sem aliases:
 * - sem db.oneOrNone;
 * - sem db.result;
 * - sem dbModule.db;
 * - sem fallback de banco;
 * - sem múltiplos formatos de db;
 * - sem eventos.cargos_permitidos_ids como fonte funcional;
 * - sem eventos.unidades_permitidas_ids como fonte funcional;
 * - sem liberação indireta para modo desconhecido;
 * - sem export paralelo podeVerEvento.
 */

const { query } = require("../db");
const { normalizarRegistro } = require("../utils/registro");

/* ──────────────────────────────────────────────────────────────
   Validação de contrato
────────────────────────────────────────────────────────────── */

if (typeof query !== "function") {
  throw new Error(
    "[eventoAcessoRegistroService] Contrato inválido: ../db deve exportar query como função."
  );
}

if (typeof normalizarRegistro !== "function") {
  throw new Error(
    "[eventoAcessoRegistroService] Contrato inválido: ../utils/registro deve exportar normalizarRegistro como função."
  );
}

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIL_ADMINISTRADOR = "administrador";

const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

const MOTIVOS = Object.freeze({
  DADOS_INVALIDOS: "DADOS_INVALIDOS",
  EVENTO_NAO_ENCONTRADO: "EVENTO_NAO_ENCONTRADO",
  USUARIO_NAO_ENCONTRADO: "USUARIO_NAO_ENCONTRADO",
  EVENTO_NAO_PUBLICADO: "EVENTO_NAO_PUBLICADO",
  ADMINISTRADOR: "ADMINISTRADOR",
  ACESSO_LIBERADO: "ACESSO_LIBERADO",
  SEM_REGISTRO: "SEM_REGISTRO",
  REGISTRO_NAO_AUTORIZADO: "REGISTRO_NAO_AUTORIZADO",
  EVENTO_RESTRITO: "EVENTO_RESTRITO",
  MODO_RESTRICAO_INVALIDO: "MODO_RESTRICAO_INVALIDO",
});

const IS_DEV = process.env.NODE_ENV !== "production";

/* ──────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */

function logInfo(message, extra) {
  if (IS_DEV) {
    console.log("[eventoAcessoRegistroService]", message, extra || "");
  }
}

function logWarn(message, extra) {
  console.warn("[eventoAcessoRegistroService][WARN]", message, extra || "");
}

function logError(message, error, extra) {
  console.error("[eventoAcessoRegistroService][ERR]", message, {
    message: error?.message || error,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
    ...(extra || {}),
  });
}

/* ──────────────────────────────────────────────────────────────
   Executor oficial
────────────────────────────────────────────────────────────── */

async function executar(conn, sql, params = []) {
  if (conn && typeof conn.query === "function") {
    return conn.query(sql, params);
  }

  return query(sql, params);
}

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function toPositiveIntOrNull(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizeModo(value) {
  const modo = String(value || "").trim().toLowerCase();

  return modo || null;
}

function normalizePerfil(value) {
  return String(value || "").trim().toLowerCase();
}

function normRegistro(value) {
  return normalizarRegistro(value || "");
}

function uniqNumbers(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
}

function mensagemDoMotivo(motivo) {
  const mensagens = {
    [MOTIVOS.DADOS_INVALIDOS]: "Dados inválidos para verificar acesso ao evento.",
    [MOTIVOS.EVENTO_NAO_ENCONTRADO]: "Evento não encontrado.",
    [MOTIVOS.USUARIO_NAO_ENCONTRADO]: "Usuário não encontrado.",
    [MOTIVOS.EVENTO_NAO_PUBLICADO]: "Evento ainda não publicado.",
    [MOTIVOS.ADMINISTRADOR]: "Acesso liberado para administrador.",
    [MOTIVOS.ACESSO_LIBERADO]: "Acesso liberado.",
    [MOTIVOS.SEM_REGISTRO]:
      "Acesso restrito a servidores com registro funcional válido.",
    [MOTIVOS.REGISTRO_NAO_AUTORIZADO]:
      "Acesso restrito a servidores autorizados na lista do evento.",
    [MOTIVOS.EVENTO_RESTRITO]:
      "Acesso restrito ao público autorizado para este evento.",
    [MOTIVOS.MODO_RESTRICAO_INVALIDO]:
      "Evento com configuração de restrição inválida.",
  };

  return mensagens[motivo] || "Acesso não autorizado.";
}

function buildEventoResumo(evento) {
  if (!evento) return null;

  return {
    id: Number(evento.id),
    titulo: evento.titulo || null,
    publicado: evento.publicado === true,
    restrito: evento.restrito === true,
    restrito_modo: normalizeModo(evento.restrito_modo),
  };
}

function buildResultado({
  ok,
  motivo,
  evento = null,
  usuario = null,
  details = null,
}) {
  const motivoFinal =
    motivo || (ok ? MOTIVOS.ACESSO_LIBERADO : MOTIVOS.EVENTO_RESTRITO);

  return {
    ok: Boolean(ok),
    motivo: motivoFinal,
    message: mensagemDoMotivo(motivoFinal),
    evento: buildEventoResumo(evento),
    ...(usuario
      ? {
          usuario: {
            id: Number(usuario.id),
            perfil: normalizePerfil(usuario.perfil),
          },
        }
      : {}),
    ...(details ? { details } : {}),
  };
}

/* ──────────────────────────────────────────────────────────────
   Carregadores oficiais
────────────────────────────────────────────────────────────── */

async function carregarEventoAcesso(id, conn = null) {
  const eventoId = toPositiveIntOrNull(id);

  if (!eventoId) {
    return null;
  }

  const eventoResult = await executar(
    conn,
    `
    SELECT
      id,
      titulo,
      COALESCE(publicado, false) AS publicado,
      COALESCE(restrito, false) AS restrito,
      restrito_modo
    FROM eventos
    WHERE id = $1
    LIMIT 1
    `,
    [eventoId]
  );

  const row = eventoResult.rows?.[0];

  if (!row) {
    return null;
  }

  const [cargosResult, unidadesResult] = await Promise.all([
    executar(
      conn,
      `
      SELECT cargo
      FROM evento_cargos
      WHERE evento_id = $1
      `,
      [eventoId]
    ),

    executar(
      conn,
      `
      SELECT unidade_id
      FROM evento_unidades
      WHERE evento_id = $1
      `,
      [eventoId]
    ),
  ]);

  return {
    id: toPositiveIntOrNull(row.id),
    titulo: row.titulo || null,
    publicado: row.publicado === true,
    restrito: row.restrito === true,
    restrito_modo: normalizeModo(row.restrito_modo),

    cargo_ids_permitidos: uniqNumbers(
      (cargosResult.rows || []).map((item) => item.cargo)
    ),

    unidade_ids_permitidas: uniqNumbers(
      (unidadesResult.rows || []).map((item) => item.unidade_id)
    ),
  };
}

async function carregarUsuarioAcesso(id, conn = null) {
  const usuarioId = toPositiveIntOrNull(id);

  if (!usuarioId) {
    return null;
  }

  const result = await executar(
    conn,
    `
    SELECT
      id,
      nome,
      perfil,
      registro,
      cargo_id,
      unidade_id
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  const row = result.rows?.[0];

  if (!row) {
    return null;
  }

  return {
    id: toPositiveIntOrNull(row.id),
    nome: row.nome || null,
    perfil: normalizePerfil(row.perfil),
    registro: row.registro || null,
    registro_norm: normRegistro(row.registro || ""),
    cargo_id: toPositiveIntOrNull(row.cargo_id),
    unidade_id: toPositiveIntOrNull(row.unidade_id),
  };
}

async function registroEstaAutorizado({ eventoId, registroNorm }, conn = null) {
  const eid = toPositiveIntOrNull(eventoId);
  const registro = normRegistro(registroNorm);

  if (!eid || !registro) {
    return false;
  }

  const result = await executar(
    conn,
    `
    SELECT 1
    FROM evento_registros
    WHERE evento_id = $1
      AND registro_norm = $2
    LIMIT 1
    `,
    [eid, registro]
  );

  return result.rowCount > 0;
}

/* ──────────────────────────────────────────────────────────────
   Regra central
────────────────────────────────────────────────────────────── */

/**
 * Checa acesso/elegibilidade de um usuário para um evento.
 *
 * Esta função não busca no banco: recebe usuário e evento já carregados.
 */
async function checarAcessoEvento(
  {
    usuario,
    evento,
    exigirPublicado = false,
    permitirAdministrador = true,
  },
  conn = null
) {
  if (!usuario || !evento) {
    return buildResultado({
      ok: false,
      motivo: MOTIVOS.DADOS_INVALIDOS,
      evento,
      usuario,
    });
  }

  if (
    permitirAdministrador &&
    normalizePerfil(usuario.perfil) === PERFIL_ADMINISTRADOR
  ) {
    return buildResultado({
      ok: true,
      motivo: MOTIVOS.ADMINISTRADOR,
      evento,
      usuario,
    });
  }

  if (exigirPublicado && evento.publicado !== true) {
    return buildResultado({
      ok: false,
      motivo: MOTIVOS.EVENTO_NAO_PUBLICADO,
      evento,
      usuario,
    });
  }

  if (evento.restrito !== true) {
    return buildResultado({
      ok: true,
      motivo: MOTIVOS.ACESSO_LIBERADO,
      evento,
      usuario,
    });
  }

  const registroNormalizado = normRegistro(usuario.registro || usuario.registro_norm);
  const cargoId = toPositiveIntOrNull(usuario.cargo_id);
  const unidadeId = toPositiveIntOrNull(usuario.unidade_id);

  const cargosPermitidosIds = uniqNumbers(evento.cargo_ids_permitidos);
  const unidadesPermitidasIds = uniqNumbers(evento.unidade_ids_permitidas);

  const modo = normalizeModo(evento.restrito_modo);

  if (modo === MODO_TODOS) {
    if (!registroNormalizado) {
      return buildResultado({
        ok: false,
        motivo: MOTIVOS.SEM_REGISTRO,
        evento,
        usuario,
      });
    }

    return buildResultado({
      ok: true,
      motivo: MOTIVOS.ACESSO_LIBERADO,
      evento,
      usuario,
    });
  }

  if (modo === MODO_LISTA) {
    if (!registroNormalizado) {
      return buildResultado({
        ok: false,
        motivo: MOTIVOS.SEM_REGISTRO,
        evento,
        usuario,
      });
    }

    const autorizado = await registroEstaAutorizado(
      {
        eventoId: evento.id,
        registroNorm: registroNormalizado,
      },
      conn
    );

    return buildResultado({
      ok: autorizado,
      motivo: autorizado
        ? MOTIVOS.ACESSO_LIBERADO
        : MOTIVOS.REGISTRO_NAO_AUTORIZADO,
      evento,
      usuario,
    });
  }

  if (modo) {
    logWarn("Modo de restrição inválido.", {
      evento_id: evento.id,
      restrito_modo: modo,
    });

    return buildResultado({
      ok: false,
      motivo: MOTIVOS.MODO_RESTRICAO_INVALIDO,
      evento,
      usuario,
      details: {
        restrito_modo: modo,
      },
    });
  }

  const temRegraPorCargoOuUnidade =
    cargosPermitidosIds.length > 0 || unidadesPermitidasIds.length > 0;

  if (!temRegraPorCargoOuUnidade) {
    logWarn("Evento restrito sem regra de cargo/unidade.", {
      evento_id: evento.id,
    });

    return buildResultado({
      ok: false,
      motivo: MOTIVOS.MODO_RESTRICAO_INVALIDO,
      evento,
      usuario,
      details: {
        regra: "Evento restrito sem modo e sem cargo/unidade permitidos.",
      },
    });
  }

  const temCargoPermitido =
    cargoId != null && cargosPermitidosIds.includes(cargoId);

  const temUnidadePermitida =
    unidadeId != null && unidadesPermitidasIds.includes(unidadeId);

  if (temCargoPermitido || temUnidadePermitida) {
    return buildResultado({
      ok: true,
      motivo: MOTIVOS.ACESSO_LIBERADO,
      evento,
      usuario,
    });
  }

  return buildResultado({
    ok: false,
    motivo: MOTIVOS.EVENTO_RESTRITO,
    evento,
    usuario,
  });
}

/* ──────────────────────────────────────────────────────────────
   API principal do serviço
────────────────────────────────────────────────────────────── */

/**
 * Verifica se o usuário pode acessar o evento.
 *
 * Parâmetros:
 * - usuarioId: id oficial do usuário;
 * - eventoId: id oficial do evento;
 * - exigirPublicado: quando true, bloqueia evento não publicado para usuário comum;
 * - permitirAdministrador: quando true, administrador tem acesso total.
 */
async function podeAcessarEvento(
  {
    usuarioId,
    eventoId,
    exigirPublicado = false,
    permitirAdministrador = true,
  },
  conn = null
) {
  const uid = toPositiveIntOrNull(usuarioId);
  const eid = toPositiveIntOrNull(eventoId);

  if (!uid || !eid) {
    return buildResultado({
      ok: false,
      motivo: MOTIVOS.DADOS_INVALIDOS,
      evento: null,
      usuario: null,
    });
  }

  try {
    const [usuario, evento] = await Promise.all([
      carregarUsuarioAcesso(uid, conn),
      carregarEventoAcesso(eid, conn),
    ]);

    if (!evento) {
      return buildResultado({
        ok: false,
        motivo: MOTIVOS.EVENTO_NAO_ENCONTRADO,
        evento: null,
        usuario,
      });
    }

    if (!usuario) {
      return buildResultado({
        ok: false,
        motivo: MOTIVOS.USUARIO_NAO_ENCONTRADO,
        evento,
        usuario: null,
      });
    }

    const resultado = await checarAcessoEvento(
      {
        usuario,
        evento,
        exigirPublicado,
        permitirAdministrador,
      },
      conn
    );

    logInfo("podeAcessarEvento concluído.", {
      usuario_id: uid,
      evento_id: eid,
      ok: resultado.ok,
      motivo: resultado.motivo || null,
      publicado: resultado.evento?.publicado,
      restrito: resultado.evento?.restrito,
      restrito_modo: resultado.evento?.restrito_modo,
    });

    return resultado;
  } catch (error) {
    logError("Falha em podeAcessarEvento.", error, {
      usuario_id: uid,
      evento_id: eid,
    });

    return buildResultado({
      ok: false,
      motivo: MOTIVOS.DADOS_INVALIDOS,
      evento: null,
      usuario: null,
      details: {
        erro_operacional: true,
      },
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   Exports oficiais
────────────────────────────────────────────────────────────── */

module.exports = {
  MODO_TODOS,
  MODO_LISTA,
  MOTIVOS,

  normRegistro,
  mensagemDoMotivo,

  carregarEventoAcesso,
  carregarUsuarioAcesso,
  registroEstaAutorizado,
  checarAcessoEvento,
  podeAcessarEvento,
};