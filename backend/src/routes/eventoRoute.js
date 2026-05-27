/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/eventoRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Domínio:
 * - Eventos
 * - Cadastro administrativo de eventos
 * - Publicação/despublicação
 * - Upload de folder/programação
 * - Listagens públicas/autenticadas
 * - Auxiliares administrativos de eventos
 *
 * Mount oficial:
 * - /api/evento
 *
 * Contratos oficiais:
 * - authMiddleware exportado de ../auth/authMiddleware como função;
 * - authorize exportado de ../middlewares/authorize como função nomeada;
 * - perfil administrativo oficial: "administrador";
 * - controller público oficial: ../controllers/eventoPublicoController;
 * - controller administrativo oficial: ../controllers/eventoAdminController;
 * - turmas NÃO são servidas por esta rota; usar /api/turma.
 *
 * Rotas oficiais deste arquivo:
 * - GET    /api/evento/:id/folder
 * - GET    /api/evento/:id/programacao
 * - GET    /api/evento/para-mim
 * - GET    /api/evento/agenda
 * - GET    /api/evento/organizador
 * - GET    /api/evento/administrador
 * - GET    /api/evento/organizador/disponivel
 * - GET    /api/evento
 * - GET    /api/evento/:id
 * - POST   /api/evento
 * - PUT    /api/evento/:id
 * - DELETE /api/evento/:id
 * - POST   /api/evento/:id/publicar
 * - POST   /api/evento/:id/despublicar
 * - POST   /api/evento/:id/arquivo
 * - POST   /api/evento/:id/folder
 * - POST   /api/evento/:id/programacao
 *
 * Sem aliases:
 * - sem /eventos;
 * - sem /api/evento/:id/turma;
 * - sem /api/evento/:id/turma/simples;
 * - sem /api/evento/turma/:id/data;
 * - sem fallback legado;
 * - sem parsing flexível de perfil;
 * - sem autenticação resiliente;
 * - sem autorização resiliente.
 */

const express = require("express");

const eventoPublicoController = require("../controllers/eventoPublicoController");
const eventoAdminController = require("../controllers/eventoAdminController");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const router = express.Router();

/* ───────────────────────────────────────────────────────────────
   Validação de contratos críticos
─────────────────────────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[eventoRoute] Contrato inválido: ../auth/authMiddleware deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[eventoRoute] Contrato inválido: ../middlewares/authorize deve expor { authorize } como função."
  );
}

const REQUIRED_PUBLIC_HANDLERS = [
  "obterFolderDoEvento",
  "obterProgramacaoDoEvento",
  "listarEventosParaMim",
  "getAgendaEventos",
  "listarEventosDoorganizador",
  "listarEventos",
  "buscarEventoPorId",
];

for (const fnName of REQUIRED_PUBLIC_HANDLERS) {
  if (typeof eventoPublicoController[fnName] !== "function") {
    throw new Error(
      `[eventoRoute] Contrato inválido: eventoPublicoController.${fnName} deve existir como função.`
    );
  }
}

const REQUIRED_ADMIN_HANDLERS = [
  "uploadEventos",
  "uploadFolderOnly",
  "uploadProgramacaoOnly",
  "listarEventosAdmin",
  "criarEvento",
  "atualizarEvento",
  "excluirEvento",
  "publicarEvento",
  "despublicarEvento",
  "atualizarArquivosDoEvento",
  "listarOrganizadoresDisponiveis",
];

for (const fnName of REQUIRED_ADMIN_HANDLERS) {
  if (typeof eventoAdminController[fnName] !== "function") {
    throw new Error(
      `[eventoRoute] Contrato inválido: eventoAdminController.${fnName} deve existir como função.`
    );
  }
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

    if (cacheControl !== null) {
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
   Arquivos públicos do evento
   Importante: precisam vir antes de "/:id"
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id/folder",
  ensureNumericParam("id", "evento_id"),
  routeTag("eventoRoute:v2.1 GET /:id/folder", {
    cacheControl: null,
  }),
  asyncHandler(eventoPublicoController.obterFolderDoEvento)
);

router.get(
  "/:id/programacao",
  ensureNumericParam("id", "evento_id"),
  routeTag("eventoRoute:v2.1 GET /:id/programacao", {
    cacheControl: null,
  }),
  asyncHandler(eventoPublicoController.obterProgramacaoDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   Eventos do usuário autenticado
─────────────────────────────────────────────────────────────── */

router.get(
  "/para-mim",
  authMiddleware,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /para-mim", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarEventosParaMim)
);

/* ───────────────────────────────────────────────────────────────
   Agenda e visão do organizador
─────────────────────────────────────────────────────────────── */

router.get(
  "/agenda",
  authMiddleware,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /agenda", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.getAgendaEventos)
);

router.get(
  "/organizador",
  authMiddleware,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /organizador", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarEventosDoorganizador)
);

/* ───────────────────────────────────────────────────────────────
   Lista administrativa
─────────────────────────────────────────────────────────────── */

router.get(
  "/administrador",
  authMiddleware,
  requireAdmin,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /administrador", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoAdminController.listarEventosAdmin)
);

/* ───────────────────────────────────────────────────────────────
   Auxiliares administrativos
─────────────────────────────────────────────────────────────── */

router.get(
  "/organizador/disponivel",
  authMiddleware,
  requireAdmin,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /organizador/disponivel", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoAdminController.listarOrganizadoresDisponiveis)
);

/* ───────────────────────────────────────────────────────────────
   Lista pública/autenticada
   Observação:
   - Administrador que quiser visão administrativa usa /administrador.
   - Esta rota mantém a visão pública/autenticada.
─────────────────────────────────────────────────────────────── */

router.get(
  "/",
  authMiddleware,
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.listarEventos)
);

/* ───────────────────────────────────────────────────────────────
   Publicar / despublicar evento
   Importante: antes de GET /:id.
─────────────────────────────────────────────────────────────── */

router.post(
  "/:id/publicar",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 POST /:id/publicar", {
    cacheControl: "no-store",
  }),
  asyncHandler(eventoAdminController.publicarEvento)
);

router.post(
  "/:id/despublicar",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 POST /:id/despublicar", {
    cacheControl: "no-store",
  }),
  asyncHandler(eventoAdminController.despublicarEvento)
);

/* ───────────────────────────────────────────────────────────────
   Upload de arquivos do evento
─────────────────────────────────────────────────────────────── */

router.post(
  "/:id/arquivo",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 POST /:id/arquivo", {
    cacheControl: "no-store",
  }),
  eventoAdminController.uploadEventos,
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/folder",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 POST /:id/folder", {
    cacheControl: "no-store",
  }),
  eventoAdminController.uploadFolderOnly,
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
);

router.post(
  "/:id/programacao",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 POST /:id/programacao", {
    cacheControl: "no-store",
  }),
  eventoAdminController.uploadProgramacaoOnly,
  asyncHandler(eventoAdminController.atualizarArquivosDoEvento)
);

/* ───────────────────────────────────────────────────────────────
   Buscar evento por ID
   Deve ficar depois das rotas específicas.
─────────────────────────────────────────────────────────────── */

router.get(
  "/:id",
  authMiddleware,
  ensureNumericParam("id", "evento_id"),
  privateNoCache,
  routeTag("eventoRoute:v2.1 GET /:id", {
    cacheControl: "private, no-cache, must-revalidate",
  }),
  asyncHandler(eventoPublicoController.buscarEventoPorId)
);

/* ───────────────────────────────────────────────────────────────
   Cadastro administrativo de evento
─────────────────────────────────────────────────────────────── */

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  noStore,
  routeTag("eventoRoute:v2.1 POST /", {
    cacheControl: "no-store",
  }),
  eventoAdminController.uploadEventos,
  asyncHandler(eventoAdminController.criarEvento)
);

router.put(
  "/:id",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 PUT /:id", {
    cacheControl: "no-store",
  }),
  eventoAdminController.uploadEventos,
  asyncHandler(eventoAdminController.atualizarEvento)
);

router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  ensureNumericParam("id", "evento_id"),
  noStore,
  routeTag("eventoRoute:v2.1 DELETE /:id", {
    cacheControl: "no-store",
  }),
  asyncHandler(eventoAdminController.excluirEvento)
);

module.exports = router;