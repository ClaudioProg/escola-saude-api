/* eslint-disable no-console */
// 📁 src/pages/GestaoInstrutor.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";
import { RefreshCcw, Search, GraduationCap, Download, SortAsc } from "lucide-react";

import { apiGet } from "../services/api";
import TabelaInstrutor from "../components/TabelaInstrutor";
import Footer from "../components/Footer";

// (Rota já protegida por <PrivateRoute permitido={["administrador"]}> no App.jsx)
Modal.setAppElement("#root");

/* ───────── helpers ───────── */
const sLower = (v) => String(v ?? "").toLowerCase();
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

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

/* ───────── Mini UI ───────── */
function MiniStat({ label, value = "—" }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-white backdrop-blur">
      <div className="inline-block rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold text-white">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

/* ---------------- HeaderHero (cor única sólida) ---------------- */
function HeaderHero({ onRefresh, carregando, busca, setBusca, kpis }) {
  const inputRef = useRef(null);

  // atalho: "/" foca busca
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="bg-violet-800 text-white" role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-9 min-h-[150px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <GraduationCap className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Instrutores
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Pesquise, visualize histórico e acompanhe avaliações dos instrutores.
          </p>

          {/* Ministats */}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={kpis.total} />
            <MiniStat label="Encontrados" value={kpis.encontrados} />
            <MiniStat label="Com e-mail" value={kpis.comEmail} />
            <MiniStat label="Sem e-mail" value={kpis.semEmail} />
          </div>

          {/* Ações / Busca inline para mobile */}
          <div className="mt-3 flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor="busca-instrutor" className="sr-only">
                Buscar por nome ou e-mail
              </label>
              <input
                id="busca-instrutor"
                ref={inputRef}
                type="text"
                placeholder="Buscar por nome ou e-mail… (/)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-md bg-white px-4 py-2 pl-10 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-white/60"
                autoComplete="off"
              />
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
                aria-hidden="true"
              />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={carregando}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${carregando ? "cursor-not-allowed opacity-60 bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de instrutores"
              aria-busy={carregando ? "true" : "false"}
            >
              <RefreshCcw className="h-4 w-4" />
              {carregando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function GestaoInstrutor() {
  const [instrutores, setInstrutores] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const [ordenarPor, setOrdenarPor] = useState("nome_asc"); // nome_asc | nome_desc | email_asc
  const [historico, setHistorico] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState(null);

  const liveRef = useRef(null);
  const setLive = (msg) => liveRef.current && (liveRef.current.textContent = msg);

  /* ---------- carregar lista ---------- */
  const carregarInstrutores = useCallback(async () => {
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
  }, []);

  useEffect(() => { carregarInstrutores(); }, [carregarInstrutores]);

  /* ---------- busca com debounce ---------- */
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(sLower(busca).trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* ---------- filtro + ordenação ---------- */
  const filtrados = useMemo(() => {
    const base = (instrutores || []).filter(
      (p) => sLower(p?.nome).includes(q) || sLower(p?.email).includes(q)
    );

    const sorted = [...base].sort((a, b) => {
      const an = sLower(a?.nome);
      const bn = sLower(b?.nome);
      const ae = sLower(a?.email);
      const be = sLower(b?.email);
      switch (ordenarPor) {
        case "nome_desc": return bn.localeCompare(an) || be.localeCompare(ae);
        case "email_asc": return ae.localeCompare(be) || an.localeCompare(bn);
        case "nome_asc":
        default: return an.localeCompare(bn) || ae.localeCompare(be);
      }
    });

    return sorted;
  }, [instrutores, q, ordenarPor]);

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const total = instrutores.length;
    const encontrados = filtrados.length;
    const comEmail = filtrados.filter((x) => !!String(x?.email || "").trim()).length;
    const semEmail = encontrados - comEmail;
    return { total: String(total), encontrados: String(encontrados), comEmail: String(comEmail), semEmail: String(semEmail) };
  }, [instrutores, filtrados]);

  /* ---------- histórico (modal) ---------- */
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
        nota_media: ev.nota_media !== null && ev.nota_media !== undefined ? Number(ev.nota_media) : null,
      }));
      setHistorico(eventos);
      setLive("Histórico carregado.");
    } catch (e) {
      toast.error("❌ Erro ao buscar histórico do instrutor.");
      setHistorico([]);
      setLive("Falha ao carregar histórico.");
    }
  }

  /* ---------- exportação CSV da lista filtrada ---------- */
  const onExportCsv = () => {
    try {
      const headers = [
        "id", "nome", "email",
      ];
      const rows = filtrados.map((p) => [
        p?.id ?? "",
        p?.nome ?? "",
        p?.email ?? "",
      ]);
      const content = [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      downloadBlob(`instrutores_${new Date().toISOString().slice(0,10)}.csv`, blob);
      toast.success("📄 CSV exportado.");
    } catch (e) {
      console.error("CSV erro", e);
      toast.error("Não foi possível exportar o CSV.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gelo text-black dark:bg-zinc-900 dark:text-white">
      {/* Live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header hero (violeta sólido) */}
      <HeaderHero
        onRefresh={carregarInstrutores}
        carregando={carregandoDados}
        busca={busca}
        setBusca={setBusca}
        kpis={kpis}
      />

      {/* progress bar fina */}
      {carregandoDados && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-violet-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-violet-700" />
        </div>
      )}

      {/* Barra sticky de ferramentas */}
      <section
        aria-label="Ferramentas de lista"
        className="sticky top-1 z-30 mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Ordenação */}
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <label htmlFor="ord" className="text-xs text-zinc-600 dark:text-zinc-300">
              Ordenar por
            </label>
            <select
              id="ord"
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value)}
              className="rounded-xl border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-700 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="nome_asc">Nome (A–Z)</option>
              <option value="nome_desc">Nome (Z–A)</option>
              <option value="email_asc">E-mail (A–Z)</option>
            </select>
          </div>

          {/* Exportar CSV */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={carregandoDados || !filtrados.length}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-sm text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            <span className="text-xs text-zinc-500">
              {filtrados.length} item{filtrados.length === 1 ? "" : "s"} na visualização
            </span>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <div id="conteudo" className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
        {carregandoDados ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={70} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-center text-red-500" role="alert">
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
        className="outline-none"
        overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
        contentLabel="Histórico do instrutor"
        shouldCloseOnOverlayClick
      >
        <div
          className="
            mx-auto w-full max-w-xl rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-2xl
            max-h-[92vh] flex flex-col overflow-hidden
          "
        >
          {/* header sticky */}
          <div className="sticky top-0 z-10 border-b bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
            <h2 className="text-lg font-bold text-black dark:text-white">
              Histórico de {instrutorSelecionado?.nome}
            </h2>
          </div>

          {/* conteúdo rolável */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {historico.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-300">Nenhum evento encontrado.</p>
            ) : (
              <ul className="space-y-3">
                {historico.map((evento) => (
                  <li
                    key={evento.id}
                    className="rounded-md border bg-gray-50 p-3 text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <p className="font-semibold">{evento.titulo}</p>
                    <p className="text-sm">
                      Data: {ymdToBR(evento.data_inicio_ymd)} até {ymdToBR(evento.data_fim_ymd)}
                    </p>
                    <p className="text-sm">
                      Média de avaliação:{" "}
                      <strong>
                        {evento.nota_media !== null ? evento.nota_media.toFixed(1) : "N/A"}
                      </strong>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* rodapé */}
          <div className="border-t px-4 py-3 text-right dark:border-gray-700">
            <button
              onClick={() => setModalHistoricoAberto(false)}
              className="rounded-md bg-zinc-700 px-4 py-2 font-medium text-white shadow transition hover:bg-zinc-800"
            >
              ❌ Fechar
            </button>
          </div>
        </div>
      </Modal>

      <Footer />
    </main>
  );
}
