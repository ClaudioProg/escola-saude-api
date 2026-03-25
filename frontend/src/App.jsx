// ✅ src/App.jsx (premium, robusto, a11y, auth-friendly)
// - basename dinâmico (suporte a subpasta)
// - announcer de rota (a11y)
// - destrava scroll ao trocar de rota (fix modal)
// - scroll-to-top por navegação
// - redirecionos legados (.html e QR antigo)
// - wrappers para rotas com :id
// - PrivateShell aplica AppShell + PrivateRoute
// - Suspense fallback acessível
// - aliases coerentes para HomeEscola (painel oficial)
// - evita montar conteúdo privado sem sessão válida

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
import { RefreshCw, Smartphone, ShieldCheck } from "lucide-react";

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

const Teste = lazy(() => import("./pages/Teste"));
const AgendaSalasUsuario = lazy(() => import("./pages/AgendaSalasUsuario"));
const SolicitacaoCurso = lazy(() => import("./pages/SolicitacaoCurso"));
const RepositorioTrabalhos = lazy(() => import("./pages/RepositorioTrabalhos"));
const UsuarioSubmissao = lazy(() => import("./pages/UsuarioSubmissao"));
const AvaliadorSubmissao = lazy(() => import("./pages/AvaliadorSubmissao"));

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
const Notificacao = lazy(() => import("./pages/Notificacao"));
const AgendaAdministrador = lazy(() => import("./pages/AgendaAdministrador"));
const GestaoPresencas = lazy(() => import("./pages/GestaoPresenca"));
const GestaoInformacoes = lazy(() => import("./pages/GestaoInformacoes"));
const CancelarInscricaoAdmin = lazy(() => import("./pages/CancelarInscricaoAdmin"));
const AdminAvaliacao = lazy(() => import("./pages/AdminAvaliacao"));
const VotacaoUsuario = lazy(() => import("./pages/VotacaoUsuario"));
const AgendaSalasAdmin = lazy(() => import("./pages/AgendaSalasAdmin"));
const AdminChamadaForm = lazy(() => import("./pages/AdminChamadaForm"));
const CalendarioBloqueiosAdmin = lazy(() => import("./pages/CalendarioBloqueiosAdmin"));

// ✅ Confirmação via QR
const ConfirmarPresenca = lazy(() => import("./pages/ConfirmarPresenca"));

// 🆕 Manual do Usuário
const ManualUsuario = lazy(() => import("./pages/usuario/Manual"));

// 🆕 Páginas públicas
const Privacidade = lazy(() => import("./pages/Privacidade"));

// ✅ Painel oficial pós-login
const HomeEscola = lazy(() => import("./pages/HomeEscola"));

// 🆕 Admin – Votações
const AdminVotacao = lazy(() => import("./pages/AdminVotacao"));

// ⚠️ AdminSubmissao
const AdminSubmissao = lazy(() => import("./pages/AdminSubmissao"));

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

/* Mantém /validar */
function ValidarWrapper() {
  return <ValidarCertificado />;
}

/* Alias para URLs antigas .html */
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

/* Wrapper legado para QR antigo com ?codigo= */
function ValidarPresencaRouter() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const codigoRaw = sp.get("codigo") || sp.get("c") || "";
    let raw = codigoRaw;

    try {
      raw = decodeURIComponent(codigoRaw);
    } catch {
      // noop
    }

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
        if (m?.[1]) turmaId = m[1];
      }

      if (!turmaId) {
        const decPath = decodeURIComponent(u.pathname || "");
        const m2 = decPath.match(/\/presenca\/(\d+)/);
        if (m2?.[1]) turmaId = m2[1];
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
      turmaId =
        qsp.get("turma") ||
        qsp.get("turma_id") ||
        qsp.get("id") ||
        turmaId;

      if (!turmaId) {
        const pathOnly = dec.split("?")[0] || "";
        const parts = pathOnly.split("/").filter(Boolean);
        const idx = parts.indexOf("presenca");
        if (idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }

      if (!turmaId) {
        const m = dec.match(/\/presenca\/(\d+)/);
        if (m?.[1]) turmaId = m[1];
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

/* Aviso global de atualização do PWA */
function PwaUpdatePrompt() {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => setOpen(true);
    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, []);

  const handleUpdate = async () => {
    try {
      setUpdating(true);

      if (typeof window.__APP_UPDATE_SW__ === "function") {
        await window.__APP_UPDATE_SW__(true);
      }

      window.location.reload();
    } catch (error) {
      console.error("[PWA] Erro ao atualizar app:", error);
      window.location.reload();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[9999] px-4">
      <div className="mx-auto max-w-md rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-white dark:bg-zinc-950 shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl p-2 bg-cyan-100 dark:bg-cyan-900/30">
            <Smartphone className="w-5 h-5 text-cyan-700 dark:text-cyan-200" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
              Nova versão disponível
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Atualize o aplicativo para usar a versão mais recente e evitar falhas de funcionamento.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={updating}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-4 py-2 text-sm font-extrabold disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${updating ? "animate-spin" : ""}`} />
                {updating ? "Atualizando..." : "Atualizar agora"}
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={updating}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 disabled:opacity-60"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Wrappers para rotas com :id */
function AdminChamadaFormWrapper() {
  const { id } = useParams();
  return <AdminChamadaForm chamadaId={id} />;
}

function AdminSubmissaoRouteWrapper() {
  const { chamadaId } = useParams();
  return <AdminSubmissao chamadaId={chamadaId ? Number(chamadaId) : undefined} />;
}

/* ✅ Splash elegante durante checagem auth */
function AuthCheckingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/30 px-6">
      <div className="w-full max-w-md rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-white/90 dark:bg-zinc-900/85 shadow-xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
            <ShieldCheck className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-zinc-900 dark:text-white">
              Verificando sua sessão
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Aguarde um instante enquanto validamos seu acesso.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-zinc-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-600" />
          </div>
          <div className="grid gap-2 pt-2">
            <div className="h-3 w-4/5 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-3/5 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ✅ Layout privado */
function PrivateShell() {
  return (
    <PrivateRoute fallback={<AuthCheckingScreen />}>
      <EscolaAppShell>
        <Outlet />
      </EscolaAppShell>
    </PrivateRoute>
  );
}

/* App */
export default function App() {
  const BASENAME = (
    import.meta.env.VITE_APP_BASENAME ||
    import.meta.env.BASE_URL ||
    "/"
  ).replace(/\/+$/, "") || "/";

  return (
    <BrowserRouter basename={BASENAME}>
      <div className="min-h-screen">
        <RouteChangeAnnouncer />
        <ScrollUnlockOnRouteChange />
        <ScrollToTop />
        <PwaUpdatePrompt />

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

            {/* 🔐 protegidas */}
            <Route element={<PrivateShell />}>
              <Route index element={<HomeEscola />} />

              <Route path="scanner" element={<Scanner />} />

              {/* ✅ Painel do Usuário */}
              <Route path="usuario/dashboard" element={<HomeEscola />} />
              <Route path="dashboard-usuario" element={<HomeEscola />} />
              <Route path="home-escola" element={<HomeEscola />} />
              <Route path="painel" element={<HomeEscola />} />

              {/* compat legado */}
              <Route path="dashboard" element={<Navigate to="/usuario/dashboard" replace />} />
              <Route path="usuario" element={<Navigate to="/usuario/dashboard" replace />} />

              {/* Usuário */}
              <Route path="eventos" element={<Eventos />} />
              <Route path="minhas-presencas" element={<MinhasPresencas />} />
              <Route path="certificados" element={<MeusCertificados />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="ajuda" element={<Ajuda />} />
              <Route path="notificacao" element={<Notificacao />} />
              <Route path="teste" element={<Teste />} />
              <Route path="solicitar-curso" element={<SolicitacaoCurso />} />
              <Route path="repositorio-trabalhos" element={<RepositorioTrabalhos />} />
              <Route path="usuario/manual" element={<ManualUsuario />} />
              <Route path="manual" element={<ManualUsuario />} />
              <Route path="submissao" element={<UsuarioSubmissao />} />

              {/* 🧑‍🏫 Instrutor / Avaliador */}
              <Route
                path="instrutor"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <DashboardInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-instrutor"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <AgendaInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="turmas/presencas/:turmaId"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <PresencasPorTurma />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/presenca"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <InstrutorPresenca />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/certificados"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <CertificadosInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="instrutor/avaliacao"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <AvaliacaoInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="avaliador/submissao"
                element={
                  <PrivateRoute permitido={["instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <AvaliadorSubmissao />
                  </PrivateRoute>
                }
              />

              {/* Admin */}
              <Route
                path="administrador"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <DashboardAdministrador />
                  </PrivateRoute>
                }
              />
              <Route
                path="dashboard-analitico"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <DashboardAnalitico />
                  </PrivateRoute>
                }
              />
              <Route
                path="gerenciar-eventos"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <GerenciarEventos />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-instrutor"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <GestaoInstrutor />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-usuarios"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <GestaoUsuarios />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-certificados"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <GestaoCertificados />
                  </PrivateRoute>
                }
              />
              <Route
  path="gestao-informacoes"
  element={
    <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
      <GestaoInformacoes />
    </PrivateRoute>
  }
/>
              <Route
                path="lista-presencas-turma"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <ListaPresencasTurma />
                  </PrivateRoute>
                }
              />
              <Route
                path="relatorios-customizados"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <RelatoriosCustomizados />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-administrador"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AgendaAdministrador />
                  </PrivateRoute>
                }
              />
              <Route
                path="certificados-avulsos"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <CertificadosAvulsos />
                  </PrivateRoute>
                }
              />
              <Route
                path="gestao-presenca"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <GestaoPresencas />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/qr-codes"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <QRCodesEventosAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/cancelar-inscricao"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <CancelarInscricaoAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/avaliacao"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminAvaliacao />
                  </PrivateRoute>
                }
              />

              {/* Salas */}
              <Route
                path="admin/solicitacao-curso"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <SolicitacaoCursoAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/agenda-salas"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AgendaSalasAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="agenda-salas"
                element={
                  <PrivateRoute permitido={["usuario", "instrutor", "administrador"]} fallback={<AuthCheckingScreen />}>
                    <AgendaSalasUsuario />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/calendario-bloqueios"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <CalendarioBloqueiosAdmin />
                  </PrivateRoute>
                }
              />

              {/* Votações */}
              <Route
                path="admin/votacao"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminVotacao />
                  </PrivateRoute>
                }
              />
              <Route path="votacao/:votacaoId" element={<VotacaoUsuario />} />

              {/* Submissões Admin */}
              <Route
                path="admin/chamadas/new"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminChamadaForm />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/chamadas/:id"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminChamadaFormWrapper />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/submissao"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminSubmissaoRouteWrapper />
                  </PrivateRoute>
                }
              />
              <Route
                path="admin/chamadas/:chamadaId/submissao"
                element={
                  <PrivateRoute permitido={["administrador"]} fallback={<AuthCheckingScreen />}>
                    <AdminSubmissaoRouteWrapper />
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