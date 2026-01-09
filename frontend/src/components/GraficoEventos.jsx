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
      "concluído",
      "concluidos",
      "finalizados",
      "executados",
      "encerrados",
      "feitos",
      "realizado",
      "finalizado",
      "encerrado",
    ].includes(k)
  ) return "realizados";

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
      "próximos",
      "próximo",
      "proximas",
      "próxima",
      "próximas",
    ].includes(k)
  ) return "programados";

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
  ) return "instrutor";

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

/* -------------------- Plugin opcional: labels nos topos -------------------- */
const ValueLabelsPlugin = {
  id: "valueLabels",
  afterDatasetsDraw(chart, _args, pluginOpts) {
    const { ctx } = chart;
    const ds = chart.getDatasetMeta(0);
    if (!ds || !ds.data) return;

    const show = pluginOpts?.show ?? false;
    if (!show) return;

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";

    for (let i = 0; i < ds.data.length; i++) {
      const bar = ds.data[i];
      const val = chart.data.datasets[0].data[i];
      if (!bar || val == null) continue;

      const { x, y } = bar.tooltipPosition();
      // leve contorno para legibilidade em fundos claros/escuros
      ctx.fillStyle = isDark ? "rgba(250,250,250,0.95)" : "rgba(17,24,39,0.95)";
      ctx.strokeStyle = isDark ? "rgba(17,24,39,0.35)" : "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      const text = `${val}`;
      ctx.strokeText(text, x, y - 8);
      ctx.fillText(text, x, y - 8);
    }
    ctx.restore();
  },
};

/* ------------------------------ Componente ------------------------------ */
export default function GraficoEventos({
  dados = {},
  height = 280,
  className = "",
  palette,                      // opcional: sobrescrever cores
  showLegend = false,
  showPercentInTooltip = true,  // 🍰 tooltip com %
  showValueLabels = true,       // 12 ↑ labels no topo das barras
  borderRadius = 8,             // arredondamento das barras
}) {
  const norm = useMemo(() => normalizeEventos(dados), [dados]);
  const dataVals = useMemo(
    () => [norm.realizados, norm.programados, norm.instrutor],
    [norm]
  );
  const total = dataVals.reduce((a, b) => a + (Number(b) || 0), 0);
  const hasData = dataVals.some((v) => Number(v) > 0);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  // tema reativo + motion
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(!!mq.matches);
    const onChange = (e) => setReduceMotion(!!e.matches);
    mq.addEventListener?.("change", onChange);

    const html = document.documentElement;
    const updateDark = () => setIsDark(html.classList.contains("dark"));
    updateDark();
    const obs = new MutationObserver(updateDark);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mq.removeEventListener?.("change", onChange);
      obs.disconnect();
    };
  }, []);

  if (!hasData) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300 italic text-center">
        (Sem dados de eventos)
      </p>
    );
  }

  // Paleta padrão (coerente com o app)
  const colors = useMemo(
    () =>
      palette ?? [
        "#065f46", // emerald-800 — Realizados
        "#b45309", // amber-700   — Programados
        "#1d4ed8", // blue-700    — Instrutor
      ],
    [palette]
  );

  const borderColor = isDark ? "rgba(17,24,39,0.75)" : "#ffffff";
  const tickColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const data = useMemo(
    () => ({
      labels: ["Realizados", "Programados", "Instrutor"],
      datasets: [
        {
          label: "Eventos",
          data: dataVals,
          backgroundColor: colors,
          borderColor,
          borderWidth: 1.5,
          borderSkipped: false,
          borderRadius,
        },
      ],
    }),
    [dataVals, colors, borderColor, borderRadius]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: reduceMotion ? false : { duration: 600 },
      plugins: {
        legend: { display: showLegend, position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Number(ctx.raw) || 0;
              if (!showPercentInTooltip) return `${ctx.label}: ${val}`;
              const sum = (ctx.dataset.data || []).reduce((a, b) => a + (Number(b) || 0), 0);
              const percent = sum ? ((val / sum) * 100).toFixed(1) : "0.0";
              return `${ctx.label}: ${val} (${percent}%)`;
            },
          },
        },
        valueLabels: { show: showValueLabels }, // plugin próprio
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
    [reduceMotion, showLegend, showPercentInTooltip, showValueLabels, tickColor, gridColor]
  );

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: height }}
      role="img"
      aria-label={`Gráfico de barras com totais de eventos (${total} no período): realizados, programados e como instrutor.`}
    >
      <Bar data={data} options={options} plugins={[ValueLabelsPlugin]} />
    </div>
  );
}

GraficoEventos.propTypes = {
  dados: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  height: PropTypes.number,
  className: PropTypes.string,
  palette: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
  showPercentInTooltip: PropTypes.bool,
  showValueLabels: PropTypes.bool,
  borderRadius: PropTypes.number,
};
