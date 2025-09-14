// 📁 src/components/ui/Loader.jsx
import PropTypes from "prop-types";

/**
 * Loader (spinner) acessível e responsivo.
 * - Usa verde-900 como cor principal.
 * - Dark mode suave (reduz opacidade p/ contraste).
 * - Aceita tamanhos e descrição (aria-label) para leitores de tela.
 */
export default function Loader({
  size = "md",
  className = "",
  ariaLabel = "Carregando…",
}) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`flex justify-center items-center py-4 ${className}`}
    >
      <div
        className={`${sizes[size]} rounded-full animate-spin border-verde-900 border-t-transparent dark:border-verde-900/80`}
      />
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

Loader.propTypes = {
  /** Tamanho do spinner */
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  /** Classe extra opcional */
  className: PropTypes.string,
  /** Texto para leitores de tela */
  ariaLabel: PropTypes.string,
};
