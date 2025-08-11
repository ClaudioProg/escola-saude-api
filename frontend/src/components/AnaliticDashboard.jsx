// 📁 src/pages/DashboardAnalitico.jsx
import { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import { apiGet } from "../services/api";

export default function DashboardAnalitico() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState({});
  const [filtros, setFiltros] = useState({ ano: "", mes: "", tipo: "" });

  useEffect(() => {
    async function load() {
      setCarregando(true);
      try {
        const query = new URLSearchParams(
          Object.fromEntries(
            Object.entries(filtros).filter(([, v]) => v !== "" && v != null)
          )
        ).toString();

        const data = await apiGet(`/api/dashboard-analitico${query ? `?${query}` : ""}`);
        setDados(data || {});
      } catch {
        toast.error("❌ Falha ao obter dados");
        setDados({});
      } finally {
        setCarregando(false);
      }
    }
    load();
  }, [filtros]);

  const handleFiltro = (field) => (e) =>
    setFiltros((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <main className="px-4 py-6">
      <Breadcrumbs
        trilha={[{ label: "Painel administrador", href: "/administrador" }, { label: "Dashboard Analítico" }]}
      />
      <h1 className="text-2xl font-bold mb-4">📊 Painel de Indicadores</h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <select className="campo" value={filtros.ano} onChange={handleFiltro("ano")}>
          <option value="">Ano</option>
          <option>2025</option>
          <option>2024</option>
          <option>2023</option>
        </select>
        <select className="campo" value={filtros.mes} onChange={handleFiltro("mes")}>
          <option value="">Mês</option>
          <option value="01">Janeiro</option>
          <option value="02">Fevereiro</option>
          <option value="03">Março</option>
          {/* ... */}
        </select>
        <select className="campo" value={filtros.tipo} onChange={handleFiltro("tipo")}>
          <option value="">Tipo de evento</option>
          <option value="curso">Curso</option>
          <option value="palestra">Palestra</option>
          {/* ... */}
        </select>
      </div>

      {/* Indicadores numéricos ou Skeleton */}
      {carregando ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={100} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Indicador titulo="Eventos" valor={dados.totalEventos} />
          <Indicador titulo="Inscritos únicos" valor={dados.totalInscritos} />
          <Indicador titulo="Certificados emitidos" valor={dados.totalCertificados} />
          <Indicador titulo="Presença média (%)" valor={dados.mediaPresenca + "%"} />
        </div>
      )}

      {/* Gráficos */}
      {!carregando && dados.eventosPorMes && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold mb-2">📅 Eventos por Mês</h4>
            <Bar data={dados.eventosPorMes} options={{ responsive: true }} />
          </div>
          <div>
            <h4 className="font-semibold mb-2">📚 Tipo de Evento</h4>
            <Pie data={dados.eventosPorTipo} options={{ responsive: true }} />
          </div>
          <div>
            <h4 className="font-semibold mb-2">👥 Inscritos vs Presença (%)</h4>
            <Line data={dados.presencaPorEvento} options={{ responsive: true }} />
          </div>
        </div>
      )}
    </main>
  );
}

function Indicador({ titulo, valor }) {
  return (
    <div className="bg-lousa text-textoLousa p-4 rounded-xl shadow-md text-center">
      <h3 className="text-sm">{titulo}</h3>
      <p className="text-2xl font-bold mt-1">{valor ?? "—"}</p>
    </div>
  );
}
