// 📁 src/components/FiltroToggleGroup.jsx
import PropTypes from "prop-types";

const VARIANTS = {
  padrao: {
    active: "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600",
    ring: "focus-visible:ring-emerald-500",
  },
  amareloOuro: {
    active: "bg-amber-500 text-black border-amber-500 hover:bg-amber-600",
    ring: "focus-visible:ring-amber-400",
  },
  azulPetroleo: {
    active: "bg-cyan-800 text-white border-cyan-800 hover:bg-cyan-900",
    ring: "focus-visible:ring-cyan-600",
  },
  laranjaQueimado: {
    active: "bg-orange-600 text-white border-orange-600 hover:bg-orange-700",
    ring: "focus-visible:ring-orange-400",
  },
};

export default function FiltroToggleGroup({
  opcoes = [],
  valorSelecionado,
  aoSelecionar,
  ariaLabel = "Grupo de filtros",
  variant = "amareloOuro", // contraste alto por padrão
}) {
  const v = VARIANTS[variant] || VARIANTS.padrao;

  return (
    <div
      className="flex justify-center flex-wrap gap-2 mb-6"
      role="group"
      aria-label={ariaLabel}
    >
      {opcoes.map(({ valor, rotulo }) => {
        const ativo = valorSelecionado === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => aoSelecionar(valor)}
            aria-pressed={ativo}
            className={[
              "px-4 py-1 rounded-full text-sm font-medium border transition-colors duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              v.ring,
              ativo
                ? v.active
                : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700",
            ].join(" ")}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

FiltroToggleGroup.propTypes = {
  opcoes: PropTypes.arrayOf(
    PropTypes.shape({
      valor: PropTypes.string.isRequired,
      rotulo: PropTypes.string.isRequired,
    })
  ).isRequired,
  valorSelecionado: PropTypes.string.isRequired,
  aoSelecionar: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["padrao", "amareloOuro", "azulPetroleo", "laranjaQueimado"]),
};
