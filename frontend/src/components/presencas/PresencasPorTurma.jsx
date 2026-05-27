// ✅ src/components/presencas/PresencasPorTurma.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Container de presenças por turma.
//
// Contratos aplicados:
// - Sem toast direto;
// - Sem apiGet direto;
// - Sem /api manual no frontend;
// - Sem /api/administrador/turmas;
// - Sem /api/turmas/:id/inscritos;
// - Sem /api/avaliacao/turma/:id;
// - Presença administrativa via api.presenca.administrador();
// - Inscritos por turma via api.inscricao.listarPorTurma(turma_id);
// - Avaliação por turma somente se existir api.avaliacao.porTurma;
// - Componentes v2.0 nos caminhos corretos;
// - Header local para evitar import incerto de PainelComTitulo;
// - Date-only seguro;
// - Mobile-first, dark mode, acessível e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import { api } from "../../services/api";
import CarregandoSkeleton from "../ui/CarregandoSkeleton";
import NadaEncontrado from "../ui/NadaEncontrado";
import { notifyError } from "../ui/AppToast";
import ListaTurmasPresenca from "./ListaTurmasPresenca";

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ymd(value) {
  const safe = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);

  return "";
}

function hojeLocalISO() {
  const data = new Date();
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatarDataBR(value) {
  const data = ymd(value);

  if (!data) return "—";

  const [year, month, day] = data.split("-");
  return `${day}/${month}/${year}`;
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function unwrapData(response) {
  return response?.data !== undefined ? response.data : response;
}

function unwrapEventos(response) {
  const data = unwrapData(response);

  if (Array.isArray(data?.eventos)) return data.eventos;
  if (Array.isArray(data)) return data;

  return [];
}

function unwrapArray(response) {
  const data = unwrapData(response);

  return Array.isArray(data) ? data : [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("abort") ||
    message.includes("aborted") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

function turmaTemEncontroNoDia(turma, dataISO) {
  if (!turma || !dataISO) return false;

  const datas = [
    ...(Array.isArray(turma?.datas) ? turma.datas : []),
    ...(Array.isArray(turma?.encontros) ? turma.encontros : []),
  ];

  return datas.some((item) => ymd(item?.data || item) === dataISO);
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────────────────────── */

function MiniStat({ label, value, icon: Icon, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-white/10 text-white",
    emerald: "border-emerald-200/20 bg-emerald-400/15 text-white",
    amber: "border-amber-200/20 bg-amber-400/15 text-white",
    cyan: "border-cyan-200/20 bg-cyan-400/15 text-white",
  };

  return (
    <article
      className={classNames(
        "rounded-3xl border p-3 text-left shadow-sm backdrop-blur",
        tones[tone] || tones.default
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-white/75">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>

      <div className="mt-1 text-2xl font-black leading-none tracking-tight">
        {value}
      </div>
    </article>
  );
}

function HeaderHero({ onRefresh, refreshing, kpis }) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-800 to-cyan-700" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_28%,rgba(125,211,252,0.22),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.20),transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[960px] max-w-[95vw] -translate-x-1/2 rounded-full bg-cyan-300/25 blur-3xl"
      />

      <a
        href="#conteudo-presencas-turma"
        className="relative sr-only px-3 py-2 text-sm focus:not-sr-only focus:block focus:bg-white/20 focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-end">
          <div className="min-w-0 text-center lg:text-left">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Presenças por turma v2.0
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Registro manual de presenças
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
              Gerencie presenças por turma, consulte inscritos e acompanhe
              avaliações vinculadas ao fluxo de eventos.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black text-white shadow-sm transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  refreshing
                    ? "cursor-not-allowed bg-white/20 opacity-70"
                    : "bg-white/15 hover:bg-white/25"
                )}
                aria-label="Atualizar lista de eventos e turmas"
                aria-busy={refreshing ? "true" : "false"}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                {refreshing ? "Atualizando..." : "Atualizar"}
              </button>

              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15 sm:text-sm">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Contrato oficial
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Eventos"
              value={kpis.eventos}
              icon={CalendarDays}
              tone="cyan"
            />

            <MiniStat
              label="Turmas"
              value={kpis.turmas}
              icon={Users}
              tone="emerald"
            />

            <MiniStat
              label="Turmas hoje"
              value={kpis.turmasHoje}
              icon={CalendarClock}
              tone="amber"
            />

            <MiniStat
              label="Data"
              value={kpis.dataHoje}
              icon={CalendarDays}
              tone="default"
            />
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────────────────────── */

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const hojeISO = useMemo(() => hojeLocalISO(), []);
  const hoje = useMemo(() => {
    const [year, month, day] = hojeISO.split("-").map(Number);

    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }, [hojeISO]);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      try {
        abortRef.current?.abort?.("unmount");
      } catch {
        // noop
      }
    };
  }, []);

  const carregarEventosETurmas = useCallback(async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      setErro("");
      setLive("Carregando eventos e turmas.");

      try {
        abortRef.current?.abort?.("new-request");
      } catch {
        // noop
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await api.presenca.administrador({
        signal: controller.signal,
      });

      const lista = unwrapEventos(response);

      if (!mountedRef.current) return;

      setEventos(lista);
      setLive(`Lista atualizada. ${lista.length} evento(s).`);
    } catch (error) {
      if (isAbortLike(error)) return;

      const message = getErrorMessage(error, "Erro ao carregar turmas.");

      if (!mountedRef.current) return;

      setErro(message);
      setEventos([]);
      notifyError(message);
      setLive("Erro ao carregar eventos e turmas.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    carregarEventosETurmas();
  }, [carregarEventosETurmas]);

  const carregarInscritos = useCallback(
    async (turma_id) => {
      const turmaIdSeguro = toPositiveInt(turma_id);

      if (!turmaIdSeguro) {
        notifyError("turma_id inválido para carregar inscritos.");
        return;
      }

      try {
        setLive(`Carregando inscritos da turma ${turmaIdSeguro}.`);

        const response = await api.inscricao.listarPorTurma(turmaIdSeguro, {
          on403: "silent",
        });

        const lista = unwrapArray(response);

        if (!mountedRef.current) return;

        setInscritosPorTurma((prev) => ({
          ...prev,
          [turmaIdSeguro]: lista,
        }));

        setLive(`Inscritos da turma ${turmaIdSeguro} carregados.`);
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao carregar inscritos."));

        setInscritosPorTurma((prev) => ({
          ...prev,
          [turmaIdSeguro]: [],
        }));

        setLive("Erro ao carregar inscritos.");
      }
    },
    [setLive]
  );

  const carregarAvaliacao = useCallback(
    async (turma_id) => {
      const turmaIdSeguro = toPositiveInt(turma_id);

      if (!turmaIdSeguro) return;

      try {
        if (typeof api.avaliacao?.porTurma !== "function") {
          setAvaliacaoPorTurma((prev) => ({
            ...prev,
            [turmaIdSeguro]: [],
          }));
          return;
        }

        setLive(`Carregando avaliações da turma ${turmaIdSeguro}.`);

        const response = await api.avaliacao.porTurma(turmaIdSeguro, {
          on403: "silent",
        });

        const lista = unwrapArray(response);

        if (!mountedRef.current) return;

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turmaIdSeguro]: lista,
        }));

        setLive(`Avaliações da turma ${turmaIdSeguro} carregadas.`);
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao carregar avaliações."));

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turmaIdSeguro]: [],
        }));

        setLive("Erro ao carregar avaliações.");
      }
    },
    [setLive]
  );

  const handleTurmaRemovida = useCallback(async () => {
    await carregarEventosETurmas();
  }, [carregarEventosETurmas]);

  const kpis = useMemo(() => {
    let totalTurmas = 0;
    let turmasHoje = 0;

    for (const evento of eventos) {
      const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

      totalTurmas += turmas.length;

      for (const turma of turmas) {
        if (turmaTemEncontroNoDia(turma, hojeISO)) {
          turmasHoje += 1;
        }
      }
    }

    return {
      eventos: eventos.length,
      turmas: totalTurmas,
      turmasHoje,
      dataHoje: formatarDataBR(hojeISO),
    };
  }, [eventos, hojeISO]);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <HeaderHero
        onRefresh={carregarEventosETurmas}
        refreshing={refreshing}
        kpis={kpis}
      />

      {refreshing && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-emerald-100 dark:bg-emerald-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Atualizando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-emerald-700 dark:bg-emerald-500" />
        </div>
      )}

      <main
        id="conteudo-presencas-turma"
        className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 lg:px-6"
      >
        <p
          ref={liveRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        {erro && !loading ? (
          <section
            className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-center shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30"
            role="alert"
            aria-live="assertive"
          >
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>

            <h2 className="text-base font-black text-rose-900 dark:text-rose-100">
              Não foi possível carregar as turmas
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm text-rose-800/90 dark:text-rose-100/90">
              {erro}
            </p>

            <button
              type="button"
              onClick={carregarEventosETurmas}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
          </section>
        ) : loading ? (
          <CarregandoSkeleton texto="Carregando eventos e turmas..." linhas={6} />
        ) : eventos.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhuma turma encontrada"
            subtitulo="Verifique se há eventos e turmas cadastrados."
            acaoLabel="Atualizar"
            onAcao={carregarEventosETurmas}
          />
        ) : (
          <ListaTurmasPresenca
            eventos={eventos}
            hoje={hoje}
            inscritosPorTurma={inscritosPorTurma}
            avaliacaoPorTurma={avaliacaoPorTurma}
            carregarInscritos={carregarInscritos}
            carregarAvaliacao={carregarAvaliacao}
            modoadministradorPresencas
            onTurmaRemovida={handleTurmaRemovida}
            mostrarBotaoRemover
          />
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PropTypes
 * ───────────────────────────────────────────────────────────── */

MiniStat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType,
  tone: PropTypes.oneOf(["default", "emerald", "amber", "cyan"]),
};

HeaderHero.propTypes = {
  onRefresh: PropTypes.func.isRequired,
  refreshing: PropTypes.bool,
  kpis: PropTypes.shape({
    eventos: PropTypes.number,
    turmas: PropTypes.number,
    turmasHoje: PropTypes.number,
    dataHoje: PropTypes.string,
  }).isRequired,
};