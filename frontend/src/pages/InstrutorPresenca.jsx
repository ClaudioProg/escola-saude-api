// ✅ src/pages/InstrutorPresenca.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import TurmasInstrutor from "../components/TurmasInstrutor";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ModalAssinatura from "../components/ModalAssinatura";
import Footer from "../components/Footer";

import { formatarCPF, formatarDataBrasileira } from "../utils/data";
import { apiGet, apiGetTurmaDatasAuto } from "../services/api";
import { RefreshCw, PenLine, Presentation } from "lucide-react";

/* ───────────────────────────── HeaderHero (3 cores) ───────────────────────────── */
function HeaderHero({
  nome = "",
  carregando = false,
  onRefresh,
  onAbrirAssinatura,
  mostrarBotaoAssinatura = false,
  variant = "indigo",
}) {
  // apenas 3 variantes (como combinado)
  const variants = {
    indigo: "from-indigo-900 via-violet-800 to-fuchsia-700",
    emerald: "from-emerald-900 via-emerald-800 to-emerald-700",
    cyan: "from-cyan-900 via-cyan-800 to-cyan-700",
  };
  const grad = variants[variant] ?? variants.indigo;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`} role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Presentation className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Painel do Instrutor</h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="text-sm text-white/90">
            {nome ? `Bem-vindo(a), ${nome}` : "Gerencie suas turmas, presenças e relatórios"}
          </p>

          {mostrarBotaoAssinatura && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/95 text-amber-900 border border-amber-300 shadow-sm">
              ⚠︎ Sem assinatura cadastrada
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md transition border border-white/20
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
            aria-label="Atualizar painel do instrutor"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>

          {mostrarBotaoAssinatura && (
            <button
              type="button"
              onClick={onAbrirAssinatura}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600"
              aria-label="Cadastrar ou alterar assinatura"
              title="Cadastrar/Alterar Assinatura"
            >
              <PenLine className="w-4 h-4" />
              Assinatura
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ----------------- helpers anti-fuso ----------------- */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const toLocalNoon = (ymdStr) => (ymdStr ? new Date(`${ymdStr}T12:00:00`) : null);
const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const hhmm = (v, fb = "") =>
  typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fb;

/* ----------------- SW Cache (sessionStorage) ----------------- */
const CACHE_KEY = "cache:instrutor:minhas-turmas:v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.turmas) ? parsed : null;
  } catch {
    return null;
  }
}
function writeCache(turmas) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ turmas, ts: Date.now() }));
  } catch {}
}

/* ----------------- Timeout + Abort (anticorrida) ----------------- */
const FETCH_TIMEOUT_MS = 15000; // 15s
function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error("TIMEOUT_FETCH_TURMAS")), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

/* ---------- normalização do item vindo da API ---------- */
function normalizeTurma(t) {
  if (!t) return t;

  const data_inicio =
    ymd(t.data_inicio || t.dataInicio || t.inicio || t.data) || null;
  const data_fim =
    ymd(t.data_fim || t.dataFim || t.fim || t.data_termino || t.dataTermino || t.data) || null;

  const evento =
    (t.evento && t.evento.id && t.evento) ||
    (t.evento_id && {
      id: t.evento_id,
      nome:
        t.evento_nome ||
        t.evento_titulo ||
        t.titulo_evento ||
        t.nome_evento ||
        t.titulo ||
        "Evento",
      local: t.local_evento || t.local || undefined,
    }) ||
    undefined;

  const horario_inicio = hhmm(t.horario_inicio || t.hora_inicio || t.horainicio, "");
  const horario_fim = hhmm(t.horario_fim || t.hora_fim || t.horafim, "");

  const datas =
    Array.isArray(t.datas) ? t.datas :
    Array.isArray(t.encontros) ? t.encontros :
    t.datas_turma || [];

  return {
    ...t,
    data_inicio,
    data_fim,
    evento,
    horario_inicio,
    horario_fim,
    datas,
  };
}

/* ===================================================================== */

export default function InstrutorPresenca() {
  const liveRef = useRef(null);

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {}
  const nome = usuario?.nome || "";

  const [turmas, setTurmas] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [turmaExpandidaInscritos, setTurmaExpandidaInscritos] = useState(null);
  const [turmaExpandidaAvaliacoes, setTurmaExpandidaAvaliacoes] = useState(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinatura, setAssinatura] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [datasPorTurma, setDatasPorTurma] = useState({});

  const inFlightRef = useRef(0);
  const abortRef = useRef(null);

  const beginLoad = () => {
    inFlightRef.current += 1;
    setCarregando(true);
  };
  const endLoad = () => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current === 0) setCarregando(false);
  };

  useEffect(() => {
    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
      inFlightRef.current = 0;
      setCarregando(false);
    };
  }, []);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const ordenar = (arr) =>
    arr
      .slice()
      .sort((a, b) => {
        const ad = toLocalNoon(ymd(a.data_inicio));
        const bd = toLocalNoon(ymd(b.data_inicio));
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return bd - ad; // mais recentes primeiro
      });

  async function fetchTurmas({ showSpinner = true } = {}) {
    if (showSpinner || inFlightRef.current === 0) {
      beginLoad();
      setLive("Carregando suas turmas…");
    }

    try {
      try {
        abortRef.current?.abort?.();
      } catch {}
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const data = await withTimeout(
        apiGet("/api/instrutor/minhas/turmas", { on403: "silent", signal: ctrl.signal })
      );

      const arr = Array.isArray(data) ? data : [];
      const normalizadas = ordenar(
        arr.map(normalizeTurma).filter((t) => t && t.id && t.evento?.id)
      );

      setTurmas(normalizadas);
      setErro("");
      writeCache(normalizadas);

      // pré-carrega presenças silenciosamente
      Promise.allSettled(
        normalizadas
          .filter((t) => t?.id)
          .map((t) => carregarPresencas(t.id, { silent: true }))
      );
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (err?.message === "TIMEOUT_FETCH_TURMAS") {
        const cached = readCache();
        if (cached?.turmas?.length) {
          setTurmas(ordenar(cached.turmas));
          toast.warn("⏱️ Conexão lenta — exibindo dados em cache.");
        } else {
          setTurmas([]);
          toast.error("⏱️ Tempo excedido ao carregar suas turmas.");
        }
      } else {
        console.error("Erro ao carregar turmas:", {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        });
        setErro(err?.message || "Erro ao carregar suas turmas.");
        toast.error(`❌ ${err?.message || "Erro ao carregar suas turmas."}`);

        const cached = readCache();
        if (cached?.turmas?.length) setTurmas(ordenar(cached.turmas));
      }
    } finally {
      endLoad();
      setLive("Turmas atualizadas.");
    }

    // assinatura (não prende o spinner)
    try {
      const a = await apiGet("/assinatura", { on403: "silent" });
      setAssinatura(a?.assinatura || null);
    } catch {
      setAssinatura(null);
    }
  }

  useEffect(() => {
    const cached = readCache();
    const freshEnough = cached?.ts && Date.now() - cached.ts < CACHE_TTL_MS;

    if (cached?.turmas?.length) {
      setTurmas(ordenar(cached.turmas));
      setCarregando(false);
      setLive("Turmas do cache exibidas.");
    }
    // se o cache for velho, atualiza já; se for recente, atualiza silencioso
    fetchTurmas({ showSpinner: !freshEnough });

    const onVis = () => {
      if (document.hidden) return;
      const c = readCache();
      const tooOld = !c || !c.ts || Date.now() - c.ts > CACHE_TTL_MS;
      if (tooOld) fetchTurmas({ showSpinner: false });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------- APIs auxiliares --------- */
  const carregarPresencas = async (turmaIdRaw, { silent = false } = {}) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) return;

    try {
      const data = await apiGet(`/presencas/turma/${turmaId}/detalhes`, {
        on403: "silent",
      });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      const totalDias = datas.length || 0;

      const lista = usuarios.map((u) => {
        const pres = Array.isArray(u.presencas) ? u.presencas : [];
        const presentes = pres.filter((p) => p?.presente === true).length;
        const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
        const atingiu = freq >= 75;
        return {
          usuario_id: u.id,
          nome: u.nome,
          cpf: u.cpf,
          presente: atingiu,
          frequencia: `${freq}%`,
        };
      });

      setPresencasPorTurma((prev) => ({
        ...prev,
        [turmaId]: { detalhado: { datas, usuarios }, lista },
      }));
    } catch (err) {
      if (err?.status === 404) {
        if (!silent) toast.warn("Turma não encontrada ou sem dados de presença.");
      } else if (!silent) {
        toast.error("Erro ao carregar presenças da turma.");
      }
      setPresencasPorTurma((prev) => ({
        ...prev,
        [turmaId]: { detalhado: { datas: [], usuarios: [] }, lista: [] },
      }));
    }
  };

  const carregarInscritos = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }
    try {
      const data = await apiGet(`/inscricoes/turma/${turmaId}`, {
        on403: "silent",
      });
      setInscritosPorTurma((prev) => ({
        ...prev,
        [turmaId]: Array.isArray(data) ? data : [],
      }));
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
      const data = await apiGet(`/avaliacoes/turma/${turmaId}`, {
        on403: "silent",
      });
      const lista =
        Array.isArray(data) ? data :
        Array.isArray(data?.comentarios) ? data.comentarios :
        Array.isArray(data?.itens) ? data.itens :
        Array.isArray(data?.avaliacoes) ? data.avaliacoes : [];
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: lista }));
    } catch {
      toast.error("Erro ao carregar avaliações.");
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  };

  const hoje = todayYMD();
  const turmasFiltradas = turmas.filter((t) => {
    const di = ymd(t.data_inicio);
    const df = ymd(t.data_fim);
    if (!di || !df) return filtro === "todos";
    if (filtro === "programados") return di > hoje;
    if (filtro === "emAndamento") return di <= hoje && df >= hoje;
    if (filtro === "realizados") return df < hoje;
    return true;
  });

  const normDataItem = (d, turma) => ({
    data: ymd(d?.data) || ymd(d),
    horario_inicio:
      d?.horario_inicio?.slice?.(0, 5) || turma?.horario_inicio?.slice?.(0, 5) || "",
    horario_fim:
      d?.horario_fim?.slice?.(0, 5) || turma?.horario_fim?.slice?.(0, 5) || "",
  });

  const obterDatasReaisSemSequencial = async (turma, estados) => {
    const turmaId = turma?.id;
    if (!turmaId) return [];
    const cacheEstado = estados?.datasPorTurma?.[turmaId];
    if (Array.isArray(cacheEstado) && cacheEstado.length) {
      return cacheEstado.map((d) => normDataItem(d, turma)).filter((x) => x.data);
    }
    try {
      const lista = await apiGetTurmaDatasAuto(turmaId);
      if (Array.isArray(lista) && lista.length) {
        return lista.map((d) => normDataItem(d, turma)).filter((x) => x.data);
      }
    } catch {}
    const viaPres = estados?.presencasPorTurma?.[turmaId]?.detalhado?.datas;
    if (Array.isArray(viaPres) && viaPres.length) {
      return viaPres.map((d) => normDataItem(d, turma)).filter((x) => x.data);
    }
    const viaTurma = turma?.datas;
    if (Array.isArray(viaTurma) && viaTurma.length) {
      return viaTurma.map((d) => normDataItem(d, turma)).filter((x) => x.data);
    }
    return [];
  };

  const carregarDatasPorTurma = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) return;
    try {
      const lista = await apiGetTurmaDatasAuto(turmaId);
      const normalizada = Array.isArray(lista)
        ? lista
            .map((d) => ({
              data: ymd(d.data) || ymd(d),
              horario_inicio: d.horario_inicio?.slice?.(0, 5) || "",
              horario_fim: d.horario_fim?.slice?.(0, 5) || "",
            }))
            .filter((x) => x.data)
        : [];
      const cache = presencasPorTurma[turmaId]?.detalhado?.datas || [];
      const viaPresencas = Array.isArray(cache)
        ? cache
            .map((d) => ({
              data: ymd(d.data) || ymd(d),
              horario_inicio: d.horario_inicio?.slice?.(0, 5) || "",
              horario_fim: d.horario_fim?.slice?.(0, 5) || "",
            }))
            .filter((x) => x.data)
        : [];
      const finais = normalizada.length ? normalizada : viaPresencas;
      setDatasPorTurma((prev) => ({ ...prev, [turmaId]: finais }));
    } catch {
      setDatasPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  };

  /* --------- PDFs --------- */
  const gerarRelatorioPDF = async (turmaId) => {
    try {
      const [{ default: jsPDF }, auto] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = auto.default;

      const data = await apiGet(`/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      const totalDias = datas.length || 0;

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Presenças por Turma (Resumo)", 14, 20);

      const linhas = usuarios.map((u) => {
        const presentes = (u.presencas || []).filter((p) => p?.presente === true).length;
        const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
        const atingiu = freq >= 75 ? "✔️" : "❌";
        return [u.nome, formatarCPF(u.cpf), `${freq}%`, atingiu];
      });

      autoTable(doc, { startY: 30, head: [["Nome","CPF","Frequência","≥ 75%"]], body: linhas });
      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("✅ PDF de presença gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório em PDF.");
    }
  };

  const gerarListaAssinaturaPDF = async (turmaId) => {
    try {
      const [{ default: jsPDF }, auto] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = auto.default;

      const turma = turmas.find((t) => t.id === turmaId);
      let alunos = inscritosPorTurma[turmaId];
      if (!alunos) {
        alunos = await apiGet(`/inscricoes/turma/${turmaId}`, { on403: "silent" });
      }
      if (!turma || !alunos?.length) {
        toast.warning("⚠️ Nenhum inscrito encontrado para esta turma.");
        return;
      }

      const datasReais = await obterDatasReaisSemSequencial(turma, { datasPorTurma, presencasPorTurma });
      const doc = new jsPDF();
      datasReais.forEach((d, index) => {
        if (index > 0) doc.addPage();
        const dataFormatada = formatarDataBrasileira(d.data);
        const horaInicio = d.horario_inicio || turma.horario_inicio?.slice(0, 5) || "";
        const horaFim = d.horario_fim || turma.horario_fim?.slice(0, 5) || "";
        doc.setFontSize(14);
        doc.text(
          `Lista de Assinatura - ${turma.evento?.nome || turma.evento?.titulo || ""} - ${turma.nome || ""}`,
          14, 20
        );
        doc.text(`Data: ${dataFormatada} | Horário: ${horaInicio} às ${horaFim}`, 14, 28);
        autoTable(doc, {
          startY: 30,
          head: [["Nome", "CPF", "Assinatura"]],
          body: alunos.map((a) => [a.nome, formatarCPF(a.cpf), "______________________"]),
        });
      });
      doc.save(`lista_assinatura_turma_${turmaId}.pdf`);
      toast.success("📄 Lista de assinatura gerada!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar lista de assinatura.");
    }
  };

  const gerarQrCodePresencaPDF = async (turmaId, nomeEvento = "Evento") => {
    try {
      const [{ default: jsPDF }, { QRCodeCanvas }] = await Promise.all([
        import("jspdf"),
        import("qrcode.react"),
      ]);
      const { createRoot } = await import("react-dom/client");

      const turma = turmas.find((t) => t.id === turmaId);
      if (!turma) {
        toast.error("Turma não encontrada.");
        return;
      }
      const base =
        (typeof window !== "undefined" && window.location?.origin) ||
        "https://escoladasaude.vercel.app";
      const url = `${base.replace(/\/+$/, "")}/presenca?turma=${encodeURIComponent(turmaId)}`;

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-99999px";
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<QRCodeCanvas value={url} size={300} includeMargin />);
      await new Promise((r) => setTimeout(r, 60));
      const canvas = container.querySelector("canvas");
      const dataUrl = canvas?.toDataURL?.("image/png");
      root.unmount();
      container.remove();
      if (!dataUrl) {
        toast.error("Erro ao gerar imagem do QR Code.");
        return;
      }

      const doc = new jsPDF({ orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const centerX = pageW / 2;

      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(String(nomeEvento || turma?.nome || "Evento"), centerX, 30, { align: "center" });

      const nomeInstrutor = usuario?.nome || "Instrutor";
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text(`Instrutor: ${nomeInstrutor}`, centerX, 40, { align: "center" });

      const qrW = 110;
      doc.addImage(dataUrl, "PNG", centerX - qrW / 2, 50, qrW, qrW);
      doc.setFontSize(12);
      doc.setTextColor(60);
      doc.text("Escaneie este QR Code para confirmar sua presença", centerX, 50 + qrW + 14, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(url, centerX, 50 + qrW + 22, { align: "center" });

      doc.save(`qr_presenca_turma_${turmaId}.pdf`);
      toast.success("🔳 QR Code gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar QR Code.");
    }
  };

  /* -------------------------------- UI -------------------------------- */
  return (
    <>
      <HeaderHero
        nome={nome}
        carregando={carregando}
        onRefresh={() => fetchTurmas({ showSpinner: true })}
        onAbrirAssinatura={() => setModalAssinaturaAberto(true)}
        mostrarBotaoAssinatura={!assinatura}
        variant="indigo"
      />

      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="max-w-6xl mx-auto">
          {erro && <ErroCarregamento mensagem={erro} />}

          {/* Filtros */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-6 flex-wrap">
            {[
              ["todos", "Todos"],
              ["programados", "Programados"],
              ["emAndamento", "Em andamento"],
              ["realizados", "Realizados"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={`px-4 py-1 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lousa
                  ${filtro === key ? "bg-violet-800 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-white"}`}
                aria-pressed={filtro === key}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista de turmas */}
          {carregando && turmasFiltradas.length === 0 ? (
            <CarregandoSkeleton linhas={4} />
          ) : (
            <TurmasInstrutor
              turmas={turmasFiltradas}
              inscritosPorTurma={inscritosPorTurma}
              avaliacoesPorTurma={avaliacoesPorTurma}
              presencasPorTurma={presencasPorTurma}
              onVerInscritos={carregarInscritos}
              onVerAvaliacoes={carregarAvaliacoes}
              carregarPresencas={carregarPresencas}
              onExportarListaAssinaturaPDF={gerarListaAssinaturaPDF}
              onExportarQrCodePDF={gerarQrCodePresencaPDF}
              carregando={carregando}
              turmaExpandidaInscritos={turmaExpandidaInscritos}
              setTurmaExpandidaInscritos={setTurmaExpandidaInscritos}
              turmaExpandidaAvaliacoes={turmaExpandidaAvaliacoes}
              setTurmaExpandidaAvaliacoes={setTurmaExpandidaAvaliacoes}
              datasPorTurma={datasPorTurma}
              carregarDatasPorTurma={carregarDatasPorTurma}
            />
          )}

          <ModalAssinatura
            isOpen={modalAssinaturaAberto}
            onClose={() => setModalAssinaturaAberto(false)}
          />
        </div>
      </main>

      <Footer />
    </>
  );
}
