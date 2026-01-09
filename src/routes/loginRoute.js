// 📁 src/routes/authRoute.js — PREMIUM (seguro, resiliente, pronto p/ produção)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Import resiliente do controller ───────────────── */
const loginCtrl = require("../controllers/loginController");
const loginUsuario =
  typeof loginCtrl === "function"
    ? loginCtrl
    : loginCtrl?.loginUsuario || loginCtrl?.default;

if (typeof loginUsuario !== "function") {
  console.error("[authRoute] loginUsuario inválido:", loginCtrl);
  throw new Error("loginUsuario não é função (verifique exports em loginController)");
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store"); // evita cache de credenciais
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

/* ──────────────────────────────────────────────────────────
   🔐 Autenticação
   POST /api/usuarios/login
   Público | sem cache | pronto p/ rate-limit externo
   ────────────────────────────────────────────────────────── */
router.post(
  "/",
  routeTag("authRoute:POST /login"),
  handle(loginUsuario)
);

module.exports = router;
