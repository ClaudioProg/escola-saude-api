// ✅ src/components/FiltrosEventos.jsx
import React, { useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import FiltroToggleGroup from "./FiltroToggleGroup";

/** Conjunto aceito de filtros */
const ACEITOS = new Set(["todos", "programado", "andamento", "encerrado"]);

/** Lista base de opções (pode ser enriquecida com contagens) */
const BASE_OPCOES = [
  { valor: "todos",       rotulo: "Todos" },
  { valor: "programado",  rotulo: "Programados" },
  { valor: "andamento",   rotulo: "Em andamento" },
  { valor: "encerrado",   rotulo: "Encerrados" },
];

/** Normaliza o valor do filtro */
function normalizarValor(v) {
  const s = String(v || "").toLowerCase();
  return ACEITOS.has(s) ? s : "todos";
}

/**
 * Componente de filtros para eventos (por status).
 * - Opções: todos | programado | andamento | encerrado
 * - Usa FiltroToggleGroup para renderização visual.
 * - Suporta contagens por status (ex.: { programado: 5 } -> "Programados (5)").
 */
export default function FiltrosEventos({
  filtroSelecionado = "todos",
  onFiltroChange,      // preferencial
  onChangeFiltro,      // legado (fallback)
  contagens = null,    // { todos?:n, programado?:n, andamento?:n, encerrado?:n }
  className = "",
  ariaLabel = "Filtros de eventos por status",
}) {
  const valorSeguro = normalizarValor(filtroSelecionado);

  // Constrói rótulos com contagem quando fornecida
  const opcoes = useMemo(() => {
    if (!contagens || typeof contagens !== "object") return BASE_OPCOES;
    return BASE_OPCOES.map((o) => {
      const qtd = Number.isFinite(Number(contagens[o.valor])) ? Number(contagens[o.valor]) : null;
      return qtd != null ? { ...o, rotulo: `${o.rotulo} (${qtd})` } : o;
    });
  }, [contagens]);

  // Callback unificado (prioriza onFiltroChange)
  const handleSelecionar = useCallback(
    (v) => {
      const novo = normalizarValor(v);
      const cb = typeof onFiltroChange === "function" ? onFiltroChange : onChangeFiltro;
      if (typeof cb === "function") cb(novo);
    },
    [onFiltroChange, onChangeFiltro]
  );

  // a11y: anuncia a seleção atual
  const liveRef = useRef(null);
  useEffect(() => {
    if (!liveRef.current) return;
    const labelAtual = opcoes.find((o) => o.valor === valorSeguro)?.rotulo || "Todos";
    liveRef.current.textContent = `Filtro selecionado: ${labelAtual}.`;
  }, [valorSeguro, opcoes]);

  return (
    <div
      className={[
        "mb-4",
        "p-2 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-lime-50",
        "dark:from-gray-800 dark:via-gray-900 dark:to-gray-950",
        className,
      ].filter(Boolean).join(" ")}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Região live invisível para leitores de tela */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <FiltroToggleGroup
        opcoes={opcoes}
        valorSelecionado={valorSeguro}
        aoSelecionar={handleSelecionar}
        ariaLabel="Filtrar eventos por status"
        className="w-full"
        data-testid="filtros-eventos"
      />
    </div>
  );
}

FiltrosEventos.propTypes = {
  filtroSelecionado: PropTypes.string,
  onFiltroChange: PropTypes.func,
  onChangeFiltro: PropTypes.func, // legado
  /** Mostra contagens nos rótulos: { todos, programado, andamento, encerrado } */
  contagens: PropTypes.shape({
    todos: PropTypes.number,
    programado: PropTypes.number,
    andamento: PropTypes.number,
    encerrado: PropTypes.number,
  }),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};
