// 📁 src/components/Modal.jsx — ÚNICO motor de modal (stack-safe, a11y, premium)
// - Portal em #modal-root (não no body direto)
// - Scroll lock com contador
// - aria-hidden/inert aplicado no app somente quando o 1º modal abre
// - Suporta modal sobre modal (confirmação etc.) sem travar clique

import React, { useEffect, useRef, forwardRef, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

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

function getFocusable(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE));
  return nodes.filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null
  );
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

/** =========================
 *  Roots (portal) + stack
 *  ========================= */
function ensureModalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

// contador global de modais abertos (stack)
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
function getStackCount() {
  const body = document.body;
  return Number(body.dataset[STACK_COUNT_KEY] || "0");
}

/** =========================
 *  Scroll lock (contador)
 *  ========================= */
const SCROLL_LOCK_KEY = "__modal_scroll_lock_count__";
function lockBodyScroll() {
  const doc = document.documentElement;
  const body = document.body;

  const count = Number(body.dataset[SCROLL_LOCK_KEY] || "0");
  if (count === 0) {
    const scrollBarWidth = window.innerWidth - doc.clientWidth;
    body.dataset.__modal_prev_overflow__ = body.style.overflow || "";
    body.dataset.__modal_prev_padding_right__ = body.style.paddingRight || "";

    body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `calc(${body.style.paddingRight || "0px"} + ${scrollBarWidth}px)`;
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

/** =========================
 *  A11y: hide app roots
 *  - aplica apenas quando stackCount vai de 0 -> 1
 *  - remove apenas quando volta a 0
 *  ========================= */
function getAppRootsToHide(modalRootId = "modal-root") {
  const bodyChildren = Array.from(document.body.children || []);
  return bodyChildren.filter((el) => el.id !== modalRootId);
}

function hideAppRoots() {
  const roots = getAppRootsToHide("modal-root");
  const canInert = supportsInert();

  // guarda estado anterior numa propriedade do próprio elemento
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

/** =========================
 *  Component
 *  ========================= */
const Modal = forwardRef(function Modal(
  {
    open,
    onClose,
    children,
    labelledBy,
    describedBy,
    ariaLabel,
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,
    initialFocusSelector,
    restoreFocus = true,
    lockScroll = true,
    className = "",
    overlayClassName = "", // opcional (se quiser sobrescrever)
    onAfterOpen,
    onAfterClose,
    hideCloseButton = false,
    closeLabel = "Fechar modal",
    zIndex = 1000, // ✅ agora controlável por modal (stack)
  },
  forwardedRef
) {
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const prevFocusRef = useRef(null);

  const openedOnceRef = useRef(false);
  const modalRootRef = useRef(null);

  React.useImperativeHandle(forwardedRef, () => panelRef.current);

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
    if (!open) return;
    modalRootRef.current = ensureModalRoot();
  }, [open]);

  // foco ao abrir / restaurar ao fechar (RAF)
  useEffect(() => {
    if (open) {
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
  }, [open, restoreFocus, focusFirst, onAfterOpen, onAfterClose]);

  // ESC + Trap foco (captura)
  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose, closeOnEscape]);

  // Scroll lock (contador)
  useEffect(() => {
    if (!lockScroll) return;
    if (!open) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open, lockScroll]);

  // ✅ Stack + a11y hide app roots somente no 1º modal
  useLayoutEffect(() => {
    if (!open) return;

    const afterInc = incStack();
    if (afterInc === 1) {
      // 0 -> 1
      hideAppRoots();
    }

    return () => {
      const afterDec = decStack();
      if (afterDec === 0) {
        restoreAppRoots();
      }
    };
  }, [open]);

  // clique no backdrop
  const mouseDownRef = useRef(false);
  function onBackdropMouseDown(e) {
    if (!closeOnBackdrop) return;
    if (e.target !== containerRef.current) return;
    mouseDownRef.current = true;
  }
  function onBackdropMouseUp(e) {
    if (!closeOnBackdrop) return;
    if (!mouseDownRef.current) return;
    mouseDownRef.current = false;
    if (e.target === containerRef.current) onClose?.();
  }

  if (!open) return null;

  const mountNode = modalRootRef.current || ensureModalRoot();
  if (!mountNode) return null;

  const ariaLabelFinal = !labelledBy ? ariaLabel || "Janela modal" : undefined;

  const content = (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        onMouseDown={onBackdropMouseDown}
        onMouseUp={onBackdropMouseUp}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cls(
          "fixed inset-0 flex items-center justify-center",
          "bg-black/45 backdrop-blur-[2px]",
          "p-2 sm:p-4",
          overlayClassName
        )}
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabelFinal}
      >
        {/* sentinela superior */}
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
          initial={{ scale: 0.97, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className={cls(
            "relative rounded-3xl",
            "border border-zinc-200/70 dark:border-zinc-800",
            "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white",
            "shadow-[0_24px_80px_-46px_rgba(0,0,0,0.75)]",
            "w-[min(960px,92vw)]",
            "max-h-[min(92vh,860px)]",
            "overflow-auto outline-none",
            "overscroll-contain touch-pan-y",
            "[scrollbar-gutter:stable]",
            "p-5 sm:p-6",
            className
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* glows */}
          <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className={cls(
                "absolute top-3 right-3 sm:top-4 sm:right-4",
                "h-10 w-10 rounded-2xl grid place-items-center",
                "text-zinc-500 hover:text-rose-600",
                "bg-white/60 hover:bg-white",
                "dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                "border border-zinc-200/70 dark:border-zinc-800",
                "shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              )}
              aria-label={closeLabel}
            >
              <span className="text-2xl leading-none" aria-hidden="true">×</span>
            </button>
          )}

          <div className="relative">{children}</div>
        </motion.div>

        {/* sentinela inferior */}
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

  return createPortal(content, mountNode);
});

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default Modal;
