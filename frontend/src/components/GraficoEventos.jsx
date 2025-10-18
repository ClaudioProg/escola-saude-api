// 📁 src/components/GraficoEventos.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/* ------------------------ Helpers de normalização ------------------------ */
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function normKey(s) {
  if (s === 0) return "0";
  if (!s && s !== 0) return "";
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function mapLabelToSlot(label) {
  const k = normKey(label);
  if (
    [
      "realizados",
      "concluidos",
      "concluido",
      "concluidos",
      "concluido",
      "concluidos",
      "finalizados",
      "executados",
      "encerrados",
      "feitos",
      "realizado",
      "finalizado",
      "encerrado",
    ].includes(k)
  )
    return "realizados";

  if (
    [
      "programados",
      "programado",
      "agendados",
      "agendado",
      "marcados",
      "marcado",
      "futuros",
      "futuro",
      "proximos",
      "proximo",
      "proximas",
      "proxima",
      "próximos",
      "próximo",
      "próximas",
      "próxima",
    ].includes(k)
  )
    return "programados";

  if (
    [
      "instrutor",
      "ministrados",
      "ministrado",
      "como instrutor",
      "docente",
      "professor",
      "palestrante",
      "como docente",
      "como palestrante",
    ].includes(k)
  )
    return "instrutor";

  return null;
}

/**
 * Aceita:
 *  - objeto: { realizados, programados, instrutor } (qualquer caixa/acentos/sinônimos)
 *  - array: [{ label|status|tipo|nome|categoria, valor|qtd|quantidade|count|total|numero }]
 */
export function normalizeEventos(input) {
  const base = { realizados: 0, programados: 0, instrutor: 0 };
  if (!input) return base;

  // Array de itens
  if (Array.isArray(input)) {
    const acc = { ...base };
    for (const item of input) {
      const label =
        item?.label ?? item?.status ?? item?.tipo ?? item?.nome ?? item?.categoria;
      const slot = mapLabelToSlot(label);
      const valor =
        item?.valor ?? item?.qtd ?? item?.quantidade ?? item?.count ?? item?.total ?? item?.numero;
      if (slot) acc[slot] += toNumber(valor);
    }
    return acc;
  }

  // Objeto plano (soma aliases compatíveis)
  const keys = Object.keys(input || {});
  const sumByAliases = (aliases) =>
    aliases.reduce((sum, a) => {
      if (a in input) return sum + toNumber(input[a]);
      const m = keys.find((k) => normKey(k) === normKey(a));
      return m ? sum + toNumber(input[m]) : sum;
    }, 0);

  return {
    realizados: sumByAliases([
      "realizados",
      "realizado",
      "concluídos",
      "concluidos",
      "finalizados",
      "executados",
      "encerrados",
      "feitos",
    ]),
    programados: sumByAliases([
      "programados",
      "programado",
      "agendados",
      "agendado",
      "próximos",
      "proximos",
      "futuros",
      "marcados",
      "marcado",
    ]),
    instrutor: sumByAliases([
      "instrutor",
      "ministrados",
      "ministrado",
      "como instrutor",
      "docente",
      "palestrante",
      "professor",
    ]),
  };
}

/* ------------------------------ Componente ------------------------------ */
export default function GraficoEventos({
  dados = {},
  height = 280,                 // altura mínima do container
  className = "",
  palette,                      // opcional: sobrescrever cores
  showLegend = false,
}) {
  const norm = useMemo(() => normalizeEventos(dados), [dados]);
  const dataVals = useMemo(
    () => [norm.realizados, norm.programados, norm.instrutor],
    [norm]
  );

  const total = dataVals.reduce((a, b) => a + (Number(b) || 0), 0);
  const hasData = dataVals.some((v) => Number(v) > 0);

  const [reduceMotion, setReduceMotion] = useState(false);
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const tickColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(!!mq.matches);
    const onChange = (e) => setReduceMotion(!!e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  if (!hasData) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300 italic text-center">
        (Sem dados de eventos)
      </p>
    );
  }

  // Paleta padrão (coerente com o restante do app)
  const colors = useMemo(
    () =>
      palette ?? [
        "#065f46", // emerald-800 — Realizados
        "#b45309", // amber-700   — Programados
        "#1d4ed8", // blue-700    — Instrutor
      ],
    [palette]
  );

  const data = useMemo(
    () => ({
      labels: ["Realizados", "Programados", "Instrutor"],
      datasets: [
        {
          label: "Eventos",
          data: dataVals,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 1.5,
          borderSkipped: false,
        },
      ],
    }),
    [dataVals, colors]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false, // usa a altura do container
      animation: reduceMotion ? false : { duration: 600 },
      plugins: {
        legend: { display: showLegend, position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Number(ctx.raw) || 0;
              return `${ctx.label}: ${val}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: tickColor },
          grid: { color: gridColor },
        },
      },
    }),
    [reduceMotion, showLegend, tickColor, gridColor]
  );

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: height }}
      role="img"
      aria-label={`Gráfico de barras com totais de eventos (${total} no período): realizados, programados e como instrutor.`}
    >
      <Bar data={data} options={options} />
    </div>
  );
}

GraficoEventos.propTypes = {
  dados: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  height: PropTypes.number,
  className: PropTypes.string,
  palette: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
};
