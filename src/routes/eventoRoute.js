// ✅ src/routes/eventoRoute.js — PREMIUM/UNIFICADO
/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

const eventoController = require("../controllers/eventoController");
const turmaController = require("../controllers/turmaController");

/* ───────────────────────────────────────────────────────────────
   🔐 Auth/roles resilientes
─────────────────────────────────────────────────────────────── */
function resolveFn(mod, candidates = []) {
  if (typeof mod === "function") return mod;

  for (const key of candidates) {
    if (typeof mod?.[key] === "function") return mod[key];
  }

  if (typeof mod?.default === "function") return mod.default;
  return null;
}

const _auth = require("../auth/authMiddleware");
const requireAuth = resolveFn(_auth, [
  "authMiddleware",
  "authAny",
  "requireAuth",
  "auth",
]);

if (typeof requireAuth !== "function") {
  console.error("[eventoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  resolveFn(_roles, ["authorizeRoles", "authorizeRole"]) ||
  _roles?.authorize?.any ||
  _roles?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[eventoRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────────────────────────────────────────────────────
   🧰 Helpers premium
─────────────────────────────────────────────────────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag, options = {}) {
  const { cacheControl = "no-store" } = options;

  return (req, res, next) => {
    res.setHeader("X-Route-Handler", tag);

    if (cacheControl !== null) {
      res.setHeader("Cache-Control", cacheControl);
    }

    return next();
  };
}

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ erro: `${paramName} inválido.` });
    }

    req.params[paramName] = String(Math.trunc(n));
    return next();
  };
}

/* ───────────────────────────────────────────────────────────────
   🔐 Rota de teste (somente DEV)
─────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  router.get(
    "/protegido",
    requireAuth,
    routeTag("eventoRoute:/protegido@dev", { cacheControl: "no-store" }),
    (req, res) => {
      res.json({
        mensagem: `Acesso autorizado para o usuário ${
          req.user?.cpf || req.user?.id || "?"
        }`,
      });
    }
  );
}

/* ───────────────────────────────────────────────────────────────
   🖼️ Folder público do evento
   IMPORTANTE: vem antes de "/:id"
─────────────────────────────────────────────────────────────── */
router.get(
  "/:id/folder",
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /:id/folder", {
    cacheControl: null, // controller decide o cache ideal
  }),
  asyncHandler(eventoController.obterFolderDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🎯 Eventos “para mim”
─────────────────────────────────────────────────────────────── */
router.get(
  "/para-mim/lista",
  requireAuth,
  routeTag("eventoRoute:/para-mim/lista", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarEventosParaMim)
);

/* ───────────────────────────────────────────────────────────────
   📆 Agenda & visão do instrutor
─────────────────────────────────────────────────────────────── */
router.get(
  "/agenda",
  requireAuth,
  routeTag("eventoRoute:/agenda", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.getAgendaEventos)
);

router.get(
  "/instrutor",
  requireAuth,
  routeTag("eventoRoute:/instrutor", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarEventosDoinstrutor)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Auxiliares / autocomplete
─────────────────────────────────────────────────────────────── */
router.get(
  "/cargos/sugerir",
  requireAuth,
  routeTag("eventoRoute:/cargos/sugerir", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.sugerirCargos)
);

router.get(
  "/instrutores/disponiveis",
  requireAuth,
  routeTag("eventoRoute:/instrutores/disponiveis", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarInstrutoresDisponiveis)
);

/* ───────────────────────────────────────────────────────────────
   📅 Lista principal
─────────────────────────────────────────────────────────────── */
router.get(
  "/",
  requireAuth,
  routeTag("eventoRoute:GET /", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarEventos)
);

/* ───────────────────────────────────────────────────────────────
   📚 Turmas por evento
   IMPORTANTE: vêm antes de "/:id"
─────────────────────────────────────────────────────────────── */
router.get(
  "/:id/turmas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /:id/turmas", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarTurmasDoEvento)
);

router.get(
  "/:id/turmas-simples",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /:id/turmas-simples", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.listarTurmasSimples)
);

/* ───────────────────────────────────────────────────────────────
   📌 Datas reais da turma
   Aqui :id = turma_id
─────────────────────────────────────────────────────────────── */
router.get(
  "/turmas/:id/datas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /turmas/:id/datas", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarDatasDaTurma)
);

/* ───────────────────────────────────────────────────────────────
   📣 Publicar / Despublicar (admin)
─────────────────────────────────────────────────────────────── */
router.post(
  "/:id/publicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventoRoute:POST /:id/publicar", { cacheControl: "no-store" }),
  asyncHandler(eventoController.publicarEvento)
);

router.post(
  "/:id/despublicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventoRoute:POST /:id/despublicar", { cacheControl: "no-store" }),
  asyncHandler(eventoController.despublicarEvento)
);

/* ───────────────────────────────────────────────────────────────
   📎 Upload de arquivos do evento (admin)
   Endpoint unificado + atalhos compat
─────────────────────────────────────────────────────────────── */
router.post(
  "/:id/arquivos",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventoRoute:POST /:id/arquivos", { cacheControl: "no-store" }),
  asyncHandler(eventoController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/folder",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadFolderOnly,
  routeTag("eventoRoute:POST /:id/folder", { cacheControl: "no-store" }),
  asyncHandler(eventoController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/programacao",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadProgramacaoOnly,
  routeTag("eventoRoute:POST /:id/programacao", { cacheControl: "no-store" }),
  asyncHandler(eventoController.atualizarArquivosDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Buscar por ID
─────────────────────────────────────────────────────────────── */
router.get(
  "/:id",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /:id", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoController.buscarEventoPorId)
);

/* ───────────────────────────────────────────────────────────────
   ➕ Criar / ✏️ Atualizar / 🗑️ Excluir (admin)
─────────────────────────────────────────────────────────────── */
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador"),
  eventoController.uploadEventos,
  routeTag("eventoRoute:POST /", { cacheControl: "no-store" }),
  asyncHandler(eventoController.criarEvento)
);

router.put(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventoRoute:PUT /:id", { cacheControl: "no-store" }),
  asyncHandler(eventoController.atualizarEvento)
);

router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventoRoute:DELETE /:id", { cacheControl: "no-store" }),
  asyncHandler(eventoController.excluirEvento)
);

module.exports = router;