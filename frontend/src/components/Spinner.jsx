// 📁 src/components/Spinner.jsx
import PropTypes from "prop-types";

/**
 * Spinner
 * Indicador de carregamento com animação de rotação.
 */
export default function Spinner({
  size = 40,
  colorClass = "border-lousa dark:border-white",
  className = "",
  srText = "Carregando...",
}) {
  const dimensao = typeof size === "number" ? `${size}px` : size;

  return (
    <div
      className={`flex items-center justify-center min-h-[120px] ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        aria-hidden="true"
        className={`animate-spin rounded-full border-t-4 border-b-4 ${colorClass}`}
        style={{ width: dimensao, height: dimensao }}
      />
      <span className="sr-only">{srText}</span>
    </div>
  );
}

Spinner.propTypes = {
  /** Tamanho do spinner (px ou string ex.: "3rem") */
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Classes Tailwind para as bordas (cor/tema) */
  colorClass: PropTypes.string,
  /** Classe extra opcional para o container */
  className: PropTypes.string,
  /** Texto lido por leitores de tela */
  srText: PropTypes.string,
};
