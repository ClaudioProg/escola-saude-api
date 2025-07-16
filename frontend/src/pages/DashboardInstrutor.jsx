// 📁 src/pages/DashboardInstrutor.jsx
import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import TurmasInstrutor from "../components/TurmasInstrutor";
import Breadcrumbs from "../components/Breadcrumbs";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ModalAssinatura from "../components/ModalAssinatura";
import Notificacoes from "../components/Notificacoes";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import useperfilPermitidos from "../hooks/useperfilPermitidos";
import QRCode from "qrcode";
import { formatarCPF } from "../utils/data";

export default function DashboardInstrutor() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const nome = usuario?.nome || "";
  const { temAcesso, carregando: carregandoPermissao } = useperfilPermitidos(["instrutor", "administrador"]);

  const [turmas, setTurmas] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("programados");
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [turmaExpandidaInscritos, setTurmaExpandidaInscritos] = useState(null);
  const [turmaExpandidaAvaliacoes, setTurmaExpandidaAvaliacoes] = useState(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinatura, setAssinatura] = useState(null);

  useEffect(() => {
    if (!token) {
      toast.error("⚠️ Sessão expirada. Faça login novamente.");
      navigate("/login");
      return;
    }

    fetch("http://localhost:3000/api/agenda/instrutor", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        const ordenadas = data.sort((a, b) => new Date(b.data_inicio) - new Date(a.data_inicio));
        setTurmas(ordenadas);
        setErro("");
      })
      .catch(() => {
        setErro("Erro ao carregar suas turmas.");
        toast.error("Erro ao carregar suas turmas.");
      })
      .finally(() => setCarregando(false));

    fetch("http://localhost:3000/api/assinatura", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAssinatura(data.assinatura || null))
      .catch(() => setAssinatura(null));
  }, [token]);

  const carregarInscritos = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/inscricoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("Erro ao carregar inscritos.");
    }
  };

  const carregarAvaliacoes = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }

    if (avaliacoesPorTurma[turmaId]) return;

    try {
      const res = await fetch(`http://localhost:3000/api/avaliacoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("Erro ao carregar avaliações.");
    }
  };

  const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

const turmasFiltradas = turmas.filter((t) => {
  const inicio = new Date(t.data_inicio);
  const fim = new Date(t.data_fim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  if (filtro === "programados") return inicio > hoje;
  if (filtro === "emAndamento") return inicio <= hoje && fim >= hoje;
  if (filtro === "realizados") return fim < hoje;
  return true; // filtro === "todos"
});

  if (carregandoPermissao) return <CarregandoSkeleton />;
  if (!temAcesso) return <Navigate to="/login" replace />;

  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/relatorio-presencas/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const alunos = await res.json();

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Presença por Turma", 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [["Nome", "CPF", "Presença"]],
        body: alunos.map((aluno) => [
          aluno.nome,
          formatarCPF(aluno.cpf),
          aluno.presente ? "✔️ Sim" : "❌ Não",
        ]),
      });

      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("✅ PDF de presença gerado!");
    } catch {
      toast.error("Erro ao gerar relatório em PDF.");
    }
  };

  const gerarListaAssinaturaPDF = async (turmaId) => {
    const turma = turmas.find((t) => t.id === turmaId);
    let alunos = inscritosPorTurma[turmaId];
  
    if (!alunos) {
      try {
        const res = await fetch(`http://localhost:3000/api/inscricoes/turma/${turmaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alunos = await res.json();
      } catch {
        toast.error("❌ Erro ao carregar inscritos.");
        return;
      }
    }

    if (!turma || !alunos.length) {
      toast.warning("⚠️ Nenhum inscrito encontrado para esta turma.");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Lista de Assinatura - ${turma.nome}`, 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Nome", "CPF", "Assinatura"]],
      body: alunos.map((a) => [a.nome, formatarCPF(a.cpf), "______________________"]),
    });

    doc.save(`lista_assinatura_turma_${turmaId}.pdf`);
    toast.success("📄 Lista de assinatura gerada!");
  };

  const gerarQrCodePresencaPDF = async (turmaId) => {
    try {
      const turma = turmas.find((t) => t.id === turmaId);
      if (!turma) {
        toast.error("Turma não encontrada.");
        return;
      }

      const url = `https://escoladesaude.santos.br/presenca/${turmaId}`;
      const dataUrl = await QRCode.toDataURL(url);

      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(turma.evento, 148, 30, { align: "center" });

      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text(`instrutor: ${nome}`, 148, 40, { align: "center" });

      doc.addImage(dataUrl, "PNG", 98, 50, 100, 100);

      doc.setFontSize(12);
      doc.setTextColor(60);
      doc.text("Escaneie este QR Code para confirmar sua presença", 148, 160, { align: "center" });

      doc.save(`qr_presenca_turma_${turmaId}.pdf`);
      toast.success("🔳 QR Code gerado!");
    } catch {
      toast.error("Erro ao gerar QR Code.");
    }
  };


  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do Instrutor</span>
      </div>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-black dark:text-white text-center">
          📢 Painel do instrutor
        </h2>

        <Notificacoes usuario={usuario} />

        {erro && <ErroCarregamento mensagem={erro} />}

        {!assinatura && (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setModalAssinaturaAberto(true)}
              className="bg-lousa text-white px-4 py-2 rounded-xl shadow hover:bg-green-800"
            >
              ✍️ Cadastrar/Alterar Assinatura
            </button>
          </div>
        )}

<div className="flex justify-center gap-4 mb-6 flex-wrap">
  <button
    onClick={() => setFiltro("todos")}
    className={`px-4 py-1 rounded-full text-sm font-medium ${
      filtro === "todos"
        ? "bg-[#1b4332] text-white"
        : "bg-gray-200 dark:bg-gray-700 dark:text-white"
    }`}
  >
    Todos
  </button>
  <button
    onClick={() => setFiltro("programados")}
    className={`px-4 py-1 rounded-full text-sm font-medium ${
      filtro === "programados"
        ? "bg-[#1b4332] text-white"
        : "bg-gray-200 dark:bg-gray-700 dark:text-white"
    }`}
  >
    Programados
  </button>
  <button
    onClick={() => setFiltro("emAndamento")}
    className={`px-4 py-1 rounded-full text-sm font-medium ${
      filtro === "emAndamento"
        ? "bg-[#1b4332] text-white"
        : "bg-gray-200 dark:bg-gray-700 dark:text-white"
    }`}
  >
    Em andamento
  </button>
  <button
    onClick={() => setFiltro("realizados")}
    className={`px-4 py-1 rounded-full text-sm font-medium ${
      filtro === "realizados"
        ? "bg-[#1b4332] text-white"
        : "bg-gray-200 dark:bg-gray-700 dark:text-white"
    }`}
  >
    Realizados
  </button>
</div>

        <TurmasInstrutor
          turmas={turmasFiltradas}
          inscritosPorTurma={inscritosPorTurma}
          avaliacoesPorTurma={avaliacoesPorTurma}
          onVerInscritos={carregarInscritos}
          onVerAvaliacoes={carregarAvaliacoes}
          token={token}
          carregando={carregando}
          turmaExpandidaInscritos={turmaExpandidaInscritos}
          setTurmaExpandidaInscritos={setTurmaExpandidaInscritos}
          turmaExpandidaAvaliacoes={turmaExpandidaAvaliacoes}
          setTurmaExpandidaAvaliacoes={setTurmaExpandidaAvaliacoes}
        />

        <ModalAssinatura
          aberta={modalAssinaturaAberto}
          aoFechar={() => setModalAssinaturaAberto(false)}
          aoSalvar={() => {
            toast.success("✍️ Assinatura atualizada com sucesso!");
            setAssinatura(true);
            setModalAssinaturaAberto(false);
          }}
        />
      </div>
    </div>
  );
}
