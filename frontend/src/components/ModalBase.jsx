// 📁 src/components/ModalBase.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - level?: number (empilhamento; 0 evento, 1 turma, 2...).
 * - children: ReactNode
 * - maxWidth?: string Tailwind — default "max-w-2xl"
 * - labelledBy?: string
 * - describedBy?: string
 * - className?: string
 * - closeOnBackdrop?: boolean (default: true)
 * - closeOnEsc?: boolean (default: true)
 * - initialFocusRef?: React.RefObject<HTMLElement>
 * - debug?: boolean (default: false) — logs para depuração de cliques/stack
 * - debugName?: string (default: "ModalBase") — prefixo dos logs
 */

const FOCUSABLE_SEL = [
  "a[href]",
  "area[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/* ====================== Modal stack helpers ====================== */
function getAllModalContents() {
  return Array.from(document.querySelectorAll("[data-modal-content]"));
}

function getTopmostLevel() {
  const nodes = getAllModalContents();
  if (!nodes.length) return -Infinity;
  return nodes.reduce((acc, el) => {
    const lvl = Number(el.getAttribute("data-level") || 0);
    return Number.isFinite(lvl) ? Math.max(acc, lvl) : acc;
  }, -Infinity);
}

function isElementActuallyFocusable(el) {
  if (!el) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.tabIndex === -1) return false;

  const rect = el.getBoundingClientRect?.();
  if (!rect || (rect.width === 0 && rect.height === 0)) return false;

  const style = window.getComputedStyle?.(el);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;

  return true;
}

function getFocusable(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SEL));
  return nodes.filter(isElementActuallyFocusable);
}

/* ====================== Body scroll lock helpers ====================== */
function getScrollbarWidth() {
  try {
    return window.innerWidth - document.documentElement.clientWidth;
  } catch {
    return 0;
  }
}

/* ====================== ARIA app hiding (a11y) ====================== */
function getAppRootsToHide(modalRootId = "modal-root") {
  const bodyChildren = Array.from(document.body.children || []);
  return bodyChildren.filter((el) => el.id !== modalRootId);
}

/* ====================== Component ====================== */
export default function ModalBase({
  isOpen,
  onClose,
  level = 0,
  children,
  maxWidth = "max-w-2xl",
  labelledBy,
  describedBy,
  className = "",
  closeOnBackdrop = true,
  closeOnEsc = true,
  initialFocusRef,
  debug = false,
  debugName = "ModalBase",
}) {
  const [portalEl, setPortalEl] = useState(null);

  const dlog = useCallback(
    (...args) => {
      if (!debug) return;
      // eslint-disable-next-line no-console
      console.log(`[${debugName}]`, ...args);
    },
    [debug, debugName]
  );

  // Portal root (cria 1x)
  useEffect(() => {
    if (!isOpen) return;

    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
      dlog("created #modal-root");
    }
    setPortalEl(root);
  }, [isOpen, dlog]);

  // IDs ARIA estáveis
  const autoTitleId = useId();
  const autoDescId = useId();
  const titleId = labelledBy || `modal-title-${autoTitleId}`;
  const descId = describedBy || `modal-desc-${autoDescId}`;

  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const lastActiveRef = useRef(null);

  const openedOnceRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  const BASE_Z = 1000 + level * 20;

  const isTopmost = useCallback(() => {
    const top = getTopmostLevel();
    return level >= top;
  }, [level]);

  /* ====================== Debug snapshot (open) ====================== */
  useEffect(() => {
    if (!isOpen || !debug) return;
    const top = getTopmostLevel();
    dlog("OPEN", { level, BASE_Z, topmostLevel: top, isTopmost: isTopmost() });

    const stack = getAllModalContents().map((el) => ({
      level: Number(el.getAttribute("data-level") || 0),
      rect: el.getBoundingClientRect?.(),
    }));
    dlog("STACK contents:", stack);
  }, [isOpen, debug, dlog, level, BASE_Z, isTopmost]);

  /* ====================== Lock scroll (with gap) ====================== */
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    if (isTopmost()) {
      const sw = getScrollbarWidth();
      document.body.style.overflow = "hidden";
      if (sw > 0) document.body.style.paddingRight = `${sw}px`;
      dlog("scrollLock ON", { sw });
    } else {
      dlog("scrollLock skipped (not topmost)");
    }

    return () => {
      const top = getTopmostLevel();
      const stillHasAny = top > -Infinity;
      if (!stillHasAny) {
        document.body.style.overflow = prevOverflow || "";
        document.body.style.paddingRight = prevPaddingRight || "";
        dlog("scrollLock OFF (no modals left)");
      } else {
        dlog("scrollLock keep (another modal still open)", { top });
      }
    };
  }, [isOpen, isTopmost, dlog]);

  /* ====================== Hide app roots for a11y (topmost) ====================== */
  useEffect(() => {
    if (!isOpen) return;
    if (!isTopmost()) return;

    const roots = getAppRootsToHide("modal-root");
    const prev = new Map();

    for (const el of roots) {
      prev.set(el, el.getAttribute("aria-hidden"));
      el.setAttribute("aria-hidden", "true");
    }
    dlog("aria-hidden ON for app roots:", roots.map((r) => r.id || r.tagName));

    return () => {
      const top = getTopmostLevel();
      const stillHasAny = top > -Infinity;
      if (stillHasAny) {
        dlog("aria-hidden keep (another modal still open)", { top });
        return;
      }

      for (const [el, old] of prev.entries()) {
        if (old == null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", old);
      }
      dlog("aria-hidden OFF (no modals left)");
    };
  }, [isOpen, isTopmost, dlog]);

  /* ====================== Focus: only on closed→open + topmost ====================== */
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const justClosed = !isOpen && prevIsOpenRef.current;

    if (justOpened) {
      lastActiveRef.current = document.activeElement;
      openedOnceRef.current = false;

      const id = setTimeout(() => {
        if (!isOpen) return;
        const root = contentRef.current;
        if (!root) return;

        const active = document.activeElement;
        if (active && root.contains(active)) {
          openedOnceRef.current = true;
          dlog("focus already inside modal");
          return;
        }

        if (!isTopmost() || openedOnceRef.current) return;

        const el =
          initialFocusRef?.current ||
          root.querySelector("[data-initial-focus]") ||
          getFocusable(root)[0] ||
          root;

        el?.focus?.();
        openedOnceRef.current = true;
        dlog("focused", el?.tagName, el?.className);
      }, 0);

      return () => clearTimeout(id);
    }

    if (justClosed) {
      const prev = lastActiveRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          /* noop */
        }
      }
      openedOnceRef.current = false;
      dlog("restored focus to previous element");
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, isTopmost, initialFocusRef, dlog]);

  /* ====================== Keyboard: ESC + focus trap ====================== */
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      const root = contentRef.current;
      if (!root) return;

      const active = document.activeElement;
      const focusInside = active && root.contains(active);

      if (e.key === "Escape" && closeOnEsc) {
        if (isTopmost() && focusInside) {
          e.stopPropagation();
          e.preventDefault();
          dlog("ESC → close");
          onClose?.();
        } else {
          dlog("ESC ignored", { focusInside, isTopmost: isTopmost() });
        }
        return;
      }

      if (e.key === "Tab" && focusInside) {
        const nodes = getFocusable(root);
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose, closeOnEsc, isTopmost, dlog]);

  /* ====================== Backdrop click (topmost) ====================== */
  const pointerDownTarget = useRef(null);

  const onPointerDown = (e) => {
    pointerDownTarget.current = e.target;
    if (debug) {
      dlog("backdrop pointerDown", {
        targetIsBackdrop: e.target === overlayRef.current,
        topmostLevel: getTopmostLevel(),
        isTopmost: isTopmost(),
      });
    }
  };

  const onPointerUp = (e) => {
    if (!closeOnBackdrop) return;
    if (!isTopmost()) return;

    const down = pointerDownTarget.current;
    const up = e.target;

    if (debug) {
      dlog("backdrop pointerUp", {
        downIsBackdrop: down === overlayRef.current,
        upIsBackdrop: up === overlayRef.current,
      });
    }

    if (down === overlayRef.current && up === overlayRef.current) {
      dlog("closing by backdrop");
      onClose?.();
    }
  };

  /* ====================== Debug: global click probe (capture) ====================== */
  useEffect(() => {
    if (!isOpen || !debug) return;

    const handler = (e) => {
      const el = e.target;
      const overlay = overlayRef.current;
      const content = contentRef.current;
      const top = getTopmostLevel();

      dlog("CLICK CAPTURE", {
        target: el?.tagName,
        id: el?.id,
        class: typeof el?.className === "string" ? el.className : "[complex]",
        topmostLevel: top,
        thisLevel: level,
        isTopmost: isTopmost(),
        targetInsideThisContent: content ? content.contains(el) : false,
        targetIsThisBackdrop: overlay ? el === overlay : false,
      });
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isOpen, debug, dlog, level, isTopmost]);

  if (!isOpen || !portalEl) return null;

  const node = (
    <div
      role="presentation"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ zIndex: BASE_Z }}
      data-modal-container=""
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200"
        style={{ zIndex: BASE_Z }}
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        data-modal-backdrop=""
      />

      {/* Wrapper */}
      <div className="relative w-full sm:w-auto" style={{ zIndex: BASE_Z + 1 }} data-modal-wrapper="">
        {/* Dialog */}
        <div
          ref={contentRef}
          className={[
            "relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl outline-none",
            "max-h-[92vh] flex flex-col",
            maxWidth,
            "animate-[modalIn_180ms_ease-out] sm:animate-[modalInSm_180ms_ease-out]",
            className,
          ].join(" ")}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          data-modal-content=""
          data-level={level}
        >
          {/* ✅ Região rolável oficial do ModalBase */}
          <div className="overflow-y-auto overscroll-contain" data-modal-scroll-region="">
            {React.Children.toArray(children)}
          </div>

          {/* ARIA placeholders (somente se não passados) */}
          {!labelledBy && (
            <h2 id={titleId} className="sr-only">
              Janela modal
            </h2>
          )}
          {!describedBy && (
            <p id={descId} className="sr-only">
              Conteúdo de diálogo modal
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { transform: translateY(8%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes modalInSm {
          from { transform: translateY(6px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, portalEl);
}
