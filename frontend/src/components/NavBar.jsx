// 📁 src/components/Navbar.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  BookOpen,
  FileText,
  LogOut,
  QrCode,
  Shield,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  BarChart3,
  Presentation,
  ClipboardList,
  ListChecks,
  PencilLine,
  UserCog,
  HelpCircle
} from "lucide-react";
import { apiGet } from "../services/api"; // ✅ usa serviço de API

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const normalizarPerfis = (raw) => {
   if (!raw) return ["usuario"];
   try {
     const parsed = JSON.parse(raw);
     if (Array.isArray(parsed)) return parsed.map(p => String(p).toLowerCase());
   } catch { /* não era JSON */ }
   // fallback: string separada por vírgulas
   return String(raw)
     .split(",")
     .map(p => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
     .filter(Boolean);
 };

 const [perfil, setPerfil] = useState(() => normalizarPerfis(localStorage.getItem("perfil")));

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : document.documentElement.classList.contains("dark");
  });
  
  const [menuusuarioAberto, setMenuusuarioAberto] = useState(false);
  const [menuinstrutorAberto, setMenuinstrutorAberto] = useState(false);
  const [menuadministradorAberto, setMenuadministradorAberto] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);

  const refusuario = useRef();
  const refinstrutor = useRef();
  const refadministrador = useRef();
  const configRef = useRef();

  useEffect(() => {
  setPerfil(normalizarPerfis(localStorage.getItem("perfil")));
  const onStorage = (e) => {
    if (e.key === "perfil" || e.key === "usuario") {
      setPerfil(normalizarPerfis(localStorage.getItem("perfil")));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);

  // ⬇️ REMOVIDO fetch com http://; agora usamos apiGet (HTTPS via VITE_API_BASE_URL)
  const [notificacoes, setNotificacoes] = useState([]);
  useEffect(() => {
    apiGet("/api/notificacoes")
      .then((data) => setNotificacoes(data || []))
      .catch(() => setNotificacoes([]));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleClickFora = (e) => {
      if (refusuario.current && !refusuario.current.contains(e.target)) setMenuusuarioAberto(false);
      if (refinstrutor.current && !refinstrutor.current.contains(e.target)) setMenuinstrutorAberto(false);
      if (refadministrador.current && !refadministrador.current.contains(e.target)) setMenuadministradorAberto(false);
      if (configRef.current && !configRef.current.contains(e.target)) setConfigAberto(false);
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const sair = () => {
    localStorage.clear();
    navigate("/login");
  };

  const menusUsuario = [
    { label: "Eventos", path: "/eventos", icon: CalendarDays },
    { label: "Meus Cursos", path: "/minhas-inscricoes", icon: BookOpen },
    { label: "Avaliações Pendentes", path: "/avaliacao", icon: PencilLine },
    { label: "Meus Certificados", path: "/certificados", icon: FileText },
    { label: "Escanear", path: "/scanner", icon: QrCode },
  ];

  const menusinstrutor = [
  { label: "Painel", path: "/instrutor", icon: LayoutDashboard },
  { label: "Agenda", path: "/agenda-instrutor", icon: CalendarDays },
];

  const menusadministrador = [
    { label: "Painel administrador", path: "/administrador", icon: LayoutDashboard },
    { label: "Agenda", path: "/agenda-administrador", icon: ListChecks },
    { label: "Certificados Avulsos", path: "/certificados-avulsos", icon: FileText },
    { label: "Dashboard Analítico", path: "/dashboard-analitico", icon: BarChart3 },
    { label: "QR Code Presença", path: "/admin/qr-codes", icon: QrCode },
    { label: "Relatórios", path: "/relatorios-customizados", icon: ClipboardList },
    { label: "Gestão de Usuários", path: "/gestao-usuarios", icon: Users },
    { label: "Gestão de instrutor", path: "/gestao-instrutor", icon: Presentation },
    { label: "Gestão de Eventos", path: "/gerenciar-eventos", icon: CalendarDays },
    { label: "Gestão de Presença", path: "/gestao-presenca", icon: QrCode }
  ];

  const isUsuario = perfil.includes("usuario") || perfil.includes("instrutor") || perfil.includes("administrador");
  const isInstrutor = perfil.includes("instrutor") || perfil.includes("administrador");
  const isAdministrador = perfil.includes("administrador");

  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  // 🔄 Atualiza contador de notificações não lidas (usa apiGet)
  async function atualizarContadorNotificacoes() {
    try {
      const data = await apiGet("/api/notificacoes/nao-lidas/contagem");
      setTotalNaoLidas(data?.totalNaoLidas ?? data?.total ?? 0);
    } catch {
      setTotalNaoLidas(0);
    }
  }

  // ⏱️ Atualiza automaticamente a cada 15 segundos
  useEffect(() => {
    atualizarContadorNotificacoes(); // inicial
    const intervalo = setInterval(atualizarContadorNotificacoes, 15000);

    // disponibiliza globalmente para chamada externa
    window.atualizarContadorNotificacoes = atualizarContadorNotificacoes;

    return () => {
      clearInterval(intervalo);
      delete window.atualizarContadorNotificacoes;
    };
  }, []);

  return (
    <nav className="w-full bg-lousa text-white shadow-md px-4 py-2 flex items-center justify-between sticky top-0 z-50 border-b border-white/20" role="navigation">
      <div className="text-xl font-bold cursor-pointer select-none" onClick={() => navigate("/")}>
        Escola da Saúde
      </div>
      <div className="flex gap-3 items-center">
        {/* MENU USUÁRIO */}
        {isUsuario && (
          <div className="relative" ref={refusuario}>
            <button
              onClick={() => setMenuusuarioAberto(!menuusuarioAberto)}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-xl hover:bg-white hover:text-lousa"
            >
              <BookOpen className="w-4 h-4" /> Usuário <ChevronDown className="w-4 h-4" />
            </button>
            {menuusuarioAberto && (
              <div className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-60">
                {menusUsuario.map(({ label, path, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      navigate(path);
                      setMenuusuarioAberto(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:underline flex items-center gap-2 ${location.pathname === path ? "font-bold underline" : ""}`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MENU INSTRUTOR */}
        {isInstrutor && (
          <div className="relative" ref={refinstrutor}>
            <button
              onClick={() => setMenuinstrutorAberto(!menuinstrutorAberto)}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-xl hover:bg-white hover:text-lousa"
            >
              <Presentation className="w-4 h-4" /> Instrutor <ChevronDown className="w-4 h-4" />
            </button>
            {menuinstrutorAberto && (
              <div className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-60">
                {menusinstrutor.map(({ label, path, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      navigate(path);
                      setMenuinstrutorAberto(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:underline flex items-center gap-2 ${location.pathname === path ? "font-bold underline" : ""}`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MENU ADMINISTRADOR */}
        {isAdministrador && (
          <div className="relative" ref={refadministrador}>
            <button
              onClick={() => setMenuadministradorAberto(!menuadministradorAberto)}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-xl hover:bg-white hover:text-lousa"
            >
              <Shield className="w-4 h-4" /> Administrador <ChevronDown className="w-4 h-4" />
            </button>
            {menuadministradorAberto && (
              <div className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-64">
                {menusadministrador.map(({ label, path, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      navigate(path);
                      setMenuadministradorAberto(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:underline flex items-center gap-2 ${location.pathname === path ? "font-bold underline" : ""}`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 🔔 Notificações */}
        <button
          onClick={() => navigate("/notificacoes")}
          className="relative flex items-center justify-center px-3 py-1 rounded-xl hover:bg-white hover:text-lousa"
        >
          <span className="sr-only">Notificações</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {totalNaoLidas > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full leading-tight">
              {totalNaoLidas}
            </span>
          )}
        </button>

        {/* ⚙️ Configurações */}
        <div className="relative" ref={configRef}>
          <button
            onClick={() => setConfigAberto(!configAberto)}
            className="flex items-center gap-1 px-3 py-1 text-sm rounded-xl border border-white hover:bg-white hover:text-lousa"
          >
            <UserCog className="w-4 h-4" /> <ChevronDown className="w-4 h-4" />
          </button>
          {configAberto && (
            <div className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-52">
              <button onClick={() => navigate("/perfil")} className="w-full text-left px-4 py-2 hover:underline flex items-center gap-2">
                <UserCog size={16} /> Atualizar Cadastro
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="w-full text-left px-4 py-2 hover:underline flex items-center gap-2">
                {darkMode ? <Sun size={16} /> : <Moon size={16} />} Modo {darkMode ? "Claro" : "Escuro"}
              </button>
              <button onClick={() => navigate("/ajuda")} className="w-full text-left px-4 py-2 hover:underline flex items-center gap-2">
                <HelpCircle size={16} /> Ajuda / FAQ
              </button>
              <button onClick={sair} className="w-full text-left px-4 py-2 text-red-600 hover:underline flex items-center gap-2">
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
