// 📁 src/components/ModalCertificadoPreview.jsx
import Modal from "react-modal";
import PropTypes from "prop-types";
import { Download, X } from "lucide-react";

export default function ModalCertificadoPreview({ isOpen, onClose, certificado }) {
  if (!certificado) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={true}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-xl max-w-3xl mx-auto relative">
        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-600"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-white">
          Prévia do Certificado
        </h2>

        <div className="border p-4 rounded-md bg-white dark:bg-zinc-800 text-sm">
          <p><strong>Nome:</strong> {certificado.nome}</p>
          <p><strong>CPF:</strong> {certificado.cpf}</p>
          <p><strong>Evento:</strong> {certificado.titulo_evento}</p>
          <p><strong>Carga horária:</strong> {certificado.carga_horaria} horas</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mt-6">
          <img
            src={certificado.qr_code_url}
            alt="QR Code do certificado"
            className="w-32 h-32 border p-2 rounded-md bg-white"
          />
        </div>

        {/* Botão de download */}
        <div className="flex justify-center mt-6">
          <a
            href={certificado.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <Download size={16} />
            Baixar Certificado (PDF)
          </a>
        </div>
      </div>
    </Modal>
  );
}

ModalCertificadoPreview.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  certificado: PropTypes.shape({
    nome: PropTypes.string,
    cpf: PropTypes.string,
    titulo_evento: PropTypes.string,
    carga_horaria: PropTypes.number,
    qr_code_url: PropTypes.string,
    pdf_url: PropTypes.string,
  }),
};
