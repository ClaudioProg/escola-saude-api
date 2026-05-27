"use strict";

/**
 * ✅ backend/src/routes/pesquisaRoute.js — v2.0
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo Pesquisas.
 *
 * Mount oficial:
 * - app.use("/api/pesquisa", pesquisaRoute);
 *
 * Contratos oficiais:
 * - GET    /api/pesquisa/publicada
 * - GET    /api/pesquisa/:id
 * - POST   /api/pesquisa/:id/responder
 *
 * - GET    /api/pesquisa/admin
 * - POST   /api/pesquisa/admin
 * - GET    /api/pesquisa/admin/:id
 * - PUT    /api/pesquisa/admin/:id
 * - PATCH  /api/pesquisa/admin/:id/status
 * - GET    /api/pesquisa/admin/:id/resposta
 * - GET    /api/pesquisa/admin/:id/resultado
 * - DELETE /api/pesquisa/admin/:id
 *
 * Diretrizes v2.0:
 * - autenticação obrigatória em todas as rotas;
 * - administração restrita no controller;
 * - sem aliases;
 * - sem rotas legadas;
 * - sem rota plural paralela;
 * - sem resposta { erro };
 * - sem fallback silencioso;
 * - validação estrutural de imports no boot;
 * - cache no-store por se tratar de conteúdo institucional administrável;
 * - rotas admin antes de /:id para evitar colisão.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const pesquisaController = require("../controllers/pesquisaController");

const router = express.Router();

const {
  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,

  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  listarRespostasAdmin,
  resultadoAdmin,
  excluirAdmin,
} = pesquisaController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[pesquisaRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,
  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  listarRespostasAdmin,
  resultadoAdmin,
  excluirAdmin,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[pesquisaRoute] Controller inválido. Função ausente: ${nome}.`
    );
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function gerarRequestId() {
  return `pesquisa-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function validarIdParam(req, res, next) {
  const requestId = gerarRequestId();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        param: "id",
        value: req.params.id,
      },
      requestId,
    });
  }

  req.params.id = String(id);
  return next();
}

function validarStatusBody(req, res, next) {
  const requestId = gerarRequestId();
  const status = String(req.body?.status || "").trim();

  const statusOficiais = new Set([
    "rascunho",
    "publicada",
    "encerrada",
    "arquivada",
  ]);

  if (!statusOficiais.has(status)) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Status inválido para pesquisa.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicada, encerrada ou arquivada.",
      details: {
        status: req.body?.status,
      },
      requestId,
    });
  }

  return next();
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* =========================================================================
   Middlewares globais
=========================================================================== */

router.use(authMiddleware);
router.use(noStore);

/* =========================================================================
   Rotas administrativas
   IMPORTANTE: precisam vir antes de /:id
=========================================================================== */

/**
 * Lista pesquisas para administração.
 *
 * Filtros opcionais:
 * - ?status=rascunho
 * - ?tipo=interna
 * - ?contexto=geral
 * - ?busca=...
 */
router.get("/admin", wrap(listarAdmin));

/**
 * Cria pesquisa externa ou interna.
 */
router.post("/admin", wrap(criarAdmin));

/**
 * Obtém pesquisa completa para administração.
 */
router.get("/admin/:id", validarIdParam, wrap(obterAdmin));

/**
 * Atualiza pesquisa completa.
 *
 * Observação:
 * - Para pesquisa interna, as perguntas/opções enviadas substituem o conjunto anterior.
 */
router.put("/admin/:id", validarIdParam, wrap(atualizarAdmin));

/**
 * Altera somente o status da pesquisa.
 */
router.patch(
  "/admin/:id/status",
  validarIdParam,
  validarStatusBody,
  wrap(alterarStatusAdmin)
);

/**
 * Lista respostas individuais da pesquisa.
 */
router.get("/admin/:id/resposta", validarIdParam, wrap(listarRespostasAdmin));

/**
 * Obtém resultado agregado da pesquisa.
 */
router.get("/admin/:id/resultado", validarIdParam, wrap(resultadoAdmin));

/**
 * Exclui pesquisa.
 *
 * Observação:
 * - Como as respostas ficam em cascade, excluir remove também perguntas,
 *   opções, respostas e itens.
 * - Se a pesquisa já tiver valor institucional, preferir arquivar.
 */
router.delete("/admin/:id", validarIdParam, wrap(excluirAdmin));

/* =========================================================================
   Rotas de usuário autenticado
=========================================================================== */

/**
 * Lista pesquisas publicadas, disponíveis e exibíveis na página inicial/lista.
 *
 * Filtros opcionais:
 * - ?contexto=geral
 * - ?busca=...
 */
router.get("/publicada", wrap(listarPublicadas));

/**
 * Obtém pesquisa publicada por ID.
 */
router.get("/:id", validarIdParam, wrap(obterPublicadaPorId));

/**
 * Responde pesquisa interna publicada.
 */
router.post("/:id/responder", validarIdParam, wrap(responderPublicada));

module.exports = router;