// 📁 src/components/FiltrosEventos.jsx
import React, { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import FiltroToggleGroup from "./FiltroToggleGroup";

export default function FiltrosEventos({
  filtroSelecionado = "todos",            // ⬅️ default param
  onFiltroChange,
  onChangeFiltro,                          // alias compat
  className = "",                          // ⬅️ default param
  ariaLabel = "Filtros de eventos por status", // ⬅️ default param
}) {
  const ACEITOS = useMemo(() => new Set(["todos", "programado", "andamento", "encerrado"]), []);

  const opcoes = useMemo(
    () => [
      { valor: "todos", rotulo: "Todos" },
      { valor: "programado", rotulo: "Programados" },
      { valor: "andamento", rotulo: "Em andamento" },
      { valor: "encerrado", rotulo: "Encerrados" },
    ],
    []
  );

  const valorSeguro = ACEITOS.has(String(filtroSelecionado)) ? filtroSelecionado : "todos";

  const handleSelecionar = useCallback(
    (v) => {
      const novo = ACEITOS.has(String(v)) ? v : "todos";
      const cb = typeof onFiltroChange === "function" ? onFiltroChange : onChangeFiltro;
      if (typeof cb === "function") cb(novo);
    },
    [onFiltroChange, onChangeFiltro, ACEITOS]
  );

  return (
    <div className={["mb-4", className].filter(Boolean).join(" ")} role="region" aria-label={ariaLabel}>
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
  filtroSelecionado: PropTypes.string,    // não precisa mais .isRequired (já tem default param)
  onFiltroChange: PropTypes.func,
  onChangeFiltro: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};
