/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

const eventoPublicoController = require("../controllers/eventoPublicoController");
const eventoAdminController = require("../controllers/eventoAdminController");
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
    cacheControl: null,
  }),
  asyncHandler(eventoPublicoController.obterFolderDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🎯 Eventos “para mim”
─────────────────────────────────────────────────────────────── */
router.get(
  "/para-mim/lista",
  requireAuth,
  routeTag("eventoRoute:GET /para-mim/lista", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarEventosParaMim)
);

/* ───────────────────────────────────────────────────────────────
   📆 Agenda & visão do instrutor
─────────────────────────────────────────────────────────────── */
router.get(
  "/agenda",
  requireAuth,
  routeTag("eventoRoute:GET /agenda", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.getAgendaEventos)
);

router.get(
  "/instrutor",
  requireAuth,
  routeTag("eventoRoute:GET /instrutor", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarEventosDoinstrutor)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Lista principal
   - Admin: usa listagem administrativa
   - Demais: usa listagem pública/autenticada
─────────────────────────────────────────────────────────────── */
router.get(
  "/",
  requireAuth,
  routeTag("eventoRoute:GET /", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(async (req, res) => {
    const perfis = Array.isArray(req.user?.perfil)
      ? req.user.perfil
      : String(req.user?.perfil || "")
          .split(",")
          .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
          .filter(Boolean);

    const isAdmin = perfis.includes("administrador");

    if (isAdmin) {
      return eventoAdminController.listarEventosAdmin(req, res);
    }

    return eventoPublicoController.listarEventos(req, res);
  })
);

/* ───────────────────────────────────────────────────────────────
   🔎 Auxiliares / autocomplete (admin)
─────────────────────────────────────────────────────────────── */
router.get(
  "/instrutores/disponiveis",
  requireAuth,
  authorizeRoles("administrador"),
  routeTag("eventoRoute:GET /instrutores/disponiveis", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoAdminController.listarInstrutoresDisponiveis)
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
  asyncHandler(eventoPublicoController.listarTurmasDoEvento)
);

router.get(
  "/:id/turmas-simples",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventoRoute:GET /:id/turmas-simples", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarTurmasSimples)
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
  asyncHandler(eventoAdminController.publicarEvento)
);

router.post(
  "/:id/despublicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventoRoute:POST /:id/despublicar", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.despublicarEvento)
);

/* ───────────────────────────────────────────────────────────────
   📎 Upload de arquivos do evento (admin)
─────────────────────────────────────────────────────────────── */
router.post(
  "/:id/arquivos",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoAdminController.uploadEventos,
  routeTag("eventoRoute:POST /:id/arquivos", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/folder",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoAdminController.uploadFolderOnly,
  routeTag("eventoRoute:POST /:id/folder", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/programacao",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoAdminController.uploadProgramacaoOnly,
  routeTag("eventoRoute:POST /:id/programacao", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
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
  asyncHandler(eventoPublicoController.buscarEventoPorId)
);

/* ───────────────────────────────────────────────────────────────
   ➕ Criar / ✏️ Atualizar / 🗑️ Excluir (admin)
─────────────────────────────────────────────────────────────── */
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador"),
  eventoAdminController.uploadEventos,
  routeTag("eventoRoute:POST /", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.criarEvento)
);

router.put(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoAdminController.uploadEventos,
  routeTag("eventoRoute:PUT /:id", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.atualizarEvento)
);

router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventoRoute:DELETE /:id", { cacheControl: "no-store" }),
  asyncHandler(eventoAdminController.excluirEvento)
);

module.exports = router;