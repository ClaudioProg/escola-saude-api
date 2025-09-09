// 📁 src/components/Navbar.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  HelpCircle,
  Menu as MenuIcon,
  X as CloseIcon,
  Bell
} from "lucide-react";
import { apiGet } from "../services/api";

/* ────────────────────────────────────────────────────────────── */
/* Helpers de sessão / perfil                                     */
/* ────────────────────────────────────────────────────────────── */
function decodeJwtPayload(token) {
  try {
    const [, payloadB64Url] = String(token).split(".");
    if (!payloadB64Url) return null;
    let b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function getValidToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (payload?.exp && Date.now() >= payload.exp * 1000) {
    // ⚠️ não limpamos aqui para não causar efeitos colaterais;
    // apenas tratamos como "sem token" para a Navbar.
    return null;
  }
  return token;
}

/** 🔎 Perfis robusto: lê de 'perfil' e também de 'usuario.perfil/perfis' (string/array/CSV) */
function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach(p => out.add(String(p).toLowerCase()));
      else String(rawPerfil).split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    } catch {
      String(rawPerfil).split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach(p => out.add(String(p).toLowerCase()));
        else out.add(String(u.perfil).toLowerCase());
      }
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach(p => out.add(String(p).toLowerCase()));
        else String(u.perfis).split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    }
  } catch {}

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}

function getUsuarioLS() {
  try { return JSON.parse(localStorage.getItem("usuario") || "null"); } catch { return null; }
}
function getNomeUsuario()  { return getUsuarioLS()?.nome  || ""; }
function getEmailUsuario() { return getUsuarioLS()?.email || ""; }

/** 🅰️ Iniciais a partir do nome (ou e-mail) */
function getIniciais(nome, email) {
  const n = String(nome || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const e = String(email || "").trim();
  if (e) return (e.split("@")[0].slice(0, 2) || "?").toUpperCase();
  return "?";
}

/** Item de menu genérico */
function MenuList({ items, onSelect, activePath }) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-64 ring-1 ring-black/5"
    >
      {items.map(({ label, path, icon: Icon }) => {
        const active = activePath === path;
        return (
          <button
            key={label}
            role="menuitem"
            onClick={() => onSelect(path)}
            className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none ${
              active ? "font-semibold underline" : ""
            }`}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Componente principal                                           */
/* ────────────────────────────────────────────────────────────── */
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // ▶ sessão
  const [token, setToken] = useState(getValidToken());

  // ▶ perfil (robusto) + nome/e-mail
  const [perfil, setPerfil] = useState(() => getPerfisRobusto());
  const [nomeUsuario, setNomeUsuario] = useState(() => getNomeUsuario());
  const [emailUsuario, setEmailUsuario] = useState(() => getEmailUsuario());
  const iniciais = useMemo(() => getIniciais(nomeUsuario, emailUsuario), [nomeUsuario, emailUsuario]);

  // ▶ tema
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : document.documentElement.classList.contains("dark");
  });

  // ▶ visibilidades
  const [menuUsuarioOpen, setMenuUsuarioOpen] = useState(false);
  const [menuInstrutorOpen, setMenuInstrutorOpen] = useState(false);
  const [menuAdminOpen, setMenuAdminOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ▶ refs para fechar ao clicar fora
  const refUsuario = useRef(null);
  const refInstrutor = useRef(null);
  const refAdmin = useRef(null);
  const refConfig = useRef(null);
  const refMobile = useRef(null);

  // ▶ itens de menu
  const menusUsuario = useMemo(
    () => [
      { label: "Eventos", path: "/eventos", icon: CalendarDays },
      { label: "Meus Cursos", path: "/minhas-inscricoes", icon: BookOpen },
      { label: "Minhas Presenças", path: "/minhas-presencas", icon: ListChecks },
      { label: "Avaliações Pendentes", path: "/avaliacao", icon: PencilLine },
      { label: "Meus Certificados", path: "/certificados", icon: FileText },
      { label: "Escanear", path: "/scanner", icon: QrCode },
    ],
    []
  );

  const menusInstrutor = useMemo(
    () => [
      { label: "Painel", path: "/instrutor", icon: LayoutDashboard },
      { label: "Agenda", path: "/agenda-instrutor", icon: CalendarDays },
      { label: "QR do Site", path: "/qr-site", icon: QrCode },
    ],
    []
  );

  const menusAdmin = useMemo(
    () => [
      { label: "Painel Administrador", path: "/administrador", icon: LayoutDashboard },
      { label: "Agenda", path: "/agenda-administrador", icon: ListChecks },
      { label: "Certificados Avulsos", path: "/certificados-avulsos", icon: FileText },
      { label: "Dashboard Analítico", path: "/dashboard-analitico", icon: BarChart3 },
      { label: "QR Code Presença", path: "/admin/qr-codes", icon: QrCode },
      { label: "Relatórios", path: "/relatorios-customizados", icon: ClipboardList },
      { label: "Gestão de Usuários", path: "/gestao-usuarios", icon: Users },
      { label: "Gestão de Instrutor", path: "/gestao-instrutor", icon: Presentation },
      { label: "Gestão de Eventos", path: "/gerenciar-eventos", icon: CalendarDays },
      { label: "Gestão de Presença", path: "/gestao-presenca", icon: QrCode },
    ],
    []
  );

  // ▶ capacidades
  const isUsuario =
    perfil.includes("usuario") ||
    perfil.includes("instrutor") ||
    perfil.includes("administrador");
  const isInstrutor = perfil.includes("instrutor") || perfil.includes("administrador");
  const isAdmin = perfil.includes("administrador");

  // ▶ notificações
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  const atualizarContadorNotificacoes = useCallback(async () => {
    // só consulta com token válido e se a aba estiver visível
    if (!getValidToken() || document.hidden) return;
    try {
      const data = await apiGet("/notificacoes/nao-lidas/contagem", { on401: "silent" });
      setTotalNaoLidas(data?.totalNaoLidas ?? data?.total ?? 0);
    } catch {
      setTotalNaoLidas(0);
    }
  }, []);

  // carregar/atualizar notificações (pausado quando sem token)
  useEffect(() => {
    let intervalId;
    const tick = () => atualizarContadorNotificacoes();
    if (token) {
      tick();
      intervalId = setInterval(tick, 30000); // 30s para aliviar tráfego
    }
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibility);

    // expoe opcionalmente para chamadas manuais
    window.atualizarContadorNotificacoes = tick;
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.atualizarContadorNotificacoes;
    };
  }, [token, atualizarContadorNotificacoes]);

  // sincroniza token/perfil/nome por storage e ao trocar de rota
  useEffect(() => {
    const refreshFromLS = () => {
      setToken(getValidToken());
      setPerfil(getPerfisRobusto());
      setNomeUsuario(getNomeUsuario());
      setEmailUsuario(getEmailUsuario());
    };
    const onStorage = (e) => {
      if (["perfil", "usuario", "token"].includes(e.key)) {
        refreshFromLS();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    // fecha menus quando a rota muda e reavalia perfil/nome
    setMenuUsuarioOpen(false);
    setMenuInstrutorOpen(false);
    setMenuAdminOpen(false);
    setConfigOpen(false);
    setMobileOpen(false);
    setPerfil(getPerfisRobusto());
    setNomeUsuario(getNomeUsuario());
    setEmailUsuario(getEmailUsuario());
    setToken(getValidToken());
  }, [location.pathname]);

  // tema
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  // fechar ao clicar fora
  useEffect(() => {
    function onDown(ev) {
      const t = ev.target;
      const outsides = [
        [refUsuario, setMenuUsuarioOpen],
        [refInstrutor, setMenuInstrutorOpen],
        [refAdmin, setMenuAdminOpen],
        [refConfig, setConfigOpen],
        [refMobile, setMobileOpen],
      ];
      outsides.forEach(([r, set]) => { if (r.current && !r.current.contains(t)) set(false); });
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ESC fecha menus
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") {
        setMenuUsuarioOpen(false);
        setMenuInstrutorOpen(false);
        setMenuAdminOpen(false);
        setConfigOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  // sair
  const sair = () => {
    localStorage.clear();
    navigate("/login");
  };

  // navegar + fechar dropdowns
  const go = (path) => {
    navigate(path);
    setMenuUsuarioOpen(false);
    setMenuInstrutorOpen(false);
    setMenuAdminOpen(false);
    setConfigOpen(false);
    setMobileOpen(false);
  };

  // botão base dropdown
  const dropBtnBase =
    "flex items-center gap-2 px-2 py-1 text-sm rounded-xl hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none";

  // home inteligente: se logado -> dashboard, senão -> login
  const goHome = () => {
    const hasToken = !!getValidToken();
    go(hasToken ? "/dashboard" : "/");
  };

  return (
    <nav
      role="navigation"
      className="w-full bg-lousa text-white shadow-md px-3 sm:px-4 py-2 sticky top-0 z-50 border-b border-white/20"
    >
      <div className="flex items-center justify-between">
        {/* logo / home */}
        <button
          onClick={goHome}
          className="text-lg sm:text-xl font-bold tracking-tight select-none focus-visible:ring-2 focus-visible:ring-white/60 rounded px-1"
          aria-label="Ir para a página inicial"
        >
          Escola da Saúde
        </button>

        {/* ações à direita (desktop) */}
        <div className="hidden md:flex gap-2 items-center">
          {/* USUÁRIO */}
          {isUsuario && (
            <div className="relative" ref={refUsuario}>
              <button
                onClick={() => setMenuUsuarioOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuUsuarioOpen}
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" /> Usuário
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuUsuarioOpen && (
                <MenuList
                  items={menusUsuario}
                  activePath={location.pathname}
                  onSelect={go}
                />
              )}
            </div>
          )}

          {/* INSTRUTOR */}
          {isInstrutor && (
            <div className="relative" ref={refInstrutor}>
              <button
                onClick={() => setMenuInstrutorOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuInstrutorOpen}
              >
                <Presentation className="w-4 h-4" aria-hidden="true" /> Instrutor
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuInstrutorOpen && (
                <MenuList
                  items={menusInstrutor}
                  activePath={location.pathname}
                  onSelect={go}
                />
              )}
            </div>
          )}

          {/* ADMIN */}
          {isAdmin && (
            <div className="relative" ref={refAdmin}>
              <button
                onClick={() => setMenuAdminOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuAdminOpen}
              >
                <Shield className="w-4 h-4" aria-hidden="true" /> Administrador
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuAdminOpen && (
                <MenuList
                  items={menusAdmin}
                  activePath={location.pathname}
                  onSelect={go}
                />
              )}
            </div>
          )}

          {/* NOTIFICAÇÕES */}
          <button
            onClick={() => go("/notificacoes")}
            className="relative flex items-center justify-center px-3 py-1 rounded-xl hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
            aria-label={`Abrir notificações${totalNaoLidas ? `, ${totalNaoLidas} não lidas` : ""}`}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {totalNaoLidas > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full leading-tight">
                {totalNaoLidas}
              </span>
            )}
          </button>

          {/* CONFIGURAÇÕES + AVATAR */}
          <div className="relative" ref={refConfig}>
            <button
              onClick={() => setConfigOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 text-sm rounded-xl border border-white/70 hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
              aria-haspopup="menu"
              aria-expanded={configOpen}
              title={nomeUsuario ? `Logado como ${nomeUsuario}` : undefined}
            >
              {/* Avatar com iniciais */}
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white text-lousa font-bold text-xs shadow-sm"
                aria-label={nomeUsuario ? `Avatar de ${nomeUsuario}` : "Avatar"}
              >
                {iniciais}
              </span>
              <span className="max-w-[12rem] truncate">{nomeUsuario || "Conta"}</span>
              <UserCog className="w-4 h-4 opacity-90" aria-hidden="true" />
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {configOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-56 ring-1 ring-black/5"
              >
                <button
                  role="menuitem"
                  onClick={() => go("/perfil")}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <UserCog size={16} aria-hidden="true" /> Atualizar Cadastro
                </button>
                <button
                  role="menuitem"
                  onClick={() => setDarkMode((v) => !v)}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                  Modo {darkMode ? "Claro" : "Escuro"}
                </button>
                <button
                  role="menuitem"
                  onClick={() => go("/ajuda")}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <HelpCircle size={16} aria-hidden="true" /> Ajuda / FAQ
                </button>
                <button
                  role="menuitem"
                  onClick={sair}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 text-red-600 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <LogOut size={16} aria-hidden="true" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* hambúrguer (mobile) */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {/* menu deslizante mobile */}
      {mobileOpen && (
        <div
          ref={refMobile}
          className="md:hidden mt-2 rounded-xl bg-white text-lousa shadow-xl ring-1 ring-black/5 overflow-hidden"
        >
          <div className="p-2 grid gap-1">
            {/* Cabeçalho com avatar (mobile) */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-lousa text-white font-bold text-xs">
                {iniciais}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{nomeUsuario || "Conta"}</div>
                {emailUsuario && <div className="text-xs text-gray-600 truncate">{emailUsuario}</div>}
              </div>
            </div>
            <hr className="my-1" />

            {/* blocos por perfil */}
            {isUsuario && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">Usuário</div>
                {menusUsuario.map((m) => (
                  <button
                    key={m.path}
                    onClick={() => go(m.path)}
                    className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                      location.pathname === m.path ? "font-semibold underline" : ""
                    }`}
                  >
                    <m.icon size={16} /> {m.label}
                  </button>
                ))}
                <hr className="my-1" />
              </>
            )}

            {isInstrutor && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">Instrutor</div>
                {menusInstrutor.map((m) => (
                  <button
                    key={m.path}
                    onClick={() => go(m.path)}
                    className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                      location.pathname === m.path ? "font-semibold underline" : ""
                    }`}
                  >
                    <m.icon size={16} /> {m.label}
                  </button>
                ))}
                <hr className="my-1" />
              </>
            )}

            {isAdmin && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">Administrador</div>
                {menusAdmin.map((m) => (
                  <button
                    key={m.path}
                    onClick={() => go(m.path)}
                    className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                      location.pathname === m.path ? "font-semibold underline" : ""
                    }`}
                  >
                    <m.icon size={16} /> {m.label}
                  </button>
                ))}
                <hr className="my-1" />
              </>
            )}

            {/* utilidades */}
            <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">Geral</div>
            <button
              onClick={() => go("/notificacoes")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <Bell size={16} />
              Notificações
              {totalNaoLidas > 0 && (
                <span className="ml-auto inline-flex items-center justify-center px-2 rounded-full text-[10px] font-bold bg-red-600 text-white">
                  {totalNaoLidas}
                </span>
              )}
            </button>
            <button
              onClick={() => go("/perfil")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <UserCog size={16} /> Atualizar Cadastro
            </button>
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />} Modo {darkMode ? "Claro" : "Escuro"}
            </button>
            <button
              onClick={() => go("/ajuda")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <HelpCircle size={16} /> Ajuda / FAQ
            </button>
            <button
              onClick={sair}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 text-red-600 hover:bg-gelo"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
