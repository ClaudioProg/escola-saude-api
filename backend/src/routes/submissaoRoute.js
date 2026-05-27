/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/routes/submissaoRoute.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Rotas oficiais de SUBMISSÕES DE TRABALHOS.
 *
 * Mount oficial:
 * - app.use("/api/submissao", submissaoRoute);
 *
 * Responsabilidades deste router:
 * - submissões do usuário autenticado;
 * - detalhe de submissão;
 * - download de poster/arquivo da submissão;
 * - área do avaliador;
 * - administração de submissões;
 * - atribuição/revogação/restauração de avaliadores;
 * - avaliações escrita/oral;
 * - nota visível;
 * - status final;
 * - classificação por chamada.
 *
 * Fora deste router:
 * - CRUD de chamada;
 * - modelos de chamada;
 * - modelo banner/oral;
 * - votação pública;
 * - certificados de trabalhos.
 *
 * Contrato v2.0:
 * - sem /api/submissoes;
 * - sem aliases de compatibilidade;
 * - sem /chamadas/:id/modelo-banner;
 * - sem /chamadas/:id/modelo-oral;
 * - sem auth resiliente;
 * - sem authorize resiliente;
 * - sem pickFn;
 * - sem req.usuario;
 * - sem respostas { erro } ou { error };
 */

const express = require("express");
const { param, validationResult } = require("express-validator");

const router = express.Router();

const ctrl = require("../controllers/submissaoController");

const injectDb = require("../middlewares/injectDb");
const requireAuth = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

/* =========================================================================
   Guards estruturais
=========================================================================== */

if (typeof requireAuth !== "function") {
  throw new Error(
    "[submissaoRoute] authMiddleware oficial inválido. Esperado export direto como função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[submissaoRoute] authorize oficial inválido. Esperado export nomeado { authorize }."
  );
}

/* =========================================================================
   Helpers
=========================================================================== */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function criarErroValidacao(req, errors) {
  const err = new Error("Parâmetros inválidos.");
  err.status = 400;
  err.code = "PARAMETROS_INVALIDOS";
  err.adminHint =
    "A rota recebeu parâmetro fora do contrato oficial definido no express-validator.";
  err.details = errors.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
  }));
  err.requestId = req.requestId || req.rid || null;
  return err;
}

function validate(req, _res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return next(criarErroValidacao(req, errors));
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

const idParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("ID inválido.")
    .toInt(),
];

const chamadaIdParam = [
  param("chamadaId")
    .isInt({ min: 1 })
    .withMessage("chamadaId inválido.")
    .toInt(),
];

const requireAdmin = [requireAuth, authorize("administrador")];

/* =========================================================================
   Middlewares globais da rota
=========================================================================== */

router.use(injectDb);
router.use(noStore);

/* =========================================================================
   Usuário autenticado
=========================================================================== */

/**
 * Lista submissões do usuário autenticado.
 *
 * GET /api/submissao/minhas
 */
router.get(
  "/minhas",
  requireAuth,
  asyncHandler(ctrl.listarMinhas)
);

/**
 * Detalhe de submissão.
 *
 * Acesso permitido para:
 * - autor da submissão;
 * - avaliador vinculado;
 * - administrador.
 *
 * GET /api/submissao/:id
 */
router.get(
  "/:id(\\d+)",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.obterSubmissao)
);

/**
 * Download/visualização do poster/arquivo principal da submissão.
 *
 * Acesso permitido para:
 * - autor da submissão;
 * - avaliador vinculado;
 * - administrador.
 *
 * GET /api/submissao/:id/poster
 */
router.get(
  "/:id(\\d+)/poster",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.baixarPoster)
);

/* =========================================================================
   Avaliador
=========================================================================== */

/**
 * Lista submissões atribuídas ao avaliador autenticado.
 *
 * GET /api/submissao/avaliador/atribuida
 */
router.get(
  "/avaliador/atribuida",
  requireAuth,
  asyncHandler(ctrl.listarAtribuidas)
);

/**
 * Lista submissões pendentes do avaliador autenticado.
 *
 * GET /api/submissao/avaliador/pendente
 */
router.get(
  "/avaliador/pendente",
  requireAuth,
  asyncHandler(ctrl.listarPendentes)
);

/**
 * Contagens do avaliador autenticado.
 *
 * GET /api/submissao/avaliador/contagem
 */
router.get(
  "/avaliador/contagem",
  requireAuth,
  asyncHandler(ctrl.minhasContagens)
);

/**
 * Atalho oficial para submissões atribuídas ao avaliador.
 *
 * GET /api/submissao/avaliador/para-mim
 */
router.get(
  "/avaliador/para-mim",
  requireAuth,
  asyncHandler(ctrl.paraMim)
);

/**
 * Avaliação escrita feita pelo avaliador vinculado ou administrador.
 *
 * Body oficial:
 * {
 *   "status_resultado": "pendente" | "em_avaliacao" | "aprovado" | "reprovado",
 *   "itens": [
 *     {
 *       "criterio_id": 1,
 *       "nota": 8,
 *       "comentarios": "..."
 *     }
 *   ]
 * }
 *
 * POST /api/submissao/:id/avaliacao-escrita
 */
router.post(
  "/:id(\\d+)/avaliacao-escrita",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.avaliarEscrita)
);

/**
 * Avaliação oral feita pelo avaliador vinculado ou administrador.
 *
 * Body oficial:
 * {
 *   "status_resultado": "pendente" | "em_avaliacao" | "aprovado" | "reprovado",
 *   "itens": [
 *     {
 *       "criterio_id": 1,
 *       "nota": 8,
 *       "comentarios": "..."
 *     }
 *   ]
 * }
 *
 * POST /api/submissao/:id/avaliacao-oral
 */
router.post(
  "/:id(\\d+)/avaliacao-oral",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.avaliarOral)
);

/**
 * Lista avaliação/notas de uma submissão.
 *
 * Acesso permitido para:
 * - autor da submissão;
 * - avaliador vinculado;
 * - administrador.
 *
 * GET /api/submissao/:id/avaliacao
 */
router.get(
  "/:id(\\d+)/avaliacao",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.listarAvaliacaoDaSubmissao)
);

/* =========================================================================
   Administração — submissões
=========================================================================== */

/**
 * Lista administrativa de submissões.
 *
 * Filtros aceitos:
 * - chamada_id
 * - status
 *
 * GET /api/submissao/admin
 */
router.get(
  "/admin",
  ...requireAdmin,
  asyncHandler(ctrl.listarAdmin)
);

/**
 * Lista administrativa de submissões por chamada.
 *
 * GET /api/submissao/admin/chamada/:chamadaId
 */
router.get(
  "/admin/chamada/:chamadaId(\\d+)",
  ...requireAdmin,
  chamadaIdParam,
  validate,
  asyncHandler(ctrl.listarPorChamadaAdmin)
);

/**
 * Consolida classificação de uma chamada.
 *
 * GET /api/submissao/admin/chamada/:chamadaId/classificacao
 */
router.get(
  "/admin/chamada/:chamadaId(\\d+)/classificacao",
  ...requireAdmin,
  chamadaIdParam,
  validate,
  asyncHandler(ctrl.consolidarClassificacao)
);

/**
 * Resumo de avaliadores.
 *
 * GET /api/submissao/admin/avaliador/resumo
 */
router.get(
  "/admin/avaliador/resumo",
  ...requireAdmin,
  asyncHandler(ctrl.resumoAvaliadores)
);

/* =========================================================================
   Administração — avaliadores da submissão
=========================================================================== */

/**
 * Lista avaliadores vinculados a uma submissão.
 *
 * Filtro opcional:
 * - tipo=escrita|oral
 *
 * GET /api/submissao/admin/:id/avaliador
 */
router.get(
  "/admin/:id(\\d+)/avaliador",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.listarAvaliadores)
);

/**
 * Inclui avaliadores na submissão.
 *
 * Body oficial:
 * {
 *   "itens": [
 *     { "avaliador_id": 10, "tipo": "escrita" },
 *     { "avaliador_id": 11, "tipo": "oral" }
 *   ]
 * }
 *
 * POST /api/submissao/admin/:id/avaliador
 */
router.post(
  "/admin/:id(\\d+)/avaliador",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.incluirAvaliadores)
);

/**
 * Revoga avaliador da submissão.
 *
 * Body oficial:
 * {
 *   "avaliador_id": 10,
 *   "tipo": "escrita"
 * }
 *
 * DELETE /api/submissao/admin/:id/avaliador
 */
router.delete(
  "/admin/:id(\\d+)/avaliador",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.revogarAvaliador)
);

/**
 * Restaura avaliador revogado.
 *
 * Body oficial:
 * {
 *   "avaliador_id": 10,
 *   "tipo": "escrita"
 * }
 *
 * PATCH /api/submissao/admin/:id/avaliador/restauracao
 */
router.patch(
  "/admin/:id(\\d+)/avaliador/restauracao",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.restaurarAvaliador)
);

/* =========================================================================
   Administração — nota / status / materialização
=========================================================================== */

/**
 * Define se a nota ficará visível ao autor.
 *
 * Body oficial:
 * {
 *   "visivel": true
 * }
 *
 * PATCH /api/submissao/admin/:id/nota-visivel
 */
router.patch(
  "/admin/:id(\\d+)/nota-visivel",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.definirNotaVisivel)
);

/**
 * Define status final da submissão.
 *
 * Body oficial:
 * {
 *   "status": "aprovada" | "reprovada" | "cancelada" | ...,
 *   "motivo": "opcional"
 * }
 *
 * PATCH /api/submissao/admin/:id/status
 */
router.patch(
  "/admin/:id(\\d+)/status",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.definirStatusFinal)
);

/**
 * Recalcula/materializa notas da submissão.
 *
 * PATCH /api/submissao/admin/:id/nota
 */
router.patch(
  "/admin/:id(\\d+)/nota",
  ...requireAdmin,
  idParam,
  validate,
  asyncHandler(ctrl.atualizarNotaMediaMaterializada)
);

module.exports = router;