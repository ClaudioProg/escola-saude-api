// ✅ frontend/src/components/eventos/ResumoEventoCard.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Card-resumo oficial para métricas do domínio de eventos.
//
// Revisão premium:
// - componente específico de eventos;
// - contrato visual único para cards de resumo;
// - sem compatibilidade legada desnecessária;
// - sem aliases para tipo;
// - acessível quando clicável ou apenas informativo;
// - suporte a loading, subtítulo, hint, tendência e estado desabilitado;
// - visual premium, responsivo e com reduced motion;
// - contrato simples, previsível e manutenível.
//
// Contrato oficial atual do componente:
// - tipo: inscritos | presencas | avaliacao | geral
// - trend.dir: up | down
//
// Observação:
// - "inscritos" e "presencas" foram mantidos por serem o contrato atual
//   deste componente. Não foi criado alias singular para evitar dupla forma.

import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle,
  Info,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const TIPOS_CARD = Object.freeze({
  inscritos: {
    icon: Users,
    label: "Inscritos",
    gradient:
      "from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950 dark:via-sky-900/60 dark:to-sky-900/30",
    text: "text-sky-950 dark:text-sky-50",
    iconBg: "bg-white/75 dark:bg-white/10",
    iconText: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/15 dark:ring-sky-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(2,132,199,0.55)]",
  },

  presencas: {
    icon: CheckCircle,
    label: "Presenças",
    gradient:
      "from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950 dark:via-emerald-900/60 dark:to-emerald-900/30",
    text: "text-emerald-950 dark:text-emerald-50",
    iconBg: "bg-white/75 dark:bg-white/10",
    iconText: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/15 dark:ring-emerald-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(16,185,129,0.55)]",
  },

  avaliacao: {
    icon: Star,
    label: "Avaliação",
    gradient:
      "from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950 dark:via-amber-900/60 dark:to-amber-900/30",
    text: "text-amber-950 dark:text-amber-50",
    iconBg: "bg-white/75 dark:bg-white/10",
    iconText: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/15 dark:ring-amber-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(245,158,11,0.55)]",
  },

  geral: {
    icon: Info,
    label: "Resumo",
    gradient:
      "from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-900/30",
    text: "text-slate-950 dark:text-slate-50",
    iconBg: "bg-white/75 dark:bg-white/10",
    iconText: "text-slate-700 dark:text-slate-300",
    ring: "ring-black/10 dark:ring-white/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(15,23,42,0.45)]",
  },
});

const TIPOS_ACEITOS = Object.freeze(Object.keys(TIPOS_CARD));

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(valor) : "—";
  }

  return String(valor);
}

function getTipoCard(tipo) {
  return TIPOS_CARD[tipo] || TIPOS_CARD.geral;
}

function normalizarTitulo(value, fallback) {
  const texto = String(value || "").trim();

  return texto || fallback;
}

function normalizarTrend(trend) {
  if (!trend || typeof trend !== "object") {
    return null;
  }

  if (trend.dir !== "up" && trend.dir !== "down") {
    return null;
  }

  return {
    dir: trend.dir,
    value: trend.value ? String(trend.value).trim() : "",
  };
}

function getTrendClass(dir) {
  if (dir === "down") {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  return "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
}

export default function ResumoEventoCard({
  tipo = "geral",
  titulo,
  valor,
  compact = false,
  subtitulo = "",
  hint = "",
  trend = null,
  loading = false,
  disabled = false,
  onClick,
  title,
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  const card = getTipoCard(tipo);
  const Icon = card.icon;

  const tituloSeguro = normalizarTitulo(titulo, card.label);
  const subtituloSeguro = String(subtitulo || "").trim();
  const hintSeguro = String(hint || "").trim();
  const valorFormatado = formatarValor(valor);

  const trendSeguro = normalizarTrend(trend);
  const TrendIcon = trendSeguro?.dir === "down" ? TrendingDown : TrendingUp;

  const clicavel = typeof onClick === "function" && !disabled && !loading;

  const ariaLabel = loading
    ? `${tituloSeguro}: carregando`
    : `${tituloSeguro}: ${valorFormatado}`;

  const motionProps = reduceMotion
    ? {}
    : {
        whileHover: clicavel
          ? {
              scale: 1.015,
              y: -2,
            }
          : undefined,
        whileTap: clicavel
          ? {
              scale: 0.99,
            }
          : undefined,
        transition: {
          type: "spring",
          stiffness: 260,
          damping: 18,
        },
      };

  const handleKeyDown = (event) => {
    if (!clicavel) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <motion.article
      {...motionProps}
      onClick={clicavel ? onClick : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={clicavel ? 0 : undefined}
      role={clicavel ? "button" : "group"}
      aria-label={ariaLabel}
      aria-busy={loading ? "true" : "false"}
      aria-disabled={disabled ? "true" : undefined}
      title={title || tituloSeguro}
      className={classNames(
        "relative overflow-hidden rounded-3xl p-4 ring-1 select-none",
        "bg-gradient-to-br",
        card.gradient,
        card.text,
        card.ring,
        card.glow,
        clicavel &&
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        (disabled || loading) && "cursor-not-allowed opacity-75",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.58),transparent_40%)] dark:bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.10),transparent_45%)]" />

      <div className="relative flex items-center gap-4">
        <span
          className={classNames(
            "shrink-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/10",
            card.iconBg,
            compact ? "p-2" : "p-3"
          )}
          aria-hidden="true"
        >
          <Icon
            className={classNames(
              card.iconText,
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight opacity-90">
                {tituloSeguro}
              </p>

              {subtituloSeguro && (
                <p className="mt-0.5 truncate text-xs font-medium opacity-80">
                  {subtituloSeguro}
                </p>
              )}
            </div>

            {trendSeguro?.dir && (
              <span
                className={classNames(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ring-1 ring-black/5 dark:ring-white/10",
                  getTrendClass(trendSeguro.dir)
                )}
                aria-label={`Tendência de ${
                  trendSeguro.dir === "down" ? "queda" : "alta"
                }${trendSeguro.value ? `: ${trendSeguro.value}` : ""}`}
              >
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {trendSeguro.value || (trendSeguro.dir === "down" ? "↓" : "↑")}
              </span>
            )}
          </div>

          <div className="mt-2">
            {loading ? (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-7 w-28 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
                <div className="h-3 w-40 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
              </div>
            ) : (
              <>
                <div
                  className={classNames(
                    "font-black leading-none tracking-tight",
                    compact ? "text-xl" : "text-3xl"
                  )}
                >
                  {valorFormatado}
                </div>

                {hintSeguro && (
                  <div className="mt-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium opacity-85">
                    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{hintSeguro}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

ResumoEventoCard.propTypes = {
  tipo: PropTypes.oneOf(TIPOS_ACEITOS),
  titulo: PropTypes.string.isRequired,
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compact: PropTypes.bool,
  subtitulo: PropTypes.string,
  hint: PropTypes.string,
  trend: PropTypes.shape({
    dir: PropTypes.oneOf(["up", "down"]).isRequired,
    value: PropTypes.string,
  }),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  title: PropTypes.string,
  className: PropTypes.string,
};