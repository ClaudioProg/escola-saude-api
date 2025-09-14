// 📁 src/components/ModalErro.jsx
import { useRef, useState } from "react";
import PropTypes from "prop-types";
import Modal from "react-modal";
import { AlertTriangle, Clipboard, ChevronDown, RotateCcw } from "lucide-react";

export default function ModalErro({
  isOpen,
  onClose,
  titulo = "Erro",
  mensagem = "Ocorreu um erro inesperado.",
  detalhes,                  // string opcional com stack/log
  onTentarNovamente,         // callback opcional
  textoFechar = "Fechar",
  textoTentarNovamente = "Tentar novamente",
  bloqueiaCliqueFora = true, // força usuário a reconhecer
}) {
  const fecharBtnRef = useRef(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const copyDetalhes = async () => {
    try {
      await navigator.clipboard.writeText(detalhes || mensagem);
    } catch {
      // silencioso
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={!bloqueiaCliqueFora}
      shouldCloseOnEsc={true}
      ariaHideApp={false}
      onAfterOpen={() => fecharBtnRef.current?.focus()}
      className="max-w-md mx-auto mt-24 bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black/50 z-50 flex justify-center items-start"
      contentLabel="Alerta de erro"
      role="alertdialog"
      aria-labelledby="modal-erro-titulo"
      aria-describedby="modal-erro-mensagem"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <AlertTriangle size={48} className="text-red-600" aria-hidden="true" />
        <h2 id="modal-erro-titulo" className="text-xl font-bold text-gray-800 dark:text-white">
          {titulo}
        </h2>

        <p id="modal-erro-mensagem" className="text-sm text-gray-700 dark:text-gray-200">
          {mensagem}
        </p>

        {/* Detalhes (opcional) */}
        {detalhes && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setMostrarDetalhes((v) => !v)}
              className="mx-auto flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:underline"
              aria-expanded={mostrarDetalhes}
              aria-controls="erro-detalhes"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${mostrarDetalhes ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              {mostrarDetalhes ? "Ocultar detalhes" : "Mostrar detalhes"}
            </button>

            {mostrarDetalhes && (
              <pre
                id="erro-detalhes"
                className="mt-2 max-h-48 overflow-auto bg-gray-50 dark:bg-zinc-900 text-left text-xs p-3 rounded border dark:border-zinc-700 text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
              >
                {detalhes}
              </pre>
            )}

            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={copyDetalhes}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white"
                title="Copiar detalhes"
              >
                <Clipboard size={14} />
                Copiar detalhes
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-2">
          {onTentarNovamente && (
            <button
              type="button"
              onClick={onTentarNovamente}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded"
            >
              <RotateCcw size={16} />
              {textoTentarNovamente}
            </button>
          )}
          <button
            type="button"
            ref={fecharBtnRef}
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            {textoFechar}
          </button>
        </div>
      </div>
    </Modal>
  );
}

ModalErro.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  titulo: PropTypes.string,
  mensagem: PropTypes.string,
  detalhes: PropTypes.string,
  onTentarNovamente: PropTypes.func,
  textoFechar: PropTypes.string,
  textoTentarNovamente: PropTypes.string,
  bloqueiaCliqueFora: PropTypes.bool,
};
