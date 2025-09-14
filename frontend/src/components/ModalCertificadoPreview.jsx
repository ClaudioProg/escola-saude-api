// 📁 src/components/ModalCertificadoPreview.jsx
import PropTypes from "prop-types";
import { Download, Link as LinkIcon, QrCode } from "lucide-react";
import Modal from "./Modal"; // ✅ usa o Modal padrão do projeto
import { formatarCPF } from "../utils/data";

export default function ModalCertificadoPreview({ isOpen, onClose, certificado }) {
  if (!certificado) return null;

  const {
    nome,
    cpf,
    titulo_evento,
    carga_horaria,
    qr_code_url,
    pdf_url,
    codigo,
    gerado_em,
    link_validacao,
  } = certificado || {};

  const dataEmissao =
    typeof gerado_em === "string" ? gerado_em.slice(0, 10).split("-").reverse().join("/") : null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div aria-labelledby="titulo-cert-preview" className="max-w-3xl">
        <h2
          id="titulo-cert-preview"
          className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-white"
        >
          🎓 Prévia do Certificado
        </h2>

        {/* Bloco de dados */}
        <div className="border p-4 rounded-md bg-white dark:bg-zinc-800 text-sm space-y-1">
          <p><strong>Nome:</strong> {nome || "—"}</p>
          <p><strong>CPF:</strong> {cpf ? formatarCPF(cpf) : "—"}</p>
          <p><strong>Evento:</strong> {titulo_evento || "—"}</p>
          <p><strong>Carga horária:</strong> {Number.isFinite(Number(carga_horaria)) ? `${carga_horaria} horas` : "—"}</p>
          {dataEmissao && <p><strong>Data de emissão:</strong> {dataEmissao}</p>}
          {codigo && <p><strong>Código do certificado:</strong> {codigo}</p>}
          {link_validacao && (
            <p className="flex items-center gap-2">
              <strong>Validação:</strong>
              <a
                href={link_validacao}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-300 underline break-all"
              >
                {link_validacao}
              </a>
            </p>
          )}
        </div>

        {/* QR Code */}
        {qr_code_url ? (
          <div className="flex justify-center mt-6">
            <img
              src={qr_code_url}
              alt={`QR Code do certificado${codigo ? ` ${codigo}` : ""}`}
              className="w-32 h-32 border p-2 rounded-md bg-white"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center mt-6 text-gray-500 dark:text-gray-400 text-sm gap-2">
            <QrCode className="w-4 h-4" /> QR Code não disponível
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {pdf_url && (
            <a
              href={pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md inline-flex items-center gap-2"
            >
              <Download size={16} />
              Baixar Certificado (PDF)
            </a>
          )}

          {link_validacao && (
            <a
              href={link_validacao}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-md inline-flex items-center gap-2"
            >
              <LinkIcon size={16} />
              Validar certificado
            </a>
          )}

          <button
            onClick={onClose}
            className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-black dark:text-white px-4 py-2 rounded-md"
          >
            Fechar
          </button>
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
    carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    qr_code_url: PropTypes.string,
    pdf_url: PropTypes.string,
    codigo: PropTypes.string,
    gerado_em: PropTypes.string,
    link_validacao: PropTypes.string,
  }),
};
