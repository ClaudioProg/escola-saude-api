"use strict";

/**
 * ✅ backend/src/routes/interacaoRoute.js — v2.0
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo Interações.
 *
 * Módulo:
 * - votação;
 * - quiz;
 * - nuvem de palavras.
 *
 * Mount oficial:
 * - app.use("/api/interacao", interacaoRoute);
 *
 * Contratos oficiais — usuário:
 * - GET  /api/interacao/publicada
 * - GET  /api/interacao/:id
 * - POST /api/interacao/:id/responder
 *
 * Contratos oficiais — administração:
 * - GET    /api/interacao/admin
 * - POST   /api/interacao/admin
 * - GET    /api/interacao/admin/:id
 * - PUT    /api/interacao/admin/:id
 * - PATCH  /api/interacao/admin/:id/status
 * - DELETE /api/interacao/admin/:id
 *
 * Contratos oficiais — execução ao vivo:
 * - POST  /api/interacao/admin/:id/execucao/iniciar
 * - POST  /api/interacao/admin/:id/pergunta/abrir
 * - POST  /api/interacao/admin/:id/pergunta/fechar
 * - POST  /api/interacao/admin/:id/pergunta/gabarito
 * - GET   /api/interacao/admin/:id/resultado
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
const interacaoController = require("../controllers/interacaoController");

const router = express.Router();

const {
  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,

  iniciarExecucaoAdmin,
  abrirPerguntaAdmin,
  fecharPerguntaAdmin,
  exibirGabaritoAdmin,
  resultadoAdmin,

  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,
} = interacaoController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[interacaoRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,

  iniciarExecucaoAdmin,
  abrirPerguntaAdmin,
  fecharPerguntaAdmin,
  exibirGabaritoAdmin,
  resultadoAdmin,

  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[interacaoRoute] Controller inválido. Função ausente: ${nome}.`
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
  return `interacao-route-${Date.now().toString(36)}-${Math.random()
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
    "em_andamento",
    "encerrada",
    "arquivada",
  ]);

  if (!statusOficiais.has(status)) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Status inválido para interação.",
      code: "STATUS_INVALIDO",
      adminHint:
        "Status oficiais: rascunho, publicada, em_andamento, encerrada ou arquivada.",
      details: {
        status: req.body?.status,
      },
      requestId,
    });
  }

  return next();
}

function validarPerguntaBody(req, res, next) {
  const requestId = gerarRequestId();
  const perguntaId = Number(req.body?.pergunta_id);

  if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Pergunta inválida.",
      code: "PERGUNTA_INVALIDA",
      adminHint: "O body deve conter pergunta_id como número inteiro positivo.",
      details: {
        pergunta_id: req.body?.pergunta_id,
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
 * Lista interações para administração.
 *
 * Filtros opcionais:
 * - ?tipo=votacao
 * - ?tipo=quiz
 * - ?tipo=nuvem_palavras
 * - ?status=publicada
 * - ?busca=...
 */
router.get("/admin", wrap(listarAdmin));

/**
 * Cria interação.
 *
 * Tipos oficiais:
 * - votacao
 * - quiz
 * - nuvem_palavras
 */
router.post("/admin", wrap(criarAdmin));

/**
 * Obtém interação completa para administração.
 */
router.get("/admin/:id", validarIdParam, wrap(obterAdmin));

/**
 * Atualiza interação completa.
 *
 * Observação:
 * - perguntas, opções e janelas enviadas substituem o conjunto anterior.
 */
router.put("/admin/:id", validarIdParam, wrap(atualizarAdmin));

/**
 * Altera somente o status da interação.
 */
router.patch(
  "/admin/:id/status",
  validarIdParam,
  validarStatusBody,
  wrap(alterarStatusAdmin)
);

/**
 * Exclui interação.
 *
 * Observação:
 * - exclusão remove perguntas, opções, janelas, execuções e respostas por cascade.
 * - se houver valor institucional, preferir arquivar.
 */
router.delete("/admin/:id", validarIdParam, wrap(excluirAdmin));

/* =========================================================================
   Rotas administrativas — execução ao vivo
=========================================================================== */

/**
 * Inicia execução ao vivo da interação.
 *
 * Principalmente para quiz.
 */
router.post(
  "/admin/:id/execucao/iniciar",
  validarIdParam,
  wrap(iniciarExecucaoAdmin)
);

/**
 * Abre uma pergunta para resposta.
 *
 * Body:
 * - pergunta_id
 */
router.post(
  "/admin/:id/pergunta/abrir",
  validarIdParam,
  validarPerguntaBody,
  wrap(abrirPerguntaAdmin)
);

/**
 * Fecha uma pergunta.
 *
 * Body:
 * - pergunta_id
 */
router.post(
  "/admin/:id/pergunta/fechar",
  validarIdParam,
  validarPerguntaBody,
  wrap(fecharPerguntaAdmin)
);

/**
 * Exibe gabarito de uma pergunta.
 *
 * Body:
 * - pergunta_id
 */
router.post(
  "/admin/:id/pergunta/gabarito",
  validarIdParam,
  validarPerguntaBody,
  wrap(exibirGabaritoAdmin)
);

/**
 * Obtém ranking/resultado da interação.
 *
 * Retorno varia por tipo:
 * - votação: ranking de opções;
 * - quiz: ranking de usuários;
 * - nuvem_palavras: palavras agregadas.
 */
router.get("/admin/:id/resultado", validarIdParam, wrap(resultadoAdmin));

/* =========================================================================
   Rotas de usuário autenticado
=========================================================================== */

/**
 * Lista interações publicadas/em andamento disponíveis ao usuário.
 */
router.get("/publicada", wrap(listarPublicadas));

/**
 * Obtém interação publicada/em andamento por ID.
 */
router.get("/:id", validarIdParam, wrap(obterPublicadaPorId));

/**
 * Responde interação.
 *
 * Votação:
 * - pergunta_id
 * - opcao_id
 * - latitude_usuario / longitude_usuario se geolocalização estiver ativa
 *
 * Quiz:
 * - pergunta_id
 * - opcao_id
 * - tempo_resposta_ms opcional
 *
 * Nuvem:
 * - pergunta_id
 * - resposta_texto
 */
router.post("/:id/responder", validarIdParam, wrap(responderPublicada));

module.exports = router;