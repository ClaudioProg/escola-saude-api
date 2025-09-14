// 📁 src/components/FiltrosEventos.jsx
import PropTypes from "prop-types";
import FiltroToggleGroup from "./FiltroToggleGroup"; // ✅ já criado anteriormente

export default function FiltrosEventos({ filtroSelecionado, onFiltroChange }) {
  const opcoes = [
    { valor: "todos", rotulo: "Todos" },
    { valor: "programado", rotulo: "Programados" },
    { valor: "em andamento", rotulo: "Em andamento" },
    { valor: "encerrado", rotulo: "Encerrados" },
  ];

  return (
    <div
      className="mb-4"
      role="region"
      aria-label="Filtros de eventos por status"
    >
      <FiltroToggleGroup
        opcoes={opcoes}
        valorSelecionado={filtroSelecionado}
        aoSelecionar={(v) => {
          if (typeof onFiltroChange === "function") onFiltroChange(v);
        }}
        ariaLabel="Filtrar eventos por status"
        className="w-full"
      />
    </div>
  );
}

FiltrosEventos.propTypes = {
  filtroSelecionado: PropTypes.string.isRequired,
  onFiltroChange: PropTypes.func.isRequired,
};
