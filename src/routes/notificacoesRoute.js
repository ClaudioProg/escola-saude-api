// 📁 src/routes/notificacoesRoute.js — PREMIUM (date-only safe, robusto, consistente)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[notificacoesRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── DB compat ───────────────── */
const dbMod = require("../db");
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[notificacoesRoute] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em notificacoesRoute.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store"); // notificações são pessoais
  return next();
};

const handle =
  (fn) =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };

const asPositiveInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

function getPagination(req) {
  const rawLimit = asPositiveInt(req.query.limit);
  const rawOffset = Number.parseInt(req.query.offset, 10);

  const limit = rawLimit ? Math.min(rawLimit, 100) : 20;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
}

function toBrDateOnlyString(input) {
  // date-only safe: sem new Date em string YYYY-MM-DD
  if (!input) return "";
  const s = String(input);

  // se já veio como YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(5, 7);
    const d = s.slice(8, 10);
    return `${d}/${m}/${y}`;
  }

  // se veio como Date ou timestamp: converte usando UTC (evita "pulo" por fuso)
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

/* ────────────────────────────────────────────────────────────────
   ✅ GET /api/notificacoes
   Lista notificações do usuário autenticado (mais recentes primeiro)
   Paginação: ?limit=&offset=
   ──────────────────────────────────────────────────────────────── */
router.get(
  "/",
  requireAuth,
  routeTag("notificacoesRoute:GET /"),
  handle(async (req, res) => {
    const usuarioId = asPositiveInt(req.user?.id);
    if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

    const { limit, offset } = getPagination(req);

    try {
      const result = await query(
        `
        SELECT id, mensagem, lida, criado_em
          FROM notificacoes
         WHERE usuario_id = $1
         ORDER BY criado_em DESC
         LIMIT $2 OFFSET $3
        `,
        [usuarioId, limit, offset]
      );

      const notificacoes = (result.rows || []).map((n) => ({
        id: n.id,
        mensagem: n.mensagem,
        lida: !!n.lida,
        // mantém compat com o front: "data" no formato dd/mm/yyyy
        data: toBrDateOnlyString(n.criado_em),
        // opcional útil p/ debug/frontend (pode remover se não quiser):
        criado_em: IS_DEV ? String(n.criado_em) : undefined,
      }));

      return res.status(200).json(notificacoes);
    } catch (err) {
      console.error("❌ Erro ao listar notificações:", err?.message || err);
      return res.status(500).json({ erro: "Erro ao listar notificações." });
    }
  })
);

/* ────────────────────────────────────────────────────────────────
   ✅ GET /api/notificacoes/nao-lidas/contagem
   Total de notificações não lidas do usuário
   ──────────────────────────────────────────────────────────────── */
router.get(
  "/nao-lidas/contagem",
  requireAuth,
  routeTag("notificacoesRoute:GET /nao-lidas/contagem"),
  handle(async (req, res) => {
    const usuarioId = asPositiveInt(req.user?.id);
    if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

    try {
      const { rows } = await query(
        `
        SELECT COUNT(*)::int AS total
          FROM notificacoes
         WHERE usuario_id = $1
           AND lida = false
        `,
        [usuarioId]
      );

      return res.status(200).json({ totalNaoLidas: rows?.[0]?.total ?? 0 });
    } catch (err) {
      console.error("❌ Erro ao contar notificações não lidas:", err?.message || err);
      return res.status(500).json({ erro: "Erro ao contar notificações não lidas." });
    }
  })
);

/* ────────────────────────────────────────────────────────────────
   ✅ PATCH /api/notificacoes/:id/lida
   Marca uma notificação como lida (se pertencer ao usuário)
   ──────────────────────────────────────────────────────────────── */
router.patch(
  "/:id/lida",
  requireAuth,
  routeTag("notificacoesRoute:PATCH /:id/lida"),
  handle(async (req, res) => {
    const usuarioId = asPositiveInt(req.user?.id);
    if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

    const notificacaoId = asPositiveInt(req.params.id);
    if (!notificacaoId) return res.status(400).json({ erro: "ID inválido." });

    try {
      const { rowCount } = await query(
        `
        UPDATE notificacoes
           SET lida = true
         WHERE id = $1
           AND usuario_id = $2
        `,
        [notificacaoId, usuarioId]
      );

      if (!rowCount) {
        return res.status(404).json({
          erro: "Notificação não encontrada ou não pertence ao usuário.",
        });
      }

      return res.status(200).json({ sucesso: true, mensagem: "Notificação marcada como lida." });
    } catch (err) {
      console.error("❌ Erro ao marcar notificação como lida:", err?.message || err);
      return res.status(500).json({ erro: "Erro ao atualizar notificação." });
    }
  })
);

/* ────────────────────────────────────────────────────────────────
   ✅ PATCH /api/notificacoes/lidas/todas
   Marca TODAS as notificações do usuário como lidas
   ──────────────────────────────────────────────────────────────── */
router.patch(
  "/lidas/todas",
  requireAuth,
  routeTag("notificacoesRoute:PATCH /lidas/todas"),
  handle(async (req, res) => {
    const usuarioId = asPositiveInt(req.user?.id);
    if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

    try {
      await query(
        `
        UPDATE notificacoes
           SET lida = true
         WHERE usuario_id = $1
           AND lida = false
        `,
        [usuarioId]
      );

      return res.status(200).json({
        sucesso: true,
        mensagem: "Todas as notificações foram marcadas como lidas.",
      });
    } catch (err) {
      console.error("❌ Erro ao marcar todas como lidas:", err?.message || err);
      return res.status(500).json({ erro: "Erro ao atualizar notificações." });
    }
  })
);

module.exports = router;
