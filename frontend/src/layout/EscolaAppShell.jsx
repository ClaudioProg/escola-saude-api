// ✅ src/layout/EscolaAppShell.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import SeloInstitucional from "../components/SeloInstitucional";
import Topbar from "../components/Topbar";
import SidebarNav from "../components/SidebarNav";

/* =========================
   Scroll lock robusto (drawer mobile)
========================= */
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
  body.classList.add("overflow-hidden", "modal-open");
}
function unlockScroll() {
  const body = document.body;
  if (!body) return;
  body.classList.remove("overflow-hidden", "modal-open");
  if (body.style.position === "fixed") {
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";
    try {
      window.scrollTo({ top: _restoreScrollTop, behavior: "instant" });
    } catch {
      window.scrollTo(0, _restoreScrollTop);
    }
  }
}

/* =========================
   Persistência: colapso do sidebar
========================= */
const SIDEBAR_COLLAPSED_KEY = "escola_sidebar_collapsed"; // "1" | "0"

export default function EscolaAppShell({
  children,
  title = "Plataforma Escola da Saúde",
  storageTokenKey = "escola_token",
  storageUserKey = "escola_usuario",
  loginRoute = "/login",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Tema: NÃO pintamos fundo via JS.
  // O tema é controlado por <html class="dark"> e Tailwind (dark:...).
  // Aqui só usamos classes Tailwind com dark:...
  const [open, setOpen] = useState(false);
  const openBtnRef = useRef(null);
  const drawerId = "escola-drawer";

  // ✅ estado de colapso controlando layout (desktop)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  // fecha drawer ao navegar
  useEffect(() => setOpen(false), [location.pathname]);

  // ESC fecha drawer
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // scroll lock + foco de retorno
  useEffect(() => {
    if (open) lockScroll();
    else unlockScroll();
    if (!open) openBtnRef.current?.focus?.();
  }, [open]);

  // usuário (para card do drawer)
  const [usuario, setUsuario] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageUserKey);
      setUsuario(raw ? JSON.parse(raw) : null);
    } catch {
      setUsuario(null);
    }
  }, [storageUserKey, location.pathname]);

  // sincroniza colapso entre abas (e também se SidebarNav atualizar)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        setSidebarCollapsed(e.newValue === "1");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function logout() {
    localStorage.removeItem(storageTokenKey);
    localStorage.removeItem(storageUserKey);
    navigate(loginRoute, { replace: true });
  }

  // ✅ grid responsivo com colapso (desktop)
  const layoutCols = useMemo(() => {
    // Sidebar expandida: md 4 / lg 3
    // Sidebar recolhida: md 2 / lg 1 (mais espaço pro conteúdo)
    const aside = sidebarCollapsed ? "md:col-span-2 lg:col-span-1" : "md:col-span-4 lg:col-span-3";
    const main  = sidebarCollapsed ? "md:col-span-10 lg:col-span-11" : "md:col-span-8 lg:col-span-9";
    return { aside, main };
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Selo institucional */}
      <SeloInstitucional appName="Escola da Saúde" variant="saude" badgeText="Plataforma Oficial" />

      {/* Skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]
                   rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20"
      >
        Pular para o conteúdo
      </a>

      {/* Ambient background (dark/light via classes) */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none fixed inset-0 -z-10",
          "bg-[radial-gradient(1000px_600px_at_10%_-10%,rgba(16,185,129,.14),transparent_60%),radial-gradient(900px_600px_at_90%_0%,rgba(56,189,248,.12),transparent_55%),radial-gradient(900px_700px_at_50%_110%,rgba(99,102,241,.08),transparent_60%)]",
          "dark:bg-[radial-gradient(1000px_600px_at_10%_-10%,rgba(16,185,129,.18),transparent_60%),radial-gradient(900px_600px_at_90%_0%,rgba(56,189,248,.14),transparent_55%),radial-gradient(900px_700px_at_50%_110%,rgba(99,102,241,.10),transparent_60%)]",
        ].join(" ")}
      />

      {/* Topbar */}
      <Topbar title={title} onOpenMenu={() => setOpen(true)} drawerId={drawerId} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-12 gap-6 py-6">
          {/* Sidebar desktop */}
          <aside
            className={[
              "hidden md:block transition-[width] duration-200",
              layoutCols.aside,
            ].join(" ")}
          >
            <SidebarNav
              variant="desktop"
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          </aside>

          {/* Content */}
          <section
            id="conteudo"
            className={[
              "col-span-12 transition-[width] duration-200",
              layoutCols.main,
            ].join(" ")}
          >
            {children}
          </section>
        </div>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.aside
              id={drawerId}
              className={[
                "fixed left-0 top-0 bottom-0 z-50 w-[88%] max-w-sm border-r p-4",
                "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
                "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950",
              ].join(" ")}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              aria-label="Menu"
              role="dialog"
              aria-modal="true"
            >
              {/* Mini card do usuário */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 mb-4 dark:border-white/10 dark:bg-zinc-900/25">
                <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">
                  Sessão
                </div>

                <div className="mt-2 text-sm font-extrabold truncate">
                  {usuario?.nome || usuario?.nome_completo || "Usuário"}
                </div>

                <div className="text-[11px] truncate text-slate-500 dark:text-zinc-400">
                  {usuario?.email || "—"}
                </div>

                <button
                  ref={openBtnRef}
                  type="button"
                  onClick={logout}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2
                             text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-100
                             dark:border-white/10 dark:bg-zinc-900/35 dark:hover:bg-white/5 transition"
                >
                  Sair
                </button>
              </div>

              {/* Sidebar no mobile */}
              <SidebarNav variant="mobile" onClose={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
