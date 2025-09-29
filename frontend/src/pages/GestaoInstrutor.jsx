/* eslint-disable no-console */
// 📁 src/pages/GestaoInstrutor.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";
import { RefreshCcw, Search, GraduationCap } from "lucide-react";

import { apiGet } from "../services/api";
import TabelaInstrutor from "../components/TabelaInstrutor";
import Footer from "../components/Footer";

// (Rota já protegida por <PrivateRoute permitido={["administrador"]}> no App.jsx)
Modal.setAppElement("#root");

// ---------- helpers anti-fuso ----------
function ymd(input) {
  if (!input) return "";
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function ymdToBR(s) {
  const m = ymd(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}
// --------------------------------------

/* ---------------- HeaderHero (roxo, título central e altura média) ---------------- */
function HeaderHero({ onRefresh, carregando, busca, setBusca }) {
  const inputRef = useRef(null);
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-fuchsia-900 via-violet-800 to-indigo-700 text-white"
      role="banner"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-9 min-h-[150px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <GraduationCap className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Instrutor
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Pesquise, visualize histórico e acompanhe avaliações dos instrutores.
          </p>

          {/* Ações / Busca inline para mobile */}
          <div className="mt-3 flex w-full max-w-xl flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <label htmlFor="busca-instrutor" className="sr-only">
                Buscar por nome ou e-mail
              </label>
              <input
                id="busca-instrutor"
                ref={inputRef}
                type="text"
                placeholder="Buscar por nome ou e-mail…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full px-4 py-2 pl-10 rounded-md bg-white/95 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-white/60"
                autoComplete="off"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={carregando}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de instrutores"
              aria-busy={carregando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" />
              {carregando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function GestaoInstrutor() {
  const [instrutores, setInstrutores] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const [historico, setHistorico] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState(null);

  const liveRef = useRef(null);
  const setLive = (msg) => liveRef.current && (liveRef.current.textContent = msg);

  async function carregarInstrutores() {
    try {
      setCarregandoDados(true);
      setErro("");
      setLive("Carregando instrutores…");
      const data = await apiGet("/api/instrutor", { on403: "silent" });
      const lista =
        Array.isArray(data) ? data :
        Array.isArray(data?.lista) ? data.lista :
        Array.isArray(data?.instrutores) ? data.instrutores :
        [];
      setInstrutores(lista);
      setLive(`Instrutores carregados: ${lista.length}.`);
    } catch (err) {
      const msg = err?.message || "Erro ao carregar instrutores.";
      setErro(msg);
      setInstrutores([]);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar instrutores.");
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => { carregarInstrutores(); }, []);

  const normaliza = (s) => (typeof s === "string" ? s.toLowerCase() : "");
  const filtrados = useMemo(() => {
    const alvo = normaliza(busca);
    return (instrutores || []).filter(
      (p) => normaliza(p?.nome).includes(alvo) || normaliza(p?.email).includes(alvo)
    );
  }, [instrutores, busca]);

  async function abrirModalVisualizar(instrutor) {
    setInstrutorSelecionado(instrutor);
    setModalHistoricoAberto(true);
    try {
      setLive(`Carregando histórico de ${instrutor?.nome}…`);
      const data = await apiGet(`/api/instrutor/${instrutor.id}/eventos-avaliacoes`, { on403: "silent" });
      const eventos = (Array.isArray(data) ? data : []).map((ev) => ({
        id: ev.evento_id,
        titulo: ev.evento,
        data_inicio_ymd: ymd(ev.data_inicio),
        data_fim_ymd: ymd(ev.data_fim),
        nota_media:
          ev.nota_media !== null && ev.nota_media !== undefined ? Number(ev.nota_media) : null,
      }));
      setHistorico(eventos);
      setLive("Histórico carregado.");
    } catch (e) {
      toast.error("❌ Erro ao buscar histórico do instrutor.");
      setHistorico([]);
      setLive("Falha ao carregar histórico.");
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header hero roxo */}
      <HeaderHero
        onRefresh={carregarInstrutores}
        carregando={carregandoDados}
        busca={busca}
        setBusca={setBusca}
      />

      {/* Conteúdo */}
      <div className="px-3 sm:px-4 py-6 max-w-6xl mx-auto w-full">
        {carregandoDados ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={70} className="rounded-lg" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center" role="alert">
            {erro}
          </p>
        ) : (
          <section aria-label="Tabela de instrutores">
            <TabelaInstrutor
              instrutor={Array.isArray(filtrados) ? filtrados : []}
              onVisualizar={abrirModalVisualizar}
            />
            {!filtrados.length && (
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                Nenhum instrutor corresponde à busca.
              </p>
            )}
          </section>
        )}
      </div>

      {/* Modal Histórico */}
      <Modal
        isOpen={modalHistoricoAberto}
        onRequestClose={() => setModalHistoricoAberto(false)}
        className="bg-white dark:bg-gray-800 w-[92vw] max-w-xl mx-auto mt-20 p-6 rounded-xl shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black/50 flex justify-center items-start z-50"
        contentLabel="Histórico do instrutor"
        shouldCloseOnOverlayClick
      >
        <h2 className="text-xl font-bold mb-4 text-black dark:text-white">
          Histórico de {instrutorSelecionado?.nome}
        </h2>

        {historico.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-300">Nenhum evento encontrado.</p>
        ) : (
          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-2">
            <ul className="space-y-3">
              {historico.map((evento) => (
                <li
                  key={evento.id}
                  className="border p-3 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm"
                >
                  <p className="font-semibold">{evento.titulo}</p>
                  <p className="text-sm">
                    Data: {ymdToBR(evento.data_inicio_ymd)} até {ymdToBR(evento.data_fim_ymd)}
                  </p>
                  <p className="text-sm">
                    Média de avaliação:{" "}
                    <strong>{evento.nota_media !== null ? evento.nota_media.toFixed(1) : "N/A"}</strong>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setModalHistoricoAberto(false)}
            className="px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-800 text-white font-medium shadow transition"
          >
            ❌ Fechar
          </button>
        </div>
      </Modal>

      <Footer />
    </main>
  );
}
