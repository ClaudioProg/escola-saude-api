// ✅ src/layout/EscolaAppShell.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  FileBadge,
  ShieldCheck,
  UserCircle2,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/cursos", label: "Cursos", icon: GraduationCap },
  { to: "/certificados", label: "Certificados", icon: FileBadge },
  { to: "/admin", label: "Admin", icon: ShieldCheck }, // depois você oculta por perfil
  { to: "/perfil", label: "Meus dados", icon: UserCircle2 },
];

export default function EscolaAppShell({
  children,
  title = "Plataforma Escola da Saúde",
  storageTokenKey = "escola_token",
  storageUserKey = "escola_usuario",
  loginRoute = "/login",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const { theme, setTheme, isDark } = useEscolaTheme();
  const [open, setOpen] = useState(false);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageUserKey);
      setUsuario(raw ? JSON.parse(raw) : null);
    } catch {
      setUsuario(null);
    }
  }, [storageUserKey]);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function logout() {
    localStorage.removeItem(storageTokenKey);
    localStorage.removeItem(storageUserKey);
    navigate(loginRoute, { replace: true });
  }

  const nome = usuario?.nome || usuario?.nome_completo || "Usuário";
  const email = usuario?.email || "";

  const routeLabel = useMemo(() => {
    const hit = NAV.find((n) => n.to === location.pathname);
    return hit?.label || "";
  }, [location.pathname]);

  return (
    <div className={isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"}>
      {/* Skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      {/* Topbar */}
      <header
        className={[
          "sticky top-0 z-40 border-b backdrop-blur",
          isDark ? "border-white/10 bg-zinc-950/70" : "border-slate-200 bg-white/75",
        ].join(" ")}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={[
                "md:hidden inline-flex items-center justify-center rounded-xl p-2 border",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100",
              ].join(" ")}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className={["text-xs font-semibold", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                {title}
              </div>
              <div className="truncate text-sm font-extrabold">
                {routeLabel || " "}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex">
              <ThemeTogglePills theme={theme} setTheme={setTheme} variant="solid" />
            </div>

            <div
              className={[
                "hidden md:flex items-center gap-3 rounded-2xl border px-3 py-2",
                isDark ? "border-white/10 bg-zinc-900/40" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <UserCircle2 className={isDark ? "text-emerald-300" : "text-emerald-700"} />
              <div className="leading-tight min-w-0">
                <div className="text-xs font-extrabold truncate max-w-[220px]">{nome}</div>
                <div className={["text-[11px] truncate max-w-[220px]", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                  {email || "—"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold border",
                isDark ? "border-white/10 bg-zinc-900/40 hover:bg-white/5" : "border-slate-200 bg-white hover:bg-slate-100",
              ].join(" ")}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-12 gap-6 py-6">
          {/* Sidebar desktop */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3">
            <nav
              className={[
                "rounded-3xl border p-3 sticky top-24",
                isDark ? "border-white/10 bg-zinc-900/55" : "border-slate-200 bg-white",
              ].join(" ")}
              aria-label="Menu principal"
            >
              <div className="px-3 py-3">
                <div className={["text-xs font-semibold", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                  Navegação
                </div>
              </div>

              <div className="space-y-1">
                {NAV.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    active={location.pathname === item.to}
                    isDark={isDark}
                  />
                ))}
              </div>

              <div className={["mt-3 px-3 py-3 rounded-2xl border border-dashed", isDark ? "border-white/10" : "border-slate-200"].join(" ")}>
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <Settings className="w-4 h-4" />
                  Dica
                </div>
                <p className={["mt-1 text-[11px] leading-relaxed", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                  Use o menu para acessar agenda, cursos, certificados e sua área administrativa.
                </p>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <section id="conteudo" className="col-span-12 md:col-span-8 lg:col-span-9">
            {children}
          </section>
        </div>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              className={[
                "fixed left-0 top-0 bottom-0 z-50 w-[86%] max-w-sm border-r p-4",
                isDark ? "border-white/10 bg-zinc-950" : "border-slate-200 bg-white",
              ].join(" ")}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              aria-label="Menu"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">Menu</div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={[
                    "rounded-xl p-2 border",
                    isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-100",
                  ].join(" ")}
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className={["mt-4 rounded-2xl border p-3", isDark ? "border-white/10" : "border-slate-200"].join(" ")}>
                <div className="flex items-center gap-3">
                  <UserCircle2 className={isDark ? "text-emerald-300" : "text-emerald-700"} />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">{nome}</div>
                    <div className={["text-[11px] truncate", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                      {email || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className={["text-xs font-semibold mb-2", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                  Tema
                </div>
                <ThemeTogglePills theme={theme} setTheme={setTheme} variant="solid" />
              </div>

              <div className="mt-5 space-y-1">
                {NAV.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    active={location.pathname === item.to}
                    isDark={isDark}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={logout}
                  className={[
                    "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold border",
                    isDark ? "border-white/10 bg-zinc-900/40 hover:bg-white/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, active, isDark, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
        active
          ? "bg-emerald-600 text-white"
          : isDark
          ? "text-zinc-200 hover:bg-white/5"
          : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="w-5 h-5" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
