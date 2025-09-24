// ✅ src/pages/DashboardInstrutor.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import TurmasInstrutor from "../components/TurmasInstrutor";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ModalAssinatura from "../components/ModalAssinatura";
import Footer from "../components/Footer";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeCanvas } from "qrcode.react";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";
import { apiGet, apiGetTurmaDatasAuto } from "../services/api";
import { createRoot } from "react-dom/client";
import { RefreshCw, PenLine, Presentation } from "lucide-react";

/* ───────────────────────────── HeaderHero ───────────────────────────── */
function HeaderHero({
  nome = "",
  carregando = false,
  onRefresh,
  onAbrirAssinatura,
  mostrarBotaoAssinatura = false,
  variant = "indigo",
}) {
  const variants = {
    indigo:  "from-indigo-900 via-violet-800 to-fuchsia-700",
    emerald: "from-emerald-900 via-emerald-800 to-emerald-700",
    cyan:    "from-cyan-900 via-cyan-800 to-cyan-700",
    fuchsia: "from-fuchsia-900 via-fuchsia-800 to-fuchsia-700",
    amber:   "from-amber-900 via-amber-800 to-amber-700",
    slate:   "from-slate-900 via-slate-800 to-slate-700",
  };
  const grad = variants[variant] ?? variants.indigo;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Presentation className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Painel do Instrutor
          </h1>
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
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-green-600 hover:bg-green-700"} text-white`}
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
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600"
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

/* ----------------- debug ----------------- */
const dbg = (...args) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR) console.log("[DashInstrutor]", ...args);
};
const warn = (...args) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR) console.warn("[DashInstrutor]", ...args);
};
const groupC = (label, fn) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR && console.groupCollapsed) {
    console.groupCollapsed(label);
    try { fn?.(); } finally { console.groupEnd(); }
  } else {
    fn?.();
  }
};

/* ----------------- SW Cache (sessionStorage) ----------------- */
const CACHE_KEY = "cache:agenda_instrutor:v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.turmas) ? parsed : null;
  } catch { return null; }
}
function writeCache(turmas) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ turmas, ts: Date.now() })
    );
  } catch {}
}

/* ===================================================================== */

export default function DashboardInstrutor() {
  const liveRef = useRef(null);

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (e) {
    warn("Falha ao ler usuario do localStorage:", e);
  }
  const nome = usuario?.nome || "";

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
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [datasPorTurma, setDatasPorTurma] = useState({});

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  /* --------- carregamento com cache SWR --------- */
  const ordenar = (arr) => {
    return arr.slice().sort((a, b) => {
      const ad = toLocalNoon(ymd(a.data_inicio));
      const bd = toLocalNoon(ymd(b.data_inicio));
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return bd - ad;
    });
  };

  async function fetchTurmas({ showSpinner = true } = {}) {
    if (showSpinner) { setCarregando(true); setLive("Carregando suas turmas…"); }
    try {
      const data = await apiGet("/agenda/instrutor", { on403: "silent" });
      const arr = Array.isArray(data) ? data : [];
      const ordenadas = ordenar(arr);
      setTurmas(ordenadas);
      setErro("");
      writeCache(ordenadas);
      // pré-carrega presenças em segundo plano
      ordenadas.forEach((t) => t?.id && carregarPresencas(t.id));
    } catch (err) {
      const info = { name: err?.name, message: err?.message, status: err?.status, url: err?.url, data: err?.data };
      console.error("Erro ao carregar turmas:", info);
      setErro(err?.message || "Erro ao carregar suas turmas.");
      toast.error(`❌ ${err?.message || "Erro ao carregar suas turmas."}`);
    } finally {
      if (showSpinner) { setCarregando(false); setLive("Turmas atualizadas."); }
    }

    // assinatura (não cacheada)
    try {
      const a = await apiGet("/assinatura", { on403: "silent" });
      setAssinatura(a?.assinatura || null);
    } catch (e) {
      warn("Não foi possível carregar assinatura:", e?.message || e);
      setAssinatura(null);
    }
  }

  useEffect(() => {
    // 1) tenta cache
    const cached = readCache();
    if (cached?.turmas?.length) {
      setTurmas(ordenar(cached.turmas));
      setCarregando(false);
      setLive("Turmas do cache exibidas.");
    }
    // 2) revalida em background (sem bloquear)
    fetchTurmas({ showSpinner: !cached });

    // 3) revalidar quando a aba voltar ao foco e cache estiver velho
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

  /* --------- APIs auxiliares já existentes --------- */
  const carregarPresencas = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) return;

    try {
      const data = await apiGet(`/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      const totalDias = datas.length || 0;

      const lista = usuarios.map((u) => {
        const pres = Array.isArray(u.presencas) ? u.presencas : [];
        const presentes = pres.filter((p) => p?.presente === true).length;
        const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
        return { usuario_id: u.id, nome: u.nome, cpf: u.cpf, presente: freq >= 75, frequencia: `${freq}%` };
      });

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { detalhado: { datas, usuarios }, lista } }));
    } catch (err) {
      toast.error("Erro ao carregar presenças da turma.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { detalhado: { datas: [], usuarios: [] }, lista: [] } }));
    }
  };

  const carregarInscritos = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) { toast.error("Erro: Turma inválida."); return; }
    try {
      const data = await apiGet(`/inscricoes/turma/${turmaId}`, { on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch { toast.error("Erro ao carregar inscritos."); }
  };

  const carregarAvaliacoes = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) { toast.error("Erro: Turma inválida."); return; }
    if (avaliacoesPorTurma[turmaId]) return;
    try {
      const data = await apiGet(`/avaliacoes/turma/${turmaId}`, { on403: "silent" });
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
    horario_inicio: d?.horario_inicio?.slice?.(0,5) || turma?.horario_inicio?.slice?.(0,5) || "",
    horario_fim: d?.horario_fim?.slice?.(0,5) || turma?.horario_fim?.slice?.(0,5) || "",
  });

  const obterDatasReaisSemSequencial = async (turma, estados) => {
    const turmaId = turma?.id;
    if (!turmaId) return [];
    const cacheEstado = estados?.datasPorTurma?.[turmaId];
    if (Array.isArray(cacheEstado) && cacheEstado.length) {
      return cacheEstado.map(d => normDataItem(d, turma)).filter(x => x.data);
    }
    try {
      const lista = await apiGetTurmaDatasAuto(turmaId);
      if (Array.isArray(lista) && lista.length) {
        return lista.map(d => normDataItem(d, turma)).filter(x => x.data);
      }
    } catch {}
    const viaPres = estados?.presencasPorTurma?.[turmaId]?.detalhado?.datas;
    if (Array.isArray(viaPres) && viaPres.length) {
      return viaPres.map(d => normDataItem(d, turma)).filter(x => x.data);
    }
    const viaTurma = turma?.datas;
    if (Array.isArray(viaTurma) && viaTurma.length) {
      return viaTurma.map(d => normDataItem(d, turma)).filter(x => x.data);
    }
    return [];
  };

  const carregarDatasPorTurma = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) return;
    try {
      const lista = await apiGetTurmaDatasAuto(turmaId);
      const normalizada = Array.isArray(lista)
        ? lista.map((d) => ({
            data: ymd(d.data) || ymd(d),
            horario_inicio: d.horario_inicio?.slice?.(0, 5) || "",
            horario_fim: d.horario_fim?.slice?.(0, 5) || "",
          })).filter((x) => x.data)
        : [];
      const cache = presencasPorTurma[turmaId]?.detalhado?.datas || [];
      const viaPresencas = Array.isArray(cache)
        ? cache.map((d) => ({
            data: ymd(d.data) || ymd(d),
            horario_inicio: d.horario_inicio?.slice?.(0, 5) || "",
            horario_fim: d.horario_fim?.slice?.(0, 5) || "",
          })).filter((x) => x.data)
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
    } catch { toast.error("Erro ao gerar relatório em PDF."); }
  };

  const gerarListaAssinaturaPDF = async (turmaId) => {
    const turma = turmas.find((t) => t.id === turmaId);
    let alunos = inscritosPorTurma[turmaId];
    if (!alunos) {
      try { alunos = await apiGet(`/inscricoes/turma/${turmaId}`, { on403: "silent" }); }
      catch { toast.error("❌ Erro ao carregar inscritos."); return; }
    }
    if (!turma || !alunos?.length) { toast.warning("⚠️ Nenhum inscrito encontrado para esta turma."); return; }

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
      autoTable(doc, { startY: 30, head: [["Nome", "CPF", "Assinatura"]],
        body: alunos.map((a) => [a.nome, formatarCPF(a.cpf), "______________________"]) });
    });
    doc.save(`lista_assinatura_turma_${turmaId}.pdf`);
    toast.success("📄 Lista de assinatura gerada!");
  };

  const gerarQrCodePresencaPDF = async (turmaId, nomeEvento = "Evento") => {
    try {
      const turma = turmas.find((t) => t.id === turmaId);
      if (!turma) { toast.error("Turma não encontrada."); return; }
      const base = (typeof window !== "undefined" && window.location?.origin) || "https://escoladasaude.vercel.app";
      const url = `${base.replace(/\/+$/, "")}/presenca?turma=${encodeURIComponent(turmaId)}`;

      const container = document.createElement("div");
      container.style.position = "fixed"; container.style.left = "-99999px";
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<QRCodeCanvas value={url} size={300} includeMargin />);
      await new Promise((r) => setTimeout(r, 50));
      const canvas = container.querySelector("canvas");
      const dataUrl = canvas?.toDataURL?.("image/png");
      root.unmount(); container.remove();
      if (!dataUrl) { toast.error("Erro ao gerar imagem do QR Code."); return; }

      const doc = new jsPDF({ orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const centerX = pageW / 2;
      doc.setFontSize(24); doc.setFont("helvetica", "bold");
      doc.text(String(nomeEvento || turma?.nome || "Evento"), centerX, 30, { align: "center" });
      const nomeInstrutor = usuario?.nome || "Instrutor";
      doc.setFontSize(16); doc.setFont("helvetica", "normal");
      doc.text(`Instrutor: ${nomeInstrutor}`, centerX, 40, { align: "center" });
      const qrW = 110; doc.addImage(dataUrl, "PNG", centerX - qrW / 2, 50, qrW, qrW);
      doc.setFontSize(12); doc.setTextColor(60);
      doc.text("Escaneie este QR Code para confirmar sua presença", centerX, 50 + qrW + 14, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(100); doc.text(url, centerX, 50 + qrW + 22, { align: "center" });
      doc.save(`qr_presenca_turma_${turmaId}.pdf`);
      toast.success("🔳 QR Code gerado!");
    } catch { toast.error("Erro ao gerar QR Code."); }
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
        {/* live region para SR */}
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
          {carregando ? (
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
