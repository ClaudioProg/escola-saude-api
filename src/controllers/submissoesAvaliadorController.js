/* eslint-disable no-console */
// 📁 src/controllers/submissoesAvaliadorController.js
"use strict";

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;

const IS_DEV = process.env.NODE_ENV !== "production";

/* -----------------------
   helpers
----------------------- */
async function tableExists(tableName) {
  const q = `
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = $1
    limit 1
  `;
  const r = await db.query(q, [tableName]);
  return r.rowCount > 0;
}

async function pickFirstExistingTable(names = []) {
  for (const n of names) {
    // eslint-disable-next-line no-await-in-loop
    if (await tableExists(n)) return n;
  }
  return null;
}

function getUserId(req) {
  // tenta vários formatos (o server.js também normaliza em req.userId)
  return req.userId ?? req.user?.id ?? req.usuario?.id ?? req.auth?.id ?? null;
}

function ensureAuth(req, res) {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: req.requestId });
    return null;
  }
  return uid;
}

// padroniza retorno (front costuma esperar arrays/contagens)
function ok(res, payload) {
  return res.status(200).json({ ok: true, ...payload });
}

/* -----------------------
   API do Avaliador
----------------------- */

/**
 * GET /api/avaliador/submissoes
 * Lista submissões atribuídas ao avaliador.
 */
async function listarAtribuidas(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  // Tabelas candidatas (ajuste conforme seu schema real)
  const atribuicoesTable = await pickFirstExistingTable([
    "avaliacoes_atribuicoes",
    "avaliacoes_submissoes",
    "submissoes_avaliadores",
    "atribuicoes_submissoes",
    "submissao_avaliador",
    "submissoes_atribuicoes",
  ]);

  if (!atribuicoesTable) {
    if (IS_DEV) console.warn("[listarAtribuidas] Nenhuma tabela de atribuições encontrada. Retornando vazio.");
    return ok(res, { itens: [], total: 0 });
  }

  // Colunas candidatas (vamos tentar um SQL simples e, se falhar, retornamos vazio sem 500)
  // IMPORTANT: troque os nomes quando você confirmar o schema.
  const sql = `
    select
      a.* 
    from ${atribuicoesTable} a
    where
      (a.avaliador_id = $1 or a.usuario_id = $1)
    order by
      coalesce(a.atualizado_em, a.criado_em) desc nulls last
    limit 500
  `;

  try {
    const r = await db.query(sql, [avaliadorId]);
    // devolve em "itens" (mais estável) e também em "submissoes" (compat)
    return ok(res, { itens: r.rows, submissoes: r.rows, total: r.rowCount });
  } catch (e) {
    // fallback ultra seguro
    if (IS_DEV) {
      console.warn("[listarAtribuidas] SQL falhou, retornando vazio. Detalhe:", e?.message);
    }
    return ok(res, { itens: [], submissoes: [], total: 0, warn: "schema_mismatch" });
  }
}

/**
 * GET /api/avaliador/pendentes
 * Lista apenas as pendentes (se houver coluna de status).
 */
async function listarPendentes(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  const atribuicoesTable = await pickFirstExistingTable([
    "avaliacoes_atribuicoes",
    "avaliacoes_submissoes",
    "submissoes_avaliadores",
    "atribuicoes_submissoes",
    "submissao_avaliador",
    "submissoes_atribuicoes",
  ]);

  if (!atribuicoesTable) {
    if (IS_DEV) console.warn("[listarPendentes] Nenhuma tabela de atribuições encontrada. Retornando vazio.");
    return ok(res, { itens: [], total: 0 });
  }

  // Tentativa: considera pendente quando "status" é 'pendente' OU quando não tem nota/avaliacao.
  const sql = `
    select
      a.*
    from ${atribuicoesTable} a
    where
      (a.avaliador_id = $1 or a.usuario_id = $1)
      and (
        coalesce(a.status, '') ilike 'pendente'
        or a.nota is null
        or a.avaliacao_id is null
      )
    order by
      coalesce(a.atualizado_em, a.criado_em) desc nulls last
    limit 500
  `;

  try {
    const r = await db.query(sql, [avaliadorId]);
    return ok(res, { itens: r.rows, total: r.rowCount });
  } catch (e) {
    if (IS_DEV) console.warn("[listarPendentes] SQL falhou, retornando vazio:", e?.message);
    return ok(res, { itens: [], total: 0, warn: "schema_mismatch" });
  }
}

/**
 * GET /api/avaliador/minhas-contagens
 * Contagens para badge: total, pendentes, finalizadas...
 */
async function minhasContagens(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  const atribuicoesTable = await pickFirstExistingTable([
    "avaliacoes_atribuicoes",
    "avaliacoes_submissoes",
    "submissoes_avaliadores",
    "atribuicoes_submissoes",
    "submissao_avaliador",
    "submissoes_atribuicoes",
  ]);

  if (!atribuicoesTable) {
    if (IS_DEV) console.warn("[minhasContagens] Nenhuma tabela de atribuições encontrada. Retornando zeros.");
    return ok(res, { total: 0, pendentes: 0, finalizadas: 0 });
  }

  const sql = `
    select
      count(*)::int as total,
      sum(case
            when (coalesce(status,'') ilike 'pendente' or nota is null or avaliacao_id is null) then 1
            else 0
          end)::int as pendentes,
      sum(case
            when not (coalesce(status,'') ilike 'pendente' or nota is null or avaliacao_id is null) then 1
            else 0
          end)::int as finalizadas
    from ${atribuicoesTable}
    where (avaliador_id = $1 or usuario_id = $1)
  `;

  try {
    const r = await db.query(sql, [avaliadorId]);
    const row = r.rows?.[0] || { total: 0, pendentes: 0, finalizadas: 0 };
    return ok(res, row);
  } catch (e) {
    if (IS_DEV) console.warn("[minhasContagens] SQL falhou, retornando zeros:", e?.message);
    return ok(res, { total: 0, pendentes: 0, finalizadas: 0, warn: "schema_mismatch" });
  }
}

/**
 * GET /api/avaliador/para-mim
 * Alias compatível com fluxos antigos ("submissoes/para-mim").
 */
async function paraMim(req, res) {
  // por enquanto, mesma coisa de listarAtribuidas
  return listarAtribuidas(req, res);
}

module.exports = {
  listarAtribuidas,
  listarPendentes,
  minhasContagens,
  paraMim,
};
