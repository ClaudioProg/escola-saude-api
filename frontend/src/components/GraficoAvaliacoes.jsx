// ✅ src/components/GraficoAvaliacao.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ----------------------------- Helpers ----------------------------- */
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
function mapLabelToKey(label) {
  const k = normKey(label);

  if (["otimo", "excelente", "muito bom", "5", "a"].includes(k)) return "otimo";
  if (["bom", "4", "b"].includes(k)) return "bom";
  if (["regular", "mediano", "3", "c"].includes(k)) return "regular";
  if (["ruim", "2", "d"].includes(k)) return "ruim";
  if (["pessimo", "péssimo", "1", "e"].includes(k)) return "pessimo";

  const asNum = Number(k);
  if (asNum === 5) return "otimo";
  if (asNum === 4) return "bom";
  if (asNum === 3) return "regular";
  if (asNum === 2) return "ruim";
  if (asNum === 1) return "pessimo";

  return null;
}

/** Normaliza entradas variadas para { otimo, bom, regular, ruim, pessimo } */
export function normalizeAvaliacao(input) {
  const base = { otimo: 0, bom: 0, regular: 0, ruim: 0, pessimo: 0 };
  if (!input) return base;

  if (Array.isArray(input)) {
    const acc = { ...base };
    for (const item of input) {
      const label =
        item?.label ??
        item?.categoria ??
        item?.tipo ??
        item?.nome ??
        item?.classificacao ??
        item?.nivel;
      const key = mapLabelToKey(label);
      const valor =
        item?.valor ??
        item?.qtd ??
        item?.quantidade ??
        item?.count ??
        item?.total ??
        item?.numero ??
        0;
      if (key) acc[key] += toNumber(valor);
    }
    return acc;
  }

  // objeto plano -> pega o MAIOR valor entre aliases
  const out = { ...base };
  const keys = Object.keys(input || {});
  const pickAliasMax = (aliases) => {
    let best = 0;
    for (const a of aliases) {
      if (a in input) {
        best = Math.max(best, toNumber(input[a]));
      } else {
        const m = keys.find((kk) => normKey(kk) === normKey(a));
        if (m) best = Math.max(best, toNumber(input[m]));
      }
    }
    return best;
  };
  out.otimo   = pickAliasMax(["otimo", "ótimo", "excelente", "Excelente", "5", "A"]);
  out.bom     = pickAliasMax(["bom", "Bom", "4", "B"]);
  out.regular = pickAliasMax(["regular", "Regular", "mediano", "Mediano", "3", "C"]);
  out.ruim    = pickAliasMax(["ruim", "Ruim", "2", "D"]);
  out.pessimo = pickAliasMax(["pessimo", "péssimo", "Pessimo", "Péssimo", "1", "E"]);
  return out;
}

/* ---------------------- Plugin: rótulo central ---------------------- */
const CenterLabelPlugin = {
  id: "centerLabel",
  afterDraw(chart, _args, pluginOpts) {
    const { show = false, label, sublabel, fontSize = 18, subSize = 11 } = pluginOpts || {};
    if (!show) return;

    const { ctx, chartArea, getDatasetMeta } = chart;
    const meta = getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // cor do texto conforme tema
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    ctx.fillStyle = isDark ? "rgba(250,250,250,.92)" : "rgba(15,23,42,.9)";

    // título
    if (label) {
      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu`;
      ctx.fillText(label, x, y - (sublabel ? 6 : 0));
    }
    // subtítulo
    if (sublabel) {
      ctx.font = `500 ${subSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu`;
      ctx.fillStyle = isDark ? "rgba(250,250,250,.7)" : "rgba(15,23,42,.65)";
      ctx.fillText(sublabel, x, y + (label ? 16 : 0));
    }
    ctx.restore();
  },
};

/* ------------------------- Componente principal ------------------------- */
export default function GraficoAvaliacao({
  dados = {},
  height = 260,
  className = "",
  palette,                 // opcional: sobrescrever cores
  showLegend = true,
  // novidades:
  donut = true,            // usa "cutout" para pizza em formato donut
  showCenter = true,       // mostra total central por padrão
  centerLabel,             // sobrescreve label central (texto)
  centerSub,               // sobrescreve sublabel central (texto)
}) {
  const norm = useMemo(() => normalizeAvaliacao(dados), [dados]);
  const total = norm.otimo + norm.bom + norm.regular + norm.ruim + norm.pessimo;

  const [reduceMotion, setReduceMotion] = useState(false);
  const [isDark, setIsDark] = useState(false);

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

  if (!total) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300 italic text-center">
        (Sem dados de avaliação)
      </p>
    );
  }

  // Paleta padrão (contraste em light/dark):
  const colors = useMemo(
    () =>
      palette ?? [
        "#059669", // emerald-600  (Ótimo)
        "#d97706", // amber-600    (Bom)
        "#1d4ed8", // blue-600     (Regular)
        "#dc2626", // red-600      (Ruim)
        "#7c3aed", // violet-600   (Péssimo)
      ],
    [palette]
  );

  const borderColor = isDark ? "rgba(17,24,39,0.8)" : "#ffffff"; // borda ajuda a separar fatias
  const data = useMemo(
    () => ({
      labels: ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"],
      datasets: [
        {
          label: "Distribuição de Avaliações",
          data: [norm.otimo, norm.bom, norm.regular, norm.ruim, norm.pessimo],
          backgroundColor: colors,
          borderColor,
          borderWidth: 2,
          hoverOffset: reduceMotion ? 0 : 8,
        },
      ],
    }),
    [norm, colors, reduceMotion, borderColor]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: donut ? "58%" : 0,
      animation: reduceMotion ? false : { duration: 600 },
      plugins: {
        legend: { display: showLegend, position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const sum = (ctx.dataset.data || []).reduce((a, b) => a + b, 0);
              const value = Number(ctx.raw) || 0;
              const percent = sum ? ((value / sum) * 100).toFixed(1) : "0.0";
              return `${ctx.label}: ${value} (${percent}%)`;
            },
          },
        },
        title: { display: false },
        // rótulo central
        centerLabel: {
          show: showCenter && donut,
          label: centerLabel ?? `${total}`,
          sublabel: centerSub ?? "avaliações",
        },
      },
    }),
    [donut, reduceMotion, showLegend, showCenter, centerLabel, centerSub, total]
  );

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: height }}
      role="img"
      aria-label={`Gráfico de ${donut ? "rosca" : "pizza"} com a distribuição de ${total} avaliações: ótimo, bom, regular, ruim e péssimo.`}
    >
      <Pie data={data} options={options} plugins={[CenterLabelPlugin]} />
    </div>
  );
}

GraficoAvaliacao.propTypes = {
  dados: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  height: PropTypes.number,
  className: PropTypes.string,
  palette: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
  donut: PropTypes.bool,
  showCenter: PropTypes.bool,
  centerLabel: PropTypes.string,
  centerSub: PropTypes.string,
};
