/// 📁 src/routes/inscricaoRoute.js — PREMIUM (robusto, consistente, sem surpresas)
/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

const inscricaoController = require("../controllers/inscricaoController");

// serviços/DB para validar acesso por registro
const dbMod = require("../db");
const db = dbMod?.db ?? dbMod;
const { podeVerEvento } = require("../services/eventoAcessoRegistroService");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[inscricaoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[inscricaoRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────────────────────────────────────────────────────
   🧰 Helpers premium
─────────────────────────────────────────────────────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  return next();
};

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
};

const asPositiveInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

const getUserId = (req) =>
  req.user?.id ??
  req.usuario?.id ??
  req.userId ??
  req.auth?.userId ??
  null;

function getPerfis(req) {
  const raw =
    req.user?.perfil ??
    req.user?.perfis ??
    req.usuario?.perfil ??
    req.usuario?.perfis ??
    req.auth?.perfil ??
    [];

  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((p) => p.replace(/[\[\]"]/g, "").trim())
        .filter(Boolean);

  return arr.map((p) => String(p).toLowerCase());
}

function isAdmin(req) {
  return getPerfis(req).includes("administrador") || getPerfis(req).includes("admin");
}

function getTurmaIdFromReq(req) {
  return (
    req.body?.turma_id ||
    req.body?.turmaId ||
    req.params?.turma_id ||
    req.params?.turmaId ||
    req.query?.turma_id ||
    req.query?.turmaId
  );
}

function buildDevLog(req, extra = {}) {
  return {
    method: req.method,
    url: req.originalUrl,
    userId: getUserId(req),
    perfis: getPerfis(req),
    ip: req.ip,
    ...extra,
  };
}

// Wrapper seguro (sync/async)
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

function ensureNumericParam(paramName, label = paramName) {
  return (req, res, next) => {
    const n = asPositiveInt(req.params?.[paramName]);

    if (!n) {
      return res.status(400).json({ erro: `${label} inválido.` });
    }

    req.params[paramName] = String(n);
    return next();
  };
}

/**
 * 🛡️ Middleware: valida se o usuário pode se inscrever / consultar conflito
 * na turma informada (regra de visibilidade por REGISTRO do evento da turma).
 */
async function checarAcessoPorRegistroNaTurma(req, res, next) {
  const rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const turmaIdRaw = getTurmaIdFromReq(req);
    const turmaId = asPositiveInt(turmaIdRaw);

    if (!turmaId) {
      return res.status(400).json({ ok: false, erro: "TURMA_ID_OBRIGATORIO" });
    }

    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ ok: false, erro: "NAO_AUTENTICADO" });
    }

    const turmaQ = await db.query(
      `
      SELECT id, evento_id
      FROM turmas
      WHERE id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    const turma = turmaQ.rows?.[0];
    if (!turma) {
      return res.status(400).json({ ok: false, erro: "TURMA_INVALIDA" });
    }

    const acesso = await podeVerEvento({
      usuarioId,
      eventoId: turma.evento_id,
    });

    if (!acesso?.ok) {
      if (IS_DEV) {
        console.warn("[inscricaoRoute] acesso negado por registro", {
          rid,
          ...buildDevLog(req, {
            turmaId,
            eventoId: turma.evento_id,
            motivo: acesso?.motivo,
          }),
        });
      }

      return res.status(403).json({
        ok: false,
        motivo: acesso?.motivo || "SEM_PERMISSAO",
      });
    }

    // normaliza para controllers que esperam turmaId em params
    req.params = req.params || {};
    req.params.turmaId = String(turmaId);

    return next();
  } catch (e) {
    console.error("[inscricaoRoute] ERRO checarAcessoPorRegistroNaTurma:", e);
    return res.status(500).json({ ok: false, erro: "ERRO_INTERNO" });
  }
}

/* ───────────────── Middlewares do grupo ───────────────── */
router.use(requireAuth);
router.use(noStore);

/* ──────────────────────────────────────────────────────────
   📌 Inscrições
──────────────────────────────────────────────────────────── */

// ➕ Inscrever (usuario/instrutor/administrador)
router.post(
  "/",
  authorizeRoles("administrador", "instrutor", "usuario"),
  routeTag("inscricaoRoute:POST /"),
  checarAcessoPorRegistroNaTurma,
  handle(inscricaoController.inscreverEmTurma)
);

// ❌ Cancelar minha inscrição (usuário autenticado)
router.delete(
  "/minha/:turmaId",
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureNumericParam("turmaId", "turmaId"),
  routeTag("inscricaoRoute:DELETE /minha/:turmaId"),
  handle(inscricaoController.cancelarMinhaInscricao)
);

// ❌ Cancelar inscrição (ADMIN) de qualquer usuário
router.delete(
  "/:turmaId/usuario/:usuarioId",
  authorizeRoles("administrador"),
  ensureNumericParam("turmaId", "turmaId"),
  ensureNumericParam("usuarioId", "usuarioId"),
  routeTag("inscricaoRoute:DELETE /:turmaId/usuario/:usuarioId"),
  handle(inscricaoController.cancelarInscricaoAdmin)
);

// 👤 Minhas inscrições
router.get(
  "/minhas",
  authorizeRoles("administrador", "instrutor", "usuario"),
  routeTag("inscricaoRoute:GET /minhas"),
  handle(inscricaoController.obterMinhasInscricao)
);

// 📋 Listar inscritos da turma (instrutor/admin)
router.get(
  "/turma/:turma_id",
  authorizeRoles("administrador", "instrutor"),
  ensureNumericParam("turma_id", "turma_id"),
  routeTag("inscricaoRoute:GET /turma/:turma_id"),
  handle(inscricaoController.listarInscritosPorTurma)
);

/* ──────────────────────────────────────────────────────────
   🔎 Checagem de conflito (para o frontend pintar o card/botão)
──────────────────────────────────────────────────────────── */

// ✅ Checa conflito para UMA turma (mesmo evento + global)
router.get(
  "/conflito/:turmaId",
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureNumericParam("turmaId", "turmaId"),
  routeTag("inscricaoRoute:GET /conflito/:turmaId"),
  checarAcessoPorRegistroNaTurma,
  handle(inscricaoController.conflitoPorTurma)
);

/* ──────────────────────────────────────────────────────────
   🧯 LEGADO: DELETE /inscricao/:id
   Tenta tratar :id como inscricao_id; se não achar, tenta como turma_id
   para cancelar a própria inscrição.
──────────────────────────────────────────────────────────── */
router.delete(
  "/:id",
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureNumericParam("id", "id"),
  routeTag("inscricaoRoute:DELETE /:id@legacy"),
  async (req, res) => {
    const id = asPositiveInt(req.params.id);

    try {
      // 1) Tentar como inscricao_id
      const ins = await db.query(
        `
        SELECT usuario_id, turma_id
        FROM inscricoes
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (ins.rowCount) {
        const { usuario_id, turma_id } = ins.rows[0] || {};

        const admin = isAdmin(req);
        const isSelf = Number(usuario_id) === Number(getUserId(req));

        if (!admin && !isSelf) {
          return res.status(403).json({
            erro: "Sem permissão para cancelar esta inscrição.",
          });
        }

        req.params.turmaId = String(turma_id);
        req.params.usuarioId = String(usuario_id);

        if (IS_DEV) {
          console.log("[inscricaoRoute] legacy delete tratado como inscricao_id", {
            ...buildDevLog(req, { inscricaoId: id, turma_id, usuario_id }),
          });
        }

        return inscricaoController.cancelarInscricaoAdmin(req, res);
      }

      // 2) Caso contrário, tratar :id como turmaId para "minha inscrição"
      req.params.turmaId = String(id);

      if (IS_DEV) {
        console.log("[inscricaoRoute] legacy delete tratado como turmaId/minha", {
          ...buildDevLog(req, { turmaId: id }),
        });
      }

      return inscricaoController.cancelarMinhaInscricao(req, res);
    } catch (e) {
      console.error("[inscricaoRoute] LEGADO DELETE /inscricao/:id erro:", e);
      return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
    }
  }
);

module.exports = router;