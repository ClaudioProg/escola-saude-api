// 📁 src/components/charts/DoughnutChart.jsx
import React, { useMemo, useState, useEffect, useId } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from "recharts";

/* ============================================
   🎨 Paleta base (alto contraste, acessível)
   ============================================ */
const DEFAULT_COLORS = [
  "#14532d", "#0ea5e9", "#9333ea", "#f59e0b", "#ef4444",
  "#14b8a6", "#3b82f6", "#f43f5e", "#84cc16", "#eab308",
  "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#0f766e",
];

/* Cor determinística por rótulo (consistência entre gráfico/legenda) */
function hashLabel(label) {
  const s = String(label ?? "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}
function colorFor(label, palette = DEFAULT_COLORS) {
  const idx = hashLabel(label) % palette.length;
  return palette[idx];
}

/* 🧼 Sanitiza itens e evita valores negativos/NaN */
function sanitizeData(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((d) => ({
      label: String(d?.label ?? "Não informado").trim() || "Não informado",
      value: Number.isFinite(Number(d?.value)) ? Math.max(0, Number(d.value)) : 0,
    }))
    .filter((d) => d.value >= 0);
}

/* Agrega excedentes em “Outros” para não poluir o gráfico/legenda */
function aggregateSmallSlices(items, maxSlices, othersLabel = "Outros") {
  if (!Array.isArray(items) || items.length <= maxSlices) return items;
  const head = items.slice(0, maxSlices - 1);
  const tail = items.slice(maxSlices - 1);
  const others = tail.reduce((acc, it) => acc + (it.value || 0), 0);
  return [...head, { label: othersLabel, value: others, __isOthers: true }];
}

export default function DoughnutChart({
  data = [],
  title = "Distribuição",
  ariaDescription,
  height = 260,
  colors = DEFAULT_COLORS,
  showPercent = true,
  showLabels = false,            // exibe % dentro dos arcos (somente fatias “grandes”)
  minPctForLabel = 6,            // mínimo de % para desenhar label no arco
  maxLegend = 12,                // limita a legenda em telas pequenas
  maxSlices = 12,                // número máximo de fatias antes de agregar “Outros”
  othersLabel = "Outros",
  centerTotal = true,            // mostra total no centro
  centerFormatter,               // (total) => string (personaliza centro)
  emptyMessage = "Sem dados suficientes para exibir o gráfico.",
  onSliceClick,                  // (entry) => void
  className = "",
}) {
  const regionId = useId();

  // ♿ respeita preferências do usuário para reduzir animações
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(Boolean(mq?.matches));
    handler();
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, []);

  const clean = useMemo(() => sanitizeData(data), [data]);

  // Total
  const total = useMemo(
    () => clean.reduce((acc, it) => acc + (it.value || 0), 0),
    [clean]
  );
  const hasData = total > 0;

  // Enriquecido com % e cor determinística por label
  const enriched = useMemo(() => {
    if (!hasData) return [];
    return clean.map((it) => {
      const pct = total ? (100 * (it.value || 0)) / total : 0;
      return {
        ...it,
        pct,
        color: colorFor(it.label, colors),
      };
    });
  }, [clean, colors, total, hasData]);

  // Ordena por valor desc, agrega "Outros" se ultrapassar maxSlices
  const ranked = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => b.value - a.value);
    return aggregateSmallSlices(sorted, Math.max(1, maxSlices), othersLabel);
  }, [enriched, maxSlices, othersLabel]);

  // Legenda limitada (usa as mesmas cores determinísticas)
  const legendItems = useMemo(() => {
    return ranked.slice(0, maxLegend).map((item) => ({
      value: item.label,
      id: `l-${item.label}`,
      type: "circle",
      color: item.color,
    }));
  }, [ranked, maxLegend]);

  const tooltipFormatter = (value, name) => {
    const v = Number(value) || 0;
    const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
    return showPercent ? [`${v} (${pct}%)`, name] : [`${v}`, name];
  };

  const truncate = (s, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  // Label custom no arco (mostra % quando a fatia é “grande”)
  const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const prc = percent * 100;
    if (!showLabels || prc < minPctForLabel) return null;
    const RAD = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const txt = showPercent ? `${prc.toFixed(0)}%` : name;
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fill="#fff"
        style={{ fontWeight: 700 }}
      >
        {txt}
      </text>
    );
  };

  if (!hasData) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 sm:p-5 text-center ${className}`}
        role="region"
        aria-labelledby={`${regionId}-title`}
      >
        <h3
          id={`${regionId}-title`}
          className="text-sm sm:text-base font-semibold mb-2 text-gray-800 dark:text-gray-100"
        >
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Raio ajustado ao container (melhor para telas pequenas)
  const innerR = 60;
  const outerR = 90;

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 sm:p-5 flex flex-col justify-between h-full ${className}`}
      role="region"
      aria-labelledby={`${regionId}-title`}
      aria-describedby={ariaDescription ? `${regionId}-desc` : undefined}
    >
      <h3
        id={`${regionId}-title`}
        className="text-sm sm:text-base font-semibold mb-2 text-gray-800 dark:text-gray-100 text-center sm:text-left"
      >
        {title}
      </h3>

      {ariaDescription && (
        <p id={`${regionId}-desc`} className="sr-only">
          {ariaDescription}
        </p>
      )}

      <div style={{ width: "100%", height }} className="flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* Centro com total */}
          {centerTotal && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center px-2">
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  Total
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-gray-100">
                  {typeof centerFormatter === "function" ? centerFormatter(total) : total}
                </div>
              </div>
            </div>
          )}

          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={ranked}
                dataKey="value"
                nameKey="label"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={2}
                isAnimationActive={!reducedMotion}
                label={renderSliceLabel}
                onClick={(entry) => onSliceClick?.(entry)}
              >
                {ranked.map((entry, idx) => (
                  <Cell key={`c-${entry.label}-${idx}`} fill={entry.color} />
                ))}
              </Pie>

              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "none",
                  borderRadius: 8,
                  color: "#f9fafb",
                }}
                labelFormatter={(label) => String(label)}
                itemStyle={{ padding: 2 }}
                wrapperStyle={{ outline: "none" }}
              />

              <Legend
                verticalAlign="bottom"
                height={48}
                iconType="circle"
                formatter={(value) => truncate(String(value))}
                wrapperStyle={{ fontSize: "0.75rem", lineHeight: 1.2 }}
                payload={legendItems}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center sm:text-left">
        <strong>Total:</strong> {total}
      </p>
    </div>
  );
}
