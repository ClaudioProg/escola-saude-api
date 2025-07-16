// 📁 src/components/GraficoAvaliacoes.jsx
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function GraficoAvaliacoes({ dados }) {
  if (!dados) return <p className="italic text-gray-400">(Sem dados de avaliação)</p>;

  const data = {
    labels: ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"],
    datasets: [
      {
        label: "Avaliações",
        data: [
          dados.otimo || 0,
          dados.bom || 0,
          dados.regular || 0,
          dados.ruim || 0,
          dados.pessimo || 0,
        ],
        backgroundColor: ["#1f8b4c", "#4caf50", "#fdd835", "#fb8c00", "#e53935"],
        borderWidth: 1,
      },
    ],
  };

  return <Doughnut data={data} />;
}
