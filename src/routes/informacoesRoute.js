/* eslint-disable no-console */
"use strict";

const express = require("express");
const router = express.Router();

const {
  getInformacoesPublicadas,
  getInformacoesAdmin,
  getInformacaoById,
  postInformacao,
  putInformacao,
  patchAtivoInformacao,
  deleteInformacao,
} = require("../controllers/informacoesController");

const { uploadInformacaoImagem } = require("../middlewares/uploadInformacoes");

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const idParamGuard = (req, res, next) => {
  const raw = req.params?.id;
  const id = Number(raw);

  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      mensagem: "ID inválido.",
    });
  }

  req.params.id = String(id);
  return next();
};

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[routes:informacoes] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Authorize resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");

const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[routes:informacoes] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

/* ───────────────── Headers / cache policy ───────────────── */
function setPublicCache(_req, res, next) {
  // lista pública pode ter cache curto
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  next();
}

function setPrivateNoStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

/* =========================
   Público (HomeEscola)
========================= */
router.get("/publicadas", setPublicCache, asyncHandler(getInformacoesPublicadas));
router.head("/publicadas", setPublicCache, (_req, res) => res.sendStatus(204));

/* =========================
   Admin
========================= */
router.use(requireAuth);
router.use(authorizeRoles("administrador"));
router.use(setPrivateNoStore);

router.get("/", asyncHandler(getInformacoesAdmin));

router.get("/:id", idParamGuard, asyncHandler(getInformacaoById));

router.post(
  "/",
  uploadInformacaoImagem,
  asyncHandler(postInformacao)
);

router.put(
  "/:id",
  idParamGuard,
  uploadInformacaoImagem,
  asyncHandler(putInformacao)
);

router.patch(
  "/:id/ativo",
  idParamGuard,
  asyncHandler(patchAtivoInformacao)
);

router.delete(
  "/:id",
  idParamGuard,
  asyncHandler(deleteInformacao)
);

module.exports = router;