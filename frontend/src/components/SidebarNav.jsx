// ✅ src/components/SidebarNav.jsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  X,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  FileText,
  QrCode,
  ClipboardList,
  ListChecks,
  PencilLine,
  Presentation,
  FolderOpenDot,
  History,
  School,
  BarChart3,
  Users,
  Shield,
  PlusCircle,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

import useEscolaTheme from "../hooks/useEscolaTheme";
import { ESCOLA_THEME_KEY } from "../theme/escolaTheme";

/* =========================
   Perfis (robusto)
========================= */
function normPerfilStr(p) {
  return String(p ?? "")
    .replace(/[\[\]"]/g, "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
function getPerfisRobusto() {
  const out = new Set();

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

/* =========================
   UI pequenos (compact)
========================= */
function IconTile({ active, isDark, Icon }) {
  return (
    <span
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition", // ✅ menor
        active
          ? "border-white/15 bg-white/10"
          : isDark
          ? "border-white/10 bg-zinc-900/20 group-hover:bg-white/5"
          : "border-slate-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] group-hover:bg-emerald-50/80 group-hover:border-emerald-200/60",
      ].join(" ")}
      aria-hidden="true"
    >
      {Icon ? (
        <Icon
          className={[
            "h-[18px] w-[18px] transition", // ✅ menor
            active ? "text-white" : isDark ? "text-zinc-200" : "text-slate-700 group-hover:text-emerald-700",
          ].join(" ")}
        />
      ) : null}
    </span>
  );
}

function MenuItem({ active, isDark, collapsed, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left group relative flex items-center rounded-xl px-3 py-1.5", // ✅ compacto
        "gap-2 text-[13px] font-extrabold transition", // ✅ compacto
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
        active
          ? "text-white bg-emerald-600 shadow-sm shadow-emerald-900/15"
          : isDark
          ? "text-zinc-200 hover:bg-white/5"
          : "text-slate-900 hover:bg-emerald-50/70 hover:shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        collapsed ? "justify-center px-2" : "",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full transition", // ✅ compacto
          active ? "bg-white/85 shadow-[0_0_18px_rgba(255,255,255,.35)]" : "bg-transparent",
        ].join(" ")}
      />

      <IconTile active={active} isDark={isDark} Icon={Icon} />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && <span className="ml-auto h-2 w-2 rounded-full bg-white/85" aria-hidden="true" />}
    </button>
  );
}

function ThemeStackButton({ active, onClick, icon: Icon, label, isDark, collapsed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={[
        "w-full inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-extrabold transition", // ✅ compacto
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
        active
          ? "bg-emerald-600 text-white"
          : isDark
          ? "text-zinc-200 hover:bg-white/10"
          : "text-slate-800 hover:bg-slate-100",
        collapsed ? "justify-center px-2" : "",
      ].join(" ")}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

/* =========================
   SidebarNav (premium + theme + collapse)
========================= */
const SIDEBAR_COLLAPSED_KEY = "escola_sidebar_collapsed"; // "1" | "0"

export default function SidebarNav({
  variant = "desktop", // desktop | mobile
  onClose,
  collapsed: collapsedProp,
  onCollapsedChange,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = variant === "mobile";

  const { theme, setTheme, isDark } = useEscolaTheme();

  const [perfis, setPerfis] = useState(() => getPerfisRobusto());
  const [q, setQ] = useState("");

  const [collapsedState, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const collapsed = typeof collapsedProp === "boolean" ? collapsedProp : collapsedState;

  const setCollapsed = useCallback(
    (next) => {
      const v = !!next;
      if (typeof collapsedProp !== "boolean") setCollapsedState(v);
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "1" : "0");
      } catch {}
      onCollapsedChange?.(v);
    },
    [collapsedProp, onCollapsedChange]
  );

  // storage sync (login/logout + collapse + theme entre abas)
  useEffect(() => {
    const onStorage = (e) => {
      if (["perfil", "usuario", "token"].includes(e.key)) setPerfis(getPerfisRobusto());

      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        const v = e.newValue === "1";
        if (typeof collapsedProp !== "boolean") setCollapsedState(v);
        onCollapsedChange?.(v);
      }

      if (e.key === ESCOLA_THEME_KEY) {
        const saved = e.newValue;
        if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [collapsedProp, onCollapsedChange, setTheme]);

  const isUsuario =
    perfis.includes("usuario") || perfis.includes("instrutor") || perfis.includes("administrador");
  const isInstrutor = perfis.includes("instrutor") || perfis.includes("administrador");
  const isAdmin = perfis.includes("administrador");

  // ✅ Menus COMPLETOS
  const menusUsuario = useMemo(
    () => [
      { label: "Painel do Usuário", path: "/usuario/dashboard", icon: LayoutDashboard },
      { label: "Eventos", path: "/eventos", icon: CalendarDays },
      { label: "Meus Cursos", path: "/minhas-inscricoes", icon: BookOpen },
      { label: "Agenda", path: "/agenda", icon: CalendarDays },
      { label: "Minhas Presenças", path: "/minhas-presencas", icon: ListChecks },
      { label: "Avaliações Pendentes", path: "/avaliacao", icon: PencilLine },
      { label: "Meus Certificados", path: "/certificados", icon: FileText },
      { label: "Agendamento de Sala", path: "/agenda-salas", icon: CalendarDays },
      { label: "Solicitar Curso", path: "/solicitar-curso", icon: Presentation },
      { label: "Submissão de Trabalhos", path: "/submissoes", icon: Presentation },
      { label: "Repositório de Trabalhos", path: "/repositorio-trabalhos", icon: FolderOpenDot },
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

  const menusAdmin = useMemo(
    () => [
      { label: "Painel do Administrador", path: "/administrador", icon: LayoutDashboard },
      { label: "Dashboard Analítico", path: "/dashboard-analitico", icon: BarChart3 },
      { label: "Agenda", path: "/agenda-administrador", icon: ListChecks },
      { label: "Agenda de Salas", path: "/admin/agenda-salas", icon: CalendarDays },
      { label: "Solicitações de Curso", path: "/admin/solicitacoes-curso", icon: School },
      { label: "Certificados Avulsos", path: "/certificados-avulsos", icon: FileText },
      { label: "Gestão de Usuários", path: "/gestao-usuarios", icon: Users },
      { label: "Gestão de Instrutor", path: "/gestao-instrutor", icon: Presentation },
      { label: "Gestão de Eventos", path: "/gerenciar-eventos", icon: CalendarDays },
      { label: "Gestão de Presença", path: "/gestao-presenca", icon: QrCode },
      { label: "Gestão de Avaliações", path: "/admin/avaliacoes", icon: ClipboardList },
      { label: "Gestão de Certificados", path: "/gestao-certificados", icon: History },
      { label: "Relatórios Customizados", path: "/relatorios-customizados", icon: ClipboardList },
      { label: "Criar Submissão de Trabalho", path: "/admin/chamadas/new", icon: PlusCircle },
      { label: "Gerenciar Submissões", path: "__open_submissions__", icon: FolderOpenDot },
      { label: "Admin", path: "/admin", icon: Shield },
    ],
    []
  );

  const sectionsRaw = useMemo(() => {
    const secs = [];
    if (isUsuario) secs.push({ title: "Usuário", items: menusUsuario });
    if (isInstrutor) secs.push({ title: "Instrutor", items: menusInstrutor });
    if (isAdmin) secs.push({ title: "Administrador", items: menusAdmin });
    return secs;
  }, [isUsuario, isInstrutor, isAdmin, menusUsuario, menusInstrutor, menusAdmin]);

  // Busca
  const sections = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return sectionsRaw;

    return sectionsRaw
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => String(it.label).toLowerCase().includes(term)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sectionsRaw, q]);

  const go = (path) => {
    if (path === "__open_submissions__") {
      navigate("/admin/submissoes");
      onClose?.();
      return;
    }
    navigate(path);
    onClose?.();
  };

  const shellCls = isDark
    ? "border-white/10 bg-zinc-900/45"
    : "border-slate-200 bg-white shadow-sm ring-1 ring-black/5 shadow-[0_10px_35px_rgba(2,6,23,0.06)]";

  const themeCollapsed = collapsed && !isMobile;

  return (
    <nav
      className={[
        "rounded-3xl border overflow-hidden",
        shellCls,
        isMobile ? "h-full" : "sticky top-24",
        themeCollapsed ? "w-[92px]" : "",
        isMobile ? "flex flex-col" : "", // ✅ ajuda scroll interno
      ].join(" ")}
      aria-label="Menu principal"
    >
      {/* cap + header */}
      <div className="p-3">
        <div
          aria-hidden="true"
          className={[
            "h-1.5 w-full rounded-full mb-2.5 bg-gradient-to-r", // ✅ compacto
            isDark
              ? "from-emerald-400/30 via-sky-400/20 to-violet-400/10"
              : "from-emerald-500/40 via-sky-500/25 to-violet-500/15",
          ].join(" ")}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold">{themeCollapsed ? "Menu" : "Navegação"}</div>

          {!isMobile ? (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className={[
                "inline-flex items-center justify-center rounded-2xl p-2 border transition",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100 text-slate-700",
              ].join(" ")}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onClose?.()}
              className={[
                "rounded-2xl p-2.5 border transition",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100",
              ].join(" ")}
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ✅ Tema VERTICAL */}
        <div
          className={[
            "mt-2.5 rounded-2xl border p-2", // ✅ compacto
            isDark ? "border-white/10 bg-zinc-950/30" : "border-slate-200 bg-slate-50",
          ].join(" ")}
        >
          <div className="flex flex-col gap-1">
            <ThemeStackButton
              active={theme === "light"}
              onClick={() => setTheme("light")}
              icon={Sun}
              label="Claro"
              isDark={isDark}
              collapsed={themeCollapsed}
            />
            <ThemeStackButton
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={Moon}
              label="Escuro"
              isDark={isDark}
              collapsed={themeCollapsed}
            />
            <ThemeStackButton
              active={theme === "system"}
              onClick={() => setTheme("system")}
              icon={Monitor}
              label="Sistema"
              isDark={isDark}
              collapsed={themeCollapsed}
            />
          </div>
        </div>

        {/* Busca (esconde no colapsado desktop) */}
        {!themeCollapsed && (
          <div className="mt-2.5">
            <label className="sr-only" htmlFor={`sidebar-search-${variant}`}>
              Buscar no menu
            </label>
            <input
              id={`sidebar-search-${variant}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className={[
                "w-full rounded-2xl border px-3 py-2 text-sm font-semibold outline-none",
                "focus:ring-2 focus:ring-emerald-500/60",
                isDark
                  ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-400"
                  : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-500",
              ].join(" ")}
            />
            {q?.trim() && (
              <div className={["mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                Filtrando por: <span className="font-extrabold">{q.trim()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ LISTA rolável no MOBILE */}
      <div
        className={[
          "px-3 pb-3",
          "space-y-3", // ✅ compacto
          isMobile ? "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2" : "", // ✅ scroll interno
          isMobile ? "max-h-[calc(100dvh-220px)]" : "", // ✅ fallback seguro
        ].join(" ")}
        style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
      >
        {sections.length === 0 ? (
          <div className={["px-2 pb-2 text-sm", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
            Nenhum menu disponível para este perfil.
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.title}>
              <div
                className={[
                  "px-2 pb-1.5 text-[11px] font-extrabold uppercase tracking-wide", // ✅ compacto
                  isDark ? "text-zinc-400" : "text-slate-500",
                  themeCollapsed ? "text-center" : "",
                ].join(" ")}
              >
                {themeCollapsed ? sec.title.slice(0, 3) : sec.title}
              </div>

              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const active =
                    location.pathname === item.path ||
                    (item.path !== "__open_submissions__" && location.pathname.startsWith(item.path + "/"));

                  return (
                    <MenuItem
                      key={`${sec.title}-${item.label}-${item.path}`}
                      active={active}
                      isDark={isDark}
                      collapsed={themeCollapsed}
                      icon={item.icon}
                      label={item.label}
                      onClick={() => go(item.path)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </nav>
  );
}
