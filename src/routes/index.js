// ✅ src/routes/index.js
const express = require("express");
const router = express.Router();

/* =========================
   Imports (conforme /src/routes)
========================= */

// Core / Públicos
const lookupsPublicRoutes = require("./lookupsPublicRoutes");

// Auth / Perfil / Login
const loginRoute = require("./loginRoute");
const perfilRoutes = require("./perfilRoutes");

// Upload
const uploadRoutes = require("./uploadRoutes");

// Eventos / Turmas / Inscrições / Agenda
const eventosRoute = require("./eventosRoute");
const turmasRoute = require("./turmasRoute");
const inscricoesRoute = require("./inscricoesRoute");
const agendaRoute = require("./agendaRoute");

// Presenças / Relatórios
const presencasRoute = require("./presencasRoute");
const relatorioPresencasRoute = require("./relatorioPresencasRoute");
const relatoriosRoutes = require("./relatoriosRoutes");

// Usuários / Instrutor / Unidades
const usuariosRoute = require("./usuariosRoute");
const instrutorRoutes = require("./instrutorRoutes");
const unidadesRoutes = require("./unidadesRoutes");
const usuariosEstatisticasRoute = require("./usuariosEstatisticasRoute");

// Avaliações / Dashboard usuário
const avaliacoesRoute = require("./avaliacoesRoute");
const dashboardUsuarioRoute = require("./dashboardUsuarioRoute");

// Admin: avaliações / turmas / dashboard analítico
const adminAvaliacoesRoutes = require("./adminAvaliacoesRoutes");
const administradorTurmasRoute = require("./administradorTurmasRoute");
const turmasRouteAdministrador = require("./turmasRouteAdministrador"); // (compat, se existir rota antiga)
const dashboardAnaliticoRoutes = require("./dashboardAnaliticoRoutes");

// Certificados
const certificadosRoute = require("./certificadosRoute");
const certificadosAdminRoutes = require("./certificadosAdminRoutes");
const certificadosAvulsosRoutes = require("./certificadosAvulsosRoutes");

// Assinatura / Calendário
const assinaturaRoutes = require("./assinaturaRoutes");
const calendarioRoutes = require("./calendarioRoutes");

// Datas (turma)
const datasEventoRoute = require("./datasEventoRoute");

// Chamadas / Trabalhos / Submissões (admin)
const chamadasRoutes = require("./chamadasRoutes");
const chamadasModeloRoutes = require("./chamadasModeloRoutes");
const trabalhosRoutes = require("./trabalhosRoutes");
const submissoesAdminRoutes = require("./submissoesAdminRoutes");

// Outros módulos (do seu diretório)
const salasRoutes = require("./salasRoutes");
const solicitacoesCursoRoute = require("./solicitacoesCursoRoute");
const questionariosRoute = require("./questionariosRoute");
const metricasRoutes = require("./metricasRoutes");
const notificacoesRoute = require("./notificacoesRoute");
const votacoesRoute = require("./votacoesRoute");

/* =========================
   Healthcheck (útil em deploy)
========================= */
router.get("/health", (_req, res) => res.json({ ok: true }));

/* =========================
   Público / Lookups
========================= */
router.use("/public", lookupsPublicRoutes);

/* =========================
   Auth / Perfil / Login
========================= */
router.use("/login", loginRoute);
router.use("/perfil", perfilRoutes);

/* =========================
   Upload
========================= */
router.use("/upload", uploadRoutes);

/* =========================
   Eventos / Turmas / Inscrições / Agenda
========================= */
router.use("/eventos", eventosRoute);
router.use("/turmas", turmasRoute);
router.use("/inscricoes", inscricoesRoute);
router.use("/agenda", agendaRoute);

/* =========================
   Presenças / Relatórios
========================= */
router.use("/presencas", presencasRoute);
router.use("/relatorio-presencas", relatorioPresencasRoute);
router.use("/relatorios", relatoriosRoutes);

/* =========================
   Usuários / Instrutores / Unidades / Estatísticas
========================= */
router.use("/usuarios", usuariosRoute);
router.use("/instrutor", instrutorRoutes);
router.use("/unidades", unidadesRoutes);
router.use("/usuarios-estatisticas", usuariosEstatisticasRoute);

/* =========================
   Avaliações / Dashboard usuário
========================= */
router.use("/avaliacoes", avaliacoesRoute);
router.use("/dashboard-usuario", dashboardUsuarioRoute);

/* =========================
   Admin / Analytics
========================= */
router.use("/admin/avaliacoes", adminAvaliacoesRoutes);
router.use("/dashboard-analitico", dashboardAnaliticoRoutes);

/**
 * ✅ Turmas (admin)
 * Mantém dois mounts por compatibilidade:
 * - /administrador/turmas  (padrão legado)
 * - /admin/turmas          (padrão novo “mais REST”)
 */
router.use("/administrador/turmas", administradorTurmasRoute);
router.use("/admin/turmas", administradorTurmasRoute);

// Alias (se você ainda usa este arquivo antigo em algum lugar)
router.use("/administrador/turmas-legacy", turmasRouteAdministrador);

/* =========================
   Certificados
========================= */
router.use("/certificados", certificadosRoute);
router.use("/certificados-admin", certificadosAdminRoutes);
router.use("/certificados-avulsos", certificadosAvulsosRoutes);

/* =========================
   Assinatura / Calendário / Datas
========================= */
router.use("/assinatura", assinaturaRoutes);
router.use("/calendario", calendarioRoutes);

// seu controller espera /api/datas/turma/:id → então o mount deve ser /datas
router.use("/datas", datasEventoRoute);

/* =========================
   Chamadas / Trabalhos / Submissões
========================= */
// chamadas públicas + admin (conforme seu arquivo)
router.use("/", chamadasRoutes); // ele já tem /chamadas/... e /admin/chamadas/... dentro

// modelos (banner/oral) públicos e admin (conforme chamadasModeloRoutes)
router.use("/", chamadasModeloRoutes);

router.use("/trabalhos", trabalhosRoutes);
router.use("/admin/submissoes", submissoesAdminRoutes);

/* =========================
   Outros módulos
========================= */
router.use("/salas", salasRoutes);
router.use("/solicitacoes-curso", solicitacoesCursoRoute);
router.use("/questionarios", questionariosRoute);
router.use("/metricas", metricasRoutes);
router.use("/notificacoes", notificacoesRoute);
router.use("/votacoes", votacoesRoute);

/* =========================
   Fallback 404 (API)
========================= */
router.use((_req, res) => {
  return res.status(404).json({ erro: "Rota não encontrada." });
});

module.exports = router;
