// ✅ src/components/ui/ErroCarregamento.jsx — v2.0
// Plataforma Escola da Saúde
//
// Estado genérico oficial de erro/carregamento malsucedido.
//
// Revisão premium:
// - componente genérico real de UI;
// - mensagens claras e orientativas;
// - usuário nunca fica sem saber o que aconteceu ou o que fazer;
// - suporte a erro, aviso e informação;
// - detalhes técnicos ocultos e controlados;
// - ação de tentar novamente com loading;
// - acessibilidade com role alert/status;
// - mobile-first;
// - dark mode;
// - reduced motion;
// - visual premium consistente com a plataforma.

import PropTypes from "prop-types";
import { useEffect, useId, useMemo, useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  LifeBuoy,
  RefreshCcw,
} from "lucide-react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const VARIANT_CONFIG = {
  error: {
    title: "Não foi possível carregar as informações.",
    suggestion:
      "Verifique sua conexão, tente novamente e, se o problema persistir, acione o suporte.",
    icon: AlertTriangle,
    container:
      "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-100",
    iconBox:
      "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    button:
      "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-500",
    details:
      "border-rose-200 bg-white text-slate-800 dark:border-rose-900/50 dark:bg-slate-950 dark:text-slate-200",
    focus: "focus-visible:ring-rose-500",
  },
  warning: {
    title: "Atenção: há uma pendência nesta tela.",
    suggestion:
      "Revise as informações exibidas e tente novamente quando a condição for corrigida.",
    icon: AlertCircle,
    container:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100",
    iconBox:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    button:
      "bg-amber-700 text-white hover:bg-amber-800 focus-visible:ring-amber-500",
    details:
      "border-amber-200 bg-white text-slate-800 dark:border-amber-900/50 dark:bg-slate-950 dark:text-slate-200",
    focus: "focus-visible:ring-amber-500",
  },
  info: {
    title: "Informação indisponível no momento.",
    suggestion:
      "Aguarde alguns instantes ou tente atualizar esta seção.",
    icon: Info,
    container:
      "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-100",
    iconBox:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    button:
      "bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500",
    details:
      "border-sky-200 bg-white text-slate-800 dark:border-sky-900/50 dark:bg-slate-950 dark:text-slate-200",
    focus: "focus-visible:ring-sky-500",
  },
};

function normalizarMensagem(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default function ErroCarregamento({
  variant = "error",
  mensagem,
  sugestao,
  details = "",
  onRetry = null,
  retryLabel = "Tentar novamente",
  retryDisabled = false,
  retryLoading = false,
  retryAutoFocus = true,
  className = "",
  children = null,
  suporteLabel = "Se continuar acontecendo, informe o suporte.",
  showSupportHint = true,
  "data-testid": testId,
}) {
  const reduceMotion = useReducedMotion();
  const reactId = useId();

  const hintId = `${reactId}-hint`;
  const detailsId = `${reactId}-details`;
  const supportId = `${reactId}-support`;

  const retryButtonRef = useRef(null);
  const [openDetails, setOpenDetails] = useState(false);

  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.error;
  const Icon = config.icon;

  const tituloFinal = normalizarMensagem(mensagem, config.title);
  const sugestaoFinal = normalizarMensagem(sugestao, config.suggestion);

  const hasDetails = typeof details === "string" && details.trim().length > 0;
  const hasRetry = typeof onRetry === "function";
  const isRetryDisabled = retryDisabled || retryLoading;

  useEffect(() => {
    if (retryAutoFocus && hasRetry && retryButtonRef.current) {
      retryButtonRef.current.focus();
    }
  }, [hasRetry, retryAutoFocus]);

  const describedBy = useMemo(
    () =>
      [
        sugestaoFinal ? hintId : null,
        showSupportHint ? supportId : null,
        hasDetails && openDetails ? detailsId : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    [detailsId, hasDetails, hintId, openDetails, showSupportHint, sugestaoFinal, supportId]
  );

  const toggleDetails = useCallback(() => {
    setOpenDetails((current) => !current);
  }, []);

  const animationProps = reduceMotion
    ? {
        initial: false,
        animate: { opacity: 1 },
      }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: "easeOut" },
      };

  return (
    <motion.section
      {...animationProps}
      role={variant === "info" ? "status" : "alert"}
      aria-live={variant === "info" ? "polite" : "assertive"}
      aria-describedby={describedBy}
      tabIndex={0}
      data-testid={testId}
      className={classNames(
        "mx-auto w-full max-w-2xl rounded-[2rem] border p-5 text-center shadow-sm outline-none sm:p-6",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        config.focus,
        config.container,
        className
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <span
          className={classNames(
            "grid h-16 w-16 place-items-center rounded-[1.5rem] border shadow-sm sm:h-20 sm:w-20",
            config.iconBox
          )}
          aria-hidden="true"
        >
          <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
        </span>

        <h2 className="mt-4 text-lg font-black tracking-tight sm:text-xl">
          {tituloFinal}
        </h2>

        {sugestaoFinal && (
          <p
            id={hintId}
            className="mt-2 max-w-lg text-sm font-medium leading-relaxed opacity-85 sm:text-base"
          >
            {sugestaoFinal}
          </p>
        )}

        {showSupportHint && (
          <p
            id={supportId}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2 text-xs font-bold opacity-90 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10"
          >
            <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
            {suporteLabel}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {hasRetry && (
            <button
              ref={retryButtonRef}
              type="button"
              onClick={onRetry}
              disabled={isRetryDisabled}
              aria-busy={retryLoading || undefined}
              className={classNames(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                "disabled:cursor-not-allowed disabled:opacity-60",
                config.button
              )}
            >
              <RefreshCcw
                className={classNames(
                  "h-4 w-4",
                  retryLoading && !reduceMotion && "animate-spin"
                )}
                aria-hidden="true"
              />
              {retryLoading ? "Tentando novamente..." : retryLabel}
            </button>
          )}

          {children}
        </div>

        {hasDetails && (
          <div className="mt-5 w-full max-w-xl text-left">
            <button
              type="button"
              onClick={toggleDetails}
              aria-expanded={openDetails}
              aria-controls={detailsId}
              className={classNames(
                "inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-2 text-xs font-black transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 dark:bg-white/10 dark:hover:bg-white/15",
                config.focus
              )}
            >
              {openDetails ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
              {openDetails ? "Ocultar detalhes técnicos" : "Mostrar detalhes técnicos"}
            </button>

            {openDetails && (
              <pre
                id={detailsId}
                className={classNames(
                  "mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-2xl border p-3 text-xs leading-relaxed",
                  config.details
                )}
              >
                {details}
              </pre>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

ErroCarregamento.propTypes = {
  variant: PropTypes.oneOf(["error", "warning", "info"]),
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  details: PropTypes.string,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
  retryDisabled: PropTypes.bool,
  retryLoading: PropTypes.bool,
  retryAutoFocus: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
  suporteLabel: PropTypes.string,
  showSupportHint: PropTypes.bool,
  "data-testid": PropTypes.string,
};