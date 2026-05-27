/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/questionarioRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo de questionário.
 *
 * Mount oficial esperado:
 * - /api/questionario
 *
 * Contratos aplicados:
 * - Sem rotas plurais /questionarios, /questoes, /alternativas;
 * - Sem aliases de método, rota, perfil ou usuário;
 * - Sem PATCH duplicado quando PUT já é o contrato oficial;
 * - Sem req.usuario como fallback;
 * - Sem perfil/perfis/roles/role como múltiplas fontes;
 * - req.user.id é a identidade oficial autenticada;
 * - req.user.perfil é o perfil oficial autenticado;
 * - authorize é função oficial nomeada importada de ../middlewares/authorize;
 * - authMiddleware é função oficial importada diretamente;
 * - Perfis oficiais: usuario, organizador, administrador;
 * - Respostas de erro no envelope oficial { ok, message };
 * - Diagnóstico DEV seguro e sem cache;
 * - Rotas específicas antes das rotas parametrizadas genéricas.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

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

const router = express.Router();

const IS_DEV = process.env.NODE_ENV !== "production";

const PERFIS_GESTAO = Object.freeze(["administrador", "organizador"]);

const PERFIS_RESPOSTA = Object.freeze([
  "administrador",
  "organizador",
  "usuario",
]);

/* ─────────────────────────────────────────────────────────────
 * Validação de dependências oficiais
 * ───────────────────────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[questionarioRoute] authMiddleware inválido:", authMiddleware);
  throw new Error(
    "authMiddleware deve ser exportado como função em backend/src/auth/authMiddleware.js."
  );
}

if (typeof authorize !== "function") {
  console.error("[questionarioRoute] authorize inválido:", authorize);
  throw new Error(
    "authorize deve ser exportado como função nomeada em backend/src/middlewares/authorize.js."
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function fail(res, status, message, details = undefined) {
  const payload = {
    ok: false,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

function routeTag(tag) {
  return (_req, res, next) => {
    if (IS_DEV) {
      res.set("X-Route-Handler", tag);
    }

    return next();
  };
}

function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  return next();
}

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const value = Number(raw);

    if (!Number.isInteger(value) || value <= 0) {
      return fail(res, 400, `${paramName} inválido.`);
    }

    req.params[paramName] = String(value);

    return next();
  };
}

function getAuthenticatedUser(req) {
  return req.user && typeof req.user === "object" ? req.user : null;
}

function getAuthenticatedUserId(req) {
  const user = getAuthenticatedUser(req);
  const userId = Number(user?.id);

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getAuthenticatedPerfil(req) {
  const user = getAuthenticatedUser(req);
  const perfil = String(user?.perfil || "").trim().toLowerCase();

  return perfil || null;
}

function ensureSelfOrAdmin(req, res, next) {
  const tokenUserId = getAuthenticatedUserId(req);
  const paramUserId = Number(req.params?.usuario_id);
  const perfil = getAuthenticatedPerfil(req);

  if (!Number.isInteger(paramUserId) || paramUserId <= 0) {
    return fail(res, 400, "usuario_id inválido.");
  }

  if (!tokenUserId) {
    return fail(res, 401, "Não autenticado.");
  }

  if (perfil === "administrador" || tokenUserId === paramUserId) {
    return next();
  }

  return fail(res, 403, "Acesso negado.");
}

function setUsuarioIdFromToken(req, res, next) {
  const tokenUserId = getAuthenticatedUserId(req);

  if (!tokenUserId) {
    return fail(res, 401, "Não autenticado.");
  }

  req.params.usuario_id = String(tokenUserId);

  return next();
}

/* ─────────────────────────────────────────────────────────────
 * Middleware global
 * ───────────────────────────────────────────────────────────── */

router.use(authMiddleware, noStore);

/* ─────────────────────────────────────────────────────────────
 * Diagnóstico DEV
 * ───────────────────────────────────────────────────────────── */

if (IS_DEV) {
  router.get(
    "/_ping",
    routeTag("questionarioRoute:GET /_ping"),
    (req, res) => {
      return res.json({
        ok: true,
        data: {
          modulo: "questionario",
          usuario: {
            id: getAuthenticatedUserId(req),
            perfil: getAuthenticatedPerfil(req),
          },
        },
        message: "questionarioRoute ativo.",
      });
    }
  );
}

/* ─────────────────────────────────────────────────────────────
 * Gestão do questionário por evento
 * ───────────────────────────────────────────────────────────── */

router.post(
  "/evento/:evento_id/rascunho",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("evento_id"),
  routeTag("questionarioRoute:POST /evento/:evento_id/rascunho"),
  wrap(criarOuObterRascunhoPorEvento)
);

router.get(
  "/evento/:evento_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("evento_id"),
  routeTag("questionarioRoute:GET /evento/:evento_id"),
  wrap(obterQuestionarioPorEvento)
);

router.put(
  "/:questionario_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:PUT /:questionario_id"),
  wrap(atualizarQuestionario)
);

router.post(
  "/:questionario_id/publicar",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:POST /:questionario_id/publicar"),
  wrap(publicarQuestionario)
);

/* ─────────────────────────────────────────────────────────────
 * Questões
 * ───────────────────────────────────────────────────────────── */

router.post(
  "/:questionario_id/questao",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questionario_id"),
  routeTag("questionarioRoute:POST /:questionario_id/questao"),
  wrap(adicionarQuestao)
);

router.put(
  "/:questionario_id/questao/:questao_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:PUT /:questionario_id/questao/:questao_id"),
  wrap(atualizarQuestao)
);

router.delete(
  "/:questionario_id/questao/:questao_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:DELETE /:questionario_id/questao/:questao_id"),
  wrap(removerQuestao)
);

/* ─────────────────────────────────────────────────────────────
 * Alternativas
 * ───────────────────────────────────────────────────────────── */

router.post(
  "/questao/:questao_id/alternativa",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("questao_id"),
  routeTag("questionarioRoute:POST /questao/:questao_id/alternativa"),
  wrap(adicionarAlternativa)
);

router.put(
  "/alternativa/:alternativa_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("alternativa_id"),
  routeTag("questionarioRoute:PUT /alternativa/:alternativa_id"),
  wrap(atualizarAlternativa)
);

router.delete(
  "/alternativa/:alternativa_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("alternativa_id"),
  routeTag("questionarioRoute:DELETE /alternativa/:alternativa_id"),
  wrap(removerAlternativa)
);

/* ─────────────────────────────────────────────────────────────
 * Questionários disponíveis para resposta
 * ───────────────────────────────────────────────────────────── */

router.get(
  "/disponivel",
  authorize(...PERFIS_RESPOSTA),
  routeTag("questionarioRoute:GET /disponivel"),
  setUsuarioIdFromToken,
  wrap(listarDisponiveisParaUsuario)
);

router.get(
  "/disponivel/usuario/:usuario_id",
  authorize(...PERFIS_RESPOSTA),
  ensureNumericParam("usuario_id"),
  ensureSelfOrAdmin,
  routeTag("questionarioRoute:GET /disponivel/usuario/:usuario_id"),
  wrap(listarDisponiveisParaUsuario)
);

/* ─────────────────────────────────────────────────────────────
 * Resposta/tentativa do aluno
 * ───────────────────────────────────────────────────────────── */

router.get(
  "/:questionario_id/responder/turma/:turma_id",
  authorize(...PERFIS_RESPOSTA),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:GET /:questionario_id/responder/turma/:turma_id"),
  wrap(obterQuestionarioParaResponder)
);

router.post(
  "/:questionario_id/iniciar/turma/:turma_id",
  authorize(...PERFIS_RESPOSTA),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:POST /:questionario_id/iniciar/turma/:turma_id"),
  wrap(iniciarTentativa)
);

router.post(
  "/:questionario_id/enviar/turma/:turma_id",
  authorize(...PERFIS_RESPOSTA),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag("questionarioRoute:POST /:questionario_id/enviar/turma/:turma_id"),
  wrap(enviarTentativa)
);

router.get(
  "/:questionario_id/minha-tentativa/turma/:turma_id",
  authorize(...PERFIS_RESPOSTA),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  routeTag(
    "questionarioRoute:GET /:questionario_id/minha-tentativa/turma/:turma_id"
  ),
  wrap(obterMinhaTentativaPorTurma)
);

module.exports = router;