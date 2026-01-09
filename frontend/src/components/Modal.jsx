// 📁 src/components/Modal.jsx
import React, {
  useEffect,
  useRef,
  forwardRef,
  useCallback,
  useLayoutEffect,
} from "react";
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
      el.offsetParent !== null // evita elementos colapsados
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

/** Lock scroll com contador (suporta múltiplos modais) */
const SCROLL_LOCK_KEY = "__modal_scroll_lock_count__";
function lockBodyScroll() {
  const doc = document.documentElement;
  const body = document.body;

  const count = Number(body.dataset[SCROLL_LOCK_KEY] || "0");
  if (count === 0) {
    // Compensa largura do scrollbar para evitar “pulo” de layout
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

/** Esconde o resto da página para a11y (inert/aria-hidden) */
function setSiblingsHidden(mountNode, containerEl, hidden) {
  if (!mountNode || !containerEl) return;

  const siblings = Array.from(mountNode.children).filter((el) => el !== containerEl);
  const canInert = supportsInert();

  siblings.forEach((el) => {
    if (hidden) {
      if (canInert) el.inert = true;
      el.setAttribute("aria-hidden", "true");
    } else {
      if (canInert) el.inert = false;
      el.removeAttribute("aria-hidden");
    }
  });
}

const Modal = forwardRef(function Modal(
  {
    open,
    onClose,
    children,
    labelledBy, // id do título (preferível)
    describedBy, // id da descrição
    ariaLabel, // fallback se não tiver labelledBy
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,
    initialFocusSelector,
    restoreFocus = true,
    lockScroll = true,
    className = "",
    overlayClassName = "fixed inset-0 z-50 flex items-center justify-center bg-black/40",
    mountNode = typeof document !== "undefined" ? document.body : null,
    onAfterOpen,
    onAfterClose,
    hideCloseButton = false,
    closeLabel = "Fechar modal",
  },
  forwardedRef
) {
  const containerRef = useRef(null); // overlay/backdrop
  const panelRef = useRef(null); // painel
  const portalRootRef = useRef(null); // wrapper do portal (para aria-hidden/inert)
  const prevFocusRef = useRef(null);

  const closingRef = useRef(false);
  const openedOnceRef = useRef(false);

  // expõe o painel via forwardRef
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

  // Trap foco + ESC (captura) somente enquanto aberto
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape" && closeOnEscape) {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

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

  // Foco ao abrir + restaurar ao fechar (RAF ao invés de setTimeout)
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      openedOnceRef.current = true;
      prevFocusRef.current = document.activeElement;

      const id = raf(() => {
        focusFirst();
        onAfterOpen?.();
      });
      return () => caf(id);
    }

    // ao fechar
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

  // Lock scroll do body (com contador)
  useEffect(() => {
    if (!lockScroll) return;
    if (!open) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open, lockScroll]);

  // Esconde siblings via inert/aria-hidden enquanto aberto
  useLayoutEffect(() => {
    if (!mountNode) return;
    const root = portalRootRef.current;
    if (!root) return;

    if (open) {
      setSiblingsHidden(mountNode, root, true);
      return () => setSiblingsHidden(mountNode, root, false);
    }
  }, [open, mountNode]);

  // Clique no backdrop (robusto a “drag”)
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

  if (!mountNode) return null;

  // aria fallback seguro
  const ariaLabelFinal = !labelledBy ? ariaLabel || "Janela modal" : undefined;

  const content = (
    <div ref={portalRootRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={containerRef}
            onMouseDown={onBackdropMouseDown}
            onMouseUp={onBackdropMouseUp}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cls(
              overlayClassName,
              // premium overlay
              "bg-black/45 backdrop-blur-[2px]"
            )}
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
                // se alguém “pular” pro topo, manda pro último foco possível
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
                // painel premium
                "relative rounded-3xl",
                "border border-zinc-200/70 dark:border-zinc-800",
                "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white",
                "shadow-[0_24px_80px_-46px_rgba(0,0,0,0.75)]",
                // responsivo / mobile first
                "w-[min(960px,92vw)]",
                "max-h-[min(92vh,860px)]",
                "overflow-auto outline-none",
                "overscroll-contain touch-pan-y",
                // melhora estabilidade visual do scroll
                "[scrollbar-gutter:stable]",
                // padding base
                "p-5 sm:p-6",
                className
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* glow interno sutil */}
              <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cls(
                    "absolute top-3 right-3 sm:top-4 sm:right-4",
                    "h-10 w-10 rounded-2xl",
                    "grid place-items-center",
                    "text-zinc-500 hover:text-rose-600",
                    "bg-white/60 hover:bg-white",
                    "dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
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

            {/* sentinela inferior */}
            <span
              tabIndex={0}
              aria-hidden="true"
              onFocus={() => {
                // se alguém “pular” pro fim, manda pro primeiro foco possível
                const panel = panelRef.current;
                const focusables = getFocusable(panel);
                (focusables[0] || panel)?.focus?.();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(content, mountNode);
});

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default Modal;
