/* eslint-disable no-console */
"use strict";

// 📁 src/routes/perfilRoute.js — PREMIUM V2 (robusto, consistente, seguro, sem duplicações)
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.protect ||
      _auth?.auth ||
      _auth?.authMiddleware ||
      _auth?.requireAuth;

if (typeof requireAuth !== "function") {
  console.error("[perfilRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Controllers (validação defensiva) ───────────────── */
const perfilCtrl = require("../controllers/perfilController");

const listarOpcaoPerfil =
  perfilCtrl?.listarOpcaoPerfil ||
  perfilCtrl?.default?.listarOpcaoPerfil ||
  null;

const meuPerfil =
  perfilCtrl?.meuPerfil ||
  perfilCtrl?.default?.meuPerfil ||
  null;

const atualizarMeuPerfil =
  perfilCtrl?.atualizarMeuPerfil ||
  perfilCtrl?.default?.atualizarMeuPerfil ||
  null;

function assertFn(name, fn) {
  if (typeof fn !== "function") {
    console.error("[perfilRoute] controller inválido:", name, perfilCtrl);
    throw new Error(`perfilController inválido (função ausente: ${name})`);
  }
}

assertFn("listarOpcaoPerfil", listarOpcaoPerfil);
assertFn("meuPerfil", meuPerfil);
assertFn("atualizarMeuPerfil", atualizarMeuPerfil);

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  return next();
};

const handle =
  (fn) =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };

function setPublicLookupCache(_req, res, next) {
  res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
  return next();
}

function setPrivateNoStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  return next();
}

/* ──────────────────────────────────────────────────────────
   🔓 ROTAS PÚBLICAS
────────────────────────────────────────────────────────── */

// Opções para selects (cadastro / perfil)
// cache curto porque muda pouco e ajuda bastante a performance do app
router.get(
  "/opcao",
  routeTag("perfilRoute:GET /opcao"),
  setPublicLookupCache,
  handle(listarOpcaoPerfil)
);

router.head(
  "/opcao",
  routeTag("perfilRoute:HEAD /opcao"),
  setPublicLookupCache,
  (_req, res) => res.sendStatus(204)
);

/* ──────────────────────────────────────────────────────────
   🔐 ROTAS PROTEGIDAS
────────────────────────────────────────────────────────── */

router.use(requireAuth, setPrivateNoStore);

// Meu perfil
router.get(
  "/me",
  routeTag("perfilRoute:GET /me"),
  handle(meuPerfil)
);

router.head(
  "/me",
  routeTag("perfilRoute:HEAD /me"),
  (_req, res) => res.sendStatus(204)
);

// Atualizar meu perfil (PUT/PATCH)
router.put(
  "/me",
  routeTag("perfilRoute:PUT /me"),
  handle(atualizarMeuPerfil)
);

router.patch(
  "/me",
  routeTag("perfilRoute:PATCH /me"),
  handle(atualizarMeuPerfil)
);

module.exports = router;