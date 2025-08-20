// 📁 src/components/GraficoAvaliacoes.jsx
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// ---- Helpers de normalização ----
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normKey(s) {
  if (!s) return "";
  // remove acentos, mantém só letras minúsculas
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// mapeia variações para as 5 chaves canônicas
function mapLabelToKey(label) {
  const k = normKey(label);
  if (["otimo", "excelente", "muito bom", "5", "a"].includes(k)) return "otimo";
  if (["bom", "4", "b"].includes(k)) return "bom";
  if (["regular", "mediano", "3", "c"].includes(k)) return "regular";
  if (["ruim", "2", "d"].includes(k)) return "ruim";
  if (["pessimo", "péssimo", "1", "e"].includes(k)) return "pessimo";
  return null;
}

/**
 * Aceita:
 *  - objeto plano: { otimo, bom, regular, ruim, pessimo } (com variações de acento/caixa)
 *  - array de itens com { label|categoria|tipo, valor|qtd|quantidade|count }
 */
function normalizeAvaliacoes(input) {
  const base = { otimo: 0, bom: 0, regular: 0, ruim: 0, pessimo: 0 };
  if (!input) return base;

  // Caso 1: array de itens -> soma normalmente
  if (Array.isArray(input)) {
    const acc = { ...base };
    for (const item of input) {
      const label =
        item?.label ??
        item?.categoria ??
        item?.tipo ??
        item?.nome ??
        item?.classificacao;
      const key = mapLabelToKey(label);
      const valor =
        item?.valor ??
        item?.qtd ??
        item?.quantidade ??
        item?.count ??
        item?.total ??
        item?.numero;
      if (key) acc[key] += toNumber(valor);
    }
    return acc;
  }

  // Caso 2: objeto plano -> pegar o MAIOR valor entre aliases (não somar)
  const out = { ...base };
  const keys = Object.keys(input || {});

  // helper local: pega o maior valor entre aliases
  function pickAliasMax(aliases) {
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
  }

  out.otimo   = pickAliasMax(["otimo", "ótimo", "Otimo", "Ótimo", "excelente", "Excelente"]);
  out.bom     = pickAliasMax(["bom", "Bom"]);
  out.regular = pickAliasMax(["regular", "Regular", "mediano", "Mediano"]);
  out.ruim    = pickAliasMax(["ruim", "Ruim"]);
  out.pessimo = pickAliasMax(["pessimo", "péssimo", "Pessimo", "Péssimo"]);

  return out;
}

export default function GraficoAvaliacoes({ dados = {} }) {
  const norm = normalizeAvaliacoes(dados);
  const total =
    norm.otimo + norm.bom + norm.regular + norm.ruim + norm.pessimo;

  if (!total) {
    return (
      <p className="text-gray-500 italic text-center">
        (Sem dados de avaliação)
      </p>
    );
  }

  const data = {
    labels: ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"],
    datasets: [
      {
        label: "Distribuição de Avaliações",
        data: [norm.otimo, norm.bom, norm.regular, norm.ruim, norm.pessimo],
        backgroundColor: ["#1f8b4c", "#ff9900", "#3366cc", "#cc3333", "#9933cc"],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: function (context) {
            const sum = (context.dataset.data || []).reduce((a, b) => a + b, 0);
            const value = Number(context.raw) || 0;
            const percent = sum ? ((value / sum) * 100).toFixed(1) : "0.0";
            return `${context.label}: ${value} (${percent}%)`;
          },
        },
      },
    },
  };

  return <Pie data={data} options={options} />;
}
