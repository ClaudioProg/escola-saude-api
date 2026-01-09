// 📁 src/components/ErroCarregamento.jsx
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCcw, Info, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";

/**
 * Componente de erro acessível e moderno.
 * - Suporta variants: 'error' | 'warning' | 'info' (cores e ícones).
 * - Respeita prefers-reduced-motion.
 * - Botão de tentar novamente com loading/disabled e autoFocus opcional.
 * - Área de detalhes (stack trace / mensagem técnica) com toggle.
 * - Aceita children para ações extras (ex.: link para suporte).
 */
export default function ErroCarregamento({
  variant = "error",
  mensagem = "Erro ao carregar os dados.",
  sugestao = "Tente novamente mais tarde ou atualize a página.",
  details = "",               // string longa opcional (ex.: stack) — oculta atrás de toggle
  onRetry = null,
  retryLabel = "Tentar novamente",
  retryDisabled = false,
  retryLoading = false,
  retryAutoFocus = true,
  className = "",
  children = null,
  "data-testid": testId,
}) {
  const reduceMotion = useReducedMotion();
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const detailsId = `${groupId}-details`;
  const btnRef = useRef(null);
  const [openDetails, setOpenDetails] = useState(false);

  // auto-focus no botão de retry quando presente e desejado
  useEffect(() => {
    if (retryAutoFocus && onRetry && btnRef.current) {
      btnRef.current.focus();
    }
  }, [onRetry, retryAutoFocus]);

  const palette = useMemo(() => {
    switch (variant) {
      case "warning":
        return {
          fg: "text-amber-800 dark:text-amber-300",
          ring: "focus-visible:ring-amber-500",
          badgeBg: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700",
          btn: "bg-amber-700 hover:bg-amber-800 focus-visible:ring-amber-600",
          icon: AlertCircle,
        };
      case "info":
        return {
          fg: "text-sky-800 dark:text-sky-300",
          ring: "focus-visible:ring-sky-500",
          badgeBg: "bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700",
          btn: "bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-600",
          icon: Info,
        };
      case "error":
      default:
        return {
          fg: "text-red-800 dark:text-red-300",
          ring: "focus-visible:ring-red-500",
          badgeBg: "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700",
          btn: "bg-red-700 hover:bg-red-800 focus-visible:ring-red-600",
          icon: AlertTriangle,
        };
    }
  }, [variant]);

  const Icon = palette.icon;

  const containerAnim = reduceMotion
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  const onToggleDetails = useCallback(() => setOpenDetails((v) => !v), []);

  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      data-testid={testId}
      className={[
        "flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl max-w-lg mx-auto",
        palette.fg,
        "focus:outline-none",
        palette.ring,
        className,
      ].join(" ")}
      {...containerAnim}
      transition={reduceMotion ? undefined : { duration: 0.35 }}
      aria-describedby={[sugestao ? hintId : null, details ? detailsId : null].filter(Boolean).join(" ") || undefined}
    >
      <div
        className={[
          "inline-flex items-center justify-center w-20 h-20 mb-5 rounded-full border shadow-sm",
          palette.badgeBg,
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon className="w-10 h-10" />
      </div>

      <p className="text-lg md:text-xl font-semibold mb-1">{mensagem}</p>

      {sugestao && (
        <p id={hintId} className="text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-md">
          {sugestao}
        </p>
      )}

      {/* Detalhes técnicos (toggle) */}
      {details ? (
        <div className="mt-4 w-full max-w-md text-left">
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={openDetails}
            aria-controls={detailsId}
            className={[
              "inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border",
              "border-gray-300 dark:border-gray-600",
              "bg-white/70 dark:bg-zinc-800/60",
              "hover:bg-gray-100 dark:hover:bg-zinc-700",
              "focus:outline-none",
              palette.ring,
            ].join(" ")}
          >
            {openDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {openDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
          </button>

          <motion.pre
            id={detailsId}
            initial={false}
            animate={{ height: openDetails ? "auto" : 0, opacity: openDetails ? 1 : 0 }}
            transition={reduceMotion ? undefined : { duration: 0.25 }}
            className={[
              "mt-2 overflow-hidden text-xs p-3 rounded-lg",
              "bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700",
              "text-zinc-800 dark:text-zinc-200",
            ].join(" ")}
            aria-hidden={!openDetails}
          >
{details}
          </motion.pre>
        </div>
      ) : null}

      {/* Ações */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            ref={btnRef}
            type="button"
            onClick={onRetry}
            disabled={retryDisabled || retryLoading}
            className={[
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-medium transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              palette.btn,
              (retryDisabled || retryLoading) ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            aria-busy={retryLoading || undefined}
          >
            <RefreshCcw size={16} className={retryLoading && !reduceMotion ? "animate-spin" : undefined} />
            {retryLoading ? "Recarregando..." : retryLabel}
          </button>
        )}

        {children}
      </div>
    </motion.div>
  );
}

ErroCarregamento.propTypes = {
  /** error | warning | info */
  variant: PropTypes.oneOf(["error", "warning", "info"]),
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  /** Texto longo opcional (ex.: stack trace) exibido em um toggle */
  details: PropTypes.string,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
  retryDisabled: PropTypes.bool,
  retryLoading: PropTypes.bool,
  retryAutoFocus: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
  "data-testid": PropTypes.string,
};
