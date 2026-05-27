/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/authPublicRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas públicas oficiais de autenticação inicial.
 *
 * Mount oficial:
 * - /api/auth
 *
 * Rotas oficiais:
 * - POST /api/auth/cadastro
 * - POST /api/auth/esqueci-senha
 * - POST /api/auth/redefinir-senha
 *
 * Contrato oficial:
 * - Redefinição de senha recebe o token no body.
 * - Não existe rota paralela /redefinir-senha/:token.
 *
 * Padrão:
 * - Português.
 * - Singular quando aplicável.
 * - Sem aliases legados.
 * - Sem múltiplas possibilidades de controller.
 * - Diagnóstico por X-Route-Handler.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const authUsuarioController = require("../controllers/authUsuarioController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contrato obrigatório
────────────────────────────────────────────────────────────── */

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[authPublicRoute] Handler obrigatório ausente: authUsuarioController.${name}`
    );
  }
}

assertHandler("cadastrar", authUsuarioController.cadastrar);
assertHandler("recuperarSenha", authUsuarioController.recuperarSenha);
assertHandler("redefinirSenha", authUsuarioController.redefinirSenha);

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

function rateLimitMessage(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}

/* ─────────────────────────────────────────────────────────────
   Rate limits públicos
────────────────────────────────────────────────────────────── */

const cadastroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "AUTH-429-CADASTRO-LIMITE",
    "Muitas tentativas de cadastro. Aguarde antes de tentar novamente."
  ),
});

const recuperarSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "AUTH-429-RECUPERACAO-SENHA-LIMITE",
    "Muitas solicitações de recuperação de senha. Aguarde antes de tentar novamente."
  ),
});

const redefinirSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "AUTH-429-REDEFINICAO-SENHA-LIMITE",
    "Muitas tentativas de redefinição de senha. Aguarde antes de tentar novamente."
  ),
});

/* ─────────────────────────────────────────────────────────────
   Rotas oficiais
────────────────────────────────────────────────────────────── */

/**
 * POST /api/auth/cadastro
 */
router.post(
  "/cadastro",
  cadastroLimiter,
  noStore,
  routeTag("authPublicRoute:v2.0:POST /cadastro"),
  asyncHandler(authUsuarioController.cadastrar)
);

/**
 * POST /api/auth/esqueci-senha
 */
router.post(
  "/esqueci-senha",
  recuperarSenhaLimiter,
  noStore,
  routeTag("authPublicRoute:v2.0:POST /esqueci-senha"),
  asyncHandler(authUsuarioController.recuperarSenha)
);

/**
 * POST /api/auth/redefinir-senha
 *
 * Body oficial esperado pelo controller/service:
 * {
 *   "token": "token-recebido-por-email",
 *   "novaSenha": "nova-senha"
 * }
 */
router.post(
  "/redefinir-senha",
  redefinirSenhaLimiter,
  noStore,
  routeTag("authPublicRoute:v2.0:POST /redefinir-senha"),
  asyncHandler(authUsuarioController.redefinirSenha)
);

/* ─────────────────────────────────────────────────────────────
   HEAD oficiais para diagnóstico/warmup
────────────────────────────────────────────────────────────── */

router.head("/cadastro", noStore, (_req, res) => res.sendStatus(204));
router.head("/esqueci-senha", noStore, (_req, res) => res.sendStatus(204));
router.head("/redefinir-senha", noStore, (_req, res) => res.sendStatus(204));

module.exports = router;