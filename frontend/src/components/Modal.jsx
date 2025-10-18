// 📁 src/components/Modal.jsx
import React, { useEffect, useRef, forwardRef, useCallback } from "react";
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
].join(',');

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

const Modal = forwardRef(function Modal(
  {
    open,
    onClose,
    children,
    labelledBy,            // id do título (preferível)
    describedBy,           // id da descrição
    ariaLabel,             // fallback se não tiver labelledBy
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,       // ref para focar ao abrir (prioritário)
    initialFocusSelector,  // seletor CSS alternativo
    restoreFocus = true,
    lockScroll = true,
    className = "",        // classes do painel (content)
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
  const panelRef = useRef(null);     // painel do modal
  const prevFocusRef = useRef(null);
  const prevOverflowRef = useRef("");

  // expõe o painel via forwardRef
  React.useImperativeHandle(forwardedRef, () => panelRef.current);

  const focusFirst = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let target =
      initialFocusRef?.current ||
      (initialFocusSelector ? panel.querySelector(initialFocusSelector) : null);

    if (!target) {
      // primeiro foco disponível; caso contrário, o próprio painel
      const focusables = getFocusable(panel);
      target = focusables[0] || panel;
    }

    target?.focus?.();
  }, [initialFocusRef, initialFocusSelector]);

  // Fecha no ESC + trap de foco (keydown global enquanto aberto)
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

  // Foco ao abrir + restaurar ao fechar
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement;
      // aguarda montar o conteúdo
      const id = setTimeout(() => {
        focusFirst();
        onAfterOpen?.();
      }, 0);
      return () => clearTimeout(id);
    } else if (restoreFocus) {
      const id = setTimeout(() => {
        prevFocusRef.current?.focus?.();
        onAfterClose?.();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open, restoreFocus, focusFirst, onAfterOpen, onAfterClose]);

  // Bloqueia scroll do body
  useEffect(() => {
    if (!lockScroll || !open) return;
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflowRef.current || "";
    };
  }, [open, lockScroll]);

  function onBackdropMouseDown(e) {
    if (!closeOnBackdrop) return;
    // garante que o clique foi no overlay, não no painel
    if (e.target === containerRef.current) onClose?.();
  }

  if (!mountNode) return null;

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          onMouseDown={onBackdropMouseDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={overlayClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-label={!labelledBy ? ariaLabel : undefined}
        >
          {/* guardas sentinela (melhoram o trap para alguns leitores/UA) */}
          <span tabIndex={0} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="document"
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className={[
              "relative bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-lg",
              "min-w-[300px] max-w-[90vw] max-h-[90vh] overflow-auto outline-none",
              className,
            ].join(" ")}
            // evita que clique dentro dispare o fechamento do backdrop
            onMouseDown={(e) => e.stopPropagation()}
          >
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                aria-label={closeLabel}
              >
                ×
              </button>
            )}

            {children}
          </motion.div>
          <span tabIndex={0} aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, mountNode);
});

export default Modal;
