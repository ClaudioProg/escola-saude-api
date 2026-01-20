/* eslint-disable no-console */
// ✅ src/routes/index.js — PREMIUM (fonte única de mounts + singular + aliases)
"use strict";

const express = require("express");
const router = express.Router();

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* ───────────────── Auth resiliente (p/ bridges globais) ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[routes:index] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Controller ÚNICO de submissões (inclui avaliador) ───────────────── */
let submissaoCtrl = null;
try {
  submissaoCtrl = require("../controllers/submissaoController");
} catch (e) {
  console.warn("[routes] ⚠️ submissaoController não carregou:", e?.message || e);
  submissaoCtrl = null;
}

/* =========================
   Imports (conforme /src/routes)
========================= */

// Core / Públicos
const lookupsPublicRoute = require("./lookupsPublicRoute");

// Auth / Perfil / Login
const loginRoute = require("./loginRoute");
const perfilRoute = require("./perfilRoute");

// Upload
const uploadRoute = require("./uploadRoute");

// Eventos / Turma / Inscrição / Agenda
const eventoRoute = require("./eventoRoute");
const turmaRoute = require("./turmaRoute");
const inscricaoRoute = require("./inscricaoRoute");
const agendaRoute = require("./agendaRoute");

// ✅ Calendário/Bloqueios (admin)
const calendarioRoute = require("./calendarioRoute");

// Presença / Relatório
const presencaRoute = require("./presencaRoute");
const relatorioRoute = require("./relatorioRoute");

// Usuário / Instrutor / Unidade
const usuarioRoute = require("./usuarioRoute");
const instrutorRoute = require("./instrutorRoute");
const unidadeRoute = require("./unidadeRoute");

// Avaliação
const avaliacaoRoute = require("./avaliacaoRoute");

// Dashboard / Certificado
const dashboardRoute = require("./dashboardRoute");
const certificadoRoute = require("./certificadoRoute");

// ✅ Trabalhos (repositório / submissões / uploads)
const trabalhoRoute = require("./trabalhoRoute");

// ✅ Assinatura (instrutor/admin)
const assinaturaRoute = require("./assinaturaRoute");

// ✅ CHAMADAS (router próprio, NÃO “auto-prefixado” na raiz)
const chamadaRoute = require("./chamadaRoute");

// Submissão (opcional) — com LOG do motivo quando falha
let submissaoRoute = null;
try {
  submissaoRoute = require("./submissaoRoute");
  console.log("[routes] ✅ submissaoRoute carregado:", typeof submissaoRoute);
} catch (e) {
  console.warn("[routes] ⚠️ submissaoRoute não carregou:", e?.message || e);
  submissaoRoute = null;
}

// Outros módulos
const salaRoute = require("./salaRoute");
const solicitacaoCursoRoute = require("./solicitacaoCursoRoute");
const questionarioRoute = require("./questionarioRoute");
const votacaoRoute = require("./votacaoRoute");

// ✅ Métricas via route wrapper
const metricRoute = require("./metricRoute");

// Datas (turma/evento)
const dataEventoRoute = require("./dataEventoRoute");

// Notificação (opcional) — com LOG do motivo quando falha
let notificacaoRoute = null;
try {
  notificacaoRoute = require("./notificacaoRoute");
  console.log("[routes] ✅ notificacaoRoute carregado:", typeof notificacaoRoute);
} catch (e) {
  console.warn("[routes] ⚠️ notificacaoRoute não carregou:", e?.message || e);
  notificacaoRoute = null;
}

/* =========================
   Healthcheck
========================= */
router.get("/health", (_req, res) => res.json({ ok: true }));

/* =========================
   Público / Lookups
========================= */
router.use("/public", lookupsPublicRoute);

/* =========================
   Auth / Perfil / Login
========================= */
router.use("/login", loginRoute);
router.use("/perfil", perfilRoute);

/* =========================
   Upload
========================= */
router.use("/upload", uploadRoute);

/* =========================
   Eventos / Turma / Inscrição / Agenda
========================= */
router.use("/evento", eventoRoute);
router.use("/turma", turmaRoute);
router.use("/inscricao", inscricaoRoute);
router.use("/agenda", agendaRoute);

// ✅ Aliases plural/legado
router.use("/eventos", eventoRoute);
router.use("/turmas", turmaRoute);
router.use("/inscricoes", inscricaoRoute);

/* =========================
   ✅ Calendário / Bloqueios (front legado chama /api/calendario)
   Lugar certo: módulo próprio.
========================= */
router.use("/calendario", calendarioRoute);
router.use("/calendarios", calendarioRoute);
router.use("/calendar", calendarioRoute);
router.use("/calendars", calendarioRoute);

/* =========================
   Presença / Relatório
========================= */
router.use("/presenca", presencaRoute);
router.use("/relatorio", relatorioRoute);

// ✅ Aliases legado
router.use("/presencas", presencaRoute);
router.use("/relatorios", relatorioRoute);
router.use("/relatorio-presencas", relatorioRoute);
router.use("/relatorio-presenca", relatorioRoute);

/* =========================
   Usuário / Instrutor / Unidade
========================= */
router.use("/usuario", usuarioRoute);
router.use("/instrutor", instrutorRoute);
router.use("/unidade", unidadeRoute);

// ✅ Aliases legado
router.use("/usuarios", usuarioRoute);
router.use("/instrutores", instrutorRoute);
router.use("/unidades", unidadeRoute);

/* =========================================================
   ✅ BRIDGE GLOBAL — Avaliador/Submissões (frontend legado)
   ⚠️ PRECISA vir ANTES de /avaliacao (porque /avaliacao é um mount)
========================================================= */
if (submissaoCtrl) {
  // /api/avaliador/*
  router.get("/avaliador/submissao", requireAuth, asyncHandler(submissaoCtrl.listarAtribuidas));
  router.get("/avaliador/pendentes", requireAuth, asyncHandler(submissaoCtrl.listarPendentes));
  router.get("/avaliador/minhas-contagens", requireAuth, asyncHandler(submissaoCtrl.minhasContagens));
  router.get("/avaliador/para-mim", requireAuth, asyncHandler(submissaoCtrl.paraMim));
  router.get("/avaliador/minhas-submissao", requireAuth, asyncHandler(submissaoCtrl.listarAtribuidas)); // alias

  // legacy diretos
  router.get("/avaliacao/atribuidas", requireAuth, asyncHandler(submissaoCtrl.listarAtribuidas));
  router.get("/submissao/atribuidas", requireAuth, asyncHandler(submissaoCtrl.listarAtribuidas));
  router.get("/submissao/para-mim", requireAuth, asyncHandler(submissaoCtrl.paraMim));
  router.get("/admin/submissao/para-mim", requireAuth, asyncHandler(submissaoCtrl.paraMim));

  // HEADs “descoberta”
  router.head("/avaliador/submissao", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/pendentes", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/minhas-contagens", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/para-mim", (_req, res) => res.sendStatus(204));
  router.head("/avaliacao/atribuidas", (_req, res) => res.sendStatus(204));
  router.head("/submissao/atribuidas", (_req, res) => res.sendStatus(204));
  router.head("/submissao/para-mim", (_req, res) => res.sendStatus(204));
  router.head("/admin/submissao/para-mim", (_req, res) => res.sendStatus(204));
}

/* =========================================================
   ✅ BRIDGE GLOBAL — Admin Avaliação (frontend legado)
   Front chama: /api/admin/avaliacao/eventos
   ✅ Corrige o caso em que o avaliacaoRoute usa /admin/evento (singular)
========================================================= */
function forwardTryAvaliacao(makeCandidates) {
  return (req, res, next) => {
    const originalUrl = req.url; // ex.: "/eventos"
    const candidates = makeCandidates(originalUrl);

    let i = 0;
    const attempt = () => {
      if (i >= candidates.length) {
        req.url = originalUrl;
        return next();
      }

      req.url = candidates[i++];
      return avaliacaoRoute(req, res, (err) => {
        if (err) return next(err);
        if (res.headersSent) return;
        return attempt();
      });
    };

    return attempt();
  };
}

// helpers de plural->singular (eventos->evento, turmas->turma)
function singularizeAdminSuffix(suffix) {
  // suffix sempre começa com "/"
  // "/eventos" -> "/evento"
  // "/eventos/123" -> "/evento/123"
  // "/turmas/55" -> "/turma/55"
  return String(suffix)
    .replace(/^\/eventos(\/|$)/, "/evento$1")
    .replace(/^\/turmas(\/|$)/, "/turma$1");
}

router.use(
  "/admin/avaliacao",
  requireAuth,
  forwardTryAvaliacao((suffix) => {
    const s = String(suffix || "/");
    const sSing = singularizeAdminSuffix(s);

    return [
      // ✅ formato esperado pelo seu avaliacaoRoute atual: /api/avaliacao/admin/evento...
      `/admin${sSing}`,             // /admin/evento   ✅ para /eventos do front
      `/admin${s}`,                 // /admin/eventos  (se algum dia existir)
      `/admin/avaliacao${sSing}`,   // /admin/avaliacao/evento
      `/admin/avaliacao${s}`,       // /admin/avaliacao/eventos
      `/admin/avaliacoes${sSing}`,  // /admin/avaliacoes/evento
      `/admin/avaliacoes${s}`,      // /admin/avaliacoes/eventos
      `${sSing}`,                   // /evento (fallback)
      `${s}`,                       // /eventos (fallback)
    ];
  })
);

/* =========================
   Avaliação
========================= */
router.use("/avaliacao", avaliacaoRoute);
router.use("/avaliacoes", avaliacaoRoute);

/* =========================
   Dashboard
========================= */
router.use("/dashboard", dashboardRoute);
router.use("/dashboard-usuario", dashboardRoute);
router.use("/dashboard-analitico", dashboardRoute);

/* =========================
   Certificado
========================= */
router.use("/certificado", certificadoRoute);
router.use("/certificados", certificadoRoute);
router.use("/certificados-admin", certificadoRoute);
router.use("/certificados-avulsos", certificadoRoute);

/* =========================
   Calendário / Datas (turma/evento)
========================= */
router.use("/data", dataEventoRoute);
router.use("/datas", dataEventoRoute);

/* =========================
   Trabalhos (repositório)
========================= */
router.use("/trabalho", trabalhoRoute);
router.use("/trabalhos", trabalhoRoute);

/* =========================
   Assinatura
========================= */
router.use("/assinatura", assinaturaRoute);
router.use("/assinaturas", assinaturaRoute);

/* =========================
   ✅ CHAMADAS — mounts corretos (NÃO na raiz "/")
   Isso evita “roubar” rotas como /submissao/:id e /admin/avaliacao/...
========================= */
router.use("/chamada", chamadaRoute);
router.use("/chamadas", chamadaRoute);

/* =========================
   Submissão (se existir)
========================= */
if (submissaoRoute) {
  router.use("/submissao", submissaoRoute);
  router.use("/submissoes", submissaoRoute);
} else {
  // DEV fallback mínimo
  router.get("/submissao/minhas", (_req, res) => res.json([]));
  router.get("/submissoes/minhas", (_req, res) => res.json([]));
}

/* =========================
   Outros módulos
========================= */
router.use("/sala", salaRoute);
router.use("/salas", salaRoute);

router.use("/solicitacao-curso", solicitacaoCursoRoute);

router.use("/questionario", questionarioRoute);
router.use("/questionarios", questionarioRoute);

router.use("/votacao", votacaoRoute);
router.use("/votacoes", votacaoRoute);

// ✅ Métricas (com aliases)
router.use("/metric", metricRoute);
router.use("/metrica", metricRoute);
router.use("/metricas", metricRoute);

// ✅ Notificação (só se existir)
if (notificacaoRoute) {
  router.use("/notificacao", notificacaoRoute);
  router.use("/notificacoes", notificacaoRoute);
}

/* =========================
   Fallback 404 (API)
========================= */
router.use((_req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

module.exports = router;
