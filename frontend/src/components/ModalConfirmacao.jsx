// 📁 src/components/ModalConfirmacao.jsx
import { useEffect, useRef, useMemo, useState, useId, useCallback } from "react";
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
 *
 * Extras (opcionais, não quebram):
 * - confirmOnEnter?: boolean (default true)
 */
function getTopmostLevel() {
  const nodes = Array.from(document.querySelectorAll("[data-modal-content]"));
  if (!nodes.length) return -Infinity;
  return nodes.reduce((acc, el) => {
    const lvl = Number(el.getAttribute("data-level") || 0);
    return Number.isFinite(lvl) ? Math.max(acc, lvl) : acc;
  }, -Infinity);
}

function isEditableElement(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = String(el.getAttribute("type") || "text").toLowerCase();
    // Enter em input text pode ser desejado, mas aqui evitamos confirmar acidentalmente
    return !["button", "submit", "checkbox", "radio", "file"].includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
}

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
  confirmOnEnter = true,
}) {
  const [confirmando, setConfirmando] = useState(false);

  const confirmBtnRef = useRef(null);
  const modalContentRef = useRef(null); // pega o wrapper do conteúdo

  // IDs únicos por instância (evita conflito ARIA)
  const uid = useId();
  const titleId = `modal-confirmacao-title-${uid}`;
  const descId = `modal-confirmacao-desc-${uid}`;

  const handleConfirm = useCallback(async () => {
    if (confirmando) return;
    try {
      setConfirmando(true);
      const result = await Promise.resolve(onConfirmar?.());
      if (result !== false) onClose?.();
    } catch {
      // mantém aberto; chamador pode exibir toast/erro
    } finally {
      setConfirmando(false);
    }
  }, [confirmando, onConfirmar, onClose]);

  // Paletas por variante
  const palette = useMemo(() => {
    switch (variant) {
      case "primary":
        return {
          header: "from-sky-900 via-sky-800 to-blue-700",
          btn: "bg-sky-600 hover:bg-sky-700 focus:ring-sky-400",
          icon: CheckCircle2,
          chip:
            "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
        };
      case "warning":
        return {
          header: "from-amber-900 via-orange-800 to-yellow-700",
          btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-400",
          icon: AlertTriangle,
          chip:
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
        };
      case "neutral":
        return {
          header: "from-slate-900 via-slate-800 to-zinc-700",
          btn: "bg-slate-700 hover:bg-slate-800 focus:ring-slate-400",
          icon: CheckCircle2,
          chip:
            "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
        };
      case "danger":
      default:
        return {
          header: "from-rose-900 via-red-800 to-orange-700",
          btn: "bg-red-600 hover:bg-red-700 focus:ring-red-400",
          icon: XCircle,
          chip:
            "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
        };
    }
  }, [variant]);

  const Icon = palette.icon;

  // Enter confirma (somente se topmost + foco dentro do modal + não está em input editável)
  useEffect(() => {
    if (!isOpen || !confirmOnEnter) return;

    const onKey = (e) => {
      if (e.key !== "Enter") return;
      if (confirmando) return;

      const top = getTopmostLevel();
      const isTopmost = level >= top;
      if (!isTopmost) return;

      const root = modalContentRef.current;
      const active = document.activeElement;
      const focusInside = !!(root && active && root.contains(active));
      if (!focusInside) return;

      if (isEditableElement(active)) return;

      e.preventDefault();
      e.stopPropagation();
      handleConfirm();
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen, confirmOnEnter, confirmando, level, handleConfirm]);

  // foco no botão confirmar ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => confirmBtnRef.current?.focus?.(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

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
      {/* wrapper ref para checar foco dentro */}
      <div ref={modalContentRef}>
        {/* Header hero */}
        <header
          className={`px-4 sm:px-5 py-4 text-white bg-gradient-to-br ${palette.header}`}
          role="group"
          aria-label="Confirmar ação"
        >
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white/15 border border-white/20">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {titulo}
              </h2>
              <p id={descId} className="text-white/90 text-sm mt-1">
                Revise antes de confirmar.
              </p>
            </div>
          </div>

          {/* chip contextual */}
          <div className="mt-3">
            <span className={`inline-flex items-center gap-2 text-xs font-extrabold px-2.5 py-1 rounded-full border ${palette.chip}`}>
              {variant === "danger"
                ? "Ação irreversível"
                : variant === "warning"
                ? "Requer atenção"
                : "Confirmação necessária"}
            </span>
          </div>
        </header>

        {/* Corpo */}
        <section className="px-4 sm:px-5 py-4">
          <div className="text-sm text-slate-800 dark:text-slate-200">{mensagem}</div>

          {/* a11y status */}
          <div aria-live="polite" className="sr-only">
            {confirmando ? "Processando confirmação." : ""}
          </div>
        </section>

        {/* Rodapé sticky (mobile-first) */}
        <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={confirmando}
              className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-slate-200 dark:bg-slate-800
                         text-slate-900 dark:text-slate-100 font-extrabold
                         hover:bg-slate-300 dark:hover:bg-slate-700 transition
                         disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
            >
              {textoBotaoCancelar}
            </button>

            <button
              type="button"
              ref={confirmBtnRef}
              onClick={handleConfirm}
              disabled={confirmando}
              className={`w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 rounded-2xl
                          text-white font-extrabold transition disabled:opacity-60
                          focus:outline-none focus:ring-2 focus:ring-offset-2 ${palette.btn}`}
              aria-busy={confirmando ? "true" : "false"}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              {confirmando ? "Processando..." : textoBotaoConfirmar}
            </button>
          </div>

          {/* hint teclado */}
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-right">
            {confirmOnEnter ? "Dica: pressione Enter para confirmar." : ""}
          </div>
        </div>
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
  confirmOnEnter: PropTypes.bool,
};
