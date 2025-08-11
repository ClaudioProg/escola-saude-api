// 📁 src/pages/DashboardAdministrador.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import Breadcrumbs from "../components/Breadcrumbs";
import CardEvento from "../components/CardEvento";
import Spinner from "../components/Spinner";
import { formatarDataBrasileira } from "../utils/data"; // (ainda pode ser útil)
import { apiGet } from "../services/api"; // ✅ usa serviço centralizado

export default function DashboardAdministrador() {
  const [nome, setNome] = useState("");
  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [eventoExpandido, setEventoExpandido] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("em_andamento");

  // Carrega nome (apenas UI)
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("usuario") || "{}");
      setNome(u?.nome || "");
    } catch {
      setNome("");
    }
  }, []);

  // Carrega eventos (admin)
  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        // 👇 Não redireciona em 403; mostra erro na tela
        const data = await apiGet("/api/eventos", { on403: "silent" });
        setEventos(Array.isArray(data) ? data : []);
        setErro("");
      } catch (e) {
        console.error("❌ Erro ao carregar eventos:", e);
        toast.error("❌ Erro ao carregar eventos");
        setErro("Erro ao carregar eventos");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const carregarTurmas = async (eventoId) => {
    if (turmasPorEvento[eventoId]) return;
    try {
      const data = await apiGet(`/api/turmas/evento/${eventoId}`, { on403: "silent" });
      setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      console.error("❌ Erro ao carregar turmas:", error);
      toast.error("❌ Erro ao carregar turmas.");
    }
  };

  const carregarInscritos = async (turmaId) => {
    try {
      const data = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch {
      toast.error("❌ Erro ao carregar inscritos.");
    }
  };

  const carregarAvaliacoes = async (turmaId) => {
    if (avaliacoesPorTurma[turmaId]) return;
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, { on403: "silent" });
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("❌ Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações.");
    }
  };

  const carregarPresencas = async (turmaId) => {
    try {
      const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`, { on403: "silent" });
      const lista = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: lista }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças da turma.");
    }
  };

  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`, { on403: "silent" });
      const alunos = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];

      const total = alunos.length;
      const presentes = alunos.filter((a) => a.presente).length;
      const presencaMedia = total ? ((presentes / total) * 100).toFixed(1) : "0.0";

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Presença por Turma", 14, 20);
      autoTable(doc, {
        startY: 30,
        head: [["Nome", "CPF", "Presença"]],
        body: alunos.map((a) => [
          a.nome,
          (a.cpf || "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
          a.presente ? "Sim" : "Não",
        ]),
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text(`Total de inscritos: ${total}`, 14, finalY);
      doc.text(`Total de presentes: ${presentes}`, 14, finalY + 6);
      doc.text(`Presença média: ${presencaMedia}%`, 14, finalY + 12);
      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("📄 PDF gerado com sucesso!");
    } catch {
      toast.error("❌ Erro ao gerar PDF.");
    }
  };

  const toggleExpandir = (eventoId) => {
    setEventoExpandido(eventoExpandido === eventoId ? null : eventoId);
    carregarTurmas(eventoId);
  };

  // 🔄 Filtrar por status com datas agregadas do evento ou derivadas das turmas
  const filtrarPorStatus = (evento) => {
    const hoje = new Date();
    const turmas = turmasPorEvento[evento.id] || [];

    let dataInicio = evento.data_inicio_geral ? new Date(evento.data_inicio_geral) : null;
    let dataFim = evento.data_fim_geral ? new Date(evento.data_fim_geral) : null;

    if (!dataInicio || !dataFim) {
      const dsInicio = turmas.map((t) => new Date(t.data_inicio)).filter((d) => !isNaN(d));
      const dsFim = turmas.map((t) => new Date(t.data_fim)).filter((d) => !isNaN(d));
      if (dsInicio.length) dataInicio = new Date(Math.min(...dsInicio.map((d) => d.getTime())));
      if (dsFim.length) {
        dataFim = new Date(Math.max(...dsFim.map((d) => d.getTime())));
        dataFim.setHours(23, 59, 59, 999);
      }
    }

    if (!dataInicio || !dataFim) return false;

    if (filtroStatus === "programado") return dataInicio > hoje;
    if (filtroStatus === "em_andamento") return dataInicio <= hoje && dataFim >= hoje;
    if (filtroStatus === "encerrado") return dataFim < hoje;
    return true; // "todos"
  };

  return (
    <div className="min-h-screen px-4 py-10 bg-white dark:bg-zinc-900 text-black dark:text-white relative">
      {carregando && (
        <div className="absolute top-0 left-0 w-full h-1 bg-green-100 z-50">
          <div className="h-full bg-[#1b4332] animate-pulse w-1/3" aria-label="Carregando eventos" />
        </div>
      )}

      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do administrador</span>
      </div>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-[#1b4332] text-center dark:text-white">
          🧑‍💼 Painel do administrador
        </h2>

        <div className="flex justify-center gap-4 mb-6 flex-wrap">
          {["todos", "programado", "em_andamento", "encerrado"].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`px-4 py-1 rounded-full text-sm font-medium transition ${
                filtroStatus === status
                  ? "bg-[#1b4332] text-white"
                  : "bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-white"
              }`}
              aria-pressed={filtroStatus === status}
              aria-label={`Filtrar eventos: ${status}`}
            >
              {{
                todos: "Todos",
                programado: "Programados",
                em_andamento: "Em andamento",
                encerrado: "Encerrados",
              }[status]}
            </button>
          ))}
        </div>

        {erro && <p className="text-red-500 text-center">{erro}</p>}

        {eventos.filter(filtrarPorStatus).map((evento) => (
          <CardEvento
            key={evento.id}
            evento={evento}
            expandido={eventoExpandido === evento.id}
            toggleExpandir={toggleExpandir}
            turmas={turmasPorEvento[evento.id] || []}
            carregarInscritos={carregarInscritos}
            inscritosPorTurma={inscritosPorTurma}
            carregarAvaliacoes={carregarAvaliacoes}
            avaliacoesPorTurma={avaliacoesPorTurma}
            presencasPorTurma={presencasPorTurma}
            carregarPresencas={carregarPresencas}
            gerarRelatorioPDF={gerarRelatorioPDF}
          />
        ))}
      </div>
    </div>
  );
}
