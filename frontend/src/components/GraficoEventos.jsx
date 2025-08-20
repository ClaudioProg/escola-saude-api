// 📁 src/components/GraficoEventos.jsx
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale } from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale);

// -------- Helpers de normalização --------
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
  // realizados
  if (
    ["realizados", "concluidos", "finalizados", "feitos", "executados", "encerrados"].includes(k)
  ) return "realizados";
  // programados
  if (
    ["programados", "agendados", "marcados", "futuros", "proximos", "próximos"].includes(k)
  ) return "programados";
  // instrutor
  if (
    ["instrutor", "ministrados", "como instrutor", "docente", "professor", "palestrante"].includes(k)
  ) return "instrutor";

  return null;
}

/**
 * Aceita:
 *  - objeto: { realizados, programados, instrutor } (qualquer caixa/acentos/sinônimos)
 *  - array: [{ label|status|tipo, valor|qtd|quantidade|count }]
 */
function normalizeEventos(input) {
  const base = { realizados: 0, programados: 0, instrutor: 0 };
  if (!input) return base;

  // Array de itens
  if (Array.isArray(input)) {
    const acc = { ...base };
    for (const item of input) {
      const label = item?.label ?? item?.status ?? item?.tipo ?? item?.nome ?? item?.categoria;
      const slot = mapLabelToSlot(label);
      const valor = item?.valor ?? item?.qtd ?? item?.quantidade ?? item?.count ?? item?.total ?? item?.numero;
      if (slot) acc[slot] += toNumber(valor);
    }
    return acc;
  }

  // Objeto plano
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
    realizados: readByAliases(["realizados", "concluídos", "concluidos", "finalizados", "executados"]),
    programados: readByAliases(["programados", "agendados", "próximos", "proximos", "futuros"]),
    instrutor: readByAliases(["instrutor", "ministrados", "comoInstrutor", "como instrutor", "palestrante"]),
  };
}

export default function GraficoEventos({ dados = {} }) {
  const norm = normalizeEventos(dados);

  const data = {
    labels: ["Realizados", "Programados", "Instrutor"],
    datasets: [
      {
        label: "Eventos",
        data: [norm.realizados, norm.programados, norm.instrutor],
        backgroundColor: ["#1f8b4c", "#f59e0b", "#3b82f6"], // verde lousa / amarelo / azul
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  return <Bar data={data} options={options} />;
}
