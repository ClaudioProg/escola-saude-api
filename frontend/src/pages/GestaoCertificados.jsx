// ✅ frontend/src/pages/GestaoCertificados.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  FilePlus2,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import ModalConfirmacao from "../components/ui/ModalConfirmacao";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";
import { api } from "../services/api";
import { downloadBlob } from "../utils/downloadArquivo";
import { formatDateBr, extractYmd } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.certificado.adminArvore(params?)
 * api.certificado.processarPendentesPorTurma(turma_id)
 * api.certificado.download(certificado_id)
 */

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function extrairData(response) {
  return response?.data ?? response ?? null;
}

function obterMensagemErro(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function validarFacade(nome, fn) {
  if (typeof fn !== "function") {
    throw new Error(`Facade ausente no api.js: ${nome}.`);
  }
}

function ymd(value) {
  const iso = formatarParaISO(value);
  return iso || "";
}

function dataBR(value) {
  const iso = extractYmd(value);

  return iso ? formatDateBr(iso) : "—";
}

function hojeYMD() {
  const date = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(value) {
  const nome = String(value || "certificado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return nome || "certificado";
}

function inferirStatusTurma(turma) {
  const status = String(turma?.status || "").toLowerCase();

  if (["programado", "andamento", "encerrado"].includes(status)) {
    return status;
  }

  const inicio = ymd(turma?.data_inicio);
  const fim = ymd(turma?.data_fim);
  const hoje = hojeYMD();

  if (inicio && hoje < inicio) return "programado";
  if (inicio && fim && hoje >= inicio && hoje <= fim) return "andamento";
  if (fim && hoje > fim) return "encerrado";

  return "programado";
}

function inferirStatusEvento(evento) {
  const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

  if (turmas.some((turma) => inferirStatusTurma(turma) === "andamento")) {
    return "andamento";
  }

  if (turmas.some((turma) => inferirStatusTurma(turma) === "programado")) {
    return "programado";
  }

  return "encerrado";
}

function statusTone(status) {
  if (status === "programado") return "emerald";
  if (status === "andamento") return "amber";
  if (status === "encerrado") return "rose";
  return "slate";
}

function statusLabel(status) {
  if (status === "programado") return "Programado";
  if (status === "andamento") return "Em andamento";
  if (status === "encerrado") return "Encerrado";
  return "Indefinido";
}

function statusBarClass(status) {
  if (status === "programado") {
    return "from-emerald-700 via-emerald-500 to-emerald-400";
  }

  if (status === "andamento") {
    return "from-amber-700 via-orange-500 to-yellow-400";
  }

  if (status === "encerrado") {
    return "from-rose-800 via-rose-600 to-orange-500";
  }

  return "from-slate-700 via-slate-600 to-slate-500";
}

function periodoTurma(turma) {
  const inicio = dataBR(turma?.data_inicio);
  const fim = dataBR(turma?.data_fim || turma?.data_inicio);

  return `${inicio} até ${fim}`;
}

function getEventoTitulo(evento) {
  return evento?.evento_titulo || evento?.titulo || "Evento";
}

function getTurmaTitulo(turma) {
  return turma?.turma_nome || turma?.nome || `Turma #${turma?.turma_id || "—"}`;
}

function getNumeroCertificado(participante) {
  return participante?.numero_certificado || participante?.numero || "";
}

function getNumeroCertificadoLabel(participante) {
  return getNumeroCertificado(participante) || "Número não informado";
}

function participanteTemCertificado(participante) {
  return Boolean(
    participante?.emitido &&
      participante?.certificado_id &&
      (!participante?.status || ["emitido", "enviado"].includes(participante.status))
  );
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function Badge({ tone = "slate", children }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    emerald:
      "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    amber:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    rose:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    cyan:
      "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/60",
    violet:
      "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/60",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-white/10 text-white ring-white/15",
    emerald: "bg-emerald-400/15 text-emerald-50 ring-emerald-300/20",
    amber: "bg-amber-400/15 text-amber-50 ring-amber-300/20",
    rose: "bg-rose-400/15 text-rose-50 ring-rose-300/20",
    cyan: "bg-cyan-400/15 text-cyan-50 ring-cyan-300/20",
  };

  return (
    <div className={cx("rounded-3xl p-4 ring-1 backdrop-blur", tones[tone])}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide opacity-80">
            {label}
          </p>
          <p className="text-2xl font-black leading-none">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Hero({ kpis, loading, onRefresh }) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-amber-950 to-rose-800 text-white">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-400 blur-3xl" />
        <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-rose-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500 blur-3xl" />
      </div>

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-950"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20 backdrop-blur">
              <Award className="h-4 w-4" aria-hidden="true" />
              Gestão administrativa
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Gestão de certificados
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Acompanhe certificados por evento e turma, baixe documentos
              emitidos e processe apenas certificados pendentes. Certificados
              já emitidos são preservados como documentos eletrônicos oficiais.
            </p>
          </div>

          <div className="flex shrink-0">
            <Botao
              type="button"
              variant="secondary"
              onClick={onRefresh}
              disabled={loading}
              className="bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw
                  className={cx("h-4 w-4", loading && "animate-spin")}
                  aria-hidden="true"
                />
                {loading ? "Atualizando..." : "Atualizar"}
              </span>
            </Botao>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat
            icon={Users}
            label="Presentes"
            value={kpis.presentes}
            tone="cyan"
          />
          <MiniStat
            icon={FileCheck2}
            label="Emitidos"
            value={kpis.emitidos}
            tone="emerald"
          />
          <MiniStat
            icon={Sparkles}
            label="Pendentes"
            value={kpis.pendentes}
            tone="amber"
          />
        </div>

        <div className="mt-5 rounded-3xl bg-white/10 p-4 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              Os certificados v2.0 possuem número oficial, código único, QR Code
              de validação pública, status oficial e histórico de ações
              administrativas. Não há reset de certificados emitidos.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function Toolbar({
  busca,
  setBusca,
  filtroStatus,
  setFiltroStatus,
  filtroPendencia,
  setFiltroPendencia,
  loading,
  onRefresh,
}) {
  return (
    <section
      aria-label="Filtros de gestão de certificados"
      className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por evento, turma, participante, número ou código..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            aria-label="Buscar certificados"
          />

          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros:
          </span>

          <select
            value={filtroStatus}
            onChange={(event) => setFiltroStatus(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-amber-950"
            aria-label="Filtrar por status da turma"
          >
            <option value="todos">Todos os status</option>
            <option value="programado">Programados</option>
            <option value="andamento">Em andamento</option>
            <option value="encerrado">Encerrados</option>
          </select>

          <select
            value={filtroPendencia}
            onChange={(event) => setFiltroPendencia(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-amber-950"
            aria-label="Filtrar pendências"
          >
            <option value="todos">Todos</option>
            <option value="pendentes">Com pendências</option>
            <option value="emitidos">Tudo emitido</option>
          </select>

          <Botao
            type="button"
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCcw
                className={cx("h-4 w-4", loading && "animate-spin")}
                aria-hidden="true"
              />
              Recarregar
            </span>
          </Botao>
        </div>
      </div>
    </section>
  );
}

function ToggleButton({ open, children, onClick, controls }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-0 items-center gap-2 text-left font-black text-slate-950 transition hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-white dark:hover:text-amber-200"
      aria-expanded={open}
      aria-controls={controls}
    >
      {open ? (
        <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}

function ParticipanteCard({ participante, onDownload, baixando }) {
  const hasCertificado = participanteTemCertificado(participante);
  const numeroCertificado = getNumeroCertificado(participante);

  return (
    <article className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-slate-950 dark:text-white">
            {participante?.nome || "Participante"}
          </p>

          <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-zinc-400">
            {participante?.email || "E-mail não informado"}
          </p>

          {hasCertificado ? (
            <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/60">
              Certificado nº:{" "}
              <span className="font-black">
                {numeroCertificado || getNumeroCertificadoLabel(participante)}
              </span>
            </p>
          ) : null}

          {participante?.codigo_validacao ? (
            <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
              Código:{" "}
              <span className="font-black">{participante.codigo_validacao}</span>
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Badge tone={hasCertificado ? "emerald" : "amber"}>
            {hasCertificado ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {hasCertificado ? "Emitido" : "Pendente"}
          </Badge>

          {hasCertificado ? (
            <Botao
              type="button"
              variant="secondary"
              onClick={() => onDownload(participante)}
              disabled={baixando}
            >
              <span className="inline-flex items-center gap-2">
                {baixando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {baixando ? "Baixando..." : "Baixar"}
              </span>
            </Botao>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────── */

export default function GestaoCertificados() {
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPendencia, setFiltroPendencia] = useState("todos");

  const [openEventos, setOpenEventos] = useState({});
  const [openTurmas, setOpenTurmas] = useState({});

  const [confirmProcessar, setConfirmProcessar] = useState(null);
  const [executandoProcessamento, setExecutandoProcessamento] = useState(false);
  const [baixandoId, setBaixandoId] = useState(null);

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const carregarArvore = useCallback(async () => {
    try {
      validarFacade("api.certificado.adminArvore", api?.certificado?.adminArvore);

      setLoading(true);
      setErro("");
      setLive("Carregando árvore de certificados.");

      const response = await api.certificado.adminArvore();
      const payload = extrairData(response);
      const lista = Array.isArray(payload) ? payload : [];

      if (!mountedRef.current) return;

      setData(lista);
      setLive(
        lista.length
          ? `${lista.length} evento(s) carregado(s).`
          : "Nenhum evento encontrado."
      );
    } catch (error) {
      console.error("[GestaoCertificados] erro ao carregar árvore:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Não foi possível carregar a gestão de certificados."
      );

      setErro(message);
      setData([]);
      notifyError(message);
      setLive("Erro ao carregar árvore de certificados.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [setLive]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Gestão de Certificados | Escola da Saúde";
    carregarArvore();

    return () => {
      mountedRef.current = false;
    };
  }, [carregarArvore]);

  const kpis = useMemo(() => {
    let presentes = 0;
    let emitidos = 0;
    let pendentes = 0;

    for (const evento of data) {
      for (const turma of evento?.turmas || []) {
        presentes += Number(turma?.totais?.presentes || 0);
        emitidos += Number(turma?.totais?.emitidos || 0);
        pendentes += Number(turma?.totais?.pendentes || 0);
      }
    }

    return { presentes, emitidos, pendentes };
  }, [data]);

  const dataFiltrada = useMemo(() => {
    const termo = normalizarBusca(busca);

    const eventos = [];

    for (const evento of data) {
      const eventoTitulo = getEventoTitulo(evento);
      const statusEvento = inferirStatusEvento(evento);

      if (filtroStatus !== "todos" && statusEvento !== filtroStatus) {
        continue;
      }

      const turmas = [];

      for (const turma of evento?.turmas || []) {
        const statusTurma = inferirStatusTurma(turma);
        const pendentes = Number(turma?.totais?.pendentes || 0);
        const emitidos = Number(turma?.totais?.emitidos || 0);
        const presentes = Number(turma?.totais?.presentes || 0);

        if (filtroPendencia === "pendentes" && pendentes <= 0) {
          continue;
        }

        if (
          filtroPendencia === "emitidos" &&
          !(presentes > 0 && emitidos >= presentes)
        ) {
          continue;
        }

        const participantes = Array.isArray(turma?.participantes)
          ? turma.participantes
          : [];

        const textoTurma = normalizarBusca(
          `${eventoTitulo} ${getTurmaTitulo(turma)} ${turma?.turma_id || ""}`
        );

        const participantesFiltrados = termo
          ? participantes.filter((participante) => {
              const textoParticipante = normalizarBusca(
                [
                  participante?.nome,
                  participante?.email,
                  participante?.numero_certificado,
                  participante?.codigo_validacao,
                ].join(" ")
              );

              return textoParticipante.includes(termo);
            })
          : participantes;

        const turmaCombina = !termo || textoTurma.includes(termo);

        if (!turmaCombina && participantesFiltrados.length === 0) {
          continue;
        }

        turmas.push({
          ...turma,
          status_calculado: statusTurma,
          participantes: turmaCombina ? participantes : participantesFiltrados,
        });
      }

      if (turmas.length > 0) {
        eventos.push({
          ...evento,
          status_calculado: statusEvento,
          turmas,
        });
      }
    }

    return eventos;
  }, [data, busca, filtroStatus, filtroPendencia]);

  const toggleEvento = useCallback((eventoId) => {
    setOpenEventos((prev) => ({
      ...prev,
      [eventoId]: !prev[eventoId],
    }));
  }, []);

  const toggleTurma = useCallback((eventoId, turmaId) => {
    const key = `${eventoId}:${turmaId}`;

    setOpenTurmas((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const pedirProcessamentoPendentes = useCallback((turma) => {
    const turmaId = Number(turma?.turma_id);

    if (!Number.isInteger(turmaId) || turmaId <= 0) {
      notifyWarning("Turma inválida para processamento.");
      return;
    }

    const pendentes = Number(turma?.totais?.pendentes || 0);

    if (pendentes <= 0) {
      notifyWarning("Esta turma não possui certificados pendentes para processar.");
      return;
    }

    setConfirmProcessar({
      turma_id: turmaId,
      turma_nome: getTurmaTitulo(turma),
      totais: turma?.totais || null,
    });
  }, []);

  const confirmarProcessamentoPendentes = useCallback(async () => {
    if (!confirmProcessar?.turma_id) return;

    try {
      validarFacade(
        "api.certificado.processarPendentesPorTurma",
        api?.certificado?.processarPendentesPorTurma
      );

      const turmaId = Number(confirmProcessar.turma_id);

      setExecutandoProcessamento(true);
      setLive(`Processando certificados pendentes da turma ${turmaId}.`);

      await api.certificado.processarPendentesPorTurma(turmaId);

      notifySuccess("Certificados pendentes processados com sucesso.");
      setConfirmProcessar(null);
      await carregarArvore();
      setLive("Processamento de pendentes concluído.");
    } catch (error) {
      console.error("[GestaoCertificados] erro ao processar pendentes:", error);

      notifyError(
        obterMensagemErro(
          error,
          "Não foi possível processar os certificados pendentes da turma."
        )
      );
      setLive("Erro ao processar certificados pendentes.");
    } finally {
      setExecutandoProcessamento(false);
    }
  }, [confirmProcessar, carregarArvore, setLive]);

  const baixarCertificado = useCallback(
    async (participante) => {
      const certificadoId = Number(participante?.certificado_id);

      if (!Number.isInteger(certificadoId) || certificadoId <= 0) {
        notifyWarning("Certificado sem ID para download.");
        return;
      }

      try {
        validarFacade("api.certificado.download", api?.certificado?.download);

        setBaixandoId(certificadoId);
        setLive("Baixando certificado.");

        const result = await api.certificado.download(certificadoId);
        const blob = result?.blob || result?.data || result;
        const filename =
          result?.filename ||
          `${nomeArquivoSeguro(
            getNumeroCertificado(participante) ||
              `certificado_${participante?.nome || certificadoId}_${certificadoId}`
          )}.pdf`;

        downloadBlob(filename, blob);
        notifySuccess("Download iniciado.");
      } catch (error) {
        console.error("[GestaoCertificados] erro ao baixar:", error);

        notifyError(
          obterMensagemErro(error, "Não foi possível baixar o certificado.")
        );
        setLive("Erro ao baixar certificado.");
      } finally {
        setBaixandoId(null);
      }
    },
    [setLive]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <Hero kpis={kpis} loading={loading} onRefresh={carregarArvore} />

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <ModalConfirmacao
        open={Boolean(confirmProcessar)}
        onClose={() => {
          if (!executandoProcessamento) setConfirmProcessar(null);
        }}
        onConfirm={confirmarProcessamentoPendentes}
        titulo="Processar certificados pendentes"
        confirmarTexto={
          executandoProcessamento ? "Processando..." : "Processar pendentes"
        }
        cancelarTexto="Cancelar"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-zinc-300">
            Esta ação emitirá apenas certificados ainda pendentes desta turma.
            Certificados já emitidos/enviados serão preservados e não serão
            resetados, sobrescritos ou apagados.
          </p>

          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
            <p className="font-black">
              {confirmProcessar?.turma_nome ||
                `Turma #${confirmProcessar?.turma_id || "—"}`}
            </p>

            {confirmProcessar?.totais ? (
              <p className="mt-1 text-xs">
                Emitidos: {confirmProcessar.totais.emitidos || 0} • Pendentes:{" "}
                {confirmProcessar.totais.pendentes || 0}
              </p>
            ) : null}
          </div>

          {executandoProcessamento ? (
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Processando pendentes...
            </p>
          ) : null}
        </div>
      </ModalConfirmacao>

      {loading ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-amber-100 dark:bg-amber-950"
          role="progressbar"
          aria-label="Carregando gestão de certificados"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-amber-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <Toolbar
          busca={busca}
          setBusca={setBusca}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          filtroPendencia={filtroPendencia}
          setFiltroPendencia={setFiltroPendencia}
          loading={loading}
          onRefresh={carregarArvore}
        />

        {loading ? (
          <section className="grid gap-4" aria-label="Carregando árvore">
            <CarregandoSkeleton height={160} />
            <CarregandoSkeleton height={160} />
            <CarregandoSkeleton height={160} />
          </section>
        ) : erro ? (
          <ErroCarregamento mensagem={erro} onRetry={carregarArvore} />
        ) : data.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum evento encontrado"
            descricao="Quando houver eventos com certificados disponíveis para gestão, eles aparecerão aqui."
          />
        ) : dataFiltrada.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum resultado encontrado"
            descricao="Altere os filtros ou limpe a busca para visualizar mais certificados."
          />
        ) : (
          <section aria-labelledby="titulo-arvore-certificados">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="titulo-arvore-certificados"
                  className="text-lg font-black text-slate-950 dark:text-white"
                >
                  Certificados por evento e turma
                </h2>

                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Exibindo {dataFiltrada.length} evento(s) conforme os filtros.
                </p>
              </div>

              <Badge tone="amber">
                <Sparkles className="h-3.5 w-3.5" />
                Gestão documental v2.0
              </Badge>
            </div>

            <div className="grid gap-4">
              <AnimatePresence initial={false}>
                {dataFiltrada.map((evento) => {
                  const eventoId = evento.evento_id;
                  const eventoOpen = Boolean(openEventos[eventoId]);
                  const eventoPanelId = `evento-certificados-${eventoId}`;
                  const statusEvento =
                    evento.status_calculado || inferirStatusEvento(evento);

                  return (
                    <motion.article
                      key={eventoId}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
                    >
                      <div
                        className={cx(
                          "h-2 bg-gradient-to-r",
                          statusBarClass(statusEvento)
                        )}
                        aria-hidden="true"
                      />

                      <header className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <ToggleButton
                            open={eventoOpen}
                            controls={eventoPanelId}
                            onClick={() => toggleEvento(eventoId)}
                          >
                            {getEventoTitulo(evento)}
                          </ToggleButton>

                          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                            {(evento?.turmas || []).length} turma(s)
                          </p>
                        </div>

                        <Badge tone={statusTone(statusEvento)}>
                          {statusLabel(statusEvento)}
                        </Badge>
                      </header>

                      {eventoOpen ? (
                        <div
                          id={eventoPanelId}
                          className="border-t border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                        >
                          <div className="grid gap-3">
                            {(evento.turmas || []).map((turma) => {
                              const turmaKey = `${eventoId}:${turma.turma_id}`;
                              const turmaOpen = Boolean(openTurmas[turmaKey]);
                              const turmaPanelId = `turma-certificados-${eventoId}-${turma.turma_id}`;
                              const statusTurma =
                                turma.status_calculado || inferirStatusTurma(turma);
                              const participantes = Array.isArray(turma?.participantes)
                                ? turma.participantes
                                : [];
                              const pendentes = Number(turma?.totais?.pendentes || 0);

                              return (
                                <article
                                  key={turmaKey}
                                  className="overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
                                >
                                  <div
                                    className={cx(
                                      "h-1.5 bg-gradient-to-r",
                                      statusBarClass(statusTurma)
                                    )}
                                    aria-hidden="true"
                                  />

                                  <header className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <ToggleButton
                                        open={turmaOpen}
                                        controls={turmaPanelId}
                                        onClick={() =>
                                          toggleTurma(eventoId, turma.turma_id)
                                        }
                                      >
                                        {getTurmaTitulo(turma)}
                                      </ToggleButton>

                                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                        <CalendarDays
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                        {periodoTurma(turma)}
                                      </p>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Badge tone="cyan">
                                          Presentes:{" "}
                                          <strong>{turma?.totais?.presentes || 0}</strong>
                                        </Badge>
                                        <Badge tone="emerald">
                                          Emitidos:{" "}
                                          <strong>{turma?.totais?.emitidos || 0}</strong>
                                        </Badge>
                                        <Badge tone="amber">
                                          Pendentes:{" "}
                                          <strong>{turma?.totais?.pendentes || 0}</strong>
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge tone={statusTone(statusTurma)}>
                                        {statusLabel(statusTurma)}
                                      </Badge>

                                      <Botao
                                        type="button"
                                        variant="primary"
                                        onClick={() =>
                                          pedirProcessamentoPendentes(turma)
                                        }
                                        disabled={pendentes <= 0}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <FilePlus2
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                          />
                                          Processar pendentes
                                        </span>
                                      </Botao>
                                    </div>
                                  </header>

                                  {turmaOpen ? (
                                    <div
                                      id={turmaPanelId}
                                      className="border-t border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
                                    >
                                      {participantes.length === 0 ? (
                                        <NadaEncontrado
                                          titulo="Sem participantes presentes"
                                          descricao="Não há participantes presentes para emissão nesta turma."
                                        />
                                      ) : (
                                        <>
                                          <div className="hidden overflow-x-auto sm:block">
                                            <table className="min-w-full text-sm">
                                              <thead>
                                                <tr className="text-left text-slate-500 dark:text-zinc-400">
                                                  <th className="px-3 py-2 font-black">
                                                    Participante
                                                  </th>
                                                  <th className="px-3 py-2 font-black">
                                                    E-mail
                                                  </th>
                                                  <th className="px-3 py-2 font-black">
                                                    Status
                                                  </th>
                                                  <th className="px-3 py-2 font-black">
                                                    Número
                                                  </th>
                                                  <th className="px-3 py-2 font-black">
                                                    Código
                                                  </th>
                                                  <th className="px-3 py-2 text-right font-black">
                                                    Ações
                                                  </th>
                                                </tr>
                                              </thead>

                                              <tbody>
                                                {participantes.map((participante) => {
                                                  const hasCertificado =
                                                    participanteTemCertificado(participante);
                                                  const baixando =
                                                    baixandoId ===
                                                    Number(participante.certificado_id);

                                                  return (
                                                    <tr
                                                      key={`${turmaKey}-${participante.usuario_id}`}
                                                      className="border-t border-slate-200 dark:border-zinc-800"
                                                    >
                                                      <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                                                        {participante?.nome || "—"}
                                                      </td>

                                                      <td className="px-3 py-3 text-slate-600 dark:text-zinc-300">
                                                        {participante?.email || "—"}
                                                      </td>

                                                      <td className="px-3 py-3">
                                                        <Badge
                                                          tone={
                                                            hasCertificado
                                                              ? "emerald"
                                                              : "amber"
                                                          }
                                                        >
                                                          {hasCertificado ? (
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                          ) : (
                                                            <AlertTriangle className="h-3.5 w-3.5" />
                                                          )}
                                                          {hasCertificado
                                                            ? "Emitido"
                                                            : "Pendente"}
                                                        </Badge>
                                                      </td>

                                                      <td className="px-3 py-3 text-xs font-bold text-slate-600 dark:text-zinc-300">
                                                        {hasCertificado
                                                          ? getNumeroCertificadoLabel(participante)
                                                          : "—"}
                                                      </td>

                                                      <td className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-zinc-400">
                                                        {participante?.codigo_validacao || "—"}
                                                      </td>

                                                      <td className="px-3 py-3 text-right">
                                                        {hasCertificado ? (
                                                          <Botao
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() =>
                                                              baixarCertificado(participante)
                                                            }
                                                            disabled={baixando}
                                                          >
                                                            <span className="inline-flex items-center gap-2">
                                                              {baixando ? (
                                                                <Loader2
                                                                  className="h-4 w-4 animate-spin"
                                                                  aria-hidden="true"
                                                                />
                                                              ) : (
                                                                <Download
                                                                  className="h-4 w-4"
                                                                  aria-hidden="true"
                                                                />
                                                              )}
                                                              {baixando
                                                                ? "Baixando..."
                                                                : "Baixar"}
                                                            </span>
                                                          </Botao>
                                                        ) : (
                                                          <span className="text-slate-400">
                                                            —
                                                          </span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>

                                          <div className="grid gap-3 sm:hidden">
                                            {participantes.map((participante) => (
                                              <ParticipanteCard
                                                key={`${turmaKey}-mobile-${participante.usuario_id}`}
                                                participante={participante}
                                                onDownload={baixarCertificado}
                                                baixando={
                                                  baixandoId ===
                                                  Number(participante.certificado_id)
                                                }
                                              />
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}