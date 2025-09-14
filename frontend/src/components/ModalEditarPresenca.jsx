// 📁 src/components/ModalEditarPresenca.jsx
import Modal from "react-modal";
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";

const STATUS_OPCOES = ["presente", "faltou"];

export default function ModalEditarPresenca({
  isOpen,
  onClose,
  onSalvar,
  inscrito,
  minJustLen = 3,              // 👈 mínimo de caracteres p/ justificar falta
}) {
  const statusInicial = useMemo(() => {
    const s = (inscrito?.status || "faltou").toLowerCase().trim();
    return STATUS_OPCOES.includes(s) ? s : "faltou";
  }, [inscrito]);

  const [status, setStatus] = useState(statusInicial);
  const [justificativa, setJustificativa] = useState(inscrito?.justificativa || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // ressincroniza ao abrir / trocar inscrito
  useEffect(() => {
    setStatus(statusInicial);
    setJustificativa(inscrito?.justificativa || "");
    setErro("");
    setSalvando(false);
  }, [isOpen, statusInicial, inscrito]);

  // mudar para presente limpa justificativa
  useEffect(() => {
    if (status === "presente" && justificativa) setJustificativa("");
    setErro("");
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setErro("");

    if (status === "faltou" && justificativa.trim().length < minJustLen) {
      setErro(`Informe uma justificativa (mín. ${minJustLen} caracteres).`);
      return;
    }

    try {
      setSalvando(true);
      const payload = {
        ...inscrito,
        status,
        justificativa: status === "faltou" ? justificativa.trim() : "",
      };
      await Promise.resolve(onSalvar?.(payload));
      onClose?.();
    } catch (err) {
      const msg =
        err?.data?.mensagem ||
        err?.data?.message ||
        err?.message ||
        "Falha ao salvar presença.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={salvando ? undefined : onClose}
      shouldCloseOnOverlayClick={!salvando}
      ariaHideApp={false}
      contentLabel={`Editar presença de ${inscrito?.nome || "participante"}`}
      className="modal"
      overlayClassName="overlay"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-lg"
      >
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          Editar presença de {inscrito?.nome}
        </h2>

        {/* Status */}
        <fieldset className="mb-4">
          <legend className="sr-only">Status da presença</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="radio"
                name="presenca"
                value="presente"
                checked={status === "presente"}
                onChange={() => setStatus("presente")}
                disabled={salvando}
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
                disabled={salvando}
              />
              Faltou
            </label>
          </div>
        </fieldset>

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
              disabled={salvando}
              aria-invalid={!!erro}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Mínimo de {minJustLen} caracteres
              </span>
              <span className="text-gray-400">
                {justificativa.trim().length}/{Math.max(minJustLen, 50)}
              </span>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-2">{erro}</div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md
                       dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-60"
          >
            <X size={16} />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || (status === "faltou" && justificativa.trim().length < minJustLen)}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

ModalEditarPresenca.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSalvar: PropTypes.func.isRequired, // pode ser async
  inscrito: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string.isRequired,
    status: PropTypes.string,
    justificativa: PropTypes.string,
  }).isRequired,
  minJustLen: PropTypes.number,
};
