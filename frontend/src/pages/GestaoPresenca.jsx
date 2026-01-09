/* eslint-disable no-console */
// ✅ src/pages/GestaoPresenca.jsx (premium + mobile/PWA + a11y + sem mudar regra)
// - HeaderHero com identidade própria (teal + glow) + ministats
// - Persistência do agrupamento (localStorage)
// - AbortController + mountedRef (evita setState em unmount)
// - Estados de erro premium + "Tentar novamente"
// - Barra de progresso fina + live region
// - Mantém regra: ListaTurmasPresenca continua “dona” do fluxo de presenças
//   (não forço carregamento antecipado; só passo props úteis)

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  RefreshCcw,
  UsersRound,
  CalendarDays,
  AlertTriangle,
  Sparkles,
  Layers,
} from "lucide-react";

import { apiGet } from "../services/api";
import Footer from "../components/Footer";
import Spinner from "../components/Spinner";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca";

/* ---------------- helpers de data/tempo (TZ BR) ---------------- */
function nowBR() {
  return new Date();
}

/* ---------------- MiniStats ---------------- */
function MiniStat({ icon: Icon, label, value, accent = "from-teal-600 to-emerald-500" }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3 text-left shadow-sm">
      <div className="flex items-center gap-2 text-white/90">
        <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center bg-gradient-to-r ${accent}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-white/80">{label}</div>
          <div className="text-xl font-extrabold tracking-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HeaderHero (teal premium) ---------------- */
function HeaderHero({ onAtualizar, atualizando, agrupamento, setAgrupamento, kpis }) {
  return (
    <header className="text-white relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-700" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,0.08),transparent_45%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-cyan-300"
      />

      <a
        href="#conteudo"
        className="relative sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[160px] sm:min-h-[190px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <ClipboardCheck className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de presenças
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Visualize turmas, consulte inscritos e acompanhe presenças com segurança.
          </p>

          {/* Ministats */}
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-4xl">
            <MiniStat
              icon={Layers}
              label="Eventos"
              value={kpis.eventos}
              accent="from-cyan-600 to-sky-500"
            />
            <MiniStat
              icon={CalendarDays}
              label="Turmas"
              value={kpis.turmas}
              accent="from-emerald-600 to-teal-500"
            />
            <MiniStat
              icon={Sparkles}
              label="Agrupamento"
              value={agrupamento === "pessoa" ? "Pessoas" : "Datas"}
              accent="from-teal-500 to-cyan-500"
            />
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition
                ${
                  atualizando
                    ? "opacity-60 cursor-not-allowed bg-white/20"
                    : "bg-white/15 hover:bg-white/25"
                } text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
              title="Atualizar"
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>

          {/* seletor de agrupamento (global) */}
          <div className="mt-2 inline-flex items-center gap-1 bg-white/10 rounded-2xl p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setAgrupamento("pessoa")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                agrupamento === "pessoa"
                  ? "bg-white text-teal-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "pessoa"}
              title="Agrupar por pessoa (cada usuário e suas datas)"
            >
              <UsersRound className="w-4 h-4" aria-hidden="true" />
              Pessoas
            </button>
            <button
              type="button"
              onClick={() => setAgrupamento("data")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                agrupamento === "data"
                  ? "bg-white text-teal-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "data"}
              title="Agrupar por data (cada data e todos os usuários)"
            >
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              Datas
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ---------------- Página ---------------- */
export default function PaginaGestaoPresencas() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erro, setErro] = useState("");

  const [agrupamento, setAgrupamento] = useState(
    () => localStorage.getItem("presenca:agrupamento") || "pessoa"
  ); // "pessoa" | "data"

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  // persist agrupamento
  useEffect(() => {
    try {
      localStorage.setItem("presenca:agrupamento", agrupamento);
    } catch {
      /* noop */
    }
  }, [agrupamento]);

  const kpis = useMemo(() => {
    const evCount = Array.isArray(eventos) ? eventos.length : 0;
    const turmasCount = (eventos || []).reduce((acc, ev) => {
      const ts = Array.isArray(ev?.turmas) ? ev.turmas : [];
      return acc + ts.length;
    }, 0);
    return { eventos: evCount, turmas: turmasCount };
  }, [eventos]);

  const carregarEventos = useCallback(async () => {
    try {
      setCarregandoEventos(true);
      setErro("");
      setLive("Carregando eventos…");

      abortRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const data = await apiGet("/api/presencas/admin/listar-tudo", {
        on403: "silent",
        signal: ctrl.signal,
      });

      const listaEventos = Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.lista)
        ? data.lista
        : [];

      if (!mountedRef.current) return;

      setEventos(listaEventos);
      setLive(`Eventos carregados: ${listaEventos.length}.`);
    } catch (err) {
      if (err?.name === "AbortError") return;

      const msg = err?.message || "Erro ao carregar eventos.";
      if (!mountedRef.current) return;

      setErro(msg);
      setEventos([]);
      toast.error(msg);
      setLive("Falha ao carregar eventos.");

      // foca mensagem de erro (a11y)
      setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) setCarregandoEventos(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  async function carregarInscritos(turmaId) {
    try {
      setLive(`Carregando inscritos da turma ${turmaId}…`);
      const data = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
      const lista = Array.isArray(data) ? data : data?.lista;
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(lista) ? lista : [] }));
      setLive(`Inscritos da turma ${turmaId} carregados.`);
    } catch {
      toast.error("Erro ao carregar inscritos.");
      setLive("Falha ao carregar inscritos.");
    }
  }

  async function carregarAvaliacoes(turmaId) {
    try {
      setLive(`Carregando avaliações da turma ${turmaId}…`);
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, { on403: "silent" });
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
      setLive("Avaliações carregadas.");
    } catch {
      toast.error("Erro ao carregar avaliações.");
      setLive("Falha ao carregar avaliações.");
    }
  }

  const anyLoading = carregandoEventos;
  const agora = nowBR();

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {/* Header hero */}
      <HeaderHero
        onAtualizar={carregarEventos}
        atualizando={carregandoEventos}
        agrupamento={agrupamento}
        setAgrupamento={setAgrupamento}
        kpis={kpis}
      />

      {/* barra de progresso fina quando carregando */}
      {anyLoading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 dark:bg-emerald-950 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full bg-emerald-700 dark:bg-emerald-600 animate-pulse w-1/3" />
        </div>
      )}

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {!!erro && !carregandoEventos && (
          <div
            ref={erroRef}
            tabIndex={-1}
            className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 outline-none"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">
                  Não foi possível carregar a gestão de presenças
                </p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 break-words">{erro}</p>
                <button
                  type="button"
                  onClick={carregarEventos}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {carregandoEventos ? (
          <div className="flex justify-center py-10" aria-busy="true" aria-live="polite">
            <Spinner label="Carregando eventos..." />
          </div>
        ) : (
          <ListaTurmasPresenca
            eventos={eventos}
            hoje={agora}
            carregarInscritos={carregarInscritos}
            carregarAvaliacoes={carregarAvaliacoes}
            gerarRelatorioPDF={() => {}}
            inscritosPorTurma={inscritosPorTurma}
            avaliacoesPorTurma={avaliacoesPorTurma}
            navigate={navigate}
            modoadministradorPresencas
            agrupamento={agrupamento}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
