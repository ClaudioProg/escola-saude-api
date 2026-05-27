/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/avaliacaoRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais do módulo de avaliação.
 * - Envio de avaliação pós-evento/turma.
 * - Consulta de avaliações disponíveis.
 * - Consulta de avaliações por turma.
 * - Consulta de avaliações por evento.
 * - Administração/analytics de avaliações.
 * - Debug administrativo pós-curso.
 *
 * Mount oficial:
 * - /api/avaliacao
 *
 * Contratos obrigatórios:
 * - authMiddleware exportado como função em ../auth/authMiddleware
 * - authorize exportado como função nomeada em ../middlewares/authorize
 * - avaliacaoController com funções oficiais:
 *   - enviarAvaliacao
 *   - listarAvaliacaoDisponiveis
 *   - listarPorTurmaParaorganizador
 *   - avaliacaoPorTurma
 *   - avaliacaoPorEvento
 *   - listarEventosComAvaliacao
 *   - obterAvaliacaoDoEvento
 *   - obterAvaliacaoDaTurma
 * - debugPosCursoController.debugPosCursoPorUsuario
 *
 * Diretrizes v2.0:
 * - Sem aliases.
 * - Sem compatibilidade com URLs antigas.
 * - Sem resolução flexível de middleware.
 * - Sem req.usuario.
 * - Sem req.auth.userId.
 * - Sem respostas { erro }.
 * - Sem rotas duplicadas.
 */

const express = require("express");
const { param, validationResult } = require("express-validator");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const avaliacaoController = require("../controllers/avaliacaoController");
const debugPosCursoController = require("../controllers/debugPosCursoController");

const router = express.Router();

/* ─────────────────────────────────────────────
 * Validações estruturais de contrato
 * ───────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[avaliacaoRoute] authMiddleware inválido:", authMiddleware);

  throw new Error(
    "Contrato inválido: ../auth/authMiddleware deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  console.error("[avaliacaoRoute] authorize inválido:", authorize);

  throw new Error(
    "Contrato inválido: ../middlewares/authorize deve expor { authorize } como função."
  );
}

const controllerObrigatorio = [
  "enviarAvaliacao",
  "listarAvaliacaoDisponiveis",
  "listarPorTurmaParaorganizador",
  "avaliacaoPorTurma",
  "avaliacaoPorEvento",
  "listarEventosComAvaliacao",
  "obterAvaliacaoDoEvento",
  "obterAvaliacaoDaTurma",
];

for (const nomeFuncao of controllerObrigatorio) {
  if (typeof avaliacaoController?.[nomeFuncao] !== "function") {
    console.error(
      `[avaliacaoRoute] avaliacaoController.${nomeFuncao} inválido:`,
      avaliacaoController?.[nomeFuncao]
    );

    throw new Error(
      `Contrato inválido: avaliacaoController.${nomeFuncao} deve ser uma função.`
    );
  }
}

if (typeof debugPosCursoController?.debugPosCursoPorUsuario !== "function") {
  console.error(
    "[avaliacaoRoute] debugPosCursoController.debugPosCursoPorUsuario inválido:",
    debugPosCursoController?.debugPosCursoPorUsuario
  );

  throw new Error(
    "Contrato inválido: debugPosCursoController.debugPosCursoPorUsuario deve ser uma função."
  );
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

function responderErroValidacao(req, res, errors) {
  return res.status(400).json({
    ok: false,
    data: null,
    message: "Parâmetros inválidos.",
    code: "AVALIACAO_PARAMETROS_INVALIDOS",
    adminHint:
      "A rota de avaliação recebeu parâmetro ausente ou fora do contrato esperado.",
    details: errors.array().map((error) => ({
      campo: error.path || error.param,
      message: error.msg,
    })),
    requestId: req?.requestId || req?.rid || null,
  });
}

function validate(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return responderErroValidacao(req, res, errors);
}

const idParam = (name) =>
  param(name)
    .exists({ checkFalsy: true })
    .withMessage(`"${name}" é obrigatório.`)
    .bail()
    .isInt({ min: 1 })
    .withMessage(`"${name}" deve ser um inteiro maior ou igual a 1.`)
    .toInt();

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

function ensureSelfOrAdmin(req, res, next) {
  const usuarioIdToken = getUsuarioId(req);
  const usuarioIdParam = Number(req.params.usuario_id);
  const perfil = getPerfil(req);

  if (!Number.isInteger(usuarioIdParam) || usuarioIdParam <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "usuario_id inválido.",
      code: "AVALIACAO_USUARIO_ID_INVALIDO",
      adminHint:
        "O parâmetro usuario_id da rota de avaliação não é um inteiro positivo.",
    });
  }

  if (!usuarioIdToken) {
    return res.status(401).json({
      ok: false,
      data: null,
      message: "Usuário não autenticado.",
      code: "AVALIACAO_USUARIO_NAO_AUTENTICADO",
      adminHint: "req.user.id não foi encontrado no request.",
    });
  }

  if (perfil === "administrador" || usuarioIdToken === usuarioIdParam) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    data: null,
    message: "Sem permissão para consultar avaliações deste usuário.",
    code: "AVALIACAO_ACESSO_NEGADO",
    adminHint:
      "Usuário tentou consultar avaliações disponíveis de outro usuário sem perfil administrador.",
  });
}

function injectCurrentUserIdIntoParams(req, res, next) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return res.status(401).json({
      ok: false,
      data: null,
      message: "Usuário não autenticado.",
      code: "AVALIACAO_USUARIO_NAO_AUTENTICADO",
      adminHint: "req.user.id não foi encontrado no request.",
    });
  }

  req.params.usuario_id = String(usuarioId);
  return next();
}

/* ─────────────────────────────────────────────
 * Middlewares globais do grupo
 * ───────────────────────────────────────────── */

router.use(authMiddleware);

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Route-Group", "avaliacao");
  next();
});

/* ─────────────────────────────────────────────
 * Debug administrativo pós-curso
 * ───────────────────────────────────────────── */

/**
 * GET /api/avaliacao/debug/pos-curso/:usuario_id
 *
 * Função:
 * - Diagnóstico administrativo da liberação pós-curso.
 *
 * Permissão:
 * - administrador
 */
router.get(
  "/debug/pos-curso/:usuario_id",
  authorize("administrador"),
  [idParam("usuario_id")],
  validate,
  asyncHandler(debugPosCursoController.debugPosCursoPorUsuario)
);

/* ─────────────────────────────────────────────
 * Administração / analytics
 * ───────────────────────────────────────────── */

const adminRouter = express.Router();

adminRouter.use(authorize("administrador"));

/**
 * GET /api/avaliacao/admin/eventos
 *
 * Função:
 * - Lista eventos com avaliações registradas.
 *
 * Permissão:
 * - administrador
 */
adminRouter.get(
  "/eventos",
  asyncHandler(avaliacaoController.listarEventosComAvaliacao)
);

/**
 * GET /api/avaliacao/admin/evento/:evento_id
 *
 * Função:
 * - Retorna analytics/respostas agregadas de avaliação por evento.
 *
 * Params oficiais:
 * - evento_id
 *
 * Permissão:
 * - administrador
 */
adminRouter.get(
  "/evento/:evento_id",
  [idParam("evento_id")],
  validate,
  asyncHandler(avaliacaoController.obterAvaliacaoDoEvento)
);

/**
 * GET /api/avaliacao/admin/turma/:turma_id
 *
 * Função:
 * - Retorna respostas administrativas de avaliação por turma.
 *
 * Params oficiais:
 * - turma_id
 *
 * Permissão:
 * - administrador
 */
adminRouter.get(
  "/turma/:turma_id",
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoController.obterAvaliacaoDaTurma)
);

router.use("/admin", adminRouter);

/* ─────────────────────────────────────────────
 * Usuário / organizador / administração
 * ───────────────────────────────────────────── */

/**
 * POST /api/avaliacao
 *
 * Função:
 * - Envia avaliação da turma/evento após elegibilidade.
 *
 * Permissão:
 * - usuario
 * - organizador
 * - administrador
 */
router.post(
  "/",
  authorize("usuario", "organizador", "administrador"),
  asyncHandler(avaliacaoController.enviarAvaliacao)
);

/**
 * GET /api/avaliacao/disponivel
 *
 * Função:
 * - Lista avaliações disponíveis para o próprio usuário autenticado.
 *
 * Permissão:
 * - usuario
 * - organizador
 * - administrador
 */
router.get(
  "/disponivel",
  authorize("usuario", "organizador", "administrador"),
  injectCurrentUserIdIntoParams,
  asyncHandler(avaliacaoController.listarAvaliacaoDisponiveis)
);

/**
 * GET /api/avaliacao/disponivel/:usuario_id
 *
 * Função:
 * - Lista avaliações disponíveis para um usuário específico.
 * - Protegido contra IDOR.
 *
 * Params oficiais:
 * - usuario_id
 *
 * Permissão:
 * - administrador pode consultar qualquer usuário.
 * - demais perfis consultam somente o próprio id.
 */
router.get(
  "/disponivel/:usuario_id",
  authorize("usuario", "organizador", "administrador"),
  [idParam("usuario_id")],
  validate,
  ensureSelfOrAdmin,
  asyncHandler(avaliacaoController.listarAvaliacaoDisponiveis)
);

/**
 * GET /api/avaliacao/turma/:turma_id/all
 *
 * Função:
 * - Consulta administrativa agregada/RAW por turma.
 *
 * Params oficiais:
 * - turma_id
 *
 * Permissão:
 * - administrador
 */
router.get(
  "/turma/:turma_id/all",
  authorize("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoController.avaliacaoPorTurma)
);

/**
 * GET /api/avaliacao/turma/:turma_id
 *
 * Função:
 * - Lista respostas da turma para organizador vinculado ou administrador.
 *
 * Params oficiais:
 * - turma_id
 *
 * Permissão:
 * - organizador
 * - administrador
 */
router.get(
  "/turma/:turma_id",
  authorize("organizador", "administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacaoController.listarPorTurmaParaorganizador)
);

/**
 * GET /api/avaliacao/evento/:evento_id
 *
 * Função:
 * - Consulta agregada por evento.
 *
 * Params oficiais:
 * - evento_id
 *
 * Permissão:
 * - administrador
 */
router.get(
  "/evento/:evento_id",
  authorize("administrador"),
  [idParam("evento_id")],
  validate,
  asyncHandler(avaliacaoController.avaliacaoPorEvento)
);

module.exports = router;