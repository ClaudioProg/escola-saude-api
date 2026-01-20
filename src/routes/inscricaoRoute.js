// 📁 src/routes/inscricaoRoute.js — PREMIUM (robusto, consistente, sem surpresas)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[inscricaoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[inscricaoRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

const inscricaoController = require("../controllers/inscricaoController");

// serviços/DB para validar acesso por registro
const db = require("../db");
const { podeVerEvento } = require("../services/eventoAcessoRegistroService");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────────────────────────────────────────────────────
   🧰 Helpers premium
   ─────────────────────────────────────────────────────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store");
  return next();
};

const asPositiveInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

const getUserId = (req) => req.user?.id ?? null;

function getPerfis(req) {
  const raw = req.user?.perfil ?? req.user?.perfis ?? [];
  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((p) => p.replace(/[\[\]"]/g, "").trim())
        .filter(Boolean);
  return arr.map((p) => String(p).toLowerCase());
}

function getTurmaIdFromReq(req) {
  // cobre POST /, GET /conflito/:turmaId, GET /?turma_id=, etc.
  return (
    req.body?.turma_id ||
    req.body?.turmaId ||
    req.params?.turma_id ||
    req.params?.turmaId || // cobre /conflito/:turmaId
    req.query?.turma_id ||
    req.query?.turmaId
  );
}

// Wrapper seguro (sync/async) para não repetir try/catch
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

    const { rows } = await db.query(
      "SELECT id, evento_id FROM turmas WHERE id = $1",
      [turmaId]
    );

    const turma = rows?.[0];
    if (!turma) {
      return res.status(400).json({ ok: false, erro: "TURMA_INVALIDA" });
    }

    const acesso = await podeVerEvento({
      usuarioId,
      eventoId: turma.evento_id,
    });

    if (!acesso?.ok) {
      // Motivos esperados: 'SEM_REGISTRO' | 'REGISTRO_NAO_AUTORIZADO' | ...
      if (IS_DEV) {
        console.warn("[inscricaoRoute] acesso negado", {
          rid,
          usuarioId,
          turmaId,
          eventoId: turma.evento_id,
          motivo: acesso?.motivo,
        });
      }
      return res.status(403).json({ ok: false, motivo: acesso?.motivo || "SEM_PERMISSAO" });
    }

    // Normaliza para uso de controllers que esperam turmaId em params
    req.params = req.params || {};
    req.params.turmaId = String(turmaId);

    return next();
  } catch (e) {
    console.error("[inscricaoRoute] ERRO checarAcessoPorRegistroNaTurma:", e);
    return res.status(500).json({ ok: false, erro: "ERRO_INTERNO" });
  }
}

/* ──────────────────────────────────────────────────────────
   📌 Inscrições
   ────────────────────────────────────────────────────────── */

// ➕ Inscrever (usuario/instrutor/administrador)
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  routeTag("inscricaoRoute:POST /"),
  checarAcessoPorRegistroNaTurma,
  handle(inscricaoController.inscreverEmTurma)
);

// ❌ Cancelar minha inscrição (usuário autenticado)
router.delete(
  "/minha/:turmaId",
  requireAuth,
  routeTag("inscricaoRoute:DELETE /minha/:turmaId"),
  handle(inscricaoController.cancelarMinhaInscricao)
);

// ❌ Cancelar inscrição (ADMIN) de qualquer usuário
router.delete(
  "/:turmaId/usuario/:usuarioId",
  requireAuth,
  authorizeRoles("administrador"),
  routeTag("inscricaoRoute:DELETE /:turmaId/usuario/:usuarioId"),
  handle(inscricaoController.cancelarInscricaoAdmin)
);

// 👤 Minhas inscrições
router.get(
  "/minhas",
  requireAuth,
  routeTag("inscricaoRoute:GET /minhas"),
  handle(inscricaoController.obterMinhasInscricao)
);

// 📋 Listar inscritos da turma (instrutor/admin)
router.get(
  "/turma/:turma_id",
  requireAuth,
  authorizeRoles("administrador", "instrutor"),
  routeTag("inscricaoRoute:GET /turma/:turma_id"),
  handle(inscricaoController.listarInscritosPorTurma)
);

/* ──────────────────────────────────────────────────────────
   🔎 Checagem de conflito (para o frontend pintar o card/botão)
   ────────────────────────────────────────────────────────── */

// ✅ Checa conflito para UMA turma (mesmo evento + global)
router.get(
  "/conflito/:turmaId",
  requireAuth,
  routeTag("inscricaoRoute:GET /conflito/:turmaId"),
  checarAcessoPorRegistroNaTurma,
  handle(inscricaoController.conflitoPorTurma) // certifique-se de exportar no controller
);

/* ──────────────────────────────────────────────────────────
   🧯 LEGADO: DELETE /inscricao/:id
   Tenta tratar :id como inscricao_id; se não achar, tenta como turma_id
   para cancelar a própria inscrição. Mantém compatibilidade com frontend antigo.
   ────────────────────────────────────────────────────────── */
router.delete(
  "/:id",
  requireAuth,
  routeTag("inscricaoRoute:DELETE /:id@legacy"),
  async (req, res) => {
    const id = asPositiveInt(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    try {
      // 1) Tentar como inscrição_id
      const ins = await db.query(
        "SELECT usuario_id, turma_id FROM inscricoes WHERE id = $1",
        [id]
      );

      if (ins.rowCount) {
        const { usuario_id, turma_id } = ins.rows[0] || {};

        const perfis = getPerfis(req);
        const isAdmin = perfis.includes("administrador");
        const isSelf = Number(usuario_id) === Number(getUserId(req));

        if (!isAdmin && !isSelf) {
          return res.status(403).json({ erro: "Sem permissão para cancelar esta inscrição." });
        }

        req.params.turmaId = String(turma_id);
        req.params.usuarioId = String(usuario_id);

        return inscricaoController.cancelarInscricaoAdmin(req, res);
      }

      // 2) Caso contrário, tratar :id como turmaId para "minha"
      req.params.turmaId = String(id);
      return inscricaoController.cancelarMinhaInscricao(req, res);
    } catch (e) {
      console.error("[inscricaoRoute] LEGADO DELETE /inscricao/:id erro:", e);
      return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
    }
  }
);

module.exports = router;
