// 📁 src/pages/CursoTeste.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página:
// - Testes do curso.
//
// Função:
// - Listar testes disponíveis, em andamento, bloqueados e concluídos;
// - exibir métricas do usuário;
// - iniciar teste disponível;
// - orientar regras antes do início.
//
// Contratos oficiais esperados:
// - GET  /api/teste/metricas
// - GET  /api/teste/lista
// - POST /api/teste/iniciar
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem apiGet/apiPost direto;
// - sem Footer antigo;
// - sem Modal local duplicado;
// - sem rota com /api embutido;
// - sem fallback/demo silencioso;
// - resposta padrão ok/data/message/code/meta;
// - anti-fuso: date-only em YYYY-MM-DD, horário de parede tratado localmente;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - dark mode global via escola_theme/boot-theme.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  Info,
  Loader2,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  X,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import Modal from "../components/ui/Modal";
import NadaEncontrado from "../components/ui/NadaEncontrado";

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_TESTE = new Set([
  "disponivel",
  "andamento",
  "concluido",
  "bloqueado",
]);

const PAGE_SIZE_OPTIONS = [6, 8, 12, 20];

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizarStatusTeste(status) {
  const value = String(status || "").trim().toLowerCase();

  return STATUS_TESTE.has(value) ? value : "bloqueado";
}

function parseLocalDateTime(raw) {
  const s = String(raw || "").trim();

  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || 0);

    return new Date(year, month - 1, day, hour, minute, second, 0);
  }

  const fallback = new Date(s);

  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function fmtDateTimeBR(raw, { withTime = true } = {}) {
  const date = parseLocalDateTime(raw);

  if (!date) return "—";

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();

  if (!withTime) return `${day}/${month}/${year}`;

  return `${day}/${month}/${year} ${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;
}

function unwrapData(response) {
  if (
    response?.data &&
    typeof response.data === "object" &&
    "ok" in response.data
  ) {
    return response.data.data;
  }

  if (response && typeof response === "object" && "ok" in response) {
    return response.data;
  }

  return response?.data || response || null;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function notaTexto(value) {
  const nota = Number(value);

  if (!Number.isFinite(nota)) return "—";

  return `${nota.toFixed(1)} / 10`;
}

function periodoTexto(teste) {
  return `${fmtDateTimeBR(teste?.inicio)} — ${fmtDateTimeBR(teste?.fim)}`;
}

function podeIniciarTeste(teste) {
  const status = normalizarStatusTeste(teste?.status);

  return status === "disponivel" || status === "andamento";
}

/* =========================================================================
   UI local
=========================================================================== */

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    warning: {
      icon: AlertCircle,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Badge({ status }) {
  const normalized = normalizarStatusTeste(status);

  const map = {
    disponivel:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/35 dark:text-sky-200",
    andamento:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/35 dark:text-amber-200",
    concluido:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/35 dark:text-emerald-200",
    bloqueado:
      "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/35 dark:text-rose-200",
  };

  const label = {
    disponivel: "Disponível",
    andamento: "Em andamento",
    concluido: "Concluído",
    bloqueado: "Bloqueado",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        map[normalized] || map.bloqueado
      )}
    >
      {label[normalized] || "Bloqueado"}
    </span>
  );
}

function ActionButton({
  children,
  icon: Icon,
  loading = false,
  variant = "primary",
  className = "",
  ...props
}) {
  const variants = {
    primary:
      "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500",
    secondary:
      "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
    hero:
      "border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20",
    heroPrimary:
      "border-white bg-white text-indigo-950 shadow-md hover:bg-indigo-50",
  };

  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant] || variants.primary,
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      {children}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  loading = false,
  tone = "indigo",
}) {
  const tones = {
    indigo:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/35 dark:text-indigo-200",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200",
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/35 dark:text-sky-200",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
            tones[tone] || tones.indigo
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Icon className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
            {loading ? "—" : value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Progress({ value = 0, label = "Progresso" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div role="group" aria-label={label}>
      <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-zinc-300">
        <span>{label}</span>
        <span>{v}%</span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${v}%` }}
        />
      </div>

      <div
        className="sr-only"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function HeaderHero({ onRefresh, loading }) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-800"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.65)_1px,transparent_0)] [background-size:18px_18px]"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white/20 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <Sparkles
                className="h-3.5 w-3.5 text-indigo-200"
                aria-hidden="true"
              />
              Avaliação objetiva • testes do curso
            </div>

            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                <ClipboardCheck className="h-7 w-7" aria-hidden="true" />
              </span>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Teste do Curso
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/85 sm:text-base">
                  Consulte testes disponíveis, continue tentativas em andamento e acompanhe seus resultados.
                </p>
              </div>
            </div>
          </div>

          <ActionButton
            onClick={onRefresh}
            loading={loading}
            disabled={loading}
            variant="hero"
            className="w-full sm:w-auto"
            aria-label="Atualizar testes"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </ActionButton>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

/* =========================================================================
   Lista de testes
=========================================================================== */

function ListaTestes({ testes, onStart, loadingStartId }) {
  if (!testes.length) {
    return (
      <NadaEncontrado
        mensagem="Nenhum teste disponível no momento."
        sugestao="Quando houver teste habilitado para seus cursos, ele aparecerá nesta página."
      />
    );
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        <AnimatePresence initial={false}>
          {testes.map((teste) => {
            const status = normalizarStatusTeste(teste.status);
            const canStart = podeIniciarTeste(teste);
            const loading = loadingStartId === teste.id;

            return (
              <motion.article
                key={teste.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-black text-slate-950 dark:text-white">
                      {teste.curso || "Curso sem título"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                      {teste.turma || "Turma não informada"}
                    </p>
                  </div>

                  <Badge status={status} />
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-zinc-300">
                  <p>
                    <span className="font-black">Disponibilidade:</span>{" "}
                    {periodoTexto(teste)}
                  </p>
                  <p>
                    <span className="font-black">Nota:</span>{" "}
                    {status === "concluido" ? notaTexto(teste.nota) : "—"}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  {canStart ? (
                    <ActionButton
                      onClick={() => onStart(teste)}
                      icon={Play}
                      loading={loading}
                      disabled={Boolean(loadingStartId)}
                      className="w-full"
                    >
                      {status === "andamento" ? "Continuar" : "Iniciar"}
                    </ActionButton>
                  ) : (
                    <span className="text-xs italic text-slate-500 dark:text-zinc-400">
                      {status === "concluido"
                        ? "Teste finalizado."
                        : "Teste indisponível."}
                    </span>
                  )}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600 dark:border-zinc-800 dark:text-zinc-300">
                <th className="py-3 pr-4 font-black">Curso / Turma</th>
                <th className="py-3 pr-4 font-black">Disponibilidade</th>
                <th className="py-3 pr-4 font-black">Status</th>
                <th className="py-3 pr-4 font-black">Nota</th>
                <th className="py-3 pr-4 font-black">Ações</th>
              </tr>
            </thead>

            <tbody>
              {testes.map((teste) => {
                const status = normalizarStatusTeste(teste.status);
                const canStart = podeIniciarTeste(teste);
                const loading = loadingStartId === teste.id;

                return (
                  <tr
                    key={teste.id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800/70"
                  >
                    <td className="py-3 pr-4 align-top">
                      <div className="max-w-[320px] break-words font-black text-slate-900 dark:text-white">
                        {teste.curso || "Curso sem título"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                        {teste.turma || "Turma não informada"}
                      </div>
                    </td>

                    <td className="py-3 pr-4 align-top">
                      <div className="text-xs text-slate-600 dark:text-zinc-300">
                        {periodoTexto(teste)}
                      </div>
                    </td>

                    <td className="py-3 pr-4 align-top">
                      <Badge status={status} />
                    </td>

                    <td className="py-3 pr-4 align-top font-semibold">
                      {status === "concluido" ? notaTexto(teste.nota) : "—"}
                    </td>

                    <td className="py-3 pr-4 align-top">
                      {canStart ? (
                        <ActionButton
                          onClick={() => onStart(teste)}
                          icon={Play}
                          loading={loading}
                          disabled={Boolean(loadingStartId)}
                          className="px-3 py-2"
                        >
                          {status === "andamento" ? "Continuar" : "Iniciar"}
                        </ActionButton>
                      ) : (
                        <span className="text-xs italic text-slate-500 dark:text-zinc-400">
                          {status === "concluido" ? "Finalizado" : "Bloqueado"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function Teste() {
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [loadingStartId, setLoadingStartId] = useState(null);

  const [stats, setStats] = useState({
    disponiveis: 0,
    emAndamento: 0,
    concluidos: 0,
    notaMedia: 0,
  });

  const [testes, setTestes] = useState([]);
  const [mensagem, setMensagem] = useState(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);

  const [openModal, setOpenModal] = useState(false);
  const [testeSelecionado, setTesteSelecionado] = useState(null);

  const liveRef = useRef(null);
  const buscaRef = useRef(null);

  function setLive(text) {
    if (liveRef.current) {
      liveRef.current.textContent = text;
    }
  }

  const fetchTudo = useCallback(async () => {
    setLoading(true);
    setMensagem(null);
    setLive("Carregando testes do curso.");

    try {
      const [metricasResponse, listaResponse] = await Promise.all([
        api.get("/teste/metricas"),
        api.get("/teste/lista"),
      ]);

      const metricas = unwrapData(metricasResponse) || {};
      const lista = unwrapData(listaResponse);

      setStats({
        disponiveis: Number(metricas.disponiveis || 0),
        emAndamento: Number(metricas.emAndamento || 0),
        concluidos: Number(metricas.concluidos || 0),
        notaMedia: Number(metricas.notaMedia || 0),
      });

      setTestes(Array.isArray(lista) ? lista : []);
      setLive("Testes carregados com sucesso.");
    } catch (error) {
      setStats({
        disponiveis: 0,
        emAndamento: 0,
        concluidos: 0,
        notaMedia: 0,
      });
      setTestes([]);

      setMensagem({
        type: "error",
        title: "Erro ao carregar testes",
        message: getErrorMessage(
          error,
          "Não foi possível carregar os testes. Verifique sua conexão e tente novamente."
        ),
      });

      setLive("Falha ao carregar testes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Teste do Curso | Escola da Saúde";
  }, []);

  useEffect(() => {
    fetchTudo();
  }, [fetchTudo]);

  useEffect(() => {
    function handleKey(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag);

      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTyping
      ) {
        event.preventDefault();
        buscaRef.current?.focus?.();
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [busca, filtroStatus, pageSize]);

  const totalItens = useMemo(
    () =>
      Number(stats.concluidos || 0) +
      Number(stats.emAndamento || 0) +
      Number(stats.disponiveis || 0),
    [stats]
  );

  const progressoGeral = useMemo(() => {
    const denom = Math.max(1, totalItens);

    return Math.min(
      100,
      Math.round((Number(stats.concluidos || 0) / denom) * 100)
    );
  }, [stats.concluidos, totalItens]);

  const notaMediaTxt = useMemo(() => notaTexto(stats.notaMedia), [stats.notaMedia]);

  const testesFiltrados = useMemo(() => {
    const termo = String(busca || "").trim().toLowerCase();

    return testes.filter((teste) => {
      const status = normalizarStatusTeste(teste.status);

      if (filtroStatus !== "todos" && status !== filtroStatus) return false;

      if (!termo) return true;

      const haystack = [teste.curso, teste.turma]
        .join(" ")
        .toLowerCase();

      return haystack.includes(termo);
    });
  }, [testes, busca, filtroStatus]);

  const totalPages = Math.max(1, Math.ceil(testesFiltrados.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * pageSize;
  const end = start + pageSize;

  const testesPaginados = useMemo(
    () => testesFiltrados.slice(start, end),
    [testesFiltrados, start, end]
  );

  function abrirModalTeste(teste) {
    setTesteSelecionado(teste);
    setOpenModal(true);
  }

  async function confirmarInicioTeste() {
    if (!testeSelecionado?.id || loadingStartId) return;

    setLoadingStartId(testeSelecionado.id);
    setMensagem(null);
    setLive("Iniciando teste.");

    try {
      const response = await api.post("/teste/iniciar", {
        teste_id: testeSelecionado.id,
      });

      const data = unwrapData(response) || {};

      setOpenModal(false);
      setTesteSelecionado(null);

      setMensagem({
        type: "success",
        title: "Teste iniciado",
        message:
          data?.message ||
          "Teste iniciado com sucesso. Boa prova e atenção ao tempo disponível.",
      });

      setLive("Teste iniciado com sucesso.");

      await fetchTudo();
    } catch (error) {
      setMensagem({
        type: "error",
        title: "Erro ao iniciar teste",
        message: getErrorMessage(
          error,
          "Não foi possível iniciar o teste. Verifique se ele ainda está disponível e tente novamente."
        ),
      });

      setLive("Falha ao iniciar teste.");
    } finally {
      setLoadingStartId(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero onRefresh={fetchTudo} loading={loading} />

      {loading ? (
        <div
          className="sticky left-0 top-0 z-40 h-1 w-full bg-indigo-100 dark:bg-indigo-950/30"
          role="progressbar"
          aria-label="Carregando testes"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-indigo-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <section
        id="conteudo"
        role="main"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6"
      >
        {mensagem ? (
          <div className="mb-5">
            <AlertBox
              type={mensagem.type}
              title={mensagem.title}
              message={mensagem.message}
              onClose={() => setMensagem(null)}
            />
          </div>
        ) : null}

        <section aria-labelledby="metricas" className="mb-6">
          <h2 id="metricas" className="sr-only">
            Métricas dos testes
          </h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat
              icon={FileQuestion}
              label="Disponíveis"
              value={stats.disponiveis}
              loading={loading}
              hint="Prontos para iniciar"
              tone="sky"
            />
            <MiniStat
              icon={Clock3}
              label="Em andamento"
              value={stats.emAndamento}
              loading={loading}
              hint="Tentativas abertas"
              tone="amber"
            />
            <MiniStat
              icon={Award}
              label="Concluídos"
              value={stats.concluidos}
              loading={loading}
              hint="Finalizados"
              tone="emerald"
            />
            <MiniStat
              icon={ShieldCheck}
              label="Nota média"
              value={notaMediaTxt}
              loading={loading}
              hint="Últimos testes concluídos"
              tone="indigo"
            />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    Testes disponíveis / em andamento
                  </h2>
                </div>

                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  Selecione um teste disponível para iniciar ou continue uma tentativa em andamento.
                </p>
              </div>

              <ActionButton
                variant="secondary"
                onClick={fetchTudo}
                loading={loading}
                disabled={loading}
                icon={RefreshCcw}
                className="w-full lg:w-auto"
              >
                Atualizar
              </ActionButton>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="relative block">
                <span className="sr-only">Buscar teste</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="Buscar por curso ou turma... (/)"
                  autoComplete="off"
                />
              </label>

              <select
                value={filtroStatus}
                onChange={(event) => setFiltroStatus(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-950"
                aria-label="Filtrar por status"
              >
                <option value="todos">Todos</option>
                <option value="disponivel">Disponíveis</option>
                <option value="andamento">Em andamento</option>
                <option value="concluido">Concluídos</option>
                <option value="bloqueado">Bloqueados</option>
              </select>

              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(Number(event.target.value) || 8)
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-950"
                aria-label="Itens por página"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}/página
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900"
                    />
                  ))}
                </div>
              ) : (
                <ListaTestes
                  testes={testesPaginados}
                  onStart={abrirModalTeste}
                  loadingStartId={loadingStartId}
                />
              )}
            </div>

            {!loading && testesFiltrados.length > 0 ? (
              <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-zinc-800 sm:flex-row">
                <div className="text-xs text-slate-600 dark:text-zinc-300">
                  Mostrando <strong>{testesPaginados.length}</strong> de{" "}
                  <strong>{testesFiltrados.length}</strong> teste(s)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={pageClamped <= 1}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Anterior
                  </button>

                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    Página {pageClamped} de {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={pageClamped >= totalPages}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </Card>

          <aside className="space-y-5">
            <Card className="lg:sticky lg:top-4">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  Regras e dicas
                </h2>
              </div>

              <ul className="mt-4 space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-black text-white">
                    1
                  </span>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">
                      Tempo e tentativas
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-zinc-300">
                      O teste pode ter limite de tempo e/ou tentativas. Leia as instruções antes de iniciar.
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-black text-white">
                    2
                  </span>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">
                      Conexão
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-zinc-300">
                      Garanta conexão estável. Evite atualizar ou fechar a página durante o teste.
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-black text-white">
                    3
                  </span>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">
                      Certificado
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-zinc-300">
                      Alguns cursos podem exigir nota mínima para emissão de certificado.
                    </div>
                  </div>
                </li>
              </ul>

              <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <Progress value={progressoGeral} label="Progresso geral" />
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <TimerReset className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  Antes de iniciar
                </h2>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                Confira se você tem tempo suficiente para concluir a tentativa. Após iniciar, o sistema poderá registrar a tentativa conforme as regras do curso.
              </p>
            </Card>
          </aside>
        </section>
      </section>

      <Footer />

      <Modal
        open={openModal}
        onClose={loadingStartId ? undefined : () => setOpenModal(false)}
        labelledBy="modal-iniciar-teste-title"
        describedBy="modal-iniciar-teste-desc"
        className="w-[96%] max-w-2xl overflow-hidden p-0"
      >
        <header className="bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-800 px-4 py-4 text-white sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="modal-iniciar-teste-title"
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                Iniciar teste
              </h2>
              <p id="modal-iniciar-teste-desc" className="mt-1 text-sm text-white/85">
                Leia as orientações antes de iniciar a tentativa.
              </p>
            </div>

            <button
              type="button"
              onClick={loadingStartId ? undefined : () => setOpenModal(false)}
              disabled={Boolean(loadingStartId)}
              className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-60"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4 bg-slate-50 p-4 dark:bg-zinc-950 sm:p-6">
          {testeSelecionado ? (
            <>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="font-black text-slate-950 dark:text-white">
                  {testeSelecionado.curso || "Curso sem título"}
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  {testeSelecionado.turma || "Turma não informada"}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                  Disponível: {periodoTexto(testeSelecionado)}
                </div>
              </div>

              <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
                <li className="flex gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                  <span>
                    O cronômetro pode iniciar ao clicar em{" "}
                    <strong>Iniciar teste</strong>.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 flex-none"
                    aria-hidden="true"
                  />
                  <span>
                    Não feche nem atualize a página durante a tentativa, salvo orientação específica da plataforma.
                  </span>
                </li>
              </ul>

              <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenModal(false)}
                  disabled={Boolean(loadingStartId)}
                >
                  Cancelar
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={confirmarInicioTeste}
                  loading={loadingStartId === testeSelecionado.id}
                  disabled={Boolean(loadingStartId)}
                  icon={Play}
                >
                  {loadingStartId === testeSelecionado.id
                    ? "Iniciando..."
                    : "Iniciar teste"}
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              Selecione um teste para iniciar.
            </p>
          )}
        </div>
      </Modal>
    </main>
  );
}