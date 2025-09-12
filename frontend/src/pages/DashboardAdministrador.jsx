// 📁 src/pages/DashboardAdministrador.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import Breadcrumbs from "../components/Breadcrumbs";
import CardEventoadministrador from "../components/CardEventoadministrador";
import { apiGet } from "../services/api";

// ✅ novos
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

/* ========= Helpers anti-fuso e formatação ========= */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const toLocalDate = (ymdStr, hhmm = "12:00") =>
  ymdStr ? new Date(`${ymdStr}T${(hhmm || "12:00").slice(0, 5)}:00`) : null;

const onlyHHmm = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const formatarCPF = (v) =>
  (String(v || "").replace(/\D/g, "").padStart(11, "0") || "")
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatarDataBR = (isoYMD) => {
  const d = ymd(isoYMD);
  return d ? d.split("-").reverse().join("/") : "";
};
/* ================================================== */

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

  /* ========= Carregadores ========= */

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
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data || {} }));
    } catch (err) {
      console.error("❌ Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações.");
    }
  };

  const carregarPresencas = async (turmaId) => {
    try {
      const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      const totalDias = datas.length || 0;

      const lista = usuarios.map((u) => {
        const presentes = (u.presencas || []).filter((p) => p?.presente === true).length;
        const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
        return {
          usuario_id: u.id,
          nome: u.nome,
          cpf: u.cpf,
          presente: freq >= 75,
          frequencia: `${freq}%`,
        };
      });

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: lista }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças da turma.");
    }
  };

  /* ========= PDFs ========= */

  // (1) Relatório de presença (mantido)
  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const data = await apiGet(`/api/presencas/relatorio-presencas/turma/${turmaId}`, { on403: "silent" });
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
        body: alunos.map((a) => [a.nome, formatarCPF(a.cpf), a.presente ? "Sim" : "Não"]),
      });

      const finalY = (doc.lastAutoTable?.finalY || 30) + 10;
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

  // (2) PDF com dados do curso + lista de INSCRITOS (nome/cpf)
  const gerarPdfInscritosTurma = async (turmaId) => {
    try {
      // Garante a lista de inscritos no cache
      let inscritos = inscritosPorTurma[turmaId];
      if (!Array.isArray(inscritos)) {
        const data = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
        inscritos = Array.isArray(data) ? data : [];
        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: inscritos }));
      }

      // Localiza o objeto da turma (procura em todas as listas já carregadas)
      const todasTurmas = Object.values(turmasPorEvento).flat();
      const turma = todasTurmas.find((t) => Number(t?.id) === Number(turmaId)) || {};

      const eventoNome =
        turma?.evento?.nome || turma?.evento?.titulo || turma?.titulo_evento || turma?.nome_evento || "Evento";
      const turmaNome = turma?.nome || `Turma ${turmaId}`;
      const di = ymd(turma?.data_inicio);
      const df = ymd(turma?.data_fim);
      const hi = onlyHHmm(turma?.horario_inicio);
      const hf = onlyHHmm(turma?.horario_fim);
      const vagas = Number(turma?.vagas || turma?.vagas_totais || 0);
      const qtd = inscritos.length;
      const perc = vagas > 0 ? Math.round((qtd / vagas) * 100) : null;

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Lista de Inscritos — ${eventoNome}`, 14, 18);
      doc.setFontSize(12);
      doc.text(`${turmaNome}`, 14, 26);
      if (di || df) doc.text(`Período: ${formatarDataBR(di)} a ${formatarDataBR(df)}`, 14, 32);
      if (hi || hf) doc.text(`Horário: ${hi} às ${hf}`, 14, 38);
      if (vagas || vagas === 0) {
        doc.text(
          `Vagas: ${qtd}${vagas ? ` de ${vagas}` : ""}${perc !== null ? ` (${perc}%)` : ""}`,
          14,
          44
        );
      }

      autoTable(doc, {
        startY: 50,
        head: [["Nome", "CPF"]],
        body: inscritos.map((i) => [i?.nome || "—", formatarCPF(i?.cpf)]),
      });

      doc.save(`inscritos_turma_${turmaId}.pdf`);
      toast.success("📄 PDF de inscritos gerado!");
    } catch (e) {
      console.error(e);
      toast.error("❌ Erro ao gerar PDF de inscritos.");
    }
  };

  /* ========= UI / Lógica ========= */

  const toggleExpandir = (eventoId) => {
    setEventoExpandido(eventoExpandido === eventoId ? null : eventoId);
    carregarTurmas(eventoId);
  };

  // Filtrar por status com datas agregadas (respeitando hora local)
  const filtrarPorStatus = (evento) => {
    const agora = new Date();
    const turmas = turmasPorEvento[evento.id] || [];

    const diAgg = ymd(evento.data_inicio_geral);
    const dfAgg = ymd(evento.data_fim_geral);
    const hiAgg = onlyHHmm(evento.horario_inicio_geral || "00:00");
    const hfAgg = onlyHHmm(evento.horario_fim_geral || "23:59");

    let inicioDT = diAgg ? toLocalDate(diAgg, hiAgg) : null;
    let fimDT = dfAgg ? toLocalDate(dfAgg, hfAgg) : null;

    // Fallback para o range real das turmas já carregadas
    if (!inicioDT || !fimDT) {
      const starts = [];
      const ends = [];
      for (const t of turmas) {
        const di = ymd(t.data_inicio);
        const df = ymd(t.data_fim);
        const hi = onlyHHmm(t.horario_inicio || "00:00");
        const hf = onlyHHmm(t.horario_fim || "23:59");
        const s = di ? toLocalDate(di, hi) : null;
        const e = df ? toLocalDate(df, hf) : null;
        if (s) starts.push(s.getTime());
        if (e) ends.push(e.getTime());
      }
      if (starts.length) inicioDT = new Date(Math.min(...starts));
      if (ends.length) fimDT = new Date(Math.max(...ends));
    }

    if (!inicioDT || !fimDT) return filtroStatus === "todos";
    if (filtroStatus === "programado") return inicioDT > agora;
    if (filtroStatus === "em_andamento") return inicioDT <= agora && fimDT >= agora;
    if (filtroStatus === "encerrado") return fimDT < agora;
    return true;
  };

  // Ordena eventos por data de início (LOCAL, com hora)
  const eventosOrdenados = useMemo(() => {
    return [...eventos].sort((a, b) => {
      const aDT = toLocalDate(
        ymd(a.data_inicio_geral || a.data_inicio || a.data),
        onlyHHmm(a.horario_inicio_geral || a.horario_inicio || "00:00")
      );
      const bDT = toLocalDate(
        ymd(b.data_inicio_geral || b.data_inicio || b.data),
        onlyHHmm(b.horario_inicio_geral || b.horario_inicio || "00:00")
      );
      if (!aDT && !bDT) return 0;
      if (!aDT) return 1;
      if (!bDT) return -1;
      return aDT - bDT;
    });
  }, [eventos]);

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* barra de carregamento fina no topo */}
      {carregando && (
        <div className="sticky top-0 left-0 w-full h-1 bg-green-100 z-40">
          <div className="h-full bg-[#1b4332] animate-pulse w-1/3" aria-label="Carregando eventos" />
        </div>
      )}

      <div className="px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Painel do Administrador" }]} />

        {/* ✅ PageHeader padronizado */}
        <PageHeader
  title="🧑‍💼 Painel do Administrador"
  subtitle={nome ? `Bem-vindo(a), ${nome}` : "Bem-vindo(a)"}
  className="mb-6 sm:mb-8"   // ⬅️ adiciona espaço abaixo do header
/>

        <section className="max-w-5xl mx-auto">
          {/* Filtros de status (acessível) */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-6 flex-wrap" role="group" aria-label="Filtros por status do evento">
            {["todos", "programado", "em_andamento", "encerrado"].map((status) => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-4 py-1 rounded-full text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#1b4332] ${
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

          {/* Lista de eventos */}
          <div className="space-y-4">
            {eventosOrdenados.filter(filtrarPorStatus).map((evento) => (
              <CardEventoadministrador
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
                // PDFs
                gerarRelatorioPDF={gerarRelatorioPDF}            // presença
                gerarPdfInscritosTurma={gerarPdfInscritosTurma}  // infos + inscritos
              />
            ))}
            {eventosOrdenados.filter(filtrarPorStatus).length === 0 && (
              <p className="text-center text-gray-600 dark:text-gray-300">Nenhum evento encontrado para o filtro selecionado.</p>
            )}
          </div>
        </section>
      </div>

      {/* ✅ Footer global */}
      <Footer />
    </main>
  );
}
