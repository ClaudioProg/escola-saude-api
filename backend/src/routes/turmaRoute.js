"use strict";

/**
 * ✅ backend/src/routes/turmaRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do domínio de turmas.
 *
 * Mount oficial:
 * - /api/turma
 *
 * Contratos oficiais:
 * - authMiddleware exportado de ../auth/authMiddleware como função;
 * - authorize exportado de ../middlewares/authorize como função nomeada;
 * - perfil administrativo oficial: "administrador";
 * - controller oficial: ../controllers/turmaController;
 * - tabela oficial de inscrições: inscricoes;
 * - datas oficiais: datas_turma;
 * - responsáveis oficiais: turma_responsavel;
 * - palestrantes oficiais: turma_palestrante;
 * - assinantes oficiais: turma_certificado_assinante;
 * - resposta padrão dos controllers: ok/message/data/meta.
 *
 * Rotas oficiais:
 * - GET    /api/turma/administrador
 * - GET    /api/turma/com-usuario
 * - POST   /api/turma
 * - GET    /api/turma/:id
 * - PUT    /api/turma/:id
 * - DELETE /api/turma/:id
 * - GET    /api/turma/evento/:id
 * - GET    /api/turma/evento/:id/simples
 * - GET    /api/turma/:id/organizador
 * - POST   /api/turma/:id/organizador
 * - GET    /api/turma/:id/data
 * - GET    /api/turma/:id/ocorrencia
 * - GET    /api/turma/:id/detalhe
 * - GET    /api/turma/:id/inscrito
 *
 * Sem aliases:
 * - sem /admin;
 * - sem /turmas;
 * - sem /eventos/:id/turmas-simples;
 * - sem /turmas-com-usuarios;
 * - sem safeHandler;
 * - sem controller legado de administrador;
 * - sem fallback de auth/authorize.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const turmaController = require("../controllers/turmaController");
const inscricaoController = require("../controllers/inscricaoController");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const router = express.Router();

/* ───────────────────────────────────────────────────────────────
   Validação de contrato
─────────────────────────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[turmaRoute] Contrato inválido: ../auth/authMiddleware deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[turmaRoute] Contrato inválido: ../middlewares/authorize deve expor { authorize } como função."
  );
}

const REQUIRED_TURMA_HANDLERS = [
  "criar",
  "atualizar",
  "excluir",
  "obter",

  "listarPorEvento",
  "listarPorEventoSimples",
  "listarAdmin",
  "listarComUsuario",

  "listarDatasDaTurma",
  "listarOcorrenciasTurma",

  "adicionarOrganizador",
  "listarOrganizadores",
  "obterDetalhe",
];

for (const fnName of REQUIRED_TURMA_HANDLERS) {
  if (typeof turmaController[fnName] !== "function") {
    throw new Error(
      `[turmaRoute] Contrato inválido: turmaController.${fnName} deve existir como função.`
    );
  }
}

if (typeof inscricaoController.listarInscritosPorTurma !== "function") {
  throw new Error(
    "[turmaRoute] Contrato inválido: inscricaoController.listarInscritosPorTurma deve existir como função."
  );
}

const requireAdmin = authorize("administrador");

/* ───────────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag, options = {}) {
  const { cacheControl = "no-store" } = options;

  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);

    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }

    if (cacheControl === "no-store") {
      res.setHeader("Pragma", "no-cache");
    }

    return next();
  };
}

function ensureNumericParam(paramName, label = paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({
        ok: false,
        code: "PARAMETRO_INVALIDO",
        message: `${label} inválido.`,
      });
    }

    req.params[paramName] = String(Math.trunc(n));
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

function privateNoCache(_req, res, next) {
  res.setHeader("Cache-Control", "private, no-cache, must-revalidate");
  return next();
}

/* ───────────────────────────────────────────────────────────────
   Rate limit
─────────────────────────────────────────────────────────────── */

const adminListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "MUITAS_REQUISICOES",
    message: "Muitas requisições. Aguarde alguns instantes.",
  },
});

/* ───────────────────────────────────────────────────────────────
   Autenticação global
─────────────────────────────────────────────────────────────── */

router.use(authMiddleware);

/* ───────────────────────────────────────────────────────────────
   Administração
─────────────────────────────────────────────────────────────── */

router.get(
  "/administrador",
  requireAdmin,
  noStore,
  routeTag("turmaRoute:v2.1 GET /administrador"),
  adminListLimiter,
  asyncHandler(turmaController.listarAdmin)
);

router.get(
  "/com-usuario",
  requireAdmin,
  noStore,
  routeTag("turmaRoute:v2.1 GET /com-usuario"),
  asyncHandler(turmaController.listarComUsuario)
);

/* ───────────────────────────────────────────────────────────────
   Turmas por evento
   Importante: vêm antes de /:id
─────────────────────────────────────────────────────────────── */

router.get(
  "/evento/:id",
  ensureNumericParam("id", "evento_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /evento/:id", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarPorEvento)
);

router.get(
  "/evento/:id/simples",
  ensureNumericParam("id", "evento_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /evento/:id/simples", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarPorEventoSimples)
);

/* ───────────────────────────────────────────────────────────────
   CRUD administrativo
─────────────────────────────────────────────────────────────── */

router.post(
  "/",
  requireAdmin,
  noStore,
  routeTag("turmaRoute:v2.1 POST /"),
  asyncHandler(turmaController.criar)
);

router.put(
  "/:id",
  requireAdmin,
  ensureNumericParam("id", "turma_id"),
  noStore,
  routeTag("turmaRoute:v2.1 PUT /:id"),
  asyncHandler(turmaController.atualizar)
);

router.delete(
  "/:id",
  requireAdmin,
  ensureNumericParam("id", "turma_id"),
  noStore,
  routeTag("turmaRoute:v2.1 DELETE /:id"),
  asyncHandler(turmaController.excluir)
);

/* ───────────────────────────────────────────────────────────────
   Organizadores da turma
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id/organizador",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id/organizador", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarOrganizadores)
);

router.post(
  "/:id/organizador",
  requireAdmin,
  ensureNumericParam("id", "turma_id"),
  noStore,
  routeTag("turmaRoute:v2.1 POST /:id/organizador"),
  asyncHandler(turmaController.adicionarOrganizador)
);

/* ───────────────────────────────────────────────────────────────
   Datas e ocorrências
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id/data",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id/data", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarDatasDaTurma)
);

router.get(
  "/:id/ocorrencia",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id/ocorrencia", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.listarOcorrenciasTurma)
);

/* ───────────────────────────────────────────────────────────────
   Detalhe e inscritos
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id/detalhe",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id/detalhe", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.obterDetalhe)
);

router.get(
  "/:id/inscrito",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id/inscrito", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(inscricaoController.listarInscritosPorTurma)
);

/* ───────────────────────────────────────────────────────────────
   Obter turma por ID
   Deve ficar depois das rotas específicas.
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id",
  ensureNumericParam("id", "turma_id"),
  privateNoCache,
  routeTag("turmaRoute:v2.1 GET /:id", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(turmaController.obter)
);

module.exports = router;