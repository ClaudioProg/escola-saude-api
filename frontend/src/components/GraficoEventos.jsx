// 📁 src/components/GraficoEventos.jsx
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale } from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale);

export default function GraficoEventos({ dados }) {
  const data = {
    labels: ["Realizados", "Programados", "instrutor"], // 🔄 Label atualizado
    datasets: [
      {
        label: "Eventos",
        data: [
          dados?.realizados || 0,
          dados?.programados || 0, // 🔄 Alterado aqui
          dados?.instrutor || 0,
        ],
        backgroundColor: "#1f8b4c",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return <Bar data={data} options={options} />;
}
