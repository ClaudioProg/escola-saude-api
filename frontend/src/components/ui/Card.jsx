// 📁 src/components/ui/Card.jsx
import PropTypes from "prop-types";

/**
 * Card genérico para agrupar conteúdo.
 * - Responsivo e acessível (role="group").
 * - Paleta alinhada ao projeto (verde-900, azul-petróleo, etc).
 * - Suporte a variantes (default, outlined, muted).
 * - Aceita children interativos (botões, links) com foco visível.
 */
export default function Card({
  children,
  className = "",
  variant = "default",
  padding = "p-4",
  shadow = "shadow-md",
  ...rest
}) {
  const base =
    "rounded-2xl w-full transition-colors duration-200 focus-within:ring-2 " +
    "focus-within:ring-offset-2 focus-within:ring-verde-900/50";

  const variants = {
    default:
      "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
    outlined:
      "bg-transparent border border-gray-300 dark:border-gray-700 " +
      "text-gray-900 dark:text-gray-100",
    muted:
      "bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100",
    success:
      "bg-verde-900 text-white dark:bg-verde-900/90",
  };

  return (
    <div
      role="group"
      className={`${base} ${variants[variant]} ${padding} ${shadow} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  /** Visual style of the card */
  variant: PropTypes.oneOf(["default", "outlined", "muted", "success"]),
  /** Tailwind padding classes (e.g. p-4, p-6) */
  padding: PropTypes.string,
  /** Tailwind shadow classes (e.g. shadow-md, shadow-lg, shadow-none) */
  shadow: PropTypes.string,
};
