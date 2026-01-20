// ✅ src/pages/HistoricoEventos.jsx (premium + mobile-first + a11y + anti-fuso)
// - Header via PageHeader (variant azul) + ministats no topo do conteúdo
// - Filtro por ano + busca (título) + paginação client-side (leve)
// - Cards padrão (barra superior sutil + foco bonito) + badges (avaliado / certificado)
// - Download robusto (apiGetFile) + estados de erro melhores
// - ZERO new Date em datas-only (anti-fuso mantido)

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  Search,
  Filter,
  Download,
  Star,
  Award,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

// 🔵 cabeçalho compacto (três cores via variant="azul") + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

import { formatarDataBrasileira } from "../utils/dateTime";
import { apiGet, apiGetFile } from "../services/api";

/* ---------------- helpers anti-fuso (sem Date/UTC) ---------------- */
const ymd = (s) => {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};
const yearFromYMD = (s) => {
  const m = ymd(s).match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
};
const cmpDescByYMD = (a, b, key) => {
  const A = ymd(a?.[key]) || ymd(a?.data_fim) || "0000-00-00";
  const B = ymd(b?.[key]) || ymd(b?.data_fim) || "0000-00-00";
  return A < B ? 1 : A > B ? -1 : 0;
};
/* ------------------------------------------------------------------ */

function MiniStat({ icon: Icon, label, value, accent = "from-sky-600 to-indigo-600" }) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-xl px-2 py-1 text-white text-xs font-semibold bg-gradient-to-r ${accent}`}>
          {label}
        </div>
        <Icon className="h-5 w-5 text-black/60 dark:text-white/70" aria-hidden="true" />
      </div>
      <p className="text-3xl font-extrabold text-lousa dark:text-white leading-tight">{value}</p>
    </div>
  );
}

function Badge({ tone = "zinc", children }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200 border border-zinc-200/70 dark:border-zinc-800/60",
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/50",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/50",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-200 border border-sky-200/70 dark:border-sky-800/50",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function HistoricoEventos() {
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  // paginação (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const navigate = useNavigate();

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const fetchEventos = async () => {
    try {
      setCarregando(true);
      setErro(null);
      setLive("Carregando histórico…");
      const data = await apiGet("/api/usuarios/historico");
      const lista = Array.isArray(data) ? data : [];
      setEventos(lista);
      setLive(`Histórico carregado: ${lista.length} item(ns).`);
    } catch {
      setErro("Erro ao carregar histórico");
      toast.error("❌ Erro ao carregar histórico.");
      setEventos([]);
      setLive("Falha ao carregar histórico.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  // atalho "/" foca busca
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🔢 anos disponíveis
  const anosDisponiveis = useMemo(() => {
    const anos = new Set();
    for (const ev of eventos) {
      const y = yearFromYMD(ev?.data_inicio);
      if (y) anos.add(y);
    }
    return Array.from(anos).sort((a, b) => b - a);
  }, [eventos]);

  // filtro por ano + busca por título
  const eventosFiltrados = useMemo(() => {
    const q = String(busca || "").trim().toLowerCase();

    const base =
      anoSelecionado === "todos"
        ? eventos
        : eventos.filter((ev) => String(yearFromYMD(ev?.data_inicio)) === String(anoSelecionado));

    const buscados = !q
      ? base
      : base.filter((ev) => String(ev?.titulo ?? "").toLowerCase().includes(q));

    return buscados.slice().sort((a, b) => cmpDescByYMD(a, b, "data_fim"));
  }, [eventos, anoSelecionado, busca]);

  // KPIs rápidos
  const kpis = useMemo(() => {
    const total = eventosFiltrados.length;
    let avaliados = 0;
    let certificados = 0;

    for (const ev of eventosFiltrados) {
      if (ev?.avaliado) avaliados += 1;
      if (ev?.certificado_disponivel && ev?.certificado_id) certificados += 1;
    }
    return { total, avaliados, certificados };
  }, [eventosFiltrados]);

  // paginação
  const totalItems = eventosFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  useEffect(() => setPage(1), [anoSelecionado, busca, pageSize]);

  const pageClamped = Math.min(page, totalPages);
  const sliceStart = (pageClamped - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const eventosPaginados = useMemo(
    () => eventosFiltrados.slice(sliceStart, sliceEnd),
    [eventosFiltrados, sliceStart, sliceEnd]
  );

  async function baixarCertificado(id) {
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados/${id}/download`);
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error("Arquivo inválido.");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `certificado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("❌ Não foi possível baixar o certificado.");
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Faixa de título (três cores – variant azul) */}
      <PageHeader
        title="Histórico de Eventos"
        icon={CalendarDays}
        variant="azul"
        rightSlot={
          <button
            type="button"
            onClick={fetchEventos}
            disabled={carregando}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"}`}
            aria-label="Atualizar histórico de eventos"
            aria-busy={carregando ? "true" : "false"}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
        subtitle={`${kpis.total} registro${kpis.total === 1 ? "" : "s"}`}
      />

      <main role="main" className="flex-1 px-2 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <div className="max-w-6xl mx-auto">
          <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Histórico de Eventos" }]} />

          {/* KPIs */}
          {!carregando && !erro && (
            <section className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Resumo do histórico">
              <MiniStat icon={CalendarDays} label="Total filtrado" value={kpis.total} accent="from-sky-600 to-indigo-600" />
              <MiniStat icon={Star} label="Avaliados" value={kpis.avaliados} accent="from-amber-600 to-orange-600" />
              <MiniStat icon={Award} label="Com certificado" value={kpis.certificados} accent="from-emerald-600 to-teal-600" />
            </section>
          )}

          {/* Toolbar filtros */}
          <section
            aria-label="Filtros e busca"
            className="mt-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 backdrop-blur shadow p-3 sm:p-4 sticky top-2 z-20"
          >
            <div className="flex flex-col gap-3">
              {/* Busca */}
              <div className="relative">
                <label htmlFor="busca-historico" className="sr-only">
                  Buscar por título
                </label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
                <input
                  id="busca-historico"
                  ref={inputRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título… (/)"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                  autoComplete="off"
                />
              </div>

              {/* Ano + paginação options */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    Filtros:
                  </span>

                  <div className="flex flex-col">
                    <label htmlFor="filtro-ano" className="text-[11px] text-zinc-600 dark:text-zinc-300 mb-1">
                      Ano
                    </label>
                    <select
                      id="filtro-ano"
                      value={anoSelecionado}
                      onChange={(e) => setAnoSelecionado(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                      aria-label="Filtrar eventos por ano"
                    >
                      <option value="todos">Todos</option>
                      {anosDisponiveis.map((ano) => (
                        <option key={ano} value={ano}>
                          {ano}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="por-pagina" className="text-[11px] text-zinc-600 dark:text-zinc-300 mb-1">
                      Por página
                    </label>
                    <select
                      id="por-pagina"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value) || 8)}
                      className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                      aria-label="Quantidade por página"
                    >
                      {[6, 8, 12, 20].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  {totalItems} resultado{totalItems === 1 ? "" : "s"} — página {pageClamped} de {totalPages}
                </div>
              </div>
            </div>
          </section>

          {/* Conteúdo */}
          <section className="mt-5" aria-label="Lista de eventos históricos">
            {carregando ? (
              <CarregandoSkeleton linhas={4} />
            ) : erro ? (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 text-center">
                <p className="text-rose-700 dark:text-rose-200 font-semibold">{erro}</p>
                <div className="mt-3 flex justify-center">
                  <BotaoPrimario onClick={fetchEventos} aria-label="Tentar novamente">
                    Tentar novamente
                  </BotaoPrimario>
                </div>
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <NadaEncontrado
                mensagem="Nenhum evento encontrado para o filtro selecionado."
                sugestao="Experimente selecionar outro ano ou ajustar a busca."
              />
            ) : (
              <>
                <ul className="space-y-4" role="list" aria-label="Histórico de eventos">
                  <AnimatePresence initial={false}>
                    {eventosPaginados.map((evento) => {
                      const key =
                        evento.evento_id ??
                        evento.id ??
                        `${evento.titulo}-${ymd(evento.data_inicio)}-${ymd(evento.data_fim)}`;

                      const dataInicio = formatarDataBrasileira(evento.data_inicio);
                      const dataFim = formatarDataBrasileira(evento.data_fim);

                      const temCert = Boolean(evento.certificado_disponivel && evento.certificado_id);
                      const foiAvaliado = Boolean(evento.avaliado);

                      return (
                        <motion.li
                          key={key}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: reduceMotion ? 0 : 0.22 }}
                          tabIndex={0}
                          role="listitem"
                          className="relative overflow-hidden border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-600 transition"
                          aria-label={`Evento: ${evento.titulo}`}
                        >
                          {/* barrinha superior (estilo padrão da plataforma) */}
                          <div
                            className="h-1.5 w-full bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600"
                            aria-hidden="true"
                          />

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-lg font-extrabold text-lousa dark:text-white break-words">
                                  {evento.titulo}
                                </h3>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                  Período: {dataInicio} até {dataFim}
                                </p>
                              </div>

                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {foiAvaliado ? <Badge tone="emerald">Avaliado</Badge> : <Badge tone="amber">Pendente</Badge>}
                                {temCert ? <Badge tone="sky">Certificado</Badge> : <Badge tone="zinc">Sem certificado</Badge>}
                              </div>
                            </div>

                            <div className="mt-3 flex gap-2 flex-wrap items-center">
                              {!foiAvaliado && (evento.evento_id || evento.id) && (
                                <BotaoSecundario
                                  onClick={() => navigate(`/avaliar/${evento.evento_id ?? evento.id}`)}
                                  aria-label={`Avaliar evento ${evento.titulo}`}
                                >
                                  Avaliar evento
                                </BotaoSecundario>
                              )}

                              {temCert ? (
                                <BotaoPrimario
                                  onClick={() => baixarCertificado(evento.certificado_id)}
                                  aria-label={`Baixar certificado de ${evento.titulo}`}
                                  icone={<Download className="w-4 h-4" aria-hidden="true" />}
                                >
                                  Ver Certificado
                                </BotaoPrimario>
                              ) : (
                                <span className="text-xs text-zinc-500 italic">
                                  {foiAvaliado
                                    ? "Certificado indisponível."
                                    : "Avalie o evento para liberar o certificado, se aplicável."}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>

                {/* Paginação */}
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    Mostrando <strong>{eventosPaginados.length}</strong> de <strong>{totalItems}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pageClamped <= 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Anterior
                    </button>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={pageClamped >= totalPages}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
