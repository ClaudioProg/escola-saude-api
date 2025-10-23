/* eslint-disable no-console */
// 📁 src/pages/GestaoPresenca.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, RefreshCcw, UsersRound, CalendarDays } from "lucide-react";

import { apiGet } from "../services/api";
import Footer from "../components/Footer";
import Spinner from "../components/Spinner";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca";

/* ---------------- HeaderHero (teal sólido) ---------------- */
function HeaderHero({ onAtualizar, atualizando, agrupamento, setAgrupamento }) {
  return (
    <header className="bg-teal-700 text-white" role="banner">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2">
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <ClipboardCheck className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gestão de presenças</h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Visualize turmas, consulte inscritos e acompanhe presenças com segurança.
          </p>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${atualizando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>

          {/* seletor de agrupamento (global) */}
          <div className="mt-2 inline-flex items-center gap-1 bg-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setAgrupamento("pessoa")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                agrupamento === "pessoa" ? "bg-white text-teal-700" : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "pessoa"}
              title="Agrupar por pessoa (cada usuário e suas datas)"
            >
              <UsersRound className="w-4 h-4" />
              Pessoas
            </button>
            <button
              type="button"
              onClick={() => setAgrupamento("data")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                agrupamento === "data" ? "bg-white text-teal-700" : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "data"}
              title="Agrupar por data (cada data e todos os usuários)"
            >
              <CalendarDays className="w-4 h-4" />
              Datas
            </button>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function PaginaGestaoPresencas() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erro, setErro] = useState("");
  const [agrupamento, setAgrupamento] = useState("pessoa"); // "pessoa" | "data"
  const liveRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  async function carregarEventos() {
    try {
      setCarregandoEventos(true);
      setErro("");
      setLive("Carregando eventos…");
      const data = await apiGet("/api/presencas/admin/listar-tudo", { on403: "silent" });
      const listaEventos = Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.lista)
        ? data.lista
        : [];
      setEventos(listaEventos);
      setLive(`Eventos carregados: ${listaEventos.length}.`);
    } catch (err) {
      const msg = err?.message || "Erro ao carregar eventos.";
      setErro(msg);
      toast.error(msg);
      setEventos([]);
      setLive("Falha ao carregar eventos.");
    } finally {
      setCarregandoEventos(false);
    }
  }

  useEffect(() => {
    carregarEventos();
  }, []);

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

  // usa /detalhes e guarda {datas, usuarios}
  async function carregarPresencas(turmaId) {
    try {
      setLive(`Carregando presenças da turma ${turmaId}…`);
      const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
      setLive("Presenças carregadas.");
    } catch {
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
      setLive("Falha ao carregar presenças.");
    }
  }

  const anyLoading = carregandoEventos;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header hero */}
      <HeaderHero
        onAtualizar={carregarEventos}
        atualizando={carregandoEventos}
        agrupamento={agrupamento}
        setAgrupamento={setAgrupamento}
      />

      {/* barra de progresso fina quando carregando */}
      {anyLoading && (
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

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {erro && (
          <p className="text-center text-red-600 dark:text-red-400 mb-4" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        {carregandoEventos ? (
          <div className="flex justify-center py-10" aria-busy="true" aria-live="polite">
            <Spinner label="Carregando eventos..." />
          </div>
        ) : (
          <ListaTurmasPresenca
            eventos={eventos}
            hoje={new Date()}
            carregarInscritos={carregarInscritos}
            carregarAvaliacoes={carregarAvaliacoes}
            carregarPresencas={carregarPresencas}
            presencasPorTurma={presencasPorTurma}
            gerarRelatorioPDF={() => {}}
            inscritosPorTurma={inscritosPorTurma}
            avaliacoesPorTurma={avaliacoesPorTurma}
            navigate={navigate}
            modoadministradorPresencas
            agrupamento={agrupamento}  // ⬅️ "pessoa" | "data"
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
