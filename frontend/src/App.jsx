// ✅ frontend/src/App.jsx — v2.3
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Rotas oficiais da aplicação.
//
// Revisão premium:
// - rotas públicas e privadas organizadas;
// - sem aliases legados;
// - sem rotas duplicadas;
// - sem prefixo admin como contrato genérico;
// - rotas em português, preferencialmente no singular;
// - lazy loading;
// - shell privado oficial;
// - proteção por perfil;
// - fallback acessível;
// - 404 premium;
// - anti-scroll-lock em troca de rota;
// - sem PWA prompt manual;
// - redefinição de senha sem token na URL.
//
// Alterações aplicadas:
// - incluído domínio oficial "Calendário Anual de EPS";
// - incluído domínio oficial "Cursos Online";
// - incluído domínio oficial "Pesquisas";
// - incluído domínio oficial "Interações";
// - incluído domínio oficial "Auditoria";
// - incluído domínio oficial "Caixa de Mensagens Institucional";
// - incluído domínio oficial "Painel de Pendências Administrativas";
// - incluído domínio oficial "Saúde da Plataforma";

// - incluído domínio oficial "Modo Apresentação de Interações";
// - rota usuário: /interacao;
// - rota usuário: /mensagem;
// - rotas administrador:
//   - /administrador/interacao/votacao;
//   - /administrador/interacao/quiz;
//   - /administrador/interacao/nuvem-palavras;
//   - /administrador/interacao/apresentacao/:id;
//   - /administrador/auditoria;
//   - /administrador/mensagem;
//   - /administrador/pendencia;
//   - /administrador/saude-plataforma;
// - removido contrato legado de votação:
//   - /votacao/:votacaoId;
//   - /gestao/votacao.
//
// Observação:
// - CursoTeste.jsx não foi montado como rota oficial por ser página de teste.
// - Páginas legadas AdminVotacao.jsx e VotacaoUsuario.jsx não devem ser usadas
//   no novo contrato de Interações.

import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useParams,
  Outlet,
  Link,
} from "react-router-dom";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  KeyRound,
  LogIn,
  ShieldCheck,
} from "lucide-react";

import PrivateRoute from "./components/layout/PrivateRoute";
import EscolaAppShell from "./components/layout/EscolaAppShell";
import AtualizacaoPlataformaBanner from "./components/ui/AtualizacaoPlataformaBanner";
import { forceUnlockScroll } from "./utils/scroll";

/* ─────────────────────────────────────────────────────────────
   Lazy loading — páginas públicas
────────────────────────────────────────────────────────────── */

const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));

const ValidarCertificado = lazy(() => import("./pages/ValidarCertificado"));
const ConfirmarPresenca = lazy(() => import("./pages/ConfirmarPresenca"));
const HistoricoEventos = lazy(() => import("./pages/HistoricoEventos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));

/* ─────────────────────────────────────────────────────────────
   Lazy loading — usuário
────────────────────────────────────────────────────────────── */

const DashboardUsuario = lazy(() => import("./pages/DashboardUsuario"));
const Eventos = lazy(() => import("./pages/Eventos"));
const MinhasPresencas = lazy(() => import("./pages/MinhasPresencas"));
const CertificadoUsuario = lazy(() => import("./pages/CertificadoUsuario"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const Notificacao = lazy(() => import("./pages/Notificacao"));

const AgendaSalasUsuario = lazy(() => import("./pages/AgendaSalasUsuario"));
const CalendarioAnualEPS = lazy(() => import("./pages/CalendarioAnualEPS"));
const CursosOnline = lazy(() => import("./pages/CursosOnline"));
const Pesquisas = lazy(() => import("./pages/Pesquisas"));
const Interacoes = lazy(() => import("./pages/Interacoes"));
const MensagemUsuario = lazy(() => import("./pages/MensagemUsuario"));

const RepositorioTrabalhos = lazy(() => import("./pages/RepositorioTrabalhos"));
const UsuarioSubmissao = lazy(() => import("./pages/UsuarioSubmissao"));
const ManualUsuario = lazy(() => import("./pages/Manual"));
const Scanner = lazy(() => import("./pages/Scanner"));

/* ─────────────────────────────────────────────────────────────
   Lazy loading — organizador / avaliador
────────────────────────────────────────────────────────────── */

const DashboardOrganizador = lazy(() => import("./pages/DashboardOrganizador"));
const AgendaOrganizador = lazy(() => import("./pages/AgendaOrganizador"));
const OrganizadorPresenca = lazy(() => import("./pages/OrganizadorPresenca"));
const CertificadosOrganizador = lazy(() =>
  import("./pages/CertificadosOrganizador")
);
const AvaliacaoOrganizador = lazy(() => import("./pages/AvaliacaoOrganizador"));
const AvaliadorSubmissao = lazy(() => import("./pages/AvaliadorSubmissao"));
const PresencasPorTurma = lazy(() => import("./pages/PresencasPorTurma"));

/* ─────────────────────────────────────────────────────────────
   Lazy loading — administrador
────────────────────────────────────────────────────────────── */

const DashboardAdministrador = lazy(() =>
  import("./pages/DashboardAdministrador")
);
const DashboardAnalitico = lazy(() => import("./pages/DashboardAnalitico"));

const AgendaAdministrador = lazy(() => import("./pages/AgendaAdministrador"));
const AgendaSalasAdmin = lazy(() => import("./pages/AgendaSalasAdmin"));
const CalendarioAnualEPSAdmin = lazy(() =>
  import("./pages/CalendarioAnualEPSAdmin")
);
const CalendarioBloqueiosAdmin = lazy(() =>
  import("./pages/CalendarioBloqueiosAdmin")
);

const CursosOnlineAdmin = lazy(() => import("./pages/CursosOnlineAdmin"));
const PesquisasAdmin = lazy(() => import("./pages/PesquisasAdmin"));

const InteracoesVotacaoAdmin = lazy(() =>
  import("./pages/InteracoesVotacaoAdmin")
);
const InteracoesQuizAdmin = lazy(() => import("./pages/InteracoesQuizAdmin"));
const InteracoesNuvemPalavrasAdmin = lazy(() =>
  import("./pages/InteracoesNuvemPalavrasAdmin")
);
const InteracoesApresentacao = lazy(() =>
  import("./pages/InteracoesApresentacao")
);

const AuditoriaAdmin = lazy(() => import("./pages/AuditoriaAdmin"));
const MensagemAdmin = lazy(() => import("./pages/MensagemAdmin"));
const PendenciasAdmin = lazy(() => import("./pages/PendenciasAdmin"));
const SaudePlataformaAdmin = lazy(() =>
  import("./pages/SaudePlataformaAdmin")
);

const GerenciarEventos = lazy(() => import("./pages/GerenciarEventos"));
const GestaoInformacoes = lazy(() => import("./pages/GestaoInformacoes"));
const GestaoUsuarios = lazy(() => import("./pages/GestaoUsuarios"));
const GestaoOrganizador = lazy(() => import("./pages/GestaoOrganizador"));
const GestaoCertificados = lazy(() => import("./pages/GestaoCertificados"));
const GestaoPresencas = lazy(() => import("./pages/GestaoPresenca"));

const ListaPresencasTurma = lazy(() => import("./pages/ListaPresencasTurma"));
const RelatoriosCustomizados = lazy(() =>
  import("./pages/RelatoriosCustomizados")
);

const AdminAvaliacao = lazy(() => import("./pages/AdminAvaliacao"));
const AdminChamadaForm = lazy(() => import("./pages/AdminChamadaForm"));
const AdminSubmissao = lazy(() => import("./pages/AdminSubmissao"));

const CancelarInscricaoAdmin = lazy(() =>
  import("./pages/CancelarInscricaoAdmin")
);
const CertificadosAvulsos = lazy(() => import("./pages/CertificadosAvulsos"));
const QRCodesEventosAdmin = lazy(() => import("./pages/QRCodesEventosAdmin"));

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

const IS_DEV =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

const PERFIL = {
  usuario: "usuario",
  organizador: "organizador",
  administrador: "administrador",
};

const PERFIL_PERMITIDO = {
  usuario: [PERFIL.usuario, PERFIL.organizador, PERFIL.administrador],
  organizador: [PERFIL.organizador, PERFIL.administrador],
  administrador: [PERFIL.administrador],
};

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function debugLog(scope, payload) {
  if (!IS_DEV) return;

  try {
    console.log(scope, payload);
  } catch {
    // noop
  }
}

function normalizeBasename(value) {
  const raw = String(value || "/").trim();

  if (!raw || raw === "/") {
    return "/";
  }

  const cleaned = raw
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/+$/, "")
    .replace(/^([^/])/, "/$1");

  return cleaned || "/";
}

/* ─────────────────────────────────────────────────────────────
   Comportamento global / acessibilidade
────────────────────────────────────────────────────────────── */

function RouteChangeAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState("Carregado");

  useEffect(() => {
    const rawPath = location.pathname.replace(/^\/+/, "") || "início";
    const safePath =
      rawPath.length > 120 ? `${rawPath.slice(0, 117)}...` : rawPath;

    setMessage(`Página carregada: ${safePath}`);
  }, [location.pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

function PublicRouteDiagnostics() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname || "/";

    const isAuthPublicRoute =
      path.startsWith("/login") ||
      path.startsWith("/cadastro") ||
      path.startsWith("/esqueci-senha") ||
      path.startsWith("/redefinir-senha");

    if (!isAuthPublicRoute) return;

    debugLog("[APP][PUBLIC_ROUTE]", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);

  return null;
}

function CriticalRouteDiagnostics() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname || "/";

    const isCriticalRoute =
      path.startsWith("/administrador") ||
      path.startsWith("/gestao") ||
      path.startsWith("/certificado-avulso") ||
      path.startsWith("/relatorio-customizado") ||
      path.startsWith("/chamada") ||
      path.startsWith("/submissao");

    if (!isCriticalRoute) return;

    debugLog("[APP][CRITICAL_ROUTE]", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);

  return null;
}

function ScrollUnlockOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    forceUnlockScroll();

    const timer = window.setTimeout(() => {
      forceUnlockScroll();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [location.key]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // noop
    }
  }, [pathname]);

  return null;
}

/* ─────────────────────────────────────────────────────────────
   Wrappers
────────────────────────────────────────────────────────────── */

function AdminChamadaFormWrapper() {
  const { id } = useParams();

  return <AdminChamadaForm chamadaId={id} />;
}

function AdminSubmissaoRouteWrapper() {
  const { chamadaId } = useParams();

  return (
    <AdminSubmissao chamadaId={chamadaId ? Number(chamadaId) : undefined} />
  );
}

function AuthCheckingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/30">
      <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-xl dark:border-emerald-900/40 dark:bg-zinc-900/85">
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
            <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivateShell() {
  return (
    <PrivateRoute fallback={<AuthCheckingScreen />}>
      <EscolaAppShell>
        <Outlet />
      </EscolaAppShell>
    </PrivateRoute>
  );
}

function RoleGate({ permitido, children }) {
  return (
    <PrivateRoute permitido={permitido} fallback={<AuthCheckingScreen />}>
      {children}
    </PrivateRoute>
  );
}

function ProtectedPage({ permitido, element }) {
  return <RoleGate permitido={permitido}>{element}</RoleGate>;
}

/* ─────────────────────────────────────────────────────────────
   Fallback Suspense
────────────────────────────────────────────────────────────── */

function SuspenseFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/55">
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
          <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200/70 dark:bg-white/10" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200/70 dark:bg-white/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   404
────────────────────────────────────────────────────────────── */

function NotFoundPage() {
  const location = useLocation();

  useEffect(() => {
    debugLog("[APP][NOT_FOUND]", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-6 py-10 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl dark:border-emerald-900/40 dark:bg-zinc-900/90 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-8 w-8 text-amber-700 dark:text-amber-300" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full border border-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:border-amber-800 dark:text-amber-300">
                Erro 404
              </span>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Página não encontrada
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
                O endereço acessado não corresponde a uma rota oficial da
                plataforma. Verifique o link ou retorne ao acesso principal.
              </p>

              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Endereço acessado
                </p>

                <p className="mt-1 break-all text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {location.pathname}
                  {location.search}
                  {location.hash}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-800"
                >
                  <LogIn className="h-4 w-4" />
                  Ir para login
                </Link>

                <Link
                  to="/esqueci-senha"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  <KeyRound className="h-4 w-4" />
                  Esqueci senha
                </Link>

                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
              </div>

              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  <Home className="h-4 w-4" />
                  Ir para o acesso principal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rotas públicas
────────────────────────────────────────────────────────────── */

function PublicRoutes() {
  return (
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/validar-certificado" element={<ValidarCertificado />} />

      <Route path="/presenca" element={<ConfirmarPresenca />} />
      <Route path="/presenca/:turmaId" element={<ConfirmarPresenca />} />

      <Route path="/historico" element={<HistoricoEventos />} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rotas privadas — usuário
────────────────────────────────────────────────────────────── */

function UsuarioRoutes() {
  return (
    <>
      <Route index element={<Navigate to="/painel" replace />} />

      <Route path="painel" element={<DashboardUsuario />} />
      <Route path="notificacao" element={<Notificacao />} />
      <Route path="evento" element={<Eventos />} />
      <Route path="minha-presenca" element={<MinhasPresencas />} />
      <Route path="certificado" element={<CertificadoUsuario />} />
      <Route path="reserva" element={<AgendaSalasUsuario />} />
      <Route path="calendario-eps" element={<CalendarioAnualEPS />} />
      <Route path="curso-online" element={<CursosOnline />} />
      <Route path="pesquisa" element={<Pesquisas />} />
      <Route path="interacao" element={<Interacoes />} />
      <Route path="mensagem" element={<MensagemUsuario />} />
      <Route path="submissao" element={<UsuarioSubmissao />} />
      <Route path="trabalho" element={<RepositorioTrabalhos />} />
      <Route path="manual" element={<ManualUsuario />} />
      <Route path="scanner" element={<Scanner />} />
      <Route path="perfil" element={<Perfil />} />
      <Route path="ajuda" element={<Ajuda />} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rotas privadas — organizador / avaliador
────────────────────────────────────────────────────────────── */

function OrganizadorRoutes() {
  return (
    <>
      <Route
        path="organizador"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<DashboardOrganizador />}
          />
        }
      />

      <Route
        path="organizador/agenda"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<AgendaOrganizador />}
          />
        }
      />

      <Route
        path="organizador/presenca"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<OrganizadorPresenca />}
          />
        }
      />

      <Route
        path="organizador/presenca/:turmaId"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<PresencasPorTurma />}
          />
        }
      />

      <Route
        path="organizador/certificado"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<CertificadosOrganizador />}
          />
        }
      />

      <Route
        path="organizador/avaliacao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<AvaliacaoOrganizador />}
          />
        }
      />

      <Route
        path="organizador/submissao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.organizador}
            element={<AvaliadorSubmissao />}
          />
        }
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rotas privadas — administrador
────────────────────────────────────────────────────────────── */

function AdministradorRoutes() {
  return (
    <>
      <Route
        path="administrador"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<DashboardAdministrador />}
          />
        }
      />

      <Route
        path="dashboard-analitico"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<DashboardAnalitico />}
          />
        }
      />

      <Route
        path="administrador/agenda"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AgendaAdministrador />}
          />
        }
      />

      <Route
        path="administrador/reserva"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AgendaSalasAdmin />}
          />
        }
      />

      <Route
        path="administrador/calendario-eps"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<CalendarioAnualEPSAdmin />}
          />
        }
      />

      <Route
        path="administrador/curso-online"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<CursosOnlineAdmin />}
          />
        }
      />

      <Route
        path="administrador/pesquisa"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<PesquisasAdmin />}
          />
        }
      />

      <Route
        path="administrador/interacao/votacao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<InteracoesVotacaoAdmin />}
          />
        }
      />

      <Route
        path="administrador/interacao/quiz"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<InteracoesQuizAdmin />}
          />
        }
      />

      <Route
        path="administrador/interacao/nuvem-palavras"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<InteracoesNuvemPalavrasAdmin />}
          />
        }
      />

      <Route
        path="administrador/interacao/apresentacao/:id"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<InteracoesApresentacao />}
          />
        }
      />

      <Route
        path="administrador/auditoria"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AuditoriaAdmin />}
          />
        }
      />

      <Route
        path="administrador/mensagem"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<MensagemAdmin />}
          />
        }
      />

      <Route
        path="administrador/pendencia"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<PendenciasAdmin />}
          />
        }
      />

      <Route
        path="administrador/saude-plataforma"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<SaudePlataformaAdmin />}
          />
        }
      />

      <Route
        path="certificado-avulso"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<CertificadosAvulsos />}
          />
        }
      />

      <Route
        path="relatorio-customizado"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<RelatoriosCustomizados />}
          />
        }
      />

      <Route
        path="gestao/informacao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GestaoInformacoes />}
          />
        }
      />

      <Route
        path="gestao/usuario"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GestaoUsuarios />}
          />
        }
      />

      <Route
        path="gestao/organizador"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GestaoOrganizador />}
          />
        }
      />

      <Route
        path="gestao/evento"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GerenciarEventos />}
          />
        }
      />

      <Route
        path="gestao/presenca"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GestaoPresencas />}
          />
        }
      />

      <Route
        path="gestao/certificado"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<GestaoCertificados />}
          />
        }
      />

      <Route
        path="gestao/avaliacao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AdminAvaliacao />}
          />
        }
      />

      <Route
        path="gestao/qrcode"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<QRCodesEventosAdmin />}
          />
        }
      />

      <Route
        path="gestao/cancelamento-inscricao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<CancelarInscricaoAdmin />}
          />
        }
      />

      <Route
        path="gestao/calendario-bloqueio"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<CalendarioBloqueiosAdmin />}
          />
        }
      />

      <Route
        path="gestao/lista-presenca-turma"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<ListaPresencasTurma />}
          />
        }
      />

      <Route
        path="chamada/nova"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AdminChamadaForm />}
          />
        }
      />

      <Route
        path="chamada/:id"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AdminChamadaFormWrapper />}
          />
        }
      />

      <Route
        path="gestao/submissao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AdminSubmissaoRouteWrapper />}
          />
        }
      />

      <Route
        path="chamada/:chamadaId/submissao"
        element={
          <ProtectedPage
            permitido={PERFIL_PERMITIDO.administrador}
            element={<AdminSubmissaoRouteWrapper />}
          />
        }
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   App
────────────────────────────────────────────────────────────── */

export default function App() {
  const basename = useMemo(
    () => normalizeBasename(import.meta.env.BASE_URL || "/"),
    []
  );

    return (
    <BrowserRouter basename={basename}>
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
        <RouteChangeAnnouncer />
        <PublicRouteDiagnostics />
        <CriticalRouteDiagnostics />
        <ScrollUnlockOnRouteChange />
        <ScrollToTop />

        <Suspense fallback={<SuspenseFallback />}>
          <Routes>
            {PublicRoutes()}

            <Route element={<PrivateShell />}>
              {UsuarioRoutes()}
              {OrganizadorRoutes()}
              {AdministradorRoutes()}
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        <AtualizacaoPlataformaBanner />
      </div>
    </BrowserRouter>
  );
}