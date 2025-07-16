import PropTypes from "prop-types";
import FiltroToggleGroup from "./FiltroToggleGroup"; // ✅ já criado anteriormente

export default function FiltrosEventos({ filtroSelecionado, onFiltroChange }) {
  const opcoes = [
    { valor: "todos", rotulo: "Todos" },
    { valor: "programado", rotulo: "Programados" },
    { valor: "em andamento", rotulo: "Em Andamento" },
    { valor: "encerrado", rotulo: "Encerrados" },
  ];

  return (
    <FiltroToggleGroup
      opcoes={opcoes}
      valorSelecionado={filtroSelecionado}
      aoSelecionar={onFiltroChange}
      ariaLabel="Filtros de eventos por status"
    />
  );
}

FiltrosEventos.propTypes = {
  filtroSelecionado: PropTypes.string.isRequired,
  onFiltroChange: PropTypes.func.isRequired,
};
