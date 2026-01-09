// 📁 src/components/ModalBase.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from "react";
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

  // evita elementos invisíveis / colapsados
  const rect = el.getBoundingClientRect?.();
  if (!rect || (rect.width === 0 && rect.height === 0)) return false;

  // se estiver display:none, offsetParent costuma ser null (mas cuidado: position:fixed)
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
  // Esconde tudo exceto o modal-root (e qualquer coisa que já esteja aria-hidden)
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
}) {
  const [portalEl, setPortalEl] = useState(null);

  // Portal root (cria 1x)
  useEffect(() => {
    if (!isOpen) return;

    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }
    setPortalEl(root);
  }, [isOpen]);

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

  /* ====================== Lock scroll (with gap) ====================== */
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Só aplica se for o topmost (melhor com múltiplos empilhados)
    if (isTopmost()) {
      const sw = getScrollbarWidth();
      document.body.style.overflow = "hidden";
      if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    }

    return () => {
      // restaura apenas quando FECHA este modal e ele era topmost
      // (se outro modal acima ainda está aberto, não desfaz)
      const top = getTopmostLevel();
      const stillHasTop = top > -Infinity;
      if (!stillHasTop) {
        document.body.style.overflow = prevOverflow || "";
        document.body.style.paddingRight = prevPaddingRight || "";
      }
    };
  }, [isOpen, isTopmost]);

  /* ====================== Hide app roots for a11y (topmost) ====================== */
  useEffect(() => {
    if (!isOpen) return;

    // só o topmost deve "mandar" no aria-hidden do app
    if (!isTopmost()) return;

    const roots = getAppRootsToHide("modal-root");
    const prev = new Map();

    for (const el of roots) {
      prev.set(el, el.getAttribute("aria-hidden"));
      el.setAttribute("aria-hidden", "true");
    }

    return () => {
      // só restaura se não houver outro modal aberto
      const top = getTopmostLevel();
      const stillHasAny = top > -Infinity;
      if (stillHasAny) return;

      for (const [el, old] of prev.entries()) {
        if (old == null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", old);
      }
    };
  }, [isOpen, isTopmost]);

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
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, isTopmost, initialFocusRef]);

  /* ====================== Keyboard: ESC + focus trap ====================== */
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      const root = contentRef.current;
      if (!root) return;

      const active = document.activeElement;
      const focusInside = active && root.contains(active);

      // ESC: só topmost + foco dentro
      if (e.key === "Escape" && closeOnEsc) {
        if (isTopmost() && focusInside) {
          e.stopPropagation();
          e.preventDefault();
          onClose?.();
        }
        return;
      }

      // TAB trap só se foco dentro
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
  }, [isOpen, onClose, closeOnEsc, isTopmost]);

  /* ====================== Backdrop click (topmost) ====================== */
  const pointerDownTarget = useRef(null);

  const onPointerDown = (e) => {
    pointerDownTarget.current = e.target;
  };

  const onPointerUp = (e) => {
    if (!closeOnBackdrop) return;
    if (!isTopmost()) return;

    // fecha apenas se down e up foram no backdrop (evita arrasto)
    const down = pointerDownTarget.current;
    const up = e.target;

    if (down === overlayRef.current && up === overlayRef.current) {
      onClose?.();
    }
  };

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

      {/* Wrapper centralizador */}
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
