// 📁 src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import { Suspense, lazy, useEffect } from "react";
import Navbar from "./components/Navbar";
import ModalAssinatura from "./components/ModalAssinatura";
import CertificadosAvulsos from "./pages/CertificadosAvulsos";
import QRCodesEventosAdmin from "./pages/QRCodesEventosAdmin";
import QrDoSite from "./pages/QrDoSite";

// 🔄 Lazy loading das páginas
const Login                 = lazy(() => import("./pages/Login"));
const Cadastro              = lazy(() => import("./pages/Cadastro"));
const ValidarCertificado    = lazy(() => import("./pages/ValidarCertificado"));
const HistoricoEventos      = lazy(() => import("./pages/HistoricoEventos"));
const RecuperarSenha        = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha        = lazy(() => import("./pages/RedefinirSenha"));
const Scanner               = lazy(() => import("./pages/Scanner"));

const Eventos               = lazy(() => import("./pages/Eventos"));
const MeusCertificados      = lazy(() => import("./pages/MeusCertificados"));
const MinhasInscricoes      = lazy(() => import("./pages/MinhasInscricoes"));
const DashboardUsuario      = lazy(() => import("./pages/DashboardUsuario"));

const DashboardInstrutor    = lazy(() => import("./pages/DashboardInstrutor"));
const AgendaInstrutor       = lazy(() => import("./pages/AgendaInstrutor"));

const DashboardAdministrador= lazy(() => import("./pages/DashboardAdministrador"));
const DashboardAnalitico    = lazy(() => import("./pages/DashboardAnalitico"));
const GestaoInstrutor       = lazy(() => import("./pages/GestaoInstrutor"));
const RelatoriosCustomizados= lazy(() => import("./pages/RelatoriosCustomizados"));
const ListaPresencasTurma   = lazy(() => import("./pages/ListaPresencasTurma"));
const HistoricoCertificados = lazy(() => import("./pages/HistoricoCertificados"));
const GestaoUsuarios        = lazy(() => import("./pages/GestaoUsuarios"));
const GerenciarEventos      = lazy(() => import("./pages/GerenciarEventos"));
const PresencasPorTurma     = lazy(() => import("./pages/PresencasPorTurma"));
const Perfil                = lazy(() => import("./pages/Perfil"));
const Ajuda                 = lazy(() => import("./pages/Ajuda"));
const Notificacoes          = lazy(() => import("./pages/Notificacoes"));
const AgendaAdministrador   = lazy(() => import("./pages/AgendaAdministrador"));
const Avaliacao             = lazy(() => import("./pages/Avaliacao"));
const GestaoPresencas       = lazy(() => import("./pages/GestaoPresenca"));

// ✅ Página de confirmação via QR (com/sem token)
const ConfirmarPresenca     = lazy(() => import("./pages/ConfirmarPresenca"));

function LayoutComNavbar({ children }) {
  const location = useLocation();

  // Rotas públicas (sem navbar)
  const rotasPublicas = [
    "/",
    "/login",
    "/cadastro",
    "/validar",
    "/validar-presenca",   // 👈 incluir aqui para esconder a navbar nessa rota legada
    "/recuperar-senha",
  ];

  const esconderNavbar =
    rotasPublicas.includes(location.pathname) ||
    location.pathname.startsWith("/redefinir-senha") ||
    // ✅ esconder navbar também nas rotas do QR
    location.pathname.startsWith("/presenca");

  return (
    <div className="min-h-screen bg-gelo text-gray-800 font-sans dark:bg-gray-900 dark:text-white">
      {!esconderNavbar && <Navbar />}
      {children}
    </div>
  );
}

// Mantém a rota /validar para certificados
function ValidarWrapper() {
  return <ValidarCertificado />;
}

/**
 * ✅ Wrapper LEGADO para QR antigo:
 * Lê /validar-presenca?codigo=<url-encodada>,
 * extrai turma/token e redireciona para /presenca com os parâmetros normalizados.
 */
function ValidarPresencaRouter() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const codigoRaw = sp.get("codigo") || sp.get("c") || "";
    let raw = codigoRaw;
    try { raw = decodeURIComponent(codigoRaw); } catch { /* no-op */ }

    let turmaId = null;
    let token   = null;

    // 1) tenta parsear como URL válida
    try {
      const u = new URL(raw);
      // query ?turma= / ?turma_id= / ?id=
      turmaId =
        u.searchParams.get("turma") ||
        u.searchParams.get("turma_id") ||
        u.searchParams.get("id");
      token = u.searchParams.get("t") || u.searchParams.get("token");

      // /presenca/:id no path
      if (!turmaId) {
        const m = (u.pathname || "").match(/\/presenca\/(\d+)/);
        if (m && m[1]) turmaId = m[1];
      }

      // path encodado tipo /%2Fpresenca%2F13
      if (!turmaId) {
        const decPath = decodeURIComponent(u.pathname || "");
        const m2 = decPath.match(/\/presenca\/(\d+)/);
        if (m2 && m2[1]) turmaId = m2[1];
      }
    } catch {
      // 2) fallback: tratar como string qualquer
      const dec = (() => { try { return decodeURIComponent(raw); } catch { return raw; }})();
      const m = dec.match(/\/presenca\/(\d+)/);
      if (m && m[1]) turmaId = m[1];

      // extrai query manualmente
      const qs = dec.includes("?") ? dec.split("?")[1] : "";
      const qsp = new URLSearchParams(qs);
      token = qsp.get("t") || qsp.get("token") || token;
      turmaId = qsp.get("turma") || qsp.get("turma_id") || qsp.get("id") || turmaId;
    }

    const search = new URLSearchParams();
    if (turmaId) search.set("turma", String(turmaId));
    if (token)   search.set("t", token);

    const dest = `/presenca${search.toString() ? `?${search.toString()}` : ""}`;
    navigate(dest, { replace: true });
  }, [sp, navigate]);

  // Pequeno loading para não parecer "vazio"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="text-sm text-gray-600 dark:text-gray-200">Redirecionando…</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LayoutComNavbar>
        <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
          <Routes>
            {/* 🌐 Rotas públicas */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/validar" element={<ValidarWrapper />} />

            {/* ✅ Rota LEGADA que chega pelo QR antigo */}
            <Route path="/validar-presenca" element={<ValidarPresencaRouter />} />

            {/* ✅ Rotas novas do QR de presença */}
            <Route path="/presenca" element={<ConfirmarPresenca />} />
            <Route path="/presenca/:turmaId" element={<ConfirmarPresenca />} />

            <Route path="/historico" element={<HistoricoEventos />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
            <Route path="/scanner" element={<Scanner />} />

            {/* 🔐 Rotas protegidas (usuário) */}
            <Route path="/dashboard" element={<PrivateRoute><DashboardUsuario /></PrivateRoute>} />
            <Route path="/eventos" element={<PrivateRoute><Eventos /></PrivateRoute>} />
            <Route path="/certificados" element={<PrivateRoute><MeusCertificados /></PrivateRoute>} />
            <Route path="/minhas-inscricoes" element={<PrivateRoute><MinhasInscricoes /></PrivateRoute>} />
            <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/ajuda" element={<PrivateRoute><Ajuda /></PrivateRoute>} />
            <Route path="/notificacoes" element={<PrivateRoute><Notificacoes /></PrivateRoute>} />
            <Route path="/avaliacao" element={<PrivateRoute><Avaliacao /></PrivateRoute>} />
            <Route path="/avaliar/:turmaId" element={<PrivateRoute><Avaliacao /></PrivateRoute>} />

            {/* 🧑‍🏫 Instrutor / Admin */}
            <Route
              path="/instrutor"
              element={
                <PrivateRoute permitido={["instrutor", "administrador"]}>
                  <DashboardInstrutor />
                </PrivateRoute>
              }
            />
            <Route
              path="/agenda-instrutor"
              element={
                <PrivateRoute permitido={["instrutor", "administrador"]}>
                  <AgendaInstrutor />
                </PrivateRoute>
              }
            />

            {/* 🛠️ Administrador */}
            <Route
              path="/administrador"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <DashboardAdministrador />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard-analitico"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <DashboardAnalitico />
                </PrivateRoute>
              }
            />
            <Route
              path="/gerenciar-eventos"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <GerenciarEventos />
                </PrivateRoute>
              }
            />
            <Route
              path="/gestao-instrutor"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <GestaoInstrutor />
                </PrivateRoute>
              }
            />
            <Route
              path="/gestao-usuarios"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <GestaoUsuarios />
                </PrivateRoute>
              }
            />
            <Route
              path="/historico-certificados"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <HistoricoCertificados />
                </PrivateRoute>
              }
            />
            <Route
              path="/lista-presencas-turma"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <ListaPresencasTurma />
                </PrivateRoute>
              }
            />
            <Route
              path="/relatorios-customizados"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <RelatoriosCustomizados />
                </PrivateRoute>
              }
            />
            <Route
              path="/qr-site"
              element={
                <PrivateRoute permitido={["instrutor", "administrador"]}>
                  <QrDoSite />
                </PrivateRoute>
              }
            />
            <Route
              path="/turmas/presencas/:turmaId"
              element={
                <PrivateRoute permitido={["instrutor", "administrador"]}>
                  <PresencasPorTurma />
                </PrivateRoute>
              }
            />
            <Route
              path="/agenda-administrador"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <AgendaAdministrador />
                </PrivateRoute>
              }
            />
            <Route
              path="/certificados-avulsos"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <CertificadosAvulsos />
                </PrivateRoute>
              }
            />
            <Route
              path="/gestao-presenca"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <GestaoPresencas />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/qr-codes"
              element={
                <PrivateRoute permitido={["administrador"]}>
                  <QRCodesEventosAdmin />
                </PrivateRoute>
              }
            />
          </Routes>
        </Suspense>
      </LayoutComNavbar>
    </BrowserRouter>
  );
}
