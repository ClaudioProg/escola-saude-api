// 📁 src/components/ModalConfirmacao.jsx
import { useEffect, useRef, useMemo, useState } from "react";
import PropTypes from "prop-types";
import ModalBase from "./ModalBase";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirmar: () => (void|boolean|Promise<void|boolean>)  // se retornar false, mantém aberto
 * - titulo?: string
 * - mensagem?: string | ReactNode
 * - textoBotaoConfirmar?: string
 * - textoBotaoCancelar?: string
 * - closeOnOverlay?: boolean  // default true
 * - variant?: "danger" | "primary" | "warning" | "neutral"   // default "danger"
 * - level?: number (empilhamento)
 */
export default function ModalConfirmacao({
  isOpen,
  onClose,
  onConfirmar,
  titulo = "Confirmar Ação",
  mensagem = "Tem certeza que deseja continuar?",
  textoBotaoConfirmar = "Confirmar",
  textoBotaoCancelar = "Cancelar",
  closeOnOverlay = true,
  variant = "danger",
  level = 0,
}) {
  const [confirmando, setConfirmando] = useState(false);
  const confirmBtnRef = useRef(null);
  const titleId = "modal-confirmacao-title";
  const descId = "modal-confirmacao-desc";

  // Enter confirma
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, confirmando]);

  // foca no botão confirmar ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleConfirm = async () => {
    if (confirmando) return;
    try {
      setConfirmando(true);
      const result = await Promise.resolve(onConfirmar?.());
      if (result !== false) onClose?.();
    } catch {
      // mantém aberto; o chamador pode exibir toast/erro
    } finally {
      setConfirmando(false);
    }
  };

  // Paletas por variante (header + botão confirmar)
  const palette = useMemo(() => {
    switch (variant) {
      case "primary":
        return {
          header: "from-sky-900 via-sky-800 to-blue-700",
          btn: "bg-sky-600 hover:bg-sky-700 focus:ring-sky-400",
          icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" />,
        };
      case "warning":
        return {
          header: "from-amber-900 via-orange-800 to-yellow-700",
          btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-400",
          icon: <AlertTriangle className="w-5 h-5" aria-hidden="true" />,
        };
      case "neutral":
        return {
          header: "from-slate-900 via-slate-800 to-zinc-700",
          btn: "bg-slate-700 hover:bg-slate-800 focus:ring-slate-400",
          icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" />,
        };
      case "danger":
      default:
        return {
          header: "from-rose-900 via-red-800 to-orange-700",
          btn: "bg-red-600 hover:bg-red-700 focus:ring-red-400",
          icon: <XCircle className="w-5 h-5" aria-hidden="true" />,
        };
    }
  }, [variant]);

  if (!isOpen) return null;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      level={level}
      labelledBy={titleId}
      describedBy={descId}
      closeOnBackdrop={closeOnOverlay}
      closeOnEsc
      initialFocusRef={confirmBtnRef}
      maxWidth="max-w-md"
      className="p-0 overflow-hidden"
    >
      {/* Header hero (altura/tipografia padronizadas; degradê exclusivo 3 cores) */}
      <header
        className={`px-4 sm:px-5 py-4 text-white bg-gradient-to-br ${palette.header}`}
        role="group"
        aria-label="Confirmar ação"
      >
        <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {titulo}
        </h2>
        <p id={descId} className="text-white/90 text-sm mt-1">
          Revise antes de confirmar.
        </p>
      </header>

      {/* Corpo */}
      <section className="px-4 sm:px-5 py-4">
        <div className="text-sm text-slate-800 dark:text-slate-200">
          {mensagem}
        </div>
      </section>

      {/* Rodapé sticky (excelente no mobile) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={confirmando}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
        >
          {textoBotaoCancelar}
        </button>

        <button
          type="button"
          ref={confirmBtnRef}
          onClick={handleConfirm}
          disabled={confirmando}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 ${palette.btn}`}
          aria-busy={confirmando ? "true" : "false"}
        >
          {palette.icon}
          {confirmando ? "Processando..." : textoBotaoConfirmar}
        </button>
      </div>
    </ModalBase>
  );
}

ModalConfirmacao.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirmar: PropTypes.func.isRequired,
  titulo: PropTypes.string,
  mensagem: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  textoBotaoConfirmar: PropTypes.string,
  textoBotaoCancelar: PropTypes.string,
  closeOnOverlay: PropTypes.bool,
  variant: PropTypes.oneOf(["danger", "primary", "warning", "neutral"]),
  level: PropTypes.number,
};
