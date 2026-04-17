/* eslint-disable no-console */
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const usuarioController = require("../controllers/usuarioController");

/* ───────────────── Helpers ───────────────── */
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
  return next();
}

function registerIf(fn, registrar, rotaDescrita) {
  if (typeof fn === "function") {
    registrar();
    return;
  }

  console.warn(
    `⚠️ [authPublicRoute] rota não registrada (${rotaDescrita}): handler ausente.`
  );
}

/* ───────────────── Rate limits públicos ───────────────── */
const recuperarSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas solicitações, aguarde antes de tentar novamente." },
});

const redefinirSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas, aguarde antes de tentar novamente." },
});

const cadastroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de cadastro. Aguarde antes de tentar novamente." },
});

/* ───────────────── Público — cadastro ───────────────── */
registerIf(
  usuarioController?.cadastrar || usuarioController?.cadastrarUsuario,
  function registrarRotaCadastro() {
    const cadastroHandler =
      usuarioController.cadastrar || usuarioController.cadastrarUsuario;

    router.post(
      "/cadastro",
      cadastroLimiter,
      noStore,
      routeTag("authPublicRoute:POST /cadastro"),
      asyncHandler(cadastroHandler)
    );
  },
  "POST /auth/cadastro"
);

/* ───────────────── Público — recuperação de senha ───────────────── */
registerIf(
  usuarioController?.recuperarSenha,
  function registrarRotaRecuperarSenha() {
    router.post(
      "/esqueci-senha",
      recuperarSenhaLimiter,
      noStore,
      routeTag("authPublicRoute:POST /esqueci-senha"),
      asyncHandler(usuarioController.recuperarSenha)
    );

    router.post(
      "/recuperar-senha",
      recuperarSenhaLimiter,
      noStore,
      routeTag("authPublicRoute:POST /recuperar-senha"),
      asyncHandler(usuarioController.recuperarSenha)
    );
  },
  "POST /auth/esqueci-senha"
);

/* ───────────────── Público — redefinição de senha ───────────────── */
registerIf(
  usuarioController?.redefinirSenha,
  function registrarRotaRedefinirSenha() {
    router.post(
      "/resetar-senha",
      redefinirSenhaLimiter,
      noStore,
      routeTag("authPublicRoute:POST /resetar-senha"),
      asyncHandler(usuarioController.redefinirSenha)
    );

    router.post(
      "/redefinir-senha",
      redefinirSenhaLimiter,
      noStore,
      routeTag("authPublicRoute:POST /redefinir-senha"),
      asyncHandler(usuarioController.redefinirSenha)
    );

    router.post(
      "/redefinir-senha/:token",
      redefinirSenhaLimiter,
      noStore,
      routeTag("authPublicRoute:POST /redefinir-senha/:token"),
      asyncHandler(usuarioController.redefinirSenha)
    );
  },
  "POST /auth/redefinir-senha"
);

/* ───────────────── HEAD úteis para diagnóstico/warmup ───────────────── */
router.head("/cadastro", (_req, res) => res.sendStatus(204));
router.head("/esqueci-senha", (_req, res) => res.sendStatus(204));
router.head("/recuperar-senha", (_req, res) => res.sendStatus(204));
router.head("/resetar-senha", (_req, res) => res.sendStatus(204));
router.head("/redefinir-senha", (_req, res) => res.sendStatus(204));
router.head("/redefinir-senha/:token", (_req, res) => res.sendStatus(204));

module.exports = router;