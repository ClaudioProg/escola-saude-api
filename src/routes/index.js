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
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[routes:index] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
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
const authPublicRoute = require("./authPublicRoute");
const authGoogleRoute = require("../auth/authGoogle");

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

// Dashboard / Certificado / Informações
const dashboardRoute = require("./dashboardRoute");
const certificadoRoute = require("./certificadoRoute");
const informacoesRoute = require("./informacoesRoute");

// ✅ Trabalhos (repositório / submissões / uploads)
const trabalhoRoute = require("./trabalhoRoute");

// ✅ Assinatura (instrutor/admin)
const assinaturaRoute = require("./assinaturaRoute");

// ✅ CHAMADAS
const chamadaRoute = require("./chamadaRoute");

// Submissão (opcional)
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

// Notificação (opcional)
let notificacaoRoute = null;
try {
  notificacaoRoute = require("./notificacaoRoute");
  console.log("[routes] ✅ notificacaoRoute carregado:", typeof notificacaoRoute);
} catch (e) {
  console.warn("[routes] ⚠️ notificacaoRoute não carregou:", e?.message || e);
  notificacaoRoute = null;
}

/* =========================
   Helpers de forward / bridge
========================= */
function forwardToRouter(targetRouter, prefixToAdd = "") {
  return (req, res, next) => {
    const originalUrl = req.url;
    req._bridgedFrom = req.originalUrl || req.url;

    req.url = `${prefixToAdd}${originalUrl}`;

    return targetRouter(req, res, (err) => {
      req.url = originalUrl;
      if (err) return next(err);
      if (res.headersSent) return;
      return next();
    });
  };
}

function forwardTry(targetRouter, makeCandidates) {
  return (req, res, next) => {
    const originalUrl = req.url;
    const candidates = makeCandidates(originalUrl);
    req._bridgedFrom = req.originalUrl || req.url;

    let idx = 0;

    const attempt = () => {
      if (idx >= candidates.length) {
        req.url = originalUrl;
        return next();
      }

      req.url = candidates[idx++];

      return targetRouter(req, res, (err) => {
        if (err) {
          req.url = originalUrl;
          return next(err);
        }
        if (res.headersSent) {
          req.url = originalUrl;
          return;
        }
        return attempt();
      });
    };

    return attempt();
  };
}

function singularizeAdminSuffix(suffix) {
  return String(suffix)
    .replace(/^\/eventos(\/|$)/, "/evento$1")
    .replace(/^\/turmas(\/|$)/, "/turma$1");
}

/* =========================
   Healthcheck
========================= */
router.get("/health", (_req, res) => res.json({ ok: true }));
router.head("/health", (_req, res) => res.sendStatus(204));

/* =========================
   Público / Lookups
========================= */
router.use("/public", lookupsPublicRoute);

/* =========================
   Auth / Perfil / Login
========================= */
router.use("/login", loginRoute);
router.use("/perfil", perfilRoute);

router.use("/auth", authPublicRoute);
router.use("/usuarios", authPublicRoute);
router.use("/usuario", authPublicRoute);

router.use("/auth", authGoogleRoute);

/* =========================
   Upload
========================= */
router.use("/upload", uploadRoute);

/* =========================
   Eventos / Turma / Inscrição / Agenda
========================= */
router.use("/evento", eventoRoute);
router.use("/eventos", eventoRoute);

router.use("/turma", turmaRoute);
router.use("/turmas", turmaRoute);

router.use("/inscricao", inscricaoRoute);
router.use("/inscricoes", inscricaoRoute);

router.use("/agenda", agendaRoute);

/* =========================
   ✅ Calendário / Bloqueios
========================= */
router.use("/calendario", calendarioRoute);
router.use("/calendarios", calendarioRoute);
router.use("/calendar", calendarioRoute);
router.use("/calendars", calendarioRoute);

/* =========================
   Presença / Relatório
========================= */
router.use("/presenca", presencaRoute);
router.use("/presencas", presencaRoute);

router.use("/relatorio", relatorioRoute);
router.use("/relatorios", relatorioRoute);
router.use("/relatorio-presencas", relatorioRoute);
router.use("/relatorio-presenca", relatorioRoute);

/* =========================
   Usuário / Instrutor / Unidade
========================= */
router.use("/usuario", usuarioRoute);
router.use("/usuarios", usuarioRoute);

router.use("/instrutor", instrutorRoute);
router.use("/instrutores", instrutorRoute);

router.use("/unidade", unidadeRoute);
router.use("/unidades", unidadeRoute);

/* =========================================================
   ✅ BRIDGE GLOBAL — Avaliador/Submissões (frontend legado)
   ⚠️ PRECISA vir ANTES de /avaliacao (mount)
========================================================= */
if (submissaoCtrl) {
  // /api/avaliador/*
  router.get(
    "/avaliador/submissao",
    requireAuth,
    asyncHandler(submissaoCtrl.listarAtribuidas)
  );
  router.get(
    "/avaliador/pendentes",
    requireAuth,
    asyncHandler(submissaoCtrl.listarPendentes)
  );
  router.get(
    "/avaliador/minhas-contagens",
    requireAuth,
    asyncHandler(submissaoCtrl.minhasContagens)
  );
  router.get(
    "/avaliador/para-mim",
    requireAuth,
    asyncHandler(submissaoCtrl.paraMim)
  );
  router.get(
    "/avaliador/minhas-submissao",
    requireAuth,
    asyncHandler(submissaoCtrl.listarAtribuidas)
  ); // alias

  // legados diretos
  router.get(
    "/avaliacao/atribuidas",
    requireAuth,
    asyncHandler(submissaoCtrl.listarAtribuidas)
  );
  router.get(
    "/submissao/atribuidas",
    requireAuth,
    asyncHandler(submissaoCtrl.listarAtribuidas)
  );
  router.get(
    "/submissao/para-mim",
    requireAuth,
    asyncHandler(submissaoCtrl.paraMim)
  );
  router.get(
    "/admin/submissao/para-mim",
    requireAuth,
    asyncHandler(submissaoCtrl.paraMim)
  );

  // HEADs
  router.head("/avaliador/submissao", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/pendentes", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/minhas-contagens", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/para-mim", (_req, res) => res.sendStatus(204));
  router.head("/avaliador/minhas-submissao", (_req, res) => res.sendStatus(204));
  router.head("/avaliacao/atribuidas", (_req, res) => res.sendStatus(204));
  router.head("/submissao/atribuidas", (_req, res) => res.sendStatus(204));
  router.head("/submissao/para-mim", (_req, res) => res.sendStatus(204));
  router.head("/admin/submissao/para-mim", (_req, res) => res.sendStatus(204));
}

/* =========================================================
   ✅ BRIDGE GLOBAL — Admin Submissão/Chamada (frontend legado)
   Front chama: /api/admin/submissao, /api/admin/chamada...
========================================================= */
router.use(
  "/admin/submissao",
  requireAuth,
  forwardToRouter(chamadaRoute, "/admin/submissao")
);

router.use(
  "/admin/submissoes",
  requireAuth,
  forwardToRouter(chamadaRoute, "/admin/submissoes")
);

router.use(
  "/admin/chamada",
  requireAuth,
  forwardToRouter(chamadaRoute, "/admin/chamada")
);

router.use(
  "/admin/chamadas",
  requireAuth,
  forwardToRouter(chamadaRoute, "/admin/chamadas")
);

/* =========================================================
   ✅ BRIDGE GLOBAL — Admin Avaliação (frontend legado)
   Front chama: /api/admin/avaliacao/eventos
========================================================= */
router.use(
  "/admin/avaliacao",
  requireAuth,
  forwardTry(avaliacaoRoute, (suffix) => {
    const s = String(suffix || "/");
    const sSing = singularizeAdminSuffix(s);

    return [
      `/admin${sSing}`,
      `/admin${s}`,
      `/admin/avaliacao${sSing}`,
      `/admin/avaliacao${s}`,
      `/admin/avaliacoes${sSing}`,
      `/admin/avaliacoes${s}`,
      `${sSing}`,
      `${s}`,
    ];
  })
);

router.use(
  "/admin/avaliacoes",
  requireAuth,
  forwardTry(avaliacaoRoute, (suffix) => {
    const s = String(suffix || "/");
    const sSing = singularizeAdminSuffix(s);

    return [
      `/admin${sSing}`,
      `/admin${s}`,
      `/admin/avaliacao${sSing}`,
      `/admin/avaliacao${s}`,
      `/admin/avaliacoes${sSing}`,
      `/admin/avaliacoes${s}`,
      `${sSing}`,
      `${s}`,
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
// rota principal moderna
router.use("/dashboard", dashboardRoute);

// alias do dashboard do usuário
router.use("/dashboard-usuario", dashboardRoute);

// ✅ bridge dedicado do analítico
router.use(
  "/dashboard-analitico",
  requireAuth,
  forwardTry(dashboardRoute, (suffix) => {
    const s = String(suffix || "");
    return [
      `/admin${s}`,
      `/analitico${s}`,
      `${s || "/"}`,
    ];
  })
);

/* =========================
   Certificado
========================= */
router.use("/certificado", certificadoRoute);
router.use("/certificados", certificadoRoute);
router.use("/certificados-admin", certificadoRoute);
router.use("/certificados-avulsos", certificadoRoute);

/* =========================
   Informações institucionais
========================= */
router.use("/informacao", informacoesRoute);
router.use("/informacoes", informacoesRoute);
router.use("/informacao-institucional", informacoesRoute);
router.use("/informacoes-institucionais", informacoesRoute);

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
   ✅ CHAMADAS — mounts “bonitos” (público)
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
  // fallback mínimo
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
router.use((_req, res) =>
  res.status(404).json({ erro: "Rota não encontrada." })
);

module.exports = router;