// 📁 src/components/ModalSubmissao.jsx
import React, { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * ModalSubmissao
 * - Mantém comportamento do Modal original (ESC, overlay click, footer opcional)
 * - Acessível: role="dialog", aria-modal, aria-labelledby
 * - Focus management (foco vai pro modal e retorna ao elemento anterior ao fechar)
 * - Lock de scroll no body enquanto aberto
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string | ReactNode
 *  - icon: React.Component (Lucide ícone opcional)
 *  - children: ReactNode
 *  - footer: ReactNode (opcional)
 *  - maxWidth: string tailwind (ex.: "max-w-4xl")
 *  - escClose?: boolean (default: true)
 *  - closeOnOverlayClick?: boolean (default: true)
 *  - initialFocusRef?: React.RefObject<HTMLElement> (opcional)
 */
export default function ModalSubmissao({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  footer,
  maxWidth = "max-w-4xl",
  escClose = true,
  closeOnOverlayClick = true,
  initialFocusRef,
}) {
  const titleId = useId();
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const prevFocusRef = useRef(null);

  // ESC para fechar
  useEffect(() => {
    if (!open || !escClose) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, escClose, onClose]);

  // Lock de scroll e foco dentro do modal
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    // foco inicial
    const focusTarget =
      (initialFocusRef && initialFocusRef.current) ||
      dialogRef.current?.querySelector("[data-autofocus]") ||
      dialogRef.current;
    focusTarget?.focus?.();

    return () => {
      html.style.overflow = prevOverflow;
      // retorna foco ao elemento anterior
      if (prevFocusRef.current && prevFocusRef.current.focus) {
        prevFocusRef.current.focus();
      }
    };
  }, [open, initialFocusRef]);

  // Fechar ao clicar fora (overlay)
  const handleOverlayClick = (e) => {
    if (!closeOnOverlayClick) return;
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          onMouseDown={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby={titleId}
        >
          <motion.div
            ref={dialogRef}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className={`relative w-full ${maxWidth} rounded-2xl border bg-white p-0 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900`}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-2">
                {Icon ? <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                <h3 id={titleId} className="truncate text-lg font-semibold">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6">
              {children}
            </div>

            {/* Footer (opcional) */}
            {footer ? (
              <div className="flex items-center justify-end gap-3 border-t p-3 dark:border-zinc-800">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
