// 📁 src/routes/loginRoute.js — PREMIUM (seguro, resiliente, pronto p/ produção)
/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

/* ───────────────── Import resiliente do controller ───────────────── */
const loginCtrl = require("../controllers/loginController");
const loginUsuario =
  typeof loginCtrl === "function"
    ? loginCtrl
    : loginCtrl?.loginUsuario || loginCtrl?.default;

if (typeof loginUsuario !== "function") {
  console.error("[loginRoute] loginUsuario inválido:", loginCtrl);
  throw new Error(
    "loginUsuario não é função (verifique exports em src/controllers/loginController.js)"
  );
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  try {
    res.set("X-Route-Handler", tag);
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
  } catch {}
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

/* ───────────────── Rotas ───────────────── */

/**
 * 🔐 Login
 * POST /api/login
 * Público | sem cache
 */
router.post(
  "/",
  routeTag("loginRoute:POST /"),
  handle(loginUsuario)
);

/**
 * 🩺 HEAD leve para descoberta/health do endpoint
 * HEAD /api/login
 */
router.head(
  "/",
  routeTag("loginRoute:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

module.exports = router;