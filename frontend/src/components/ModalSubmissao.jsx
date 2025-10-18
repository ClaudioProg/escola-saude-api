// 📁 src/components/ModalSubmissao.jsx
import React, { useEffect, useId } from "react";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import Modal from "./Modal";

/**
 * ModalSubmissao
 * - Usa o Modal padrão do projeto (ModalBase por trás: focus trap, Esc, stacking)
 * - Acessível: role="dialog", aria-modal, aria-labelledby, aria-describedby
 * - HeaderHero harmonizado (altura/tipografia), degradê 3 cores configurável
 * - Footer sticky opcional para ações
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string | ReactNode
 *  - subtitle?: string | ReactNode
 *  - icon?: React.Component (Lucide ícone opcional)
 *  - children: ReactNode
 *  - footer?: ReactNode (opcional)
 *  - maxWidth?: string tailwind (ex.: "max-w-4xl") -> default "max-w-4xl"
 *  - escClose?: boolean (default: true)
 *  - closeOnOverlayClick?: boolean (default: true)
 *  - initialFocusRef?: React.RefObject<HTMLElement>
 *  - stickyFooter?: boolean (default: true)
 *  - variant?: "emerald" | "indigo" | "cyan" | "rose" | "slate"  (define paleta)
 *  - headerGradient?: string (override tailwind, ex.: "from-emerald-900 via-teal-800 to-lime-700")
 */
export default function ModalSubmissao({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth = "max-w-4xl",
  escClose = true,
  closeOnOverlayClick = true,
  initialFocusRef,
  stickyFooter = true,
  variant = "indigo",
  headerGradient,
}) {
  const titleId = useId();
  const descId = useId();

  // Mapeia variantes para degradês 3 cores
  const gradientByVariant = {
    emerald: "from-emerald-900 via-emerald-800 to-teal-700",
    indigo: "from-indigo-900 via-violet-800 to-fuchsia-700",
    cyan: "from-cyan-900 via-sky-800 to-blue-700",
    rose: "from-rose-900 via-red-800 to-orange-700",
    slate: "from-slate-900 via-slate-800 to-zinc-700",
  };
  const headerBg = headerGradient || gradientByVariant[variant] || gradientByVariant.indigo;

  // Respeita o prop escClose (ModalBase já fecha com Esc; aqui desabilitamos se necessário)
  useEffect(() => {
    if (!open || escClose) return;
    const blockEsc = (e) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    document.addEventListener("keydown", blockEsc, true);
    return () => document.removeEventListener("keydown", blockEsc, true);
  }, [open, escClose]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className={`w-[96%] ${maxWidth} p-0 overflow-hidden`}
      closeOnBackdrop={!!closeOnOverlayClick}
      // ModalBase já tem focus trap e Esc; passamos initialFocusRef se vier
      initialFocusRef={initialFocusRef}
    >
      {/* HeaderHero (altura/tipografia padronizadas; degradê 3 cores) */}
      <header
        className={`px-4 sm:px-6 py-4 text-white bg-gradient-to-br ${headerBg}`}
        role="group"
        aria-label="Janela de submissão"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {Icon ? <Icon className="w-5 h-5 shrink-0" aria-hidden="true" /> : null}
              <h3 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                {title}
              </h3>
            </div>
            <p
              id={descId}
              className="text-white/90 text-sm mt-1 line-clamp-2"
            >
              {subtitle || "Preencha os campos e revise antes de enviar."}
            </p>
          </div>

          {/* Botão fechar no header */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Conteúdo (rolável) */}
      <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6">
        {children}
      </div>

      {/* Footer (opcional) */}
      {footer ? (
        stickyFooter ? (
          <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        )
      ) : null}
    </Modal>
  );
}

ModalSubmissao.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  maxWidth: PropTypes.string,
  escClose: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  initialFocusRef: PropTypes.any,
  stickyFooter: PropTypes.bool,
  variant: PropTypes.oneOf(["emerald", "indigo", "cyan", "rose", "slate"]),
  headerGradient: PropTypes.string,
};
