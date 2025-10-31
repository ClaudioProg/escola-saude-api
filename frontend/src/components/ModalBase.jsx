// 📁 src/components/ModalBase.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - level?: number (empilhamento; 0 evento, 1 turma, 2...)
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
  "[contenteditable]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Lê todos os modais abertos no DOM e retorna o maior "data-level"
function getTopmostLevel() {
  const nodes = Array.from(document.querySelectorAll("[data-modal-content]"));
  if (!nodes.length) return -Infinity;
  return nodes.reduce((acc, el) => {
    const lvl = Number(el.getAttribute("data-level") || 0);
    return Number.isFinite(lvl) ? Math.max(acc, lvl) : acc;
  }, -Infinity);
}

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

  // 🔧 chaves do problema original
  const openedOnceRef = useRef(false); // indica se já inicializamos foco nesta abertura
  const prevIsOpenRef = useRef(false); // detecta transição fechado→aberto

  const BASE_Z = 1000 + level * 20;

  // trava scroll ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // 🔒 Foco inicial — SOMENTE na transição de fechado → aberto e apenas se for topmost
  useEffect(() => {
    // transição
    const justOpened = isOpen && !prevIsOpenRef.current;
    const justClosed = !isOpen && prevIsOpenRef.current;

    if (justOpened) {
      lastActiveRef.current = document.activeElement; // para restaurar depois
      openedOnceRef.current = false; // vamos focar uma vez

      // roda no próximo tick para garantir DOM montado
      const id = setTimeout(() => {
        if (!isOpen) return;
        const root = contentRef.current;
        if (!root) return;

        // não roubar se já há foco dentro
        const active = document.activeElement;
        if (active && root.contains(active)) {
          openedOnceRef.current = true;
          return;
        }

        const top = getTopmostLevel();
        const isTopmost = level >= top;
        if (!isTopmost || openedOnceRef.current) return;

        const el =
          initialFocusRef?.current ||
          root.querySelector("[data-initial-focus]") ||
          root.querySelector(FOCUSABLE_SEL) ||
          root;

        el?.focus?.();
        openedOnceRef.current = true; // ✅ não vai mais focar nessa abertura
      }, 0);

      return () => clearTimeout(id);
    }

    if (justClosed) {
      // Restaurar foco anterior ao fechar
      const prev = lastActiveRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {}
      }
      openedOnceRef.current = false; // reseta para a próxima abertura
    }

    // marca estado atual
    prevIsOpenRef.current = isOpen;
  }, [isOpen, level, initialFocusRef]);

  // Teclado: ESC só fecha se topmost + foco dentro; Tab trap apenas dentro do modal
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      const root = contentRef.current;
      if (!root) return;
      const active = document.activeElement;
      const focusInside = active && root.contains(active);
      const top = getTopmostLevel();
      const isTopmost = level >= top;

      if (e.key === "Escape" && closeOnEsc) {
        if (isTopmost && focusInside) {
          e.stopPropagation();
          e.preventDefault();
          onClose?.();
        }
        return;
      }

      if (e.key === "Tab" && focusInside) {
        const nodes = Array.from(root.querySelectorAll(FOCUSABLE_SEL));
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
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, onClose, closeOnEsc, level]);

  // clique fora: fecha só se topmost
  const mouseDownTarget = useRef(null);
  const onMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };
  const onMouseUp = (e) => {
    if (!closeOnBackdrop) return;
    const top = getTopmostLevel();
    const isTopmost = level >= top;
    if (!isTopmost) return;

    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
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
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        data-modal-backdrop=""
      />

      {/* Wrapper centralizador */}
      <div
        className="relative w-full sm:w-auto"
        style={{ zIndex: BASE_Z + 1 }}
        data-modal-wrapper=""
      >
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
