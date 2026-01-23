// 📁 src/components/Modal.jsx — ÚNICO motor de modal (STACK-SAFE + A11Y + PREMIUM)
// ✅ Portal em #modal-root (não no body direto)
// ✅ Scroll lock com contador (sem “pulo”)
// ✅ aria-hidden/inert aplicado no app somente quando o 1º modal abre (stack safe)
// ✅ Suporta modal sobre modal (confirmação etc.) sem travar clique
// ✅ Pointer events e “drag-safe” no backdrop
// ✅ Reduced motion respeitado
// ✅ iOS: overscroll/touch melhorado
// ✅ Opções premium: size, align, padding, blur, variant, showClose, allowOutsideClick, closeOnEscape, zIndex

import React, {
  useEffect,
  useRef,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";

/* =========================
   DEV logger (Modal)
========================= */
const IS_DEV = import.meta?.env?.MODE !== "production";
const logM = (...a) => IS_DEV && console.log("[Modal]", ...a);
const warnM = (...a) => IS_DEV && console.warn("[Modal]", ...a);

/* =========================
   Focus helpers
========================= */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

function isFocusable(el) {
  if (!el) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.tabIndex === -1) return false;
  const style = window.getComputedStyle?.(el);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  const rect = el.getBoundingClientRect?.();
  if (!rect || (rect.width === 0 && rect.height === 0)) return false;
  return true;
}

function getFocusable(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE));
  return nodes.filter(isFocusable);
}

function raf(cb) {
  if (typeof window === "undefined") return 0;
  return window.requestAnimationFrame(cb);
}
function caf(id) {
  if (typeof window === "undefined") return;
  window.cancelAnimationFrame(id);
}

function supportsInert() {
  return typeof HTMLElement !== "undefined" && "inert" in HTMLElement.prototype;
}

/* =========================
   Portal root
========================= */
function ensureModalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
    logM("ensureModalRoot: created #modal-root", {
      id: root.id,
      inBody: document.body.contains(root),
    });
  } else {
    logM("ensureModalRoot: found #modal-root", {
      children: root.childElementCount,
      display: window.getComputedStyle?.(root)?.display,
      visibility: window.getComputedStyle?.(root)?.visibility,
      pointerEvents: window.getComputedStyle?.(root)?.pointerEvents,
    });
  }
  return root;
}

/* =========================
   Stack counter (global)
========================= */
const STACK_COUNT_KEY = "__modal_stack_count__";
function incStack() {
  const body = document.body;
  const n = Number(body.dataset[STACK_COUNT_KEY] || "0") + 1;
  body.dataset[STACK_COUNT_KEY] = String(n);
  return n;
}
function decStack() {
  const body = document.body;
  const n = Math.max(0, Number(body.dataset[STACK_COUNT_KEY] || "0") - 1);
  body.dataset[STACK_COUNT_KEY] = String(n);
  return n;
}

/* =========================
   Scroll lock (counter)
========================= */
const SCROLL_LOCK_KEY = "__modal_scroll_lock_count__";
function getScrollbarWidth() {
  try {
    return window.innerWidth - document.documentElement.clientWidth;
  } catch {
    return 0;
  }
}
function lockBodyScroll() {
  const body = document.body;
  const count = Number(body.dataset[SCROLL_LOCK_KEY] || "0");

  if (count === 0) {
    const sw = getScrollbarWidth();
    body.dataset.__modal_prev_overflow__ = body.style.overflow || "";
    body.dataset.__modal_prev_padding_right__ = body.style.paddingRight || "";

    body.style.overflow = "hidden";
    if (sw > 0) {
      body.style.paddingRight = `calc(${body.style.paddingRight || "0px"} + ${sw}px)`;
    }
  }

  body.dataset[SCROLL_LOCK_KEY] = String(count + 1);
}
function unlockBodyScroll() {
  const body = document.body;
  const count = Number(body.dataset[SCROLL_LOCK_KEY] || "0");
  const next = Math.max(0, count - 1);

  if (next === 0) {
    body.style.overflow = body.dataset.__modal_prev_overflow__ || "";
    body.style.paddingRight = body.dataset.__modal_prev_padding_right__ || "";
    delete body.dataset.__modal_prev_overflow__;
    delete body.dataset.__modal_prev_padding_right__;
  }

  body.dataset[SCROLL_LOCK_KEY] = String(next);
}

/* =========================
   A11y: hide app roots (stack-safe)
========================= */
function getAppRootsToHide(modalRootId = "modal-root") {
  const kids = Array.from(document.body.children || []);
  return kids.filter((el) => el.id !== modalRootId);
}

function hideAppRoots() {
  const roots = getAppRootsToHide("modal-root");
  const canInert = supportsInert();

  roots.forEach((el) => {
    if (el.dataset.__prev_aria_hidden__ == null) {
      const prev = el.getAttribute("aria-hidden");
      el.dataset.__prev_aria_hidden__ = prev == null ? "__null__" : prev;
    }
    el.setAttribute("aria-hidden", "true");
    if (canInert) el.inert = true;
  });
}

function restoreAppRoots() {
  const roots = getAppRootsToHide("modal-root");
  const canInert = supportsInert();

  roots.forEach((el) => {
    const prev = el.dataset.__prev_aria_hidden__;
    if (prev === "__null__" || prev == null) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", prev);

    delete el.dataset.__prev_aria_hidden__;
    if (canInert) el.inert = false;
  });
}

/* =========================
   Class helper
========================= */
function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* =========================
   Size presets
========================= */
const SIZE_MAP = {
  sm: "w-[min(520px,92vw)]",
  md: "w-[min(720px,92vw)]",
  lg: "w-[min(960px,92vw)]",
  xl: "w-[min(1120px,92vw)]",
  auto: "w-[92vw] sm:w-auto",
};

/* =========================
   Component
========================= */
const Modal = forwardRef(function Modal(
  {
    open,
    isOpen, // ✅ compat: alguns componentes ainda mandam isOpen
    onClose,
    children,

    /* a11y */
    labelledBy,
    describedBy,
    ariaLabel,

    /* behavior */
    closeOnBackdrop = true,
    closeOnEscape = true,
    restoreFocus = true,
    lockScroll = true,

    /* focus */
    initialFocusRef,
    initialFocusSelector,

    /* visuals */
    className = "",
    overlayClassName = "",

    padding = true, // true -> p-5/p-6; false -> não força padding
    size = "lg", // sm|md|lg|xl|auto
    align = "center", // center|bottom (mobile bottom-sheet vibe)
    blur = true,
    shade = "dark", // dark|light
    showCloseButton = true,
    closeLabel = "Fechar modal",

    /* stacking */
    zIndex = 1000,

    /* callbacks */
    onAfterOpen,
    onAfterClose,

    /* advanced */
    allowOutsideClick = true, // se false, ignora click no backdrop mesmo com closeOnBackdrop
    preventCloseWhenBusy = false, // se true, bloqueia fechar quando aria-busy/disabled (você controla por onClose)
  },
  forwardedRef
) {
  const reduceMotion = useReducedMotion();

  // 🔎 render trace
  logM("render", {
    open,
    size,
    align,
    zIndex,
    closeOnBackdrop,
    closeOnEscape,
    lockScroll,
    showCloseButton,
  });

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const prevFocusRef = useRef(null);

  const openedOnceRef = useRef(false);
  const modalRootRef = useRef(null);

  const openFinal = !!(open ?? isOpen); // ✅ normaliza

  React.useImperativeHandle(forwardedRef, () => panelRef.current);

  const ariaLabelFinal = !labelledBy ? ariaLabel || "Janela modal" : undefined;

  // 🔎 render trace (agora com openFinal)
  logM("render", {
    open,
    isOpen,
    openFinal,
    size,
    align,
    zIndex,
    closeOnBackdrop,
    closeOnEscape,
    lockScroll,
    showCloseButton,
  });

  const motionOverlay = useMemo(() => {
    if (reduceMotion) return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  }, [reduceMotion]);

  const motionPanel = useMemo(() => {
    if (reduceMotion)
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } };

    return {
      initial: { scale: 0.98, opacity: 0, y: align === "bottom" ? 18 : 10 },
      animate: { scale: 1, opacity: 1, y: 0 },
      exit: { scale: 0.98, opacity: 0, y: align === "bottom" ? 18 : 10 },
      transition: { duration: 0.18 },
    };
  }, [reduceMotion, align]);

  const focusFirst = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let target =
      initialFocusRef?.current ||
      (initialFocusSelector ? panel.querySelector(initialFocusSelector) : null);

    if (!target) {
      const focusables = getFocusable(panel);
      target = focusables[0] || panel;
    }
    target?.focus?.();
  }, [initialFocusRef, initialFocusSelector]);

  // garante root do portal
  useEffect(() => {
    if (!openFinal) return;
    const node = ensureModalRoot();
    modalRootRef.current = node;
  
    logM("useEffect(openFinal): modalRootRef set", {
      exists: !!node,
      children: node?.childElementCount ?? null,
      inBody: node ? document.body.contains(node) : false,
    });
  }, [openFinal]);


  // foco ao abrir / restaurar ao fechar (RAF)
  useEffect(() => {
    if (openFinal) {
      openedOnceRef.current = true;
      prevFocusRef.current = document.activeElement;
  
      const id = raf(() => {
        focusFirst();
        onAfterOpen?.();
      });
      return () => caf(id);
    }
  
    if (!openedOnceRef.current) return;
  
    if (restoreFocus && prevFocusRef.current?.focus) {
      const id = raf(() => {
        prevFocusRef.current?.focus?.();
        onAfterClose?.();
      });
      return () => caf(id);
    }
  
    const id = raf(() => onAfterClose?.());
    return () => caf(id);
  }, [openFinal, restoreFocus, focusFirst, onAfterOpen, onAfterClose]);
  

  // ESC + Trap foco (capture)
  useEffect(() => {
    if (!openFinal) return;

    function onKeyDown(e) {
      const panel = panelRef.current;
      if (!panel) return;

      const active = document.activeElement;
      const focusInside = active && panel.contains(active);

      if (e.key === "Escape" && closeOnEscape) {
        if (focusInside) {
          e.stopPropagation();
          e.preventDefault();
          onClose?.();
        }
        return;
      }

      if (e.key !== "Tab" || !focusInside) return;

      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}, [openFinal, onClose, closeOnEscape]);

  // Scroll lock (counter)
  useEffect(() => {
    if (!lockScroll) return;
    if (!openFinal) return;
  
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [openFinal, lockScroll]);

  // Stack + a11y hide app roots somente no 1º modal
  useLayoutEffect(() => {
    if (!openFinal) return;
  
    const afterInc = incStack();
    logM("stack inc", { afterInc });
  
    if (afterInc === 1) {
      logM("hideAppRoots()");
      hideAppRoots();
    }
  
    return () => {
      const afterDec = decStack();
      logM("stack dec", { afterDec });
  
      if (afterDec === 0) {
        logM("restoreAppRoots()");
        restoreAppRoots();
      }
    };
  }, [openFinal]);

  // backdrop click (drag-safe)
  const mouseDownRef = useRef(false);
  function onBackdropMouseDown(e) {
    if (!closeOnBackdrop) return;
    if (!allowOutsideClick) return;
    if (e.target !== containerRef.current) return;
    mouseDownRef.current = true;
  }
  function onBackdropMouseUp(e) {
    if (!closeOnBackdrop) return;
    if (!allowOutsideClick) return;
    if (!mouseDownRef.current) return;
    mouseDownRef.current = false;

    if (e.target === containerRef.current) {
      if (preventCloseWhenBusy) return;
      onClose?.();
    }
  }

  const IS_DEV =
  (typeof import.meta !== "undefined" && import.meta?.env?.MODE !== "production") ||
  (typeof process !== "undefined" && process?.env?.NODE_ENV !== "production");

const warnedRef = useRef(false);

if (!openFinal) {
  // ✅ Modal fechado = caminho normal. Não é warning.
  // Só avisa 1x se o dev estiver passando props inconsistentes.
  if (IS_DEV && !warnedRef.current) {
    const bothMissing = open === undefined && isOpen === undefined;
    const bothFalsey = Boolean(open) === false && Boolean(isOpen) === false;

    if (!bothMissing && bothFalsey) {
      // (opcional) debug leve, 1 vez
      // console.debug("[Modal] closed", { open, isOpen });
    } else if (bothMissing) {
      console.debug("[Modal] closed (no open/isOpen prop)", { open, isOpen });
    }
    warnedRef.current = true;
  }
  return null;
}

  const mountNode = modalRootRef.current || ensureModalRoot();
  if (!mountNode) {
    warnM("return null (mountNode=null)");
    return null;
  }

  const overlayShade = shade === "light" ? "bg-black/25" : "bg-black/45";
  const overlayBlur = blur ? "backdrop-blur-[2px]" : "";
  const overlayAlign = align === "bottom" ? "items-end sm:items-center" : "items-center";
  const panelRadius = align === "bottom" ? "rounded-t-3xl sm:rounded-3xl" : "rounded-3xl";

  const content = (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        onMouseDown={onBackdropMouseDown}
        onMouseUp={onBackdropMouseUp}
        {...motionOverlay}
        className={cls(
          "fixed inset-0 flex justify-center",
          overlayAlign,
          overlayShade,
          overlayBlur,
          "p-2 sm:p-4",
          "pointer-events-auto",
          overlayClassName
        )}
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabelFinal}
      >
        {/* sentinela superior (focus wrap) */}
        <span
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => {
            const panel = panelRef.current;
            const focusables = getFocusable(panel);
            (focusables[focusables.length - 1] || panel)?.focus?.();
          }}
        />

        <motion.div
          ref={panelRef}
          tabIndex={-1}
          role="document"
          {...motionPanel}
          className={cls(
            "relative",
            panelRadius,
            "border border-zinc-200/70 dark:border-zinc-800",
            "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white",
            "shadow-[0_28px_90px_-54px_rgba(0,0,0,0.85)]",
            SIZE_MAP[size] || SIZE_MAP.lg,
            "max-h-[min(92vh,860px)]",
            "overflow-auto outline-none",
            "overscroll-contain touch-pan-y",
            "[scrollbar-gutter:stable]",
            padding ? "p-5 sm:p-6" : "",
            // ✅ melhora clique em iOS dentro de overlays
            "pointer-events-auto",
            className
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* glows premium (não interferem com clique) */}
          <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

          {showCloseButton && (
            <button
              type="button"
              onClick={preventCloseWhenBusy ? undefined : onClose}
              className={cls(
                "absolute top-3 right-3 sm:top-4 sm:right-4",
                "h-10 w-10 rounded-2xl grid place-items-center",
                "text-zinc-500 hover:text-rose-600",
                "bg-white/70 hover:bg-white",
                "dark:bg-zinc-900/70 dark:hover:bg-zinc-900",
                "border border-zinc-200/70 dark:border-zinc-800",
                "shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              )}
              aria-label={closeLabel}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                ×
              </span>
            </button>
          )}

          <div className="relative">{children}</div>
        </motion.div>

        {/* sentinela inferior (focus wrap) */}
        <span
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => {
            const panel = panelRef.current;
            const focusables = getFocusable(panel);
            (focusables[0] || panel)?.focus?.();
          }}
        />
      </motion.div>
    </AnimatePresence>
  );

  logM("createPortal -> mountNode", {
    mountId: mountNode?.id,
    mountChildrenBefore: mountNode?.childElementCount ?? null,
    mountInBody: mountNode ? document.body.contains(mountNode) : false,
  });

  // ✅ após o paint, checa se o portal realmente inseriu DOM
  if (IS_DEV) {
    setTimeout(() => {
      const r = document.getElementById("modal-root");
      logM("post-paint check", {
        modalRootExists: !!r,
        modalRootChildren: r?.childElementCount ?? null,
        stackCount: document.body?.dataset?.__modal_stack_count__ ?? null,
        scrollLockCount: document.body?.dataset?.__modal_scroll_lock_count__ ?? null,
      });
    }, 0);
  }

  return createPortal(content, mountNode);

});

export default Modal;
