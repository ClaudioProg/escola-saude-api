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
  if (!s) return "";
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function mapLabelToSlot(label) {
  const k = normKey(label);
  if (["realizados", "concluidos", "concluídos", "finalizados", "executados", "encerrados", "feitos"].includes(k))
    return "realizados";
  if (["programados", "agendados", "marcados", "futuros", "proximos", "próximos"].includes(k))
    return "programados";
  if (["instrutor", "ministrados", "como instrutor", "docente", "professor", "palestrante"].includes(k))
    return "instrutor";
  return null;
}

/**
 * Aceita:
 *  - objeto: { realizados, programados, instrutor } (qualquer caixa/acentos/sinônimos)
 *  - array: [{ label|status|tipo, valor|qtd|quantidade|count }]
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
  const readByAliases = (aliases) => {
    let sum = 0;
    for (const a of aliases) {
      if (a in input) sum += toNumber(input[a]);
      else {
        const m = keys.find((k) => normKey(k) === normKey(a));
        if (m) sum += toNumber(input[m]);
      }
    }
    return sum;
  };

  return {
    realizados: readByAliases(["realizados", "concluídos", "concluidos", "finalizados", "executados", "encerrados"]),
    programados: readByAliases(["programados", "agendados", "próximos", "proximos", "futuros", "marcados"]),
    instrutor: readByAliases(["instrutor", "ministrados", "como instrutor", "docente", "palestrante"]),
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
  const dataVals = [norm.realizados, norm.programados, norm.instrutor];

  // evita gráfico vazio
  const hasData = dataVals.some((v) => Number(v) > 0);
  const [reduceMotion, setReduceMotion] = useState(false);

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
  const colors = palette ?? [
    "#065f46", // emerald-800 — Realizados
    "#b45309", // amber-700   — Programados
    "#1d4ed8", // blue-700    — Instrutor
  ];

  const data = {
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
  };

  const options = {
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
        ticks: {
          color: (ctx) =>
            document.documentElement.classList.contains("dark") ? "#e5e7eb" : "#374151",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: (ctx) =>
            document.documentElement.classList.contains("dark") ? "#e5e7eb" : "#374151",
        },
        grid: {
          color: (ctx) =>
            document.documentElement.classList.contains("dark") ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        },
      },
    },
  };

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: height }}
      role="img"
      aria-label="Gráfico de barras com totais de eventos realizados, programados e como instrutor."
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
