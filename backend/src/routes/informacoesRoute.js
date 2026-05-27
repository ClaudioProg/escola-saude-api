"use strict";

/**
 * ✅ backend/src/routes/informacoesRoute.js — v2.1
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Módulo:
 * - Informações institucionais / publicações.
 *
 * Mount oficial:
 * - app.use("/api/informacoes", informacoesRoute);
 *
 * Rotas públicas:
 * - GET  /api/informacoes/publicadas
 * - HEAD /api/informacoes/publicadas
 *
 * Rotas administrativas:
 * - GET    /api/informacoes
 * - GET    /api/informacoes/:id
 * - POST   /api/informacoes
 * - PUT    /api/informacoes/:id
 * - PATCH  /api/informacoes/:id/ativo
 * - DELETE /api/informacoes/:id
 *
 * Diretrizes v2.1:
 * - sem auth resiliente;
 * - sem authorize resiliente;
 * - sem req.usuario;
 * - sem resposta { mensagem };
 * - sem aliases de rota;
 * - resposta padrão ok/data/message/code/meta;
 * - erro padrão ok:false/data:null/message/code/adminHint/details/requestId;
 * - upload em memória via uploadInformacaoImagem;
 * - cache público curto para publicadas;
 * - no-store para administração.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const { uploadInformacaoImagem } = require("../middlewares/uploadInformacoes");

const {
  getInformacoesPublicadas,
  getInformacoesAdmin,
  getInformacaoById,
  postInformacao,
  putInformacao,
  patchAtivoInformacao,
  deleteInformacao,
} = require("../controllers/informacoesController");

const router = express.Router();

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[informacoesRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[informacoesRoute] authorize inválido. O export oficial de ../middlewares/authorize deve expor { authorize } como função."
  );
}

if (typeof uploadInformacaoImagem !== "function") {
  throw new Error(
    "[informacoesRoute] uploadInformacaoImagem inválido. Verifique ../middlewares/uploadInformacoes."
  );
}

for (const [nome, handler] of Object.entries({
  getInformacoesPublicadas,
  getInformacoesAdmin,
  getInformacaoById,
  postInformacao,
  putInformacao,
  patchAtivoInformacao,
  deleteInformacao,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[informacoesRoute] Controller inválido. Função ausente: ${nome}.`
    );
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function gerarRequestId() {
  return `informacoes-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
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

function setPublicCache(_req, res, next) {
  res.setHeader(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300"
  );
  return next();
}

function setPrivateNoStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* =========================================================================
   Rate limits
=========================================================================== */

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.ip),
  handler: (_req, res) => {
    const requestId = gerarRequestId();

    return res.status(429).json({
      ok: false,
      data: null,
      message: "Muitas requisições. Aguarde alguns instantes e tente novamente.",
      code: "RATE_LIMIT_INFORMACOES_PUBLICAS",
      adminHint: "Rate limit aplicado à listagem pública de informações.",
      details: null,
      requestId,
    });
  },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  handler: (req, res) => {
    const requestId = gerarRequestId();

    return res.status(429).json({
      ok: false,
      data: null,
      message: "Muitas requisições administrativas. Aguarde e tente novamente.",
      code: "RATE_LIMIT_INFORMACOES_ADMIN",
      adminHint: "Rate limit aplicado ao módulo administrativo de informações.",
      details: {
        usuario_id: req.user?.id || null,
      },
      requestId,
    });
  },
});

/* =========================================================================
   Rotas públicas
=========================================================================== */

/**
 * Lista publicações ativas para exibição pública.
 */
router.get(
  "/publicadas",
  publicLimiter,
  setPublicCache,
  wrap(getInformacoesPublicadas)
);

/**
 * Health/check leve da rota pública.
 */
router.head(
  "/publicadas",
  publicLimiter,
  setPublicCache,
  (_req, res) => res.sendStatus(204)
);

/* =========================================================================
   Rotas administrativas
=========================================================================== */

router.use(authMiddleware);
router.use(authorize("administrador"));
router.use(setPrivateNoStore);
router.use(adminLimiter);

/**
 * Lista todas as informações para administração.
 */
router.get("/", wrap(getInformacoesAdmin));

/**
 * Busca informação por ID.
 */
router.get("/:id", validarIdParam, wrap(getInformacaoById));

/**
 * Cria informação.
 *
 * Upload:
 * - multipart/form-data
 * - campo: imagem
 */
router.post(
  "/",
  uploadInformacaoImagem,
  wrap(postInformacao)
);

/**
 * Atualiza informação.
 *
 * Upload:
 * - multipart/form-data
 * - campo: imagem
 */
router.put(
  "/:id",
  validarIdParam,
  uploadInformacaoImagem,
  wrap(putInformacao)
);

/**
 * Ativa/desativa informação.
 *
 * Body:
 * - ativo: boolean
 */
router.patch(
  "/:id/ativo",
  validarIdParam,
  wrap(patchAtivoInformacao)
);

/**
 * Exclui informação.
 */
router.delete(
  "/:id",
  validarIdParam,
  wrap(deleteInformacao)
);

module.exports = router;