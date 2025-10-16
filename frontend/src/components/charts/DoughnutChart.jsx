// 📁 src/components/charts/DoughnutChart.jsx
import React, { useMemo, useState, useEffect, useId } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

// 🎨 Paleta base (alto contraste)
const DEFAULT_COLORS = [
  "#14532d", "#0ea5e9", "#9333ea", "#f59e0b", "#ef4444",
  "#14b8a6", "#3b82f6", "#f43f5e", "#84cc16", "#eab308",
  "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#0f766e",
];

// 🔁 Gera cor adicional caso falte
function colorAt(idx, palette = DEFAULT_COLORS) {
  if (idx < palette.length) return palette[idx];
  // fallback: roda matiz com HSL previsível
  const h = (idx * 47) % 360;
  return `hsl(${h}deg 65% 45%)`;
}

// 🧼 Sanitiza itens e evita valores negativos/NaN
function sanitizeData(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((d) => ({
      label: String(d?.label ?? "Não informado").trim() || "Não informado",
      value: Number.isFinite(Number(d?.value)) ? Math.max(0, Number(d.value)) : 0,
    }))
    .filter((d) => d.value >= 0);
}

export default function DoughnutChart({
  data = [],
  title = "Distribuição",
  ariaDescription,
  height = 240,
  colors = DEFAULT_COLORS,
  showPercent = true,
  maxLegend = 14,           // evita legenda enorme em telas pequenas
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
  const total = useMemo(
    () => clean.reduce((acc, it) => acc + (it.value || 0), 0),
    [clean]
  );

  // Ordena por valor desc, limita legenda (mobile)
  const forLegend = useMemo(() => {
    const sorted = [...clean].sort((a, b) => b.value - a.value);
    return sorted.slice(0, maxLegend);
  }, [clean, maxLegend]);

  const hasData = total > 0;

  // Formata tooltip: valor + % (quando aplicável)
  const tooltipFormatter = (value, name, props) => {
    const v = Number(value) || 0;
    const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
    return showPercent ? [`${v} (${pct}%)`, name] : [`${v}`, name];
  };

  // Trunca rótulos muito longos (mantém acessível via title)
  const truncate = (s, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  if (!hasData) {
    // 🕳️ Empty state
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
          Sem dados suficientes para exibir o gráfico.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 sm:p-5 flex flex-col justify-between h-full ${className}`}
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
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={clean}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              isAnimationActive={!reducedMotion}
            >
              {clean.map((entry, idx) => (
                <Cell key={`c-${idx}`} fill={colorAt(idx, colors)} />
              ))}
            </Pie>
            <Tooltip
              formatter={tooltipFormatter}
              // aparência com bom contraste no tema escuro
              contentStyle={{
                backgroundColor: "#111827",
                border: "none",
                borderRadius: 8,
                color: "#f9fafb",
              }}
              labelFormatter={(label) => String(label)}
            />
            <Legend
              verticalAlign="bottom"
              height={44}
              iconType="circle"
              formatter={(value) => truncate(String(value))}
              wrapperStyle={{ fontSize: "0.75rem", lineHeight: 1.2 }}
              payload={forLegend.map((item, idx) => ({
                value: item.label,
                id: `l-${idx}`,
                type: "circle",
                color: colorAt(idx, colors),
              }))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center sm:text-left">
        <strong>Total:</strong> {total}
      </p>
    </div>
  );
}
