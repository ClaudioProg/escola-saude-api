"use strict";

/**
 * 📁 backend/src/routes/calendarioRoute.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Calendário institucional de bloqueios.
 *
 * Mount oficial:
 * - app.use("/api/calendario", calendarioRoute);
 *
 * Contratos oficiais:
 * - GET    /api/calendario
 * - POST   /api/calendario
 * - PUT    /api/calendario/:id
 * - DELETE /api/calendario/:id
 *
 * Query opcional em GET:
 * - tipo
 * - data_inicio
 * - data_fim
 *
 * Diretrizes v2.0:
 * - sem auth resiliente;
 * - sem authorize resiliente;
 * - sem req.usuario;
 * - sem resposta { erro };
 * - sem PATCH duplicando PUT;
 * - autenticação obrigatória;
 * - acesso restrito a administrador;
 * - cache no-store;
 * - rate limit com resposta padronizada.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("../auth/authMiddleware");
const calendarioController = require("../controllers/calendarioController");

const router = express.Router();

const { listar, criar, atualizar, excluir } = calendarioController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[calendarioRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listar,
  criar,
  atualizar,
  excluir,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[calendarioRoute] Controller inválido. Função ausente: ${nome}.`
    );
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function gerarRequestId() {
  return `calendario-route-${Date.now().toString(36)}-${Math.random()
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

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

function requireAdministrador(req, res, next) {
  const requestId = gerarRequestId();
  const perfil = String(req.user?.perfil || "").trim().toLowerCase();

  if (perfil !== "administrador") {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Acesso permitido apenas para administradores.",
      code: "ACESSO_ADMINISTRADOR_OBRIGATORIO",
      adminHint:
        "Verifique se o middleware de autenticação popula req.user.perfil com o valor oficial 'administrador'.",
      details: {
        perfil: perfil || null,
      },
      requestId,
    });
  }

  return next();
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

/* =========================================================================
   Rate limit
=========================================================================== */

const calendarioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  handler: (req, res) => {
    const requestId = gerarRequestId();

    return res.status(429).json({
      ok: false,
      data: null,
      message: "Muitas requisições. Aguarde alguns instantes e tente novamente.",
      code: "RATE_LIMIT_CALENDARIO",
      adminHint:
        "Rate limit aplicado ao módulo de calendário institucional.",
      details: {
        usuario_id: req.user?.id || null,
      },
      requestId,
    });
  },
});

/* =========================================================================
   Middlewares globais
=========================================================================== */

router.use(authMiddleware);
router.use(requireAdministrador);
router.use(noStore);
router.use(calendarioLimiter);

/* =========================================================================
   Rotas oficiais
=========================================================================== */

/**
 * Lista bloqueios de calendário.
 *
 * Query opcional:
 * - tipo
 * - data_inicio
 * - data_fim
 */
router.get("/", wrap(listar));

/**
 * Cria bloqueio de calendário.
 */
router.post("/", wrap(criar));

/**
 * Atualiza bloqueio de calendário.
 */
router.put("/:id", validarIdParam, wrap(atualizar));

/**
 * Exclui bloqueio de calendário.
 */
router.delete("/:id", validarIdParam, wrap(excluir));

module.exports = router;