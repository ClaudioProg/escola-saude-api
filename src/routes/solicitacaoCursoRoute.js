"use strict";

/* eslint-disable no-console */
// ✅ src/routes/solicitacaoCursoRoute.js — PREMIUM (singular + compat)
const express = require("express");
const router = express.Router();

let auth = require("../auth/authMiddleware");

const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

// ✅ requireAuth definido corretamente (usa o auth normalizado abaixo)
let requireAuth = auth;

/* ------------------------------------------------------------------
   Controllers
------------------------------------------------------------------- */
const {
  listarSolicitacao,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
} = require("../controllers/solicitacaoCursoController");

/* ------------------------------------------------------------------
   Compat auth (alguns projetos exportam { protect } / default)
------------------------------------------------------------------- */
auth =
  typeof auth === "function"
    ? auth
    : auth?.protect || auth?.auth || auth?.default;

if (typeof auth !== "function") {
  throw new Error(
    "[solicitacaoCursoRoute] authMiddleware inválido (não é função). Verifique ../auth/authMiddleware"
  );
}

// ✅ agora sim: requireAuth é uma função válida (e já normalizada)
requireAuth = auth;

// ✅ pronto se quiser usar em alguma rota específica
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ------------------------------------------------------------------
   Wrapper async (evita try/catch em cada rota)
------------------------------------------------------------------- */
const wrap =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

/* ------------------------------------------------------------------
   Middlewares globais da rota
------------------------------------------------------------------- */
router.use(requireAuth);

// 🔒 dado de processo/solicitação → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* ─────────────────────────── ROTAS ─────────────────────────── */

// ✅ Listar solicitações visíveis ao usuário logado
router.get("/", wrap(listarSolicitacao));

// ✅ Tipos cadastrados para o select do frontend
router.get("/tipos", wrap(listarTipos));

// ➕ Criar nova solicitação
router.post("/", wrap(criarSolicitacao));

// ✏️ Atualizar solicitação existente
router.put("/:id", wrap(atualizarSolicitacao));
router.patch("/:id", wrap(atualizarSolicitacao)); // bônus: PATCH também (sem quebrar nada)

// 🗑️ Excluir solicitação
router.delete("/:id", wrap(excluirSolicitacao));

module.exports = router;
