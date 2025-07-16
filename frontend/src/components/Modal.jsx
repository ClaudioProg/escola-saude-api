import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, children }) {
  const modalRef = useRef();

  // Fecha o modal com tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Foca no modal ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-lg min-w-[300px] max-w-[90vw] outline-none"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl"
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
}
