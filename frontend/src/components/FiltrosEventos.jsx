// ✅ src/components/FiltrosEventos.jsx
import React, { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import FiltroToggleGroup from "./FiltroToggleGroup";

/**
 * Componente de filtros para eventos (por status)
 * - Opções: todos | programado | andamento | encerrado
 * - Usa o componente FiltroToggleGroup para renderização visual
 */
export default function FiltrosEventos({
  filtroSelecionado = "todos",
  onFiltroChange,
  onChangeFiltro,
  className = "",
  ariaLabel = "Filtros de eventos por status",
}) {
  const ACEITOS = useMemo(
    () => new Set(["todos", "programado", "andamento", "encerrado"]),
    []
  );

  const opcoes = useMemo(
    () => [
      { valor: "todos", rotulo: "Todos" },
      { valor: "programado", rotulo: "Programados" },
      { valor: "andamento", rotulo: "Em andamento" },
      { valor: "encerrado", rotulo: "Encerrados" },
    ],
    []
  );

  const valorSeguro = ACEITOS.has(String(filtroSelecionado))
    ? filtroSelecionado
    : "todos";

  const handleSelecionar = useCallback(
    (v) => {
      const novo = ACEITOS.has(String(v)) ? v : "todos";
      const cb = typeof onFiltroChange === "function" ? onFiltroChange : onChangeFiltro;
      if (typeof cb === "function") cb(novo);
    },
    [onFiltroChange, onChangeFiltro, ACEITOS]
  );

  return (
    <div
      className={[
        "mb-4",
        "p-2 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-lime-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label={ariaLabel}
    >
      <FiltroToggleGroup
        opcoes={opcoes}
        valorSelecionado={valorSeguro}
        aoSelecionar={handleSelecionar}
        ariaLabel="Filtrar eventos por status"
        className="w-full"
      />
    </div>
  );
}

FiltrosEventos.propTypes = {
  filtroSelecionado: PropTypes.string,
  onFiltroChange: PropTypes.func,
  onChangeFiltro: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};
