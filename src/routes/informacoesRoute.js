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
  deleteInformacao
} = require("../controllers/informacoesController");

const { uploadInformacaoImagem } = require("../middlewares/uploadInformacoes");

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[routes:informacoes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/*
  Futuro recomendado:
  Se você já tiver um middleware real de administrador no projeto,
  encaixe aqui, por exemplo:
  const requireAdmin = require("../middlewares/requireAdmin");
*/

/* =========================
   Público (HomeEscola)
========================= */
router.get("/publicadas", asyncHandler(getInformacoesPublicadas));
router.head("/publicadas", (_req, res) => res.sendStatus(204));

/* =========================
   Admin
========================= */
router.use(requireAuth);
// router.use(requireAdmin);

router.get("/", asyncHandler(getInformacoesAdmin));
router.get("/:id", asyncHandler(getInformacaoById));
router.post("/", uploadInformacaoImagem, asyncHandler(postInformacao));
router.put("/:id", uploadInformacaoImagem, asyncHandler(putInformacao));
router.patch("/:id/ativo", asyncHandler(patchAtivoInformacao));
router.delete("/:id", asyncHandler(deleteInformacao));

module.exports = router;