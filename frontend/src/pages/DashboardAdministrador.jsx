// ✅ src/pages/DashboardAdministrador.jsx (premium: mobile-first, ministats + filtros aprimorados, a11y, sem mudar regras)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { useReducedMotion, motion } from "framer-motion";
import { Search, X, RefreshCw, SlidersHorizontal } from "lucide-react";

import CardEventoAdministrador from "../components/CardEventoAdministrador";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";

/* ========= HeaderHero (mobile-first | identidade própria) ========= */
function HeaderHero({ nome, carregando, onRefresh }) {
  return (
    <header className="bg-gradient-to-br from-rose-900 via-pink-700 to-orange-600 text-white" role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-7 text-center flex flex-col items-center gap-2 sm:gap-3 max-w-full min-w-0">
        <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight break-words max-w-full">
          Painel do Administrador
        </h1>

        <p className="text-xs sm:text-sm text-white/90 px-2 break-words whitespace-normal max-w-full">
          {nome ? `Bem-vindo(a), ${nome}.` : "Bem-vindo(a)."} Gerencie eventos, turmas, inscrições, presenças e avaliações.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-xl transition focus-visible:outline-none focus-visible:ring-2
              ${
                carregando
                  ? "opacity-60 cursor-not-allowed bg-white/20"
                  : "bg-white/20 hover:bg-white/25 focus-visible:ring-white/50"
              } text-white w-full sm:w-auto break-words whitespace-normal`}
            aria-label="Atualizar lista de eventos"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} aria-hidden="true" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ========= Helpers de formatação ========= */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const onlyHHmm = (s) => (typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : "12:00");
const toLocalDate = (ymdStr, hhmm = "12:00") => (ymdStr ? new Date(`${ymdStr}T${onlyHHmm(hhmm)}:00`) : null);

const formatarCPF = (v) => {
  const raw = String(v || "").replace(/\D/g, "");
  return raw.length === 11 ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : raw;
};

const formatarDataBR = (isoYMD) => {
  const d = ymd(isoYMD);
  return d ? d.split("-").reverse().join("/") : "";
};

/* ========================= MiniStats ========================= */
function MiniStats({ eventos, turmasPorEvento }) {
  const contadores = useMemo(() => {
    let programado = 0,
      andamento = 0,
      encerrado = 0;
    const agora = new Date();

    for (const ev of eventos) {
      const diAgg = ymd(ev.data_inicio_geral || ev.data_inicio || ev.data);
      const dfAgg = ymd(ev.data_fim_geral || ev.data_fim || ev.data);
      const hiAgg = onlyHHmm(ev.horario_inicio_geral || ev.horario_inicio || "00:00");
      const hfAgg = onlyHHmm(ev.horario_fim_geral || ev.horario_fim || "23:59");

      let inicioDT = diAgg ? toLocalDate(diAgg, hiAgg) : null;
      let fimDT = dfAgg ? toLocalDate(dfAgg, hfAgg) : null;

      // fallback por turmas se o evento não tiver datas agregadas
      if (!inicioDT || !fimDT) {
        const turmas = turmasPorEvento?.[ev.id] || [];
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

      if (!inicioDT || !fimDT) continue;
      if (inicioDT > agora) programado++;
      else if (inicioDT <= agora && fimDT >= agora) andamento++;
      else if (fimDT < agora) encerrado++;
    }

    return { programado, andamento, encerrado };
  }, [eventos, turmasPorEvento]);

  const cards = [
    {
      key: "programado",
      label: "Programados",
      value: contadores.programado,
      color: "from-emerald-700 to-emerald-500",
      ring: "ring-emerald-700/10",
    },
    {
      key: "em_andamento",
      label: "Em andamento",
      value: contadores.andamento,
      color: "from-amber-600 to-amber-400",
      ring: "ring-amber-700/10",
    },
    {
      key: "encerrado",
      label: "Encerrados",
      value: contadores.encerrado,
      color: "from-rose-700 to-rose-500",
      ring: "ring-rose-700/10",
    },
  ];

  return (
    <section aria-label="Indicadores gerais" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`rounded-2xl text-white p-4 shadow-sm ring-1 ${c.ring} bg-gradient-to-br ${c.color} min-w-0`}
        >
          <p className="text-xs/5 opacity-90 break-words whitespace-normal">{c.label}</p>
          <p className="text-2xl font-extrabold mt-1 break-words">{c.value}</p>
        </div>
      ))}
    </section>
  );
}

/* ================================================== */
export default function DashboardAdministrador() {
  const [nome, setNome] = useState("");
  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [eventoExpandido, setEventoExpandido] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // filtros (persistentes)
  const [filtroStatus, setFiltroStatus] = useState(() => localStorage.getItem("adm:filtroStatus") || "em_andamento");
  const [busca, setBusca] = useState(() => localStorage.getItem("adm:busca") || "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);

  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const mounted = useRef(true);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mounted.current = true;
    try {
      const u = JSON.parse(localStorage.getItem("usuario") || "{}");
      setNome(u?.nome || "");
    } catch {
      setNome("");
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  // persistência de filtros
  useEffect(() => {
    localStorage.setItem("adm:filtroStatus", filtroStatus);
  }, [filtroStatus]);

  useEffect(() => {
    localStorage.setItem("adm:busca", busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const carregarEventos = useCallback(async () => {
    setCarregando(true);
    try {
      setLive("Carregando eventos…");
      const data = await apiGet("eventos", { on403: "silent" });
      if (!mounted.current) return;
      setEventos(Array.isArray(data) ? data : []);
      setErro("");
      setLive("Eventos atualizados.");
    } catch (e) {
      console.error("❌ Erro ao carregar eventos:", e);
      toast.error("❌ Erro ao carregar eventos");
      setErro("Erro ao carregar eventos");
      setLive("Falha ao carregar eventos.");
      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      if (mounted.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  /* ========= carregadores ========= */
  const carregarTurmas = useCallback(
    async (eventoId) => {
      if (turmasPorEvento[eventoId]) return;
      try {
        const data = await apiGet(`turmas/evento/${eventoId}`, { on403: "silent" });
        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: Array.isArray(data) ? data : [] }));
      } catch (error) {
        console.error("❌ Erro ao carregar turmas:", error);
        toast.error("❌ Erro ao carregar turmas.");
      }
    },
    [turmasPorEvento]
  );

  const carregarInscritos = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`inscricao/turma/${turmaId}`, { on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch {
      toast.error("❌ Erro ao carregar inscritos.");
    }
  }, []);

  const carregarAvaliacao = useCallback(
    async (turmaId) => {
      if (avaliacaoPorTurma[turmaId]) return;
      try {
        const data = await apiGet(`avaliacao/turma/${turmaId}/all`, { on403: "silent" });
        setAvaliacaoPorTurma((prev) => ({ ...prev, [turmaId]: data || {} }));
      } catch (err) {
        console.error("❌ Erro ao carregar avaliações:", err);
        toast.error("❌ Erro ao carregar avaliações.");
      }
    },
    [avaliacaoPorTurma]
  );

  // retorna payload pra evitar race-condition
  const carregarPresencas = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`presencas/turma/${turmaId}/detalhes`, { on403: "silent" });

      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];

      // só conta encontros que já aconteceram (<= agora)
      const agora = new Date();
      const hojeY = agora.toISOString().slice(0, 10);
      const hhmmAgora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

      const occurred = datas.filter((d) => {
        const di = String(d?.data || d).slice(0, 10);
        const hi = onlyHHmm(d?.horario_inicio || "23:59");
        return di < hojeY || (di === hojeY && hi <= hhmmAgora);
      });

      const ocorridosSet = new Set(occurred.map((d) => String(d?.data || d).slice(0, 10)));
      const totalOcorridos = occurred.length || 0;

      const lista = usuarios.map((u) => {
        const presentesEmOcorridos = (u.presencas || []).reduce((acc, p) => {
          const dia = String(p?.data_presenca || p?.data).slice(0, 10);
          return acc + (p?.presente && ocorridosSet.has(dia) ? 1 : 0);
        }, 0);

        const percExato = totalOcorridos > 0 ? (presentesEmOcorridos / totalOcorridos) * 100 : 0;
        const freqNum = Math.round(percExato);
        const elegivel = percExato >= 75;

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

          elegivel,
          perc_exato: percExato,
          frequencia_num: freqNum,
          frequencia: `${freqNum}%`,

          presentes_ocorridos: presentesEmOcorridos,
          total_ocorridos: totalOcorridos,
        };
      });

      const presentesPorData = occurred.map((d) => {
        const dia = String(d?.data || d).slice(0, 10);
        let count = 0;
        for (const u of usuarios) {
          if (
            (u.presencas || []).some(
              (p) => String(p?.data_presenca || p?.data).slice(0, 10) === dia && p?.presente
            )
          ) {
            count += 1;
          }
        }
        return { data: dia, presentes: count };
      });

      const encontrosOcorridos = totalOcorridos;
      const somaPresentes = presentesPorData.reduce((a, b) => a + b.presentes, 0);
      const mediaPresentes = encontrosOcorridos ? Math.round(somaPresentes / encontrosOcorridos) : 0;

      const payload = { lista, resumo: { encontrosOcorridos, presentesPorData, mediaPresentes } };

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: payload }));
      return payload;
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças da turma.");
      return null;
    }
  }, []);

  /* ========= regras de % presença (≥75%) ========= */
  function porcentagemPresencaTurma(turmaId) {
    const lista = presencasPorTurma?.[turmaId]?.lista || [];
    const totalInscritos = (inscritosPorTurma?.[turmaId] || []).length;
    if (!totalInscritos) return 0;
    const elegiveis = lista.filter((u) => u.elegivel === true).length;
    return Math.round((elegiveis / totalInscritos) * 100);
  }

  function porcentagemPresencaEvento(eventoId) {
    const turmas = turmasPorEvento?.[eventoId] || [];
    let somaElegiveis = 0;
    let somaInscritos = 0;

    for (const t of turmas) {
      const turmaId = t.id;
      const lista = presencasPorTurma?.[turmaId]?.lista || [];
      const inscritos = (inscritosPorTurma?.[turmaId] || []).length;
      somaElegiveis += lista.filter((u) => u.elegivel === true).length;
      somaInscritos += inscritos;
    }
    if (!somaInscritos) return 0;
    return Math.round((somaElegiveis / somaInscritos) * 100);
  }

  /* ========= PDF helpers (mantidos) ========= */
  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const data = await apiGet(`presencas/relatorio-presencas/turma/${turmaId}`, { on403: "silent" });
      const alunos = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];

      const total = alunos.length;
      const presentes = alunos.filter((a) => {
        const n =
          typeof a.frequencia_num === "number"
            ? a.frequencia_num
            : parseInt(String(a.frequencia || "0").replace(/\D/g, ""), 10) || 0;
        return n >= 75;
      }).length;

      const presencaMedia = total ? ((presentes / total) * 100).toFixed(1) : "0.0";

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Presença por Turma", 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [["Nome", "CPF", "Presença (≥75%)"]],
        body: alunos.map((a) => {
          const n =
            typeof a.frequencia_num === "number"
              ? a.frequencia_num
              : parseInt(String(a.frequencia || "0").replace(/\D/g, ""), 10) || 0;
          return [a.nome, formatarCPF(a.cpf), n >= 75 ? "Sim" : "Não"];
        }),
      });

      const finalY = (doc.lastAutoTable?.finalY || 30) + 10;
      doc.setFontSize(12);
      doc.text(`Total de inscritos: ${total}`, 14, finalY);
      doc.text(`Total de presentes (≥75%): ${presentes}`, 14, finalY + 6);
      doc.text(`Presença (% ≥75%): ${presencaMedia}%`, 14, finalY + 12);

      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("📄 PDF gerado com sucesso!");
    } catch {
      toast.error("❌ Erro ao gerar PDF.");
    }
  };

  const gerarPdfInscritosTurma = async (turmaId) => {
    try {
      let inscritos = inscritosPorTurma[turmaId];
      if (!Array.isArray(inscritos)) {
        const data = await apiGet(`inscricao/turma/${turmaId}`, { on403: "silent" });
        inscritos = Array.isArray(data) ? data : [];
        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: inscritos }));
      }

      let pres = presencasPorTurma[turmaId];
      if (!pres) pres = await carregarPresencas(turmaId);

      const todasTurmas = Object.values(turmasPorEvento).flat();
      const turma = todasTurmas.find((t) => Number(t?.id) === Number(turmaId)) || {};

      const eventoNome = turma?.evento?.nome || turma?.evento?.titulo || turma?.titulo_evento || "Evento";
      const turmaNome = turma?.nome || `Turma ${turmaId}`;

      const only = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
      const di = ymd(turma?.data_inicio),
        df = ymd(turma?.data_fim);
      const hi = only(turma?.horario_inicio),
        hf = only(turma?.horario_fim);

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text(`Lista de Inscritos — ${eventoNome}`, 14, 16);
      doc.setFontSize(12);
      doc.text(`${turmaNome}`, 14, 24);

      if (di || df)
        doc.text(`Período: ${formatarDataBR(di)} a ${formatarDataBR(df)}`, 14, 30);
      if (hi || hf) doc.text(`Horário: ${hi} às ${hf}`, 14, 36);

      const totalInscritos = inscritos.length;
      const listaPres = pres?.lista || [];
      const elegiveis = listaPres.filter((u) => u.elegivel === true).length;
      const pctElegiveis = totalInscritos ? Math.round((elegiveis / totalInscritos) * 100) : 0;

      doc.text(`Presença (regra ≥ 75%): ${elegiveis}/${totalInscritos} (${pctElegiveis}%)`, 14, 42);

      const mapFreq = {};
      (pres?.lista || []).forEach((p) => {
        mapFreq[p.usuario_id] = p.frequencia;
      });

      const idadeDe = (iso) => {
        const d = typeof iso === "string" ? iso.slice(0, 10) : "";
        if (!d) return "";
        const [Y, M, D] = d.split("-").map(Number);
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
          .sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || "")))
          .map((i) => {
            const cpfFmt = formatarCPF(i?.cpf);
            const pcdTags = [
              i?.pcd_visual || i?.def_visual ? "VIS" : "",
              i?.pcd_auditiva || i?.def_auditiva || i?.surdo ? "AUD" : "",
              i?.pcd_fisica || i?.def_fisica ? "FIS" : "",
              i?.pcd_intelectual || i?.def_mental ? "INT" : "",
              i?.pcd_multipla ? "MULT" : "",
              i?.pcd_autismo || i?.tea ? "TEA" : "",
            ]
              .filter(Boolean)
              .join(", ");

            return [
              i?.nome || "—",
              cpfFmt,
              idadeDe(i?.data_nascimento || i?.nascimento),
              i?.registro || i?.registro_funcional || i?.matricula || "",
              pcdTags,
              mapFreq[i?.id] || mapFreq[i?.usuario_id] || "",
            ];
          }),
        styles: { fontSize: 9, overflow: "linebreak" },
        headStyles: { fillColor: [22, 101, 52] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 30 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30, halign: "center" },
        },
      });

      doc.save(`inscritos_turma_${turmaId}.pdf`);
      toast.success("📄 PDF de inscritos gerado!");
    } catch (e) {
      console.error(e);
      toast.error("❌ Erro ao gerar PDF de inscritos.");
    }
  };

  /* ========= lógica de UI ========= */
  const toggleExpandir = (eventoId) => {
    setEventoExpandido(eventoExpandido === eventoId ? null : eventoId);
    carregarTurmas(eventoId);
  };

  const filtrarPorStatus = (evento) => {
    const agora = new Date();
    const turmas = turmasPorEvento[evento.id] || [];

    const diAgg = ymd(evento.data_inicio_geral);
    const dfAgg = ymd(evento.data_fim_geral);
    const hiAgg = onlyHHmm(evento.horario_inicio_geral || "00:00");
    const hfAgg = onlyHHmm(evento.horario_fim_geral || "23:59");

    let inicioDT = diAgg ? toLocalDate(diAgg, hiAgg) : null;
    let fimDT = dfAgg ? toLocalDate(dfAgg, hfAgg) : null;

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

  const eventosOrdenados = useMemo(() => {
    return [...eventos].sort((a, b) => {
      const aDT = toLocalDate(ymd(a.data_inicio_geral || a.data_inicio || a.data), onlyHHmm(a.horario_inicio_geral || a.horario_inicio || "00:00"));
      const bDT = toLocalDate(ymd(b.data_inicio_geral || b.data_inicio || b.data), onlyHHmm(b.horario_inicio_geral || b.horario_inicio || "00:00"));
      const aTime = aDT?.getTime?.() ?? Infinity;
      const bTime = bDT?.getTime?.() ?? Infinity;
      return aTime - bTime;
    });
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    const byStatus = eventosOrdenados.filter(filtrarPorStatus);
    if (!buscaDebounced) return byStatus;
    const q = buscaDebounced;
    return byStatus.filter((ev) => String(ev?.nome || ev?.titulo || "").toLowerCase().includes(q));
  }, [eventosOrdenados, filtroStatus, turmasPorEvento, buscaDebounced]);

  const filtroKeys = ["todos", "programado", "em_andamento", "encerrado"];
  const onTabKeyDown = (e) => {
    const idx = filtroKeys.indexOf(filtroStatus);
    if (e.key === "ArrowRight") setFiltroStatus(filtroKeys[(idx + 1) % filtroKeys.length]);
    else if (e.key === "ArrowLeft") setFiltroStatus(filtroKeys[(idx - 1 + filtroKeys.length) % filtroKeys.length]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden min-w-0">
      <HeaderHero nome={nome} carregando={carregando} onRefresh={carregarEventos} />

      {carregando && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-pink-100 dark:bg-pink-950/30 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando eventos"
        >
          <div className={`h-full bg-pink-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <main
        id="conteudo"
        className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-6 min-w-0 max-w-full overflow-x-hidden"
      >
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <MiniStats eventos={eventos} turmasPorEvento={turmasPorEvento} />

        {/* Filtros (premium) */}
        <section
          className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 p-3 sm:p-4 mb-4 sm:mb-6 min-w-0 overflow-hidden"
          aria-label="Filtros por status do evento"
        >
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-zinc-800 dark:text-zinc-100">
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                Filtros
              </div>
              <button
                type="button"
                onClick={() => {
                  setFiltroStatus("em_andamento");
                  setBusca("");
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                aria-label="Resetar filtros"
              >
                Resetar
              </button>
            </div>

            <nav
              className="flex flex-wrap gap-2 sm:gap-3 min-w-0 w-full"
              role="tablist"
              aria-label="Filtros por status"
              onKeyDown={onTabKeyDown}
            >
              {[
                { key: "todos", label: "Todos" },
                { key: "programado", label: "Programados" },
                { key: "em_andamento", label: "Em andamento" },
                { key: "encerrado", label: "Encerrados" },
              ].map(({ key, label }) => {
                const active = filtroStatus === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    tabIndex={active ? 0 : -1}
                    aria-selected={active}
                    aria-controls={`painel-${key}`}
                    onClick={() => setFiltroStatus(key)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 break-words whitespace-normal max-w-full
                      ${
                        active
                          ? "bg-pink-600 text-white focus-visible:ring-pink-500"
                          : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 focus-visible:ring-zinc-400"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 min-w-0 w-full">
              <label htmlFor="busca-evento" className="sr-only">
                Buscar evento pelo nome
              </label>

              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="busca-evento"
                  type="search"
                  inputMode="search"
                  placeholder="Buscar evento pelo nome…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-9 pr-10 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 dark:text-white text-sm min-w-0 outline-none focus:ring-2 focus:ring-pink-300 dark:focus:ring-pink-900"
                  aria-describedby="dica-busca"
                />
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  disabled={!busca}
                  aria-disabled={!busca}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition
                    ${!busca ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p id="dica-busca" className="text-xs text-zinc-600 dark:text-zinc-300 break-words">
              Dica: digite parte do nome do evento para filtrar rapidamente.
            </p>
          </div>
        </section>

        {erro && (
          <div
            ref={erroRef}
            tabIndex={-1}
            className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 rounded-2xl p-3 sm:p-4 mb-4 outline-none ring-1 ring-red-200/60 dark:ring-red-900/40"
            role="alert"
          >
            <div className="flex items-center gap-2 justify-between">
              <p className="text-sm break-words">{erro}</p>
              <button
                type="button"
                onClick={carregarEventos}
                className="text-sm font-bold px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-800/40 hover:bg-red-200 dark:hover:bg-red-800/60"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Lista de eventos */}
        <section
          id={`painel-${filtroStatus}`}
          role="tabpanel"
          aria-label="Lista de eventos filtrados"
          className="space-y-3 sm:space-y-4 min-w-0"
        >
          {carregando && (
            <>
              <Skeleton height={110} className="rounded-2xl" />
              <Skeleton height={110} className="rounded-2xl" />
              <Skeleton height={110} className="rounded-2xl" />
            </>
          )}

          {!carregando &&
            eventosFiltrados.map((evento) => (
              <motion.div
                key={evento.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 overflow-hidden"
              >
                <CardEventoAdministrador
                  evento={evento}
                  expandido={eventoExpandido === evento.id}
                  toggleExpandir={toggleExpandir}
                  turmas={turmasPorEvento[evento.id] || []}
                  carregarInscritos={carregarInscritos}
                  inscritosPorTurma={inscritosPorTurma}
                  carregarAvaliacao={carregarAvaliacao}
                  avaliacaoPorTurma={avaliacaoPorTurma}
                  presencasPorTurma={presencasPorTurma}
                  carregarPresencas={carregarPresencas}
                  gerarRelatorioPDF={gerarRelatorioPDF}
                  gerarPdfInscritosTurma={gerarPdfInscritosTurma}
                  calcularPctTurma={(turmaId) => porcentagemPresencaTurma(turmaId)}
                  calcularPctEvento={(eventoId) => porcentagemPresencaEvento(eventoId)}
                  /* ⬇️ NOVO: forçar quebra de linha no nome do evento e instrutores */
                  classNomeEventoMultiLinha="break-words whitespace-normal text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-snug"
                  classInstrutoresMultiLinha="break-words whitespace-normal text-xs text-zinc-500 dark:text-zinc-400 leading-snug"
                />
              </motion.div>
            ))}

          {!carregando && eventosFiltrados.length === 0 && (
            <p className="text-center text-zinc-600 dark:text-zinc-300 text-sm sm:text-base px-2 break-words">
              Nenhum evento encontrado para o filtro selecionado.
            </p>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
