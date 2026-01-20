// 📁 src/routes/perfilRoute.js — PREMIUM (robusto, consistente, seguro, sem duplicações)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.protect || _auth?.auth || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[perfilRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Controllers (validação defensiva) ───────────────── */
const perfilCtrl = require("../controllers/perfilController");
const listarOpcaoPerfil =
  perfilCtrl?.listarOpcaoPerfil || perfilCtrl?.default?.listarOpcaoPerfil;
const meuPerfil = perfilCtrl?.meuPerfil || perfilCtrl?.default?.meuPerfil;
const atualizarMeuPerfil = perfilCtrl?.atualizarMeuPerfil || perfilCtrl?.default?.atualizarMeuPerfil;

for (const [name, fn] of Object.entries({ listarOpcaoPerfil, meuPerfil, atualizarMeuPerfil })) {
  if (typeof fn !== "function") {
    console.error("[perfilRoute] controller inválido:", name, perfilCtrl);
    throw new Error(`perfilController inválido (função ausente: ${name})`);
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  // /perfil/opcao pode cachear curto, mas aqui deixamos por rota (ver abaixo)
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
  "/opcao",
  routeTag("perfilRoute:GET /opcao"),
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=600, stale-while-revalidate=600");
    return next();
  },
  handle(listarOpcaoPerfil)
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
  routeTag("perfilRoute:GET /me"),
  handle(meuPerfil)
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
