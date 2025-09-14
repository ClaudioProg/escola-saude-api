// 📁 src/components/Modal.jsx
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export default function Modal({
  open,
  onClose,
  children,
  labelledBy,          // id do título (preferível)
  describedBy,         // id da descrição
  ariaLabel,           // fallback se não tiver labelledBy
  closeOnBackdrop = true,
  initialFocusRef,     // ref para focar ao abrir
  restoreFocus = true,
  lockScroll = true,
  className = "",
}) {
  const containerRef = useRef(null); // wrapper clicável (backdrop)
  const panelRef = useRef(null);     // caixa do modal
  const prevFocusRef = useRef(null);
  const prevOverflowRef = useRef("");

  // Fecha no ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") trapFocus(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Foco ao abrir + restaurar ao fechar
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement;

      // tenta focar target preferido > 1º foco disponível > o próprio panel
      const toFocus =
        initialFocusRef?.current ||
        panelRef.current?.querySelector(FOCUSABLE) ||
        panelRef.current;

      setTimeout(() => toFocus?.focus?.(), 0);
    } else if (restoreFocus) {
      setTimeout(() => prevFocusRef.current?.focus?.(), 0);
    }
  }, [open, initialFocusRef, restoreFocus]);

  // Bloqueia scroll do body
  useEffect(() => {
    if (!lockScroll) return;
    if (open) {
      prevOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflowRef.current || "";
      };
    }
  }, [open, lockScroll]);

  function onBackdropClick(e) {
    if (!closeOnBackdrop) return;
    if (e.target === containerRef.current) onClose?.();
  }

  // Focus trap (Tab/Shift+Tab mantém foco dentro do modal)
  function trapFocus(e) {
    const panel = panelRef.current;
    if (!panel) return;

    const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
    );

    if (nodes.length === 0) {
      // evita sair do modal se não houver focáveis
      e.preventDefault();
      panel.focus();
      return;
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;

    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    }
  }

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          onMouseDown={onBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-label={!labelledBy ? ariaLabel : undefined}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={[
              "relative bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-lg",
              "min-w-[300px] max-w-[90vw] max-h-[90vh] overflow-auto outline-none",
              className,
            ].join(" ")}
            // evita que clique dentro dispare o fechamento do backdrop
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Botão fechar acessível */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl leading-none"
              aria-label="Fechar modal"
            >
              ×
            </button>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal evita conflitos de empilhamento/z-index
  return createPortal(content, document.body);
}
