/* eslint-disable no-console */
// ✅ src/pages/AgendaSalasAdmin.jsx — PREMIUM+++ (novo tema + header menos verde + UI/UX top)
// Mantém regras/fluxos: grid desktop + cards mobile, bloqueios/feriados em retângulo único, modal por slot,
// atalhos teclado, hojeISO sem timezone shift.
//
// Ajustes pedidos mantidos:
// 1) Remove “Livre / Aprovado / ...” dentro dos slots
// 2) Feriado/Ponto Facultativo: mostrar apenas “Ano Novo”, “Ponto Facultativo” (sem “Feriado —”)
// 3) Hoje: azul mais forte + badge legível
// 4) “Manhã/Tarde” menor, cinza e menos forte; evento fica mais perceptível

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Info,
  FileText,
  MapPin,
  Sparkles,
  Waves,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalReservaAdmin from "../components/ModalReservaAdmin";

/* ───────────────────────── Constantes ───────────────────────── */
const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const CAPACIDADES_SALA = {
  auditorio:     { conforto: 50, max: 60, labelCurta: "Auditório" },
  sala_reuniao:  { conforto: 25, max: 30, labelCurta: "Sala de Reunião" },
};

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

/* ─────────────────────── Helpers de calendário ─────────────────────── */
function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia   = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay();
  const diasNoMes = ultimoDia.getDate();

  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let i = 0; i < primeiroDiaSemana; i++) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i++) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i++) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }
  return semanas;
}

const keySlot = (dataISO, periodo) => `${dataISO}|${periodo}`;

function formatISO(ano, mesIndex, dia) {
  const m = String(mesIndex + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

/* ─────────────────── Normalização de reservas ─────────────────── */
function normalizeReserva(r) {
  const dataISO = (r.data || r.dataISO || r.dia || "").slice(0, 10);
  return {
    id: r.id ?? r.reserva_id ?? r.uuid ?? null,
    sala: r.sala || r.room || null,
    data: dataISO,
    dataISO,
    periodo: r.periodo || r.turno || r.slot || "manha",
    status: r.status || "pendente",
    qtd_pessoas:  r.qtd_pessoas ?? r.qtdPessoas ?? r.qtd ?? r.capacidade ?? null,
    coffee_break: r.coffee_break ?? r.coffeeBreak ?? r.coffee ?? false,
    observacao:   r.observacao ?? r.obs ?? r.observacao ?? r.observacao_admin ?? "",
    finalidade:   r.finalidade ?? r.descricao ?? r.titulo ?? r.assunto ?? "",
    solicitante_id: r.solicitante_id ?? r.usuario_id ?? r.user_id ?? null,
    solicitante_nome: r.solicitante_nome ?? r.usuario_nome ?? r.nome_solicitante ?? r.nome ?? null,
    solicitante_unidade: r.solicitante_unidade ?? r.unidade ?? r.unidade_nome ?? r.setor ?? null,
  };
}

/* ─────────────────────── Status / UI ─────────────────────── */
function classesStatus(status) {
  switch (status) {
    case "pendente":
      return "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100";
    case "aprovado":
      return "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100";
    case "rejeitado":
    case "cancelado":
      return "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100";
    case "bloqueado":
      return "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100";
    case "bloqueado_dia":
      return "bg-slate-100 text-slate-600 border border-slate-200 cursor-not-allowed";
    default:
      return "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700";
  }
}

function labelStatus(status) {
  switch (status) {
    case "pendente":  return "Pendente";
    case "aprovado":  return "Aprovado";
    case "rejeitado": return "Rejeitado";
    case "cancelado": return "Cancelado";
    case "bloqueado": return "Bloqueado (uso interno)";
    case "bloqueado_dia": return "Indisponível";
    default: return "Livre";
  }
}

/* ─────────────────────── Responsivo: detecta mobile ─────────────────────── */
function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}

/* ─────────────────────── Motivos: feriado/bloqueio/weekend ─────────────────────── */
function limparPrefixosFeriado(txt) {
  const s = String(txt || "").trim();
  if (!s) return "";
  return s
    .replace(/^feriado\s*[-—:]\s*/i, "")
    .replace(/^ponto\s*facultativo\s*[-—:]\s*/i, "Ponto Facultativo — ")
    .trim();
}

function motivoBloqueio({ diaSemana, ehFeriado, feriadoObj, ehBloqueada, bloqueioObj }) {
  if (ehBloqueada) {
    const motivo = String(bloqueioObj?.motivo || bloqueioObj?.descricao || bloqueioObj?.titulo || "").trim();
    return motivo ? `Bloqueado (uso interno) — ${motivo}` : "Bloqueado (uso interno)";
  }

  if (ehFeriado) {
    const nomeCru =
      feriadoObj?.nome ||
      feriadoObj?.titulo ||
      feriadoObj?.descricao ||
      feriadoObj?.motivo ||
      "";
    const nome = limparPrefixosFeriado(nomeCru);

    const tipo = String(feriadoObj?.tipo || "").trim().toLowerCase();
    if (nome) return nome;
    if (tipo === "ponto_facultativo") return "Ponto Facultativo";
    return "Feriado";
  }

  if (diaSemana === 6) return "Sábado";
  if (diaSemana === 0) return "Domingo";
  return "Indisponível";
}

/* ─────────────────────── UI helpers ─────────────────────── */
function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function MiniStat({ icon: Icon, label, value, tone = "ocean", loading }) {
  const tones = {
    ocean: {
      ring: "ring-1 ring-white/15",
      iconBg: "bg-white/12",
      icon: "text-white",
      label: "text-white/80",
      value: "text-white",
    },
    ink: {
      ring: "ring-1 ring-white/10",
      iconBg: "bg-white/10",
      icon: "text-white",
      label: "text-white/75",
      value: "text-white",
    },
  };
  const t = tones[tone] || tones.ocean;

  return (
    <div className={cx(
      "rounded-2xl px-3 py-2.5 backdrop-blur",
      "bg-white/10 hover:bg-white/12 transition",
      t.ring
    )}>
      <div className="flex items-center gap-2">
        <span className={cx("w-9 h-9 rounded-2xl grid place-items-center", t.iconBg)}>
          <Icon className={cx("w-4.5 h-4.5", t.icon)} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className={cx("text-[11px] uppercase tracking-wide", t.label)}>{label}</div>
          <div className={cx("text-lg font-extrabold leading-tight", t.value)}>
            {loading ? <Skeleton width={40} /> : value}
          </div>
        </div>
      </div>
    </div>
  );
}

function SoftIconButton({ title, ariaLabel, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cx(
        "p-2 rounded-full",
        "bg-white/80 hover:bg-white shadow-sm border border-slate-200",
        "dark:bg-zinc-900/70 dark:hover:bg-zinc-900 dark:border-zinc-800",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500",
        "dark:focus-visible:ring-offset-zinc-950"
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────────── Página ───────────────────────────── */
function AgendaSalasAdmin() {
  const hoje = new Date();

  // ✅ hojeISO “date-only” consistente
  const hojeISO = useMemo(() => {
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const d = String(hoje.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useNavigate();
  const baseURL = (api.defaults?.baseURL || "").replace(/\/+$/, "");

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());

  const [loading, setLoading] = useState(false);
  const [reservasMap, setReservasMap] = useState({ auditorio: {}, sala_reuniao: {} });
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);
  const isMobile = useIsMobile(740);

  function mudarMes(delta) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    else if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMesIndex(novoMes);
    setAno(novoAno);
  }

  function hojeClick() {
    const d = new Date();
    setAno(d.getFullYear());
    setMesIndex(d.getMonth());
  }

  // atalhos ← → (não interfere quando digitando)
  const handleKeyNav = useCallback((e) => {
    const tag = (e?.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    if (e.key === "ArrowLeft") mudarMes(-1);
    if (e.key === "ArrowRight") mudarMes(1);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
      e.preventDefault();
      hojeClick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesIndex, ano]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);

      const anoParam = ano;
      const mesParam = mesIndex + 1;

      const qsAuditorio = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "auditorio",
      }).toString();

      const qsSalaReuniao = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "sala_reuniao",
      }).toString();

      const [respA, respS] = await Promise.all([
        api.get(`/salas/agenda-admin?${qsAuditorio}`),
        api.get(`/salas/agenda-admin?${qsSalaReuniao}`),
      ]);

      const dataAuditorio   = respA?.data ?? respA ?? {};
      const dataSalaReuniao = respS?.data ?? respS ?? {};

      // ----- mapa auditório -----
      const mapAuditorio = {};
      for (const r of (dataAuditorio.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "auditorio") continue;
        mapAuditorio[keySlot(nr.dataISO, nr.periodo)] = nr;
      }

      // ----- mapa sala de reunião -----
      const mapSalaReuniao = {};
      for (const r of (dataSalaReuniao.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "sala_reuniao") continue;
        mapSalaReuniao[keySlot(nr.dataISO, nr.periodo)] = nr;
      }

      // ----- feriados -----
      const ferMap = {};
      const feriadosBase = dataAuditorio.feriados?.length
        ? dataAuditorio.feriados
        : (dataSalaReuniao.feriados || []);
      for (const f of feriadosBase || []) {
        const dataISO = (f.data || "").slice(0, 10);
        if (dataISO) ferMap[dataISO] = f;
      }

      // ----- datas bloqueadas -----
      const bloqueiosMap = {};
      const bloqueiosBase = dataAuditorio.datas_bloqueadas?.length
        ? dataAuditorio.datas_bloqueadas
        : (dataSalaReuniao.datas_bloqueadas || []);
      for (const b of bloqueiosBase || []) {
        const dataISO = (b.data || "").slice(0, 10);
        if (dataISO) bloqueiosMap[dataISO] = b;
      }

      setReservasMap({ auditorio: mapAuditorio, sala_reuniao: mapSalaReuniao });
      setFeriadosMap(ferMap);
      setDatasBloqueadasMap(bloqueiosMap);
    } catch (err) {
      console.error("[AgendaSalasAdmin] Erro ao carregar agenda:", err);
      toast.error("Erro ao carregar agenda de salas.");
    } finally {
      setLoading(false);
    }
  }

  function abrirModalSlot(dia, periodo, salaKey) {
    if (!dia) return;
    const dataISO = formatISO(ano, mesIndex, dia);
    const k = keySlot(dataISO, periodo);
    const reserva = reservasMap[salaKey]?.[k] || null;
    setSlotSelecionado({ dataISO, periodo, sala: salaKey });
    setReservaSelecionada(reserva);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setSlotSelecionado(null);
    setReservaSelecionada(null);
  }

  function getStatusSlot(dataISO, periodo, salaKey) {
    const d = new Date(dataISO + "T12:00:00");
    const diaSemana = d.getDay();
    const ehFeriado   = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];

    if (diaSemana === 0 || diaSemana === 6 || ehFeriado || ehBloqueada) return "bloqueado_dia";
    const r = reservasMap[salaKey]?.[keySlot(dataISO, periodo)];
    return r ? (r.status || "pendente") : "livre";
  }

  function abrirRelatorioMensal() {
    const url = `${baseURL}/salas/admin/relatorio-mensal?ano=${ano}&mes=${mesIndex + 1}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /* ───────── Ministats ───────── */
  const totalMes = useMemo(() => {
    let count = 0;
    Object.values(reservasMap.auditorio).forEach(() => count++);
    Object.values(reservasMap.sala_reuniao).forEach(() => count++);
    return count;
  }, [reservasMap]);

  const totalAprovados = useMemo(() => {
    const ok = (obj) => Object.values(obj).filter((r) => r?.status === "aprovado").length;
    return ok(reservasMap.auditorio) + ok(reservasMap.sala_reuniao);
  }, [reservasMap]);

  const totalPendentes = useMemo(() => {
    const ok = (obj) => Object.values(obj).filter((r) => r?.status === "pendente").length;
    return ok(reservasMap.auditorio) + ok(reservasMap.sala_reuniao);
  }, [reservasMap]);

  const diasDoMes = useMemo(() => {
    const last = new Date(ano, mesIndex + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [ano, mesIndex]);

  // ✅ Hoje: azul forte (sem exagero)
  const HOJE_BG = "bg-sky-100/70 dark:bg-sky-950/25";
  const HOJE_RING = "ring-2 ring-sky-500/70 dark:ring-sky-700/60";
  const HOJE_BADGE = "bg-sky-200 text-sky-950 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-white dark:from-zinc-950 dark:via-zinc-950 dark:to-black text-gray-900 dark:text-gray-100">
      {/* HeaderHero premium — NOVO TEMA (menos verde) */}
      <header className="relative overflow-hidden text-white shadow-[0_20px_60px_-35px_rgba(2,6,23,0.75)]">
        {/* fundo */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-900 to-violet-900"
          aria-hidden="true"
        />
        {/* glow blobs */}
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-fuchsia-400/15 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:18px_18px]" aria-hidden="true" />

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
        >
          Ir para o conteúdo
        </a>

        <div className="relative max-w-6xl mx-auto px-4 py-7 sm:py-9">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Agenda de Salas — Administração
                </h1>
                <p className="mt-1 text-sm sm:text-base text-white/85 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 opacity-90" />
                  Auditório & Sala de Reunião • períodos separados (“Manhã” e “Tarde”)
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 flex-wrap items-start">
              <div className="rounded-2xl px-3 py-2 bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-semibold">Auditório</span>
                </div>
                <p className="mt-1 text-sm font-extrabold">
                  {CAPACIDADES_SALA.auditorio.conforto} <span className="text-white/70">/</span>{" "}
                  {CAPACIDADES_SALA.auditorio.max} <span className="text-white/70">máx.</span>
                </p>
              </div>

              <div className="rounded-2xl px-3 py-2 bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Sala de Reunião</span>
                </div>
                <p className="mt-1 text-sm font-extrabold">
                  {CAPACIDADES_SALA.sala_reuniao.conforto} <span className="text-white/70">/</span>{" "}
                  {CAPACIDADES_SALA.sala_reuniao.max} <span className="text-white/70">máx.</span>
                </p>
              </div>

              <button
                type="button"
                onClick={abrirRelatorioMensal}
                className={cx(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-2xl",
                  "bg-white/12 hover:bg-white/16 ring-1 ring-white/15 backdrop-blur",
                  "text-white text-xs sm:text-sm font-extrabold transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-transparent"
                )}
                title="Gerar PDF do mês (todas as reservas das duas salas)"
              >
                <FileText className="w-4 h-4" />
                Relatório do mês (PDF)
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <MiniStat icon={Sparkles} label="Reservas no mês" value={totalMes} loading={loading} />
            <MiniStat icon={ShieldCheck} label="Aprovadas" value={totalAprovados} loading={loading} />
            <MiniStat icon={Waves} label="Pendentes" value={totalPendentes} loading={loading} />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/15" aria-hidden="true" />
      </header>

      {/* Conteúdo */}
      <main id="conteudo" className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* Barra de controles (sticky) — premium clean */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/85 dark:bg-zinc-950/80 backdrop-blur border-b border-slate-200/60 dark:border-zinc-800/70 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SoftIconButton
                onClick={() => mudarMes(-1)}
                ariaLabel="Mês anterior"
                title="Mês anterior (atalho ←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </SoftIconButton>

              <div className="px-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">Mês</p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>

              <SoftIconButton
                onClick={() => mudarMes(1)}
                ariaLabel="Próximo mês"
                title="Próximo mês (atalho →)"
              >
                <ChevronRight className="w-4 h-4" />
              </SoftIconButton>

              <button
                className={cx(
                  "ml-1 px-3 py-1.5 rounded-2xl text-xs font-extrabold",
                  "bg-sky-600 hover:bg-sky-700 text-white shadow-sm",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500",
                  "dark:focus-visible:ring-offset-zinc-950"
                )}
                onClick={hojeClick}
                aria-label="Ir para o mês atual"
                title="Atalho: Ctrl/Cmd + H"
              >
                Hoje
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center text-xs sm:text-sm">
              <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
                Visualizando: Auditório + Sala de Reunião
              </span>
              {loading && (
                <span className="text-slate-500 dark:text-zinc-400">
                  <Skeleton width={110} height={18} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Atalho feriados/bloqueios — mais “institucional” */}
        <div className="mb-3 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] sm:text-xs text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-sky-700 dark:text-sky-300" />
            <p>
              <strong>Feriados</strong>, <strong>pontos facultativos</strong> e{" "}
              <strong>datas bloqueadas</strong> deixam o dia indisponível para agendamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/calendario-bloqueios")}
            className="inline-flex px-3 py-1.5 rounded-full text-[11px] font-extrabold border border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
          >
            Gerenciar feriados
          </button>
        </div>

        {/* Legenda — chips finos (mais clean) */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
          {[
            { c: "bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-700", t: "Livre" },
            { c: "bg-amber-100 border-amber-300", t: "Pendente" },
            { c: "bg-emerald-100 border-emerald-300", t: "Aprovado" },
            { c: "bg-rose-100 border-rose-300", t: "Cancelado/Rejeitado" },
            { c: "bg-sky-100 border-sky-300", t: "Bloqueado (uso interno)" },
            { c: "bg-slate-200 border-slate-300", t: "Indisponível (fim de semana/feriado)" },
          ].map((it) => (
            <span key={it.t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/70 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800">
              <span className={cx("w-3 h-3 rounded-full border", it.c)} />
              {it.t}
            </span>
          ))}
        </div>

        {/* ===================== MOBILE: Cards ===================== */}
        {isMobile ? (
          <section className="space-y-3">
            {diasDoMes.map((dia) => {
              const dataISO = formatISO(ano, mesIndex, dia);
              const eHoje = dataISO === hojeISO;

              const d = new Date(dataISO + "T12:00:00");
              const diaSemana = d.getDay();
              const ehFeriado = !!feriadosMap[dataISO];
              const ehBloqueada = !!datasBloqueadasMap[dataISO];
              const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
              const diaIndisponivelGeral = ehFimDeSemana || ehFeriado || ehBloqueada;

              const motivo = diaIndisponivelGeral
                ? motivoBloqueio({
                    diaSemana,
                    ehFeriado,
                    feriadoObj: feriadosMap[dataISO],
                    ehBloqueada,
                    bloqueioObj: datasBloqueadasMap[dataISO],
                  })
                : null;

              return (
                <article
                  key={dataISO}
                  className={cx(
                    "rounded-3xl border shadow-sm overflow-hidden",
                    "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800",
                    eHoje ? HOJE_RING : ""
                  )}
                  aria-label={`Dia ${dia}`}
                >
                  <div
                    className={cx(
                      "px-4 py-3 flex items-center justify-between",
                      eHoje ? HOJE_BG : "bg-slate-50 dark:bg-zinc-900/60",
                      "border-b border-slate-200/70 dark:border-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {dia}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-zinc-300">
                        {DIAS_SEMANA[diaSemana]}
                      </span>
                      {eHoje && (
                        <span className={cx("ml-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full", HOJE_BADGE)}>
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {String(mesIndex + 1).padStart(2, "0")}/{ano}
                    </span>
                  </div>

                  <div className="p-4">
                    {diaIndisponivelGeral ? (
                      <div className="rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3 py-3 text-sm text-slate-700 dark:text-zinc-200 text-center">
                        <span className="font-semibold break-words">{motivo}</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {["sala_reuniao", "auditorio"].map((salaKey) => {
                          const cap = CAPACIDADES_SALA[salaKey];

                          return (
                            <div key={salaKey} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                                  {cap.labelCurta}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                  {cap.conforto}/{cap.max}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                {PERIODOS.map((p) => {
                                  const status = getStatusSlot(dataISO, p.value, salaKey);
                                  const disabled = status === "bloqueado_dia";
                                  const k = keySlot(dataISO, p.value);
                                  const res = reservasMap[salaKey]?.[k];

                                  const tituloEvento =
                                    res?.finalidade?.trim()
                                      ? res.finalidade.trim()
                                      : labelStatus(status);

                                  const subInfo =
                                    res?.solicitante_nome || res?.solicitante_unidade
                                      ? `${res?.solicitante_nome || "—"}${res?.solicitante_unidade ? ` • ${res.solicitante_unidade}` : ""}`
                                      : "";

                                  return (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => !disabled && abrirModalSlot(dia, p.value, salaKey)}
                                      className={cx(
                                        "w-full text-left rounded-3xl p-3 transition",
                                        classesStatus(status),
                                        disabled ? "cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                                      )}
                                      aria-label={`${cap.labelCurta}, ${p.label}, ${tituloEvento}`}
                                      title={`${cap.labelCurta} • ${p.label} • ${tituloEvento}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-300">
                                          {p.label}
                                        </span>
                                      </div>

                                      <div className="mt-2">
                                        <p className="text-sm font-extrabold leading-snug break-words">
                                          {tituloEvento}
                                        </p>
                                        {!!subInfo && (
                                          <p className="mt-1 text-[12px] opacity-80 break-words">
                                            {subInfo}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          /* ===================== DESKTOP/TABLET: Grid ===================== */
          <section className="bg-white dark:bg-zinc-950 rounded-3xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs sm:text-sm">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-2 text-center font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {semanas.map((semana, idxSemana) => (
                <div key={idxSemana} className="grid grid-cols-7">
                  {semana.map((dia, idxDia) => {
                    if (!dia) {
                      return (
                        <div
                          key={idxDia}
                          className="min-h-[120px] sm:min-h-[170px] border-r border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30"
                        />
                      );
                    }

                    const dataISO = formatISO(ano, mesIndex, dia);
                    const eHoje = dataISO === hojeISO;

                    const d = new Date(dataISO + "T12:00:00");
                    const diaSemana = d.getDay();
                    const ehFeriado = !!feriadosMap[dataISO];
                    const ehBloqueada = !!datasBloqueadasMap[dataISO];
                    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
                    const diaIndisponivelGeral = ehFimDeSemana || ehFeriado || ehBloqueada;

                    if (diaIndisponivelGeral) {
                      const motivo = motivoBloqueio({
                        diaSemana,
                        ehFeriado,
                        feriadoObj: feriadosMap[dataISO],
                        ehBloqueada,
                        bloqueioObj: datasBloqueadasMap[dataISO],
                      });

                      return (
                        <div
                          key={idxDia}
                          className={cx(
                            "min-h-[120px] sm:min-h-[170px] border-r border-slate-200 dark:border-zinc-800 p-2 flex flex-col",
                            eHoje ? HOJE_BG : "bg-slate-50/40 dark:bg-zinc-950/20"
                          )}
                          title={motivo}
                          aria-label={`Dia indisponível: ${motivo}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={cx(
                              "text-xs sm:text-sm font-extrabold",
                              eHoje ? "text-sky-800 dark:text-sky-200" : "text-slate-700 dark:text-zinc-200"
                            )}>
                              {dia}
                            </span>
                            {eHoje && (
                              <span className={cx("text-[10px] font-extrabold px-2 py-0.5 rounded-full", HOJE_BADGE)}>
                                Hoje
                              </span>
                            )}
                          </div>

                          <div className="mt-auto rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2.5 py-3 text-center">
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-zinc-200 break-words">
                              {motivo}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idxDia}
                        className={cx(
                          "min-h-[120px] sm:min-h-[170px] border-r border-slate-200 dark:border-zinc-800 p-2 flex flex-col",
                          eHoje ? HOJE_BG : ""
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cx(
                            "text-xs sm:text-sm font-extrabold",
                            eHoje ? "text-sky-800 dark:text-sky-200" : "text-slate-800 dark:text-white"
                          )}>
                            {dia}
                          </span>
                          {eHoje && (
                            <span className={cx("text-[10px] font-extrabold px-2 py-0.5 rounded-full", HOJE_BADGE)}>
                              Hoje
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 mt-auto">
                          {["sala_reuniao","auditorio"].map((salaKey) => {
                            const cap = CAPACIDADES_SALA[salaKey];

                            return (
                              <div
                                key={salaKey}
                                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 shadow-sm"
                              >
                                <div className="flex items-center justify-center px-2 pt-2">
                                  <span className="text-[11px] font-extrabold tracking-wide text-slate-700 dark:text-zinc-200">
                                    {cap.labelCurta}
                                  </span>
                                </div>

                                <div className="px-1.5 pb-2 pt-2 grid grid-cols-1 gap-1.5">
                                  {PERIODOS.map((p) => {
                                    const status = getStatusSlot(dataISO, p.value, salaKey);
                                    const disabled = status === "bloqueado_dia";
                                    const k = keySlot(dataISO, p.value);
                                    const res = reservasMap[salaKey]?.[k];

                                    const tituloEvento =
                                      res?.finalidade?.trim()
                                        ? res.finalidade.trim()
                                        : labelStatus(status);

                                    const detalhe =
                                      res?.solicitante_nome || res?.solicitante_unidade
                                        ? `${res?.solicitante_nome || "—"}${res?.solicitante_unidade ? ` • ${res.solicitante_unidade}` : ""}`
                                        : "";

                                    return (
                                      <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => !disabled && abrirModalSlot(dia, p.value, salaKey)}
                                        className={cx(
                                          "w-full text-left rounded-2xl transition",
                                          classesStatus(status),
                                          disabled ? "cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                                        )}
                                        aria-label={`${cap.labelCurta}, ${p.label}, ${tituloEvento}`}
                                        title={`${cap.labelCurta} • ${p.label} • ${tituloEvento}`}
                                      >
                                        <div className="flex items-center justify-between gap-2 px-2 pt-2">
                                          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-300">
                                            {p.label}
                                          </span>
                                        </div>

                                        <div className="px-2 pb-2 pt-1">
                                          <p className="text-[11px] sm:text-xs font-extrabold leading-snug break-words">
                                            {tituloEvento}
                                          </p>
                                          {!!detalhe && (
                                            <p className="mt-1 text-[10px] sm:text-[11px] opacity-80 break-words">
                                              {detalhe}
                                            </p>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {!loading &&
              !Object.keys(reservasMap.auditorio).length &&
              !Object.keys(reservasMap.sala_reuniao).length && (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-zinc-400">
                  Nenhuma reserva localizada para {NOMES_MESES[mesIndex]} / {ano}. Clique em um período para criar.
                </div>
              )}
          </section>
        )}
      </main>

      <Footer />

      {modalAberto && slotSelecionado && (
        <ModalReservaAdmin
          onClose={fecharModal}
          slot={slotSelecionado}
          reserva={reservaSelecionada}
          sala={slotSelecionado.sala}
          capacidadeSala={CAPACIDADES_SALA[slotSelecionado.sala]}
          recarregar={carregarAgenda}
          baseURL={baseURL}
        />
      )}
    </div>
  );
}

export default AgendaSalasAdmin;
