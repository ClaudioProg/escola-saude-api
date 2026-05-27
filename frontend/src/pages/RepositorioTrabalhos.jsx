// 📁 src/pages/RepositorioTrabalhos.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Repositório institucional de trabalhos.
//
// Contratos oficiais usados:
// - GET /api/trabalho/repositorio
// - GET /api/submissao/:id/poster
//
// Diretrizes v2.0:
// - sem /trabalhos/repositorio;
// - sem utilitário legado de download de banner;
// - sem Footer antigo;
// - sem status legado aprovado_exposicao/aprovado_oral/reprovado;
// - repositório focado em conteúdo, não em notas;
// - UX/UI premium real;
// - acessível;
// - mobile-first;
// - busca com normalização sem acento;
// - filtros persistidos em querystring;
// - cache leve em sessionStorage.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Tags,
  X,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

/* =========================================================================
   Utils
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function unwrapArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function normalizarStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value === "aprovada_exposicao") return "aprovada_exposicao";
  if (value === "aprovada_oral") return "aprovada_oral";
  if (value === "aprovada") return "aprovada";
  if (value === "reprovada") return "reprovada";
  if (value === "em_avaliacao") return "em_avaliacao";
  if (value === "submetida") return "submetida";
  if (value === "rascunho") return "rascunho";
  if (value === "cancelada") return "cancelada";

  return value || "indefinido";
}

function inicioExperienciaFormatado(value) {
  if (!value) return "—";

  const [year, month] = String(value).split("-");
  if (!year || !month) return value;

  return `${month}/${year}`;
}

function abrirPosterSubmissao(id) {
  if (!id) return;

  const baseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  const token = localStorage.getItem("token") || "";

  const url = `${baseUrl}/submissao/${id}/poster`;

  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Não foi possível abrir o arquivo do trabalho.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      window.open(objectUrl, "_blank", "noopener,noreferrer");

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    })
    .catch((error) => {
  console.error("[RepositorioTrabalhos] erro ao abrir arquivo", error);
  alert("Não foi possível abrir o arquivo do trabalho.");
});
}

/* =========================================================================
   Cache
=========================================================================== */

const CACHE_KEY = "escola:v2:repositorio-trabalho";
const CACHE_TTL = 3 * 60 * 1000;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL) return null;

    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // cache indisponível não deve quebrar a página
  }
}

/* =========================================================================
   UI primitives
=========================================================================== */

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950 dark:bg-slate-950">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute right-[-12%] top-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="min-h-screen bg-slate-50/95 dark:bg-slate-950/85 dark:text-slate-50">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    sky:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
    fuchsia:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function StatusBadge({ status, statusEscrita, statusOral }) {
  const value = normalizarStatus(status);

  const config = {
    aprovada_exposicao: {
      label: "Aprovada para exposição",
      tone: "emerald",
    },
    aprovada_oral: {
      label: "Aprovada para oral",
      tone: "amber",
    },
    aprovada: {
      label: "Aprovada",
      tone: "emerald",
    },
    reprovada: {
      label: "Não selecionada",
      tone: "rose",
    },
    em_avaliacao: {
      label: "Em avaliação",
      tone: "indigo",
    },
    submetida: {
      label: "Submetida",
      tone: "sky",
    },
    rascunho: {
      label: "Rascunho",
      tone: "slate",
    },
    cancelada: {
      label: "Cancelada",
      tone: "rose",
    },
    indefinido: {
      label: "Indefinido",
      tone: "slate",
    },
  };

  const item = config[value] || config.indefinido;

  const tags = [];
  if (String(statusEscrita || "").toLowerCase() === "aprovado") tags.push("Escrita");
  if (String(statusOral || "").toLowerCase() === "aprovado") tags.push("Oral");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={item.tone}>{item.label}</Badge>
      {tags.length > 0 ? <Badge tone="slate">{tags.join(" · ")}</Badge> : null}
    </div>
  );
}

/* =========================================================================
   Estatísticas
=========================================================================== */

function MiniStats({ total, totalChamadas, totalLinhas, totalComBanner, filtrados }) {
  const items = [
    {
      icon: Layers,
      label: "Trabalhos",
      value: total,
      helper: "Somente avaliados",
      tone: "sky",
    },
    {
      icon: Tags,
      label: "Chamadas",
      value: totalChamadas,
      helper: "Editais distintos",
      tone: "indigo",
    },
    {
      icon: Filter,
      label: "Linhas temáticas",
      value: totalLinhas,
      helper: "Áreas/eixos",
      tone: "fuchsia",
    },
    {
      icon: ImageIcon,
      label: "Com arquivo",
      value: totalComBanner,
      helper: "Pôster disponível",
      tone: "emerald",
    },
  ];

  return (
    <section aria-label="Resumo do repositório" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <GlassCard key={item.label} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <item.icon className="h-4 w-4" />
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {item.value ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {item.helper}
              </p>
            </div>

            <Badge tone={item.tone}>{filtrados}</Badge>
          </div>
        </GlassCard>
      ))}
    </section>
  );
}

/* =========================================================================
   Filtros
=========================================================================== */

function FiltrosRepositorio({
  chamadas,
  linhas,
  chamadaSelecionada,
  linhaSelecionada,
  termoValue,
  onChangeChamada,
  onChangeLinha,
  onChangeTermo,
  onClearAll,
  totalFiltrados,
}) {
  return (
    <GlassCard className="p-4 sm:p-5" aria-label="Filtros de pesquisa">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
            <Filter className="h-5 w-5 text-fuchsia-600" />
            Filtrar trabalhos
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {totalFiltrados} trabalho{totalFiltrados === 1 ? "" : "s"} encontrado{totalFiltrados === 1 ? "" : "s"} com os filtros atuais.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
          Limpar filtros
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Buscar por título ou conteúdo
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={termoValue}
              onChange={(event) => onChangeTermo(event.target.value)}
              placeholder="Digite título, método, resultado, objetivo..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-950"
              aria-label="Buscar por título ou conteúdo"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Chamada
          </span>
          <select
            value={chamadaSelecionada}
            onChange={(event) => onChangeChamada(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-950"
            aria-label="Filtrar por chamada"
          >
            <option value="">Todas</option>
            {chamadas.map((chamada) => (
              <option key={chamada} value={chamada}>
                {chamada}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Linha temática
          </span>
          <select
            value={linhaSelecionada}
            onChange={(event) => onChangeLinha(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-950"
            aria-label="Filtrar por linha temática"
          >
            <option value="">Todas</option>
            {linhas.map((linha) => (
              <option key={linha} value={linha}>
                {linha}
              </option>
            ))}
          </select>
        </label>
      </div>
    </GlassCard>
  );
}

/* =========================================================================
   Card
=========================================================================== */

function LinhaBadge({ codigo, nome }) {
  const texto = nome || codigo;
  if (!texto) return null;

  return <Badge tone="sky">{texto}</Badge>;
}

function CardTrabalho({ trabalho, reduceMotion }) {
  const [aberto, setAberto] = useState(false);

  const preview = trabalho.resultados || trabalho.consideracao || trabalho.objetivos || "";

  const inicioFmt = useMemo(
    () => inicioExperienciaFormatado(trabalho.inicio_experiencia),
    [trabalho.inicio_experiencia]
  );

  function secao(titulo, texto) {
    if (!texto) return null;

    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {titulo}
        </h4>
        <p className="mt-2 whitespace-pre-wrap text-justify text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {texto}
        </p>
      </div>
    );
  }

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/20"
      aria-label={`Trabalho ${trabalho.titulo || `#${trabalho.id}`}`}
    >
      <div className="h-1.5 bg-gradient-to-r from-sky-500 via-fuchsia-500 to-indigo-500" />

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge
                status={trabalho.status}
                statusEscrita={trabalho.status_escrita}
                statusOral={trabalho.status_oral}
              />
              <LinhaBadge
                codigo={trabalho.linha_tematica_codigo}
                nome={trabalho.linha_tematica_nome}
              />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {trabalho.titulo || "Trabalho sem título"}
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {trabalho.chamada_titulo || "Chamada não informada"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                Início da experiência: <strong>{inicioFmt}</strong>
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                ID #{trabalho.id}
              </span>
            </div>
          </div>

          {trabalho.poster_arquivo_id ? (
            <button
              type="button"
              onClick={() => abrirPosterSubmissao(trabalho.id)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/20 transition hover:bg-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2"
            >
              <ImageIcon className="h-4 w-4" />
              Ver arquivo
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Badge tone="slate" icon={ImageIcon}>Sem arquivo</Badge>
          )}
        </div>

        {preview ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {preview}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setAberto((current) => !current)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-expanded={aberto}
          aria-controls={`trabalho-${trabalho.id}-detalhes`}
        >
          {aberto ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Ver detalhes
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {aberto ? (
            <motion.div
              key="detalhes"
              id={`trabalho-${trabalho.id}-detalhes`}
              className="space-y-3 border-t border-dashed border-slate-200 pt-4 dark:border-slate-700"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              {secao("Introdução", trabalho.introducao)}
              {secao("Objetivos", trabalho.objetivos)}
              {secao("Método / descrição da prática", trabalho.metodo)}
              {secao("Resultados / impactos", trabalho.resultados)}
              {secao("Considerações finais", trabalho.consideracao)}
              {secao("Referências / bibliografia", trabalho.bibliografia)}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function RepositorioTrabalhos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [termo, setTermo] = useState(() => searchParams.get("q") || "");
  const [termoDebounced, setTermoDebounced] = useState(() => searchParams.get("q") || "");
  const [chamadaSelecionada, setChamadaSelecionada] = useState(
    () => searchParams.get("chamada") || ""
  );
  const [linhaSelecionada, setLinhaSelecionada] = useState(
    () => searchParams.get("linha") || ""
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const cached = readCache();

      if (cached?.length) {
        setDados(cached);
        setLoading(false);
      }

      const response = await api.get("/trabalho/repositorio");
      const lista = unwrapArray(response);

      setDados(lista);
      writeCache(lista);
    } catch (error) {
      const status = error?.status || error?.response?.status;

      if (status === 401) {
        navigate(`/login?next=${encodeURIComponent("/repositorio-trabalhos")}`, {
          replace: true,
        });
        return;
      }

      setErro(
        getErrorMessage(
          error,
          "Não foi possível carregar o repositório no momento."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTermoDebounced(termo);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [termo]);

  useEffect(() => {
    const query = new URLSearchParams();

    if (termo) query.set("q", termo);
    if (chamadaSelecionada) query.set("chamada", chamadaSelecionada);
    if (linhaSelecionada) query.set("linha", linhaSelecionada);

    setSearchParams(query, { replace: true });
  }, [termo, chamadaSelecionada, linhaSelecionada, setSearchParams]);

  const chamadas = useMemo(() => {
    const set = new Set();

    for (const item of dados) {
      if (item?.chamada_titulo) set.add(item.chamada_titulo);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [dados]);

  const linhas = useMemo(() => {
    const set = new Set();

    for (const item of dados) {
      const nome = item?.linha_tematica_nome || item?.linha_tematica_codigo;
      if (nome) set.add(nome);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [dados]);

  const filtrados = useMemo(() => {
    let arr = Array.isArray(dados) ? [...dados] : [];

    if (chamadaSelecionada) {
      arr = arr.filter((item) => item?.chamada_titulo === chamadaSelecionada);
    }

    if (linhaSelecionada) {
      arr = arr.filter(
        (item) =>
          item?.linha_tematica_nome === linhaSelecionada ||
          item?.linha_tematica_codigo === linhaSelecionada
      );
    }

    const termoNorm = norm(termoDebounced);

    if (termoNorm) {
      arr = arr.filter((item) =>
        [
          item?.titulo,
          item?.introducao,
          item?.objetivos,
          item?.metodo,
          item?.resultados,
          item?.consideracao,
          item?.bibliografia,
          item?.chamada_titulo,
          item?.linha_tematica_nome,
        ]
          .filter(Boolean)
          .some((campo) => norm(campo).includes(termoNorm))
      );
    }

    return arr;
  }, [dados, chamadaSelecionada, linhaSelecionada, termoDebounced]);

  const total = dados.length;
  const totalChamadas = chamadas.length;
  const totalLinhas = linhas.length;
  const totalComBanner = useMemo(
    () => dados.filter((item) => item?.banner_url || item?.poster_arquivo_id).length,
    [dados]
  );

  function limparFiltros() {
    setTermo("");
    setTermoDebounced("");
    setChamadaSelecionada("");
    setLinhaSelecionada("");
  }

  return (
    <PageShell>
      <HeaderHero
  icone={BookOpen}
  etiqueta="Produção científica"
  titulo="Repositório de Trabalhos"
  subtitulo="Consulte produções, experiências, métodos e resultados publicados em chamadas institucionais da Escola da Saúde."
/>

      <main id="conteudo" role="main" className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
  <section className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Biblioteca institucional de trabalhos
        </h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Explore experiências, pesquisas e práticas apresentadas em eventos e chamadas da Escola da Saúde.
        </p>
      </div>

      <button
        type="button"
        onClick={carregar}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:pointer-events-none disabled:opacity-60"
      >
        <RefreshCcw
          className={cx(
            "h-4 w-4",
            loading && "animate-spin"
          )}
        />

        {loading ? "Atualizando..." : "Atualizar repositório"}
      </button>
    </div>

    <MiniStats
      total={total}
      totalChamadas={totalChamadas}
      totalLinhas={totalLinhas}
      totalComBanner={totalComBanner}
      filtrados={filtrados.length}
    />
  </section>

        <FiltrosRepositorio
          chamadas={chamadas}
          linhas={linhas}
          chamadaSelecionada={chamadaSelecionada}
          linhaSelecionada={linhaSelecionada}
          termoValue={termo}
          onChangeChamada={setChamadaSelecionada}
          onChangeLinha={setLinhaSelecionada}
          onChangeTermo={setTermo}
          onClearAll={limparFiltros}
          totalFiltrados={filtrados.length}
        />

        <section aria-label="Lista de trabalhos" className="space-y-4">
          {loading ? (
            <GlassCard className="flex items-center justify-center gap-3 p-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-fuchsia-600" />
              Carregando trabalhos do repositório...
            </GlassCard>
          ) : null}

          {!loading && erro ? (
            <GlassCard className="p-5">
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <div className="min-w-0">
                  <p className="font-black">Não foi possível carregar os trabalhos.</p>
                  <p className="mt-1 break-words text-xs">{erro}</p>

                  <button
                    type="button"
                    onClick={carregar}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Tentar novamente
                  </button>
                </div>
              </div>
            </GlassCard>
          ) : null}

          {!loading && !erro && filtrados.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800">
                <Filter className="h-7 w-7 text-slate-400" />
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                Nenhum trabalho encontrado
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Ajuste os filtros, limpe a busca ou atualize o repositório.
              </p>

              <button
                type="button"
                onClick={limparFiltros}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            </GlassCard>
          ) : null}

          {!loading && !erro && filtrados.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <motion.div
                key="grid"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-1 gap-4"
              >
                {filtrados.map((trabalho) => (
                  <CardTrabalho
                    key={trabalho.id}
                    trabalho={trabalho}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </section>
      </main>

      <Footer />
    </PageShell>
  );
}