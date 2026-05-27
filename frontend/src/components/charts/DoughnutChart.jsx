// ✅ frontend/src/components/charts/DoughnutChart.jsx — v2.1
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Gráfico genérico oficial de rosca/doughnut.
 *
 * Contrato oficial:
 * - data: Array<{ label: string, value: number }>
 *
 * Função:
 * - Exibir distribuição por categoria.
 * - Agrupar fatias pequenas em "Outros".
 * - Exibir total central.
 * - Exportar CSV e PNG.
 * - Oferecer tabela acessível para leitores de tela.
 *
 * Padrão:
 * - Sem aliases.
 * - Sem name.
 * - Sem total.
 * - Sem fallback de contrato.
 * - Mobile-first.
 * - Acessível.
 * - Dark mode.
 */

import { useCallback, useId, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useReducedMotion } from "framer-motion";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  Download,
  FileDown,
  PieChart as PieChartIcon,
} from "lucide-react";

const DEFAULT_COLORS = [
  "#14532d",
  "#0ea5e9",
  "#9333ea",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#3b82f6",
  "#f43f5e",
  "#84cc16",
  "#eab308",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#22c55e",
  "#0f766e",
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function hashLabel(label) {
  const text = String(label || "");
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) + hash + text.charCodeAt(index);
  }

  return Math.abs(hash);
}

function colorFor(label, palette = DEFAULT_COLORS) {
  const safePalette =
    Array.isArray(palette) && palette.length > 0 ? palette : DEFAULT_COLORS;

  return safePalette[hashLabel(label) % safePalette.length];
}

function sanitizeData(data) {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const label = String(item?.label || "").trim();
      const value = Number(item?.value);

      return {
        label: label || "Não informado",
        value: Number.isFinite(value) ? Math.max(0, value) : 0,
      };
    })
    .filter((item) => item.value > 0);
}

function aggregateSmallSlices(items, maxSlices, othersLabel) {
  const safeMax = Math.max(2, Number(maxSlices) || 12);

  if (!Array.isArray(items) || items.length <= safeMax) {
    return items;
  }

  const head = items.slice(0, safeMax - 1);
  const tail = items.slice(safeMax - 1);

  const othersValue = tail.reduce(
    (acc, item) => acc + Number(item.value || 0),
    0
  );

  if (othersValue <= 0) return head;

  return [
    ...head,
    {
      label: othersLabel,
      value: othersValue,
      is_others: true,
    },
  ];
}

function enrichData(items, total, colors) {
  return items.map((item) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;

    return {
      ...item,
      pct: percent,
      color: colorFor(item.label, colors),
    };
  });
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(number);
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0,0%";

  return `${number.toFixed(1).replace(".", ",")}%`;
}

function formatValue(value, unit = "") {
  const formatted = formatNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function truncateText(value, maxLength = 22) {
  const text = String(value || "");

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength - 1)}…`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvFromRows(rows, unit = "") {
  const headers = ["Categoria", "Valor", "Percentual"];

  const body = rows.map((row) => [
    row.label,
    unit ? `${row.value} ${unit}` : row.value,
    `${Number(row.pct || 0).toFixed(1)}%`,
  ]);

  return [headers, ...body]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function normalizeFilename(filename) {
  return (
    String(filename || "grafico-doughnut")
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "grafico-doughnut"
  );
}

function ChartButton({ children, onClick, disabled = false, title, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition",
        "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ChartState({ title, message, variant = "empty", className = "" }) {
  const isError = variant === "error";

  return (
    <section
      className={cx(
        "rounded-3xl border bg-white p-5 text-center shadow-sm dark:bg-slate-900",
        isError
          ? "border-rose-200 text-rose-800 dark:border-rose-900/60 dark:text-rose-200"
          : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300",
        className
      )}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div
        className={cx(
          "mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border",
          isError
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        )}
        aria-hidden="true"
      >
        {isError ? (
          <AlertTriangle className="h-7 w-7" />
        ) : (
          <PieChartIcon className="h-7 w-7" />
        )}
      </div>

      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
        {title}
      </h3>

      <p className="mt-1 text-sm font-medium leading-relaxed">{message}</p>
    </section>
  );
}

function ChartLoading({ title, className = "" }) {
  return (
    <section
      className={cx(
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Carregando gráfico: ${title}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-5 w-40 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
        <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
      </div>

      <div className="mx-auto h-44 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="h-4 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
        <div className="h-4 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
        <div className="h-4 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
        <div className="h-4 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
      </div>

      <span className="sr-only">Carregando dados do gráfico.</span>
    </section>
  );
}

function CustomTooltip({ active, payload, total, unit, showPercent }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload;
  const value = Number(item?.value || 0);
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl">
      <p className="mb-1 font-black">{item?.label || "Categoria"}</p>
      <p>
        {formatValue(value, unit)}
        {showPercent ? (
          <span className="ml-1 text-white/75">({formatPercent(pct)})</span>
        ) : null}
      </p>
    </div>
  );
}

function renderSliceLabelFactory({ showLabels, minPctForLabel, showPercent }) {
  return function renderSliceLabel({
    cx: centerX,
    cy: centerY,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }) {
    const percentValue = Number(percent || 0) * 100;

    if (!showLabels || percentValue < minPctForLabel) return null;

    const radians = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = centerX + radius * Math.cos(-midAngle * radians);
    const y = centerY + radius * Math.sin(-midAngle * radians);

    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fill="#fff"
        fontWeight={800}
      >
        {showPercent ? `${percentValue.toFixed(0)}%` : truncateText(name, 12)}
      </text>
    );
  };
}

export default function DoughnutChart({
  data = [],
  title = "Distribuição",
  ariaDescription,
  height = 280,
  colors = DEFAULT_COLORS,
  showPercent = true,
  showLabels = false,
  minPctForLabel = 6,
  maxLegend = 12,
  maxSlices = 12,
  othersLabel = "Outros",
  centerTotal = true,
  centerFormatter,
  emptyMessage = "Sem dados suficientes para exibir o gráfico.",
  onSliceClick,
  className = "",
  unit = "",
  loading = false,
  error = "",
  actions = { exportPng: true, exportCsv: true },
  filename = "grafico-doughnut",
}) {
  const reduceMotion = useReducedMotion();
  const regionId = useId();
  const chartWrapRef = useRef(null);

  const safeActions = actions || {};
  const safeFilename = normalizeFilename(filename);

  const sanitized = useMemo(() => sanitizeData(data), [data]);

  const totalRaw = useMemo(
    () => sanitized.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [sanitized]
  );

  const ranked = useMemo(() => {
    if (totalRaw <= 0) return [];

    const sorted = [...sanitized].sort((a, b) => b.value - a.value);
    const aggregated = aggregateSmallSlices(sorted, maxSlices, othersLabel);
    const aggregatedTotal = aggregated.reduce(
      (acc, item) => acc + Number(item.value || 0),
      0
    );

    return enrichData(aggregated, aggregatedTotal, colors);
  }, [colors, maxSlices, othersLabel, sanitized, totalRaw]);

  const total = useMemo(
    () => ranked.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [ranked]
  );

  const hasData = total > 0 && !loading && !error;

  const legendItems = useMemo(
    () =>
      ranked.slice(0, maxLegend).map((item) => ({
        value: item.label,
        id: `legend-${item.label}`,
        type: "circle",
        color: item.color,
      })),
    [maxLegend, ranked]
  );

  const renderSliceLabel = useMemo(
    () =>
      renderSliceLabelFactory({
        showLabels,
        minPctForLabel,
        showPercent,
      }),
    [minPctForLabel, showLabels, showPercent]
  );

  const centerText = useMemo(() => {
    if (typeof centerFormatter === "function") {
      return centerFormatter(total);
    }

    return formatValue(total, unit);
  }, [centerFormatter, total, unit]);

  const handleExportCsv = useCallback(() => {
    if (!ranked.length) return;

    const csv = csvFromRows(ranked, unit);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    downloadBlob(`${safeFilename}.csv`, blob);
  }, [ranked, safeFilename, unit]);

  const handleExportPng = useCallback(async () => {
    const host = chartWrapRef.current;

    if (!host) return;

    const svg = host.querySelector("svg");

    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    const width = Math.max(svg.clientWidth || 0, 800);
    const canvasHeight = Math.max(svg.clientHeight || 0, 600);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = canvasHeight;

      const context = canvas.getContext("2d");

      if (!context) return;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, canvasHeight);
      context.drawImage(image, 0, 0, width, canvasHeight);

      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          downloadBlob(`${safeFilename}.png`, pngBlob);
        }
      }, "image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [safeFilename]);

  if (loading) {
    return <ChartLoading title={title} className={className} />;
  }

  if (error) {
    return (
      <ChartState
        title={title}
        message={String(error)}
        variant="error"
        className={className}
      />
    );
  }

  if (!hasData) {
    return (
      <ChartState
        title={title}
        message={emptyMessage}
        variant="empty"
        className={className}
      />
    );
  }

  return (
    <section
      className={cx(
        "relative flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5",
        className
      )}
      role="region"
      aria-labelledby={`${regionId}-title`}
      aria-describedby={ariaDescription ? `${regionId}-desc` : undefined}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={`${regionId}-title`}
            className="truncate text-sm font-black text-slate-900 dark:text-slate-100 sm:text-base"
          >
            {title}
          </h3>

          {ariaDescription ? (
            <p id={`${regionId}-desc`} className="sr-only">
              {ariaDescription}
            </p>
          ) : null}
        </div>

        {(safeActions.exportPng || safeActions.exportCsv) && (
          <div className="flex shrink-0 items-center gap-2">
            {safeActions.exportCsv ? (
              <ChartButton
                onClick={handleExportCsv}
                disabled={!hasData}
                title="Exportar dados em CSV"
                icon={<FileDown className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                CSV
              </ChartButton>
            ) : null}

            {safeActions.exportPng ? (
              <ChartButton
                onClick={handleExportPng}
                disabled={!hasData}
                title="Exportar gráfico em PNG"
                icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                PNG
              </ChartButton>
            ) : null}
          </div>
        )}
      </div>

      <div
        style={{ width: "100%", height }}
        className="relative flex min-h-[220px] items-center justify-center"
      >
        <div ref={chartWrapRef} className="relative h-full w-full">
          {centerTotal ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="max-w-[8rem] px-2 text-center">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Total
                </div>
                <div className="truncate text-lg font-black text-slate-900 dark:text-slate-100 sm:text-xl">
                  {centerText}
                </div>
              </div>
            </div>
          ) : null}

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ranked}
                dataKey="value"
                nameKey="label"
                innerRadius="52%"
                outerRadius="76%"
                paddingAngle={2}
                isAnimationActive={!reduceMotion}
                label={renderSliceLabel}
                onClick={(entry) => onSliceClick?.(entry)}
              >
                {ranked.map((entry, index) => (
                  <Cell
                    key={`slice-${entry.label}-${index}`}
                    fill={entry.color}
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>

              <Tooltip
                content={
                  <CustomTooltip
                    total={total}
                    unit={unit}
                    showPercent={showPercent}
                  />
                }
                wrapperStyle={{ outline: "none" }}
              />

              <Legend
                verticalAlign="bottom"
                height={52}
                iconType="circle"
                payload={legendItems}
                formatter={(value) => truncateText(value)}
                wrapperStyle={{
                  fontSize: "0.75rem",
                  lineHeight: 1.2,
                  paddingTop: "0.5rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item) => (
                <tr key={`sr-${item.label}`}>
                  <td>{item.label}</td>
                  <td>{formatValue(item.value, unit)}</td>
                  <td>{formatPercent(item.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-left">
        <strong>Total:</strong> {formatValue(total, unit)}
      </p>
    </section>
  );
}

ChartButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  icon: PropTypes.node,
};

ChartState.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(["empty", "error"]),
  className: PropTypes.string,
};

ChartLoading.propTypes = {
  title: PropTypes.string.isRequired,
  className: PropTypes.string,
};

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  total: PropTypes.number.isRequired,
  unit: PropTypes.string,
  showPercent: PropTypes.bool,
};

DoughnutChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  title: PropTypes.string,
  ariaDescription: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  colors: PropTypes.arrayOf(PropTypes.string),
  showPercent: PropTypes.bool,
  showLabels: PropTypes.bool,
  minPctForLabel: PropTypes.number,
  maxLegend: PropTypes.number,
  maxSlices: PropTypes.number,
  othersLabel: PropTypes.string,
  centerTotal: PropTypes.bool,
  centerFormatter: PropTypes.func,
  emptyMessage: PropTypes.string,
  onSliceClick: PropTypes.func,
  className: PropTypes.string,
  unit: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string,
  actions: PropTypes.shape({
    exportPng: PropTypes.bool,
    exportCsv: PropTypes.bool,
  }),
  filename: PropTypes.string,
};