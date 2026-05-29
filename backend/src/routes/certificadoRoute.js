/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/certificadoRoute.js — v2.2
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais do módulo de certificados.
 * - Certificados de evento/turma.
 * - Certificados avulsos.
 * - Validação pública por código único.
 * - Download autenticado.
 * - Emissão documental regular.
 * - Consulta administrativa por turma.
 * - Listagem de elegíveis.
 * - Processamento diagnóstico de pendentes.
 * - Cancelamento documental.
 *
 * Mount oficial:
 * - /api/certificado
 *
 * Regra documental v2.0/v2.1/v2.2:
 * - Certificado emitido/enviado não é editado, resetado, sobrescrito ou apagado.
 * - Não existe reset de turma.
 * - Não existe PUT simples para alterar certificado emitido.
 * - Não existe revalidação genérica de certificado emitido.
 * - Correção documental deve ocorrer por fluxo formal próprio.
 * - Número e código de validação são únicos e nunca reaproveitados.
 * - Certificado avulso com PDF/hash consolidado não troca assinaturas.
 *
 * Contratos oficiais:
 * - Validação pública somente por codigo_validacao.
 * - Download autenticado por id.
 * - Participante: tipo "usuario".
 * - Organizador: tipo "organizador".
 * - Palestrante: tipo "palestrante".
 * - Organizadores vêm de turma_responsavel.
 * - Palestrantes vinculados vêm de turma_palestrante.
 * - Assinantes de turma vêm de turma_certificado_assinante.
 * - Certificado avulso aceita assinantes_ids.
 * - Certificado avulso deve ter de 1 a 3 assinaturas.
 * - Rafaella Pitol, ID 17, é obrigatória.
 * - Fábio Lopez, ID 2474, quando selecionado, deve ser a última assinatura.
 *
 * Sem aliases:
 * - sem reset;
 * - sem editar certificado emitido;
 * - sem req.usuario;
 * - sem req.auth;
 * - sem extrairPerfis;
 * - sem validar por usuario_id/evento_id/turma_id;
 * - sem rota plural paralela;
 * - sem instrutor_assinante_id;
 * - sem organizador_assinante_id;
 * - sem assinatura2_id.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, param, body, validationResult } = require("express-validator");

const { authMiddleware } = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const certificadoController = require("../controllers/certificadoController");
const certificadoAvulsoController = require("../controllers/certificadoAvulsoController");

const router = express.Router();

/* ─────────────────────────────────────────────
 * Contratos obrigatórios
 * ───────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[certificadoRoute] authMiddleware inválido:", authMiddleware);

  throw new Error(
    "Contrato inválido: ../auth/authMiddleware deve exportar authMiddleware como função."
  );
}

if (typeof authorize !== "function") {
  console.error("[certificadoRoute] authorize inválido:", authorize);

  throw new Error(
    "Contrato inválido: ../middlewares/authorize deve exportar authorize como função."
  );
}

function assertFn(scope, name, fn) {
  if (typeof fn !== "function") {
    console.error(`[certificadoRoute] ${scope}.${name} ausente/inválido:`, fn);

    throw new Error(`Contrato inválido: ${scope}.${name} deve ser uma função.`);
  }
}

const certificadoFns = [
  "validarCertificadoPublico",
  "gerarCertificado",
  "downloadCertificado",

  "listarCertificadoUsuario",
  "listarCertificadosDisponiveisUsuario",
  "listarCertificadosPorTurma",
  "listarElegiveisPorTurma",
  "listarAdminArvore",
  "processarPendentesPorTurma",

  "cancelarCertificado",
];

for (const fnName of certificadoFns) {
  assertFn("certificadoController", fnName, certificadoController?.[fnName]);
}

const certificadoAvulsoFns = [
  "criarCertificadoAvulso",
  "listarCertificadoAvulso",
  "gerarPdfCertificado",
  "enviarPorEmail",
  "cancelarCertificadoAvulso",
  "anularCertificadoAvulso",
  "historicoCertificadoAvulso",
];

for (const fnName of certificadoAvulsoFns) {
  assertFn(
    "certificadoAvulsoController",
    fnName,
    certificadoAvulsoController?.[fnName]
  );
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function getRequestId(req) {
  return req?.requestId || req?.rid || null;
}

function responderErroValidacao(req, res, errors) {
  return res.status(400).json({
    ok: false,
    data: null,
    message: "Parâmetros inválidos.",
    code: "CERTIFICADO_PARAMETROS_INVALIDOS",
    adminHint:
      "A rota de certificado recebeu parâmetros fora do contrato esperado.",
    details: errors.array().map((error) => ({
      campo: error.path || error.param,
      message: error.msg,
    })),
    requestId: getRequestId(req),
  });
}

function validate(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return responderErroValidacao(req, res, errors);
}

function getUsuarioId(req) {
  const usuarioId = Number(req?.user?.id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return null;
  }

  return usuarioId;
}

function getPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

function ensureAuthenticatedContext(req, res, next) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return res.status(401).json({
      ok: false,
      data: null,
      message: "Usuário não autenticado.",
      code: "CERTIFICADO_USUARIO_NAO_AUTENTICADO",
      adminHint: "req.user.id não foi encontrado no request.",
      requestId: getRequestId(req),
    });
  }

  return next();
}

function ensureBodySelfOrAdmin(req, res, next) {
  const usuarioIdToken = getUsuarioId(req);
  const perfil = getPerfil(req);
  const usuarioIdBody = Number(req.body?.usuario_id);

  if (!Number.isInteger(usuarioIdBody) || usuarioIdBody <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "usuario_id inválido.",
      code: "CERTIFICADO_USUARIO_ID_INVALIDO",
      adminHint:
        "O payload de geração de certificado deve conter usuario_id inteiro positivo.",
      requestId: getRequestId(req),
    });
  }

  if (perfil === "administrador" || usuarioIdToken === usuarioIdBody) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    data: null,
    message: "Sem permissão para gerar certificado para outro usuário.",
    code: "CERTIFICADO_ACESSO_NEGADO",
    adminHint:
      "Usuário não administrador tentou gerar certificado para usuario_id diferente do token.",
    requestId: getRequestId(req),
  });
}

function codigoValidacaoParam(name = "codigo_validacao") {
  return param(name)
    .exists({ checkFalsy: true })
    .withMessage(`${name} é obrigatório.`)
    .bail()
    .isString()
    .withMessage(`${name} deve ser texto.`)
    .bail()
    .trim()
    .isLength({ min: 8, max: 140 })
    .withMessage(`${name} deve ter entre 8 e 140 caracteres.`)
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage(
      `${name} deve conter apenas letras maiúsculas, números e hífen.`
    );
}

function idParam(name) {
  return param(name)
    .exists({ checkFalsy: true })
    .withMessage(`${name} é obrigatório.`)
    .bail()
    .isInt({ min: 1 })
    .withMessage(`${name} deve ser um inteiro maior ou igual a 1.`)
    .toInt();
}

function modalidadeBody() {
  return body("modalidade")
    .optional({ nullable: true, checkFalsy: true })
    .isIn([
      "participante",
      "organizador",
      "palestrante",
      "banca_avaliadora",
      "oficineiro",
      "mediador",
      "banca_tcr_medica",
      "banca_tcr_multi",
      "residente_medica",
      "residente_multi",
      "mostra_banner",
      "mostra_oral",
      "comissao_organizadora",
    ])
    .withMessage("modalidade inválida.");
}

function motivoObrigatorioBody(acao = "operação") {
  return body("motivo")
    .exists({ checkFalsy: true })
    .withMessage(`motivo é obrigatório para ${acao}.`)
    .bail()
    .isString()
    .withMessage("motivo deve ser texto.")
    .bail()
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage("motivo deve ter entre 5 e 2000 caracteres.");
}

function assinantesIdsOptionalQuery() {
  return query("assinantes_ids")
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      const raw = String(value || "").trim();

      if (!raw) return true;

      if (raw.startsWith("[") && raw.endsWith("]")) {
        let parsed;

        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error("assinantes_ids deve ser lista JSON válida ou CSV.");
        }

        if (!Array.isArray(parsed)) {
          throw new Error("assinantes_ids deve ser uma lista.");
        }

        const invalid = parsed.some((item) => {
          const n = Number(item);
          return !Number.isInteger(n) || n <= 0;
        });

        if (invalid) {
          throw new Error("assinantes_ids deve conter apenas IDs positivos.");
        }

        if (parsed.length > 3) {
          throw new Error("assinantes_ids deve conter no máximo 3 IDs.");
        }

        return true;
      }

      const ids = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const invalid = ids.some((item) => {
        const n = Number(item);
        return !Number.isInteger(n) || n <= 0;
      });

      if (invalid) {
        throw new Error("assinantes_ids deve conter apenas IDs positivos.");
      }

      if (ids.length > 3) {
        throw new Error("assinantes_ids deve conter no máximo 3 IDs.");
      }

      return true;
    });
}

function assinantesIdsOptionalBody() {
  return body("assinantes_ids")
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value == null || value === "") return true;

      let ids = [];

      if (Array.isArray(value)) {
        ids = value;
      } else if (typeof value === "number") {
        ids = [value];
      } else {
        const raw = String(value || "").trim();

        if (!raw) return true;

        if (raw.startsWith("[") && raw.endsWith("]")) {
          try {
            ids = JSON.parse(raw);
          } catch {
            throw new Error("assinantes_ids deve ser lista JSON válida ou CSV.");
          }
        } else {
          ids = raw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      if (!Array.isArray(ids)) {
        throw new Error("assinantes_ids deve ser uma lista.");
      }

      if (ids.length > 3) {
        throw new Error("assinantes_ids deve conter no máximo 3 IDs.");
      }

      const invalid = ids.some((item) => {
        const n = Number(item);
        return !Number.isInteger(n) || n <= 0;
      });

      if (invalid) {
        throw new Error("assinantes_ids deve conter apenas IDs positivos.");
      }

      return true;
    });
}

/* ─────────────────────────────────────────────
 * Rate limits
 * ───────────────────────────────────────────── */

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(getUsuarioId(req) || req.ip || "anon"),
    message,
  });
}

const publicLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    ok: false,
    data: null,
    message: "Muitas requisições. Aguarde alguns instantes.",
    code: "CERTIFICADO_RATE_LIMIT_PUBLICO",
  },
});

const privateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 240,
  message: {
    ok: false,
    data: null,
    message: "Muitas requisições. Aguarde alguns instantes.",
    code: "CERTIFICADO_RATE_LIMIT_PRIVADO",
  },
});

const pdfLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    ok: false,
    data: null,
    message: "Muitas requisições de PDF. Aguarde alguns instantes.",
    code: "CERTIFICADO_RATE_LIMIT_PDF",
  },
});

const emailLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    ok: false,
    data: null,
    message: "Muitas solicitações de e-mail. Aguarde antes de tentar novamente.",
    code: "CERTIFICADO_RATE_LIMIT_EMAIL",
  },
});

const sensitiveLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: {
    ok: false,
    data: null,
    message: "Muitas operações sensíveis. Aguarde antes de tentar novamente.",
    code: "CERTIFICADO_RATE_LIMIT_OPERACAO_SENSIVEL",
  },
});

/* ─────────────────────────────────────────────
 * Rotas públicas
 * ───────────────────────────────────────────── */

/**
 * GET /api/certificado/validar/:codigo_validacao
 *
 * Função:
 * - Validação pública por código único.
 * - Usada pelo QR Code do PDF.
 * - Deve registrar consulta em certificado_validacoes.
 */
router.get(
  "/validar/:codigo_validacao",
  publicLimiter,
  [codigoValidacaoParam("codigo_validacao")],
  validate,
  asyncHandler(certificadoController.validarCertificadoPublico)
);

/* ─────────────────────────────────────────────
 * Área autenticada
 * ───────────────────────────────────────────── */

router.use(authMiddleware);
router.use(privateLimiter);
router.use(ensureAuthenticatedContext);

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Route-Group", "certificado");
  next();
});

/* ─────────────────────────────────────────────
 * Downloads autenticados
 * ───────────────────────────────────────────── */

/**
 * GET /api/certificado/:id/download
 *
 * Função:
 * - Download autenticado de certificado regular.
 * - O controller valida ownership/admin usando req.user.id.
 */
router.get(
  "/:id/download",
  pdfLimiter,
  authorize("usuario", "organizador", "administrador"),
  [idParam("id")],
  validate,
  asyncHandler(certificadoController.downloadCertificado)
);

/* ─────────────────────────────────────────────
 * Certificados do usuário
 * ───────────────────────────────────────────── */

/**
 * GET /api/certificado/usuario
 *
 * Função:
 * - Lista certificados emitidos do usuário autenticado.
 */
router.get(
  "/usuario",
  authorize("usuario", "organizador", "administrador"),
  asyncHandler(certificadoController.listarCertificadoUsuario)
);

/**
 * GET /api/certificado/meus
 *
 * Função:
 * - Lista certificados emitidos do usuário autenticado.
 */
router.get(
  "/meus",
  authorize("usuario", "organizador", "administrador"),
  asyncHandler(certificadoController.listarCertificadoUsuario)
);

/**
 * GET /api/certificado/disponiveis
 *
 * Função:
 * - Lista certificados do usuário autenticado disponíveis para geração.
 * - Retorna turmas encerradas, com frequência mínima, avaliação enviada
 *   e sem certificado emitido/enviado.
 *
 * Permissão:
 * - usuario
 * - organizador
 * - administrador
 */
router.get(
  "/disponiveis",
  authorize("usuario", "organizador", "administrador"),
  asyncHandler(certificadoController.listarCertificadosDisponiveisUsuario)
);

/**
 * GET /api/certificado/turma/:turma_id
 *
 * Função:
 * - Lista certificados já emitidos por turma.
 * - Administrativo.
 */
router.get(
  "/turma/:turma_id",
  authorize("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(certificadoController.listarCertificadosPorTurma)
);

/**
 * GET /api/certificado/turma/:turma_id/elegivel
 *
 * Função:
 * - Lista elegíveis para certificado na turma.
 * - Inclui participantes, organizadores e palestrantes vinculados.
 */
router.get(
  "/turma/:turma_id/elegivel",
  authorize("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(certificadoController.listarElegiveisPorTurma)
);

/**
 * GET /api/certificado/turma/:turma_id/elegiveis
 *
 * Função:
 * - Variação plural da mesma listagem.
 */
router.get(
  "/turma/:turma_id/elegiveis",
  authorize("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(certificadoController.listarElegiveisPorTurma)
);

/**
 * POST /api/certificado/gerar
 *
 * Função:
 * - Gera certificado regular quando ainda não existe certificado válido.
 * - Não sobrescreve certificado emitido/enviado.
 *
 * Tipos oficiais:
 * - usuario
 * - organizador
 * - palestrante
 */
router.post(
  "/gerar",
  authorize("usuario", "organizador", "administrador"),
  [
    body("usuario_id")
      .isInt({ min: 1 })
      .withMessage("usuario_id inválido.")
      .toInt(),
    body("evento_id")
      .isInt({ min: 1 })
      .withMessage("evento_id inválido.")
      .toInt(),
    body("turma_id")
      .isInt({ min: 1 })
      .withMessage("turma_id inválido.")
      .toInt(),
    body("tipo")
      .isIn(["usuario", "organizador", "palestrante"])
      .withMessage("tipo deve ser usuario, organizador ou palestrante."),
  ],
  validate,
  ensureBodySelfOrAdmin,
  asyncHandler(certificadoController.gerarCertificado)
);

/* ─────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────── */

const adminRouter = express.Router();

adminRouter.use(authorize("administrador"));

/**
 * GET /api/certificado/admin/arvore
 *
 * Função:
 * - Árvore administrativa de eventos, turmas e certificados.
 */
adminRouter.get(
  "/arvore",
  asyncHandler(certificadoController.listarAdminArvore)
);

/**
 * POST /api/certificado/admin/turma/:turma_id/processar-pendentes
 *
 * Função:
 * - Lista/processa diagnóstico de pendentes de uma turma.
 * - Não toca em certificados já emitidos/enviados.
 * - Não gera lote pesado automaticamente.
 */
adminRouter.post(
  "/turma/:turma_id/processar-pendentes",
  sensitiveLimiter,
  [idParam("turma_id")],
  validate,
  asyncHandler(certificadoController.processarPendentesPorTurma)
);

/**
 * POST /api/certificado/admin/:id/cancelar
 *
 * Função:
 * - Cancela certificado regular emitido/enviado.
 * - Exige motivo e histórico.
 */
adminRouter.post(
  "/:id/cancelar",
  sensitiveLimiter,
  [idParam("id"), motivoObrigatorioBody("cancelamento")],
  validate,
  asyncHandler(certificadoController.cancelarCertificado)
);

/* ─────────────────────────────────────────────
 * Administração — certificados avulsos
 * ───────────────────────────────────────────── */

/**
 * GET /api/certificado/admin/avulso
 *
 * Função:
 * - Lista certificados avulsos.
 */
adminRouter.get(
  "/avulso",
  asyncHandler(certificadoAvulsoController.listarCertificadoAvulso)
);

/**
 * POST /api/certificado/admin/avulso
 *
 * Função:
 * - Cria certificado avulso com número oficial e código de validação.
 * - Não consolida PDF neste momento.
 */
adminRouter.post(
  "/avulso",
  [
    body("nome").trim().notEmpty().withMessage("nome é obrigatório."),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("email é obrigatório.")
      .bail()
      .isEmail()
      .withMessage("email inválido."),
    body("cpf").trim().notEmpty().withMessage("identificador é obrigatório."),
    body("curso").trim().notEmpty().withMessage("curso é obrigatório."),
    body("carga_horaria")
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage("carga_horaria deve ser inteiro positivo.")
      .toInt(),
    body("data_inicio")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_inicio deve estar em AAAA-MM-DD."),
    body("data_fim")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_fim deve estar em AAAA-MM-DD."),
    modalidadeBody(),
    body("titulo_trabalho")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage("titulo_trabalho inválido.")
      .trim()
      .isLength({ max: 500 })
      .withMessage("titulo_trabalho deve ter no máximo 500 caracteres."),
    body("texto_personalizado")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage("texto_personalizado inválido.")
      .trim()
      .isLength({ max: 5000 })
      .withMessage("texto_personalizado deve ter no máximo 5000 caracteres."),
  ],
  validate,
  asyncHandler(certificadoAvulsoController.criarCertificadoAvulso)
);

/**
 * GET /api/certificado/admin/avulso/:id/pdf
 *
 * Função:
 * - Consolida PDF somente se ainda não existir arquivo_pdf/hash_pdf.
 * - Depois de consolidado, apenas baixa o PDF existente.
 *
 * Query oficial:
 * - assinantes_ids=17
 * - assinantes_ids=123,17
 * - assinantes_ids=123,17,2474
 * - assinantes_ids=[123,17,2474]
 *
 * Regras:
 * - Rafaella Pitol, ID 17, é obrigatória.
 * - Fábio Lopez, ID 2474, quando selecionado, fica por último.
 * - A normalização final ocorre no controller.
 */
adminRouter.get(
  "/avulso/:id/pdf",
  pdfLimiter,
  [idParam("id"), assinantesIdsOptionalQuery()],
  validate,
  asyncHandler(certificadoAvulsoController.gerarPdfCertificado)
);

/**
 * POST /api/certificado/admin/avulso/:id/enviar
 *
 * Função:
 * - Envia ou reenvia certificado avulso por e-mail.
 * - Se o PDF ainda não existir, consolida antes com assinantes_ids.
 * - Se o PDF já existir, não recria nem altera assinaturas.
 *
 * Body ou query oficial:
 * - assinantes_ids: [123, 17, 2474]
 * - assinantes_ids: "123,17,2474"
 */
adminRouter.post(
  "/avulso/:id/enviar",
  emailLimiter,
  [idParam("id"), assinantesIdsOptionalQuery(), assinantesIdsOptionalBody()],
  validate,
  asyncHandler(certificadoAvulsoController.enviarPorEmail)
);

/**
 * GET /api/certificado/admin/avulso/:id/historico
 *
 * Função:
 * - Histórico de certificado avulso.
 */
adminRouter.get(
  "/avulso/:id/historico",
  [idParam("id")],
  validate,
  asyncHandler(certificadoAvulsoController.historicoCertificadoAvulso)
);

/**
 * POST /api/certificado/admin/avulso/:id/cancelar
 *
 * Função:
 * - Cancela certificado avulso emitido/enviado.
 * - Não aceita status livre no body.
 */
adminRouter.post(
  "/avulso/:id/cancelar",
  sensitiveLimiter,
  [idParam("id"), motivoObrigatorioBody("cancelamento")],
  validate,
  asyncHandler(certificadoAvulsoController.cancelarCertificadoAvulso)
);

/**
 * POST /api/certificado/admin/avulso/:id/anular
 *
 * Função:
 * - Anula certificado avulso emitido/enviado.
 * - Não aceita status livre no body.
 */
adminRouter.post(
  "/avulso/:id/anular",
  sensitiveLimiter,
  [idParam("id"), motivoObrigatorioBody("anulação")],
  validate,
  asyncHandler(certificadoAvulsoController.anularCertificadoAvulso)
);

router.use("/admin", adminRouter);

module.exports = router;