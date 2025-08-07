// 📁 src/components/GraficoAvaliacoes.jsx
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function GraficoAvaliacoes({ dados = {} }) {
  const total =
    (dados.otimo || 0) +
    (dados.bom || 0) +
    (dados.regular || 0) +
    (dados.ruim || 0) +
    (dados.pessimo || 0);

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
        data: [
          dados.otimo || 0,
          dados.bom || 0,
          dados.regular || 0,
          dados.ruim || 0,
          dados.pessimo || 0,
        ],
        backgroundColor: ["#1f8b4c", "#ff9900", "#3366cc", "#cc3333", "#9933cc"],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const value = context.raw;
            const percent = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value} (${percent}%)`;
          },
        },
      },
    },
  };

  return <Pie data={data} options={options} />;
}
