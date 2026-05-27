/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/relatorioRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais do módulo de relatórios institucionais.
 * - Relatórios gerenciais, operacionais, documentais e de saúde da plataforma.
 *
 * Mount oficial:
 * - /api/relatorio
 *
 * Contrato oficial único:
 * - authMiddleware exporta função.
 * - authorize exporta função nomeada em ../middlewares/authorize.
 * - relatorioController exporta funções oficiais v2.0.
 * - Perfil oficial autorizado: administrador.
 *
 * Rotas oficiais:
 * - GET /resumo-geral
 * - GET /eventos
 * - GET /presencas
 * - GET /avaliacoes
 * - GET /organizadores
 * - GET /certificados
 * - GET /certificados/pendencias
 * - GET /usuarios
 * - GET /salas
 * - GET /notificacoes
 * - GET /saude-plataforma
 * - GET /exportar/:tipo.xlsx
 *
 * Diretrizes v2.1:
 * - Sem aliases.
 * - Sem rotas antigas /opcao, /exportar POST, /presenca, /presencas, /turma, /evento.
 * - Sem auth/authorize resiliente.
 * - Sem resposta { erro }.
 * - Sem X-Route-Handler.
 * - Sem compatibilidade legada.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const {
  resumoGeral,
  relatorioEventos,
  relatorioPresencas,
  relatorioAvaliacoes,
  relatorioorganizadores,
  relatorioCertificados,
  relatorioCertificadosPendencias,
  relatorioUsuarios,
  relatorioSalas,
  relatorioNotificacoes,
  relatorioSaudePlataforma,
  exportarRelatorioXlsx,
} = require("../controllers/relatorioController");

const router = express.Router();

/* ─────────────────────────────────────────────
 * Contratos obrigatórios
 * ───────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[relatorioRoute] authMiddleware inválido:", authMiddleware);

  throw new Error(
    "Contrato inválido: backend/src/auth/authMiddleware.js deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  console.error("[relatorioRoute] authorize inválido:", authorize);

  throw new Error(
    "Contrato inválido: backend/src/middlewares/authorize.js deve expor { authorize } como função."
  );
}

function assertControllerFn(name, fn) {
  if (typeof fn !== "function") {
    console.error(`[relatorioRoute] relatorioController.${name} inválido:`, fn);

    throw new Error(
      `Contrato inválido: relatorioController.${name} deve ser uma função.`
    );
  }
}

assertControllerFn("resumoGeral", resumoGeral);
assertControllerFn("relatorioEventos", relatorioEventos);
assertControllerFn("relatorioPresencas", relatorioPresencas);
assertControllerFn("relatorioAvaliacoes", relatorioAvaliacoes);
assertControllerFn("relatorioorganizadores", relatorioorganizadores);
assertControllerFn("relatorioCertificados", relatorioCertificados);
assertControllerFn(
  "relatorioCertificadosPendencias",
  relatorioCertificadosPendencias
);
assertControllerFn("relatorioUsuarios", relatorioUsuarios);
assertControllerFn("relatorioSalas", relatorioSalas);
assertControllerFn("relatorioNotificacoes", relatorioNotificacoes);
assertControllerFn("relatorioSaudePlataforma", relatorioSaudePlataforma);
assertControllerFn("exportarRelatorioXlsx", exportarRelatorioXlsx);

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function getRequestId(req) {
  return req?.requestId || req?.rid || null;
}

function responderErro(
  res,
  statusCode,
  message,
  code,
  adminHint,
  details = null,
  req = null
) {
  return res.status(statusCode).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId: getRequestId(req),
  });
}

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}

function ensureAuthenticatedContext(req, res, next) {
  const usuarioId = Number(req?.user?.id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "RELATORIO_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado após authMiddleware.",
      null,
      req
    );
  }

  return next();
}

function ensureTipoExportacaoValido(req, res, next) {
  const tipo = String(req.params?.tipo || "").trim().toLowerCase();

  const tiposValidos = new Set([
    "eventos",
    "presencas",
    "avaliacoes",
    "organizadores",
    "certificados",
    "usuarios",
    "notificacoes",
    "saude-plataforma",
  ]);

  if (!tiposValidos.has(tipo)) {
    return responderErro(
      res,
      400,
      "Tipo de relatório inválido para exportação.",
      "RELATORIO_EXPORTACAO_TIPO_INVALIDO",
      "Use um dos tipos oficiais de exportação XLSX.",
      {
        tipo_recebido: req.params?.tipo || null,
        tipos_validos: Array.from(tiposValidos),
      },
      req
    );
  }

  req.params.tipo = tipo;

  return next();
}

function ensureXlsxExtension(req, res, next) {
  const originalUrl = String(req.originalUrl || "");

  if (!originalUrl.toLowerCase().endsWith(".xlsx")) {
    return responderErro(
      res,
      404,
      "Rota de exportação não encontrada.",
      "RELATORIO_EXPORTACAO_EXTENSAO_OBRIGATORIA",
      "A exportação oficial usa a rota /api/relatorio/exportar/:tipo.xlsx.",
      null,
      req
    );
  }

  return next();
}

/* ─────────────────────────────────────────────
 * Rate limit
 * ───────────────────────────────────────────── */

const relatorioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    data: null,
    message: "Muitas requisições. Aguarde alguns instantes e tente novamente.",
    code: "RELATORIO_RATE_LIMIT",
    adminHint:
      "Rate limit aplicado ao grupo de relatórios para proteger endpoints pesados.",
    details: null,
  },
});

const exportacaoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    data: null,
    message:
      "Muitas exportações solicitadas. Aguarde alguns instantes e tente novamente.",
    code: "RELATORIO_EXPORTACAO_RATE_LIMIT",
    adminHint:
      "Rate limit aplicado às exportações XLSX por serem operações mais pesadas.",
    details: null,
  },
});

/* ─────────────────────────────────────────────
 * Middlewares do grupo
 * ───────────────────────────────────────────── */

router.use(noStore);
router.use(authMiddleware);
router.use(ensureAuthenticatedContext);
router.use(authorize("administrador"));

/* ─────────────────────────────────────────────
 * Relatórios institucionais
 * ───────────────────────────────────────────── */

/**
 * GET /api/relatorio/resumo-geral
 *
 * Função:
 * - Indicadores consolidados da plataforma.
 */
router.get(
  "/resumo-geral",
  relatorioLimiter,
  asyncHandler(resumoGeral)
);

/**
 * GET /api/relatorio/eventos
 *
 * Query oficial:
 * - data_inicio=YYYY-MM-DD
 * - data_fim=YYYY-MM-DD
 * - evento_id=integer
 * - status=programado|andamento|encerrado
 */
router.get(
  "/eventos",
  relatorioLimiter,
  asyncHandler(relatorioEventos)
);

/**
 * GET /api/relatorio/presencas
 *
 * Query oficial:
 * - data_inicio=YYYY-MM-DD
 * - data_fim=YYYY-MM-DD
 * - evento_id=integer
 * - turma_id=integer
 * - usuario_id=integer
 */
router.get(
  "/presencas",
  relatorioLimiter,
  asyncHandler(relatorioPresencas)
);

/**
 * GET /api/relatorio/avaliacoes
 *
 * Query oficial:
 * - data_inicio=YYYY-MM-DD
 * - data_fim=YYYY-MM-DD
 * - evento_id=integer
 * - turma_id=integer
 * - organizador_id=integer
 */
router.get(
  "/avaliacoes",
  relatorioLimiter,
  asyncHandler(relatorioAvaliacoes)
);

/**
 * GET /api/relatorio/organizadores
 *
 * Query oficial:
 * - data_inicio=YYYY-MM-DD
 * - data_fim=YYYY-MM-DD
 * - organizador_id=integer
 */
router.get(
  "/organizadores",
  relatorioLimiter,
  asyncHandler(relatorioorganizadores)
);

/**
 * GET /api/relatorio/certificados
 *
 * Query oficial:
 * - data_inicio=YYYY-MM-DD
 * - data_fim=YYYY-MM-DD
 * - evento_id=integer
 * - turma_id=integer
 * - usuario_id=integer
 * - status=emitido|enviado|cancelado|anulado|substituido|erro_emissao
 */
router.get(
  "/certificados",
  relatorioLimiter,
  asyncHandler(relatorioCertificados)
);

/**
 * GET /api/relatorio/certificados/pendencias
 *
 * Função:
 * - Diagnóstico de bloqueios e pendências para emissão/envio de certificados.
 */
router.get(
  "/certificados/pendencias",
  relatorioLimiter,
  asyncHandler(relatorioCertificadosPendencias)
);

/**
 * GET /api/relatorio/usuarios
 *
 * Função:
 * - Relatório de usuários e completude cadastral/institucional.
 */
router.get(
  "/usuarios",
  relatorioLimiter,
  asyncHandler(relatorioUsuarios)
);

/**
 * GET /api/relatorio/salas
 *
 * Função:
 * - Relatório de reservas/uso de salas.
 */
router.get(
  "/salas",
  relatorioLimiter,
  asyncHandler(relatorioSalas)
);

/**
 * GET /api/relatorio/notificacoes
 *
 * Função:
 * - Relatório de notificações enviadas/lidas/não lidas.
 */
router.get(
  "/notificacoes",
  relatorioLimiter,
  asyncHandler(relatorioNotificacoes)
);

/**
 * GET /api/relatorio/saude-plataforma
 *
 * Função:
 * - Diagnóstico administrativo de saúde da plataforma.
 */
router.get(
  "/saude-plataforma",
  relatorioLimiter,
  asyncHandler(relatorioSaudePlataforma)
);

/* ─────────────────────────────────────────────
 * Exportações XLSX
 * ───────────────────────────────────────────── */

/**
 * GET /api/relatorio/exportar/:tipo.xlsx
 *
 * Tipos oficiais:
 * - eventos
 * - presencas
 * - avaliacoes
 * - organizadores
 * - certificados
 * - usuarios
 * - notificacoes
 * - saude-plataforma
 *
 * Exemplo:
 * - /api/relatorio/exportar/eventos.xlsx?data_inicio=2026-01-01&data_fim=2026-12-31
 */
router.get(
  "/exportar/:tipo.xlsx",
  exportacaoLimiter,
  ensureXlsxExtension,
  ensureTipoExportacaoValido,
  asyncHandler(exportarRelatorioXlsx)
);

module.exports = router;