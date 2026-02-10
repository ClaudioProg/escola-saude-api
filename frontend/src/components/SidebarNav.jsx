// ✅ src/components/SidebarNav.jsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  PlusCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

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

function pushAll(set, val) {
  if (!val) return;
  if (Array.isArray(val)) val.forEach((p) => set.add(String(p).toLowerCase()));
  else normPerfilStr(val).forEach((p) => set.add(p));
}

function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      pushAll(out, parsed);
    } catch {
      pushAll(out, rawPerfil);
    }
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      pushAll(out, u?.perfil);
      pushAll(out, u?.perfis);
      pushAll(out, u?.roles); // ✅ extra robustez
    }
  } catch {}

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}

/* =========================
   Helpers
========================= */
function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function isActivePath(currentPath, itemPath) {
  if (!itemPath) return false;
  if (itemPath === "__open_submissions__") return currentPath.startsWith("/admin/submissao");

  // match exato
  if (currentPath === itemPath) return true;

  // prefixo seguro: "/x" casa com "/x/..."
  if (itemPath !== "/" && currentPath.startsWith(itemPath + "/")) return true;

  return false;
}

/* =========================
   UI pequenos (compact)
========================= */
function IconTile({ active, isDark, Icon }) {
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition",
        active
          ? "border-white/15 bg-white/10"
          : isDark
          ? "border-white/10 bg-zinc-900/20 group-hover:bg-white/5"
          : "border-slate-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] group-hover:bg-emerald-50/80 group-hover:border-emerald-200/60"
      )}
      aria-hidden="true"
    >
      {Icon ? (
        <Icon
          className={cx(
            "h-[18px] w-[18px] transition",
            active ? "text-white" : isDark ? "text-zinc-200" : "text-slate-700 group-hover:text-emerald-700"
          )}
        />
      ) : null}
    </span>
  );
}

function MenuItem({ active, isDark, collapsed, icon: Icon, label, onClick, tabIndex, onKeyDown }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      className={cx(
        "w-full text-left group relative flex items-center rounded-xl px-3 py-1.5",
        "gap-2 text-[13px] font-extrabold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
        active
          ? "text-white bg-emerald-600 shadow-sm shadow-emerald-900/15"
          : isDark
          ? "text-zinc-200 hover:bg-white/5"
          : "text-slate-900 hover:bg-emerald-50/70 hover:shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        collapsed ? "justify-center px-2" : ""
      )}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full transition",
          active ? "bg-white/85 shadow-[0_0_18px_rgba(255,255,255,.35)]" : "bg-transparent"
        )}
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
      className={cx(
        "w-full inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-extrabold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
        active
          ? "bg-emerald-600 text-white"
          : isDark
          ? "text-zinc-200 hover:bg-white/10"
          : "text-slate-800 hover:bg-slate-100",
        collapsed ? "justify-center px-2" : ""
      )}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && <Check className="ml-auto w-4 h-4" aria-hidden="true" />}
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

  const isDark = document.documentElement.classList.contains("dark");

  const [perfis, setPerfis] = useState(() => getPerfisRobusto());

  // ✅ Accordion: só 1 seção aberta por vez
  const [openSection, setOpenSection] = useState(null);
  const isSearching = false;

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

    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [collapsedProp, onCollapsedChange]);
  const isUsuario =
    perfis.includes("usuario") || perfis.includes("instrutor") || perfis.includes("administrador");
  const isInstrutor = perfis.includes("instrutor") || perfis.includes("administrador");
  const isAdmin = perfis.includes("administrador");

  // ✅ Menus COMPLETOS
  const menusUsuario = useMemo(
    () => [
      { label: "Painel do Usuário", path: "/usuario/dashboard", icon: LayoutDashboard },
      { label: "Eventos", path: "/eventos", icon: CalendarDays },
      { label: "Minhas Presenças", path: "/minhas-presencas", icon: ListChecks },
      { label: "Avaliações Pendentes", path: "/avaliacao", icon: PencilLine },
      { label: "Meus Certificados", path: "/certificados", icon: FileText },
      { label: "Agendamento de Sala", path: "/agenda-salas", icon: CalendarDays },
      { label: "Solicitar Curso", path: "/solicitar-curso", icon: Presentation },
      { label: "Submissão de Trabalhos", path: "/submissao", icon: Presentation },
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
      { label: "Avaliar Trabalhos Atribuídos", path: "/avaliador/submissao", icon: FolderOpenDot },
    ],
    []
  );

  const menusAdmin = useMemo(
    () => [
      { label: "Painel do Administrador", path: "/administrador", icon: LayoutDashboard },
      { label: "Dashboard Analítico", path: "/dashboard-analitico", icon: BarChart3 },
      { label: "Agenda", path: "/agenda-administrador", icon: ListChecks },
      { label: "Agenda de Salas", path: "/admin/agenda-salas", icon: CalendarDays },
      { label: "Solicitações de Curso", path: "/admin/solicitacao-curso", icon: School },
      { label: "Certificados Avulsos", path: "/certificados-avulsos", icon: FileText },
      { label: "Gestão de Usuários", path: "/gestao-usuarios", icon: Users },
      { label: "Gestão de Instrutor", path: "/gestao-instrutor", icon: Presentation },
      { label: "Gestão de Eventos", path: "/gerenciar-eventos", icon: CalendarDays },
      { label: "Gestão de Presença", path: "/gestao-presenca", icon: QrCode },
      { label: "Gestão de Avaliações", path: "/admin/avaliacao", icon: ClipboardList },
      { label: "Gestão de Certificados", path: "/gestao-certificados", icon: History },
      { label: "Relatórios Customizados", path: "/relatorios-customizados", icon: ClipboardList },
      { label: "Criar Submissão de Trabalho", path: "/admin/chamadas/new", icon: PlusCircle },
      { label: "Gerenciar Submissões", path: "__open_submissions__", icon: FolderOpenDot },
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

    // ✅ Quando muda de rota, abre automaticamente a seção do item ativo
    useEffect(() => {
      if (collapsed || isSearching) return;
  
      const secs = sectionsRaw || [];
      const found = secs.find((sec) =>
        sec.items.some((it) => isActivePath(location.pathname, it.path))
      );
  
      if (found?.title) setOpenSection(found.title);
      else if (!openSection && secs[0]?.title) setOpenSection(secs[0].title);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, collapsed, isSearching, sectionsRaw]);

  // Busca
  const sections = useMemo(() => sectionsRaw, [sectionsRaw]);

  // A11y (roving tabindex opcional no desktop expandido)
  const itemRefs = useRef([]);
  itemRefs.current = [];
  const [focusIdx, setFocusIdx] = useState(0);

  const flatItems = useMemo(() => {
    const out = [];
    sections.forEach((sec) => sec.items.forEach((it) => out.push(it)));
    return out;
  }, [sections]);

  useEffect(() => {
    // mantém focusIdx dentro do range após filtrar
    setFocusIdx((prev) => clamp(prev, 0, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  const go = useCallback(
    (path) => {
      if (path === "__open_submissions__") {
        navigate("/admin/submissao");
        onClose?.();
        return;
      }
      navigate(path);
      onClose?.();
    },
    [navigate, onClose]
  );

  const shellCls = isDark
    ? "border-white/10 bg-zinc-900/45"
    : "border-slate-200 bg-white shadow-sm ring-1 ring-black/5 shadow-[0_10px_35px_rgba(2,6,23,0.06)]";

  const themeCollapsed = collapsed && !isMobile;

  // IDs p/ aria-controls
  const listId = `sidebar-list-${variant}`;

  return (
    <nav
      className={cx(
        "rounded-3xl border overflow-hidden",
        shellCls,
        isMobile ? "h-full" : "sticky top-24",
        themeCollapsed ? "w-[92px]" : "",
        "flex flex-col" // ✅ sempre flex p/ scroll interno perfeito
      )}
      aria-label="Menu principal"
    >
      {/* HEADER (fixo dentro da sidebar) */}
      <div className={cx("p-3", isMobile ? "shrink-0" : "shrink-0")}>
        <div
          aria-hidden="true"
          className={cx(
            "h-1.5 w-full rounded-full mb-2.5 bg-gradient-to-r",
            isDark
              ? "from-emerald-400/30 via-sky-400/20 to-violet-400/10"
              : "from-emerald-500/40 via-sky-500/25 to-violet-500/15"
          )}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold">
            {themeCollapsed ? "Menu" : "Navegação"}
          </div>

          {!isMobile ? (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl p-2 border transition",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100 text-slate-700"
              )}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!collapsed}
              aria-controls={listId}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onClose?.()}
              className={cx(
                "rounded-2xl p-2.5 border transition",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100"
              )}
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        </div>

        
      {/* LISTA (scroll interno perfeito) */}
      <div
        id={listId}
        className={cx(
          "px-3 pb-3 space-y-3",
          "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2"
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {sections.length === 0 ? (
          <div className={cx("px-2 pb-2 text-sm", isDark ? "text-zinc-300" : "text-slate-700")}>
            Nenhum menu disponível para este perfil.
          </div>
                ) : (
                  sections.map((sec) => {
                    // ✅ Regras de abertura:
                    // - Se estiver buscando: abre tudo para mostrar resultados
                    // - Se sidebar estiver colapsada (ícones): mantém tudo visível (fica compacto)
                    // - Caso normal: só a seção "openSection" fica aberta
                    const expanded = themeCollapsed || isSearching || openSection === sec.title;
        
                    return (
                      <div key={sec.title} className="rounded-2xl">
                        {/* HEADER clicável */}
                        <button
                          type="button"
                          onClick={() => {
                            if (themeCollapsed) return;
                            setOpenSection((prev) => (prev === sec.title ? null : sec.title));
                          }}
                          className={cx(
                            "w-full flex items-center justify-between gap-2 px-2 py-2 rounded-2xl transition",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                            isDark ? "hover:bg-white/5" : "hover:bg-slate-100/70",
                            themeCollapsed ? "justify-center" : ""
                          )}
                          aria-expanded={expanded}
                          aria-controls={`sec-${variant}-${sec.title}`}
                        >
                          <div
                            className={cx(
                              "text-[11px] font-extrabold uppercase tracking-wide",
                              isDark ? "text-zinc-400" : "text-slate-500",
                              themeCollapsed ? "text-center" : ""
                            )}
                          >
                            {themeCollapsed ? sec.title.slice(0, 3) : sec.title}
                          </div>
        
                          {/* Chevron (só aparece no expandido normal) */}
                          {!themeCollapsed && (
                            <span
                              aria-hidden="true"
                              className={cx(
                                "text-xs font-black select-none transition",
                                expanded ? "opacity-100" : "opacity-70"
                              )}
                            >
                              {expanded ? "▾" : "▸"}
                            </span>
                          )}
                        </button>
        
                        {/* CONTEÚDO */}
                        {expanded && (
                          <div id={`sec-${variant}-${sec.title}`} className="space-y-0.5">
                            {sec.items.map((item) => {
                              const active = isActivePath(location.pathname, item.path);
        
                              const globalIndex = flatItems.findIndex(
                                (it) => it.path === item.path && it.label === item.label
                              );
                              const useRoving = !themeCollapsed && !isMobile;
        
                              const tabIndex = useRoving ? (globalIndex === focusIdx ? 0 : -1) : 0;
        
                              const onKeyDown = useRoving
                                ? (e) => {
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      setFocusIdx((v) => clamp(v + 1, 0, Math.max(0, flatItems.length - 1)));
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      setFocusIdx((v) => clamp(v - 1, 0, Math.max(0, flatItems.length - 1)));
                                    } else if (e.key === "Home") {
                                      e.preventDefault();
                                      setFocusIdx(0);
                                    } else if (e.key === "End") {
                                      e.preventDefault();
                                      setFocusIdx(Math.max(0, flatItems.length - 1));
                                    } else if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      go(item.path);
                                    }
                                  }
                                : undefined;
        
                              return (
                                <MenuItem
                                  key={`${sec.title}-${item.label}-${item.path}`}
                                  active={active}
                                  isDark={isDark}
                                  collapsed={themeCollapsed}
                                  icon={item.icon}
                                  label={item.label}
                                  onClick={() => go(item.path)}
                                  tabIndex={tabIndex}
                                  onKeyDown={onKeyDown}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
      </div>
    </nav>
  );
}

/* util clamp local */
function clamp(n, min, max) {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.min(Math.max(x, min), max);
}
