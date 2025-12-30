// ✅ src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useSearchParams,
  useNavigate,
  Navigate,
  useParams,
  Outlet,
} from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";

import PrivateRoute from "./components/PrivateRoute";
import EscolaAppShell from "./layout/EscolaAppShell";

import CertificadosAvulsos from "./pages/CertificadosAvulsos";
import QRCodesEventosAdmin from "./pages/QRCodesEventosAdmin";

/* 🔄 Lazy loading das páginas */
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const ValidarCertificado = lazy(() => import("./pages/ValidarCertificado"));
const HistoricoEventos = lazy(() => import("./pages/HistoricoEventos"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const Scanner = lazy(() => import("./pages/Scanner"));

const Eventos = lazy(() => import("./pages/Eventos"));
const MinhasPresencas = lazy(() => import("./pages/MinhasPresencas"));
const MeusCertificados = lazy(() => import("./pages/MeusCertificados"));
const MinhasInscricoes = lazy(() => import("./pages/MinhasInscricoes"));

const Teste = lazy(() => import("./pages/Teste"));
const AgendaSalasUsuario = lazy(() => import("./pages/AgendaSalasUsuario"));
const SolicitacaoCurso = lazy(() => import("./pages/SolicitacaoCurso"));
const AgendaUsuario = lazy(() => import("./pages/AgendaUsuario"));
const RepositorioTrabalhos = lazy(() => import("./pages/RepositorioTrabalhos"));
const UsuarioSubmissoes = lazy(() => import("./pages/UsuarioSubmissoes"));
const AvaliadorSubmissoes = lazy(() => import("./pages/AvaliadorSubmissoes"));

const DashboardInstrutor = lazy(() => import("./pages/DashboardInstrutor"));
const AgendaInstrutor = lazy(() => import("./pages/AgendaInstrutor"));
const InstrutorPresenca = lazy(() => import("./pages/InstrutorPresenca"));
const CertificadosInstrutor = lazy(() => import("./pages/CertificadosInstrutor"));
const AvaliacaoInstrutor = lazy(() => import("./pages/AvaliacaoInstrutor"));

const DashboardAdministrador = lazy(() => import("./pages/DashboardAdministrador"));
const DashboardAnalitico = lazy(() => import("./pages/DashboardAnalitico"));
const GestaoInstrutor = lazy(() => import("./pages/GestaoInstrutor"));
const RelatoriosCustomizados = lazy(() => import("./pages/RelatoriosCustomizados"));
const SolicitacaoCursoAdmin = lazy(() => import("./pages/SolicitacaoCursoAdmin"));
const ListaPresencasTurma = lazy(() => import("./pages/ListaPresencasTurma"));
const GestaoCertificados = lazy(() => import("./pages/GestaoCertificados"));
const GestaoUsuarios = lazy(() => import("./pages/GestaoUsuarios"));
const GerenciarEventos = lazy(() => import("./pages/GerenciarEventos"));
const PresencasPorTurma = lazy(() => import("./pages/PresencasPorTurma"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const AgendaAdministrador = lazy(() => import("./pages/AgendaAdministrador"));
const Avaliacao = lazy(() => import("./pages/Avaliacao"));
const GestaoPresencas = lazy(() => import("./pages/GestaoPresenca"));
const CancelarInscricoesAdmin = lazy(() => import("./pages/CancelarInscricoesAdmin"));
const AdminAvaliacoes = lazy(() => import("./pages/AdminAvaliacoes"));
const VotacoesUsuario = lazy(() => import("./pages/VotacoesUsuario"));
const AgendaSalasAdmin = lazy(() => import("./pages/AgendaSalasAdmin"));
const AdminChamadaForm = lazy(() => import("./pages/AdminChamadaForm"));
const CalendarioBloqueiosAdmin = lazy(() => import("./pages/CalendarioBloqueiosAdmin"));

// ✅ Confirmação via QR
const ConfirmarPresenca = lazy(() => import("./pages/ConfirmarPresenca"));

// 🆕 Manual do Usuário
const ManualUsuario = lazy(() => import("./pages/usuario/Manual"));

// 🆕 Páginas públicas
const Privacidade = lazy(() => import("./pages/Privacidade"));

// ✅ Painel oficial pós-login (substitui “DashboardUsuario”)
const HomeEscola = lazy(() => import("./pages/HomeEscola"));

// 🆕 Admin – Votações
const AdminVotacoes = lazy(() => import("./pages/AdminVotacoes"));

// ⚠️ AdminSubmissoes (wrapper usa :chamadaId)
const AdminSubmissoes = lazy(() => import("./pages/AdminSubmissoes"));

/* A11y: Announcer de mudanças de rota */
function RouteChangeAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState("Carregado");
  useEffect(() => {
    const path = location.pathname.replace(/^\/+/, "") || "início";
    setMessage(`Página carregada: ${path}`);
  }, [location]);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/* Hotfix global: destrava scroll preso ao trocar de rota */
function ScrollUnlockOnRouteChange() {
  const location = useLocation();
  useEffect(() => {
    const unlock = () => {
      const html = document.documentElement;
      const body = document.body;

      [html, body].forEach((el) => {
        if (!el) return;
        el.style.overflow = "";
        el.style.touchAction = "";
        el.classList.remove("overflow-hidden", "modal-open", "no-scroll");
      });

      if (body && body.style.position === "fixed") {
        const top = parseInt(body.style.top || "0", 10) || 0;
        body.style.position = "";
        body.style.top = "";
        try {
          window.scrollTo({ top: -top, behavior: "instant" });
        } catch {
          window.scrollTo(0, -top);
        }
      }
    };

    unlock();
    const t = setTimeout(unlock, 0);
    return () => clearTimeout(t);
  }, [location.key]);
  return null;
}

/* UX: Scroll para o topo em cada navegação */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

// Mantém /validar
function ValidarWrapper() {
  return <ValidarCertificado />;
}

/** Alias para URLs antigas .html */
function HtmlAliasRedirect() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const semHtml = loc.pathname.replace(/\.html$/, "");
    nav(`${semHtml}${loc.search}`, { replace: true });
  }, [loc.pathname, loc.search, nav]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-600 dark:text-gray-300">
      Redirecionando…
    </div>
  );
}

/** Wrapper legado para QR antigo com ?codigo= */
function ValidarPresencaRouter() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const codigoRaw = sp.get("codigo") || sp.get("c") || "";
    let raw = codigoRaw;
    try {
      raw = decodeURIComponent(codigoRaw);
    } catch {}

    let turmaId = null;
    let token = null;

    try {
      const u = new URL(raw);
      turmaId =
        u.searchParams.get("turma") ||
        u.searchParams.get("turma_id") ||
        u.searchParams.get("id");
      token = u.searchParams.get("t") || u.searchParams.get("token");

      if (!turmaId) {
        const parts = (u.pathname || "").split("/").filter(Boolean);
        const idx = parts.indexOf("presenca");
        if (idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }
      if (!turmaId) {
        const m = (u.pathname || "").match(/\/presenca\/(\d+)/);
        if (m && m[1]) turmaId = m[1];
      }
      if (!turmaId) {
        const decPath = decodeURIComponent(u.pathname || "");
        const m2 = decPath.match(/\/presenca\/(\d+)/);
        if (m2 && m2[1]) turmaId = m2[1];
      }
    } catch {
      const dec = (() => {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      })();
      const qs = dec.includes("?") ? dec.split("?")[1] : "";
      const qsp = new URLSearchParams(qs);
      token = qsp.get("t") || qsp.get("token") || token;
      turmaId = qsp.get("turma") || qsp.get("turma_id") || qsp.get("id") || turmaId;

      if (!turmaId) {
        const pathOnly = dec.split("?")[0] || "";
        const parts = pathOnly.split("/").filter(Boolean);
        const idx = parts.indexOf("presenca");
        if (idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }
      if (!turmaId) {
        const m = dec.match(/\/presenca\/(\d+)/);
        if (m && m[1]) turmaId = m[1];
      }
    }

    const search = new URLSearchParams();
    if (turmaId) search.set("turma", String(turmaId));
    if (token) search.set("t", token);

    const dest = `/presenca${search.toString() ? `?${search.toString()}` : ""}`;
    navigate(dest, { replace: true });
  }, [sp, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="text-sm text-gray-600 dark:text-gray-200">Redirecionando…</div>
    </div>
  );
}

function NotFound() {
  return <Navigate to="/login" replace />;
}

/* Wrappers para rotas com :id (submissões) */
function AdminChamadaFormWrapper() {
  const { id } = useParams();
  return <AdminChamadaForm chamadaId={id} />;
}
function AdminSubmissoesRouteWrapper() {
  const { chamadaId } = useParams();
  return <AdminSubmissoes chamadaId={chamadaId ? Number(chamadaId) : undefined} />;
}

/* ✅ Layout privado: autentica e envolve com EscolaAppShell */
function PrivateShell() {
  return (
    <PrivateRoute>
      <EscolaAppShell>
        <Outlet />
      </EscolaAppShell>
    </PrivateRoute>
  );
}

/* App */
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <RouteChangeAnnouncer />
        <ScrollUnlockOnRouteChange />
        <ScrollToTop />

        <Suspense
          fallback={
            <div className="min-h-[60vh] p-6 flex items-center justify-center">
              <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/55 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-600" />
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-sm font-semibold text-slate-700 dark:text-zinc-200"
                  >
                    Carregando…
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-3/5 rounded bg-slate-200/70 dark:bg-white/10 animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-slate-200/70 dark:bg-white/10 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-slate-200/70 dark:bg-white/10 animate-pulse" />
                </div>
              </div>
            </div>
          }
        >
          <Routes>
            {/* 🌐 públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />

            <Route path="/ajuda/cadastro.html" element={<HtmlAliasRedirect />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/privacidade.html" element={<HtmlAliasRedirect />} />

            {/* Certificados */}
            <Route path="/validar-certificado" element={<ValidarCertificado />} />
            <Route path="/validar-certificado.html" element={<HtmlAliasRedirect />} />

            {/* Presença (legado) */}
            <Route path="/validar" element={<ValidarWrapper />} />
            <Route path="/validar-presenca" element={<ValidarPresencaRouter />} />

            {/* QR presença (novo) */}
            <Route path="/presenca" element={<ConfirmarPresenca />} />
            <Route path="/presenca/:turmaId" element={<ConfirmarPresenca />} />

            {/* Outras públicas */}
            <Route path="/historico" element={<HistoricoEventos />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
            <Route path="/scanner" element={<Scanner />} />

            {/* 🔐 protegidas (tudo aqui dentro ganha Topbar+Sidebar) */}
            <Route element={<PrivateShell />}>
              {/* ✅ Home pós-login (painel oficial) */}
              <Route index element={<HomeEscola />} />

              {/* ✅ Painel do Usuário — rota oficial + aliases */}
              <Route path="usuario/dashboard" element={<HomeEscola />} />
              <Route path="dashboard-usuario" element={<HomeEscola />} />
              <Route path="home-escola" element={<HomeEscola />} />
              <Route path="painel" element={<HomeEscola />} />

              {/* mantém compatibilidade antiga */}
              <Route path="dashboard" element={<Navigate to="/usuario/dashboard" replace />} />
              <Route path="usuario" element={<Navigate to="/usuario/dashboard" replace />} />

              {/* Usuário */}
              <Route path="eventos" element={<Eventos />} />
              <Route path="minhas-presencas" element={<MinhasPresencas />} />
              <Route path="certificados" element={<MeusCertificados />} />
              <Route path="minhas-inscricoes" element={<MinhasInscricoes />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="ajuda" element={<Ajuda />} />
              <Route path="notificacoes" element={<Notificacoes />} />
              <Route path="avaliacao" element={<Avaliacao />} />
              <Route path="avaliar/:turmaId" element={<Avaliacao />} />
              <Route path="teste" element={<Teste />} />
              <Route path="solicitar-curso" element={<SolicitacaoCurso />} />
              <Route path="agenda" element={<AgendaUsuario />} />
              <Route path="repositorio-trabalhos" element={<RepositorioTrabalhos />} />

              {/* Manual do Usuário */}
              <Route path="usuario/manual" element={<ManualUsuario />} />
              <Route path="manual" element={<ManualUsuario />} />

              {/* Submissões */}
              <Route path="submissoes" element={<UsuarioSubmissoes />} />

              {/* 🧑‍🏫 Instrutor / Avaliador */}
              <Route
                path="instrutor"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <DashboardInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-instrutor"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <AgendaInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="turmas/presencas/:turmaId"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <PresencasPorTurma />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/presenca"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <InstrutorPresenca />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/certificados"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <CertificadosInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/avaliacao"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <AvaliacaoInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="avaliador/submissoes"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]}>
                    <AvaliadorSubmissoes />
                  </PrivateRoute>
                }
              />

              {/* Admin */}
              <Route
                path="administrador"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <DashboardAdministrador />
                  </PrivateRoute>
                }
              />
              <Route
                path="dashboard-analitico"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <DashboardAnalitico />
                  </PrivateRoute>
                }
              />
              <Route
                path="gerenciar-eventos"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <GerenciarEventos />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-instrutor"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <GestaoInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-usuarios"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <GestaoUsuarios />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-certificados"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <GestaoCertificados />
                  </PrivateRoute>
                }
              />
              <Route
                path="lista-presencas-turma"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <ListaPresencasTurma />
                  </PrivateRoute>
                }
              />
              <Route
                path="relatorios-customizados"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <RelatoriosCustomizados />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-administrador"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AgendaAdministrador />
                  </PrivateRoute>
                }
              />
              <Route
                path="certificados-avulsos"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <CertificadosAvulsos />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-presenca"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <GestaoPresencas />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/qr-codes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <QRCodesEventosAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/cancelar-inscricoes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <CancelarInscricoesAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/avaliacoes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminAvaliacoes />
                  </PrivateRoute>
                }
              />

              {/* Salas */}
              <Route
                path="admin/solicitacoes-curso"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <SolicitacaoCursoAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/agenda-salas"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AgendaSalasAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-salas"
                element={
                  <PrivateRoute permitido={["usuario", "instrutor", "administrador"]}>
                    <AgendaSalasUsuario />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/calendario-bloqueios"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <CalendarioBloqueiosAdmin />
                  </PrivateRoute>
                }
              />

              {/* Votações */}
              <Route
                path="admin/votacoes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminVotacoes />
                  </PrivateRoute>
                }
              />
              <Route path="votacoes/:votacaoId" element={<VotacoesUsuario />} />

              {/* Submissões Admin */}
              <Route
                path="admin/chamadas/new"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminChamadaForm />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/chamadas/:id"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminChamadaFormWrapper />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/submissoes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminSubmissoesRouteWrapper />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/chamadas/:chamadaId/submissoes"
                element={
                  <PrivateRoute permitido={["administrador"]}>
                    <AdminSubmissoesRouteWrapper />
                  </PrivateRoute>
                }
              />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
