// ✅ src/routes/certificadosAvulsosRoute.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { param, query, validationResult } = require("express-validator");

const router = express.Router();

const controller = require("../controllers/certificadosAvulsosController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* =========================
   Helpers
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
  });
}

/* =========================
   Rate limits (premium)
========================= */
const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições de PDF. Aguarde alguns instantes." },
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas solicitações de e-mail. Aguarde antes de tentar novamente." },
});

/* =========================
   Proteção do grupo
========================= */
router.use(authMiddleware, authorizeRoles("administrador"));

// ✅ dados/arquivos pessoais -> sem cache
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rotas
========================= */

// Cadastrar certificado avulso
router.post("/", asyncHandler(controller.criarCertificadoAvulso));

// Listar todos (para a tabela do frontend)
router.get("/", asyncHandler(controller.listarCertificadosAvulsos));

// Gerar PDF (suporta ?palestrante=1|true e ?assinatura2_id=123)
router.get(
  "/:id/pdf",
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("palestrante")
      .optional()
      .isIn(["1", "0", "true", "false"])
      .withMessage("palestrante deve ser 1/0/true/false."),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
  ],
  validate,
  asyncHandler(controller.gerarPdfCertificado)
);

// Enviar por e-mail
router.post(
  "/:id/enviar",
  emailLimiter,
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  asyncHandler(controller.enviarPorEmail)
);

module.exports = router;
