import Modal from "react-modal";
import { AlertTriangle } from "lucide-react";

export default function ModalErro({
  isOpen,
  onClose,
  titulo = "Erro",
  mensagem = "Ocorreu um erro inesperado.",
}) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="max-w-md mx-auto mt-24 bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black/50 z-50 flex justify-center items-start"
      contentLabel="Erro"
      ariaHideApp={false}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <AlertTriangle size={48} className="text-red-600" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {titulo}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{mensagem}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
