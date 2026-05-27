// ✅ frontend/src/pages/DashboardAdministrador.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Dashboard premium do administrador.
 *
 * Função:
 * - Listar eventos administrativos.
 * - Filtrar por status e busca textual.
 * - Expandir eventos e carregar turmas sob demanda.
 * - Carregar inscritos, avaliações e presenças por turma.
 * - Calcular presença por turma/evento.
 * - Gerar PDFs administrativos de presença e inscritos.
 *
 * Contrato esperado no api.js:
 * - apiEventoListarAdministrador()
 * - apiTurmaListarPorEvento(eventoId)
 * - apiInscricaoListarPorTurma(turmaId)
 * - apiAvaliacaoListarPorTurma(turmaId)
 * - apiPresencaTurmaDetalhe(turmaId)
 * - apiPresencaRelatorioTurma(turmaId)
 *
 * Padrão:
 * - Sem apiGet direto no componente.
 * - Sem "/api" nas chamadas do frontend.
 * - Sem leitura de localStorage para nome do usuário.
 * - Sem aliases de rota.
 * - Mobile-first.
 * - Acessível.
 * - Visual premium real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useReducedMotion, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import CardEventoAdministrador from "../components/eventos/CardEventoAdministrador";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

import useEscolaTheme from "../hooks/useEscolaTheme";
import api, {
  apiEventoListarAdministrador,
  apiTurmaListarPorEvento,
  apiInscricaoListarPorTurma,
  apiAvaliacaoListarPorTurma,
  apiPresencaTurmaDetalhe,
} from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response) {
  return response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

function ymd(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function onlyHHmm(value, fallback = "12:00") {
  return typeof value === "string" && /^\d{2}:\d{2}/.test(value)
    ? value.slice(0, 5)
    : fallback;
}

function toLocalDate(ymdValue, hhmm = "12:00") {
  const date = ymd(ymdValue);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = onlyHHmm(hhmm).split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0);
}

function todayYmd() {
  const date = new Date();
  const pad = (item) => String(item).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatarDataBR(value) {
  const date = ymd(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
}

function formatarCPF(value) {
  const raw = String(value || "").replace(/\D/g, "");

  return raw.length === 11
    ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : raw;
}

function toArrayPayload(response, key) {
  const payload = unwrap(response);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (key && Array.isArray(payload?.[key])) return payload[key];

  return [];
}

function getEventoTitulo(evento) {
  return String(evento?.titulo || "Evento sem título").trim();
}

function getTurmaNome(turma, turmaId) {
  return String(turma?.nome || `Turma ${turmaId}`).trim();
}

function getEventoPeriodo(evento, turmas = []) {
  const diAgg = ymd(evento?.data_inicio_geral || evento?.data_inicio);
  const dfAgg = ymd(evento?.data_fim_geral || evento?.data_fim);
  const hiAgg = onlyHHmm(
    evento?.horario_inicio_geral || evento?.horario_inicio,
    "00:00"
  );
  const hfAgg = onlyHHmm(
    evento?.horario_fim_geral || evento?.horario_fim,
    "23:59"
  );

  let inicio = diAgg ? toLocalDate(diAgg, hiAgg) : null;
  let fim = dfAgg ? toLocalDate(dfAgg, hfAgg) : null;

  if (!inicio || !fim) {
    const starts = [];
    const ends = [];

    for (const turma of turmas) {
      const di = ymd(turma?.data_inicio);
      const df = ymd(turma?.data_fim);
      const hi = onlyHHmm(turma?.horario_inicio, "00:00");
      const hf = onlyHHmm(turma?.horario_fim, "23:59");

      const start = di ? toLocalDate(di, hi) : null;
      const end = df ? toLocalDate(df, hf) : null;

      if (start) starts.push(start.getTime());
      if (end) ends.push(end.getTime());
    }

    if (starts.length) inicio = new Date(Math.min(...starts));
    if (ends.length) fim = new Date(Math.max(...ends));
  }

  return {
    inicio,
    fim,
  };
}

function getStatusEvento(evento, turmas = []) {
  const { inicio, fim } = getEventoPeriodo(evento, turmas);
  const agora = new Date();

  if (!inicio || !fim) return "sem_data";
  if (inicio > agora) return "programado";
  if (inicio <= agora && fim >= agora) return "em_andamento";
  if (fim < agora) return "encerrado";

  return "sem_data";
}

function contarStatusEventos(eventos = [], turmasPorEvento = {}) {
  const contadores = {
    todos: eventos.length,
    programado: 0,
    em_andamento: 0,
    encerrado: 0,
    sem_data: 0,
  };

  for (const evento of eventos) {
    const status = getStatusEvento(evento, turmasPorEvento?.[evento.id] || []);

    if (contadores[status] !== undefined) {
      contadores[status] += 1;
    }
  }

  return contadores;
}

function idadeDe(value) {
  const date = ymd(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  const [year, month, day] = date.split("-").map(Number);
  const hoje = new Date();

  let idade = hoje.getFullYear() - year;
  const monthDiff = hoje.getMonth() + 1 - month;

  if (monthDiff < 0 || (monthDiff === 0 && hoje.getDate() < day)) {
    idade -= 1;
  }

  return idade >= 0 && idade < 140 ? `${idade}` : "";
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SectionShell({
  title,
  subtitle,
  action,
  icon: Icon = Activity,
  gradient = "from-rose-600 via-pink-500 to-orange-500",
  children,
}) {
  return (
    <section
      className="mt-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      aria-label={title}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              Administração
            </div>

            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-rose-200/70 bg-gradient-to-r from-rose-50 via-white to-orange-50 p-4 shadow-sm dark:border-rose-400/15 dark:from-rose-950/30 dark:via-zinc-900/40 dark:to-orange-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-rose-600/10 p-3 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Gestão administrativa integrada de eventos
          </p>

          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Acompanhe eventos, turmas, inscritos, presenças, avaliações e
            relatórios em um fluxo único, com filtros rápidos e carregamento sob demanda.
          </p>
        </div>
      </div>
    </div>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
    >
      {Icon ? (
        <Icon
          className={cx("h-4 w-4", loading ? "animate-spin" : "")}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, hint, tone = "rose" }) {
  const toneMap = {
    emerald: {
      soft: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    },
    amber: {
      soft: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
      bar: "from-amber-400 via-orange-400 to-amber-500",
    },
    rose: {
      soft: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
      bar: "from-rose-500 via-pink-500 to-orange-500",
    },
    slate: {
      soft: "bg-slate-600/10 text-slate-800 dark:text-slate-200 dark:bg-white/10",
      bar: "from-slate-400 via-slate-500 to-slate-600",
    },
  };

  const cfg = toneMap[tone] || toneMap.rose;

  return (
    <div
      className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              {label}
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {value}
            </div>

            {hint ? (
              <div className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-[13px]">
                {hint}
              </div>
            ) : null}
          </div>

          <div className={`shrink-0 rounded-2xl p-3 ${cfg.soft}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ message, onRetry, refNode }) {
  return (
    <div
      ref={refNode}
      tabIndex={-1}
      className="rounded-[26px] border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm outline-none dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />

        <div className="flex-1">
          <p className="font-extrabold">Não foi possível carregar.</p>
          <p className="mt-1 text-sm">{message}</p>

          {typeof onRetry === "function" ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold hover:bg-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:bg-rose-900/40 dark:hover:bg-rose-900/60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/55 sm:p-8">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
        <Search className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-zinc-100">
        Nenhum evento encontrado
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
        Ajuste o filtro de status, limpe a busca ou atualize a listagem para verificar
        se há novos eventos disponíveis.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function DashboardAdministrador() {
  const { isDark } = useEscolaTheme();
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [eventoExpandido, setEventoExpandido] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [filtroStatus, setFiltroStatus] = useState(
    () => window.localStorage.getItem("dashboard_administrador:filtro_status") || "em_andamento"
  );
  const [busca, setBusca] = useState(
    () => window.localStorage.getItem("dashboard_administrador:busca") || ""
  );
  const [buscaDebounced, setBuscaDebounced] = useState(busca);

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard do Administrador — Escola da Saúde";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "dashboard_administrador:filtro_status",
      filtroStatus
    );
  }, [filtroStatus]);

  useEffect(() => {
    window.localStorage.setItem("dashboard_administrador:busca", busca);

    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarEventos = useCallback(async () => {
    try {
      abortRef.current?.abort?.("nova-requisicao");

      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro("");
      setLive("Carregando eventos administrativos...");

      const response = await apiEventoListarAdministrador({
        on403: "silent",
        signal: controller.signal,
      });

      const lista = toArrayPayload(response, "eventos");

      if (!mountedRef.current) return;

      setEventos(lista);
      setErro("");
      setLive("Eventos administrativos atualizados.");
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("[DashboardAdministrador] erro ao carregar eventos", {
        message: error?.message,
      });

      const message = getErrorMessage(error, "Erro ao carregar eventos.");

      setEventos([]);
      setErro(message);
      setLive("Falha ao carregar eventos administrativos.");
      toast.error(message);

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  const carregarTurmas = useCallback(
    async (eventoId) => {
      if (!eventoId || turmasPorEvento[eventoId]) return;

      try {
        const response = await apiTurmaListarPorEvento(eventoId, {
          on403: "silent",
        });

        const lista = toArrayPayload(response, "turmas");

        setTurmasPorEvento((prev) => ({
          ...prev,
          [eventoId]: lista,
        }));
      } catch (error) {
        console.error("[DashboardAdministrador] erro ao carregar turmas", {
          eventoId,
          message: error?.message,
        });

        toast.error("Erro ao carregar turmas do evento.");
      }
    },
    [turmasPorEvento]
  );

  const carregarInscritos = useCallback(async (turmaId) => {
    if (!turmaId) return;

    try {
      const response = await apiInscricaoListarPorTurma(turmaId, {
        on403: "silent",
      });

      const lista = toArrayPayload(response, "inscritos");

      setInscritosPorTurma((prev) => ({
        ...prev,
        [turmaId]: lista,
      }));
    } catch (error) {
      console.error("[DashboardAdministrador] erro ao carregar inscritos", {
        turmaId,
        message: error?.message,
      });

      toast.error("Erro ao carregar inscritos da turma.");
    }
  }, []);

  const carregarAvaliacao = useCallback(
    async (turmaId) => {
      if (!turmaId || avaliacaoPorTurma[turmaId]) return;

      try {
        const response = await apiAvaliacaoListarPorTurma(turmaId, {
          on403: "silent",
        });

        const payload = unwrap(response) || {};

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turmaId]: payload,
        }));
      } catch (error) {
        console.error("[DashboardAdministrador] erro ao carregar avaliações", {
          turmaId,
          message: error?.message,
        });

        toast.error("Erro ao carregar avaliações da turma.");
      }
    },
    [avaliacaoPorTurma]
  );

  const carregarPresencas = useCallback(async (turmaId) => {
    if (!turmaId) return null;

    try {
      const response = await apiPresencaTurmaDetalhe(turmaId, {
        on403: "silent",
      });

      const payload = unwrap(response) || {};
      const datas = Array.isArray(payload?.datas) ? payload.datas : [];
      const usuarios = Array.isArray(payload?.usuarios) ? payload.usuarios : [];

      const hoje = todayYmd();
      const agora = new Date();
      const horaAgora = `${String(agora.getHours()).padStart(2, "0")}:${String(
        agora.getMinutes()
      ).padStart(2, "0")}`;

      const encontrosOcorridosLista = datas.filter((item) => {
        const data = ymd(item?.data || item);
        const horarioInicio = onlyHHmm(item?.horario_inicio, "23:59");

        return data < hoje || (data === hoje && horarioInicio <= horaAgora);
      });

      const datasOcorridas = new Set(
        encontrosOcorridosLista.map((item) => ymd(item?.data || item))
      );

      const totalOcorridos = encontrosOcorridosLista.length;

      const lista = usuarios.map((usuario) => {
        const presencas = Array.isArray(usuario?.presencas)
          ? usuario.presencas
          : [];

        const presentesOcorridos = presencas.reduce((total, presenca) => {
          const dia = ymd(presenca?.data_presenca || presenca?.data);

          return total + (presenca?.presente && datasOcorridas.has(dia) ? 1 : 0);
        }, 0);

        const percentualExato =
          totalOcorridos > 0
            ? (presentesOcorridos / totalOcorridos) * 100
            : 0;

        const frequenciaNumero = Math.round(percentualExato);
        const elegivel = percentualExato >= 75;

        return {
          usuario_id: usuario.id,
          id: usuario.id,
          nome: usuario.nome,
          cpf: usuario.cpf,
          registro: usuario.registro,
          data_nascimento: usuario.data_nascimento,
          deficiencia_nome: usuario.deficiencia_nome || null,
          elegivel,
          perc_exato: percentualExato,
          frequencia_num: frequenciaNumero,
          frequencia: `${frequenciaNumero}%`,
          presentes_ocorridos: presentesOcorridos,
          total_ocorridos: totalOcorridos,
        };
      });

      const presentesPorData = encontrosOcorridosLista.map((item) => {
        const dia = ymd(item?.data || item);

        let presentes = 0;

        for (const usuario of usuarios) {
          const presencas = Array.isArray(usuario?.presencas)
            ? usuario.presencas
            : [];

          if (
            presencas.some(
              (presenca) =>
                ymd(presenca?.data_presenca || presenca?.data) === dia &&
                presenca?.presente
            )
          ) {
            presentes += 1;
          }
        }

        return {
          data: dia,
          presentes,
        };
      });

      const somaPresentes = presentesPorData.reduce(
        (total, item) => total + item.presentes,
        0
      );

      const mediaPresentes = totalOcorridos
        ? Math.round(somaPresentes / totalOcorridos)
        : 0;

      const presencaPayload = {
        lista,
        resumo: {
          encontros_ocorridos: totalOcorridos,
          presentes_por_data: presentesPorData,
          media_presentes: mediaPresentes,
        },
      };

      setPresencasPorTurma((prev) => ({
        ...prev,
        [turmaId]: presencaPayload,
      }));

      return presencaPayload;
    } catch (error) {
      console.error("[DashboardAdministrador] erro ao carregar presenças", {
        turmaId,
        message: error?.message,
      });

      toast.error("Erro ao carregar presenças da turma.");
      return null;
    }
  }, []);

  const porcentagemPresencaTurma = useCallback(
    (turmaId) => {
      const lista = presencasPorTurma?.[turmaId]?.lista || [];
      const totalInscritos = (inscritosPorTurma?.[turmaId] || []).length;

      if (!totalInscritos) return 0;

      const elegiveis = lista.filter((usuario) => usuario.elegivel === true).length;

      return Math.round((elegiveis / totalInscritos) * 100);
    },
    [inscritosPorTurma, presencasPorTurma]
  );

  const porcentagemPresencaEvento = useCallback(
    (eventoId) => {
      const turmas = turmasPorEvento?.[eventoId] || [];

      let somaElegiveis = 0;
      let somaInscritos = 0;

      for (const turma of turmas) {
        const turmaId = turma.id;
        const lista = presencasPorTurma?.[turmaId]?.lista || [];
        const inscritos = (inscritosPorTurma?.[turmaId] || []).length;

        somaElegiveis += lista.filter((usuario) => usuario.elegivel === true).length;
        somaInscritos += inscritos;
      }

      if (!somaInscritos) return 0;

      return Math.round((somaElegiveis / somaInscritos) * 100);
    },
    [inscritosPorTurma, presencasPorTurma, turmasPorEvento]
  );

  const gerarRelatorioPDF = useCallback(async (turmaId) => {
    try {
      const response = await api.presenca.turmaPdf(turmaId, {
  on403: "silent",
});

      const payload = unwrap(response);
      const alunos = Array.isArray(payload?.lista)
        ? payload.lista
        : Array.isArray(payload)
          ? payload
          : [];

      const total = alunos.length;
      const presentes = alunos.filter((aluno) => {
        const frequencia =
          typeof aluno.frequencia_num === "number"
            ? aluno.frequencia_num
            : parseInt(String(aluno.frequencia || "0").replace(/\D/g, ""), 10) || 0;

        return frequencia >= 75;
      }).length;

      const presencaMedia = total
        ? ((presentes / total) * 100).toFixed(1)
        : "0.0";

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Relatório de Presença por Turma", 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [["Nome", "CPF", "Presença (≥75%)"]],
        body: alunos.map((aluno) => {
          const frequencia =
            typeof aluno.frequencia_num === "number"
              ? aluno.frequencia_num
              : parseInt(String(aluno.frequencia || "0").replace(/\D/g, ""), 10) || 0;

          return [
            aluno.nome || "—",
            formatarCPF(aluno.cpf),
            frequencia >= 75 ? "Sim" : "Não",
          ];
        }),
      });

      const finalY = (doc.lastAutoTable?.finalY || 30) + 10;

      doc.setFontSize(12);
      doc.text(`Total de inscritos: ${total}`, 14, finalY);
      doc.text(`Total de presentes (≥75%): ${presentes}`, 14, finalY + 6);
      doc.text(`Presença (% ≥75%): ${presencaMedia}%`, 14, finalY + 12);

      doc.save(`relatorio_turma_${turmaId}.pdf`);
      toast.success("PDF gerado com sucesso.");
    } catch (error) {
      console.error("[DashboardAdministrador] erro ao gerar relatório PDF", {
        turmaId,
        message: error?.message,
      });

      toast.error("Erro ao gerar PDF.");
    }
  }, []);

  const gerarPdfInscritosTurma = useCallback(
    async (turmaId) => {
      try {
        let inscritos = inscritosPorTurma[turmaId];

        if (!Array.isArray(inscritos)) {
          const response = await apiInscricaoListarPorTurma(turmaId, {
            on403: "silent",
          });

          inscritos = toArrayPayload(response, "inscritos");

          setInscritosPorTurma((prev) => ({
            ...prev,
            [turmaId]: inscritos,
          }));
        }

        let presenca = presencasPorTurma[turmaId];

        if (!presenca) {
          presenca = await carregarPresencas(turmaId);
        }

        const todasTurmas = Object.values(turmasPorEvento).flat();
        const turma =
          todasTurmas.find((item) => Number(item?.id) === Number(turmaId)) || {};

        const eventoNome =
          turma?.evento_titulo || turma?.evento?.titulo || "Evento";
        const turmaNome = getTurmaNome(turma, turmaId);

        const dataInicio = ymd(turma?.data_inicio);
        const dataFim = ymd(turma?.data_fim);
        const horarioInicio = onlyHHmm(turma?.horario_inicio, "");
        const horarioFim = onlyHHmm(turma?.horario_fim, "");

        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;

        const doc = new jsPDF({ orientation: "landscape" });

        doc.setFontSize(16);
        doc.text(`Lista de Inscritos — ${eventoNome}`, 14, 16);

        doc.setFontSize(12);
        doc.text(`${turmaNome}`, 14, 24);

        if (dataInicio || dataFim) {
          doc.text(
            `Período: ${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`,
            14,
            30
          );
        }

        if (horarioInicio || horarioFim) {
          doc.text(`Horário: ${horarioInicio} às ${horarioFim}`, 14, 36);
        }

        const totalInscritos = inscritos.length;
        const listaPresenca = presenca?.lista || [];
        const elegiveis = listaPresenca.filter(
          (usuario) => usuario.elegivel === true
        ).length;
        const percentualElegiveis = totalInscritos
          ? Math.round((elegiveis / totalInscritos) * 100)
          : 0;

        doc.text(
          `Presença (regra ≥ 75%): ${elegiveis}/${totalInscritos} (${percentualElegiveis}%)`,
          14,
          42
        );

        const frequenciaPorUsuario = {};

        for (const item of listaPresenca) {
          frequenciaPorUsuario[item.usuario_id] = item.frequencia;
        }

        autoTable(doc, {
          startY: 48,
          head: [["Nome", "CPF", "Idade", "Registro", "Deficiência", "Frequência"]],
          body: inscritos
            .slice()
            .sort((a, b) =>
              String(a?.nome || "").localeCompare(String(b?.nome || ""))
            )
            .map((inscrito) => [
              inscrito?.nome || "—",
              formatarCPF(inscrito?.cpf),
              idadeDe(inscrito?.data_nascimento),
              inscrito?.registro || "",
              inscrito?.deficiencia_nome || "",
              frequenciaPorUsuario[inscrito?.id] ||
                frequenciaPorUsuario[inscrito?.usuario_id] ||
                "",
            ]),
          styles: {
            fontSize: 9,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [159, 18, 57],
          },
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 30 },
            2: { cellWidth: 20, halign: "center" },
            3: { cellWidth: 30 },
            4: { cellWidth: 42 },
            5: { cellWidth: 30, halign: "center" },
          },
        });

        doc.save(`inscritos_turma_${turmaId}.pdf`);
        toast.success("PDF de inscritos gerado.");
      } catch (error) {
        console.error("[DashboardAdministrador] erro ao gerar PDF de inscritos", {
          turmaId,
          message: error?.message,
        });

        toast.error("Erro ao gerar PDF de inscritos.");
      }
    },
    [carregarPresencas, inscritosPorTurma, presencasPorTurma, turmasPorEvento]
  );

  const toggleExpandir = useCallback(
    (eventoId) => {
      setEventoExpandido((current) => (current === eventoId ? null : eventoId));
      carregarTurmas(eventoId);
    },
    [carregarTurmas]
  );

  const contadores = useMemo(
    () => contarStatusEventos(eventos, turmasPorEvento),
    [eventos, turmasPorEvento]
  );

  const eventosOrdenados = useMemo(() => {
    return [...eventos].sort((a, b) => {
      const aPeriodo = getEventoPeriodo(a, turmasPorEvento?.[a.id] || []);
      const bPeriodo = getEventoPeriodo(b, turmasPorEvento?.[b.id] || []);

      const aTime = aPeriodo.inicio?.getTime?.() ?? Infinity;
      const bTime = bPeriodo.inicio?.getTime?.() ?? Infinity;

      return aTime - bTime;
    });
  }, [eventos, turmasPorEvento]);

  const eventosFiltrados = useMemo(() => {
    const byStatus = eventosOrdenados.filter((evento) => {
      if (filtroStatus === "todos") return true;

      const status = getStatusEvento(evento, turmasPorEvento?.[evento.id] || []);

      return status === filtroStatus;
    });

    if (!buscaDebounced) return byStatus;

    return byStatus.filter((evento) =>
      getEventoTitulo(evento).toLowerCase().includes(buscaDebounced)
    );
  }, [buscaDebounced, eventosOrdenados, filtroStatus, turmasPorEvento]);

  const filtroOptions = useMemo(
    () => [
      { key: "todos", label: "Todos", count: contadores.todos },
      { key: "programado", label: "Programados", count: contadores.programado },
      {
        key: "em_andamento",
        label: "Em andamento",
        count: contadores.em_andamento,
      },
      { key: "encerrado", label: "Encerrados", count: contadores.encerrado },
    ],
    [contadores]
  );

  function onTabKeyDown(event) {
    const keys = filtroOptions.map((item) => item.key);
    const index = keys.indexOf(filtroStatus);

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setFiltroStatus(keys[(index + 1) % keys.length]);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFiltroStatus(keys[(index - 1 + keys.length) % keys.length]);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <HeaderHero
          title="Dashboard do Administrador"
          subtitle="Gestão de eventos, turmas, inscrições, presenças, avaliações e relatórios administrativos."
          badge="Administrador • Gestão integrada • Escola da Saúde"
          icon={ShieldCheck}
          gradient="from-rose-900 via-pink-700 to-orange-600"
          isDark={isDark}
        />

        {carregando ? (
          <div
            className="sticky top-0 z-40 mt-4 h-1 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando eventos administrativos"
          >
            <div
              className={cx(
                "h-full w-1/3 bg-pink-600",
                reduceMotion ? "" : "animate-pulse"
              )}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <SectionShell
          title="Resumo dos eventos"
          subtitle="Distribuição geral dos eventos por status operacional."
          icon={Sparkles}
          gradient="from-rose-600 via-pink-500 to-orange-500"
          action={
            <GhostAction
              icon={RefreshCw}
              onClick={carregarEventos}
              loading={carregando}
            >
              {carregando ? "Atualizando…" : "Atualizar"}
            </GhostAction>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              icon={Filter}
              label="Todos"
              value={contadores.todos}
              hint="Eventos carregados"
              tone="slate"
            />

            <MiniStat
              icon={CalendarClock}
              label="Programados"
              value={contadores.programado}
              hint="Ainda não iniciados"
              tone="emerald"
            />

            <MiniStat
              icon={Clock3}
              label="Em andamento"
              value={contadores.em_andamento}
              hint="Dentro do período de realização"
              tone="amber"
            />

            <MiniStat
              icon={CheckCircle2}
              label="Encerrados"
              value={contadores.encerrado}
              hint="Eventos já finalizados"
              tone="rose"
            />
          </div>
        </SectionShell>

        <SectionShell
          title="Filtros e listagem"
          subtitle="Filtre eventos por status e pesquise rapidamente pelo título."
          icon={SlidersHorizontal}
          gradient="from-slate-600 via-slate-700 to-zinc-800"
        >
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/55">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                    Filtros
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Use as setas do teclado para alternar entre os filtros.
                  </p>
                </div>

                <GhostAction
                  icon={X}
                  onClick={() => {
                    setFiltroStatus("em_andamento");
                    setBusca("");
                  }}
                >
                  Resetar filtros
                </GhostAction>
              </div>

              <nav
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Filtros por status"
                onKeyDown={onTabKeyDown}
              >
                {filtroOptions.map((item) => {
                  const active = filtroStatus === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      tabIndex={active ? 0 : -1}
                      aria-selected={active}
                      aria-controls={`painel-${item.key}`}
                      onClick={() => setFiltroStatus(item.key)}
                      className={cx(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2",
                        active
                          ? "bg-rose-600 text-white focus-visible:ring-rose-500"
                          : "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                      )}
                    >
                      {item.label}
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-white text-slate-700 dark:bg-white/10 dark:text-zinc-200"
                        )}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div>
                <label htmlFor="busca-evento" className="sr-only">
                  Buscar evento pelo título
                </label>

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />

                  <input
                    id="busca-evento"
                    type="search"
                    inputMode="search"
                    placeholder="Buscar evento pelo título..."
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-rose-500/60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                    aria-describedby="dica-busca"
                  />

                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    disabled={!busca}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-900"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <p id="dica-busca" className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  Digite parte do título do evento para filtrar rapidamente.
                </p>
              </div>
            </div>
          </div>

          {erro ? (
            <div className="mt-5">
              <AlertCard message={erro} onRetry={carregarEventos} refNode={erroRef} />
            </div>
          ) : null}

          <section
            id={`painel-${filtroStatus}`}
            role="tabpanel"
            aria-label="Lista de eventos filtrados"
            className="mt-5 space-y-4"
          >
            {carregando ? (
              <>
                <Skeleton height={118} className="rounded-[26px]" />
                <Skeleton height={118} className="rounded-[26px]" />
                <Skeleton height={118} className="rounded-[26px]" />
              </>
            ) : null}

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
                    calcularPctTurma={porcentagemPresencaTurma}
                    calcularPctEvento={porcentagemPresencaEvento}
                    classNomeEventoMultiLinha="break-words whitespace-normal text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-snug"
                    classorganizadoresMultiLinha="break-words whitespace-normal text-xs text-zinc-500 dark:text-zinc-400 leading-snug"
                  />
                </motion.div>
              ))}

            {!carregando && eventosFiltrados.length === 0 ? <EmptyState /> : null}
          </section>
        </SectionShell>
      </main>

      <Footer />
    </>
  );
}