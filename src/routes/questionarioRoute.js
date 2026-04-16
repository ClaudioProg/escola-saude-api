/* eslint-disable no-console */
"use strict";

// ✅ src/routes/questionarioRoute.js — PREMIUM V2 (robusto, seguro, sem conflito de rotas)
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente (compat exports) ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.protect ||
      _auth?.auth ||
      _auth?.requireAuth;

if (typeof requireAuth !== "function") {
  console.error("[questionarioRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  (typeof _roles === "function" ? _roles : _roles?.authorizeRoles) ||
  _roles?.authorizeRole ||
  _roles?.authorize?.any ||
  _roles?.authorize ||
  _roles?.default;

if (typeof authorizeRoles !== "function") {
  console.error("[questionarioRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

/* ───────────────── Controllers ───────────────── */
const {
  criarOuObterRascunhoPorEvento,
  obterQuestionarioPorEvento,
  atualizarQuestionario,
  adicionarQuestao,
  atualizarQuestao,
  removerQuestao,
  adicionarAlternativa,
  atualizarAlternativa,
  removerAlternativa,
  publicarQuestionario,
  listarDisponiveisParaUsuario,
  obterQuestionarioParaResponder,
  iniciarTentativa,
  enviarTentativa,
  obterMinhaTentativaPorTurma,
} = require("../controllers/questionarioController");

/* ───────────────── Helpers ───────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";

const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const routeTag = (tag) => (req, res, next) => {
  try {
    res.set("X-Route-Handler", tag);
  } catch {}
  return next();
};

const noStore = (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
  } catch {}
  return next();
};

/** valida params numéricos e mantém req.params como string */
function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ erro: `${paramName} inválido.` });
    }

    req.params[paramName] = String(n);
    return next();
  };
}

function getPerfis(user) {
  const raw =
    user?.perfis ??
    user?.perfil ??
    user?.roles ??
    user?.role ??
    "";

  if (Array.isArray(raw)) {
    return raw
      .map(String)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getUserId(req) {
  const u = req.user || req.usuario || {};
  return (
    u?.id ??
    u?.usuario_id ??
    req?.user?.usuario_id ??
    req?.usuario?.usuario_id ??
    req?.auth?.userId ??
    null
  );
}

function ensureSelfOrAdmin(req, res, next) {
  const user = req.user || req.usuario || {};
  const tokenId = Number(getUserId(req));
  const paramId = Number(req.params.usuario_id);

  const perfis = getPerfis(user);
  const isAdmin = perfis.includes("administrador");

  if (!Number.isFinite(paramId) || paramId <= 0) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  if (isAdmin || tokenId === paramId) return next();

  return res.status(403).json({ erro: "Acesso negado." });
}

/* ───────────────── Middleware global ───────────────── */
// Todas as rotas exigem auth
router.use(requireAuth, noStore);

/* ───────────────────────────────────────────────────────────────
   🧪 Diagnóstico DEV
─────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  router.get(
    "/_ping",
    routeTag("questionarioRoute:GET /_ping@dev"),
    (req, res) => {
      return res.json({
        ok: true,
        usuario: {
          id: req.user?.id ?? req.usuario?.id ?? null,
          perfis:
            req.user?.perfil ??
            req.user?.perfis ??
            req.usuario?.perfil ??
            req.usuario?.perfis ??
            null,
        },
      });
    }
  );
}

/* ───────────────────────────────────────────────────────────────
   👩‍🏫 Instrutor/Admin/Coordenador — gestão do questionário
─────────────────────────────────────────────────────────────── */

// cria/obtém rascunho do evento
router.post(
  "/evento/:evento_id/rascunho",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("evento_id"),
  routeTag("questionarioRoute:POST /evento/:evento_id/rascunho"),
  wrap(criarOuObterRascunhoPorEvento)
);

// obtém questionário do evento
router.get(
  "/evento/:evento_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("evento_id"),
  routeTag("questionarioRoute:GET /evento/:evento_id"),
  wrap(obterQuestionarioPorEvento)
);

router.head(
  "/evento/:evento_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("evento_id"),
  routeTag("questionarioRoute:HEAD /evento/:evento_id"),
  (_req, res) => res.sendStatus(204)
);

// atualiza metadados do questionário
router.put(
  "/:questionario_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:PUT /:questionario_id"),
  wrap(atualizarQuestionario)
);

router.patch(
  "/:questionario_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:PATCH /:questionario_id"),
  wrap(atualizarQuestionario)
);

// adiciona questão
router.post(
  "/:questionario_id/questoes",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:POST /:questionario_id/questoes"),
  wrap(adicionarQuestao)
);

// atualiza questão
router.put(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:PUT /:questionario_id/questoes/:questao_id"),
  wrap(atualizarQuestao)
);

router.patch(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:PATCH /:questionario_id/questoes/:questao_id"),
  wrap(atualizarQuestao)
);

// remove questão
router.delete(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:DELETE /:questionario_id/questoes/:questao_id"),
  wrap(removerQuestao)
);

// adiciona alternativa a uma questão
router.post(
  "/questoes/:questao_id/alternativas",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:POST /questoes/:questao_id/alternativas"),
  wrap(adicionarAlternativa)
);

// atualiza alternativa
router.put(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("alt_id"),
  routeTag("questionarioRoute:PUT /alternativas/:alt_id"),
  wrap(atualizarAlternativa)
);

router.patch(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("alt_id"),
  routeTag("questionarioRoute:PATCH /alternativas/:alt_id"),
  wrap(atualizarAlternativa)
);

// remove alternativa
router.delete(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("alt_id"),
  routeTag("questionarioRoute:DELETE /alternativas/:alt_id"),
  wrap(removerAlternativa)
);

// publica questionário
router.post(
  "/:questionario_id/publicar",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:POST /:questionario_id/publicar"),
  wrap(publicarQuestionario)
);

/* ───────────────────────────────────────────────────────────────
   👤 Usuário (aluno) — responder
   ⚠️ rotas específicas antes das genéricas
─────────────────────────────────────────────────────────────── */

// lista questionários disponíveis para um usuário
router.get(
  "/disponiveis/usuario/:usuario_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("usuario_id"),
  ensureSelfOrAdmin,
  routeTag("questionarioRoute:GET /disponiveis/usuario/:usuario_id"),
  wrap(listarDisponiveisParaUsuario)
);

// alias para usar id do token
router.get(
  "/disponiveis",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  routeTag("questionarioRoute:GET /disponiveis"),
  wrap((req, res, next) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ erro: "Não autenticado." });
    req.params.usuario_id = String(uid);
    return listarDisponiveisParaUsuario(req, res, next);
  })
);

// obter questionário para responder (por turma)
router.get(
  "/:questionario_id/responder/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:GET /:questionario_id/responder/turma/:turma_id"),
  wrap(obterQuestionarioParaResponder)
);

// iniciar tentativa
router.post(
  "/:questionario_id/iniciar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:POST /:questionario_id/iniciar/turma/:turma_id"),
  wrap(iniciarTentativa)
);

// enviar tentativa
router.post(
  "/:questionario_id/enviar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:POST /:questionario_id/enviar/turma/:turma_id"),
  wrap(enviarTentativa)
);

// obter minha tentativa por turma
router.get(
  "/:questionario_id/minha-tentativa/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:GET /:questionario_id/minha-tentativa/turma/:turma_id"),
  wrap(obterMinhaTentativaPorTurma)
);

router.head(
  "/:questionario_id/minha-tentativa/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:HEAD /:questionario_id/minha-tentativa/turma/:turma_id"),
  (_req, res) => res.sendStatus(204)
);

module.exports = router;