// 📁 src/components/ModalErro.jsx
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import { AlertTriangle, Clipboard, ChevronDown, RotateCcw, Check } from "lucide-react";

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
  const [copiado, setCopiado] = useState(false);

  // foca o botão fechar ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => fecharBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  const copyDetalhes = async () => {
    try {
      await navigator.clipboard.writeText(String(detalhes || mensagem));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // silencioso
    }
  };

  if (!isOpen) return null;

  const titleId = "modal-erro-titulo";
  const descId = "modal-erro-mensagem";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      // quando bloqueia clique fora, não queremos fechar pelo overlay
      closeOnBackdrop={!bloqueiaCliqueFora}
      className="w-[96%] max-w-md p-0 overflow-hidden"
      role="alertdialog"
    >
      {/* Header hero (degradê 3 cores) */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-rose-900 via-red-800 to-orange-700"
        aria-live="assertive"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {titulo}
          </h2>
        </div>
        <p id={descId} className="text-white/90 text-sm mt-1">
          {mensagem}
        </p>
      </header>

      {/* Corpo */}
      <section className="px-4 sm:px-6 pt-4 pb-24">
        {/* Detalhes (opcional) */}
        {detalhes && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setMostrarDetalhes((v) => !v)}
              className="mx-auto flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:underline"
              aria-expanded={mostrarDetalhes}
              aria-controls="erro-detalhes"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mostrarDetalhes ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              {mostrarDetalhes ? "Ocultar detalhes" : "Mostrar detalhes"}
            </button>

            {mostrarDetalhes && (
              <pre
                id="erro-detalhes"
                className="mt-2 max-h-56 overflow-auto bg-slate-50 dark:bg-zinc-900 text-left text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap"
              >
                {detalhes}
              </pre>
            )}

            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={copyDetalhes}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-900 dark:text-white transition"
                title="Copiar detalhes"
                aria-live="polite"
              >
                {copiado ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                {copiado ? "Copiado!" : "Copiar detalhes"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Rodapé sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
        {onTentarNovamente && (
          <button
            type="button"
            onClick={onTentarNovamente}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
            {textoTentarNovamente}
          </button>
        )}
        <button
          type="button"
          ref={fecharBtnRef}
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
        >
          {textoFechar}
        </button>
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
