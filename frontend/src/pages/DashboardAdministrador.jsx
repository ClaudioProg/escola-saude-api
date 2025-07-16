import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import useperfilPermitidos from "../hooks/useperfilPermitidos";

import Breadcrumbs from "../components/Breadcrumbs";
import CardEvento from "../components/CardEvento";
import Spinner from "../components/Spinner";
import { formatarDataBrasileira } from "../utils/data"; // ✅

export default function DashboardAdministrador() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [nome, setNome] = useState("");
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const { temAcesso, carregando: carregandoPermissao } = useperfilPermitidos(["administrador"]);

  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [eventoExpandido, setEventoExpandido] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("em_andamento");

  useEffect(() => {
    const tokenSalvo = localStorage.getItem("token");
    const nomeSalvo = localStorage.getItem("nome");
    if (!tokenSalvo) return navigate("/login");
    setToken(tokenSalvo);
    setNome(nomeSalvo || "");
    setCarregandoInicial(false);
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    setCarregando(true);
    fetch("/api/eventos", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setEventos)
      .catch(() => {
        toast.error("❌ Erro ao carregar eventos");
        setErro("Erro ao carregar eventos");
      })
      .finally(() => setCarregando(false));
  }, [token]);

  const carregarTurmas = async (eventoId) => {
    if (turmasPorEvento[eventoId]) return;
    try {
      const res = await fetch(`/api/turmas/evento/${eventoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar turmas.");
    }
  };

  const carregarInscritos = async (turmaId) => {
    try {
      const res = await fetch(`/api/inscricoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar inscritos.");
    }
  };

  const carregarAvaliacoes = async (turmaId) => {
    if (avaliacoesPorTurma[turmaId]) return;
    try {
      const res = await fetch(`/api/avaliacoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar avaliações.");
    }
  };

  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const res = await fetch(`/api/relatorio-presencas/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const alunos = await res.json();
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
          a.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
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

  // 🔄 Padronize as datas para evitar bugs de timezone e inconsistência
  const hojeISO = new Date().toISOString().split("T")[0];

  // 🔄 Filtra por status usando datas no formato ISO sempre que possível
  const filtrarPorStatus = (evento) => {
    const inicioISO = evento.data_inicio?.split("T")[0] || "";
    const fimISO = evento.data_fim?.split("T")[0] || "";
    if (filtroStatus === "programado") return inicioISO > hojeISO;
    if (filtroStatus === "em_andamento") return inicioISO <= hojeISO && fimISO >= hojeISO;
    if (filtroStatus === "todos") return true;
    return fimISO < hojeISO;
  };

  if (carregandoInicial || carregandoPermissao) {
    return <Spinner label="Carregando permissões..." />;
  }

  if (!temAcesso) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen px-4 py-10 bg-white dark:bg-zinc-900 text-black dark:text-white relative">
      {carregando && (
        <div className="absolute top-0 left-0 w-full h-1 bg-green-100 z-50">
          <div
            className="h-full bg-[#1b4332] animate-pulse w-1/3"
            aria-label="Carregando eventos"
          />
        </div>
      )}

      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do administradoristrador</span>
      </div>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-[#1b4332] text-center dark:text-white">
          🧑‍💼 Painel do administradoristrador
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
            turmas={turmasPorEvento[evento.id]}
            carregarInscritos={carregarInscritos}
            inscritosPorTurma={inscritosPorTurma}
            carregarAvaliacoes={carregarAvaliacoes}
            avaliacoesPorTurma={avaliacoesPorTurma}
            gerarRelatorioPDF={gerarRelatorioPDF}
          />
        ))}
      </div>
    </div>
  );
}
