"use strict";

/* eslint-disable no-console */
// ✅ src/routes/solicitacaoCursoRoute.js — PREMIUM (singular + compat)

const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.authMiddleware ||
      _auth?.protect ||
      _auth?.auth ||
      _auth?.default;

if (typeof requireAuth !== "function") {
  console.error("[solicitacaoCursoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "[solicitacaoCursoRoute] authMiddleware inválido (não é função). Verifique ../auth/authMiddleware"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function"
    ? authorizeMod
    : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize ||
  authorizeMod?.default;

if (typeof authorizeRoles !== "function") {
  console.error("[solicitacaoCursoRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* ───────────────── Controllers ───────────────── */
const {
  listarSolicitacao,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
} = require("../controllers/solicitacaoCursoController");

/* ───────────────── Validação defensiva dos handlers ───────────────── */
for (const [name, fn] of Object.entries({
  listarSolicitacao,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
})) {
  if (typeof fn !== "function") {
    console.error("[solicitacaoCursoRoute] controller inválido:", name, fn);
    throw new Error(
      `solicitacaoCursoController inválido (função ausente: ${name})`
    );
  }
}

/* ───────────────── Helpers premium ───────────────── */
const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const routeTag = (tag) => (req, res, next) => {
  try {
    res.setHeader("X-Route-Handler", tag);
  } catch {}
  return next();
};

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({
        erro: `${paramName} inválido.`,
      });
    }

    req.params[paramName] = String(n);
    return next();
  };
}

/* ───────────────── Middlewares globais ───────────────── */
router.use(requireAuth);

// 🔒 dado de processo/solicitação → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* ─────────────────────────── ROTAS ─────────────────────────── */

// ✅ Listar solicitações visíveis ao usuário logado
router.get(
  "/",
  routeTag("solicitacaoCursoRoute:GET /"),
  wrap(listarSolicitacao)
);

// ✅ Tipos cadastrados para o select do frontend
router.get(
  "/tipos",
  routeTag("solicitacaoCursoRoute:GET /tipos"),
  wrap(listarTipos)
);

// ➕ Criar nova solicitação
router.post(
  "/",
  routeTag("solicitacaoCursoRoute:POST /"),
  wrap(criarSolicitacao)
);

// ✏️ Atualizar solicitação existente
router.put(
  "/:id",
  ensureNumericParam("id"),
  routeTag("solicitacaoCursoRoute:PUT /:id"),
  wrap(atualizarSolicitacao)
);

router.patch(
  "/:id",
  ensureNumericParam("id"),
  routeTag("solicitacaoCursoRoute:PATCH /:id"),
  wrap(atualizarSolicitacao)
);

// 🗑️ Excluir solicitação
router.delete(
  "/:id",
  ensureNumericParam("id"),
  routeTag("solicitacaoCursoRoute:DELETE /:id"),
  wrap(excluirSolicitacao)
);

module.exports = router;