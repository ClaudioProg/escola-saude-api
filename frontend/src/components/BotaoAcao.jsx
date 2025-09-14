// 📁 src/components/BotaoAcao.jsx
import PropTypes from "prop-types";

/**
 * Botão de ação compacto.
 * - Usa paleta institucional (verde-900, azul-petróleo, âmbar, etc.).
 * - Dark-mode consistente.
 * - Foco visível e aria-label automáticos.
 * - Suporta estado disabled/loading.
 */
export default function BotaoAcao({
  label,
  icon,
  onClick,
  cor = "blue",
  disabled = false,
  loading = false,
  className = "",
}) {
  const cores = {
    blue: "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400",
    purple: "bg-purple-700 hover:bg-purple-800 focus-visible:ring-purple-400",
    green: "bg-green-700 hover:bg-green-800 focus-visible:ring-green-500",
    gray: "bg-gray-700 hover:bg-gray-800 focus-visible:ring-gray-400",
    red: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
    orange: "bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400",
    verde: "bg-green-900 hover:bg-green-800 focus-visible:ring-green-700",

    // 🌟 novas cores sugeridas
    amareloOuro: "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-300",
    laranjaQueimado: "bg-orange-600 hover:bg-orange-700 focus-visible:ring-orange-400",
    vermelhoCoral: "bg-red-500 hover:bg-red-600 focus-visible:ring-red-300",
    azulPetroleo: "bg-cyan-800 hover:bg-cyan-900 focus-visible:ring-cyan-600",
  };

  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 text-white text-xs rounded-full " +
    "transition font-medium focus:outline-none focus-visible:ring-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed select-none";

  return (
    <button
      type="button"
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`${base} ${cores[cor] || cores.blue} ${className}`}
      aria-label={label}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span
          className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      <span>{label}</span>
    </button>
  );
}

BotaoAcao.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.node,
  onClick: PropTypes.func.isRequired,
  cor: PropTypes.oneOf([
    "blue",
    "purple",
    "green",
    "gray",
    "red",
    "orange",
    "verde",
    "amareloOuro",
    "laranjaQueimado",
    "vermelhoCoral",
    "azulPetroleo",
  ]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
};
