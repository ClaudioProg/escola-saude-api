// ✅ src/pages/DashboardAdministrador.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import CardEventoadministrador from "../components/CardEventoadministrador";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";

/* ========= HeaderHero (novo) ========= */
function HeaderHero({ nome, carregando, onRefresh }) {
  return (
    <header className="bg-gradient-to-br from-rose-900 via-pink-700 to-orange-600 text-white" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Painel do Administrador
        </h1>
        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}.` : "Bem-vindo(a)."} Gerencie eventos, turmas, inscrições, presenças e avaliações.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
            aria-label="Atualizar lista de eventos"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

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

  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

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
  async function carregarEventos() {
    setCarregando(true);
    try {
      setLive("Carregando eventos…");
      const data = await apiGet("/api/eventos", { on403: "silent" });
      setEventos(Array.isArray(data) ? data : []);
      setErro("");
      setLive("Eventos atualizados.");
    } catch (e) {
      console.error("❌ Erro ao carregar eventos:", e);
      toast.error("❌ Erro ao carregar eventos");
      setErro("Erro ao carregar eventos");
      setLive("Falha ao carregar eventos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ⚠️ Admin deve usar o endpoint que retorna TODAS as respostas da turma
  const carregarAvaliacoes = async (turmaId) => {
    if (avaliacoesPorTurma[turmaId]) return;
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}/all`, { on403: "silent" });
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data || {} }));
    } catch (err) {
      console.error("❌ Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações.");
    }
  };

  // Admin: guarda a lista por-usuário E um resumo por data para calcular "presença até agora"
const carregarPresencas = async (turmaId) => {
  try {
    const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });

    const datas = Array.isArray(data?.datas) ? data.datas : [];
    const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];

    // lista por-usuário (mantém compatibilidade)
    const totalDias = datas.length || 0;
    const lista = usuarios.map((u) => {
      const presentes = (u.presencas || []).filter((p) => p?.presente === true).length;
      const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
      return {
        usuario_id: u.id,
        id: u.id,
        nome: u.nome,
        cpf: u.cpf,
        registro: u?.registro || u?.registro_funcional || u?.matricula,
        data_nascimento: u?.data_nascimento || u?.nascimento,
        pcd_visual: u?.pcd_visual || u?.def_visual || u?.deficiencia_visual,
        pcd_auditiva: u?.pcd_auditiva || u?.def_auditiva || u?.deficiencia_auditiva || u?.surdo,
        pcd_fisica: u?.pcd_fisica || u?.def_fisica || u?.deficiencia_fisica,
        pcd_intelectual: u?.pcd_intelectual || u?.def_mental || u?.def_intelectual,
        pcd_multipla: u?.pcd_multipla || u?.def_multipla,
        pcd_autismo: u?.pcd_autismo || u?.tea || u?.transtorno_espectro_autista,
        presente: presentes > 0,
        frequencia: `${freq}%`,
      };
    });

    // resumo por encontro (para "presentes até agora")
    // conta presentes por data; só datas que já ocorreram entram no cálculo
    const hoje = new Date();
    const occurred = datas.filter(d => {
      const di = (d?.data || d);
      const hi = (d?.horario_inicio || "00:00").slice(0,5);
      const dt = di ? new Date(`${String(di).slice(0,10)}T${hi}:00`) : null;
      return dt && dt <= hoje;
    });

    const presentesPorData = occurred.map(d => {
      const dia = String(d?.data || d).slice(0,10);
      let count = 0;
      for (const u of usuarios) {
        if ((u.presencas || []).some(p => String(p?.data_presenca || p?.data).slice(0,10) === dia && p?.presente)) {
          count += 1;
        }
      }
      return { data: dia, presentes: count };
    });

    const encontrosOcorridos = presentesPorData.length;
    const somaPresentes = presentesPorData.reduce((a,b)=>a + b.presentes, 0);
    const mediaPresentes = encontrosOcorridos ? Math.round(somaPresentes / encontrosOcorridos) : 0;

    setPresencasPorTurma((prev) => ({
      ...prev,
      [turmaId]: {
        lista,                              // o que já existia
        resumo: { encontrosOcorridos, presentesPorData, mediaPresentes }
      }
    }));
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
      // garante dados
      let inscritos = inscritosPorTurma[turmaId];
      if (!Array.isArray(inscritos)) {
        const data = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
        inscritos = Array.isArray(data) ? data : [];
        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: inscritos }));
      }
  
      // presenças (para % individual e média até agora)
      let pres = presencasPorTurma[turmaId];
      if (!pres) {
        await carregarPresencas(turmaId);
        pres = presencasPorTurma[turmaId]; // pode vir no próximo tick; se não vier, segue sem % individual
      }
  
      const todasTurmas = Object.values(turmasPorEvento).flat();
      const turma = todasTurmas.find((t) => Number(t?.id) === Number(turmaId)) || {};
  
      const eventoNome = turma?.evento?.nome || turma?.evento?.titulo || turma?.titulo_evento || "Evento";
      const turmaNome = turma?.nome || `Turma ${turmaId}`;
  
      // helpers locais
      const only = (s) => (typeof s === "string" ? s.slice(0,5) : "");
      const ymd = (s) => (typeof s === "string" ? s.slice(0,10) : "");
      const di = ymd(turma?.data_inicio), df = ymd(turma?.data_fim);
      const hi = only(turma?.horario_inicio), hf = only(turma?.horario_fim);
  
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
  
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text(`Lista de Inscritos — ${eventoNome}`, 14, 16);
      doc.setFontSize(12);
      doc.text(`${turmaNome}`, 14, 24);
      if (di || df) doc.text(`Período: ${di?.split("-").reverse().join("/")} a ${df?.split("-").reverse().join("/")}`, 14, 30);
      if (hi || hf) doc.text(`Horário: ${hi} às ${hf}`, 14, 36);
  
      const presResumo = pres?.resumo;
      if (presResumo) {
        const media = presResumo.mediaPresentes || 0;
        const totalInscritos = inscritos.length;
        const pct = totalInscritos ? Math.round((media / totalInscritos) * 100) : 0;
        doc.text(`Presença "até agora": média ${media}/${totalInscritos} (${pct}%) em ${presResumo.encontrosOcorridos} encontros`, 14, 42);
      }
  
      const mapFreq = {};
      (pres?.lista || []).forEach(p => { mapFreq[p.usuario_id] = p.frequencia; });
  
      const idadeDe = (iso) => {
        const d = typeof iso === "string" ? iso.slice(0,10) : "";
        if (!d) return "";
        const [Y,M,D] = d.split("-").map(Number);
        const hoje = new Date();
        let idade = hoje.getFullYear() - Y;
        const m = hoje.getMonth() + 1 - M;
        if (m < 0 || (m === 0 && hoje.getDate() < D)) idade--;
        return idade >= 0 && idade < 140 ? `${idade}` : "";
      };
  
      autoTable(doc, {
        startY: 48,
        head: [["Nome", "CPF", "Idade", "Registro", "PcD", "Frequência"]],
        body: inscritos
          .slice()
          .sort((a,b)=>String(a?.nome||"").localeCompare(String(b?.nome||"")))
          .map((i) => {
            const cpfFmt = formatarCPF(i?.cpf);
            const pcdTags = [
              (i?.pcd_visual || i?.def_visual) ? "VIS" : "",
              (i?.pcd_auditiva || i?.def_auditiva || i?.surdo) ? "AUD" : "",
              (i?.pcd_fisica || i?.def_fisica) ? "FIS" : "",
              (i?.pcd_intelectual || i?.def_mental) ? "INT" : "",
              (i?.pcd_multipla) ? "MULT" : "",
              (i?.pcd_autismo || i?.tea) ? "TEA" : "",
            ].filter(Boolean).join(", ");
            return [
              i?.nome || "—",
              cpfFmt,
              idadeDe(i?.data_nascimento || i?.nascimento),
              i?.registro || i?.registro_funcional || i?.matricula || "",
              pcdTags,
              mapFreq[i?.id] || mapFreq[i?.usuario_id] || ""
            ];
          }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [22, 101, 52] },
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

  const eventosFiltrados = useMemo(
    () => eventosOrdenados.filter(filtrarPorStatus),
    [eventosOrdenados, filtroStatus, turmasPorEvento]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Header novo */}
      <HeaderHero nome={nome} carregando={carregando} onRefresh={carregarEventos} />

      {/* barra de carregamento fina no topo */}
      {carregando && (
        <div className="sticky top-0 left-0 w-full h-1 bg-pink-100 z-40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Carregando eventos">
          <div className="h-full bg-pink-600 animate-pulse w-1/3" />
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Filtros de status (acessível) */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 sm:p-4 mb-6">
          <div className="flex justify-center gap-2 sm:gap-3 flex-wrap" role="group" aria-label="Filtros por status do evento">
            {["todos", "programado", "em_andamento", "encerrado"].map((status) => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500
                  ${filtroStatus === status
                    ? "bg-pink-600 text-white"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white"}`}
                aria-pressed={filtroStatus === status}
                aria-label={`Filtrar eventos: ${{
                  todos: "Todos",
                  programado: "Programados",
                  em_andamento: "Em andamento",
                  encerrado: "Encerrados",
                }[status]}`}
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
        </section>

        {erro && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-xl p-4 mb-4" role="alert">
            {erro}
          </div>
        )}

        {/* Lista de eventos */}
        <section className="space-y-4">
          {eventosFiltrados.map((evento) => (
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

          {!carregando && eventosFiltrados.length === 0 && (
            <p className="text-center text-gray-600 dark:text-gray-300">
              Nenhum evento encontrado para o filtro selecionado.
            </p>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
