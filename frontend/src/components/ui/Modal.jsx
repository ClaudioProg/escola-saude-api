// ✅ src/components/ui/Modal.jsx — v2.0
// Plataforma Escola da Saúde
//
// Motor global oficial de modal.
//
// Revisão premium:
// - componente genérico real de UI;
// - portal em #modal-root;
// - stack-safe para múltiplos modais;
// - scroll lock com contador;
// - inert/aria-hidden no app enquanto modal está aberto;
// - foco inicial, focus trap e restauração de foco;
// - fechamento por backdrop e Escape configurável;
// - bloqueio de fechamento quando busy;
// - mobile-first com fullscreen opcional;
// - reduced motion;
// - dark mode;
// - sem logs em produção;
// - sem dependência de hacks por domínio.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const MODAL_ROOT_ID = "modal-root";
const STACK_COUNT_KEY = "__modal_stack_count__";
const SCROLL_LOCK_KEY = "__modal_scroll_lock_count__";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

const SIZE_CLASSES = {
  sm: "sm:w-[min(520px,92vw)]",
  md: "sm:w-[min(720px,92vw)]",
  lg: "sm:w-[min(960px,92vw)]",
  xl: "sm:w-[min(1120px,92vw)]",
  auto: "sm:w-auto",
  full: "sm:w-[min(1280px,94vw)]",
};

const SHADE_CLASSES = {
  dark: "bg-black/45",
  darker: "bg-black/60",
  light: "bg-black/25",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function requestFrame(callback) {
  if (!isBrowser()) return 0;
  return window.requestAnimationFrame(callback);
}

function cancelFrame(id) {
  if (!isBrowser() || !id) return;
  window.cancelAnimationFrame(id);
}

function supportsInert() {
  return typeof HTMLElement !== "undefined" && "inert" in HTMLElement.prototype;
}

function ensureModalRoot() {
  if (!isBrowser()) return null;

  let root = document.getElementById(MODAL_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = MODAL_ROOT_ID;
    document.body.appendChild(root);
  }

  return root;
}

function getScrollbarWidth() {
  if (!isBrowser()) return 0;

  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function incrementBodyDatasetCounter(key) {
  const body = document.body;
  const next = Number(body.dataset[key] || "0") + 1;

  body.dataset[key] = String(next);

  return next;
}

function decrementBodyDatasetCounter(key) {
  const body = document.body;
  const next = Math.max(0, Number(body.dataset[key] || "0") - 1);

  body.dataset[key] = String(next);

  return next;
}

function lockBodyScroll() {
  if (!isBrowser()) return;

  const body = document.body;
  const count = Number(body.dataset[SCROLL_LOCK_KEY] || "0");

  if (count === 0) {
    const scrollbarWidth = getScrollbarWidth();

    body.dataset.__modal_prev_overflow__ = body.style.overflow || "";
    body.dataset.__modal_prev_padding_right__ = body.style.paddingRight || "";

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `calc(${body.style.paddingRight || "0px"} + ${scrollbarWidth}px)`;
    }
  }

  body.dataset[SCROLL_LOCK_KEY] = String(count + 1);
}

function unlockBodyScroll() {
  if (!isBrowser()) return;

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

function getAppRootsToHide() {
  if (!isBrowser()) return [];

  return Array.from(document.body.children || []).filter(
    (element) => element.id !== MODAL_ROOT_ID
  );
}

function hideAppRoots() {
  if (!isBrowser()) return;

  const canUseInert = supportsInert();

  getAppRootsToHide().forEach((element) => {
    if (element.dataset.__modal_prev_aria_hidden__ == null) {
      const previous = element.getAttribute("aria-hidden");
      element.dataset.__modal_prev_aria_hidden__ =
        previous == null ? "__null__" : previous;
    }

    element.setAttribute("aria-hidden", "true");

    if (canUseInert) {
      element.inert = true;
    }
  });
}

function restoreAppRoots() {
  if (!isBrowser()) return;

  const canUseInert = supportsInert();

  getAppRootsToHide().forEach((element) => {
    const previous = element.dataset.__modal_prev_aria_hidden__;

    if (previous === "__null__" || previous == null) {
      element.removeAttribute("aria-hidden");
    } else {
      element.setAttribute("aria-hidden", previous);
    }

    delete element.dataset.__modal_prev_aria_hidden__;

    if (canUseInert) {
      element.inert = false;
    }
  });
}

function isElementFocusable(element) {
  if (!element || !isBrowser()) return false;

  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.tabIndex === -1) return false;

  const style = window.getComputedStyle?.(element);

  if (style && (style.display === "none" || style.visibility === "hidden")) {
    return false;
  }

  const rect = element.getBoundingClientRect?.();

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return false;
  }

  return true;
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isElementFocusable
  );
}

function mapMaxWidthToSize(maxWidth) {
  const value = String(maxWidth || "");

  if (!value) return null;

  if (value.includes("max-w-sm")) return "sm";
  if (value.includes("max-w-md")) return "md";
  if (value.includes("max-w-lg")) return "lg";
  if (value.includes("max-w-xl")) return "xl";
  if (value.includes("max-w-2xl")) return "xl";
  if (value.includes("max-w-3xl")) return "xl";
  if (value.includes("max-w-4xl")) return "xl";
  if (value.includes("max-w-5xl")) return "full";
  if (value.includes("max-w-6xl")) return "full";
  if (value.includes("max-w-7xl")) return "full";

  return null;
}

const Modal = forwardRef(function Modal(
  {
    open,
    isOpen,
    onClose,
    children,

    labelledBy,
    describedBy,
    ariaLabel,

    closeOnBackdrop = true,
    closeOnEscape = true,
    restoreFocus = true,
    lockScroll = true,

    initialFocusRef,
    initialFocusSelector,

    className = "",
    overlayClassName = "",

    padding = true,
    size = "lg",
    align = "center",
    blur = true,
    shade = "dark",
    showCloseButton = true,
    closeLabel = "Fechar modal",

    zIndex = 1000,

    onAfterOpen,
    onAfterClose,

    allowOutsideClick = true,
    preventCloseWhenBusy = false,

    scroll = "panel",
    mobileFullScreen = true,

    maxWidth,
  },
  forwardedRef
) {
  const reduceMotion = useReducedMotion();

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const openedOnceRef = useRef(false);
  const modalRootRef = useRef(null);
  const pointerDownOnBackdropRef = useRef(false);

  const openFinal = Boolean(open ?? isOpen);

  useImperativeHandle(forwardedRef, () => panelRef.current);

  const ariaLabelFinal = labelledBy ? undefined : ariaLabel || "Janela modal";

  const sizeFinal = useMemo(() => {
    const mappedSize = mapMaxWidthToSize(maxWidth);

    if (size && size !== "lg") {
      return size;
    }

    return mappedSize || size;
  }, [maxWidth, size]);

  const overlayMotion = useMemo(() => {
    if (reduceMotion) {
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      };
    }

    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.16 },
    };
  }, [reduceMotion]);

  const panelMotion = useMemo(() => {
    if (reduceMotion) {
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      };
    }

    return {
      initial: {
        opacity: 0,
        scale: 0.98,
        y: align === "bottom" ? 18 : 10,
      },
      animate: {
        opacity: 1,
        scale: 1,
        y: 0,
      },
      exit: {
        opacity: 0,
        scale: 0.98,
        y: align === "bottom" ? 18 : 10,
      },
      transition: {
        duration: 0.18,
        ease: "easeOut",
      },
    };
  }, [align, reduceMotion]);

  const focusInitialElement = useCallback(() => {
    const panel = panelRef.current;

    if (!panel) return;

    let target =
      initialFocusRef?.current ||
      (initialFocusSelector ? panel.querySelector(initialFocusSelector) : null);

    if (!target) {
      const focusableElements = getFocusableElements(panel);
      target = focusableElements[0] || panel;
    }

    target?.focus?.();
  }, [initialFocusRef, initialFocusSelector]);

  const requestClose = useCallback(() => {
    if (preventCloseWhenBusy) {
      return;
    }

    onClose?.();
  }, [onClose, preventCloseWhenBusy]);

  useEffect(() => {
    if (!openFinal) return;

    modalRootRef.current = ensureModalRoot();
  }, [openFinal]);

  useEffect(() => {
    if (!openFinal || !isBrowser()) return undefined;

    openedOnceRef.current = true;
    previousFocusRef.current = document.activeElement;

    const frameId = requestFrame(() => {
      focusInitialElement();
      onAfterOpen?.();
    });

    return () => cancelFrame(frameId);
  }, [focusInitialElement, onAfterOpen, openFinal]);

  useEffect(() => {
    if (openFinal || !openedOnceRef.current || !isBrowser()) {
      return undefined;
    }

    const frameId = requestFrame(() => {
      if (restoreFocus && previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }

      onAfterClose?.();
    });

    return () => cancelFrame(frameId);
  }, [onAfterClose, openFinal, restoreFocus]);

  useEffect(() => {
    if (!openFinal || !isBrowser()) return undefined;

    function handleKeyDown(event) {
      const panel = panelRef.current;

      if (!panel) return;

      const activeElement = document.activeElement;
      const focusInside = activeElement && panel.contains(activeElement);

      if (event.key === "Escape" && closeOnEscape) {
        if (focusInside) {
          event.stopPropagation();
          event.preventDefault();
          requestClose();
        }

        return;
      }

      if (event.key !== "Tab" || !focusInside) {
        return;
      }

      const focusableElements = getFocusableElements(panel);

      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeOnEscape, openFinal, requestClose]);

  useEffect(() => {
    if (!openFinal || !lockScroll || !isBrowser()) {
      return undefined;
    }

    lockBodyScroll();

    return () => unlockBodyScroll();
  }, [lockScroll, openFinal]);

  useLayoutEffect(() => {
    if (!openFinal || !isBrowser()) {
      return undefined;
    }

    const stackCount = incrementBodyDatasetCounter(STACK_COUNT_KEY);

    if (stackCount === 1) {
      hideAppRoots();
    }

    return () => {
      const nextStackCount = decrementBodyDatasetCounter(STACK_COUNT_KEY);

      if (nextStackCount === 0) {
        restoreAppRoots();
      }
    };
  }, [openFinal]);

  const handleBackdropPointerDown = useCallback(
    (event) => {
      if (!closeOnBackdrop || !allowOutsideClick) return;
      if (event.target !== containerRef.current) return;

      pointerDownOnBackdropRef.current = true;
    },
    [allowOutsideClick, closeOnBackdrop]
  );

  const handleBackdropPointerUp = useCallback(
    (event) => {
      if (!closeOnBackdrop || !allowOutsideClick) return;

      if (!pointerDownOnBackdropRef.current) {
        return;
      }

      pointerDownOnBackdropRef.current = false;

      if (event.target === containerRef.current) {
        requestClose();
      }
    },
    [allowOutsideClick, closeOnBackdrop, requestClose]
  );

  const handleBackdropPointerCancel = useCallback(() => {
    pointerDownOnBackdropRef.current = false;
  }, []);

  if (!openFinal) {
    return null;
  }

  const mountNode = modalRootRef.current || ensureModalRoot();

  if (!mountNode) {
    return null;
  }

  const overlayShade = SHADE_CLASSES[shade] || SHADE_CLASSES.dark;
  const overlayBlur = blur ? "backdrop-blur-[2px]" : "";
  const overlayPadding = mobileFullScreen ? "p-0 sm:p-4" : "p-2 sm:p-4";
  const overlayAlign =
    align === "bottom" ? "items-end sm:items-center" : "items-center";

  const panelRadius = mobileFullScreen
    ? align === "bottom"
      ? "rounded-t-3xl sm:rounded-3xl"
      : "rounded-none sm:rounded-3xl"
    : align === "bottom"
      ? "rounded-t-3xl sm:rounded-3xl"
      : "rounded-3xl";

  const panelSizeClass = SIZE_CLASSES[sizeFinal] || SIZE_CLASSES.lg;

  const panelSize = mobileFullScreen
    ? classNames(
        "h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw]",
        "sm:h-auto sm:max-h-[min(92vh,860px)]",
        panelSizeClass
      )
    : classNames(panelSizeClass, "max-h-[min(92vh,860px)]");

  const panelOverflow = scroll === "content" ? "overflow-hidden" : "overflow-auto";
  const panelPadding = padding ? "p-5 sm:p-6" : "";

  const modal = (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        {...overlayMotion}
        className={classNames(
          "fixed inset-0 flex justify-center",
          overlayAlign,
          overlayShade,
          overlayBlur,
          overlayPadding,
          "overscroll-none touch-manipulation",
          "pointer-events-auto",
          overlayClassName
        )}
        style={{ zIndex }}
        onPointerDown={handleBackdropPointerDown}
        onPointerUp={handleBackdropPointerUp}
        onPointerCancel={handleBackdropPointerCancel}
      >
        <span
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => {
            const panel = panelRef.current;
            const focusableElements = getFocusableElements(panel);

            (focusableElements[focusableElements.length - 1] || panel)?.focus?.();
          }}
        />

        <motion.div
          ref={panelRef}
          {...panelMotion}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-label={ariaLabelFinal}
          className={classNames(
            "relative min-h-0 outline-none",
            panelRadius,
            "border border-slate-200/80 bg-white text-slate-950 shadow-[0_28px_90px_-54px_rgba(0,0,0,0.85)]",
            "dark:border-slate-800 dark:bg-slate-950 dark:text-white",
            panelSize,
            panelOverflow,
            "overscroll-contain touch-pan-y [scrollbar-gutter:stable]",
            mobileFullScreen && "pb-[env(safe-area-inset-bottom)]",
            panelPadding,
            "pointer-events-auto",
            className
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

          {showCloseButton && (
            <button
              type="button"
              onClick={requestClose}
              disabled={preventCloseWhenBusy}
              className={classNames(
                "absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-2xl",
                "border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition",
                "hover:bg-white hover:text-rose-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-rose-300"
              )}
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          <div className="relative min-h-0">{children}</div>
        </motion.div>

        <span
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => {
            const panel = panelRef.current;
            const focusableElements = getFocusableElements(panel);

            (focusableElements[0] || panel)?.focus?.();
          }}
        />
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, mountNode);
});

Modal.propTypes = {
  open: PropTypes.bool,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  children: PropTypes.node.isRequired,
  labelledBy: PropTypes.string,
  describedBy: PropTypes.string,
  ariaLabel: PropTypes.string,
  closeOnBackdrop: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  restoreFocus: PropTypes.bool,
  lockScroll: PropTypes.bool,
  initialFocusRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  initialFocusSelector: PropTypes.string,
  className: PropTypes.string,
  overlayClassName: PropTypes.string,
  padding: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(["none"])]),
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "auto", "full"]),
  align: PropTypes.oneOf(["center", "bottom"]),
  blur: PropTypes.bool,
  shade: PropTypes.oneOf(["dark", "darker", "light"]),
  showCloseButton: PropTypes.bool,
  closeLabel: PropTypes.string,
  zIndex: PropTypes.number,
  onAfterOpen: PropTypes.func,
  onAfterClose: PropTypes.func,
  allowOutsideClick: PropTypes.bool,
  preventCloseWhenBusy: PropTypes.bool,
  scroll: PropTypes.oneOf(["panel", "content"]),
  mobileFullScreen: PropTypes.bool,
  maxWidth: PropTypes.string,
};

export default Modal;