// ✅ frontend/src/pages/MinhasPresencas.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página do usuário para consulta das próprias presenças.
//
// Contratos aplicados:
// - Presença oficial: api.presenca.minhas()
// - Sem apiGetMinhasPresencas legado
// - Sem Footer antigo
// - Sem BotaoPrimario antigo
// - Sem CarregandoSkeleton antigo
// - Sem NadaEncontrado antigo
// - Sem bg-gelo
// - Sem style inline
// - Sem new Date("YYYY-MM-DD")
// - Status oficial: programado | andamento | encerrado
// - "todos" é apenas filtro visual
// - Frequência mínima oficial: 75%
// - Date-only seguro em YYYY-MM-DD
// - Visual v2.0 real, mobile-first, acessível, dark mode e aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Home,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";

import HeaderHero from "../components/layout/HeaderHero";
import Footer from "../components/layout/Footer";
import { api } from "../services/api";

const CERT_THRESHOLD = 75;

const STATUS_FILTRO = Object.freeze({
  TODOS: "todos",
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
});

const ORDENACAO = Object.freeze({
  RECENTES: "recentes",
  ANTIGOS: "antigos",
  TITULO: "titulo",
});

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function ymd(value) {
  const safe = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);

  return "";
}

function formatarDataBR(value) {
  const data = ymd(value);

  if (!data) return "—";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(value) {
  const safe = String(value || "").trim();

  if (/^\d{2}:\d{2}$/.test(safe)) return safe;
  if (/^\d{2}:\d{2}:\d{2}$/.test(safe)) return safe.slice(0, 5);

  return "";
}

function cmpYmdDesc(a, b) {
  if (a < b) return 1;
  if (a > b) return -1;
  return 0;
}

function cmpYmdAsc(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

function clampPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(100, number));
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

function unwrapTurmas(response) {
  const data = response?.data !== undefined ? response.data : response;

  if (Array.isArray(data?.turmas)) return data.turmas;
  if (Array.isArray(data)) return data;

  return [];
}

function statusInfo(status) {
  const safe = String(status || "").trim().toLowerCase();

  if (safe === STATUS_FILTRO.PROGRAMADO) {
    return {
      tone: "success",
      label: "Programado",
      bar: "bg-emerald-600",
      icon: Clock,
    };
  }

  if (safe === STATUS_FILTRO.ANDAMENTO) {
    return {
      tone: "warn",
      label: "Em andamento",
      bar: "bg-amber-500",
      icon: Clock,
    };
  }

  if (safe === STATUS_FILTRO.ENCERRADO) {
    return {
      tone: "danger",
      label: "Encerrado",
      bar: "bg-rose-600",
      icon: ShieldCheck,
    };
  }

  return {
    tone: "default",
    label: "Sem status",
    bar: "bg-slate-400",
    icon: Clock,
  };
}

function extrairDatasPresentes(turma) {
  const datas = turma?.datas?.presentes;

  return Array.isArray(datas) ? datas.map(ymd).filter(Boolean) : [];
}

function extrairDatasAusencias(turma) {
  const diretas =
    turma?.datas?.ausencias ||
    turma?.datas?.ausentes ||
    turma?.datas_ausencias ||
    turma?.datasAusencias;

  if (Array.isArray(diretas) && diretas.length) {
    return diretas.map(ymd).filter(Boolean);
  }

  const todas =
    turma?.datas?.todas ||
    turma?.datas?.encontros ||
    turma?.datas?.aulas ||
    turma?.encontros ||
    turma?.todas_datas ||
    turma?.datas_encontros;

  if (!Array.isArray(todas) || todas.length === 0) {
    return [];
  }

  const presentes = new Set(extrairDatasPresentes(turma));

  return todas
    .map(ymd)
    .filter(Boolean)
    .filter((data) => !presentes.has(data));
}

function calcularAusencias(turma) {
  const total = Number(turma?.total_encontros || 0);
  const presentes = Number(turma?.presentes || 0);

  const derivadas = Math.max(0, total - presentes);

  const datasAusencias = extrairDatasAusencias(turma);

  if (datasAusencias.length > 0) {
    return datasAusencias.length;
  }

  return derivadas;
}

function getPeriodoInicio(turma) {
  return ymd(turma?.periodo?.data_inicio || turma?.data_inicio);
}

function getPeriodoFim(turma) {
  return ymd(turma?.periodo?.data_fim || turma?.data_fim);
}

function getPeriodoLabel(turma) {
  const inicio = getPeriodoInicio(turma);
  const fim = getPeriodoFim(turma);
  const horaInicio = formatarHora(turma?.periodo?.horario_inicio || turma?.horario_inicio);
  const horaFim = formatarHora(turma?.periodo?.horario_fim || turma?.horario_fim);

  const inicioLabel = `${formatarDataBR(inicio)}${horaInicio ? ` às ${horaInicio}` : ""}`;
  const fimLabel = `${formatarDataBR(fim)}${horaFim ? ` às ${horaFim}` : ""}`;

  if (!inicio && !fim) return "Período a definir";
  if (inicio && fim && inicio === fim) {
    return `${formatarDataBR(inicio)}${horaInicio ? ` • ${horaInicio}` : ""}${horaFim ? ` às ${horaFim}` : ""}`;
  }

  return `${inicioLabel} — ${fimLabel}`;
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais v2.0
 * ───────────────────────────────────────────────────────────── */

function LoadingInline({ label = "Carregando..." }) {
  return (
    <div
      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function PresencaResumoPremium({ kpis }) {
  return (
    <section className="mx-auto mt-4 grid w-full max-w-7xl grid-cols-1 gap-3 px-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4 lg:px-6">
      <MiniStatCard
        icon={Layers}
        label="Turmas"
        value={kpis.turmas}
        description="na sua lista"
        tone="cyan"
      />

      <MiniStatCard
        icon={ShieldCheck}
        label="Encerradas"
        value={kpis.encerradas}
        description="com apuração"
        tone="rose"
      />

      <MiniStatCard
        icon={Award}
        label="Elegíveis"
        value={kpis.elegiveis}
        description="certificação"
        tone="amber"
      />

      <MiniStatCard
        icon={CheckCircle2}
        label="≥ 75%"
        value={kpis.acima75}
        description="frequência mínima"
        tone="emerald"
      />
    </section>
  );
}

function MiniStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "emerald",
}) {
  const toneMap = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    rose:
      "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100",
  };

  return (
    <article
      className={classNames(
        "rounded-[1.75rem] border p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg dark:ring-white/10",
        toneMap[tone] || toneMap.emerald
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
            {label}
          </p>

          <p className="mt-1 text-3xl font-black leading-none tracking-tight">
            {value}
          </p>

          <p className="mt-1 text-xs font-semibold opacity-70">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function Badge({ children, tone = "default", title }) {
  const map = {
    default:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    warn:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    danger:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
    info: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  };

  return (
    <span
      title={title}
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
        map[tone] || map.default
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value = 0, threshold = CERT_THRESHOLD }) {
  const pct = clampPercent(value);
  const ok = pct >= threshold;

  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      role="meter"
      aria-valuenow={Number(pct.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${pct.toFixed(1)}%`}
    >
      <div
        className={classNames(
          "h-full rounded-full transition-[width] duration-500",
          ok ? "bg-emerald-600 dark:bg-emerald-500" : "bg-rose-600 dark:bg-rose-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ToolbarFiltros({
  busca,
  setBusca,
  statusFiltro,
  setStatusFiltro,
  ordenarPor,
  setOrdenarPor,
  limparFiltros,
  filtrosAtivos,
  totalVisualizado,
}) {
  return (
    <section
      aria-label="Ferramentas de busca e filtros"
      className="sticky top-1 z-30 mx-auto mb-5 w-full max-w-7xl rounded-[1.75rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block">
          <span className="sr-only">Buscar por evento, turma ou ID</span>

          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />

          <input
            type="search"
            autoComplete="off"
            placeholder="Buscar por evento, turma ou ID..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filtros
          </span>

          <select
            value={statusFiltro}
            onChange={(event) => setStatusFiltro(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos</option>
            <option value="programado">Programados</option>
            <option value="andamento">Em andamento</option>
            <option value="encerrado">Encerrados</option>
          </select>

          <select
            value={ordenarPor}
            onChange={(event) => setOrdenarPor(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Ordenar presenças"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="titulo">Título A-Z</option>
          </select>

          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex h-10 items-center gap-1 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Limpar filtros"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>
          {totalVisualizado} turma{totalVisualizado === 1 ? "" : "s"} na visualização
        </span>

        <span className="inline-flex items-center gap-1">
          {ordenarPor === "recentes" ? (
            <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden="true" />
          ) : ordenarPor === "antigos" ? (
            <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Ordenação ativa
        </span>
      </div>
    </section>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
        <CalendarDays className="h-7 w-7" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-black text-slate-950 dark:text-white">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>

      {actionLabel && typeof onAction === "function" && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function PresencaCard({ turma, index, reduceMotion }) {
  const status = statusInfo(turma?.status);
  const StatusIcon = status.icon;

 const total = Number(turma?.total_encontros || 0);
const presentes = Number(turma?.presentes || 0);
const ausencias = calcularAusencias(turma);

  const freq = clampPercent(turma?.frequencia);
  const encerrado = String(turma?.status || "").toLowerCase() === "encerrado";

  const meets75 =
    turma?.elegivel_avaliacao === true ||
    turma?.pre_elegivel_avaliacao === true ||
    (freq >= CERT_THRESHOLD && encerrado);

  const datasPresentes = extrairDatasPresentes(turma);
  const datasAusencias = extrairDatasAusencias(turma);
  const precisaFallbackAusencia =
    (!datasAusencias || datasAusencias.length === 0) && ausencias > 0;

  return (
    <motion.article
      role="listitem"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      exit={reduceMotion ? {} : { opacity: 0, y: 6 }}
      transition={{ duration: 0.22, delay: Math.min(0.12, index * 0.02) }}
      className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
    >
      <div
        className={classNames("absolute left-0 right-0 top-0 h-1.5", status.bar)}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 pt-1">
          <h2 className="break-words text-lg font-black leading-snug tracking-tight text-slate-950 dark:text-white">
            {turma?.evento_titulo || "Evento"}
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Turma:{" "}
            <span className="font-black text-slate-800 dark:text-slate-100">
              {turma?.turma_nome || `#${turma?.turma_id || "—"}`}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} title="Status da turma">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {status.label}
          </Badge>

          {meets75 && (
            <Badge tone="success" title="Elegível conforme regra da turma">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              Elegível
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        <span>{getPeriodoLabel(turma)}</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-800/70">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-300">
            Encontros
          </div>
          <div className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            {total}
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/35">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-200">
            Presentes
          </div>
          <div className="mt-1 text-xl font-black text-emerald-800 dark:text-emerald-100">
            {presentes}
          </div>
        </div>

        <div className="rounded-2xl bg-rose-50 p-3 text-center dark:bg-rose-950/35">
          <div className="text-xs font-bold text-rose-700 dark:text-rose-200">
            Ausências
          </div>
          <div className="mt-1 text-xl font-black text-rose-800 dark:text-rose-100">
            {ausencias}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Frequência
          </span>

          <span
            className={classNames(
              "font-black",
              freq >= CERT_THRESHOLD
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            )}
          >
            {freq.toFixed(1)}%
          </span>
        </div>

        <ProgressBar value={freq} threshold={CERT_THRESHOLD} />

        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {freq >= CERT_THRESHOLD
            ? "Requisito mínimo de 75% atendido."
            : "Atenção: frequência abaixo do requisito mínimo de 75%."}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-black">Datas com presença</span>
          </div>

          {datasPresentes.length ? (
            <div className="flex flex-wrap gap-2">
              {datasPresentes.map((data) => (
                <span
                  key={data}
                  className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  {formatarDataBR(data)}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Nenhuma data confirmada.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-black">Datas de ausência</span>
          </div>

          {datasAusencias.length ? (
            <div className="flex flex-wrap gap-2">
              {datasAusencias.map((data) => (
                <span
                  key={data}
                  className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                >
                  {formatarDataBR(data)}
                </span>
              ))}
            </div>
          ) : precisaFallbackAusencia ? (
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {ausencias === 1
                ? "1 ausência registrada sem data detalhada."
                : `${ausencias} ausências registradas sem datas detalhadas.`}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Nenhuma ausência registrada.
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function MinhasPresencas() {
  const reduceMotion = useReducedMotion();

  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState(STATUS_FILTRO.TODOS);
  const [ordenarPor, setOrdenarPor] = useState(ORDENACAO.RECENTES);

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
const requestIdRef = useRef(0);
const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
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

  const carregar = useCallback(async () => {
  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;

  try {
    setErro("");
    setLoading(true);
      setLive("Carregando suas presenças.");

      try {
        abortRef.current?.abort?.("new-request");
      } catch {
        // noop
      }

      setErro("");
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await api.presenca.minhas({
        signal: controller.signal,
      });

      const lista = unwrapTurmas(response);

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setTurmas(lista);
      setLive(`Presenças carregadas: ${lista.length} turma(s).`);
    } catch (error) {
      if (isAbortLike(error)) {
  return;
}

      const message = getErrorMessage(error, "Falha ao carregar suas presenças.");

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

setErro(message);
      setTurmas([]);
      setLive("Falha ao carregar suas presenças.");

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
  setLoading(false);
}
    }
  }, [setLive]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const kpis = useMemo(() => {
    let encerradas = 0;
    let elegiveis = 0;
    let acima75 = 0;

    for (const turma of turmas) {
      const status = String(turma?.status || "").toLowerCase();
      const freq = clampPercent(turma?.frequencia);
      const encerrado = status === STATUS_FILTRO.ENCERRADO;

      if (encerrado) encerradas += 1;
      if (freq >= CERT_THRESHOLD) acima75 += 1;

      if (
        turma?.elegivel_avaliacao === true ||
        turma?.pre_elegivel_avaliacao === true ||
        (freq >= CERT_THRESHOLD && encerrado)
      ) {
        elegiveis += 1;
      }
    }

    return {
      turmas: String(turmas.length),
      encerradas: String(encerradas),
      elegiveis: String(elegiveis),
      acima75: String(acima75),
    };
  }, [turmas]);

  const q = useMemo(() => normalizarTexto(busca), [busca]);

  const turmasFiltradas = useMemo(() => {
    const base = (Array.isArray(turmas) ? turmas : []).filter((turma) => {
      const status = String(turma?.status || "").toLowerCase();

      if (statusFiltro !== STATUS_FILTRO.TODOS && status !== statusFiltro) {
        return false;
      }

      if (!q) return true;

      return (
        normalizarTexto(turma?.evento_titulo).includes(q) ||
        normalizarTexto(turma?.turma_nome).includes(q) ||
        String(turma?.turma_id ?? "").toLowerCase().includes(q)
      );
    });

    return base.slice().sort((a, b) => {
      if (ordenarPor === ORDENACAO.TITULO) {
        const byTitle = String(a?.evento_titulo || "").localeCompare(
          String(b?.evento_titulo || ""),
          "pt-BR",
          { sensitivity: "base" }
        );

        if (byTitle !== 0) return byTitle;
      }

      const aFim = getPeriodoFim(a) || getPeriodoInicio(a) || "";
      const bFim = getPeriodoFim(b) || getPeriodoInicio(b) || "";

      if (ordenarPor === ORDENACAO.ANTIGOS) return cmpYmdAsc(aFim, bFim);

      return cmpYmdDesc(aFim, bFim);
    });
  }, [ordenarPor, q, statusFiltro, turmas]);

  const filtrosAtivos =
    !!busca.trim() ||
    statusFiltro !== STATUS_FILTRO.TODOS ||
    ordenarPor !== ORDENACAO.RECENTES;

  const limparFiltros = useCallback(() => {
    setBusca("");
    setStatusFiltro(STATUS_FILTRO.TODOS);
    setOrdenarPor(ORDENACAO.RECENTES);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div className="mx-auto w-full max-w-7xl px-3 pt-5 sm:px-4 lg:px-6">
  <HeaderHero
    titulo="Minhas presenças"
    subtitulo="Consulte sua frequência por turma, acompanhe ausências e veja se você atingiu o requisito mínimo para avaliação e certificado."
    icone={CheckCircle2}
    tamanho="lg"
    raio="xl"
  />
</div>

<section className="mx-auto mt-4 flex w-full max-w-7xl flex-col gap-3 px-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
  <div>
    <h2 className="text-base font-black text-slate-950 dark:text-white">
      Acompanhe suas frequências
    </h2>

    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
      Consulte presenças, ausências e elegibilidade para certificado.
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={carregar}
      disabled={loading}
      className={classNames(
        "inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        loading && "cursor-not-allowed opacity-70"
      )}
    >
      <RefreshCw
        className={classNames("h-4 w-4", loading && "animate-spin")}
        aria-hidden="true"
      />

      {loading ? "Atualizando..." : "Atualizar dados"}
    </button>
  </div>
</section>

<PresencaResumoPremium kpis={kpis} />

      {loading && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-emerald-100 dark:bg-emerald-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando presenças"
        >
          <div className="h-full w-1/3 animate-pulse bg-emerald-700 dark:bg-emerald-500" />
        </div>
      )}

      <main
        id="conteudo"
        role="main"
        className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-4 lg:px-6"
      >
        {erro && !loading && (
          <section
            ref={erroRef}
            tabIndex={-1}
            className="mb-5 rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 outline-none dark:border-rose-900/50 dark:bg-rose-950/30"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h2 className="text-base font-black text-rose-900 dark:text-rose-100">
                  Não foi possível carregar suas presenças
                </h2>

                <p className="mt-1 break-words text-sm text-rose-800/90 dark:text-rose-100/90">
                  {erro}
                </p>

                <button
                  type="button"
                  onClick={carregar}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <section
            className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
            aria-busy="true"
            aria-live="polite"
          >
            <LoadingInline label="Carregando suas presenças..." />
          </section>
        ) : !erro && turmas.length === 0 ? (
          <EmptyState
            title="Nenhuma presença encontrada"
            description="Você ainda não possui turmas com presença registrada ou retornada pelo sistema."
            actionLabel="Atualizar"
            onAction={carregar}
          />
        ) : !erro ? (
          <>
            <ToolbarFiltros
              busca={busca}
              setBusca={setBusca}
              statusFiltro={statusFiltro}
              setStatusFiltro={setStatusFiltro}
              ordenarPor={ordenarPor}
              setOrdenarPor={setOrdenarPor}
              limparFiltros={limparFiltros}
              filtrosAtivos={filtrosAtivos}
              totalVisualizado={turmasFiltradas.length}
            />

            {turmasFiltradas.length === 0 ? (
              <EmptyState
                title="Nenhum resultado"
                description="Nenhuma turma corresponde aos filtros atuais."
                actionLabel="Limpar filtros"
                onAction={limparFiltros}
              />
            ) : (
              <div
                role="list"
                className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2"
              >
                <AnimatePresence>
                  {turmasFiltradas.map((turma, index) => (
                    <PresencaCard
                      key={turma?.turma_id ?? `${turma?.evento_titulo}-${index}`}
                      turma={turma}
                      index={index}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}