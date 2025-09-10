// ✅ src/services/eventoAcessoRegistroService.js
const db = require("../db");

// modos de restrição
const MODO_TODOS = "todos_servidores"; // "somente servidores" (precisa ter registro)
const MODO_LISTA = "lista_registros";  // registro precisa estar na lista

// normaliza o "registro" mantendo só dígitos
const normRegistro = (v) => String(v || "").replace(/\D/g, "").slice(0, 20);

async function carregarEvento(id) {
  const { rows } = await db.query(
    `SELECT id, titulo, restrito, restrito_modo
       FROM eventos
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function carregarUsuario(id) {
  const { rows } = await db.query(
    `SELECT id, nome, email, registro
       FROM usuarios
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Checagem de acesso por registro
 * - evento.restrito = false  → ok
 * - restrito_modo = "todos_servidores" → precisa ter registro
 * - restrito_modo = "lista_registros"  → precisa ter registro e estar em evento_registros
 *
 * Obs.: agora é **assíncrona** porque consulta a tabela evento_registros.
 */
async function checarAcessoPorRegistro(usuario, evento) {
  if (!usuario || !evento) return { ok: false, motivo: "DADOS_INVALIDOS" };

  // sem restrição → todos autenticados veem
  if (!evento.restrito) return { ok: true };

  const regNorm = normRegistro(usuario.registro);

  if (evento.restrito_modo === MODO_TODOS) {
    return regNorm ? { ok: true } : { ok: false, motivo: "SEM_REGISTRO" };
  }

  if (evento.restrito_modo === MODO_LISTA) {
    if (!regNorm) return { ok: false, motivo: "SEM_REGISTRO" };
    const { rowCount } = await db.query(
      `SELECT 1
         FROM evento_registros
        WHERE evento_id = $1 AND registro_norm = $2
        LIMIT 1`,
      [evento.id, regNorm]
    );
    return rowCount > 0
      ? { ok: true }
      : { ok: false, motivo: "REGISTRO_NAO_AUTORIZADO" };
  }

  return { ok: false, motivo: "MODO_RESTRICAO_INVALIDO" };
}

async function podeVerEvento({ usuarioId, eventoId }) {
  const [usuario, evento] = await Promise.all([
    carregarUsuario(usuarioId),
    carregarEvento(eventoId),
  ]);

  if (!evento) return { ok: false, motivo: "EVENTO_NAO_ENCONTRADO" };
  if (!usuario) return { ok: false, motivo: "USUARIO_NAO_ENCONTRADO" };

  const r = await checarAcessoPorRegistro(usuario, evento);
  return { ...r, evento, usuario };
}

module.exports = {
  MODO_TODOS,
  MODO_LISTA,
  normRegistro,
  podeVerEvento,
  carregarEvento,
  carregarUsuario,
  checarAcessoPorRegistro, // agora é async
};
