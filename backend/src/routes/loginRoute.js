/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/loginRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rota pública oficial de login.
 *
 * Mount oficial:
 * - /api/login
 *
 * Contrato obrigatório:
 * - loginController.loginUsuario
 *
 * Diretrizes:
 * - Sem aliases.
 * - Sem múltiplas possibilidades de export.
 * - Sem cache.
 * - Rate limit em rota pública sensível.
 * - Diagnóstico por header X-Route-Handler.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const loginController = require("../controllers/loginController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contrato obrigatório
────────────────────────────────────────────────────────────── */

if (typeof loginController.loginUsuario !== "function") {
  throw new Error(
    "[loginRoute] Handler obrigatório ausente: loginController.loginUsuario"
  );
}

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
   Rate limit público
────────────────────────────────────────────────────────────── */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "LOGIN-429-LIMITE",
    "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente."
  ),
});

/* ─────────────────────────────────────────────────────────────
   Rotas oficiais
────────────────────────────────────────────────────────────── */

/**
 * POST /api/login
 */
router.post(
  "/",
  loginLimiter,
  noStore,
  routeTag("loginRoute:v2.0:POST /"),
  asyncHandler(loginController.loginUsuario)
);

/**
 * HEAD /api/login
 */
router.head(
  "/",
  noStore,
  routeTag("loginRoute:v2.0:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

module.exports = router;