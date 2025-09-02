import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import { Suspense, lazy, useEffect } from "react";
import Navbar from "./components/Navbar";
import ModalAssinatura from "./components/ModalAssinatura";
import CertificadosAvulsos from "./pages/CertificadosAvulsos";
import QRCodesEventosAdmin from "./pages/QRCodesEventosAdmin";
import QrDoSite from "./pages/QrDoSite";

// 🔄 Lazy loading das páginas
const Login               = lazy(() => import("./pages/Login"));
const Cadastro            = lazy(() => import("./pages/Cadastro"));
const ValidarCertificado  = lazy(() => import("./pages/ValidarCertificado"));
const HistoricoEventos    = lazy(() => import("./pages/HistoricoEventos"));
const RecuperarSenha      = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha      = lazy(() => import("./pages/RedefinirSenha"));
const Scanner             = lazy(() => import("./pages/Scanner"));

const Eventos             = lazy(() => import("./pages/Eventos"));
const MeusCertificados    = lazy(() => import("./pages/MeusCertificados"));
const MinhasInscricoes    = lazy(() => import("./pages/MinhasInscricoes"));
const DashboardUsuario    = lazy(() => import("./pages/DashboardUsuario"));

const DashboardInstrutor  = lazy(() => import("./pages/DashboardInstrutor"));
const AgendaInstrutor     = lazy(() => import("./pages/AgendaInstrutor"));

const DashboardAdministrador = lazy(() => import("./pages/DashboardAdministrador"));
const DashboardAnalitico  = lazy(() => import("./pages/DashboardAnalitico"));
const GestaoInstrutor     = lazy(() => import("./pages/GestaoInstrutor"));
const RelatoriosCustomizados = lazy(() => import("./pages/RelatoriosCustomizados"));
const ListaPresencasTurma = lazy(() => import("./pages/ListaPresencasTurma"));
const HistoricoCertificados = lazy(() => import("./pages/HistoricoCertificados"));
const GestaoUsuarios      = lazy(() => import("./pages/GestaoUsuarios"));
const GerenciarEventos    = lazy(() => import("./pages/GerenciarEventos"));
const PresencasPorTurma   = lazy(() => import("./pages/PresencasPorTurma"));
const Perfil              = lazy(() => import("./pages/Perfil"));
const Ajuda               = lazy(() => import("./pages/Ajuda"));
const Notificacoes        = lazy(() => import("./pages/Notificacoes"));
const AgendaAdministrador = lazy(() => import("./pages/AgendaAdministrador"));
const Avaliacao           = lazy(() => import("./pages/Avaliacao"));
const GestaoPresencas     = lazy(() => import("./pages/GestaoPresenca"));

// ✅ Nova página do QR
const ConfirmarPresenca   = lazy(() => import("./pages/ConfirmarPresenca"));

/** 🧼 Corrige paths com %2F e múltiplas barras para evitar “tela branca” em leitores de QR */
function PathFixer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const dec = decodeURIComponent(location.pathname);
      const norm = dec.replace(/\/{2,}/g, "/");
      if (norm !== location.pathname) {
        // só redireciona se a versão decodificada realmente muda algo
        navigate(norm + location.search, { replace: true });
      }
    } catch {
      // se decode falhar, não faz nada
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
}

function LayoutComNavbar({ children }) {
  const location = useLocation();
  const rotasPublicas = ["/", "/login", "/cadastro", "/validar", "/recuperar-senha"];
  const esconderNavbar =
    rotasPublicas.includes(location.pathname) ||
    location.pathname.startsWith("/redefinir-senha") ||
    location.pathname.startsWith("/presenca"); // sem navbar no QR

  return (
    <div className="min-h-screen bg-gelo text-gray-800 font-sans dark:bg-gray-900 dark:text-white">
      <PathFixer />
      {!esconderNavbar && <Navbar />}
      {children}
    </div>
  );
}

function ValidarWrapper() {
  return <ValidarCertificado />;
}

export default function App() {
  return (
    <BrowserRouter>
      <LayoutComNavbar>
        <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
          <Routes>
            {/* 🌐 Públicas */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/validar" element={<ValidarWrapper />} />

            {/* ✅ QR de presença */}
            <Route path="/presenca" element={<ConfirmarPresenca />} />
            <Route path="/presenca/:turmaId" element={<ConfirmarPresenca />} />

            <Route path="/historico" element={<HistoricoEventos />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
            <Route path="/scanner" element={<Scanner />} />

            {/* 🔐 Usuário */}
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
            <Route path="/instrutor" element={<PrivateRoute permitido={["instrutor", "administrador"]}><DashboardInstrutor /></PrivateRoute>} />
            <Route path="/agenda-instrutor" element={<PrivateRoute permitido={["instrutor", "administrador"]}><AgendaInstrutor /></PrivateRoute>} />

            {/* 🛠️ Admin */}
            <Route path="/administrador" element={<PrivateRoute permitido={["administrador"]}><DashboardAdministrador /></PrivateRoute>} />
            <Route path="/dashboard-analitico" element={<PrivateRoute permitido={["administrador"]}><DashboardAnalitico /></PrivateRoute>} />
            <Route path="/gerenciar-eventos" element={<PrivateRoute permitido={["administrador"]}><GerenciarEventos /></PrivateRoute>} />
            <Route path="/gestao-instrutor" element={<PrivateRoute permitido={["administrador"]}><GestaoInstrutor /></PrivateRoute>} />
            <Route path="/gestao-usuarios" element={<PrivateRoute permitido={["administrador"]}><GestaoUsuarios /></PrivateRoute>} />
            <Route path="/historico-certificados" element={<PrivateRoute permitido={["administrador"]}><HistoricoCertificados /></PrivateRoute>} />
            <Route path="/lista-presencas-turma" element={<PrivateRoute permitido={["administrador"]}><ListaPresencasTurma /></PrivateRoute>} />
            <Route path="/relatorios-customizados" element={<PrivateRoute permitido={["administrador"]}><RelatoriosCustomizados /></PrivateRoute>} />
            <Route path="/qr-site" element={<PrivateRoute permitido={["instrutor", "administrador"]}><QrDoSite /></PrivateRoute>} />
            <Route path="/turmas/presencas/:turmaId" element={<PrivateRoute permitido={["instrutor", "administrador"]}><PresencasPorTurma /></PrivateRoute>} />
            <Route path="/agenda-administrador" element={<PrivateRoute permitido={["administrador"]}><AgendaAdministrador /></PrivateRoute>} />
            <Route path="/certificados-avulsos" element={<PrivateRoute permitido={["administrador"]}><CertificadosAvulsos /></PrivateRoute>} />
            <Route path="/gestao-presenca" element={<PrivateRoute permitido={["administrador"]}><GestaoPresencas /></PrivateRoute>} />
            <Route path="/admin/qr-codes" element={<PrivateRoute permitido={["administrador"]}><QRCodesEventosAdmin /></PrivateRoute>} />
          </Routes>
        </Suspense>
      </LayoutComNavbar>
    </BrowserRouter>
  );
}
