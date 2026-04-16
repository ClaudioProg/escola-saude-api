// ✅ src/layout/EscolaAppShell.jsx — PREMIUM++
// - Focus return correto
// - Cleanup robusto de scroll lock
// - Sem ref duplicada entre botão abrir menu e logout
// - Drawer mobile acessível e estável
// - SSR-safe
// - Motion respeita prefers-reduced-motion

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import SeloInstitucional from "../components/SeloInstitucional";
import Topbar from "../components/Topbar";
import SidebarNav from "../components/SidebarNav";

/* =========================
   Utils (SSR-safe DOM helpers)
========================= */
const hasDOM =
  typeof window !== "undefined" && typeof document !== "undefined";

const SIDEBAR_COLLAPSED_KEY = "escola_sidebar_collapsed"; // "1" | "0"

function getScrollbarWidth() {
  if (!hasDOM) return 0;

  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText =
    "width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;";
  document.body.appendChild(scrollDiv);

  const width = scrollDiv.offsetWidth - scrollDiv.clientWidth;

  document.body.removeChild(scrollDiv);
  return width || 0;
}

/* =========================
   Scroll lock robusto
========================= */
let _restoreScrollTop = 0;
let _restorePaddingRight = "";

function lockScroll() {
  if (!hasDOM) return;

  const body = document.body;
  if (!body || body.style.position === "fixed") return;

  _restoreScrollTop = window.scrollY || window.pageYOffset || 0;

  const sbw = getScrollbarWidth();
  _restorePaddingRight = body.style.paddingRight;

  if (sbw) {
    body.style.paddingRight = `${sbw}px`;
  }

  body.style.position = "fixed";
  body.style.top = `-${_restoreScrollTop}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.classList.add("overflow-hidden", "modal-open");
}

function unlockScroll() {
  if (!hasDOM) return;

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
    body.style.paddingRight = _restorePaddingRight ?? "";

    try {
      window.scrollTo({ top: _restoreScrollTop, behavior: "auto" });
    } catch {
      window.scrollTo(0, _restoreScrollTop);
    }
  }
}

function setElementInert(el, value) {
  if (!el) return;

  try {
    el.inert = value;
  } catch {
    /* noop */
  }

  if (value) {
    el.setAttribute("aria-hidden", "true");
  } else {
    el.removeAttribute("aria-hidden");
  }
}

/* =========================
   AppShell
========================= */
export default function EscolaAppShell({
  children,
  title = "Plataforma Escola da Saúde",
  storageTokenKey = "escola_token",
  storageUserKey = "escola_usuario",
  loginRoute = "/login",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const openBtnRef = useRef(null);
  const drawerRef = useRef(null);
  const appRootRef = useRef(null);
  const prevOpenRef = useRef(false);

  const drawerId = "escola-drawer";

  // ✅ estado de colapso controlando layout (desktop)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  /* =========================
     Navegação / usuário
  ========================== */

  // fecha drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageUserKey);
      setUsuario(raw ? JSON.parse(raw) : null);
    } catch {
      setUsuario(null);
    }
  }, [storageUserKey, location.pathname]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(storageTokenKey);
      localStorage.removeItem(storageUserKey);
    } catch {
      /* noop */
    }

    setOpen(false);
    navigate(loginRoute, { replace: true });
  }, [loginRoute, navigate, storageTokenKey, storageUserKey]);

  /* =========================
     Sidebar desktop layout
  ========================== */
  const layoutCols = useMemo(() => {
    const aside = sidebarCollapsed
      ? "md:col-span-2 lg:col-span-1"
      : "md:col-span-4 lg:col-span-3";

    const main = sidebarCollapsed
      ? "md:col-span-10 lg:col-span-11"
      : "md:col-span-8 lg:col-span-9";

    return { aside, main };
  }, [sidebarCollapsed]);

  /* =========================
     Eventos globais
  ========================== */

  // ESC fecha drawer somente quando aberto
  useEffect(() => {
    if (!hasDOM || !open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // sincroniza colapso entre abas
  useEffect(() => {
    if (!hasDOM) return undefined;

    const onStorage = (e) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        setSidebarCollapsed(e.newValue === "1");
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* =========================
     Focus trap
  ========================== */
  const onKeyDownTrap = useCallback(
    (e) => {
      if (!open || e.key !== "Tab") return;

      const root = drawerRef.current;
      if (!root) return;

      const focusable = root.querySelectorAll(
        'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    },
    [open]
  );

  /* =========================
     Scroll lock + inert + focus
  ========================== */
  useEffect(() => {
    if (!hasDOM) return undefined;

    const root = appRootRef.current;
    const wasOpen = prevOpenRef.current;

    if (open) {
      lockScroll();
      setElementInert(root, true);

      const raf = window.requestAnimationFrame(() => {
        const firstFocusable = drawerRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        firstFocusable?.focus?.();
      });

      prevOpenRef.current = true;

      return () => {
        window.cancelAnimationFrame(raf);
      };
    }

    // fechou depois de estar aberto
    if (wasOpen) {
      unlockScroll();
      setElementInert(root, false);
      openBtnRef.current?.focus?.();
    }

    prevOpenRef.current = false;

    return undefined;
  }, [open]);

  // cleanup final caso desmonte com drawer aberto
  useEffect(() => {
    return () => {
      if (!hasDOM) return;
      unlockScroll();
      setElementInert(appRootRef.current, false);
    };
  }, []);

  /* =========================
     Motion configs
  ========================== */
  const overlayMotion = reduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      };

  const drawerMotion = reduceMotion
    ? {
        initial: { x: 0 },
        animate: { x: 0 },
        exit: { x: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { x: "-100%" },
        animate: { x: 0 },
        exit: { x: "-100%" },
        transition: { type: "spring", stiffness: 380, damping: 34 },
      };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Selo institucional */}
      <SeloInstitucional
        appName="Escola da Saúde"
        variant="saude"
        badgeText="Plataforma Oficial"
      />

      {/* Skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]
                   rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20"
      >
        Pular para o conteúdo
      </a>

      {/* Ambient background */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none fixed inset-0 -z-10",
          "bg-[radial-gradient(1000px_600px_at_10%_-10%,rgba(16,185,129,.14),transparent_60%),radial-gradient(900px_600px_at_90%_0%,rgba(56,189,248,.12),transparent_55%),radial-gradient(900px_700px_at_50%_110%,rgba(99,102,241,.08),transparent_60%)]",
          "dark:bg-[radial-gradient(1000px_600px_at_10%_-10%,rgba(16,185,129,.18),transparent_60%),radial-gradient(900px_600px_at_90%_0%,rgba(56,189,248,.14),transparent_55%),radial-gradient(900px_700px_at_50%_110%,rgba(99,102,241,.10),transparent_60%)]",
        ].join(" ")}
      />

      {/* Topbar */}
      <Topbar
        title={title}
        onOpenMenu={() => setOpen(true)}
        drawerId={drawerId}
        openButtonRef={openBtnRef}
      />

      {/* App content wrapper (inert quando drawer abre) */}
      <div ref={appRootRef}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-12 gap-6 py-6">
            {/* Sidebar desktop */}
            <aside
              className={[
                "hidden md:block transition-[width] duration-200",
                layoutCols.aside,
              ].join(" ")}
              aria-label="Navegação lateral"
            >
              <SidebarNav
                variant="desktop"
                collapsed={sidebarCollapsed}
                onCollapsedChange={(v) => {
                  setSidebarCollapsed(v);
                  try {
                    localStorage.setItem(
                      SIDEBAR_COLLAPSED_KEY,
                      v ? "1" : "0"
                    );
                  } catch {
                    /* noop */
                  }
                }}
              />
            </aside>

            {/* Content */}
            <section
              id="conteudo"
              className={[
                "col-span-12 transition-[width] duration-200",
                layoutCols.main,
              ].join(" ")}
              role="main"
              aria-label="Conteúdo principal"
            >
              {children}
            </section>
          </div>
        </div>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
              {...overlayMotion}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.aside
              id={drawerId}
              ref={drawerRef}
              className={[
                "fixed left-0 top-0 bottom-0 z-[60] w-[88%] max-w-sm border-r p-4",
                "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
                "flex flex-col overflow-hidden",
                "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-950",
              ].join(" ")}
              {...drawerMotion}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              onKeyDown={onKeyDownTrap}
            >
              {/* Mini card do usuário */}
              <div className="mb-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-zinc-900/25">
                <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">
                  Sessão
                </div>

                <div className="mt-2 truncate text-sm font-extrabold">
                  {usuario?.nome || usuario?.nome_completo || "Usuário"}
                </div>

                <div className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                  {usuario?.email || "—"}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2
                             text-xs font-extrabold transition hover:bg-slate-100
                             dark:border-white/10 dark:bg-zinc-900/35 dark:hover:bg-white/5"
                >
                  Sair
                </button>
              </div>

              {/* Sidebar mobile */}
              <div className="min-h-0 flex-1">
                <SidebarNav variant="mobile" onClose={() => setOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}