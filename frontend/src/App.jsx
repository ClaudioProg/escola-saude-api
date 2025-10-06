// 📁 src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useSearchParams,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import CertificadosAvulsos from "./pages/CertificadosAvulsos";
import QRCodesEventosAdmin from "./pages/QRCodesEventosAdmin";
import QrDoSite from "./pages/QrDoSite";

// 🔄 Lazy loading das páginas (sem deps extras)
const Login                  = lazy(() => import("./pages/Login"));
const Cadastro               = lazy(() => import("./pages/Cadastro"));
const ValidarCertificado     = lazy(() => import("./pages/ValidarCertificado"));
const HistoricoEventos       = lazy(() => import("./pages/HistoricoEventos"));
const RecuperarSenha         = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha         = lazy(() => import("./pages/RedefinirSenha"));
const Scanner                = lazy(() => import("./pages/Scanner"));

const Eventos                = lazy(() => import("./pages/Eventos"));
const MinhasPresencas        = lazy(() => import("./pages/MinhasPresencas"));
const MeusCertificados       = lazy(() => import("./pages/MeusCertificados"));
const MinhasInscricoes       = lazy(() => import("./pages/MinhasInscricoes"));
const DashboardUsuario       = lazy(() => import("./pages/DashboardUsuario"));
const Teste                  = lazy(() => import("./pages/Teste"));
const AgendamentoSala        = lazy(() => import("./pages/AgendamentoSala"));
const SolicitacaoCurso       = lazy(() => import("./pages/SolicitacaoCurso"));
const AgendaUsuario          = lazy(() => import("./pages/AgendaUsuario"));

const DashboardInstrutor     = lazy(() => import("./pages/DashboardInstrutor"));
const AgendaInstrutor        = lazy(() => import("./pages/AgendaInstrutor"));
const InstrutorPresenca      = lazy(() => import("./pages/InstrutorPresenca"));
const CertificadosInstrutor  = lazy(() => import("./pages/CertificadosInstrutor"));
const AvaliacaoInstrutor     = lazy(() => import("./pages/AvaliacaoInstrutor"));

const DashboardAdministrador = lazy(() => import("./pages/DashboardAdministrador"));
const DashboardAnalitico     = lazy(() => import("./pages/DashboardAnalitico"));
const GestaoInstrutor        = lazy(() => import("./pages/GestaoInstrutor"));
const RelatoriosCustomizados = lazy(() => import("./pages/RelatoriosCustomizados"));
const ListaPresencasTurma    = lazy(() => import("./pages/ListaPresencasTurma"));
const HistoricoCertificados  = lazy(() => import("./pages/HistoricoCertificados"));
const GestaoUsuarios         = lazy(() => import("./pages/GestaoUsuarios"));
const GerenciarEventos       = lazy(() => import("./pages/GerenciarEventos"));
const PresencasPorTurma      = lazy(() => import("./pages/PresencasPorTurma"));
const Perfil                 = lazy(() => import("./pages/Perfil"));
const Ajuda                  = lazy(() => import("./pages/Ajuda"));
const Notificacoes           = lazy(() => import("./pages/Notificacoes"));
const AgendaAdministrador    = lazy(() => import("./pages/AgendaAdministrador"));
const Avaliacao              = lazy(() => import("./pages/Avaliacao"));
const GestaoPresencas        = lazy(() => import("./pages/GestaoPresenca"));
const CancelarInscricoesAdmin= lazy(() => import("./pages/CancelarInscricoesAdmin"));

// ✅ Página de confirmação via QR (com/sem token)
const ConfirmarPresenca      = lazy(() => import("./pages/ConfirmarPresenca"));

// 🆕 Manual do Usuário
const ManualUsuario          = lazy(() => import("./pages/usuario/Manual"));

// 🆕 Páginas públicas novas
const AjudaCadastro          = lazy(() => import("./pages/AjudaCadastro"));
const Privacidade            = lazy(() => import("./pages/Privacidade"));

// 🆕 Home pós-login (portal da Escola)
const HomeEscola             = lazy(() => import("./pages/HomeEscola"));

/* 🆕 PÁGINAS DE SUBMISSÕES DE TRABALHOS */
// Admin – criar/editar chamada
const AdminChamadaForm       = lazy(() => import("./pages/AdminChamadaForm"));
// Usuário – submeter e acompanhar
const UsuarioSubmissoes      = lazy(() => import("./pages/UsuarioSubmissoes"));
// Admin – listar/avaliar/responder
const AdminSubmissoesResposta = lazy(() => import("./pages/AdminSubmissoesResposta"));

/* ──────────────────────────────────────────────────────────────
   A11y: Announcer de mudanças de rota
   ────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   ✅ Hotfix global: destrava scroll preso ao trocar de rota
   ────────────────────────────────────────────────────────────── */
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
        try { window.scrollTo({ top: -top, behavior: "instant" }); }
        catch { window.scrollTo(0, -top); }
      }
    };

    unlock();
    const t = setTimeout(unlock, 0);
    return () => clearTimeout(t);
  }, [location.key]);
  return null;
}

/* ──────────────────────────────────────────────────────────────
   UX: Scroll para o topo em cada navegação
   ────────────────────────────────────────────────────────────── */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: "instant" }); }
    catch { window.scrollTo(0, 0); }
  }, [pathname]);
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Layout com Navbar + Skip Link
   ────────────────────────────────────────────────────────────── */
function LayoutComNavbar({ children }) {
  const location = useLocation();

  const isPublicPath = useMemo(() => {
    const p = location.pathname;
    return (
      p === "/login" ||
      p === "/cadastro" ||
      p === "/recuperar-senha" ||
      p === "/validar" ||
      p === "/validar-presenca" ||
      p === "/validar-certificado" ||
      p === "/ajuda/cadastro" ||
      p === "/privacidade" ||
      p.endsWith(".html") ||
      p.startsWith("/redefinir-senha") ||
      p.startsWith("/presenca")
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* Skip link para acessibilidade */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-green-900 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl"
      >
        Pular para conteúdo
      </a>

      {!isPublicPath && <Navbar />}

      {/* Announcer + Scroll Unlock + ScrollToTop */}
      <RouteChangeAnnouncer />
      <ScrollUnlockOnRouteChange />
      <ScrollToTop />

      <main id="content" className="min-h-[70vh]">
        {children}
      </main>
    </div>
  );
}

// Mantém a rota /validar apontando para a página atual
function ValidarWrapper() {
  return <ValidarCertificado />;
}

/** Alias para URLs antigas com extensão .html */
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

/** Wrapper LEGADO para QR antigo com ?codigo= */
function ValidarPresencaRouter() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const codigoRaw = sp.get("codigo") || sp.get("c") || "";
    let raw = codigoRaw;
    try { raw = decodeURIComponent(codigoRaw); } catch {}
    let turmaId = null;
    let token   = null;

    try {
      const u = new URL(raw);

      // 1) querystring
      turmaId =
        u.searchParams.get("turma") ||
        u.searchParams.get("turma_id") ||
        u.searchParams.get("id");
      token = u.searchParams.get("t") || u.searchParams.get("token");

      // 2) extrair do pathname sem regex
      if (!turmaId) {
        const parts = (u.pathname || "").split("/").filter(Boolean);
        const idx = parts.indexOf("presenca");
        if (idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }

      // 3) fallback regex
      if (!turmaId) {
        const m = (u.pathname || "").match(/\/presenca\/(\d+)/);
        if (m && m[1]) turmaId = m[1];
      }

      // 4) pathname decodificado
      if (!turmaId) {
        const decPath = decodeURIComponent(u.pathname || "");
        const m2 = decPath.match(/\/presenca\/(\d+)/);
        if (m2 && m2[1]) turmaId = m2[1];
      }
    } catch {
      // String simples
      const dec = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();

      // querystring direta
      const qs = dec.includes("?") ? dec.split("?")[1] : "";
      const qsp = new URLSearchParams(qs);
      token = qsp.get("t") || qsp.get("token") || token;
      turmaId =
        qsp.get("turma") ||
        qsp.get("turma_id") ||
        qsp.get("id") ||
        turmaId;

      // path “…/presenca/123”
      if (!turmaId) {
        const pathOnly = dec.split("?")[0] || "";
        const parts = pathOnly.split("/").filter(Boolean);
        const idx = parts.indexOf("presenca");
        if (idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }

      // fallback final com regex
      if (!turmaId) {
        const m = dec.match(/\/presenca\/(\d+)/);
        if (m && m[1]) turmaId = m[1];
      }
    }

    const search = new URLSearchParams();
    if (turmaId) search.set("turma", String(turmaId));
    if (token)   search.set("t", token);

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

/* ─────────── Wrappers para rotas com :id (submissões) ─────────── */
function AdminChamadaFormWrapper() {
  const { id } = useParams();
  return <AdminChamadaForm chamadaId={id} />;
}
function AdminSubmissoesRouteWrapper() {
  const { chamadaId } = useParams(); // opcional
  return <AdminSubmissoesResposta chamadaId={chamadaId ? Number(chamadaId) : undefined} />;
}

/* ──────────────────────────────────────────────────────────────
   App
   ────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <LayoutComNavbar>
        <Suspense
          fallback={
            <div className="p-6 flex items-center justify-center">
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
              >
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-900" />
                Carregando…
              </span>
            </div>
          }
        >
          <Routes>
            {/* 🌐 públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />

            {/* 🆕 públicas novas */}
            <Route path="/ajuda/cadastro" element={<AjudaCadastro />} />
            <Route path="/ajuda/cadastro.html" element={<HtmlAliasRedirect />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/privacidade.html" element={<HtmlAliasRedirect />} />

            {/* Certificado (nova) */}
            <Route path="/validar-certificado" element={<ValidarCertificado />} />
            <Route path="/validar-certificado.html" element={<HtmlAliasRedirect />} />

            {/* Presença (legado) */}
            <Route path="/validar" element={<ValidarWrapper />} />
            <Route path="/validar-presenca" element={<ValidarPresencaRouter />} />

            {/* QR presença (novo) */}
            <Route path="/presenca" element={<ConfirmarPresenca />} />
            <Route path="/presenca/:turmaId" element={<ConfirmarPresenca />} />

            <Route path="/historico" element={<HistoricoEventos />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
            <Route path="/scanner" element={<Scanner />} />

            {/* 🔐 protegidas */}
            {/* Início pós-login → HomeEscola */}
            <Route path="/" element={<PrivateRoute><HomeEscola /></PrivateRoute>} />

            {/* Painel do Usuário (novo caminho) */}
            <Route path="/usuario/dashboard" element={<PrivateRoute><DashboardUsuario /></PrivateRoute>} />

            {/* Legado: /dashboard → redireciona */}
            <Route path="/dashboard" element={<PrivateRoute><Navigate to="/usuario/dashboard" replace /></PrivateRoute>} />

            <Route path="/eventos" element={<PrivateRoute><Eventos /></PrivateRoute>} />
            <Route path="/minhas-presencas" element={<PrivateRoute><MinhasPresencas /></PrivateRoute>} />
            <Route path="/certificados" element={<PrivateRoute><MeusCertificados /></PrivateRoute>} />
            <Route path="/minhas-inscricoes" element={<PrivateRoute><MinhasInscricoes /></PrivateRoute>} />
            <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/ajuda" element={<PrivateRoute><Ajuda /></PrivateRoute>} />
            <Route path="/notificacoes" element={<PrivateRoute><Notificacoes /></PrivateRoute>} />
            <Route path="/avaliacao" element={<PrivateRoute><Avaliacao /></PrivateRoute>} />
            <Route path="/avaliar/:turmaId" element={<PrivateRoute><Avaliacao /></PrivateRoute>} />
            <Route path="/teste" element={<PrivateRoute><Teste /></PrivateRoute>} />
            <Route path="/agendamento-sala" element={<PrivateRoute><AgendamentoSala /></PrivateRoute>} />
            <Route path="/solicitar-curso" element={<PrivateRoute><SolicitacaoCurso /></PrivateRoute>} />
            <Route path="/agenda" element={<PrivateRoute><AgendaUsuario /></PrivateRoute>} />

            {/* 🆕 Manual do Usuário */}
            <Route path="/usuario/manual" element={<PrivateRoute><ManualUsuario /></PrivateRoute>} />
            <Route path="/manual" element={<PrivateRoute><ManualUsuario /></PrivateRoute>} />

            {/* 🧑‍🏫 / 🛠️ */}
            <Route path="/instrutor" element={<PrivateRoute permitido={["instrutor", "administrador"]}><DashboardInstrutor /></PrivateRoute>} />
            <Route path="/agenda-instrutor" element={<PrivateRoute permitido={["instrutor", "administrador"]}><AgendaInstrutor /></PrivateRoute>} />
            <Route path="/qr-site" element={<PrivateRoute permitido={["instrutor", "administrador"]}><QrDoSite /></PrivateRoute>} />
            <Route path="/turmas/presencas/:turmaId" element={<PrivateRoute permitido={["instrutor", "administrador"]}><PresencasPorTurma /></PrivateRoute>} />
            <Route path="/instrutor/presenca" element={<PrivateRoute permitido={["instrutor", "administrador"]}><InstrutorPresenca /></PrivateRoute>} />
            <Route path="/instrutor/certificados" element={<PrivateRoute permitido={["instrutor", "administrador"]}><CertificadosInstrutor /></PrivateRoute>} />
            <Route path="/instrutor/avaliacao" element={<PrivateRoute permitido={["instrutor", "administrador"]}><AvaliacaoInstrutor /></PrivateRoute>} />

            {/* 🆕 ROTAS DE SUBMISSÕES DE TRABALHOS */}
            {/* Usuário: submeter e acompanhar */}
            <Route path="/submissoes" element={<PrivateRoute><UsuarioSubmissoes /></PrivateRoute>} />
            {/* Admin: criar/editar chamada */}
            <Route path="/admin/chamadas/new" element={<PrivateRoute permitido={["administrador"]}><AdminChamadaForm /></PrivateRoute>} />
            <Route path="/admin/chamadas/:id" element={<PrivateRoute permitido={["administrador"]}><AdminChamadaFormWrapper /></PrivateRoute>} />
            {/* Admin: ver/avaliar/responder submissões (todas ou por chamada) */}
            <Route path="/admin/submissoes" element={<PrivateRoute permitido={["administrador"]}><AdminSubmissoesRouteWrapper /></PrivateRoute>} />
            <Route path="/admin/chamadas/:chamadaId/submissoes" element={<PrivateRoute permitido={["administrador"]}><AdminSubmissoesRouteWrapper /></PrivateRoute>} />

            <Route path="/administrador" element={<PrivateRoute permitido={["administrador"]}><DashboardAdministrador /></PrivateRoute>} />
            <Route path="/dashboard-analitico" element={<PrivateRoute permitido={["administrador"]}><DashboardAnalitico /></PrivateRoute>} />
            <Route path="/gerenciar-eventos" element={<PrivateRoute permitido={["administrador"]}><GerenciarEventos /></PrivateRoute>} />
            <Route path="/gestao-instrutor" element={<PrivateRoute permitido={["administrador"]}><GestaoInstrutor /></PrivateRoute>} />
            <Route path="/gestao-usuarios" element={<PrivateRoute permitido={["administrador"]}><GestaoUsuarios /></PrivateRoute>} />
            <Route path="/historico-certificados" element={<PrivateRoute permitido={["administrador"]}><HistoricoCertificados /></PrivateRoute>} />
            <Route path="/lista-presencas-turma" element={<PrivateRoute permitido={["administrador"]}><ListaPresencasTurma /></PrivateRoute>} />
            <Route path="/relatorios-customizados" element={<PrivateRoute permitido={["administrador"]}><RelatoriosCustomizados /></PrivateRoute>} />
            <Route path="/agenda-administrador" element={<PrivateRoute permitido={["administrador"]}><AgendaAdministrador /></PrivateRoute>} />
            <Route path="/certificados-avulsos" element={<PrivateRoute permitido={["administrador"]}><CertificadosAvulsos /></PrivateRoute>} />
            <Route path="/gestao-presenca" element={<PrivateRoute permitido={["administrador"]}><GestaoPresencas /></PrivateRoute>} />
            <Route path="/admin/qr-codes" element={<PrivateRoute permitido={["administrador"]}><QRCodesEventosAdmin /></PrivateRoute>} />
            <Route path="/admin/cancelar-inscricoes" element={<PrivateRoute permitido={["administrador"]}><CancelarInscricoesAdmin /></PrivateRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </LayoutComNavbar>
    </BrowserRouter>
  );
}
