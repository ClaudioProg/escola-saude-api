// ✅ src/pages/QRCodesEventosAdmin.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { QrCode, RefreshCcw, Search } from "lucide-react";

import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";
import { gerarQrCodePresencaPDF } from "../utils/gerarQrCodePresencaPDF.jsx";

/* ---------------- HeaderHero (novo) ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-cyan-900 via-teal-700 to-emerald-600 text-white"
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" />
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
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
            ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
          aria-label="Atualizar eventos e turmas"
        >
          <RefreshCcw className="w-4 h-4" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

export default function QRCodesEventosAdmin() {
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [eventos, setEventos] = useState([]); // [{...evento, turmas: []}]
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const liveRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  async function carregar() {
    setCarregandoDados(true);
    setErro("");
    setLive("Carregando eventos e turmas…");

    try {
      // 1) Carrega eventos
      const listaEventos = await apiGet("/api/eventos", { on403: "silent" });
      const eventosArr = Array.isArray(listaEventos) ? listaEventos : [];

      // 2) Carrega turmas por evento em paralelo
      const withTurmas = await Promise.all(
        eventosArr.map(async (ev) => {
          try {
            const turmas = await apiGet(`/api/turmas/evento/${ev.id}`, { on403: "silent" });
            return { ...ev, turmas: Array.isArray(turmas) ? turmas : [] };
          } catch {
            return { ...ev, turmas: [] };
          }
        })
      );

      setEventos(withTurmas);
      setErro("");
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
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const totalEventos = eventos.length;
  const totalTurmas = useMemo(
    () => eventos.reduce((acc, e) => acc + (e.turmas?.length || 0), 0),
    [eventos]
  );

  const eventosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter((e) => {
      const titulo = (e.titulo || e.nome || "").toLowerCase();
      return titulo.includes(q);
    });
  }, [eventos, busca]);

  const vazio = useMemo(
    () => !carregandoDados && (!eventosFiltrados.length || eventosFiltrados.every((e) => !e.turmas?.length)),
    [carregandoDados, eventosFiltrados]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregar} carregando={carregandoDados} />

      {/* barra de progresso fina no topo */}
      {carregandoDados && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full bg-emerald-700 animate-pulse w-1/3" />
        </div>
      )}

      <main role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

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
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-300" />
              <input
                id="busca"
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar evento…"
                className="w-full bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-400"
                aria-label="Buscar por nome do evento"
              />
            </div>
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
            eventosFiltrados.map((ev) => (
              <div key={ev.id} className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4">
                <h3 className="text-lg font-semibold text-lousa dark:text-white">
                  {ev.titulo || ev.nome || `Evento #${ev.id}`}
                </h3>

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

                      return (
                        <li
                          key={t.id}
                          className="border rounded-lg p-3 flex items-center justify-between gap-3 dark:border-zinc-700"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                              {t.nome || `Turma #${t.id}`}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                              {nomesInstrutores}
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              gerarQrCodePresencaPDF(
                                t,
                                ev.titulo || ev.nome || "Evento",
                                nomesInstrutores
                              )
                            }
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-3 py-1.5 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
                            aria-label={`Gerar PDF de QR Code da turma ${t.nome || t.id}`}
                          >
                            Gerar PDF
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
