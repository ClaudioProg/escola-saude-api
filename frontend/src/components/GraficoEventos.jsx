// 📁 src/components/GraficoEventos.jsx
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale } from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale);

export default function GraficoEventos({ dados }) {
  const data = {
    labels: ["Realizados", "Programados", "Instrutor"],
    datasets: [
      {
        label: "Eventos",
        data: [
          dados?.realizados || 0,
          dados?.programados || 0,
          dados?.instrutor || 0,
        ],
        backgroundColor: ["#1f8b4c", "#f59e0b", "#3b82f6"], // 💡 Verde, Amarelo, Azul
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
