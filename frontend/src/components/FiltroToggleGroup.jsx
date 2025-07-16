import PropTypes from "prop-types";

export default function FiltroToggleGroup({
  opcoes = [],
  valorSelecionado,
  aoSelecionar,
  ariaLabel = "Grupo de filtros",
}) {
  return (
    <div
      className="flex justify-center flex-wrap gap-2 mb-6"
      role="group"
      aria-label={ariaLabel}
    >
      {opcoes.map(({ valor, rotulo }) => (
        <button
          key={valor}
          onClick={() => aoSelecionar(valor)}
          className={`px-4 py-1 rounded-full text-sm font-medium border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
            ${
              valorSelecionado === valor
                ? "bg-lousa text-white border-lousa"
                : "bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          aria-pressed={valorSelecionado === valor}
        >
          {rotulo}
        </button>
      ))}
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
};
