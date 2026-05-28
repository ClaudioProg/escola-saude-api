/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/index.js — v2.3
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Centralizar as rotas oficiais da API em /api.
 *
 * Padrão:
 * - Rotas em português.
 * - Rotas no singular sempre que fizer sentido no domínio.
 * - Sem aliases legados.
 * - Sem duplicidade usuario/usuarios/user/users.
 * - Sem fallback silencioso que esconda erro real.
 *
 * Contrato:
 * - Se uma rota obrigatória falhar no carregamento, o servidor deve falhar no boot.
 * - Corrigir a causa é melhor do que manter API parcialmente montada.
 *
 * Alterações relevantes:
 * - A antiga rota conceitual de solicitação de curso foi substituída por:
 *   /api/calendario-eps
 * - Novo módulo oficial:
 *   /api/curso-online
 * - Novo módulo oficial:
 *   /api/pesquisa
 * - Novo módulo oficial:
 *   /api/interacao
 * - Novo módulo oficial:
 *   /api/auditoria
 * - Novo módulo oficial:
 *   /api/mensagem
 * - Novo módulo oficial:
 *   /api/pendencia
 * - Novo módulo oficial:
 *   /api/saude-plataforma
 * - Novo módulo oficial:
 *
 * Não manter:
 * - /api/solicitacao-curso
 * - /api/cursos-online
 * - /api/cursoOnline
 * - /api/pesquisas
 * - /api/survey
 * - /api/formulario
 * - /api/votacao
 * - /api/votacoes
 * - /api/quiz
 * - /api/nuvem-palavras
 * - /api/audit
 * - /api/auditorias
 * - /api/log
 * - /api/logs
 * - /api/mensagens
 * - /api/chat
 * - /api/chamado
 * - /api/chamados
 * - /api/pendencias
 * - /api/health-admin
 * - /api/platform-health
 * - /api/saude
 * - /api/impersonar
 * - /api/impersonacao
 */

const express = require("express");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function mount(path, route, label = path) {
  if (!path || typeof path !== "string") {
    throw new Error(`[routes:index] path inválido para ${label}.`);
  }

  if (!route) {
    throw new Error(`[routes:index] rota obrigatória ausente: ${label}.`);
  }

  router.use(path, route);
  console.log(`[routes:index] ${label} montado em /api${path}`);
}

function getRequestId(req) {
  return req?.requestId || null;
}

function apiOk(
  res,
  { data = null, message = "OK", code = "OK", meta = null } = {}
) {
  return res.status(200).json({
    ok: true,
    data,
    message,
    code,
    ...(meta ? { meta } : {}),
  });
}

function apiNotFound(req, res) {
  return res.status(404).json({
    ok: false,
    data: null,
    message: "Rota da API não encontrada.",
    code: "API_ROTA_NAO_ENCONTRADA",
    adminHint:
      "Verifique backend/src/routes/index.js, o mount oficial da rota e o prefixo usado no frontend.",
    details: {
      method: req.method,
      path: req.originalUrl || req.url,
    },
    requestId: getRequestId(req),
  });
}

/* ─────────────────────────────────────────────────────────────
   Imports obrigatórios
────────────────────────────────────────────────────────────── */

// Público / sistema
const lookupPublicRoute = require("./lookupPublicRoute");

// Autenticação / perfil
const loginRoute = require("./loginRoute");
const perfilRoute = require("./perfilRoute");
const authPublicRoute = require("./authPublicRoute");
const authGoogleRoute = require("../auth/authGoogle");

// Upload
const uploadRoute = require("./uploadRoute");

// Eventos / turmas / inscrições / agenda
const eventoRoute = require("./eventoRoute");
const turmaRoute = require("./turmaRoute");
const inscricaoRoute = require("./inscricaoRoute");
const agendaRoute = require("./agendaRoute");

// Calendário
const calendarioRoute = require("./calendarioRoute");
const calendarioAnualEPSRoute = require("./calendarioAnualEPSRoute");

// Cursos online
const cursoOnlineRoute = require("./cursoOnlineRoute");

// Presença / relatório
const presencaRoute = require("./presencaRoute");
const relatorioRoute = require("./relatorioRoute");

// Usuário / organizador / unidade
const usuarioRoute = require("./usuarioRoute");
const organizadorRoute = require("./organizadorRoute");
const unidadeRoute = require("./unidadeRoute");

// Avaliação / questionário / pesquisa / interação
const avaliacaoRoute = require("./avaliacaoRoute");
const questionarioRoute = require("./questionarioRoute");
const pesquisaRoute = require("./pesquisaRoute");
const interacaoRoute = require("./interacaoRoute");

// Dashboard / certificado / informações
const dashboardRoute = require("./dashboardRoute");
const certificadoRoute = require("./certificadoRoute");
const informacoesRoute = require("./informacoesRoute");

// Trabalhos / chamada / submissão
const trabalhoRoute = require("./trabalhoRoute");
const chamadaRoute = require("./chamadaRoute");
const submissaoRoute = require("./submissaoRoute");

// Assinatura
const assinaturaRoute = require("./assinaturaRoute");

// Salas / métricas
const salaRoute = require("./salaRoute");
const metricaRoute = require("./metricRoute");

// Notificação
const notificacaoRoute = require("./notificacaoRoute");
const notificacaoProgramadaRoute = require("./notificacaoProgramadaRoute");

// Auditoria / diagnóstico / mensagens institucionais
const auditoriaRoute = require("./auditoriaRoute");
const mensagemRoute = require("./mensagemRoute");
const pendenciaRoute = require("./pendenciaRoute");
const saudePlataformaRoute = require("./saudePlataformaRoute");

/* ─────────────────────────────────────────────────────────────
   Healthcheck interno da API
────────────────────────────────────────────────────────────── */

router.get("/health", (req, res) =>
  apiOk(res, {
    data: {
      service: "escoladasaude-api",
      scope: "api",
    },
    message: "API ativa.",
    code: "API_HEALTH_OK",
    meta: {
      requestId: getRequestId(req),
    },
  })
);

router.head("/health", (_req, res) => res.sendStatus(204));

/* ─────────────────────────────────────────────────────────────
   Público
────────────────────────────────────────────────────────────── */

mount("/lookup", lookupPublicRoute, "lookupPublicRoute");

/* ─────────────────────────────────────────────────────────────
   Autenticação / perfil
────────────────────────────────────────────────────────────── */

mount("/login", loginRoute, "loginRoute");
mount("/perfil", perfilRoute, "perfilRoute");
mount("/auth", authPublicRoute, "authPublicRoute");
mount("/auth", authGoogleRoute, "authGoogleRoute");

/* ─────────────────────────────────────────────────────────────
   Upload
────────────────────────────────────────────────────────────── */

mount("/upload", uploadRoute, "uploadRoute");

/* ─────────────────────────────────────────────────────────────
   Eventos / turmas / inscrições / agenda
────────────────────────────────────────────────────────────── */

mount("/evento", eventoRoute, "eventoRoute");
mount("/turma", turmaRoute, "turmaRoute");
mount("/inscricao", inscricaoRoute, "inscricaoRoute");
mount("/agenda", agendaRoute, "agendaRoute");

/* ─────────────────────────────────────────────────────────────
   Calendário
────────────────────────────────────────────────────────────── */

mount("/calendario", calendarioRoute, "calendarioRoute");
mount(
  "/calendario-eps",
  calendarioAnualEPSRoute,
  "calendarioAnualEPSRoute"
);

/* ─────────────────────────────────────────────────────────────
   Cursos online
────────────────────────────────────────────────────────────── */

mount("/curso-online", cursoOnlineRoute, "cursoOnlineRoute");

/* ─────────────────────────────────────────────────────────────
   Presença / relatório
────────────────────────────────────────────────────────────── */

mount("/presenca", presencaRoute, "presencaRoute");
mount("/relatorio", relatorioRoute, "relatorioRoute");

/* ─────────────────────────────────────────────────────────────
   Usuário / organizador / unidade
────────────────────────────────────────────────────────────── */

mount("/usuario", usuarioRoute, "usuarioRoute");
mount("/organizador", organizadorRoute, "organizadorRoute");
mount("/unidade", unidadeRoute, "unidadeRoute");

/* ─────────────────────────────────────────────────────────────
   Avaliação / questionário / pesquisa / interação
────────────────────────────────────────────────────────────── */

mount("/avaliacao", avaliacaoRoute, "avaliacaoRoute");
mount("/questionario", questionarioRoute, "questionarioRoute");
mount("/pesquisa", pesquisaRoute, "pesquisaRoute");
mount("/interacao", interacaoRoute, "interacaoRoute");

/* ─────────────────────────────────────────────────────────────
   Dashboard
────────────────────────────────────────────────────────────── */

mount("/dashboard", dashboardRoute, "dashboardRoute");

/* ─────────────────────────────────────────────────────────────
   Certificado
────────────────────────────────────────────────────────────── */

mount("/certificado", certificadoRoute, "certificadoRoute");

/* ─────────────────────────────────────────────────────────────
   Informação institucional
────────────────────────────────────────────────────────────── */

mount("/informacoes", informacoesRoute, "informacoesRoute");

/* ─────────────────────────────────────────────────────────────
   Trabalho / chamada / submissão
────────────────────────────────────────────────────────────── */

mount("/trabalho", trabalhoRoute, "trabalhoRoute");
mount("/chamada", chamadaRoute, "chamadaRoute");
mount("/submissao", submissaoRoute, "submissaoRoute");

/* ─────────────────────────────────────────────────────────────
   Assinatura
────────────────────────────────────────────────────────────── */

mount("/assinatura", assinaturaRoute, "assinaturaRoute");

/* ─────────────────────────────────────────────────────────────
   Sala
────────────────────────────────────────────────────────────── */

mount("/sala", salaRoute, "salaRoute");

/* ─────────────────────────────────────────────────────────────
   Métrica
────────────────────────────────────────────────────────────── */

mount("/metrica", metricaRoute, "metricaRoute");

/* ─────────────────────────────────────────────────────────────
   Notificação
────────────────────────────────────────────────────────────── */

mount("/notificacao", notificacaoRoute, "notificacaoRoute");
mount(
  "/notificacao-programada",
  notificacaoProgramadaRoute,
  "notificacaoProgramadaRoute"
);

/* ─────────────────────────────────────────────────────────────
   Auditoria / diagnóstico /  mensagens institucionais
────────────────────────────────────────────────────────────── */

mount("/auditoria", auditoriaRoute, "auditoriaRoute");
mount("/mensagem", mensagemRoute, "mensagemRoute");
mount("/pendencia", pendenciaRoute, "pendenciaRoute");
mount(
  "/saude-plataforma",
  saudePlataformaRoute,
  "saudePlataformaRoute"
);
/* ─────────────────────────────────────────────────────────────
   Fallback 404 da API
────────────────────────────────────────────────────────────── */

router.use(apiNotFound);

module.exports = router;