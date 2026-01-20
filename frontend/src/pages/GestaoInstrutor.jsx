/* eslint-disable no-console */
// 📁 src/pages/GestaoInstrutor.jsx  (premium + mobile/PWA + a11y + anti-fuso)
// ✅ upgrades:
// - Modal responsivo + scroll suave + foco/teclado (ESC / trap do react-modal)
// - KPIs mais confiáveis (assinatura por base64/url/flag)
// - Export CSV com BOM (Excel) + nome de arquivo melhor
// - Debounce + persistência opcional de busca/ordem
// - Estados de erro premium + botão "Tentar novamente"
// - Zero alteração de regra de negócio (somente UX/robustez)

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";
import {
  RefreshCcw,
  Search,
  GraduationCap,
  Download,
  SortAsc,
  X,
  History,
  AlertTriangle,
} from "lucide-react";

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

/* ───────── assinatura: detecção mais robusta (sem quebrar compat) ───────── */
function temAssinatura(x) {
  // flags
  if (
    x?.assinado === true ||
    x?.assinatura === true ||
    x?.tem_assinatura === true ||
    x?.possui_assinatura === true ||
    x?.assinatura_valida === true
  )
    return true;

  // base64 / url / path
  const b64 =
    x?.imagem_base64 ||
    x?.assinatura_base64 ||
    x?.assinaturaBase64 ||
    x?.assinatura_imagem_base64;

  if (typeof b64 === "string" && b64.startsWith("data:image/")) return true;

  const url =
    x?.assinatura_url ||
    x?.assinaturaUrl ||
    x?.assinatura_path ||
    x?.assinaturaPath;

  if (typeof url === "string" && url.trim().length > 6) return true;

  return false;
}

/* ───────── Mini UI ───────── */
function MiniStat({ label, value = "—" }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-white backdrop-blur border border-white/10">
      <div className="inline-block rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold text-white">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

/* ---------------- HeaderHero (tema único, premium) ---------------- */
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
    <header className="text-white relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,0.08),transparent_45%)]" />

      <a
        href="#conteudo"
        className="relative sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-[160px] sm:min-h-[190px]">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <GraduationCap className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Instrutores
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Pesquise, visualize histórico e acompanhe avaliações dos instrutores.
          </p>

          {/* Ministats */}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 w-full max-w-3xl">
            <MiniStat label="Total" value={kpis.total} />
            <MiniStat label="Encontrados" value={kpis.encontrados} />
            <MiniStat label="Com assinatura" value={kpis.comAssinatura} />
            <MiniStat label="Sem assinatura" value={kpis.semAssinatura} />
          </div>

          {/* Busca + ações */}
          <div className="mt-3 flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="busca-instrutor" className="sr-only">
                Buscar por nome ou e-mail
              </label>
              <input
                id="busca-instrutor"
                ref={inputRef}
                type="text"
                placeholder="Buscar por nome ou e-mail… (/) "
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-xl bg-white px-4 py-2 pl-10 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-white/60"
                autoComplete="off"
                inputMode="search"
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
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition
                ${
                  carregando
                    ? "cursor-not-allowed opacity-60 bg-white/20"
                    : "bg-white/15 hover:bg-white/25"
                } text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
              aria-label="Atualizar lista de instrutores"
              aria-busy={carregando ? "true" : "false"}
              title="Atualizar"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {carregando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────── Modal styles (mobile-first, premium) ───────── */
const modalStyle = {
  overlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 80,
    padding: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    position: "relative",
    inset: "auto",
    border: "none",
    background: "transparent",
    padding: 0,
    width: "100%",
    maxWidth: "760px",
    maxHeight: "92vh",
    overflow: "visible",
  },
};

export default function GestaoInstrutor() {
  const [instrutores, setInstrutores] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState(() => localStorage.getItem("gi:busca") || "");

  const [ordenarPor, setOrdenarPor] = useState(() => localStorage.getItem("gi:ord") || "nome_asc"); // nome_asc | nome_desc | email_asc
  const [historico, setHistorico] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState(null);

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = (msg) => liveRef.current && (liveRef.current.textContent = msg);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  // persist filtros
  useEffect(() => {
    try { localStorage.setItem("gi:busca", busca); } catch {}
  }, [busca]);
  useEffect(() => {
    try { localStorage.setItem("gi:ord", ordenarPor); } catch {}
  }, [ordenarPor]);

  /* ---------- carregar lista ---------- */
  const carregarInstrutores = useCallback(async () => {
    try {
      setCarregandoDados(true);
      setErro("");
      setLive("Carregando instrutores…");

      abortRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const data = await apiGet("/api/instrutor", { on403: "silent", signal: ctrl.signal });
      const lista =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.lista)
          ? data.lista
          : Array.isArray(data?.instrutores)
          ? data.instrutores
          : [];

      if (!mountedRef.current) return;
      setInstrutores(lista);
      setLive(`Instrutores carregados: ${lista.length}.`);
    } catch (err) {
      if (err?.name === "AbortError") return;
      const msg = err?.message || "Erro ao carregar instrutores.";
      if (!mountedRef.current) return;
      setErro(msg);
      setInstrutores([]);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar instrutores.");
    } finally {
      if (mountedRef.current) setCarregandoDados(false);
    }
  }, []);

  useEffect(() => {
    carregarInstrutores();
  }, [carregarInstrutores]);

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
        case "nome_desc":
          return bn.localeCompare(an) || be.localeCompare(ae);
        case "email_asc":
          return ae.localeCompare(be) || an.localeCompare(bn);
        case "nome_asc":
        default:
          return an.localeCompare(bn) || ae.localeCompare(be);
      }
    });

    return sorted;
  }, [instrutores, q, ordenarPor]);

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const total = instrutores.length;
    const encontrados = filtrados.length;

    const comAssinatura = filtrados.filter((x) => temAssinatura(x)).length;
    const semAssinatura = encontrados - comAssinatura;

    return {
      total: String(total),
      encontrados: String(encontrados),
      comAssinatura: String(comAssinatura),
      semAssinatura: String(semAssinatura),
    };
  }, [instrutores, filtrados]);

  /* ---------- histórico (modal) ---------- */
  async function abrirModalVisualizar(instrutor) {
    setInstrutorSelecionado(instrutor);
    setModalHistoricoAberto(true);
    setHistorico([]);

    try {
      setLive(`Carregando histórico de ${instrutor?.nome}…`);
      const data = await apiGet(`/api/instrutor/${instrutor.id}/eventos-avaliacao`, { on403: "silent" });

      const eventos = (Array.isArray(data) ? data : []).map((ev) => ({
        id: ev.evento_id ?? ev.id ?? `${ev.evento}-${ev.data_inicio}-${ev.data_fim}`,
        titulo: ev.evento || ev.titulo || "Evento",
        data_inicio_ymd: ymd(ev.data_inicio || ev.data_inicio_geral || ev.inicio),
        data_fim_ymd: ymd(ev.data_fim || ev.data_fim_geral || ev.fim),
        nota_media:
          ev.nota_media !== null && ev.nota_media !== undefined
            ? Number(ev.nota_media)
            : null,
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
      const headers = ["id", "nome", "email"];
      const rows = filtrados.map((p) => [p?.id ?? "", p?.nome ?? "", p?.email ?? ""]);

      // BOM para Excel (pt-BR) abrir corretamente
      const bom = "\uFEFF";
      const content =
        bom +
        [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");

      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });

      const hoje = new Date();
      const p = (n) => String(n).padStart(2, "0");
      const stamp = `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;

      downloadBlob(`instrutores_${stamp}.csv`, blob);
      toast.success("📄 CSV exportado.");
    } catch (e) {
      console.error("CSV erro", e);
      toast.error("Não foi possível exportar o CSV.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gelo text-black dark:bg-zinc-900 dark:text-white overflow-x-hidden">
      {/* Live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {/* Header hero */}
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
          className="sticky top-0 z-40 h-1 w-full bg-violet-200 dark:bg-violet-950/30"
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
        className="sticky top-1 z-30 mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 overflow-x-hidden"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Ordenação */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
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

            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="ml-1 rounded-xl border border-white/0 bg-zinc-100 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700"
                aria-label="Limpar busca"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Exportar CSV */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={carregandoDados || !filtrados.length}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {filtrados.length} item{filtrados.length === 1 ? "" : "s"} na visualização
            </span>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <main id="conteudo" className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 overflow-x-hidden flex-1">
        {carregandoDados ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={70} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div
            className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">Não foi possível carregar.</p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 break-words">{erro}</p>
                <button
                  type="button"
                  onClick={carregarInstrutores}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <section aria-label="Tabela de instrutores">
            <TabelaInstrutor instrutor={Array.isArray(filtrados) ? filtrados : []} onVisualizar={abrirModalVisualizar} />

            {!filtrados.length && (
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                Nenhum instrutor corresponde à busca.
              </p>
            )}
          </section>
        )}
      </main>

      {/* Modal Histórico (premium + scroll + a11y) */}
      <Modal
        isOpen={modalHistoricoAberto}
        onRequestClose={() => setModalHistoricoAberto(false)}
        style={modalStyle}
        contentLabel="Histórico do instrutor"
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
      >
        <div className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[92vh] flex flex-col">
          {/* top bar colorida */}
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-600" />

          {/* header sticky */}
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Histórico do instrutor</p>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white break-words">
                  {instrutorSelecionado?.nome || "—"}
                </h2>
                {instrutorSelecionado?.email && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 break-words">
                    {instrutorSelecionado.email}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setModalHistoricoAberto(false)}
                className="shrink-0 inline-flex items-center justify-center rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* conteúdo rolável */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {historico.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4">
                <div className="flex items-start gap-3">
                  <History className="w-5 h-5 text-zinc-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-white">Nenhum evento encontrado</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Se você esperava ver eventos aqui, confirme se o instrutor está vinculado corretamente ao evento/turma.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {historico.map((evento) => (
                  <li
                    key={evento.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                  >
                    <p className="font-extrabold text-zinc-900 dark:text-white break-words">
                      {evento.titulo}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="zinc">
                        Período: <strong className="ml-1">{ymdToBR(evento.data_inicio_ymd)}</strong> →{" "}
                        <strong>{ymdToBR(evento.data_fim_ymd)}</strong>
                      </Badge>

                      <Badge tone={evento.nota_media !== null ? "amber" : "zinc"}>
                        Média:{" "}
                        <strong className="ml-1">
                          {evento.nota_media !== null ? `${evento.nota_media.toFixed(1)} / 10` : "N/A"}
                        </strong>
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* footer */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-end gap-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
            <button
              type="button"
              onClick={() => setModalHistoricoAberto(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
