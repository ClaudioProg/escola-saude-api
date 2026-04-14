// ✅ src/routes/eventoRoute.js
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const eventoController = require("../controllers/eventoController");
const turmaController = require("../controllers/turmaController");

/* ───────────────────────────────────────────────────────────────
   🔐 Auth/roles resilientes (suporta export default, named e fn direta)
   ─────────────────────────────────────────────────────────────── */
function resolveFn(mod, candidates = []) {
  if (typeof mod === "function") return mod;
  for (const k of candidates) {
    if (typeof mod?.[k] === "function") return mod[k];
  }
  return mod?.default && typeof mod.default === "function" ? mod.default : null;
}

const _auth = require("../auth/authMiddleware");
const requireAuth = resolveFn(_auth, ["authMiddleware", "requireAuth"]);

if (typeof requireAuth !== "function") {
  console.error("[eventosRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const _roles = require("../middlewares/authorize");
const authorizeRoles = resolveFn(_roles, ["authorizeRoles"]);

if (typeof authorizeRoles !== "function") {
  console.error("[eventosRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────────────────────────────────────────────────────
   🧰 Helpers “premium”
   ─────────────────────────────────────────────────────────────── */
const routeTag = (tag, options = {}) => (req, res, next) => {
  const {
    cacheControl = "no-store",
  } = options;

  res.set("X-Route-Handler", tag);

  if (cacheControl) {
    res.set("Cache-Control", cacheControl);
  }

  return next();
};

const ensureNumericParam = (paramName) => (req, res, next) => {
  const raw = req.params?.[paramName];
  const n = Number(raw);

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ erro: `${paramName} inválido.` });
  }

  req.params[paramName] = String(n);
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

/* ───────────────────────────────────────────────────────────────
   🔐 Rota de teste (só DEV)
   ─────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  router.get(
    "/protegido",
    requireAuth,
    routeTag("eventosRoute:/protegido@dev", { cacheControl: "no-store" }),
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
   🎯 Eventos “para mim”
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/para-mim/lista",
  requireAuth,
  routeTag("eventosRoute:/para-mim/lista", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarEventosParaMim)
);

/* ───────────────────────────────────────────────────────────────
   📆 Agenda & visão do instrutor
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/agenda",
  requireAuth,
  routeTag("eventosRoute:/agenda", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.getAgendaEventos)
);

router.get(
  "/instrutor",
  requireAuth,
  routeTag("eventosRoute:/instrutor", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarEventosDoinstrutor)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Auto-complete de cargos (ANTES de '/:id')
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/cargos/sugerir",
  requireAuth,
  routeTag("eventosRoute:/cargos/sugerir", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.sugerirCargos)
);

router.get(
  "/instrutores/disponiveis",
  requireAuth,
  routeTag("eventosRoute:/instrutores/disponiveis", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarInstrutoresDisponiveis)
);

/* ───────────────────────────────────────────────────────────────
   📅 CRUD principal de eventos
   ─────────────────────────────────────────────────────────────── */

// Listar todos
router.get(
  "/",
  requireAuth,
  routeTag("eventosRoute:/", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarEventos)
);

// Turmas por evento (ANTES de '/:id')
router.get(
  "/:id/turmas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/turmas", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarTurmasDoEvento)
);

router.get(
  "/:id/turmas-simples",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/turmas-simples", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.listarTurmasSimples)
);

/* ───────────────────────────────────────────────────────────────
   📌 Datas reais da turma (usa :id = turma_id)
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/turmas/:id/datas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/turmas/:id/datas", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(turmaController.listarDatasDaTurma)
);

/* ───────────────────────────────────────────────────────────────
   📣 Publicar / Despublicar (admin)
   ─────────────────────────────────────────────────────────────── */
router.post(
  "/:id/publicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/publicar", { cacheControl: "no-store" }),
  handle(eventoController.publicarEvento)
);

router.post(
  "/:id/despublicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/despublicar", { cacheControl: "no-store" }),
  handle(eventoController.despublicarEvento)
);

/* ───────────────────────────────────────────────────────────────
   📎 Upload de arquivos do evento — admin
   ─────────────────────────────────────────────────────────────── */

// Endpoint unificado (recomendado pelo front)
router.post(
  "/:id/arquivos",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:/:id/arquivos", { cacheControl: "no-store" }),
  handle(eventoController.atualizarArquivosDoEvento)
);

// Atalhos compatíveis
router.post(
  "/:id/folder",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadFolderOnly,
  routeTag("eventosRoute:/:id/folder", { cacheControl: "no-store" }),
  handle(eventoController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/programacao",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadProgramacaoOnly,
  routeTag("eventosRoute:/:id/programacao", { cacheControl: "no-store" }),
  handle(eventoController.atualizarArquivosDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🖼️ Folder (blob no DB) — leitura pública (ANTES de '/:id')
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/:id/folder",
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/folder@GET", {
    cacheControl: null, // o controller define o cache ideal
  }),
  handle(eventoController.obterFolderDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Buscar / Criar / Atualizar / Excluir (admin)
   ─────────────────────────────────────────────────────────────── */

// Buscar por ID
router.get(
  "/:id",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  handle(eventoController.buscarEventoPorId)
);

// Criar (admin) — com upload (folder/programacao)
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:POST /", { cacheControl: "no-store" }),
  handle(eventoController.criarEvento)
);

// Atualizar (admin)
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:PUT /:id", { cacheControl: "no-store" }),
  handle(eventoController.atualizarEvento)
);

// Excluir (admin)
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventosRoute:DELETE /:id", { cacheControl: "no-store" }),
  handle(eventoController.excluirEvento)
);

module.exports = router;