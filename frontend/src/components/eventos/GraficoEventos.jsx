// ✅ frontend/src/components/eventos/GraficoEventos.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Gráfico específico de eventos do dashboard do usuário.
//
// Contrato oficial atual confirmado no dashboardController:
// - dados.cursosRealizados
// - dados.proximosEventos
// - dados.eventosorganizador
//
// Observação importante:
// - A chave `eventosorganizador` está assim no controller atual.
// - Não usar alias `eventosorganizador` sem alterar o backend junto.
// - Sem aliases.
// - Sem compatibilidade legada.
// - Sem inferir nomes alternativos.
// - Sem aceitar realizados/programados/organizador como entrada.
// - Sem mudar contrato visual do dashboard por suposição.
// - Mantém acessibilidade por aria-label e tabela sr-only.
// - Respeita preferência de movimento reduzido.

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useReducedMotion } from "framer-motion";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const DEFAULT_PALETTE = Object.freeze([
  "#065f46", // cursosRealizados
  "#b45309", // proximosEventos
  "#1d4ed8", // eventosorganizador
]);

const LABELS = Object.freeze([
  "Cursos realizados",
  "Próximos eventos",
  "Eventos como organizador",
]);

const OFFICIAL_KEYS = Object.freeze([
  "cursosRealizados",
  "proximosEventos",
  "eventosorganizador",
]);

const EMPTY_EVENTOS_DASHBOARD = Object.freeze({
  cursosRealizados: 0,
  proximosEventos: 0,
  eventosorganizador: 0,
});

function toSafeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isValidCssColorLike(value) {
  return typeof value === "string" && value.trim().length >= 3;
}

function normalizeHeight(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return 280;
}

function useDarkModeFromDocument() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;

    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (typeof MutationObserver === "undefined") return undefined;

    const html = document.documentElement;

    const updateDarkMode = () => {
      setIsDark(html.classList.contains("dark"));
    };

    updateDarkMode();

    const observer = new MutationObserver(updateDarkMode);

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

function normalizeEventosDashboard(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return { ...EMPTY_EVENTOS_DASHBOARD };
  }

  return {
    cursosRealizados: toSafeNumber(dados.cursosRealizados),
    proximosEventos: toSafeNumber(dados.proximosEventos),
    eventosorganizador: toSafeNumber(dados.eventosorganizador),
  };
}

const ValueLabelsPlugin = {
  id: "valueLabelsEventosDashboard",

  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.show) return;

    const { ctx } = chart;
    const datasetMeta = chart.getDatasetMeta(0);

    if (!datasetMeta?.data?.length) return;

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font =
      "700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillStyle = isDark ? "rgba(248,250,252,0.95)" : "rgba(15,23,42,0.95)";
    ctx.strokeStyle = isDark ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;

    datasetMeta.data.forEach((bar, index) => {
      const value = chart.data.datasets[0].data[index];

      if (!bar || value == null) return;

      const { x, y } = bar.tooltipPosition();
      const text = String(value);

      ctx.strokeText(text, x, y - 8);
      ctx.fillText(text, x, y - 8);
    });

    ctx.restore();
  },
};

export default function GraficoEventos({
  dados = {},
  height = 280,
  className = "",
  palette = DEFAULT_PALETTE,
  showLegend = false,
  showPercentInTooltip = true,
  showValueLabels = true,
  borderRadius = 10,
  title = "Resumo de eventos",
  emptyMessage = "Sem dados de eventos para exibir.",
}) {
  const reduceMotion = useReducedMotion();
  const isDark = useDarkModeFromDocument();

  const normalized = useMemo(() => normalizeEventosDashboard(dados), [dados]);

  const dataValues = useMemo(
    () => OFFICIAL_KEYS.map((key) => normalized[key]),
    [normalized]
  );

  const total = useMemo(
    () => dataValues.reduce((acc, value) => acc + Number(value || 0), 0),
    [dataValues]
  );

  const hasData = dataValues.some((value) => Number(value) > 0);

  const colors = useMemo(() => {
    if (Array.isArray(palette) && palette.length >= OFFICIAL_KEYS.length) {
      const normalizedPalette = palette.slice(0, OFFICIAL_KEYS.length);

      if (normalizedPalette.every(isValidCssColorLike)) {
        return normalizedPalette;
      }
    }

    return [...DEFAULT_PALETTE];
  }, [palette]);

  const alturaGrafico = normalizeHeight(height);

  const borderColor = isDark ? "rgba(15,23,42,0.85)" : "#ffffff";
  const tickColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const chartData = useMemo(
    () => ({
      labels: [...LABELS],
      datasets: [
        {
          label: "Eventos",
          data: dataValues,
          backgroundColor: colors,
          borderColor,
          borderWidth: 1.5,
          borderSkipped: false,
          borderRadius,
          maxBarThickness: 72,
        },
      ],
    }),
    [borderColor, borderRadius, colors, dataValues]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: reduceMotion ? false : { duration: 550 },
      layout: {
        padding: {
          top: showValueLabels ? 18 : 4,
        },
      },
      plugins: {
        legend: {
          display: showLegend,
          position: "bottom",
          labels: {
            color: tickColor,
            usePointStyle: true,
            font: {
              weight: "700",
            },
          },
        },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#f9fafb",
          bodyColor: "#f9fafb",
          borderColor: "transparent",
          borderWidth: 0,
          callbacks: {
            label: (context) => {
              const value = Number(context.raw) || 0;

              if (!showPercentInTooltip) {
                return `${context.label}: ${value}`;
              }

              const percent =
                total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

              return `${context.label}: ${value} (${percent}%)`;
            },
          },
        },
        valueLabelsEventosDashboard: {
          show: showValueLabels,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: tickColor,
            font: {
              weight: "700",
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: tickColor,
            font: {
              weight: "600",
            },
          },
          grid: {
            color: gridColor,
          },
        },
      },
    }),
    [
      gridColor,
      reduceMotion,
      showLegend,
      showPercentInTooltip,
      showValueLabels,
      tickColor,
      total,
    ]
  );

  const ariaLabel = `Gráfico de barras com resumo de eventos do usuário. Total: ${total}. Cursos realizados: ${normalized.cursosRealizados}. Próximos eventos: ${normalized.proximosEventos}. Eventos como organizador: ${normalized.eventosorganizador}.`;

  if (!hasData) {
    return (
      <section
        className={classNames(
          "rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm",
          "dark:border-slate-800 dark:bg-slate-900",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
          {title}
        </h3>

        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>

        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cursos realizados</td>
              <td>0</td>
            </tr>
            <tr>
              <td>Próximos eventos</td>
              <td>0</td>
            </tr>
            <tr>
              <td>Eventos como organizador</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <section
      className={classNames("relative w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div style={{ minHeight: alturaGrafico }}>
        <Bar
          data={chartData}
          options={chartOptions}
          plugins={[ValueLabelsPlugin]}
        />
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cursos realizados</td>
            <td>{normalized.cursosRealizados}</td>
          </tr>
          <tr>
            <td>Próximos eventos</td>
            <td>{normalized.proximosEventos}</td>
          </tr>
          <tr>
            <td>Eventos como organizador</td>
            <td>{normalized.eventosorganizador}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

GraficoEventos.propTypes = {
  dados: PropTypes.shape({
    cursosRealizados: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    proximosEventos: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    eventosorganizador: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  palette: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
  showPercentInTooltip: PropTypes.bool,
  showValueLabels: PropTypes.bool,
  borderRadius: PropTypes.number,
  title: PropTypes.string,
  emptyMessage: PropTypes.string,
};