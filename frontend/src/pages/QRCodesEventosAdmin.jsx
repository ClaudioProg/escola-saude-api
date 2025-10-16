// ✅ src/pages/QRCodesEventosAdmin.jsx (mobile-first, a11y, UX, cores exclusivas)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { QrCode, RefreshCcw, Search, X, Loader2 } from "lucide-react";
import { useReducedMotion } from "framer-motion";

import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";
import { gerarQrCodePresencaPDF } from "../utils/gerarQrCodePresencaPDF.jsx";

/* ---------------- HeaderHero ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-violet-900 via-indigo-700 to-blue-600 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            QR Codes de Presença por Turma
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Gere um PDF com QR Code para registrar a presença dos participantes em cada turma.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 w-full sm:w-auto
            ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
          aria-label="Atualizar eventos e turmas"
        >
          <RefreshCcw className="w-4 h-4" aria-hidden="true" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

/* ---------------- Utils ---------------- */
const safeStr = (s, max = 200) => String(s ?? "").slice(0, max).trim();
const tituloEvento = (ev) => safeStr(ev?.titulo || ev?.nome || `Evento #${ev?.id ?? "—"}`, 170);
const tituloTurma = (t) => safeStr(t?.nome || `Turma #${t?.id ?? "—"}`, 170);

/* ---------------- Página ---------------- */
export default function QRCodesEventosAdmin() {
  const reduceMotion = useReducedMotion();

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [eventos, setEventos] = useState([]); // [{...evento, turmas: []}]
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState(() => localStorage.getItem("qr:busca") || "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  const [gerando, setGerando] = useState(null); // turmaId em processamento

  const liveRef = useRef(null);
  const erroRef = useRef(null);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  /* ---------------- Carregar dados ---------------- */
  async function carregar() {
    setCarregandoDados(true);
    setErro("");
    setLive("Carregando eventos e turmas…");

    try {
      // services/api geralmente já prefixa /api
      const listaEventos = await apiGet("eventos", { on403: "silent" });
      const eventosArr = Array.isArray(listaEventos) ? listaEventos : [];

      // turmas por evento em paralelo
      const withTurmas = await Promise.all(
        eventosArr.map(async (ev) => {
          try {
            const turmas = await apiGet(`turmas/evento/${ev.id}`, { on403: "silent" });
            return { ...ev, turmas: Array.isArray(turmas) ? turmas : [] };
          } catch {
            return { ...ev, turmas: [] };
          }
        })
      );

      setEventos(withTurmas);
      setLive(
        withTurmas.length
          ? `Foram carregados ${withTurmas.length} evento(s).`
          : "Nenhum evento encontrado."
      );
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar eventos/turmas");
      toast.error("❌ Erro ao carregar eventos/turmas.");
      setLive("Falha ao carregar eventos e turmas.");
      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  /* ---------------- Busca: persistência + debounce ---------------- */
  useEffect(() => {
    localStorage.setItem("qr:busca", busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------------- KPIs ---------------- */
  const totalEventos = eventos.length;
  const totalTurmas = useMemo(
    () => eventos.reduce((acc, e) => acc + (e.turmas?.length || 0), 0),
    [eventos]
  );

  /* ---------------- Filtro ---------------- */
  const eventosFiltrados = useMemo(() => {
    const q = buscaDebounced;
    if (!q) return eventos;
    return eventos.filter((e) => {
      const titulo = tituloEvento(e).toLowerCase();
      return titulo.includes(q);
    });
  }, [eventos, buscaDebounced]);

  const turmasFiltradasCount = useMemo(() => {
    return eventosFiltrados.reduce((acc, e) => acc + (e.turmas?.length || 0), 0);
  }, [eventosFiltrados]);

  const vazio = useMemo(
    () =>
      !carregandoDados &&
      (!eventosFiltrados.length || eventosFiltrados.every((e) => !e.turmas?.length)),
    [carregandoDados, eventosFiltrados]
  );

  /* ---------------- Ações ---------------- */
  const handleGerarPDF = async (t, evTitle, instrutores) => {
    if (gerando) return; // evita duplo clique
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
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
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
          <div
            className={`h-full bg-indigo-700 w-1/3 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      )}

      <main id="conteudo" role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" role="status" />
        <div ref={erroRef} tabIndex={-1} className="sr-only" />

        {/* KPIs + Busca */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-300">Eventos</p>
            <p className="text-2xl font-bold">{totalEventos}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-300">Turmas</p>
            <p className="text-2xl font-bold">{totalTurmas}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3">
            <label htmlFor="busca" className="sr-only">
              Buscar evento
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300"
                aria-hidden="true"
              />
              <input
                id="busca"
                type="search"
                inputMode="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar evento…"
                className="pl-8 pr-8 py-2 w-full rounded-md border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Buscar por nome do evento"
              />
              {!!busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-300" aria-live="polite">
              {eventosFiltrados.length} evento(s) • {turmasFiltradasCount} turma(s)
            </p>
          </div>
        </section>

        {/* Conteúdo principal */}
        <section className="space-y-4" aria-label="Lista de eventos e turmas">
          {carregandoDados ? (
            <CarregandoSkeleton linhas={4} />
          ) : erro ? (
            <p className="text-red-600 dark:text-red-400 text-center" role="alert">
              {erro}
            </p>
          ) : vazio ? (
            <NadaEncontrado mensagem="Nenhum evento com turmas encontrado." />
          ) : (
            eventosFiltrados.map((ev) => {
              const evTitle = tituloEvento(ev);

              return (
                <article
                  key={ev.id}
                  className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4"
                  role="group"
                  aria-label={`Evento ${evTitle}`}
                >
                  <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-semibold text-lousa dark:text-white break-words">
                      {evTitle}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {Array.isArray(ev?.turmas) ? ev.turmas.length : 0} turma(s)
                    </p>
                  </header>

                  {!ev.turmas?.length ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      Nenhuma turma cadastrada para este evento.
                    </p>
                  ) : (
                    <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ev.turmas.map((t) => {
                        // tenta pegar instrutores do evento ou da turma
                        const nomesInstrutores =
                          (Array.isArray(ev?.instrutor) && ev.instrutor.length
                            ? ev.instrutor.map((i) => i?.nome).filter(Boolean)
                            : Array.isArray(t?.instrutor)
                            ? t.instrutor.map((i) => i?.nome).filter(Boolean)
                            : []
                          ).join(", ") || "Instrutor";

                        const tTitle = tituloTurma(t);
                        const isLoading = gerando === t?.id;

                        return (
                          <li
                            key={t.id}
                            className="border rounded-lg p-3 flex items-center justify-between gap-3 dark:border-zinc-700"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                                {tTitle}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                                {nomesInstrutores}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleGerarPDF(t, evTitle, nomesInstrutores)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                                ${
                                  isLoading
                                    ? "bg-indigo-300 cursor-not-allowed text-white focus-visible:ring-indigo-400"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-600"
                                }`}
                              aria-label={`Gerar PDF de QR Code da turma ${tTitle}`}
                              title="Gerar PDF com QR Code de presença"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                  Gerando…
                                </>
                              ) : (
                                "Gerar PDF"
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
