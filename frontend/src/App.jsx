// 📁 src/App.jsx
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";
import ModalAssinatura from "./components/ModalAssinatura"; // (ok ficar importado mesmo sem uso)
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

// ✅ Página pública para confirmar presença via QR (com/sem token)
const ConfirmarPresenca     = lazy(() => import("./pages/ConfirmarPresenca"));

function LayoutComNavbar({ children }) {
  const location = useLocation();

  // Rotas públicas (sem navbar)
  const rotasPublicas = [
    "/",
    "/login",
    "/cadastro",
    "/validar",
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

// /validar continua sendo a página de validação de certificados
function ValidarWrapper() {
  return <ValidarCertificado />;
}

/** 🔧 Normalizador de caminhos codificados (%2F)
 * Ex.: "/%2Fpresenca%2F13" -> "/presenca/13"
 * Mantém querystring e hash.
 */
function PathNormalizer() {
  const loc = useLocation();

  useEffect(() => {
    let decodedPath = loc.pathname;
    try {
      decodedPath = decodeURIComponent(loc.pathname);
    } catch {
      // se der erro na decodificação, seguimos com o pathname original
    }

    // compacta barras duplas e remove excesso inicial
    decodedPath = decodedPath.replace(/\/{2,}/g, "/");
    if (decodedPath !== loc.pathname) {
      const target = decodedPath + (loc.search || "") + (loc.hash || "");
      // replace para não poluir histórico
      window.location.replace(target);
      return;
    }

    // Se chegou aqui, não tinha o que normalizar → redireciona pra home
    // (ou substitua pela sua página 404, se preferir)
    // eslint-disable-next-line no-undef
  }, [loc.pathname, loc.search, loc.hash]);

  return <Navigate to="/" replace />;
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

            {/* ✅ Rotas públicas do QR de presença */}
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

            {/* 🔚 Rota coringa: normaliza caminhos com %2F e, se nada a fazer, manda pra home */}
            <Route path="*" element={<PathNormalizer />} />
          </Routes>
        </Suspense>
      </LayoutComNavbar>
    </BrowserRouter>
  );
}
