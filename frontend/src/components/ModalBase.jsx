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
 * - maxWidth?: string Tailwind (ex.: "max-w-3xl") — default "max-w-2xl"
 * - labelledBy?: string (id de um título dentro do modal)
 * - describedBy?: string (id de uma descrição dentro do modal)
 * - className?: string (classes extras)
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
  // ⚠️ nunca crie nós DOM no render; faça em efeitos
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

  // IDs ARIA estáveis por render (sem Math.random)
  const autoTitleId = useId();
  const autoDescId = useId();
  const titleId = labelledBy || `modal-title-${autoTitleId}`;
  const descId = describedBy || `modal-desc-${autoDescId}`;

  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const lastActiveRef = useRef(null);
  const mouseDownTarget = useRef(null);

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

  // foco + trap + ESC + restaura foco
  useEffect(() => {
    if (!isOpen) return;

    lastActiveRef.current = document.activeElement;

    const focusFallback = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const first = contentRef.current?.querySelector(FOCUSABLE_SEL);
      if (first) first.focus();
      else contentRef.current?.focus?.();
    };
    const t = setTimeout(focusFallback, 10);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const nodes = Array.from(contentRef.current?.querySelectorAll(FOCUSABLE_SEL) || []);
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const cur = document.activeElement;

        if (e.shiftKey) {
          if (cur === first || !contentRef.current.contains(cur)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (cur === last || !contentRef.current.contains(cur)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown, true);
      if (lastActiveRef.current && typeof lastActiveRef.current.focus === "function") {
        lastActiveRef.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEsc, initialFocusRef]);

  // clique fora (robusto: considera mousedown+mouseup no overlay)
  const onMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };
  const onMouseUp = (e) => {
    if (!closeOnBackdrop) return;
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose?.();
    }
  };

  if (!isOpen || !portalEl) return null;

  // 🔒 Árvore 100% estável dentro do portal (sempre um único nó raiz)
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
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200"
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
            "relative",
            "bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl outline-none",
            "max-h-[92vh] flex flex-col",
            maxWidth,
            "motion-safe:animate-[modalIn_180ms_ease-out] sm:motion-safe:animate-[modalInSm_180ms_ease-out]",
            className,
          ].join(" ")}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          data-modal-content=""
        >
          {/* Região rolável do conteúdo */}
          <div className="overflow-y-auto overscroll-contain" data-modal-scroll-region="">
            {React.Children.toArray(children)}
          </div>

          {/* Elementos ARIA sempre presentes (mantêm estrutura idêntica) */}
          <h2 id={titleId} className="sr-only">
            Janela modal
          </h2>
          <p id={descId} className="sr-only">
            Conteúdo de diálogo modal
          </p>
        </div>
      </div>

      {/* Keyframes locais (estáticos) */}
      <style>{`
        @keyframes modalIn {
          from { transform: translateY(8%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes modalInSm {
          from { transform: translateY(6px) scale(0.98); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(node, portalEl);
}
