// 📁 src/components/ModalConfirmacao.jsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";

export default function ModalConfirmacao({
  isOpen,
  onClose,
  onConfirmar,
  titulo = "Confirmar Ação",
  mensagem = "Tem certeza que deseja continuar?",
  textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar",
  closeOnOverlay = true,   // 👈 novo
}) {
  const [confirmando, setConfirmando] = useState(false);
  const confirmBtnRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = "modal-confirmacao-title";
  const descId = "modal-confirmacao-desc";

  // Gestão de foco
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      // pequeno delay para garantir montagem
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
      return () => clearTimeout(t);
    } else if (previouslyFocusedRef.current) {
      // restaura foco ao fechar
      previouslyFocusedRef.current.focus?.();
    }
  }, [isOpen]);

  // Esc para fechar
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (!confirmando && closeOnOverlay) onClose?.();
  };

  const handleConfirm = async () => {
    if (confirmando) return;
    try {
      setConfirmando(true);
      const result = await Promise.resolve(onConfirmar?.());
      // se a ação retornar explicitamente false, mantém aberto
      if (result !== false) onClose?.();
    } catch (e) {
      // mantém aberto para o chamador exibir toast/erro
      // (opcional: você pode adicionar um toast aqui também)
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={handleOverlayClick}
        aria-hidden="true"
      />
      <motion.div
        key="content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.16 }}
        // impede que cliques dentro fechem o modal
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg max-w-md w-full">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {titulo}
          </h2>
          <p id={descId} className="text-sm text-gray-700 dark:text-gray-300 mb-6">
            {mensagem}
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={confirmando}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-60
                         dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
            >
              {textoBotaoCancelar}
            </button>
            <button
              type="button"
              ref={confirmBtnRef}
              onClick={handleConfirm}
              disabled={confirmando}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60"
            >
              {confirmando ? "Processando..." : textoBotaoConfirmar}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

ModalConfirmacao.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirmar: PropTypes.func.isRequired,
  titulo: PropTypes.string,
  mensagem: PropTypes.string,
  textoBotaoConfirmar: PropTypes.string,
  textoBotaoCancelar: PropTypes.string,
  closeOnOverlay: PropTypes.bool,
};
