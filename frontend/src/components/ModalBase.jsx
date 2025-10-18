// 📁 src/components/ModalBase.jsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - level?: number (empilhamento; 0 evento, 1 turma, 2...)
 * - children: ReactNode | ReactNode[]
 * - maxWidth?: string Tailwind (ex.: "max-w-3xl") — default "max-w-2xl"
 * - labelledBy?: string (id de um título dentro do modal)
 * - describedBy?: string (id de uma descrição dentro do modal)
 * - className?: string (classes extras para o container visual)
 * - closeOnBackdrop?: boolean (default: true)
 * - closeOnEsc?: boolean (default: true)
 * - initialFocusRef?: React.RefObject<HTMLElement>
 */

// Garante o root do portal
const ensureModalRoot = () => {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
};

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
  if (!isOpen) return null;

  const modalRoot = ensureModalRoot();
  const BASE_Z = 1000 + level * 20;

  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const lastActiveRef = useRef(null);

  // IDs ARIA estáveis e **sempre presentes** (evita alternar estrutura)
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);
  const descIdRef = useRef(`modal-desc-${Math.random().toString(36).slice(2)}`);

  // 🔒 trava scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 🎯 foco + ESC + restaura foco
  useEffect(() => {
    lastActiveRef.current = document.activeElement;

    const focusFallback = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const first = contentRef.current?.querySelector(FOCUSABLE_SEL);
      if (first) first.focus();
      else contentRef.current?.focus();
    };

    const t = setTimeout(focusFallback, 10);

    const onKeyDown = (e) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const nodes = Array.from(contentRef.current?.querySelectorAll(FOCUSABLE_SEL) ?? []);
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const current = document.activeElement;

        if (e.shiftKey) {
          if (current === first || !contentRef.current.contains(current)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (current === last || !contentRef.current.contains(current)) {
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
  }, [onClose, closeOnEsc, initialFocusRef]);

  // 🧱 normaliza filhos para array com keys estáveis
  const safeChildren = React.Children.toArray(children);

  // 🖱️ backdrop
  const handleBackdropClick = () => {
    if (!closeOnBackdrop) return;
    onClose?.();
  };

  // Estrutura fixa quando aberto
  const node = (
    <div
      ref={containerRef}
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ zIndex: BASE_Z }}
      data-modal-container=""
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200"
        style={{ zIndex: BASE_Z }}
        aria-hidden="true"
        onMouseDown={handleBackdropClick}
        data-modal-backdrop=""
      />

      {/* Wrapper de centralização */}
      <div
        className="relative w-full sm:w-auto"
        style={{ zIndex: BASE_Z + 1 }}
        data-modal-wrapper=""
      >
        {/* Diálogo */}
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
          aria-labelledby={labelledBy || titleIdRef.current}
          aria-describedby={describedBy || descIdRef.current}
          data-modal-content=""
        >
          {/* Área rolável do conteúdo */}
          <div className="overflow-y-auto overscroll-contain" data-modal-scroll-region="">
            {safeChildren}
          </div>

          {/* ⚠️ SEMPRE presentes — mantêm árvore estável */}
          <h2 id={titleIdRef.current} className="sr-only">
            Janela modal
          </h2>
          <p id={descIdRef.current} className="sr-only">
            Conteúdo de diálogo modal
          </p>
        </div>
      </div>

      {/* Keyframes locais */}
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

  return createPortal(node, modalRoot);
}
