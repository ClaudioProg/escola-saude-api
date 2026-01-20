// ✅ src/pages/InstrutorPresenca.jsx (premium + mobile-first + a11y + anti-fuso + resiliente)
/* eslint-disable no-console */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  RefreshCw,
  PenLine,
  Presentation,
  Filter,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";

import TurmasInstrutor from "../components/TurmasInstrutor";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ModalAssinatura from "../components/ModalAssinatura";
import Footer from "../components/Footer";

import { formatarCPF, formatarDataBrasileira } from "../utils/dateTime";
import { apiGet, apiGetTurmaDatasAuto } from "../services/api";

/* ───────────────────────────── HeaderHero (3 cores) ───────────────────────────── */
function HeaderHero({
  nome = "",
  carregando = false,
  onRefresh,
  onAbrirAssinatura,
  mostrarBotaoAssinatura = false,
  variant = "indigo",
  kpis,
}) {
  const variants = {
    indigo: "from-indigo-900 via-violet-800 to-fuchsia-700",
    emerald: "from-emerald-900 via-emerald-800 to-emerald-700",
    cyan: "from-cyan-900 via-cyan-800 to-cyan-700",
  };
  const grad = variants[variant] ?? variants.indigo;

  return (
    <header className={`relative bg-gradient-to-br ${grad} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 62%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-9 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Presentation className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Presenças do Instrutor
          </h1>
        </div>

        <p className="text-sm text-white/90 max-w-2xl">
          {nome ? (
            <>
              Bem-vindo(a), <strong>{nome}</strong>. Gerencie turmas, listas e relatórios.
            </>
          ) : (
            "Gerencie suas turmas, presenças e relatórios."
          )}
        </p>

        {/* ministats */}
        <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
          <MiniStatHero icon={Sparkles} label="Total" value={kpis?.total ?? 0} />
          <MiniStatHero icon={CalendarClock} label="Programadas" value={kpis?.programadas ?? 0} />
          <MiniStatHero icon={CalendarCheck2} label="Em andamento" value={kpis?.andamento ?? 0} />
          <MiniStatHero icon={CalendarDays} label="Realizadas" value={kpis?.realizadas ?? 0} />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition border border-white/20
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
            aria-label="Atualizar painel do instrutor"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} aria-hidden="true" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>

          {/* status assinatura */}
          {mostrarBotaoAssinatura ? (
            <>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/95 text-amber-900 border border-amber-300 shadow-sm">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Sem assinatura cadastrada
              </span>

              <button
                type="button"
                onClick={onAbrirAssinatura}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-amber-500 text-white hover:bg-amber-600
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                aria-label="Cadastrar ou alterar assinatura"
                title="Cadastrar/Alterar Assinatura"
              >
                <PenLine className="w-4 h-4" aria-hidden="true" />
                Assinatura
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/95 text-emerald-900 border border-emerald-300 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Assinatura cadastrada
            </span>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-white/20" aria-hidden="true" />
    </header>
  );
}

function MiniStatHero({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2 text-left shadow-sm">
      <div className="flex items-center gap-2 text-white/90">
        <span className="inline-flex w-8 h-8 rounded-xl bg-white/10 items-center justify-center">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] text-white/80 font-extrabold uppercase tracking-wide">
            {label}
          </div>
          <div className="text-xl font-extrabold tracking-tight">{Number(value) || 0}</div>
        </div>
      </div>
    </div>
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

/* ----------------- Cache (sessionStorage) ----------------- */
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

/* ----------------- Timeout + Abort ----------------- */
const FETCH_TIMEOUT_MS = 15000;
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

  const data_inicio = ymd(t.data_inicio || t.dataInicio || t.inicio || t.data) || null;
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

  const datas = Array.isArray(t.datas)
    ? t.datas
    : Array.isArray(t.encontros)
    ? t.encontros
    : t.datas_turma || [];

  return { ...t, data_inicio, data_fim, evento, horario_inicio, horario_fim, datas };
}

function statusTurma(di, df, hojeYmd) {
  const ini = ymd(di);
  const fim = ymd(df);
  if (!ini || !fim) return "todos";
  if (ini > hojeYmd) return "programados";
  if (ini <= hojeYmd && fim >= hojeYmd) return "emAndamento";
  if (fim < hojeYmd) return "realizados";
  return "todos";
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
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [turmaExpandidaInscritos, setTurmaExpandidaInscritos] = useState(null);
  const [turmaExpandidaAvaliacao, setTurmaExpandidaAvaliacao] = useState(null);

  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinatura, setAssinatura] = useState(null);

  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [datasPorTurma, setDatasPorTurma] = useState({});

  const inFlightRef = useRef(0);
  const abortRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

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

  const ordenar = useCallback((arr) => {
    return arr
      .slice()
      .sort((a, b) => {
        const ad = toLocalNoon(ymd(a.data_inicio));
        const bd = toLocalNoon(ymd(b.data_inicio));
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return bd - ad; // mais recentes primeiro
      });
  }, []);

  const carregarPresencas = useCallback(async (turmaIdRaw, { silent = false } = {}) => {
    const turmaId = parseInt(turmaIdRaw, 10);
    if (!turmaId || Number.isNaN(turmaId)) return;

    try {
      const data = await apiGet(`/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
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
  }, []);

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

      // se seu apiGet NÃO aceitar "signal", ele vai ignorar — ok.
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
        normalizadas.filter((t) => t?.id).map((t) => carregarPresencas(t.id, { silent: true }))
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
  const carregarInscritos = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw, 10);
    if (!turmaId || Number.isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }
    try {
      const data = await apiGet(`/inscricao/turma/${turmaId}`, { on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch {
      toast.error("Erro ao carregar inscritos.");
    }
  };

  const carregarAvaliacao = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw, 10);
    if (!turmaId || Number.isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }
    if (avaliacaoPorTurma[turmaId]) return;
    try {
      const data = await apiGet(`/avaliacao/turma/${turmaId}`, { on403: "silent" });
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.comentarios)
        ? data.comentarios
        : Array.isArray(data?.itens)
        ? data.itens
        : Array.isArray(data?.avaliacao)
        ? data.avaliacao
        : [];
      setAvaliacaoPorTurma((prev) => ({ ...prev, [turmaId]: lista }));
    } catch {
      toast.error("Erro ao carregar avaliações.");
      setAvaliacaoPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  };

  const hoje = todayYMD();

  const turmasComStatus = useMemo(() => {
    return (turmas || []).map((t) => ({
      ...t,
      _statusUI: statusTurma(t.data_inicio, t.data_fim, hoje),
    }));
  }, [turmas, hoje]);

  const turmasFiltradas = useMemo(() => {
    return turmasComStatus.filter((t) => (filtro === "todos" ? true : t._statusUI === filtro));
  }, [turmasComStatus, filtro]);

  const kpis = useMemo(() => {
    const total = turmasComStatus.length;
    const programadas = turmasComStatus.filter((t) => t._statusUI === "programados").length;
    const andamento = turmasComStatus.filter((t) => t._statusUI === "emAndamento").length;
    const realizadas = turmasComStatus.filter((t) => t._statusUI === "realizados").length;
    return { total, programadas, andamento, realizadas };
  }, [turmasComStatus]);

  const normDataItem = (d, turma) => ({
    data: ymd(d?.data) || ymd(d),
    horario_inicio: d?.horario_inicio?.slice?.(0, 5) || turma?.horario_inicio?.slice?.(0, 5) || "",
    horario_fim: d?.horario_fim?.slice?.(0, 5) || turma?.horario_fim?.slice?.(0, 5) || "",
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
    const turmaId = parseInt(turmaIdRaw, 10);
    if (!turmaId || Number.isNaN(turmaId)) return;

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
      const [{ default: jsPDF }, auto] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
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

      autoTable(doc, { startY: 30, head: [["Nome", "CPF", "Frequência", "≥ 75%"]], body: linhas });
      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("✅ PDF de presença gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório em PDF.");
    }
  };

  const gerarListaAssinaturaPDF = async (turmaId) => {
    try {
      const [{ default: jsPDF }, auto] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = auto.default;

      const turma = turmas.find((t) => t.id === turmaId);
      let alunos = inscritosPorTurma[turmaId];
      if (!alunos) {
        alunos = await apiGet(`/inscricao/turma/${turmaId}`, { on403: "silent" });
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
          14,
          20
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
      const [{ default: jsPDF }, { QRCodeCanvas }] = await Promise.all([import("jspdf"), import("qrcode.react")]);
      const { createRoot } = await import("react-dom/client");

      const turma = turmas.find((t) => t.id === turmaId);
      if (!turma) {
        toast.error("Turma não encontrada.");
        return;
      }

      const base = (typeof window !== "undefined" && window.location?.origin) || "https://escoladasaude.vercel.app";
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
      doc.text(
        "Faça o Login na Plataforma e após, Escaneie este QR Code para confirmar sua presença",
        centerX,
        50 + qrW + 14,
        { align: "center" }
      );
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
        kpis={kpis}
      />

      <main id="conteudo" className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* barra sticky de filtros (premium) */}
        <section
          aria-label="Filtros de turmas"
          className="sticky top-2 z-30 max-w-6xl mx-auto mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Filtrar:</span>
              <div className="flex flex-wrap gap-2">
                <ChipFiltro
                  active={filtro === "todos"}
                  onClick={() => setFiltro("todos")}
                  label="Todos"
                  count={kpis.total}
                />
                <ChipFiltro
                  active={filtro === "programados"}
                  onClick={() => setFiltro("programados")}
                  label="Programadas"
                  count={kpis.programadas}
                />
                <ChipFiltro
                  active={filtro === "emAndamento"}
                  onClick={() => setFiltro("emAndamento")}
                  label="Em andamento"
                  count={kpis.andamento}
                />
                <ChipFiltro
                  active={filtro === "realizados"}
                  onClick={() => setFiltro("realizados")}
                  label="Realizadas"
                  count={kpis.realizadas}
                />
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              Exibindo <strong>{turmasFiltradas.length}</strong> turma(s)
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto">
          {erro && <ErroCarregamento mensagem={erro} />}

          {/* Lista de turmas */}
          {carregando && turmasFiltradas.length === 0 ? (
            <CarregandoSkeleton linhas={4} />
          ) : (
            <TurmasInstrutor
              turmas={turmasFiltradas}
              inscritosPorTurma={inscritosPorTurma}
              avaliacaoPorTurma={avaliacaoPorTurma}
              presencasPorTurma={presencasPorTurma}
              onVerInscritos={carregarInscritos}
              onVerAvaliacao={carregarAvaliacao}
              carregarPresencas={carregarPresencas}
              gerarRelatorioPDF={gerarRelatorioPDF}
              onExportarListaAssinaturaPDF={gerarListaAssinaturaPDF}
              onExportarQrCodePDF={gerarQrCodePresencaPDF}
              carregando={carregando}
              turmaExpandidaInscritos={turmaExpandidaInscritos}
              setTurmaExpandidaInscritos={setTurmaExpandidaInscritos}
              turmaExpandidaAvaliacao={turmaExpandidaAvaliacao}
              setTurmaExpandidaAvaliacao={setTurmaExpandidaAvaliacao}
              datasPorTurma={datasPorTurma}
              carregarDatasPorTurma={carregarDatasPorTurma}
            />
          )}

          <ModalAssinatura isOpen={modalAssinaturaAberto} onClose={() => setModalAssinaturaAberto(false)} />
        </div>
      </main>

      <Footer />
    </>
  );
}

function ChipFiltro({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-violet-800 text-white"
          : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-[11px]",
          active ? "bg-white/20 text-white" : "bg-white/70 text-zinc-700 dark:bg-white/10 dark:text-zinc-200",
        ].join(" ")}
      >
        {Number(count) || 0}
      </span>
    </button>
  );
}
