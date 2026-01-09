// 📁 src/routes/perfilRoutes.js — PREMIUM (robusto, consistente, seguro, sem duplicações)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.protect || _auth?.auth || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[perfilRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Controllers (validação defensiva) ───────────────── */
const perfilCtrl = require("../controllers/perfilController");
const listarOpcoesPerfil =
  perfilCtrl?.listarOpcoesPerfil || perfilCtrl?.default?.listarOpcoesPerfil;
const meuPerfil = perfilCtrl?.meuPerfil || perfilCtrl?.default?.meuPerfil;
const atualizarMeuPerfil = perfilCtrl?.atualizarMeuPerfil || perfilCtrl?.default?.atualizarMeuPerfil;

for (const [name, fn] of Object.entries({ listarOpcoesPerfil, meuPerfil, atualizarMeuPerfil })) {
  if (typeof fn !== "function") {
    console.error("[perfilRoutes] controller inválido:", name, perfilCtrl);
    throw new Error(`perfilController inválido (função ausente: ${name})`);
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  // /perfil/opcoes pode cachear curto, mas aqui deixamos por rota (ver abaixo)
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
   🔓 ROTAS PÚBLICAS
   ────────────────────────────────────────────────────────── */

// Opções para selects (cadastro)
// cache curto porque muda pouco e melhora muito o load do app
router.get(
  "/opcoes",
  routeTag("perfilRoutes:GET /opcoes"),
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
    return next();
  },
  handle(listarOpcoesPerfil)
);

/* ──────────────────────────────────────────────────────────
   🔐 ROTAS PROTEGIDAS
   ────────────────────────────────────────────────────────── */
router.use(
  requireAuth,
  (req, res, next) => {
    // dados pessoais: nunca cachear
    res.set("Cache-Control", "no-store");
    return next();
  }
);

// Meu perfil
router.get(
  "/me",
  routeTag("perfilRoutes:GET /me"),
  handle(meuPerfil)
);

// Atualizar meu perfil (PUT/PATCH)
router.put(
  "/me",
  routeTag("perfilRoutes:PUT /me"),
  handle(atualizarMeuPerfil)
);

router.patch(
  "/me",
  routeTag("perfilRoutes:PATCH /me"),
  handle(atualizarMeuPerfil)
);

module.exports = router;
