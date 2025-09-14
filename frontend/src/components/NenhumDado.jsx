// 📁 src/components/NenhumDado.jsx
import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";

const sizeMap = {
  sm: { wrap: "w-12 h-12", icon: "w-6 h-6", title: "text-base", hint: "text-xs" },
  md: { wrap: "w-16 h-16", icon: "w-8 h-8", title: "text-lg", hint: "text-sm" },
  lg: { wrap: "w-20 h-20", icon: "w-10 h-10", title: "text-xl", hint: "text-base" },
};

export default function NenhumDado({
  mensagem = "Nenhum dado encontrado.",
  sugestao,
  Icone = AlertCircle,
  ctaLabel,
  onCta,
  size = "md",
  bordered = false,
  iconBackground = true,
  ariaLive = "polite", // 'polite' | 'assertive' | null (desliga role/aria-live)
  className = "",
  "data-testid": testId,
}) {
  const s = sizeMap[size] || sizeMap.md;
  const hasCta = typeof onCta === "function" && !!ctaLabel;

  return (
    <motion.div
      className={[
        "flex flex-col items-center justify-center py-10 px-4 text-gray-600 dark:text-gray-300",
        bordered ? "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" : "",
        className,
      ].join(" ")}
      role={ariaLive ? "status" : undefined}
      aria-live={ariaLive || undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid={testId}
    >
      <div
        className={[
          "inline-flex items-center justify-center mb-4",
          iconBackground ? "rounded-full bg-gray-100 dark:bg-gray-800" : "",
          s.wrap,
        ].join(" ")}
      >
        <Icone className={`${s.icon} text-lousa dark:text-white`} aria-hidden="true" />
      </div>

      <p className={`${s.title} font-semibold text-center`}>{mensagem}</p>

      {sugestao && (
        <p className={`${s.hint} text-gray-500 dark:text-gray-400 mt-1 text-center`}>{sugestao}</p>
      )}

      {hasCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 inline-flex items-center rounded-lg bg-lousa text-white px-4 py-2 text-sm font-semibold hover:bg-green-800 focus-visible:ring-2 focus-visible:ring-green-400"
        >
          {ctaLabel}
        </button>
      )}
    </motion.div>
  );
}

NenhumDado.propTypes = {
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  Icone: PropTypes.elementType,
  ctaLabel: PropTypes.string,
  onCta: PropTypes.func,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  bordered: PropTypes.bool,
  iconBackground: PropTypes.bool,
  ariaLive: PropTypes.oneOf(["polite", "assertive", null]),
  className: PropTypes.string,
  "data-testid": PropTypes.string,
};
