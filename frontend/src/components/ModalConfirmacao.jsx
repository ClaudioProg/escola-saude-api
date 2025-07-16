// 📁 src/components/ModalConfirmacao.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";

export default function ModalConfirmacao({
  isOpen,
  onClose,
  onConfirmar,
  titulo = "Confirmar Ação",
  mensagem = "Tem certeza que deseja continuar?",
  textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg max-w-md w-full"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {titulo}
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">{mensagem}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
          >
            {textoBotaoCancelar}
          </button>
          <button
            onClick={() => {
              onConfirmar();
              onClose();
            }}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            {textoBotaoConfirmar}
          </button>
        </div>
      </motion.div>
    </div>
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
};
