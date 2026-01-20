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
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  // Evita cache em rotas autenticadas (boa prática para dados sensíveis)
  res.set("Cache-Control", "no-store");
  return next();
};

const ensureNumericParam = (paramName) => (req, res, next) => {
  const raw = req.params?.[paramName];
  const n = Number(raw);

  // aceita apenas inteiro positivo
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ erro: `${paramName} inválido.` });
  }

  // mantém como string (controllers geralmente esperam string), mas já validado
  req.params[paramName] = String(n);
  return next();
};

// Wrapper seguro para controllers (sincronos/async), evitando repetição de try/catch
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
    routeTag("eventosRoute:/protegido@dev"),
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
  routeTag("eventosRoute:/para-mim/lista"),
  handle(eventoController.listarEventosParaMim)
);

/* ───────────────────────────────────────────────────────────────
   📆 Agenda & visão do instrutor
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/agenda",
  requireAuth,
  routeTag("eventosRoute:/agenda"),
  handle(eventoController.getAgendaEventos)
);

router.get(
  "/instrutor",
  requireAuth,
  routeTag("eventosRoute:/instrutor"),
  handle(eventoController.listarEventosDoinstrutor)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Auto-complete de cargos (ANTES de '/:id')
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/cargos/sugerir",
  requireAuth,
  routeTag("eventosRoute:/cargos/sugerir"),
  handle(eventoController.sugerirCargos)
);

/* ───────────────────────────────────────────────────────────────
   📅 CRUD principal de eventos
   ─────────────────────────────────────────────────────────────── */

// Listar todos
router.get(
  "/",
  requireAuth,
  routeTag("eventosRoute:/"),
  handle(eventoController.listarEventos)
);

// Turmas por evento (ANTES de '/:id')
router.get(
  "/:id/turmas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/turmas"),
  handle(eventoController.listarTurmasDoEvento)
);

router.get(
  "/:id/turmas-simples",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/turmas-simples"),
  handle(eventoController.listarTurmasSimples)
);

/* ───────────────────────────────────────────────────────────────
   📌 Datas reais da turma (usa :id = turma_id)
   ─────────────────────────────────────────────────────────────── */
router.get(
  "/turmas/:id/datas",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/turmas/:id/datas"),
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
  routeTag("eventosRoute:/:id/publicar"),
  handle(eventoController.publicarEvento)
);

router.post(
  "/:id/despublicar",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id/despublicar"),
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
  eventoController.uploadEventos, // aceita fields: folder, programacao (ou file)
  routeTag("eventosRoute:/:id/arquivos"),
  handle(eventoController.atualizarArquivosDoEvento)
);

// Atalhos compatíveis
router.post(
  "/:id/folder",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:/:id/folder"),
  handle(eventoController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/programacao",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:/:id/programacao"),
  handle(eventoController.atualizarArquivosDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   🔎 Buscar / Criar / Atualizar / Excluir (admin)
   ─────────────────────────────────────────────────────────────── */

// Buscar por ID
router.get(
  "/:id",
  requireAuth,
  ensureNumericParam("id"),
  routeTag("eventosRoute:/:id"),
  handle(eventoController.buscarEventoPorId)
);

// Criar (admin) — com upload (folder/programacao)
router.post(
  "/",
  requireAuth,
  authorizeRoles("administrador"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:POST /"),
  handle(eventoController.criarEvento)
);

// Atualizar (admin)
router.put(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  eventoController.uploadEventos,
  routeTag("eventosRoute:PUT /:id"),
  handle(eventoController.atualizarEvento)
);

// Excluir (admin)
router.delete(
  "/:id",
  requireAuth,
  authorizeRoles("administrador"),
  ensureNumericParam("id"),
  routeTag("eventosRoute:DELETE /:id"),
  handle(eventoController.excluirEvento)
);

module.exports = router;
