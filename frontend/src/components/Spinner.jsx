// 📁 src/components/Spinner.jsx
import PropTypes from "prop-types";

/**
 * Spinner — indicador de carregamento moderno e acessível.
 */
export default function Spinner({
  size = 40,
  colorClass = "from-lousa via-lousa/70 to-transparent dark:from-white dark:via-white/60",
  className = "",
  srText = "Carregando...",
  showLabel = false,
}) {
  const dimensao = typeof size === "number" ? `${size}px` : size;
  const thickness = Math.max(Math.round(parseInt(size, 10) / 10), 3);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 min-h-[100px] ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={srText}
    >
      <div
        aria-hidden="true"
        className={`animate-spin rounded-full bg-gradient-to-tr ${colorClass}`}
        style={{
          width: dimensao,
          height: dimensao,
          borderWidth: `${thickness}px`,
          borderStyle: "solid",
          borderColor: "transparent",
          borderTopColor: "currentColor",
          maskImage:
            "conic-gradient(from 180deg at 50% 50%, transparent 0deg, black 360deg)",
        }}
      />
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-300">{srText}</span>
      )}
      <span className="sr-only">{srText}</span>
    </div>
  );
}

Spinner.propTypes = {
  /** Tamanho do spinner (px ou string ex.: "3rem") */
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Classes Tailwind aplicadas ao gradiente giratório */
  colorClass: PropTypes.string,
  /** Classe extra opcional para o container */
  className: PropTypes.string,
  /** Texto lido por leitores de tela */
  srText: PropTypes.string,
  /** Exibe o texto visivelmente abaixo do spinner */
  showLabel: PropTypes.bool,
};
