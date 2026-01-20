// ✅ src/pages/Notificacao.jsx (premium + mobile-first + a11y + anti-fuso + filtros + paginação)
// - ✅ Mantém seu HeaderHero (3 cores) e melhora UX
// - ✅ Adiciona: busca, filtro por tipo, “somente não lidas”, ordenação, paginação client-side
// - ✅ Anti-fuso: não usa Date para "YYYY-MM-DD"; para datetime tenta parse seguro; fallback mantém texto
// - ✅ Marca todas: usa Promise.allSettled com limite de concorrência (evita ficar lento com muitas)
// - ✅ "Ver mais": se tiver link, marca como lida e navega (preserva seu comportamento)
// - ✅ Acessibilidade: live region, aria-busy, foco, estados e labels

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle,
  Info,
  Star,
  Check,
  Search,
  Filter,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet, apiPatch } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";
import Footer from "../components/Footer";

/* =======================
   Helpers de data (anti-UTC)
   ======================= */
function formatarDataLocalLegivel(s) {
  if (!s) return "";
  const str = String(s).trim();

  // date-only
  const mDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) return `${mDate[3]}/${mDate[2]}/${mDate[1]}`;

  // datetime-like
  const mDateTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (mDateTime) {
    const [, y, mo, d, hh, mm] = mDateTime;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  // fallback: tenta Date (para strings com timezone, ex: "2026-01-08T10:22:00.000Z")
  // se falhar, devolve o original.
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return str;
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d}/${mo}/${y} ${hh}:${mm}`;
}

/* =======================
   HeaderHero padronizado
   ======================= */
function HeaderHero({ total = 0, naoLidas = 0, onMarcarTodas, marcandoTodas }) {
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-violet-900 via-fuchsia-800 to-pink-700 text-white"
      role="banner"
    >
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
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <Bell className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Minhas Notificações
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Acompanhe avisos, certificados e atualizações da Escola da Saúde.
          </p>

          {/* ministats */}
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-xs">
              {total} notificação{total === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-xs">
              {naoLidas} não lida{naoLidas === 1 ? "" : "s"}
            </span>

            <button
              type="button"
              onClick={onMarcarTodas}
              disabled={marcandoTodas || naoLidas === 0}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${marcandoTodas || naoLidas === 0 ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Marcar todas como lidas"
              aria-busy={marcandoTodas ? "true" : "false"}
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {marcandoTodas ? "Marcando…" : "Marcar todas"}
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* =======================
   Helpers gerais
   ======================= */
const sLower = (v) => String(v ?? "").toLowerCase();

function normalizarTipo(tipo) {
  const t = sLower(tipo).trim();
  if (t === "evento") return "evento";
  if (t === "certificado") return "certificado";
  if (t === "aviso") return "aviso";
  if (t === "avaliacao" || t === "avaliação") return "avaliacao";
  return "outros";
}

function getDataMs(n) {
  const raw = n?.data || n?.criada_em || n?.criadaEm || n?.created_at || n?.createdAt || 0;

  // Se vier date-only YYYY-MM-DD, não use Date(UTC). Ordena lexicograficamente como ymd -> ms aproximado por string.
  const mDate = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) return Number(`${mDate[1]}${mDate[2]}${mDate[3]}0000`); // chave ordenável

  // Se vier datetime no formato ISO, Date é ok apenas p/ ordenação (existe tz)
  const dt = new Date(raw);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function obterIcone(tipo) {
  switch (normalizarTipo(tipo)) {
    case "evento":
      return <CalendarDays className="text-sky-600 dark:text-sky-400" aria-hidden="true" />;
    case "certificado":
      return <CheckCircle className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
    case "aviso":
      return <Info className="text-amber-600 dark:text-amber-400" aria-hidden="true" />;
    case "avaliacao":
      return <Star className="text-violet-600 dark:text-violet-400" aria-hidden="true" />;
    default:
      return <Bell className="text-zinc-600 dark:text-zinc-400" aria-hidden="true" />;
  }
}

function isNaoLida(n) {
  if (typeof n?.lida === "boolean") return !n.lida;
  if (typeof n?.lido === "boolean") return !n.lido;
  if ("lida_em" in (n || {})) return !n.lida_em;
  if ("lidaEm" in (n || {})) return !n.lidaEm;
  return true;
}

function classesCartao(n) {
  return isNaoLida(n)
    ? "bg-[#FFF7E6] ring-1 ring-amber-200 border-amber-400 dark:bg-amber-900/20 dark:ring-amber-700/40 dark:border-amber-600"
    : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700";
}

/* =======================
   Concurrency limiter (marcar todas)
   ======================= */
async function runLimited(tasks, limit = 6) {
  const results = [];
  let i = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = e;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* =======================
   Página
   ======================= */
export default function Notificacao() {
  const [notificacao, setNotificacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const liveRef = useRef(null);

  // filtros/UX
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("todos"); // todos | evento | certificado | aviso | avaliacao | outros
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [ordenacao, setOrdenacao] = useState("recentes"); // recentes | antigos | titulo_az | titulo_za
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  async function carregarNotificacao(signal) {
    try {
      setLoading(true);
      setLive("Carregando notificações…");
      const data = await apiGet("/api/notificacao", { signal });
      setNotificacao(Array.isArray(data) ? data : []);
      setLive("Notificações carregadas.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("❌ Erro ao carregar notificações.");
        console.error("Erro:", error);
        setNotificacao([]);
        setLive("Falha ao carregar notificações.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ evita duplo carregamento (StrictMode)
  useOnceEffect(() => {
    const ac = new AbortController();
    carregarNotificacao(ac.signal);
    return () => ac.abort();
  }, []);

  async function handleMarcarLida(id, link) {
    try {
      setMarcando(id);
      await apiPatch(`/api/notificacao/${id}/lida`);

      setNotificacao((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, lida: true, lido: true, lida_em: n.lida_em ?? new Date().toISOString() } : n
        )
      );

      if (typeof window.atualizarContadorNotificacao === "function") {
        window.atualizarContadorNotificacao();
      }

      if (link) window.location.href = link;
    } catch (error) {
      toast.error("❌ Erro ao marcar como lida.");
      console.error(error);
    } finally {
      setMarcando(null);
    }
  }

  async function marcarTodas() {
    const ids = notificacao.filter(isNaoLida).map((n) => n.id).filter(Boolean);
    if (!ids.length) return;

    try {
      setMarcandoTodas(true);

      // 🔥 mais rápido e mais "seguro" p/ API: concorrência limitada
      const tasks = ids.map((id) => () => apiPatch(`/api/notificacao/${id}/lida`));
      const results = await runLimited(tasks, 6);

      const falhas = results.filter((r) => r instanceof Error).length;
      if (falhas) toast.warn(`⚠️ ${falhas} notificação(ões) não puderam ser marcadas agora.`);
      toast.success("✅ Notificações marcadas como lidas.");

      setNotificacao((prev) =>
        prev.map((n) => ({
          ...n,
          lida: true,
          lido: true,
          lida_em: n.lida_em ?? new Date().toISOString(),
        }))
      );

      if (typeof window.atualizarContadorNotificacao === "function") {
        window.atualizarContadorNotificacao();
      }
    } finally {
      setMarcandoTodas(false);
    }
  }

  // lista “base” (unread primeiro + data desc)
  const listaOrdenadaBase = useMemo(() => {
    return [...notificacao].sort((a, b) => {
      const unreadDelta = (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0);
      if (unreadDelta !== 0) return unreadDelta;
      return getDataMs(b) - getDataMs(a);
    });
  }, [notificacao]);

  const total = listaOrdenadaBase.length;
  const naoLidas = useMemo(() => listaOrdenadaBase.filter(isNaoLida).length, [listaOrdenadaBase]);

  // filtros + ordenação custom
  const listaFiltrada = useMemo(() => {
    const q = sLower(busca).trim();

    let base = listaOrdenadaBase;

    if (somenteNaoLidas) base = base.filter(isNaoLida);

    if (fTipo !== "todos") {
      base = base.filter((n) => normalizarTipo(n?.tipo) === fTipo);
    }

    if (q) {
      base = base.filter((n) => {
        const t = sLower(n?.titulo);
        const m = sLower(n?.mensagem);
        const tipo = normalizarTipo(n?.tipo);
        return t.includes(q) || m.includes(q) || tipo.includes(q);
      });
    }

    const sorted = base.slice().sort((a, b) => {
      // mantém unread primeiro sempre
      const unreadDelta = (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0);
      if (unreadDelta !== 0) return unreadDelta;

      if (ordenacao === "antigos") return getDataMs(a) - getDataMs(b);
      if (ordenacao === "recentes") return getDataMs(b) - getDataMs(a);

      const at = String(a?.titulo ?? "").localeCompare(String(b?.titulo ?? ""), "pt-BR");
      if (ordenacao === "titulo_az") return at;
      if (ordenacao === "titulo_za") return -at;

      return 0;
    });

    return sorted;
  }, [listaOrdenadaBase, busca, fTipo, somenteNaoLidas, ordenacao]);

  // paginação
  const totalItems = listaFiltrada.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageClamped = Math.min(page, totalPages);

  // reset página quando filtros mudam
  useMemo(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, fTipo, somenteNaoLidas, ordenacao, pageSize]);

  const sliceStart = (pageClamped - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const pagina = useMemo(() => listaFiltrada.slice(sliceStart, sliceEnd), [listaFiltrada, sliceStart, sliceEnd]);

  // ───────── Render ─────────
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      <HeaderHero total={total} naoLidas={naoLidas} onMarcarTodas={marcarTodas} marcandoTodas={marcandoTodas} />

      <main role="main" id="conteudo" className="flex-1">
        <section className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
          <p ref={liveRef} className="sr-only" aria-live="polite" />

          {/* Toolbar sticky (busca + filtros) */}
          <div className="sticky top-1 z-30 mb-4 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex flex-col gap-3">
              {/* Busca */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título, mensagem ou tipo…"
                  className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                  aria-label="Buscar notificações"
                />
              </div>

              {/* Filtros */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <Filter className="h-4 w-4" aria-hidden="true" /> Filtros:
                  </span>

                  <select
                    value={fTipo}
                    onChange={(e) => setFTipo(e.target.value)}
                    className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                    aria-label="Filtrar por tipo"
                  >
                    <option value="todos">Todos os tipos</option>
                    <option value="evento">Evento</option>
                    <option value="certificado">Certificado</option>
                    <option value="avaliacao">Avaliação</option>
                    <option value="aviso">Aviso</option>
                    <option value="outros">Outros</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSomenteNaoLidas((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold transition border
                      ${
                        somenteNaoLidas
                          ? "bg-amber-700 text-white border-amber-700 hover:bg-amber-800"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
                      }`}
                    aria-pressed={somenteNaoLidas ? "true" : "false"}
                    aria-label="Mostrar somente não lidas"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Somente não lidas
                  </button>

                  <select
                    value={ordenacao}
                    onChange={(e) => setOrdenacao(e.target.value)}
                    className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                    aria-label="Ordenar"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="antigos">Mais antigas</option>
                    <option value="titulo_az">Título (A–Z)</option>
                    <option value="titulo_za">Título (Z–A)</option>
                  </select>
                </div>

                {/* Paginação / page size */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {totalItems} resultado{totalItems === 1 ? "" : "s"}
                  </span>

                  <label className="text-xs text-zinc-500">Por página:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                    className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                    aria-label="Itens por página"
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Cabeçalho da lista */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2 text-lousa dark:text-white">
              <Bell aria-hidden="true" /> Notificações
            </h2>

            <div className="text-xs text-zinc-500">
              Página <strong>{pageClamped}</strong> de <strong>{totalPages}</strong>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
              Carregando...
            </p>
          ) : totalItems === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Nenhuma notificação para os filtros selecionados.</p>
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setFTipo("todos");
                  setSomenteNaoLidas(false);
                  setOrdenacao("recentes");
                  setPage(1);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-violet-800"
              >
                <RefreshCw className="h-4 w-4" />
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div role="list" className="space-y-3">
                <AnimatePresence>
                  {pagina.map((n, index) => {
                    const naoLida = isNaoLida(n);
                    const tipoNorm = normalizarTipo(n?.tipo);

                    const ctaLabel =
                      naoLida
                        ? n.link
                          ? "Ver mais"
                          : "Marcar como lida"
                        : "Lida";

                    return (
                      <motion.div
                        key={n.id ?? `${index}-${getDataMs(n)}`}
                        role="listitem"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.22, delay: Math.min(0.12, index * 0.03) }}
                        className={`rounded-2xl shadow-sm p-4 border transition-all duration-200 ${classesCartao(n)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">{obterIcone(n.tipo)}</div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-zinc-900 dark:text-white font-extrabold leading-tight break-words">
                                {n.titulo || "Notificação"}
                              </p>

                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/60 text-zinc-700 border border-zinc-200 dark:bg-zinc-950/30 dark:text-zinc-200 dark:border-zinc-700">
                                {tipoNorm}
                              </span>

                              {naoLida && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">
                                  • não lida
                                </span>
                              )}
                            </div>

                            {n.mensagem ? (
                              <p className="text-zinc-800 dark:text-zinc-100 mt-1 break-words leading-relaxed">
                                {String(n.mensagem)}
                              </p>
                            ) : null}

                            {(n.data || n.criada_em || n.criadaEm) && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                📅 {formatarDataLocalLegivel(n.data || n.criada_em || n.criadaEm)}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleMarcarLida(n.id, n.link)}
                                disabled={!naoLida || marcando === n.id}
                                className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl font-extrabold
                                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700
                                  ${
                                    naoLida
                                      ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800"
                                      : "bg-zinc-200 text-zinc-700 border border-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 cursor-default"
                                  }
                                  ${marcando === n.id ? "opacity-60 cursor-not-allowed" : ""}`}
                                aria-label={
                                  naoLida
                                    ? n.link
                                      ? "Ver mais e marcar como lida"
                                      : "Marcar como lida"
                                    : "Notificação já lida"
                                }
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                {marcando === n.id ? "Salvando..." : ctaLabel}
                              </button>

                              {naoLida && n.link ? (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Ao abrir, ela será marcada como lida.
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Paginação */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Mostrando <strong>{pagina.length}</strong> de <strong>{totalItems}</strong> resultado(s)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageClamped <= 1}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageClamped >= totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
