// ✅ frontend/src/pages/QRCodesEventosAdmin.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página administrativa para geração de QR Codes de presença por turma.
//
// Contratos aplicados:
// - Sem toast direto;
// - Sem apiGet direto;
// - Sem /eventos;
// - Sem /turmas/evento/:id;
// - Sem /api manual no frontend;
// - Eventos administrativos via listarEventosAdmin();
// - Turmas do evento via listarTurmasDoEvento(evento_id);
// - QR oficial baseado em turma_id;
// - Footer em src/components/layout/Footer.jsx;
// - CarregandoSkeleton e NadaEncontrado em src/components/ui/;
// - Sem bg-gelo;
// - Sem style inline;
// - Cache curto em sessionStorage;
// - AbortController;
// - Busca por evento, turma e organizador;
// - Visual v2.0 real, mobile-first, dark mode, acessível e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileDown,
  Layers,
  Loader2,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";
import {
  isAbortLike,
  listarEventosAdmin,
  listarTurmasDoEvento,
} from "../services/eventoService";
import { gerarQrCodePresencaPDF } from "../utils/gerarQrCodePresencaPDF.jsx";
import {
  notifyError,
  notifySuccess,
} from "../components/ui/AppToast";

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

const CACHE_KEY = "qr:evento:v2";
const CACHE_TTL_MS = 3 * 60 * 1000;

const STRIPES = [
  "from-emerald-700 to-teal-500",
  "from-sky-700 to-cyan-500",
  "from-indigo-700 to-violet-600",
  "from-pink-700 to-rose-600",
  "from-amber-600 to-yellow-500",
  "from-lime-700 to-green-600",
  "from-fuchsia-700 to-pink-600",
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeStr(value, max = 200) {
  return String(value ?? "").slice(0, max).trim();
}

function tituloEvento(evento) {
  return safeStr(evento?.titulo || `Evento #${evento?.id ?? "—"}`, 170);
}

function tituloTurma(turma) {
  return safeStr(turma?.nome || `Turma #${turma?.id ?? turma?.turma_id ?? "—"}`, 170);
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function hashSeed(value) {
  const str = String(value ?? "");
  let hash = 0;

  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 31 + str.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function stripeClassFor(seed) {
  return STRIPES[hashSeed(seed) % STRIPES.length];
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
      return null;
    }

    return Array.isArray(parsed.eventos) ? parsed.eventos : null;
  } catch {
    return null;
  }
}

function writeCache(eventos) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        eventos,
      })
    );
  } catch {
    // noop
  }
}

function getorganizadoresNomes(evento, turma) {
  const fonteEvento = Array.isArray(evento?.organizador) ? evento.organizador : [];
  const fonteTurma = Array.isArray(turma?.organizador) ? turma.organizador : [];

  const nomes = (fonteEvento.length ? fonteEvento : fonteTurma)
    .map((item) => item?.nome)
    .filter(Boolean);

  return nomes.length ? nomes.join(", ") : "organizador";
}

function montarTurmaParaQr(turma) {
  const turma_id = toPositiveInt(turma?.turma_id || turma?.id);

  return {
    ...turma,
    id: turma_id,
    turma_id,
    qr_payload: {
      turma_id,
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────────────────────── */

function MiniStat({ label, value, icon: Icon, tone = "neutral" }) {
  const tones = {
    neutral:
      "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    info: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100",
  };

  return (
    <article
      className={classNames(
        "rounded-3xl border p-3 text-center shadow-sm sm:p-4",
        tones[tone] || tones.neutral
      )}
    >
      <div className="inline-flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wide opacity-80 sm:text-xs">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>

      <div className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
        {value}
      </div>
    </article>
  );
}

function HeaderHero({ onRefresh, carregando }) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-indigo-800 to-blue-700" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_28%,rgba(129,140,248,0.26),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[960px] max-w-[95vw] -translate-x-1/2 rounded-full bg-indigo-300/25 blur-3xl"
      />

      <a
        href="#conteudo"
        className="relative sr-only px-3 py-2 text-sm focus:not-sr-only focus:block focus:bg-white/20 focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 sm:py-10 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            QR Code de presença v2.0
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
            QR Codes de presença por turma
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
            Gere PDFs oficiais de QR Code para cada turma, prontos para impressão
            e vinculados ao contrato único de presença por turma_id.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15 sm:text-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Geração administrativa
            </span>

            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15 sm:text-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Contrato oficial
            </span>

            <button
              type="button"
              onClick={onRefresh}
              disabled={carregando}
              className={classNames(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black text-white shadow-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                carregando
                  ? "cursor-not-allowed bg-white/20 opacity-70"
                  : "bg-white/15 hover:bg-white/25"
              )}
              aria-label="Atualizar eventos e turmas"
              aria-busy={carregando ? "true" : "false"}
            >
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              )}
              {carregando ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

function ToolbarBusca({
  busca,
  setBusca,
  limparBusca,
  inputRef,
  eventosFiltrados,
  turmasFiltradas,
  tentativa,
  onRecarregar,
}) {
  return (
    <section
      aria-label="Busca e resumo"
      className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <label className="relative block">
          <span className="sr-only">Buscar evento, turma ou organizador</span>

          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar evento, turma ou organizador..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-24 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            aria-label="Buscar por nome do evento, turma ou organizador"
          />

          {busca ? (
            <button
              type="button"
              onClick={limparBusca}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Limpar busca"
            >
              Limpar
            </button>
          ) : null}
        </label>

        <button
          type="button"
          onClick={onRecarregar}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-4 text-sm font-black text-white transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Recarregar eventos e turmas"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {tentativa ? `Recarregar (${tentativa})` : "Recarregar"}
        </button>
      </div>

      <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {eventosFiltrados} evento{eventosFiltrados === 1 ? "" : "s"} •{" "}
        {turmasFiltradas} turma{turmasFiltradas === 1 ? "" : "s"} na visualização
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function QRCodesEventosAdmin() {
  const reduceMotion = useReducedMotion();

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState(
    () => localStorage.getItem("qr:busca") || ""
  );
  const [buscaDebounced, setBuscaDebounced] = useState(() =>
    normalizarTexto(localStorage.getItem("qr:busca") || "")
  );
  const [gerando, setGerando] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

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

  const carregar = useCallback(async () => {
    try {
      abortRef.current?.abort?.("new-request");
    } catch {
      // noop
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setCarregandoDados(true);
    setErro("");
    setLive("Carregando eventos e turmas.");

    try {
      const listaEventos = await listarEventosAdmin({
        signal: controller.signal,
      });

      const eventosArr = Array.isArray(listaEventos) ? listaEventos : [];

      const withTurmas = await Promise.all(
        eventosArr.map(async (evento) => {
          const evento_id = toPositiveInt(evento?.id);

          if (!evento_id) {
            return {
              ...evento,
              turmas: [],
            };
          }

          try {
            const turmas = await listarTurmasDoEvento(evento_id, {
              signal: controller.signal,
            });

            return {
              ...evento,
              turmas: Array.isArray(turmas) ? turmas : [],
            };
          } catch (error) {
            if (isAbortLike(error)) throw error;

            return {
              ...evento,
              turmas: [],
            };
          }
        })
      );

      if (!mountedRef.current) return;

      setEventos(withTurmas);
      writeCache(withTurmas);

      setLive(
        withTurmas.length
          ? `Foram carregados ${withTurmas.length} evento(s).`
          : "Nenhum evento encontrado."
      );
    } catch (error) {
      if (isAbortLike(error)) return;

      const message = getErrorMessage(error, "Erro ao carregar eventos e turmas.");

      if (!mountedRef.current) return;

      setErro(message);
      setEventos([]);
      notifyError(message);
      setLive("Falha ao carregar eventos e turmas.");

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) {
        setCarregandoDados(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    const cached = readCache();

    if (cached) {
      setEventos(cached);
      setCarregandoDados(false);
      setLive(`Exibindo ${cached.length} evento(s) do cache.`);
    }

    carregar();

    return () => {
      try {
        abortRef.current?.abort?.("unmount");
      } catch {
        // noop
      }
    };
  }, [carregar, setLive]);

  useEffect(() => {
    try {
      localStorage.setItem("qr:busca", busca);
    } catch {
      // noop
    }

    const timer = window.setTimeout(() => {
      setBuscaDebounced(normalizarTexto(busca));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const totalEventos = eventos.length;

  const totalTurmas = useMemo(
    () =>
      eventos.reduce(
        (acc, evento) => acc + (Array.isArray(evento?.turmas) ? evento.turmas.length : 0),
        0
      ),
    [eventos]
  );

  const eventosFiltrados = useMemo(() => {
    const q = buscaDebounced;

    if (!q) return eventos;

    return eventos
      .map((evento) => {
        const eventoTitulo = tituloEvento(evento);
        const eventoMatch = normalizarTexto(eventoTitulo).includes(q);

        const turmasFiltradas = (evento?.turmas || []).filter((turma) => {
          const turmaTitulo = tituloTurma(turma);
          const organizadores = getorganizadoresNomes(evento, turma);

          return (
            eventoMatch ||
            normalizarTexto(turmaTitulo).includes(q) ||
            normalizarTexto(organizadores).includes(q)
          );
        });

        if (eventoMatch || turmasFiltradas.length > 0) {
          return {
            ...evento,
            turmas: turmasFiltradas,
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [eventos, buscaDebounced]);

  const turmasFiltradasCount = useMemo(
    () =>
      eventosFiltrados.reduce(
        (acc, evento) =>
          acc + (Array.isArray(evento?.turmas) ? evento.turmas.length : 0),
        0
      ),
    [eventosFiltrados]
  );

  const vazio = useMemo(
    () =>
      !carregandoDados &&
      (!eventosFiltrados.length ||
        eventosFiltrados.every((evento) => !evento?.turmas?.length)),
    [carregandoDados, eventosFiltrados]
  );

  const handleGerarPDF = useCallback(
    async (turma, eventoTitulo, organizadores) => {
      if (gerando) return;

      const turma_id = toPositiveInt(turma?.turma_id || turma?.id);

      if (!turma_id) {
        notifyError("turma_id inválido para geração do QR Code.");
        return;
      }

      setGerando(turma_id);
      setLive(`Gerando PDF da turma ${turma_id}.`);

      try {
        await gerarQrCodePresencaPDF(
          montarTurmaParaQr(turma),
          eventoTitulo,
          organizadores
        );

        notifySuccess("PDF do QR Code gerado com sucesso.");
        setLive("PDF do QR Code gerado com sucesso.");
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao gerar PDF do QR Code."));
        setLive("Falha ao gerar PDF do QR Code.");
      } finally {
        setGerando(null);
      }
    },
    [gerando, setLive]
  );

  const gerarTodosDoEvento = useCallback(
    async (evento) => {
      if (!Array.isArray(evento?.turmas) || !evento.turmas.length || gerando) {
        return;
      }

      setGerando(-1);
      setLive(`Gerando PDFs do evento ${tituloEvento(evento)}.`);

      try {
        const eventoTitulo = tituloEvento(evento);

        for (const turma of evento.turmas) {
          const turma_id = toPositiveInt(turma?.turma_id || turma?.id);

          if (!turma_id) continue;

          await gerarQrCodePresencaPDF(
            montarTurmaParaQr(turma),
            eventoTitulo,
            getorganizadoresNomes(evento, turma)
          );
        }

        notifySuccess("PDFs gerados para todas as turmas do evento.");
        setLive("PDFs gerados para todas as turmas do evento.");
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao gerar alguns PDFs."));
        setLive("Falha ao gerar alguns PDFs.");
      } finally {
        setGerando(null);
      }
    },
    [gerando, setLive]
  );

  const limparBusca = useCallback(() => {
    setBusca("");

    window.setTimeout(() => inputRef.current?.focus?.(), 0);
  }, []);

  const recarregar = useCallback(() => {
    setTentativa((value) => value + 1);
    carregar();
  }, [carregar]);

  const motionConfig = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 10 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <HeaderHero onRefresh={carregar} carregando={carregandoDados} />

      {carregandoDados && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-indigo-100 dark:bg-indigo-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
          aria-busy="true"
        >
          <div
            className={classNames(
              "h-full w-1/3 bg-indigo-700 dark:bg-indigo-500",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      )}

      <main
        id="conteudo"
        tabIndex={-1}
        role="main"
        className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-4 lg:px-6"
      >
        <p
          ref={liveRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          role="status"
        />

        {!!erro && (
          <p ref={erroRef} className="sr-only" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat
            label="Eventos"
            value={totalEventos}
            icon={Layers}
            tone="neutral"
          />

          <MiniStat
            label="Turmas"
            value={totalTurmas}
            icon={QrCode}
            tone="info"
          />

          <ToolbarBusca
            busca={busca}
            setBusca={setBusca}
            limparBusca={limparBusca}
            inputRef={inputRef}
            eventosFiltrados={eventosFiltrados.length}
            turmasFiltradas={turmasFiltradasCount}
            tentativa={tentativa}
            onRecarregar={recarregar}
          />
        </section>

        <section className="space-y-4" aria-label="Lista de eventos e turmas">
          <AnimatePresence mode="wait">
            {carregandoDados ? (
              <motion.div key="loading" {...motionConfig}>
                <CarregandoSkeleton linhas={4} />
              </motion.div>
            ) : erro ? (
              <motion.section
                key="error"
                {...motionConfig}
                className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-center shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30"
                role="alert"
              >
                <p className="font-black text-rose-900 dark:text-rose-100">
                  {erro}
                </p>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={carregar}
                    className="inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    Tentar novamente
                  </button>
                </div>
              </motion.section>
            ) : vazio ? (
              <motion.div key="empty" {...motionConfig}>
                <NadaEncontrado
                  titulo="Nenhum evento com turma encontrado"
                  subtitulo={
                    busca
                      ? "Tente ajustar a busca ou limpar o filtro."
                      : "Não há turmas disponíveis para geração de QR Code."
                  }
                />
              </motion.div>
            ) : (
              <motion.div key="list" {...motionConfig} className="space-y-4">
                {eventosFiltrados.map((evento) => {
                  const eventoTitulo = tituloEvento(evento);
                  const stripe = stripeClassFor(evento.id ?? eventoTitulo);
                  const turmas = Array.isArray(evento?.turmas)
                    ? evento.turmas
                    : [];

                  return (
                    <article
                      key={evento.id ?? eventoTitulo}
                      className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
                      role="group"
                      aria-label={`Evento ${eventoTitulo}`}
                    >
                      <div
                        className={classNames(
                          "pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r",
                          stripe
                        )}
                        aria-hidden="true"
                      />

                      <header className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg">
                            {eventoTitulo}
                          </h2>

                          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {turmas.length} turma{turmas.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        {!!turmas.length && (
                          <button
                            type="button"
                            onClick={() => gerarTodosDoEvento(evento)}
                            disabled={Boolean(gerando)}
                            className={classNames(
                              "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
                              gerando
                                ? "bg-indigo-400"
                                : "bg-indigo-700 hover:bg-indigo-800"
                            )}
                            aria-label={`Gerar PDFs de QR Code para todas as turmas do evento ${eventoTitulo}`}
                          >
                            {gerando === -1 ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <FileDown className="h-4 w-4" aria-hidden="true" />
                            )}
                            {gerando === -1 ? "Gerando..." : "Gerar todos"}
                          </button>
                        )}
                      </header>

                      {!turmas.length ? (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          Nenhuma turma cadastrada para este evento.
                        </p>
                      ) : (
                        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {turmas.map((turma) => {
                            const turma_id = toPositiveInt(turma?.turma_id || turma?.id);
                            const turmaTitulo = tituloTurma(turma);
                            const organizadores = getorganizadoresNomes(evento, turma);
                            const isLoading = gerando === turma_id;

                            return (
                              <li
                                key={turma_id ?? turmaTitulo}
                                className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60"
                              >
                                <span
                                  aria-hidden="true"
                                  className={classNames(
                                    "absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b",
                                    stripe
                                  )}
                                />

                                <div className="flex items-center justify-between gap-3 pl-2">
                                  <div className="min-w-0">
                                    <p className="truncate font-black text-slate-900 dark:text-white">
                                      {turmaTitulo}
                                    </p>

                                    <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      {organizadores}
                                    </p>

                                    <p className="mt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                                      QR: turma_id {turma_id || "—"}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGerarPDF(
                                        turma,
                                        eventoTitulo,
                                        organizadores
                                      )
                                    }
                                    disabled={isLoading || gerando === -1 || !turma_id}
                                    className={classNames(
                                      "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
                                      isLoading || gerando === -1 || !turma_id
                                        ? "bg-indigo-400"
                                        : "bg-indigo-700 hover:bg-indigo-800"
                                    )}
                                    aria-label={`Gerar PDF de QR Code da turma ${turmaTitulo}`}
                                  >
                                    {isLoading ? (
                                      <>
                                        <Loader2
                                          className="h-4 w-4 animate-spin"
                                          aria-hidden="true"
                                        />
                                        Gerando...
                                      </>
                                    ) : (
                                      <>
                                        <FileDown
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                        Gerar PDF
                                      </>
                                    )}
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <Footer />
    </div>
  );
}