// 📁 src/components/Navbar.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useId,
} from "react";
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
  Bell,
  XCircle,
  PlusCircle,
  FolderOpenDot,
  History,
} from "lucide-react";
import { apiGet } from "../services/api";

/* ────────────────────────────────────────────────────────────── */
/* 🎨 Tema sazonal do NAVBAR (jul–dez)                            */
/* ────────────────────────────────────────────────────────────── */
function getNavThemeForMonth(month /* 1-12 */) {
  const themes = {
    7:  "bg-yellow-600",
    8:  "bg-amber-600",
    9:  "bg-gradient-to-r from-yellow-600 to-emerald-800",
    10: "bg-pink-700",
    11: "bg-gradient-to-r from-blue-700 to-purple-700",
    12: "bg-red-700",
  };
  return themes[month] || null;
}

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
  } catch { return null; }
}
function getValidToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (payload?.exp && Date.now() >= payload.exp * 1000) return null;
  return token;
}
function normPerfilStr(p) {
  return String(p ?? "")
    .replace(/[\[\]"]/g, "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
function getPerfisRobusto() {
  const out = new Set();

  // LS: "perfil"
  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach((p) => out.add(String(p).toLowerCase()));
      else normPerfilStr(rawPerfil).forEach((p) => out.add(p));
    } catch {
      normPerfilStr(rawPerfil).forEach((p) => out.add(p));
    }
  }

  // LS: "usuario"
  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach((p) => out.add(String(p).toLowerCase()));
        else out.add(String(u.perfil).toLowerCase());
      }
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach((p) => out.add(String(p).toLowerCase()));
        else normPerfilStr(u.perfis).forEach((p) => out.add(p));
      }
    }
  } catch {}

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}
function getUsuarioLS() { try { return JSON.parse(localStorage.getItem("usuario") || "null"); } catch { return null; } }
function getNomeUsuario() { return getUsuarioLS()?.nome || ""; }
function getEmailUsuario() { return getUsuarioLS()?.email || ""; }
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

/* Scroll lock robusto para o menu mobile */
let _restoreScrollTop = 0;
function lockScroll() {
  const body = document.body;
  if (!body) return;
  _restoreScrollTop = window.scrollY || window.pageYOffset || 0;
  body.style.position = "fixed";
  body.style.top = `-${_restoreScrollTop}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.classList.add("overflow-hidden", "no-scroll", "modal-open");
}
function unlockScroll() {
  const html = document.documentElement;
  const body = document.body;
  [html, body].forEach((el) => {
    if (!el) return;
    el.style.overflow = "";
    el.style.touchAction = "";
    el.classList.remove("overflow-hidden", "no-scroll", "modal-open");
  });
  if (body && body.style.position === "fixed") {
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    try { window.scrollTo({ top: _restoreScrollTop, behavior: "instant" }); } catch { window.scrollTo(0, _restoreScrollTop); }
  }
}

/** Item de menu simples (lista plana) */
function MenuList({ items, onSelect, activePath, id }) {
  return (
    <div
      id={id}
      role="menu"
      className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-72 ring-1 ring-black/5 z-50"
    >
      {items.map(({ label, path, icon: Icon }) => {
        const active = activePath === path;
        return (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => onSelect(path)}
            aria-current={active ? "page" : undefined}
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

  const [token, setToken] = useState(getValidToken());
  const [perfil, setPerfil] = useState(() => getPerfisRobusto());
  const [nomeUsuario, setNomeUsuario] = useState(() => getNomeUsuario());
  const [emailUsuario, setEmailUsuario] = useState(() => getEmailUsuario());
  const iniciais = useMemo(() => getIniciais(nomeUsuario, emailUsuario), [nomeUsuario, emailUsuario]);

  /* Tema: respeita preferência salva; na ausência, usa sistema/DOM */
  const [darkMode, setDarkMode] = useState(() => {
    const t = localStorage.getItem("theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return (
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ||
      document.documentElement.classList.contains("dark")
    );
  });

  /* Sincroniza DOM + persiste quando o usuário alterna */
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    } else {
      root.classList.remove("dark");
      try { localStorage.setItem("theme", "light"); } catch {}
    }
  }, [darkMode]);

  /* Respeita mudança do sistema apenas se NÃO houver escolha salva do usuário */
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = (e) => {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return; // usuário já decidiu
      setDarkMode(e.matches);
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const [menuUsuarioOpen, setMenuUsuarioOpen] = useState(false);
  const [menuInstrutorOpen, setMenuInstrutorOpen] = useState(false);
  const [menuAdminOpen, setMenuAdminOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refUsuario = useRef(null);
  const refInstrutor = useRef(null);
  const refAdmin = useRef(null);
  const refConfig = useRef(null);
  const refMobile = useRef(null);

  const usuarioMenuId = useId();
  const instrutorMenuId = useId();
  const adminMenuId = useId();
  const configMenuId = useId();

  const menusUsuario = useMemo(
    () => [
      { label: "Painel do Usuário", path: "/usuario/dashboard", icon: LayoutDashboard },
      { label: "Eventos", path: "/eventos", icon: CalendarDays },
      { label: "Meus Cursos", path: "/minhas-inscricoes", icon: BookOpen },
      { label: "Agenda", path: "/agenda", icon: CalendarDays },
      { label: "Minhas Presenças", path: "/minhas-presencas", icon: ListChecks },
      { label: "Teste do Curso", path: "/teste", icon: ClipboardList },
      { label: "Avaliações Pendentes", path: "/avaliacao", icon: PencilLine },
      { label: "Meus Certificados", path: "/certificados", icon: FileText },
      { label: "Agendamento de Sala", path: "/agendamento-sala", icon: CalendarDays },
      { label: "Solicitar Curso", path: "/solicitar-curso", icon: Presentation },
      { label: "Submissão de Trabalhos", path: "/submissoes", icon: Presentation },
      { label: "Manual do Usuário", path: "/usuario/manual", icon: BookOpen },
      { label: "Escanear", path: "/scanner", icon: QrCode },
    ],
    []
  );

  const menusInstrutor = useMemo(
    () => [
      { label: "Painel do Instrutor", path: "/instrutor", icon: LayoutDashboard },
      { label: "Agenda", path: "/agenda-instrutor", icon: CalendarDays },
      { label: "Presença", path: "/instrutor/presenca", icon: QrCode },
      { label: "Certificados", path: "/instrutor/certificados", icon: FileText },
      { label: "Avaliação", path: "/instrutor/avaliacao", icon: PencilLine },
      { label: "Avaliar Trabalhos Atribuídos", path: "/avaliador/submissoes", icon: FolderOpenDot },
    ],
    []
  );

  // ADMIN — lista plana (sem submenus)
  const menusAdmin = useMemo(
    () => [
      // “soltos”
      { label: "Painel Administrador",  path: "/dashboard-analitico",    icon: BarChart3 },
      { label: "Visão Geral",           path: "/administrador",          icon: LayoutDashboard },
      { label: "Agenda",                path: "/agenda-administrador",   icon: ListChecks },
      { label: "Certificados Avulsos",  path: "/certificados-avulsos",   icon: FileText },
      { label: "QR Code Presença",      path: "/admin/qr-codes",         icon: QrCode },
      // relatórios
      { label: "Relatórios Customizados", path: "/relatorios-customizados", icon: ClipboardList },
      // trabalhos
      { label: "Criar Submissão de Trabalho", path: "/admin/chamadas/new", icon: PlusCircle },
      { label: "Gerenciar Submissão de Trabalho", path: "__open_submissions__", icon: FolderOpenDot },
      // gestão
      { label: "Gestão de Usuários",    path: "/gestao-usuarios",        icon: Users },
      { label: "Gestão de Instrutor",   path: "/gestao-instrutor",       icon: Presentation },
      { label: "Gestão de Eventos",     path: "/gerenciar-eventos",      icon: CalendarDays },
      { label: "Gestão de Inscrições",  path: "/admin/cancelar-inscricoes", icon: XCircle },
      { label: "Gestão de Presença",    path: "/gestao-presenca",        icon: QrCode },
      { label: "Gestão de Certificados", path: "/gestao-certificados",   icon: History },
    ],
    []
  );

  // capacidades
  const isUsuario =
    perfil.includes("usuario") ||
    perfil.includes("instrutor") ||
    perfil.includes("administrador");
  const isInstrutor = perfil.includes("instrutor") || perfil.includes("administrador");
  const isAdmin = perfil.includes("administrador");

  // notificações
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const atualizarContadorNotificacoes = useCallback(async () => {
    if (!getValidToken() || document.hidden) return;
    try {
      const data = await apiGet("/api/notificacoes/nao-lidas/contagem", { on401: "silent", on403: "silent" });
      setTotalNaoLidas(data?.totalNaoLidas ?? data?.total ?? 0);
    } catch { setTotalNaoLidas(0); }
  }, []);
  useEffect(() => {
    let intervalId;
    const tick = () => atualizarContadorNotificacoes();
    if (token) { tick(); intervalId = setInterval(tick, 30000); }
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.atualizarContadorNotificacoes = tick;
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.atualizarContadorNotificacoes;
    };
  }, [token, atualizarContadorNotificacoes]);

  /* Reage a mudanças no LS (login/logout/perfis/tema) */
  useEffect(() => {
    const refreshFromLS = () => {
      setToken(getValidToken());
      setPerfil(getPerfisRobusto());
      setNomeUsuario(getNomeUsuario());
      setEmailUsuario(getEmailUsuario());
    };
    const onStorage = (e) => {
      if (["perfil", "usuario", "token"].includes(e.key)) refreshFromLS();
      if (e.key === "theme") setDarkMode(e.newValue === "dark");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* Fecha tudo ao trocar de rota */
  useEffect(() => {
    setMenuUsuarioOpen(false);
    setMenuInstrutorOpen(false);
    setMenuAdminOpen(false);
    setConfigOpen(false);
    setMobileOpen(false);
    unlockScroll();
    setPerfil(getPerfisRobusto());
    setNomeUsuario(getNomeUsuario());
    setEmailUsuario(getEmailUsuario());
    setToken(getValidToken());
  }, [location.pathname]);

  const toggleTheme = () => setDarkMode((v) => !v);

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
      let fechouAlgo = false;
      outsides.forEach(([r, set]) => {
        if (r.current && !r.current.contains(t)) {
          set(false);
          fechouAlgo = true;
        }
      });
      if (fechouAlgo) unlockScroll();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") {
        setMenuUsuarioOpen(false);
        setMenuInstrutorOpen(false);
        setMenuAdminOpen(false);
        setConfigOpen(false);
        setMobileOpen(false);
        unlockScroll();
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  /* foca primeiro item do drawer ao abrir */
  useEffect(() => {
    if (mobileOpen) {
      lockScroll();
      // tenta focar primeiro botão do menu
      requestAnimationFrame(() => {
        const firstBtn = refMobile.current?.querySelector("button");
        firstBtn?.focus();
      });
    }
  }, [mobileOpen]);

  // ❗️Logout preservando TEMA (não apagar 'theme')
  const sair = () => {
    const theme = localStorage.getItem("theme"); // preserve
    // Remova apenas chaves de sessão — NUNCA use localStorage.clear()
    [
      "token",
      "refresh_token",
      "perfil",
      "usuario",
      // adicione outras chaves de sessão aqui…
    ].forEach((k) => localStorage.removeItem(k));
    if (theme) localStorage.setItem("theme", theme);
    unlockScroll();
    navigate("/login");
  };

  // ação especial do item “Abrir Submissões…”
  const handleAdminSelect = (path) => {
    if (path === "__open_submissions__" || path === "__open_submissions_prompt__") {
      navigate("/admin/submissoes"); // sempre abre TODAS as submissões
    } else {
      navigate(path);
    }
    setMenuUsuarioOpen(false);
    setMenuInstrutorOpen(false);
    setMenuAdminOpen(false);
    setConfigOpen(false);
    setMobileOpen(false);
    unlockScroll();
  };

  const go = (path) => handleAdminSelect(path); // reusa o mesmo close/unlock

  const dropBtnBase =
  "flex h-10 items-center gap-2 px-3 text-sm rounded-xl hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none";

  const goHome = () => { go("/"); };

  const now = new Date();
  const month = now.getMonth() + 1;
  const navBgSeasonal = getNavThemeForMonth(month);
  const navBg = navBgSeasonal || "bg-lousa";

  return (
    <nav
      role="navigation"
      className={`w-full ${navBg} text-white shadow-md px-3 sm:px-4 py-2.5 sticky top-0 z-50 border-b border-white/20 pt-[env(safe-area-inset-top)]`}
    >
      {/* Skip-link: acessa o main#conteudo se existir */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 bg-white text-lousa px-3 py-2 rounded-md shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="flex items-center justify-between min-h-[48px]">
        {/* logo / home */}
        <button
          type="button"
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
                type="button"
                onClick={() => setMenuUsuarioOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuUsuarioOpen}
                aria-controls={usuarioMenuId}
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" /> Usuário
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuUsuarioOpen && (
                <MenuList
                  id={usuarioMenuId}
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
                type="button"
                onClick={() => setMenuInstrutorOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuInstrutorOpen}
                aria-controls={instrutorMenuId}
              >
                <Presentation className="w-4 h-4" aria-hidden="true" /> Instrutor
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuInstrutorOpen && (
                <MenuList
                  id={instrutorMenuId}
                  items={menusInstrutor}
                  activePath={location.pathname}
                  onSelect={go}
                />
              )}
            </div>
          )}

          {/* ADMIN — lista plana, sem submenus */}
          {isAdmin && (
            <div className="relative" ref={refAdmin}>
              <button
                type="button"
                onClick={() => setMenuAdminOpen((v) => !v)}
                className={dropBtnBase}
                aria-haspopup="menu"
                aria-expanded={menuAdminOpen}
                aria-controls={adminMenuId}
              >
                <Shield className="w-4 h-4" aria-hidden="true" /> Administrador
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {menuAdminOpen && (
                <MenuList
                  id={adminMenuId}
                  items={menusAdmin}
                  activePath={location.pathname}
                  onSelect={handleAdminSelect}
                />
              )}
            </div>
          )}

          {/* NOTIFICAÇÕES */}
          <div aria-live="polite" className="sr-only">
            {totalNaoLidas > 0 ? `${totalNaoLidas} notificações não lidas` : ""}
          </div>
          <button
            type="button"
            onClick={() => go("/notificacoes")}
            className="relative flex h-10 items-center justify-center px-3 rounded-xl hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
            aria-label={`Abrir notificações${totalNaoLidas ? `, ${totalNaoLidas} não lidas` : ""}`}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {totalNaoLidas > 0 && (
              <>
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full leading-tight">
                  {totalNaoLidas}
                </span>
                <span className="sr-only">{totalNaoLidas} notificações não lidas</span>
              </>
            )}
          </button>

          {/* CONFIGURAÇÕES + AVATAR */}
          <div className="relative" ref={refConfig}>
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              className="flex h-10 items-center gap-2 px-3 text-sm rounded-xl border border-white/70 hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
              aria-haspopup="menu"
              aria-expanded={configOpen}
              aria-controls={configMenuId}
              title={nomeUsuario ? `Logado como ${nomeUsuario}` : undefined}
            >
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
                id={configMenuId}
                role="menu"
                className="absolute right-0 top-full mt-2 bg-white text-lousa rounded-xl shadow-xl py-2 w-56 ring-1 ring-black/5 z-50"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("/perfil")}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <UserCog size={16} aria-hidden="true" /> Atualizar Cadastro
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("/qr-site")}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <QrCode size={16} aria-hidden="true" /> QR do Site
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={toggleTheme}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                  Modo {darkMode ? "Claro" : "Escuro"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("/ajuda")}
                  className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gelo focus:bg-gelo outline-none"
                >
                  <HelpCircle size={16} aria-hidden="true" /> Ajuda / FAQ
                </button>
                <button
                  type="button"
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
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 hover:bg-white hover:text-lousa focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          aria-controls="navbar-mobile-menu"
        >
          {mobileOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {/* menu deslizante mobile */}
      {mobileOpen && (
        <div
          id="navbar-mobile-menu"
          ref={refMobile}
          className="md:hidden mt-2 rounded-xl bg-white text-lousa shadow-xl ring-1 ring-black/5 max-h-[70vh] overflow-auto"
        >
          <div className="p-2 grid gap-1">
            {/* Cabeçalho com avatar (mobile) */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-lousa text-white font-bold text-xs">
                {iniciais}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {nomeUsuario || "Conta"}
                </div>
                {emailUsuario && (
                  <div className="text-xs text-gray-600 truncate">{emailUsuario}</div>
                )}
              </div>
            </div>
            <hr className="my-1" />

            {isUsuario && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">
                  Usuário
                </div>
                {menusUsuario.map((m) => {
                  const active = location.pathname === m.path;
                  return (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => go(m.path)}
                      aria-current={active ? "page" : undefined}
                      className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                        active ? "font-semibold underline" : ""
                      }`}
                    >
                      <m.icon size={16} /> {m.label}
                    </button>
                  );
                })}
                <hr className="my-1" />
              </>
            )}

            {isInstrutor && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">
                  Instrutor
                </div>
                {menusInstrutor.map((m) => {
                  const active = location.pathname === m.path;
                  return (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => go(m.path)}
                      aria-current={active ? "page" : undefined}
                      className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                        active ? "font-semibold underline" : ""
                      }`}
                    >
                      <m.icon size={16} /> {m.label}
                    </button>
                  );
                })}
                <hr className="my-1" />
              </>
            )}

            {isAdmin && (
              <>
                <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">
                  Administrador
                </div>

                {menusAdmin.map((m) => {
                  const active = location.pathname === m.path;
                  const onClick = () => handleAdminSelect(m.path);
                  return (
                    <button
                      key={m.label}
                      type="button"
                      onClick={onClick}
                      aria-current={active ? "page" : undefined}
                      className={`text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo ${
                        active ? "font-semibold underline" : ""
                      }`}
                    >
                      <m.icon size={16} /> {m.label}
                    </button>
                  );
                })}

                <hr className="my-1" />
              </>
            )}

            {/* utilidades */}
            <div className="px-2 pt-2 pb-1 text-xs font-semibold uppercase text-gray-500">
              Geral
            </div>
            <button
              type="button"
              onClick={() => go("/qr-site")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <QrCode size={16} /> QR do Site
            </button>
            <button
              type="button"
              onClick={() => go("/notificacoes")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
              aria-label={`Abrir notificações${totalNaoLidas ? `, ${totalNaoLidas} não lidas` : ""}`}
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
              type="button"
              onClick={() => go("/perfil")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <UserCog size={16} /> Atualizar Cadastro
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />} Modo {darkMode ? "Claro" : "Escuro"}
            </button>
            <button
              type="button"
              onClick={() => go("/ajuda")}
              className="text-left w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gelo"
            >
              <HelpCircle size={16} /> Ajuda / FAQ
            </button>
            <button
              type="button"
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
