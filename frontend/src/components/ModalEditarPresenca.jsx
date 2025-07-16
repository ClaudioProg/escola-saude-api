// 📁 src/components/ModalEditarPresenca.jsx
import Modal from "react-modal";
import PropTypes from "prop-types";
import { useState } from "react";
import { Check, X } from "lucide-react";

export default function ModalEditarPresenca({ isOpen, onClose, onSalvar, inscrito }) {
  const [status, setStatus] = useState(inscrito.status || "faltou");
  const [justificativa, setJustificativa] = useState(inscrito.justificativa || "");

  const handleSalvar = () => {
    if (status === "faltou" && !justificativa.trim()) {
      alert("Informe uma justificativa para a falta.");
      return;
    }

    onSalvar({
      ...inscrito,
      status,
      justificativa: status === "faltou" ? justificativa : "",
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          Editar presença de {inscrito.nome}
        </h2>

        {/* Status da presença */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              name="presenca"
              value="presente"
              checked={status === "presente"}
              onChange={() => setStatus("presente")}
            />
            Presente
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              name="presenca"
              value="faltou"
              checked={status === "faltou"}
              onChange={() => setStatus("faltou")}
            />
            Faltou
          </label>
        </div>

        {/* Justificativa */}
        {status === "faltou" && (
          <div className="mb-4">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              Justificativa da falta:
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva a justificativa..."
              className="w-full border rounded-md p-2 text-sm dark:bg-zinc-800 dark:text-white"
              rows={4}
            />
          </div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            <X size={16} />
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
          >
            <Check size={16} />
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

ModalEditarPresenca.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSalvar: PropTypes.func.isRequired,
  inscrito: PropTypes.shape({
    nome: PropTypes.string.isRequired,
    status: PropTypes.string,
    justificativa: PropTypes.string,
  }).isRequired,
};
