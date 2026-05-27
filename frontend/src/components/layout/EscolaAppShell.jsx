// ✅ src/components/layout/EscolaAppShell.jsx — v2.0
// Plataforma Escola da Saúde
//
// Shell principal oficial da aplicação.
//
// Revisão premium:
// - layout estrutural principal;
// - visual moderno, institucional e premium;
// - mobile-first;
// - drawer mobile acessível;
// - sidebar desktop recolhível;
// - foco inicial e retorno de foco;
// - scroll lock robusto;
// - inert/aria-hidden no conteúdo ao abrir menu mobile;
// - reduced motion;
// - contrato oficial único de sessão;
// - sem aliases;
// - sem compatibilidade legada;
// - localStorage oficial:
//   - token
//   - perfil
//   - escola_sidebar_recolhida
// - integração com resumo oficial de menu quando houver dado acionável;
// - integração inicial com notificações não lidas;
// - imports conforme organização atual por domínio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  apiNotificacaoResumo,
  clearAuthSession,
} from "../../services/api";
import SidebarNav from "./SidebarNav";
import Topbar from "./Topbar";

const STORAGE_PERFIL_KEY = "perfil";
const STORAGE_SIDEBAR_RECOLHIDA_KEY = "escola_sidebar_recolhida";

const DRAWER_ID = "menu-lateral-mobile";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function hasDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getScrollbarWidth() {
  if (!hasDOM()) return 0;

  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function getStoredBoolean(key, fallback = false) {
  if (!hasDOM()) return fallback;

  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return fallback;
  }
}

function setStoredBoolean(key, value) {
  if (!hasDOM()) return;

  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Sem persistência quando storage estiver indisponível.
  }
}

function getStoredPerfil() {
  if (!hasDOM()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_PERFIL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getResumoData(response) {
  if (response?.data && typeof response.data === "object") {
    return response.data;
  }

  if (response && typeof response === "object") {
    return response;
  }

  return {};
}

function lockBodyScroll() {
  if (!hasDOM()) return;

  const body = document.body;
  const count = Number(body.dataset.escolaScrollLockCount || "0");

  if (count === 0) {
    const scrollbarWidth = getScrollbarWidth();

    body.dataset.escolaScrollAnteriorOverflow = body.style.overflow || "";
    body.dataset.escolaScrollAnteriorPaddingRight = body.style.paddingRight || "";

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  body.dataset.escolaScrollLockCount = String(count + 1);
}

function unlockBodyScroll() {
  if (!hasDOM()) return;

  const body = document.body;
  const count = Number(body.dataset.escolaScrollLockCount || "0");
  const next = Math.max(0, count - 1);

  if (next === 0) {
    body.style.overflow = body.dataset.escolaScrollAnteriorOverflow || "";
    body.style.paddingRight = body.dataset.escolaScrollAnteriorPaddingRight || "";

    delete body.dataset.escolaScrollAnteriorOverflow;
    delete body.dataset.escolaScrollAnteriorPaddingRight;
  }

  body.dataset.escolaScrollLockCount = String(next);
}

function setInert(element, value) {
  if (!element) return;

  if (value) {
    element.setAttribute("aria-hidden", "true");
  } else {
    element.removeAttribute("aria-hidden");
  }

  if ("inert" in element) {
    element.inert = value;
  }
}

function getFocusableElements(root) {
  if (!root) return [];

  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.getAttribute("aria-hidden") === "true") return false;
      if (element.hasAttribute("disabled")) return false;

      const style = window.getComputedStyle?.(element);

      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return false;
      }

      return true;
    }
  );
}

export default function EscolaAppShell({
  children,
  titulo = "Plataforma Escola da Saúde",
  rotaLogin = "/login",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [menuAberto, setMenuAberto] = useState(false);
  const [perfil, setPerfil] = useState(() => getStoredPerfil());
  const [sidebarRecolhida, setSidebarRecolhida] = useState(() =>
    getStoredBoolean(STORAGE_SIDEBAR_RECOLHIDA_KEY, false)
  );
  const [resumoMenu, setResumoMenu] = useState({
    notificacao_nao_lida: 0,
  });

  const abrirMenuRef = useRef(null);
  const fecharMenuRef = useRef(null);
  const drawerRef = useRef(null);
  const conteudoRef = useRef(null);
  const abortResumoMenuRef = useRef(null);

  const nomeUsuario = perfil?.nome || "Usuário";
  const emailUsuario = perfil?.email || "E-mail não informado";

  const layoutClasses = useMemo(() => {
    if (sidebarRecolhida) {
      return {
        aside: "md:col-span-2 lg:col-span-1",
        main: "md:col-span-10 lg:col-span-11",
      };
    }

    return {
      aside: "md:col-span-4 lg:col-span-3",
      main: "md:col-span-8 lg:col-span-9",
    };
  }, [sidebarRecolhida]);

  const overlayMotion = reducedMotion
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
        transition: { duration: 0.18 },
      };

  const drawerMotion = reducedMotion
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
        transition: {
          type: "spring",
          stiffness: 420,
          damping: 38,
        },
      };

  const fecharMenu = useCallback(() => {
    setMenuAberto(false);
  }, []);

  const abrirMenu = useCallback(() => {
    setMenuAberto(true);
  }, []);

  const alternarSidebar = useCallback((value) => {
    const next = Boolean(value);

    setSidebarRecolhida(next);
    setStoredBoolean(STORAGE_SIDEBAR_RECOLHIDA_KEY, next);
  }, []);

  const carregarResumoMenu = useCallback(async () => {
    if (!hasDOM()) return;

    abortResumoMenuRef.current?.abort?.();

    const controller = new AbortController();
    abortResumoMenuRef.current = controller;

    try {
      const response = await apiNotificacaoResumo({
        on401: "silent",
        on403: "silent",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = getResumoData(response);

      setResumoMenu((atual) => ({
        ...atual,
        notificacao_nao_lida: Number(data.nao_lida || 0),
      }));
    } catch (error) {
      if (error?.name === "AbortError") return;

      setResumoMenu((atual) => ({
        ...atual,
        notificacao_nao_lida: 0,
      }));
    }
  }, []);

  const sair = useCallback(() => {
    try {
      clearAuthSession();
    } catch {
      // O fallback fica centralizado no próprio api.js; aqui não bloqueia a saída.
    }

    setPerfil(null);
    setResumoMenu({
      notificacao_nao_lida: 0,
    });
    setMenuAberto(false);

    if (hasDOM()) {
      window.dispatchEvent(new CustomEvent("auth:changed"));
    }

    navigate(rotaLogin, { replace: true });
  }, [navigate, rotaLogin]);

  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  useEffect(() => {
    setPerfil(getStoredPerfil());
  }, [location.pathname]);

  useEffect(() => {
    carregarResumoMenu();
  }, [carregarResumoMenu, location.pathname]);

  useEffect(() => {
    if (!hasDOM()) return undefined;

    function handleStorage(event) {
      if (event.key === STORAGE_SIDEBAR_RECOLHIDA_KEY) {
        setSidebarRecolhida(event.newValue === "1");
      }

      if (event.key === STORAGE_PERFIL_KEY) {
        setPerfil(getStoredPerfil());
        carregarResumoMenu();
      }
    }

    function handleAuthChanged() {
      setPerfil(getStoredPerfil());
      carregarResumoMenu();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth:changed", handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth:changed", handleAuthChanged);
    };
  }, [carregarResumoMenu]);

  useEffect(() => {
    if (!hasDOM() || !menuAberto) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuAberto(false);
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(drawerRef.current);

      if (!focusable.length) {
        event.preventDefault();
        drawerRef.current?.focus?.();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [menuAberto]);

  useEffect(() => {
    if (!hasDOM()) return undefined;

    if (!menuAberto) {
      return undefined;
    }

    lockBodyScroll();
    setInert(conteudoRef.current, true);

    const frameId = window.requestAnimationFrame(() => {
      fecharMenuRef.current?.focus?.();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      unlockBodyScroll();
      setInert(conteudoRef.current, false);
      abrirMenuRef.current?.focus?.();
    };
  }, [menuAberto]);

  useEffect(() => {
    return () => {
      abortResumoMenuRef.current?.abort?.();
      unlockBodyScroll();
      setInert(conteudoRef.current, false);
    };
  }, []);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
       <a
        href="#conteudo"
        className={classNames(
          "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90]",
          "rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-xl",
          "focus:outline-none focus:ring-2 focus:ring-emerald-300"
        )}
      >
        Pular para o conteúdo
      </a>

      <div
        aria-hidden="true"
        className={classNames(
          "pointer-events-none fixed inset-0 -z-10",
          "bg-[radial-gradient(1000px_600px_at_8%_-10%,rgba(16,185,129,.16),transparent_60%),radial-gradient(900px_600px_at_92%_0%,rgba(56,189,248,.13),transparent_55%),radial-gradient(900px_700px_at_50%_112%,rgba(99,102,241,.09),transparent_60%)]",
          "dark:bg-[radial-gradient(1000px_600px_at_8%_-10%,rgba(16,185,129,.20),transparent_60%),radial-gradient(900px_600px_at_92%_0%,rgba(56,189,248,.16),transparent_55%),radial-gradient(900px_700px_at_50%_112%,rgba(99,102,241,.12),transparent_60%)]"
        )}
      />

      <Topbar
        titulo={titulo}
        drawerId={DRAWER_ID}
        abrirMenuRef={abrirMenuRef}
        aoAbrirMenu={abrirMenu}
      />

      <div ref={conteudoRef}>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="grid grid-cols-12 gap-5 lg:gap-6">
            <aside
              className={classNames(
                "hidden md:block",
                "transition-[grid-column] duration-200 motion-reduce:transition-none",
                layoutClasses.aside
              )}
              aria-label="Navegação lateral"
            >
              <div className="sticky top-5">
                <SidebarNav
                  variante="desktop"
                  recolhida={sidebarRecolhida}
                  aoAlternarRecolhida={alternarSidebar}
                  resumoMenu={resumoMenu}
                />
              </div>
            </aside>

            <main
              id="conteudo"
              className={classNames(
                "col-span-12 min-w-0",
                "transition-[grid-column] duration-200 motion-reduce:transition-none",
                layoutClasses.main
              )}
              aria-label="Conteúdo principal"
              tabIndex={-1}
            >
              <div className="min-h-[calc(100dvh-11rem)] rounded-[2rem] border border-slate-200/70 bg-white/72 p-3 shadow-[0_24px_80px_-58px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-slate-900/45 sm:p-4 lg:p-5">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuAberto && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-50 cursor-default bg-slate-950/60 backdrop-blur-[3px]"
              aria-label="Fechar menu lateral"
              onClick={fecharMenu}
              {...overlayMotion}
            />

            <motion.aside
              id={DRAWER_ID}
              ref={drawerRef}
              className={classNames(
                "fixed bottom-0 left-0 top-0 z-[60] flex w-[90vw] max-w-sm flex-col overflow-hidden",
                "border-r border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-white",
                "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              tabIndex={-1}
              {...drawerMotion}
            >
              <header className="border-b border-slate-200 px-4 pb-4 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Plataforma Oficial
                    </div>

                    <h2 className="mt-3 text-lg font-black tracking-tight">
                      Menu da Escola da Saúde
                    </h2>

                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Acesse rapidamente os módulos disponíveis.
                    </p>
                  </div>

                  <button
                    ref={fecharMenuRef}
                    type="button"
                    onClick={fecharMenu}
                    className={classNames(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                      "border border-slate-200 bg-white text-slate-600 shadow-sm transition",
                      "hover:bg-slate-50 hover:text-rose-600",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500",
                      "dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10"
                    )}
                    aria-label="Fechar menu"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        {nomeUsuario}
                      </p>

                      <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                        {emailUsuario}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={sair}
                    className={classNames(
                      "mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl",
                      "border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition",
                      "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                      "dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10"
                    )}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sair com segurança
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <SidebarNav
                  variante="mobile"
                  aoFechar={fecharMenu}
                  resumoMenu={resumoMenu}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

EscolaAppShell.propTypes = {
  children: PropTypes.node.isRequired,
  titulo: PropTypes.string,
  rotaLogin: PropTypes.string,
};