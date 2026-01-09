// ✅ src/pages/QRCodesEventosAdmin.jsx (premium: hero + ministats + busca + a11y + motion + barras + cache + abort)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { QrCode, RefreshCcw, Search, X, Loader2, Sparkles, Layers, FileDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";
import { gerarQrCodePresencaPDF } from "../utils/gerarQrCodePresencaPDF.jsx";

/* ---------------- Utils ---------------- */
const cx = (...c) => c.filter(Boolean).join(" ");
const safeStr = (s, max = 200) => String(s ?? "").slice(0, max).trim();
const tituloEvento = (ev) => safeStr(ev?.titulo || ev?.nome || `Evento #${ev?.id ?? "—"}`, 170);
const tituloTurma = (t) => safeStr(t?.nome || `Turma #${t?.id ?? "—"}`, 170);
const normaliza = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/* 🎨 Barrinha de cor determinística por card */
const STRIPES = [
  "from-emerald-700 to-teal-500",
  "from-sky-700 to-cyan-500",
  "from-indigo-700 to-violet-600",
  "from-pink-700 to-rose-600",
  "from-amber-600 to-yellow-500",
  "from-lime-700 to-green-600",
  "from-fuchsia-700 to-pink-600",
];
const hash = (s) => {
  const str = String(s ?? "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const stripeClassFor = (seed) => STRIPES[hash(seed) % STRIPES.length];

/* ---------------- Cache (sessionStorage) ---------------- */
const CACHE_KEY = "qr:eventos:v2";
const CACHE_TTL = 3 * 60 * 1000; // 3 min

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL) return null;
    return Array.isArray(parsed.eventos) ? parsed.eventos : null;
  } catch {
    return null;
  }
};
const writeCache = (eventos) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), eventos }));
  } catch {}
};

/* ---------------- MiniStat ---------------- */
function MiniStat({ label, value, icon: Icon, tone = "neutral" }) {
  const tones = {
    neutral: "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700",
    ok: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800",
    info: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200/60 dark:border-indigo-800",
  };

  return (
    <div className={cx("rounded-2xl border p-4 text-center shadow-sm", tones[tone])}>
      <div className="inline-flex items-center justify-center gap-2 text-[11px] sm:text-xs opacity-80">
        {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

/* ---------------- HeaderHero ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-violet-900 via-indigo-700 to-blue-600 text-white" role="banner">
      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-white focus:text-black focus:px-3 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Ir para o conteúdo
      </a>

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">QR Codes de Presença por Turma</h1>
        </div>

        <p className="text-sm text-white/90 max-w-2xl">
          Gere um PDF com QR Code para registrar presença dos participantes em cada turma — rápido, padronizado e pronto pra imprimir.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs font-semibold">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Admin • geração em PDF
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={cx(
              "inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              carregando ? "opacity-70 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"
            )}
            aria-label="Atualizar eventos e turmas"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="w-4 h-4" aria-hidden="true" />}
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ---------------- Página ---------------- */
export default function QRCodesEventosAdmin() {
  const reduceMotion = useReducedMotion();

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [eventos, setEventos] = useState([]); // [{...evento, turmas: []}]
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState(() => localStorage.getItem("qr:busca") || "");
  const [buscaDebounced, setBuscaDebounced] = useState(() => (localStorage.getItem("qr:busca") || "").trim().toLowerCase());
  const [gerando, setGerando] = useState(null); // turmaId | -1 (batch)
  const [tentativa, setTentativa] = useState(0);

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg || "";
  }, []);

  /* ---------------- Carregar dados (Abort + Cache) ---------------- */
  const carregar = useCallback(async () => {
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    setCarregandoDados(true);
    setErro("");
    setLive("Carregando eventos e turmas…");

    try {
      const listaEventos = await apiGet("eventos", { on403: "silent", signal: ac.signal });
      const eventosArr = Array.isArray(listaEventos) ? listaEventos : [];

      const withTurmas = await Promise.all(
        eventosArr.map(async (ev) => {
          try {
            const turmas = await apiGet(`turmas/evento/${ev.id}`, { on403: "silent", signal: ac.signal });
            return { ...ev, turmas: Array.isArray(turmas) ? turmas : [] };
          } catch {
            return { ...ev, turmas: [] };
          }
        })
      );

      setEventos(withTurmas);
      writeCache(withTurmas);

      setLive(withTurmas.length ? `Foram carregados ${withTurmas.length} evento(s).` : "Nenhum evento encontrado.");
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setErro("Erro ao carregar eventos/turmas.");
        toast.error("❌ Erro ao carregar eventos/turmas.");
        setLive("Falha ao carregar eventos e turmas.");
        setTimeout(() => erroRef.current?.focus?.(), 0);
      }
    } finally {
      setCarregandoDados(false);
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
    return () => abortRef.current?.abort?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Busca: persistência + debounce ---------------- */
  useEffect(() => {
    localStorage.setItem("qr:busca", busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------------- KPIs ---------------- */
  const totalEventos = eventos.length;
  const totalTurmas = useMemo(() => eventos.reduce((acc, e) => acc + (e.turmas?.length || 0), 0), [eventos]);

  /* ---------------- Filtro (evento + turma + instrutores) ---------------- */
  const eventosFiltrados = useMemo(() => {
    const q = buscaDebounced;
    if (!q) return eventos;

    return eventos
      .map((e) => {
        const evTitle = tituloEvento(e);
        const evMatch = normaliza(evTitle).includes(q);

        const turmasFiltradas = (e.turmas || []).filter((t) => {
          const tTitle = tituloTurma(t);
          const instr =
            Array.isArray(e?.instrutor) ? e.instrutor.map((i) => i?.nome).join(",") :
            Array.isArray(t?.instrutor) ? t.instrutor.map((i) => i?.nome).join(",") :
            "";
          return evMatch || normaliza(tTitle).includes(q) || normaliza(instr).includes(q);
        });

        const keep = evMatch || turmasFiltradas.length > 0;
        return keep ? { ...e, turmas: turmasFiltradas } : null;
      })
      .filter(Boolean);
  }, [eventos, buscaDebounced]);

  const turmasFiltradasCount = useMemo(
    () => eventosFiltrados.reduce((acc, e) => acc + (e.turmas?.length || 0), 0),
    [eventosFiltrados]
  );

  const vazio = useMemo(
    () => !carregandoDados && (!eventosFiltrados.length || eventosFiltrados.every((e) => !e.turmas?.length)),
    [carregandoDados, eventosFiltrados]
  );

  /* ---------------- Ações ---------------- */
  const handleGerarPDF = useCallback(
    async (t, evTitle, instrutores) => {
      if (gerando) return;
      const turmaId = t?.id;
      setGerando(turmaId);

      try {
        await gerarQrCodePresencaPDF(t, evTitle, instrutores);
      } catch (e) {
        console.error(e);
        toast.error("❌ Erro ao gerar PDF do QR Code.");
      } finally {
        setGerando(null);
      }
    },
    [gerando]
  );

  const mkHandleGerar = useCallback(
    (t, evTitle, instrutores) => () => handleGerarPDF(t, evTitle, instrutores),
    [handleGerarPDF]
  );

  const gerarTodosDoEvento = useCallback(
    async (ev) => {
      if (!Array.isArray(ev?.turmas) || !ev.turmas.length || gerando) return;

      setGerando(-1);
      try {
        const instrutores =
          (Array.isArray(ev?.instrutor) ? ev.instrutor.map((i) => i?.nome).filter(Boolean) : []).join(", ") || "Instrutor";
        const evTitle = tituloEvento(ev);

        for (const t of ev.turmas) {
          await gerarQrCodePresencaPDF(t, evTitle, instrutores);
        }

        toast.success("✅ PDFs gerados para todas as turmas do evento.");
      } catch (e) {
        console.error(e);
        toast.error("❌ Erro ao gerar alguns PDFs.");
      } finally {
        setGerando(null);
      }
    },
    [gerando]
  );

  const limparBusca = useCallback(() => {
    setBusca("");
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, []);

  const motionWrap = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 10 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden">
      <HeaderHero onRefresh={carregar} carregando={carregandoDados} />

      {/* barra de progresso fina no topo */}
      {carregandoDados && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-indigo-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
          aria-busy="true"
        >
          <div className={cx("h-full bg-indigo-700 w-1/3", reduceMotion ? "" : "animate-pulse")} />
        </div>
      )}

      <main id="conteudo" tabIndex={-1} role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto min-w-0">
        <p ref={liveRef} className="sr-only" aria-live="polite" role="status" />
        {!!erro && (
          <p ref={erroRef} className="sr-only" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        {/* KPIs + Busca */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <MiniStat label="Eventos" value={totalEventos} icon={Layers} tone="neutral" />
          <MiniStat label="Turmas" value={totalTurmas} icon={QrCode} tone="info" />

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm p-3">
            <label htmlFor="busca" className="sr-only">
              Buscar evento, turma ou instrutor
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300" aria-hidden="true" />

              <input
                ref={inputRef}
                id="busca"
                type="search"
                inputMode="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar evento, turma ou instrutor…"
                className="pl-10 pr-10 py-2.5 w-full rounded-xl border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Buscar por nome do evento, turma ou instrutor"
              />

              {!!busca && (
                <button
                  type="button"
                  onClick={limparBusca}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
              <p aria-live="polite">
                {eventosFiltrados.length} evento(s) • {turmasFiltradasCount} turma(s)
              </p>

              <button
                type="button"
                onClick={() => {
                  setTentativa((n) => n + 1);
                  carregar();
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Tentar novamente carregar os dados"
                title="Recarregar"
              >
                {tentativa ? `Recarregar (${tentativa})` : "Recarregar"}
              </button>
            </div>
          </div>
        </section>

        {/* Conteúdo principal */}
        <section className="space-y-4" aria-label="Lista de eventos e turmas">
          <AnimatePresence mode="wait">
            {carregandoDados ? (
              <motion.div key="loading" {...motionWrap}>
                <CarregandoSkeleton linhas={4} />
              </motion.div>
            ) : erro ? (
              <motion.div key="error" {...motionWrap}>
                <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/15 p-4 text-center shadow-sm">
                  <p className="text-rose-800 dark:text-rose-200 font-semibold">{erro}</p>
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={carregar}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-700"
                    >
                      <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : vazio ? (
              <motion.div key="empty" {...motionWrap}>
                <NadaEncontrado mensagem="Nenhum evento com turmas encontrado." />
              </motion.div>
            ) : (
              <motion.div key="list" {...motionWrap} className="space-y-4">
                {eventosFiltrados.map((ev) => {
                  const evTitle = tituloEvento(ev);
                  const stripe = stripeClassFor(ev.id ?? evTitle);

                  const instrutoresEvento =
                    (Array.isArray(ev?.instrutor) && ev.instrutor.length ? ev.instrutor : [])
                      .map((i) => i?.nome)
                      .filter(Boolean);

                  return (
                    <article
                      key={ev.id ?? evTitle}
                      className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow border border-zinc-200 dark:border-zinc-700 p-4"
                      role="group"
                      aria-label={`Evento ${evTitle}`}
                    >
                      {/* 🔹 Barrinha colorida no topo do card */}
                      <div className={cx("pointer-events-none absolute inset-x-0 -top-px h-2 rounded-t-2xl bg-gradient-to-r", stripe)} />

                      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-lousa dark:text-white break-words">
                            {evTitle}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                            {Array.isArray(ev?.turmas) ? ev.turmas.length : 0} turma(s)
                            {instrutoresEvento.length ? ` • ${instrutoresEvento.join(", ")}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {!!ev?.turmas?.length && (
                            <button
                              type="button"
                              onClick={() => gerarTodosDoEvento(ev)}
                              disabled={!!gerando}
                              className={cx(
                                "inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                gerando
                                  ? "bg-indigo-300 text-white cursor-not-allowed focus-visible:ring-indigo-400"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-600"
                              )}
                              aria-label={`Gerar PDFs de QR Code para todas as turmas do evento ${evTitle}`}
                              title="Gerar PDFs de todas as turmas"
                            >
                              {gerando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FileDown className="w-4 h-4" aria-hidden="true" />}
                              {gerando ? "Gerando…" : "Gerar todos"}
                            </button>
                          )}
                        </div>
                      </header>

                      {!ev.turmas?.length ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                          Nenhuma turma cadastrada para este evento.
                        </p>
                      ) : (
                        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ev.turmas.map((t) => {
                            const instrutores =
                              (instrutoresEvento.length ? instrutoresEvento :
                                Array.isArray(t?.instrutor) ? t.instrutor.map((i) => i?.nome).filter(Boolean) : []
                              ).join(", ") || "Instrutor";

                            const tTitle = tituloTurma(t);
                            const isLoading = gerando === t?.id;

                            return (
                              <li
                                key={t.id ?? tTitle}
                                className="relative border rounded-2xl p-3 flex items-center justify-between gap-3 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/40"
                              >
                                {/* 👉 Filete lateral para hierarquia da turma */}
                                <span aria-hidden="true" className={cx("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b", stripe)} />

                                <div className="min-w-0 pl-2">
                                  <p className="font-extrabold text-gray-800 dark:text-gray-100 truncate">
                                    {tTitle}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                                    {instrutores}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={mkHandleGerar(t, evTitle, instrutores)}
                                  disabled={isLoading || gerando === -1}
                                  className={cx(
                                    "inline-flex items-center gap-2 text-sm font-extrabold px-3 py-2 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                    isLoading || gerando === -1
                                      ? "bg-indigo-300 cursor-not-allowed text-white focus-visible:ring-indigo-400"
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-600"
                                  )}
                                  aria-label={`Gerar PDF de QR Code da turma ${tTitle}`}
                                  title="Gerar PDF com QR Code de presença"
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                      Gerando…
                                    </>
                                  ) : (
                                    <>
                                      <FileDown className="w-4 h-4" aria-hidden="true" />
                                      Gerar PDF
                                    </>
                                  )}
                                </button>
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
