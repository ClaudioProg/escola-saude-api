// ✅ src/services/eventoAcessoRegistroService.js
/* eslint-disable no-console */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

// modos de restrição
const MODO_TODOS = "todos_servidores"; // precisa ter registro
const MODO_LISTA = "lista_registros";  // registro precisa estar na lista

// motivos (padronizados)
const MOTIVOS = {
  DADOS_INVALIDOS: "DADOS_INVALIDOS",
  EVENTO_NAO_ENCONTRADO: "EVENTO_NAO_ENCONTRADO",
  USUARIO_NAO_ENCONTRADO: "USUARIO_NAO_ENCONTRADO",
  SEM_REGISTRO: "SEM_REGISTRO",
  REGISTRO_NAO_AUTORIZADO: "REGISTRO_NAO_AUTORIZADO",
  EVENTO_RESTRITO: "EVENTO_RESTRITO",              // ✅ novo
  MODO_RESTRICAO_INVALIDO: "MODO_RESTRICAO_INVALIDO",
};

// normaliza o "registro" mantendo só dígitos
const normRegistro = (v) => String(v || "").replace(/\D/g, "").slice(0, 20);

async function carregarEvento(id, t = db) {
  const eventoId = Number(id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) return null;

  const { rows } = await t.query(
    `SELECT id, titulo,
            COALESCE(restrito, false) AS restrito,
            restrito_modo,
            COALESCE(cargos_permitidos_ids, '{}')   AS cargos_permitidos_ids,
            COALESCE(unidades_permitidas_ids, '{}') AS unidades_permitidas_ids
       FROM eventos
      WHERE id = $1
      LIMIT 1`,
    [eventoId]
  );

  return rows[0] || null;
}

async function carregarUsuario(id, t = db) {
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const { rows } = await t.query(
    `SELECT id, nome, registro, cargo_id, unidade_id
       FROM usuarios
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

/**
 * Checagem de acesso por registro
 * - evento.restrito = false  → ok
 * - restrito_modo = "todos_servidores" → precisa ter registro
 * - restrito_modo = "lista_registros"  → precisa ter registro e estar em evento_registros
 *
 * Obs.: assíncrona porque consulta evento_registros.
 */
async function checarAcessoPorRegistro(usuario, evento, t = db) {
  if (!usuario || !evento) return { ok: false, motivo: MOTIVOS.DADOS_INVALIDOS };

  // sem restrição → ok
  if (!evento.restrito) return { ok: true };

  const regNorm = normRegistro(usuario.registro);
  const cargoId = Number(usuario.cargo_id) || null;
  const unidadeId = Number(usuario.unidade_id) || null;

  const cargosPermitidos = Array.isArray(evento.cargos_permitidos_ids)
    ? evento.cargos_permitidos_ids.map(Number).filter(Number.isFinite)
    : [];

  const unidadesPermitidas = Array.isArray(evento.unidades_permitidas_ids)
    ? evento.unidades_permitidas_ids.map(Number).filter(Number.isFinite)
    : [];

  // 1) todos_servidores → precisa registro
  if (evento.restrito_modo === MODO_TODOS) {
    return regNorm ? { ok: true } : { ok: false, motivo: MOTIVOS.SEM_REGISTRO };
  }

  // 2) lista_registros → precisa registro e estar em evento_registros
  if (evento.restrito_modo === MODO_LISTA) {
    if (!regNorm) return { ok: false, motivo: MOTIVOS.SEM_REGISTRO };

    const { rowCount } = await t.query(
      `SELECT 1
         FROM evento_registros
        WHERE evento_id = $1
          AND registro_norm = $2
        LIMIT 1`,
      [evento.id, regNorm]
    );

    return rowCount > 0
      ? { ok: true }
      : { ok: false, motivo: MOTIVOS.REGISTRO_NAO_AUTORIZADO };
  }

  // 3) demais modos (inclui null/undefined) → cargo/unidade
  const okCargo = cargoId && cargosPermitidos.includes(cargoId);
  const okUnidade = unidadeId && unidadesPermitidas.includes(unidadeId);

  if (okCargo || okUnidade) return { ok: true };

  // se chegou aqui e não bateu nada:
  // - evento está restrito, mas o usuário não tem vínculo
  // - ou o evento foi configurado com modo inválido e sem listas cargo/unidade
  return { ok: false, motivo: MOTIVOS.EVENTO_RESTRITO };
}

/**
 * API principal do serviço
 * Retorna apenas o necessário (evita vazar registro/email)
 */
async function podeVerEvento({ usuarioId, eventoId }, t = db) {
  const [usuario, evento] = await Promise.all([
    carregarUsuario(usuarioId, t),
    carregarEvento(eventoId, t),
  ]);

  if (!evento) return { ok: false, motivo: MOTIVOS.EVENTO_NAO_ENCONTRADO };
  if (!usuario) return { ok: false, motivo: MOTIVOS.USUARIO_NAO_ENCONTRADO };

  const r = await checarAcessoPorRegistro(usuario, evento, t);

  // devolve contexto mínimo (útil pro frontend)
  return {
    ...r,
    evento: { id: evento.id, titulo: evento.titulo, restrito: !!evento.restrito, restrito_modo: evento.restrito_modo },
  };
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
