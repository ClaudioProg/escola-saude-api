// ✅ src/components/ui/NadaEncontrado.jsx — v2.0
// Plataforma Escola da Saúde
//
// Estado vazio genérico oficial da plataforma.
//
// Revisão premium:
// - componente genérico real de UI;
// - usado para listas, filtros, buscas, tabelas e dashboards vazios;
// - mensagem clara + sugestão orientativa;
// - ações oficiais via actions[];
// - visual premium consistente;
// - acessibilidade com role status, aria-live e descrição;
// - mobile-first;
// - dark mode;
// - reduced motion;
// - sem compatibilidade legada acao;
// - contrato limpo e previsível.

import { cloneElement, createElement, isValidElement, useId, useMemo } from "react";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { SearchX } from "lucide-react";

const SIZE_CLASSES = {
  sm: {
    wrapper: "py-7 px-4",
    iconBox: "h-14 w-14 rounded-2xl",
    icon: "h-7 w-7",
    title: "text-base",
    hint: "text-xs",
  },
  md: {
    wrapper: "py-10 px-4",
    iconBox: "h-20 w-20 rounded-3xl",
    icon: "h-10 w-10",
    title: "text-lg sm:text-xl",
    hint: "text-sm",
  },
  lg: {
    wrapper: "py-12 px-5",
    iconBox: "h-24 w-24 rounded-[2rem]",
    icon: "h-12 w-12",
    title: "text-xl sm:text-2xl",
    hint: "text-base",
  },
};

const VARIANT_CLASSES = {
  emerald: {
    ring: "from-emerald-500 via-teal-500 to-lime-500",
    icon: "text-emerald-800 dark:text-emerald-200",
    primary:
      "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-500",
  },
  indigo: {
    ring: "from-indigo-500 via-violet-500 to-fuchsia-500",
    icon: "text-indigo-800 dark:text-indigo-200",
    primary:
      "bg-indigo-700 text-white hover:bg-indigo-800 focus-visible:ring-indigo-500",
  },
  cyan: {
    ring: "from-cyan-600 via-sky-500 to-blue-500",
    icon: "text-cyan-900 dark:text-cyan-200",
    primary:
      "bg-cyan-800 text-white hover:bg-cyan-900 focus-visible:ring-cyan-500",
  },
  rose: {
    ring: "from-rose-500 via-red-500 to-orange-500",
    icon: "text-rose-800 dark:text-rose-200",
    primary:
      "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-500",
  },
  slate: {
    ring: "from-slate-500 via-zinc-500 to-stone-500",
    icon: "text-slate-700 dark:text-slate-200",
    primary:
      "bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-500 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white",
  },
  lousa: {
    ring: "from-emerald-950 via-emerald-800 to-emerald-500",
    icon: "text-emerald-950 dark:text-emerald-200",
    primary:
      "bg-gradient-to-br from-[#0f2c1f] via-[#114b2d] to-[#166534] text-white hover:brightness-110 focus-visible:ring-emerald-500",
  },
};

const ACTION_VARIANTS = {
  primary: "",
  secondary:
    "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 dark:text-slate-200 dark:hover:bg-slate-800",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function renderIcon(icon, className) {
  if (!icon) return null;

  if (isValidElement(icon)) {
    return cloneElement(icon, {
      className: classNames(className, icon.props?.className),
      "aria-hidden": icon.props?.["aria-hidden"] ?? true,
      focusable: icon.props?.focusable ?? "false",
    });
  }

  if (typeof icon === "function") {
    return createElement(icon, {
      className,
      "aria-hidden": true,
      focusable: "false",
    });
  }

  return null;
}

function normalizeActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action?.label && typeof action?.onClick === "function")
    .map((action) => ({
      label: action.label,
      onClick: action.onClick,
      icon: action.icon,
      variant: action.variant || "primary",
      disabled: Boolean(action.disabled),
      title: action.title,
    }));
}

export default function NadaEncontrado({
  mensagem = "Nenhum resultado encontrado.",
  sugestao = "Ajuste os filtros ou tente uma nova busca.",
  Icone = SearchX,
  actions = [],
  size = "md",
  variant = "indigo",
  className = "",
  iconClassName = "",
  testId = "nada-encontrado",
  titleAs = "p",
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId();

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const theme = VARIANT_CLASSES[variant] || VARIANT_CLASSES.indigo;

  const normalizedActions = useMemo(() => normalizeActions(actions), [actions]);

  const descId = `${testId}-${uid}-desc`;
  const titleId = `${testId}-${uid}-title`;

  const TitleTag = titleAs === "h2" || titleAs === "h3" || titleAs === "p" ? titleAs : "p";

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.26, ease: "easeOut" },
      };

  return (
    <motion.section
      {...motionProps}
      className={classNames(
        "mx-auto w-full max-w-2xl text-center text-slate-600 dark:text-slate-300",
        sizeClass.wrapper,
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-describedby={sugestao ? descId : undefined}
      data-testid={testId}
    >
      <div
        className={classNames(
          "relative mx-auto mb-4 grid place-items-center overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
          sizeClass.iconBox
        )}
        aria-hidden="true"
      >
        <div
          className={classNames(
            "absolute inset-0 bg-gradient-to-br opacity-18 dark:opacity-25",
            theme.ring
          )}
        />

        <div className="absolute inset-0 bg-[radial-gradient(500px_circle_at_20%_0%,rgba(255,255,255,0.65),transparent_42%)] dark:bg-[radial-gradient(500px_circle_at_20%_0%,rgba(255,255,255,0.10),transparent_42%)]" />

        {renderIcon(Icone, classNames("relative", sizeClass.icon, theme.icon, iconClassName))}
      </div>

      <TitleTag
        id={titleId}
        className={classNames(
          "font-black tracking-tight text-slate-900 dark:text-slate-100",
          sizeClass.title
        )}
      >
        {mensagem}
      </TitleTag>

      {sugestao && (
        <p
          id={descId}
          className={classNames(
            "mx-auto mt-2 max-w-xl font-medium leading-relaxed text-slate-500 dark:text-slate-400",
            sizeClass.hint
          )}
        >
          {sugestao}
        </p>
      )}

      {normalizedActions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {normalizedActions.map((action, index) => {
            const isPrimary = action.variant === "primary";

            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title || action.label}
                className={classNames(
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                  "disabled:cursor-not-allowed disabled:opacity-55",
                  isPrimary
                    ? theme.primary
                    : ACTION_VARIANTS[action.variant] || ACTION_VARIANTS.secondary
                )}
              >
                {action.icon && (
                  <span className="shrink-0" aria-hidden="true">
                    {action.icon}
                  </span>
                )}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

NadaEncontrado.propTypes = {
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  Icone: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      icon: PropTypes.node,
      variant: PropTypes.oneOf(["primary", "secondary", "ghost"]),
      disabled: PropTypes.bool,
      title: PropTypes.string,
    })
  ),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  variant: PropTypes.oneOf(["emerald", "indigo", "cyan", "rose", "slate", "lousa"]),
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  testId: PropTypes.string,
  titleAs: PropTypes.oneOf(["p", "h2", "h3"]),
};