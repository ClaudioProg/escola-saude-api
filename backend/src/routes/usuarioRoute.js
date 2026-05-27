/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/usuarioRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas autenticadas oficiais de usuário.
 *
 * Mount oficial:
 * - /api/usuario
 *
 * Padrão:
 * - Português.
 * - Singular.
 * - Sem aliases legados.
 * - Sem usuario/usuarios/user/users simultâneos.
 * - Sem exclusão física de usuário.
 * - Sem fallback de nomes de controller.
 * - Sem PUT/PATCH duplicados para o mesmo fluxo.
 *
 * Perfil administrativo oficial:
 * - administrador
 *
 * Contrato oficial de autenticação:
 * - req.user = { id, perfil }
 * - req.userId = number
 * - req.perfil = "usuario" | "organizador" | "administrador"
 *
 * Controllers separados:
 * - usuarioController: gestão de usuários.
 * - usuarioAssinaturaController: assinatura.
 * - usuarioEstatisticaController: estatísticas.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const requireAuth = require("../auth/authMiddleware");

const usuarioController = require("../controllers/usuarioController");
const usuarioAssinaturaController = require("../controllers/usuarioAssinaturaController");
const usuarioEstatisticaController = require("../controllers/usuarioEstatisticaController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (typeof requireAuth !== "function") {
  throw new Error("[usuarioRoute] authMiddleware deve exportar uma função.");
}

function assertHandler(controllerName, name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[usuarioRoute] Handler obrigatório ausente: ${controllerName}.${name}`
    );
  }
}

[
  "listar",
  "obterPorId",
  "buscar",
  "atualizarBasico",
  "atualizarDadosAdministrativos",
  "atualizarPerfilInstitucional",
  "atualizarPerfil",
  "listarorganizador",
  "listarAvaliador",
  "obterResumo",
].forEach((name) =>
  assertHandler("usuarioController", name, usuarioController[name])
);

assertHandler(
  "usuarioAssinaturaController",
  "obterAssinatura",
  usuarioAssinaturaController.obterAssinatura
);

assertHandler(
  "usuarioEstatisticaController",
  "obterEstatistica",
  usuarioEstatisticaController.obterEstatistica
);

assertHandler(
  "usuarioEstatisticaController",
  "obterEstatisticaDetalhada",
  usuarioEstatisticaController.obterEstatisticaDetalhada
);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

function getPerfil(req) {
  return String(req?.perfil || req?.user?.perfil || "").trim();
}

function getUserId(req) {
  const id = Number(req?.userId || req?.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isAdministrador(req) {
  return getPerfil(req) === "administrador";
}

function buildRouteLog(req, extra = {}) {
  return {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    userId: getUserId(req),
    perfil: getPerfil(req) || null,
    ...extra,
  };
}

function buildEtag(data) {
  const digest = crypto
    .createHash("sha1")
    .update(JSON.stringify(data))
    .digest("base64");

  return `"usuario-${digest}"`;
}

function validarId(req, res, next) {
  const rawId = req.params.id;

  if (!/^\d+$/.test(String(rawId))) {
    return res.status(400).json({
      ok: false,
      code: "USUARIO-400-ID-INVALIDO",
      message: "ID inválido.",
    });
  }

  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      code: "USUARIO-400-ID-INVALIDO",
      message: "ID inválido.",
    });
  }

  req.params.id = String(id);
  return next();
}

function requireAdmin(req, res, next) {
  if (!isAdministrador(req)) {
    console.warn("[usuarioRoute.requireAdmin] acesso negado", buildRouteLog(req));

    return res.status(403).json({
      ok: false,
      code: "USUARIO-403-ADMINISTRADOR-NECESSARIO",
      message: "Acesso negado.",
      adminHint: "Esta rota exige o perfil oficial administrador.",
    });
  }

  return next();
}

function requireMesmoUsuarioOuAdmin(req, res, next) {
  const usuarioAutenticadoId = getUserId(req);
  const usuarioAlvoId = Number(req.params.id);

  if (!usuarioAutenticadoId) {
    return res.status(401).json({
      ok: false,
      code: "USUARIO-401-NAO-AUTENTICADO",
      message: "Não autenticado.",
    });
  }

  if (isAdministrador(req) || usuarioAutenticadoId === usuarioAlvoId) {
    return next();
  }

  console.warn(
    "[usuarioRoute.requireMesmoUsuarioOuAdmin] acesso negado",
    buildRouteLog(req, {
      usuarioAutenticadoId,
      usuarioAlvoId,
    })
  );

  return res.status(403).json({
    ok: false,
    code: "USUARIO-403-ACESSO-NEGADO",
    message: "Você não tem permissão para acessar este usuário.",
  });
}

function sendCachedData(handler) {
  return asyncHandler(async (req, res) => {
    const data = await handler(req, res, { internal: true, preview: false });
    if (res.headersSent) return;

    const etag = buildEtag(data ?? null);

    res.setHeader("ETag", etag);
    res.setHeader(
      "Cache-Control",
      "private, max-age=120, stale-while-revalidate=600"
    );

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({
      ok: true,
      gerado_em: new Date().toISOString(),
      data,
    });
  });
}

function sendCachedHead(handler) {
  return asyncHandler(async (req, res) => {
    const data = await handler(req, res, { internal: true, preview: true });
    if (res.headersSent) return;

    const etag = buildEtag(data ?? null);

    res.setHeader("ETag", etag);
    res.setHeader(
      "Cache-Control",
      "private, max-age=120, stale-while-revalidate=600"
    );

    return res.status(200).end();
  });
}

/* ─────────────────────────────────────────────────────────────
   Rate limits
────────────────────────────────────────────────────────────── */

const usuarioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "USUARIO-429-LIMITE",
    message: "Muitas requisições. Aguarde antes de tentar novamente.",
  },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "USUARIO-429-ADMIN-LIMITE",
    message: "Muitas requisições administrativas. Aguarde antes de tentar novamente.",
  },
});

const estatisticaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "USUARIO-429-ESTATISTICA-LIMITE",
    message: "Muitas consultas de estatística. Aguarde antes de tentar novamente.",
  },
});

/* ─────────────────────────────────────────────────────────────
   Todas as rotas deste arquivo exigem autenticação
────────────────────────────────────────────────────────────── */

router.use(requireAuth, usuarioLimiter, noStore);

/* ─────────────────────────────────────────────────────────────
   Rotas autenticadas compartilhadas
────────────────────────────────────────────────────────────── */

/**
 * GET /api/usuario/buscar
 */
router.get(
  "/buscar",
  routeTag("usuarioRoute:v2.0:GET /buscar"),
  asyncHandler(usuarioController.buscar)
);

/**
 * GET /api/usuario/assinatura
 */
router.get(
  "/assinatura",
  routeTag("usuarioRoute:v2.0:GET /assinatura"),
  asyncHandler(usuarioAssinaturaController.obterAssinatura)
);

/**
 * GET /api/usuario/:id
 *
 * Permitido:
 * - próprio usuário
 * - administrador
 */
router.get(
  "/:id(\\d+)",
  routeTag("usuarioRoute:v2.0:GET /:id"),
  validarId,
  requireMesmoUsuarioOuAdmin,
  asyncHandler(usuarioController.obterPorId)
);

/**
 * PATCH /api/usuario/:id/basico
 *
 * Permitido:
 * - próprio usuário
 * - administrador
 */
router.patch(
  "/:id(\\d+)/basico",
  routeTag("usuarioRoute:v2.0:PATCH /:id/basico"),
  validarId,
  requireMesmoUsuarioOuAdmin,
  asyncHandler(usuarioController.atualizarBasico)
);

/**
 * PATCH /api/usuario/:id/perfil-institucional
 *
 * Permitido:
 * - próprio usuário
 * - administrador
 */
router.patch(
  "/:id(\\d+)/perfil-institucional",
  routeTag("usuarioRoute:v2.0:PATCH /:id/perfil-institucional"),
  validarId,
  requireMesmoUsuarioOuAdmin,
  asyncHandler(usuarioController.atualizarPerfilInstitucional)
);

/* ─────────────────────────────────────────────────────────────
   Rotas administrativas
────────────────────────────────────────────────────────────── */

/**
 * GET /api/usuario
 */
router.get(
  "/",
  routeTag("usuarioRoute:v2.0:GET /"),
  requireAdmin,
  adminLimiter,
  asyncHandler(usuarioController.listar)
);

/**
 * PATCH /api/usuario/:id/dados-administrativos
 */
router.patch(
  "/:id(\\d+)/dados-administrativos",
  routeTag("usuarioRoute:v2.0:PATCH /:id/dados-administrativos"),
  requireAdmin,
  adminLimiter,
  validarId,
  asyncHandler(usuarioController.atualizarDadosAdministrativos)
);

/**
 * PATCH /api/usuario/:id/perfil
 */
router.patch(
  "/:id(\\d+)/perfil",
  routeTag("usuarioRoute:v2.0:PATCH /:id/perfil"),
  requireAdmin,
  adminLimiter,
  validarId,
  asyncHandler(usuarioController.atualizarPerfil)
);

/**
 * GET /api/usuario/organizador
 */
router.get(
  "/organizador",
  routeTag("usuarioRoute:v2.0:GET /organizador"),
  requireAdmin,
  adminLimiter,
  asyncHandler(usuarioController.listarorganizador)
);

/**
 * GET /api/usuario/avaliador
 */
router.get(
  "/avaliador",
  routeTag("usuarioRoute:v2.0:GET /avaliador"),
  requireAdmin,
  adminLimiter,
  asyncHandler(usuarioController.listarAvaliador)
);

/**
 * GET /api/usuario/:id/resumo
 */
router.get(
  "/:id(\\d+)/resumo",
  routeTag("usuarioRoute:v2.0:GET /:id/resumo"),
  requireAdmin,
  adminLimiter,
  validarId,
  asyncHandler(usuarioController.obterResumo)
);

/* ─────────────────────────────────────────────────────────────
   Estatística administrativa
────────────────────────────────────────────────────────────── */

/**
 * GET /api/usuario/estatistica
 */
router.get(
  "/estatistica",
  routeTag("usuarioRoute:v2.0:GET /estatistica"),
  requireAdmin,
  estatisticaLimiter,
  sendCachedData(usuarioEstatisticaController.obterEstatistica)
);

/**
 * HEAD /api/usuario/estatistica
 */
router.head(
  "/estatistica",
  routeTag("usuarioRoute:v2.0:HEAD /estatistica"),
  requireAdmin,
  estatisticaLimiter,
  sendCachedHead(usuarioEstatisticaController.obterEstatistica)
);

/**
 * GET /api/usuario/estatistica/detalhe
 */
router.get(
  "/estatistica/detalhe",
  routeTag("usuarioRoute:v2.0:GET /estatistica/detalhe"),
  requireAdmin,
  estatisticaLimiter,
  sendCachedData(usuarioEstatisticaController.obterEstatisticaDetalhada)
);

module.exports = router;