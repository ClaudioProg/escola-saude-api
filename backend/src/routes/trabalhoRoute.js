/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/routes/trabalhoRoute.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Rotas oficiais do fluxo de TRABALHO/AUTORIA.
 *
 * Mount oficial:
 * - app.use("/api/trabalho", trabalhoRoute);
 *
 * Responsabilidades deste router:
 * - criar trabalho em uma chamada;
 * - obter trabalho do autor/admin;
 * - atualizar trabalho do autor/admin;
 * - remover trabalho quando permitido;
 * - enviar/atualizar banner/arquivo principal do trabalho;
 * - listar repositório institucional de trabalhos.
 *
 * Fora deste router:
 * - chamadas;
 * - modelos de chamada;
 * - submissão administrativa;
 * - avaliadores;
 * - avaliação escrita/oral;
 * - nota visível;
 * - status final;
 * - classificação;
 * - certificados.
 *
 * Contrato v2.0:
 * - sem /api/trabalhos;
 * - sem aliases;
 * - sem rotas de avaliação;
 * - sem rotas de avaliador;
 * - sem rotas admin de submissão;
 * - sem import de submissaoController;
 * - sem auth resiliente;
 * - sem authorize resiliente;
 * - sem respostas { erro };
 * - campo multipart oficial para banner/arquivo principal: "arquivo".
 */

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { param, validationResult } = require("express-validator");

const router = express.Router();

const ctrl = require("../controllers/trabalhoController");

const injectDb = require("../middlewares/injectDb");
const requireAuth = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

/* =========================================================================
   Guards estruturais
=========================================================================== */

if (typeof requireAuth !== "function") {
  throw new Error(
    "[trabalhoRoute] authMiddleware oficial inválido. Esperado export direto como função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[trabalhoRoute] authorize oficial inválido. Esperado export nomeado { authorize }."
  );
}

/* =========================================================================
   Helpers
=========================================================================== */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function criarErroValidacao(req, errors) {
  const err = new Error("Parâmetros inválidos.");
  err.status = 400;
  err.code = "PARAMETROS_INVALIDOS";
  err.adminHint =
    "A rota recebeu parâmetro fora do contrato oficial definido no express-validator.";
  err.details = errors.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
  }));
  err.requestId = req.requestId || req.rid || null;
  return err;
}

function validate(req, _res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return next(criarErroValidacao(req, errors));
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

function criarErroUpload(message, status = 400, code = "UPLOAD_INVALIDO", details = null) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.adminHint = null;
  err.details = details;
  return err;
}

const idParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("ID inválido.")
    .toInt(),
];

const chamadaIdParam = [
  param("chamadaId")
    .isInt({ min: 1 })
    .withMessage("chamadaId inválido.")
    .toInt(),
];

/* =========================================================================
   Upload oficial
=========================================================================== */

const TMP_DIR = path.join(process.cwd(), "uploads", "tmp");

function garantirTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

garantirTmpDir();

const uploadArquivo = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    const mimeOk =
      /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype) ||
      /^application\/pdf$/i.test(file.mimetype) ||
      file.mimetype === "application/vnd.ms-powerpoint" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    const extOk = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".ppt", ".pptx"].includes(ext);

    if (!mimeOk && !extOk) {
      return cb(
        criarErroUpload(
          "Arquivo inválido. Envie PNG, JPG, GIF, WEBP, PDF, PPT ou PPTX.",
          400,
          "ARQUIVO_TIPO_INVALIDO",
          {
            mimetype: file.mimetype,
            extensao: ext,
          }
        )
      );
    }

    return cb(null, true);
  },
});

function multerErrorHandler(err, _req, _res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        criarErroUpload(
          "Arquivo muito grande. O limite é 30MB.",
          413,
          "ARQUIVO_TAMANHO_EXCEDIDO"
        )
      );
    }

    return next(
      criarErroUpload(
        `Erro no upload (${err.code}).`,
        400,
        "UPLOAD_MULTER_ERROR",
        { multerCode: err.code }
      )
    );
  }

  return next(err);
}

/* =========================================================================
   Middlewares globais da rota
=========================================================================== */

router.use(injectDb);
router.use(noStore);

/* =========================================================================
   Usuário autenticado — trabalho/autoria
=========================================================================== */

/**
 * Cria trabalho dentro de uma chamada.
 *
 * Body oficial:
 * {
 *   "status": "rascunho" | "submetida",
 *   "titulo": "...",
 *   "inicio_experiencia": "YYYY-MM",
 *   "linha_tematica_id": 1,
 *   "introducao": "...",
 *   "objetivos": "...",
 *   "metodo": "...",
 *   "resultados": "...",
 *   "consideracao": "...",
 *   "bibliografia": "...",
 *   "coautores": [
 *     {
 *       "nome": "...",
 *       "email": "...",
 *       "unidade": "...",
 *       "papel": "...",
 *       "cpf": "...",
 *       "vinculo": "..."
 *     }
 *   ]
 * }
 *
 * POST /api/trabalho/chamada/:chamadaId
 */
router.post(
  "/chamada/:chamadaId(\\d+)",
  requireAuth,
  chamadaIdParam,
  validate,
  asyncHandler(ctrl.criar)
);

/**
 * Obtém trabalho para autor ou administrador.
 *
 * GET /api/trabalho/:id
 */
router.get(
  "/:id(\\d+)",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.obter)
);

/**
 * Atualiza trabalho para autor ou administrador.
 *
 * PUT /api/trabalho/:id
 */
router.put(
  "/:id(\\d+)",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.atualizar)
);

/**
 * Remove trabalho quando permitido.
 *
 * DELETE /api/trabalho/:id
 */
router.delete(
  "/:id(\\d+)",
  requireAuth,
  idParam,
  validate,
  asyncHandler(ctrl.remover)
);

/**
 * Envia/atualiza banner/arquivo principal do trabalho.
 *
 * Campo multipart oficial:
 * - arquivo
 *
 * POST /api/trabalho/:id/banner
 */
router.post(
  "/:id(\\d+)/banner",
  requireAuth,
  idParam,
  validate,
  uploadArquivo.single("arquivo"),
  asyncHandler(ctrl.atualizarBanner)
);

/* =========================================================================
   Repositório institucional
=========================================================================== */

/**
 * Lista repositório institucional de trabalhos avaliados/aprovados.
 *
 * Filtro opcional:
 * - chamada_id
 *
 * GET /api/trabalho/repositorio
 */
router.get(
  "/repositorio",
  requireAuth,
  asyncHandler(ctrl.listarRepositorio)
);

/* =========================================================================
   Error handler de upload
=========================================================================== */

router.use(multerErrorHandler);

module.exports = router;