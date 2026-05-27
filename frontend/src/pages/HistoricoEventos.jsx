// 📁 src/pages/HistoricoEventos.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página:
// - Histórico de eventos do usuário.
//
// Contratos oficiais esperados:
// - GET /api/usuarios/historico
// - GET /api/certificados/:id/download
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem apiGet direto em página;
// - sem rota com /api embutido na chamada;
// - sem BotaoPrimario/BotaoSecundario antigos;
// - sem Footer antigo;
// - sem bg-gelo;
// - resposta padrão ok/data/message/code/meta;
// - download via apiGetFile;
// - anti-fuso: date-only em YYYY-MM-DD, sem new Date("YYYY-MM-DD");
// - UX/UI premium real;
// - mobile-first;
// - acessível.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  GraduationCap,
  Info,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import api, { apiGetFile } from "../services/api";
import Footer from "../components/layout/Footer";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import NadaEncontrado from "../components/ui/NadaEncontrado";

/* =========================================================================
   Helpers anti-fuso
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ymd(value) {
  if (!value) return "";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function yearFromYMD(value) {
  const match = ymd(value).match(/^(\d{4})/);

  return match ? Number(match[1]) : null;
}

function formatarDataBR(value) {
  const dateOnly = ymd(value);

  if (!dateOnly) return "—";

  const [year, month, day] = dateOnly.split("-");

  return `${day}/${month}/${year}`;
}

function cmpDescByYMD(a, b, key) {
  const A = ymd(a?.[key]) || ymd(a?.data_fim) || "0000-00-00";
  const B = ymd(b?.[key]) || ymd(b?.data_fim) || "0000-00-00";

  if (A < B) return 1;
  if (A > B) return -1;
  return 0;
}

function unwrapData(response) {
  if (response?.data && typeof response.data === "object" && "ok" in response.data) {
    return response.data.data;
  }

  if (response && typeof response === "object" && "ok" in response) {
    return response.data;
  }

  return response?.data || response;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function baixarBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename || "certificado.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60_000);
}

/* =========================================================================
   UI local
=========================================================================== */

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, accent = "from-sky-600 to-indigo-600" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div
          className={cx(
            "rounded-xl bg-gradient-to-r px-2 py-1 text-xs font-bold text-white",
            accent
          )}
        >
          {label}
        </div>
        <Icon className="h-5 w-5 text-slate-500 dark:text-zinc-300" aria-hidden="true" />
      </div>

      <p className="text-3xl font-black leading-tight text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function Badge({ tone = "zinc", children }) {
  const tones = {
    zinc: "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-200",
    emerald:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/35 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/35 dark:text-amber-200",
    sky: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/35 dark:text-sky-200",
    rose: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/35 dark:text-rose-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tones[tone] || tones.zinc
      )}
    >
      {children}
    </span>
  );
}

function HeaderHero({ total, carregando, onRefresh }) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-800 to-indigo-700"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.6)_1px,transparent_0)] [background-size:18px_18px]"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white/20 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
              Área do usuário • participação e certificados
            </div>

            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </span>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Histórico de Eventos
                </h1>
                <p className="mt-1 text-sm text-white/85 sm:text-base">
                  {total} registro{total === 1 ? "" : "s"} no histórico filtrado.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={cx(
              "inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur transition",
              carregando
                ? "cursor-not-allowed opacity-60"
                : "hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            )}
            aria-label="Atualizar histórico de eventos"
            aria-busy={carregando ? "true" : "false"}
          >
            <RefreshCcw className={cx("h-4 w-4", carregando ? "animate-spin" : "")} />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

function ActionButton({ children, icon: Icon, variant = "primary", ...props }) {
  const primary =
    "border-sky-600 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-600 dark:hover:bg-sky-700";
  const secondary =
    "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";

  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" ? primary : secondary,
        props.className
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function HistoricoEventos() {
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [baixandoId, setBaixandoId] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const navigate = useNavigate();

  function setLive(msg) {
    if (liveRef.current) {
      liveRef.current.textContent = msg;
    }
  }

  const fetchEventos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      setMensagem(null);
      setLive("Carregando histórico de eventos.");

      const response = await api.get("/usuarios/historico");
      const data = unwrapData(response);
      const lista = Array.isArray(data) ? data : [];

      setEventos(lista);
      setLive(`Histórico carregado: ${lista.length} item(ns).`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar seu histórico de eventos."
      );

      setErro(message);
      setEventos([]);
      setMensagem({
        type: "error",
        title: "Erro ao carregar histórico",
        message:
          "Não foi possível carregar seu histórico agora. Verifique sua conexão e tente novamente.",
      });
      setLive("Falha ao carregar histórico de eventos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Histórico de Eventos | Escola da Saúde";
  }, []);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  useEffect(() => {
    function onKey(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag);

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus?.();
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set();

    for (const evento of eventos) {
      const year = yearFromYMD(evento?.data_inicio);

      if (year) anos.add(year);
    }

    return Array.from(anos).sort((a, b) => b - a);
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    const termo = String(busca || "").trim().toLowerCase();

    const porAno =
      anoSelecionado === "todos"
        ? eventos
        : eventos.filter(
            (evento) => String(yearFromYMD(evento?.data_inicio)) === String(anoSelecionado)
          );

    const porBusca = !termo
      ? porAno
      : porAno.filter((evento) =>
          String(evento?.titulo || "").toLowerCase().includes(termo)
        );

    return porBusca.slice().sort((a, b) => cmpDescByYMD(a, b, "data_fim"));
  }, [eventos, anoSelecionado, busca]);

  const kpis = useMemo(() => {
    let avaliados = 0;
    let certificados = 0;

    for (const evento of eventosFiltrados) {
      if (evento?.avaliado) avaliados += 1;
      if (evento?.certificado_disponivel && evento?.certificado_id) certificados += 1;
    }

    return {
      total: eventosFiltrados.length,
      avaliados,
      certificados,
    };
  }, [eventosFiltrados]);

  const totalItems = eventosFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [anoSelecionado, busca, pageSize]);

  const pageClamped = Math.min(page, totalPages);
  const sliceStart = (pageClamped - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;

  const eventosPaginados = useMemo(
    () => eventosFiltrados.slice(sliceStart, sliceEnd),
    [eventosFiltrados, sliceStart, sliceEnd]
  );

  async function baixarCertificado(id, titulo) {
    if (!id || baixandoId) return;

    try {
      setBaixandoId(id);
      setMensagem(null);
      setLive("Baixando certificado.");

      const { blob, filename } = await apiGetFile(`/certificados/${id}/download`);

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Arquivo inválido retornado pelo servidor.");
      }

      baixarBlob(blob, filename || `certificado_${id}.pdf`);

      setMensagem({
        type: "success",
        title: "Certificado baixado",
        message: titulo
          ? `O certificado de “${titulo}” foi preparado para download.`
          : "O certificado foi preparado para download.",
      });

      setLive("Certificado baixado com sucesso.");
    } catch (error) {
      setMensagem({
        type: "error",
        title: "Erro ao baixar certificado",
        message: getErrorMessage(
          error,
          "Não foi possível baixar o certificado. Tente novamente ou procure o suporte."
        ),
      });

      setLive("Falha ao baixar certificado.");
    } finally {
      setBaixandoId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero total={kpis.total} carregando={carregando} onRefresh={fetchEventos} />

      {carregando ? (
        <div
          className="sticky left-0 top-0 z-40 h-1 w-full bg-sky-100 dark:bg-sky-950/30"
          role="progressbar"
          aria-label="Carregando histórico"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-sky-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <main id="conteudo" role="main" className="flex-1 px-3 py-6 sm:px-4">
        <div className="mx-auto max-w-6xl">
          {mensagem ? (
            <div className="mb-4">
              <AlertBox
                type={mensagem.type}
                title={mensagem.title}
                message={mensagem.message}
                onClose={() => setMensagem(null)}
              />
            </div>
          ) : null}

          {!carregando && !erro ? (
            <section
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              aria-label="Resumo do histórico"
            >
              <MiniStat
                icon={CalendarDays}
                label="Total filtrado"
                value={kpis.total}
                accent="from-sky-600 to-indigo-600"
              />
              <MiniStat
                icon={Star}
                label="Avaliados"
                value={kpis.avaliados}
                accent="from-amber-600 to-orange-600"
              />
              <MiniStat
                icon={Award}
                label="Com certificado"
                value={kpis.certificados}
                accent="from-emerald-600 to-teal-600"
              />
            </section>
          ) : null}

          <section
            aria-label="Filtros e busca"
            className="sticky top-2 z-20 mt-4 rounded-3xl border border-zinc-200 bg-white/85 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:p-4"
          >
            <div className="flex flex-col gap-3">
              <div className="relative">
                <label htmlFor="busca-historico" className="sr-only">
                  Buscar por título
                </label>

                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />

                <input
                  id="busca-historico"
                  ref={inputRef}
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por título... (/)"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-9 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-600 dark:border-zinc-700 dark:bg-zinc-900"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="inline-flex items-center gap-1 pb-2 text-xs text-zinc-500">
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    Filtros:
                  </span>

                  <div className="flex flex-col">
                    <label
                      htmlFor="filtro-ano"
                      className="mb-1 text-[11px] text-zinc-600 dark:text-zinc-300"
                    >
                      Ano
                    </label>

                    <select
                      id="filtro-ano"
                      value={anoSelecionado}
                      onChange={(event) => setAnoSelecionado(event.target.value)}
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-sky-600 dark:border-zinc-700 dark:bg-zinc-900"
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
                    <label
                      htmlFor="por-pagina"
                      className="mb-1 text-[11px] text-zinc-600 dark:text-zinc-300"
                    >
                      Por página
                    </label>

                    <select
                      id="por-pagina"
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value) || 8)}
                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-sky-600 dark:border-zinc-700 dark:bg-zinc-900"
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
                  {totalItems} resultado{totalItems === 1 ? "" : "s"} — página{" "}
                  {pageClamped} de {totalPages}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5" aria-label="Lista de eventos históricos">
            {carregando ? (
              <CarregandoSkeleton linhas={4} />
            ) : erro ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-center dark:border-rose-900/40 dark:bg-rose-950/25">
                <p className="font-semibold text-rose-700 dark:text-rose-200">
                  {erro}
                </p>

                <div className="mt-3 flex justify-center">
                  <ActionButton onClick={fetchEventos} aria-label="Tentar carregar histórico novamente">
                    Tentar novamente
                  </ActionButton>
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
                        evento.evento_id ||
                        evento.id ||
                        `${evento.titulo}-${ymd(evento.data_inicio)}-${ymd(evento.data_fim)}`;

                      const dataInicio = formatarDataBR(evento.data_inicio);
                      const dataFim = formatarDataBR(evento.data_fim);

                      const temCertificado = Boolean(
                        evento.certificado_disponivel && evento.certificado_id
                      );
                      const foiAvaliado = Boolean(evento.avaliado);
                      const certBaixando = baixandoId === evento.certificado_id;

                      return (
                        <motion.li
                          key={key}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: reduceMotion ? 0 : 0.22 }}
                          tabIndex={0}
                          role="listitem"
                          className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-600 dark:border-zinc-800 dark:bg-zinc-950"
                          aria-label={`Evento: ${evento.titulo}`}
                        >
                          <div
                            className="h-1.5 w-full bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600"
                            aria-hidden="true"
                          />

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words text-lg font-extrabold text-slate-950 dark:text-white">
                                  {evento.titulo}
                                </h3>

                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                  Período: {dataInicio} até {dataFim}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {foiAvaliado ? (
                                  <Badge tone="emerald">Avaliado</Badge>
                                ) : (
                                  <Badge tone="amber">Pendente</Badge>
                                )}

                                {temCertificado ? (
                                  <Badge tone="sky">Certificado</Badge>
                                ) : (
                                  <Badge tone="zinc">Sem certificado</Badge>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {!foiAvaliado && (evento.evento_id || evento.id) ? (
                                <ActionButton
                                  variant="secondary"
                                  onClick={() => navigate(`/avaliar/${evento.evento_id || evento.id}`)}
                                  aria-label={`Avaliar evento ${evento.titulo}`}
                                  icon={GraduationCap}
                                >
                                  Avaliar evento
                                </ActionButton>
                              ) : null}

                              {temCertificado ? (
                                <ActionButton
                                  onClick={() =>
                                    baixarCertificado(evento.certificado_id, evento.titulo)
                                  }
                                  disabled={Boolean(baixandoId)}
                                  aria-label={`Baixar certificado de ${evento.titulo}`}
                                  icon={certBaixando ? Loader2 : Download}
                                  className={certBaixando ? "[&>svg]:animate-spin" : ""}
                                >
                                  {certBaixando ? "Baixando..." : "Ver certificado"}
                                </ActionButton>
                              ) : (
                                <span className="text-xs italic text-zinc-500">
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

                <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    Mostrando <strong>{eventosPaginados.length}</strong> de{" "}
                    <strong>{totalItems}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={pageClamped <= 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Anterior
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={pageClamped >= totalPages}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
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