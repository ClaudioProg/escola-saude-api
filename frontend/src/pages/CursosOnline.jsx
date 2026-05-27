// ✅ frontend/src/pages/CursosOnline.jsx — v2.0
// Atualizado em: 18/05/2026
//
// Plataforma Escola da Saúde
//
// Página do usuário para acesso aos Cursos Online.
//
// Função:
// - Listar cursos online publicados.
// - Filtrar por plataforma, categoria e busca textual.
// - Exibir cards acessíveis, responsivos e com link externo seguro.
//
// Contratos oficiais usados:
// - GET /api/curso-online/publicado
// - GET /api/curso-online/:id
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota plural;
// - sem chamada direta para /api fora do service;
// - api.cursoOnline como facade oficial;
// - usuário visualiza somente status publicado;
// - plataforma oficial: youtube | govbr | universidade | escola_saude | outra;
// - UX/UI premium;
// - mobile-first;
// - acessível;
// - dark mode;
// - estados loading/vazio/erro;
// - link externo com rel="noreferrer".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Globe2,
  GraduationCap,
  Layers3,
  Link2,
  MonitorPlay,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  University,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

/* =========================================================================
   Constantes
=========================================================================== */

const PLATAFORMAS_OFICIAIS = [
  { value: "youtube", label: "YouTube" },
  { value: "govbr", label: "Gov.br" },
  { value: "universidade", label: "Universidade" },
  { value: "escola_saude", label: "Escola da Saúde" },
  { value: "outra", label: "Outra" },
];

const STORAGE_KEY = "escola:v2:cursos-online:filtros";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
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

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function cleanStr(value) {
  return String(value ?? "").trim();
}

function brDateTime(value) {
  if (!value) return "—";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "—";
  }
}

function plataformaInfo(plataforma) {
  const value = String(plataforma || "").toLowerCase();

  const map = {
    youtube: {
      label: "YouTube",
      icon: MonitorPlay,
      ring: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    },
    govbr: {
      label: "Gov.br",
      icon: ShieldCheck,
      ring: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    },
    universidade: {
      label: "Universidade",
      icon: University,
      ring: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200",
    },
    escola_saude: {
      label: "Escola da Saúde",
      icon: GraduationCap,
      ring: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    outra: {
      label: "Outra",
      icon: Globe2,
      ring: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    },
  };

  return (
    map[value] || {
      label: value || "Plataforma",
      icon: Globe2,
      ring: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    }
  );
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* =========================================================================
   Página
=========================================================================== */

export default function CursosOnline() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);

  const [cursos, setCursos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [filtroPlataforma, setFiltroPlataforma] = useState(
    persisted.filtroPlataforma || ""
  );
  const [filtroCategoria, setFiltroCategoria] = useState(
    persisted.filtroCategoria || ""
  );
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Cursos Online | Escola da Saúde";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroPlataforma,
          filtroCategoria,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página.
    }
  }, [filtroPlataforma, filtroCategoria, busca]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setLive("Carregando cursos online.");

    try {
      const response = await api.cursoOnline.listarPublicados();

      const data = unwrapArray(response);
      setCursos(data);

      setLive(`Cursos online carregados: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar os cursos online."
      );

      setErro(message);
      setLive("Falha ao carregar cursos online.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const categorias = useMemo(() => {
    const set = new Set();

    for (const curso of cursos) {
      const categoria = cleanStr(curso.categoria);
      if (categoria) set.add(categoria);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [cursos]);

  const cursosFiltrados = useMemo(() => {
    const query = norm(buscaDebounced);

    return cursos.filter((curso) => {
      if (
        filtroPlataforma &&
        String(curso.plataforma) !== String(filtroPlataforma)
      ) {
        return false;
      }

      if (
        filtroCategoria &&
        String(curso.categoria) !== String(filtroCategoria)
      ) {
        return false;
      }

      if (query) {
        const haystack = norm(
          [
            curso.titulo,
            curso.descricao,
            curso.url,
            curso.plataforma,
            curso.plataforma_label,
            curso.categoria,
            curso.canal_ou_instituicao,
            curso.status,
            curso.status_label,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [cursos, filtroPlataforma, filtroCategoria, buscaDebounced]);

  const kpis = useMemo(() => {
    const plataformas = new Set();
    const categoriasSet = new Set();

    let gratuitos = 0;
    let certificadosExternos = 0;

    for (const curso of cursos) {
      if (curso.plataforma) plataformas.add(curso.plataforma);
      if (curso.categoria) categoriasSet.add(curso.categoria);
      if (curso.gratuito) gratuitos += 1;
      if (curso.certificado_externo) certificadosExternos += 1;
    }

    return {
      total: cursos.length,
      plataformas: plataformas.size,
      categorias: categoriasSet.size,
      gratuitos,
      certificadosExternos,
    };
  }, [cursos]);

  const temFiltrosAtivos = Boolean(
    filtroPlataforma || filtroCategoria || buscaDebounced
  );

  function limparFiltros() {
    setFiltroPlataforma("");
    setFiltroCategoria("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function removerChip(tipo) {
    if (tipo === "plataforma") setFiltroPlataforma("");
    if (tipo === "categoria") setFiltroCategoria("");

    if (tipo === "busca") {
      setBusca("");
      setBuscaDebounced("");
    }

    setLive("Filtro removido.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <HeaderHero
  icone={MonitorPlay}
  etiqueta="Cursos Online"
  titulo="Cursos e trilhas para sua formação"
  subtitulo="Acesse conteúdos selecionados pela Escola da Saúde em plataformas oficiais, universidades, órgãos públicos e parceiros autorizados."
/>

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
  <section className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Biblioteca de cursos online
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Encontre cursos, aulas e trilhas oficiais recomendadas pela Escola da Saúde.
        </p>
      </div>

      <button
        type="button"
        onClick={carregarDados}
        disabled={carregando}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:pointer-events-none disabled:opacity-60"
      >
        <RefreshCcw className={cx("h-4 w-4", carregando && "animate-spin")} />
        {carregando ? "Atualizando..." : "Atualizar dados"}
      </button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MiniStat label="Cursos" value={kpis.total} icon={BookOpen} />
      <MiniStat label="Plataformas" value={kpis.plataformas} icon={Globe2} />
      <MiniStat label="Categorias" value={kpis.categorias} icon={Layers3} />
      <MiniStat label="Gratuitos" value={kpis.gratuitos} icon={CheckCircle2} />
    </div>
  </section>

  {erro ? (
          <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
        ) : null}

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Filter className="h-5 w-5 text-emerald-600" />
                Biblioteca de cursos online
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Encontre cursos, aulas e trilhas oficiais recomendadas pela
                Escola da Saúde.
              </p>
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FilterSelect
              label="Plataforma"
              value={filtroPlataforma}
              onChange={setFiltroPlataforma}
              placeholder="Todas"
              options={PLATAFORMAS_OFICIAIS}
            />

            <FilterSelect
              label="Categoria"
              value={filtroCategoria}
              onChange={setFiltroCategoria}
              placeholder="Todas"
              options={categorias.map((item) => ({
                value: item,
                label: item,
              }))}
            />

            <SearchInput
              value={busca}
              onChange={setBusca}
              onClear={() => {
                setBusca("");
                setBuscaDebounced("");
              }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cursos visíveis:{" "}
              <strong className="font-black text-slate-900 dark:text-white">
                {cursosFiltrados.length}
              </strong>
            </p>

            {temFiltrosAtivos ? (
              <div className="flex flex-wrap items-center gap-2">
                {filtroPlataforma ? (
                  <Chip
                    text={`Plataforma: ${
                      plataformaInfo(filtroPlataforma).label
                    }`}
                    onClear={() => removerChip("plataforma")}
                  />
                ) : null}

                {filtroCategoria ? (
                  <Chip
                    text={`Categoria: ${filtroCategoria}`}
                    onClear={() => removerChip("categoria")}
                  />
                ) : null}

                {buscaDebounced ? (
                  <Chip
                    text={`Busca: “${buscaDebounced}”`}
                    onClear={() => removerChip("busca")}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-label="Cursos online publicados" className="space-y-3">
          {carregando ? (
            <LoadingGrid />
          ) : cursosFiltrados.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhum curso online encontrado"
              descricao="Ajuste os filtros ou tente novamente mais tarde."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {cursosFiltrados.map((curso) => (
                <CursoOnlineCard
                  key={curso.id}
                  curso={curso}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* =========================================================================
   Componentes locais
=========================================================================== */

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide text-slate-400">
          {label}
        </span>

        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function AlertBox({ tone, icon: Icon, title, message }) {
  const tones = {
    rose:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
  };

  return (
    <div className={cx("rounded-2xl border p-4 text-sm", tones[tone])}>
      <div className="flex gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" />
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
        aria-label={`Filtrar por ${label}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchInput({ value, onChange, onClear }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
        Busca
      </span>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Título, plataforma, categoria, instituição..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Buscar cursos online"
        />

        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </label>
  );
}

function Chip({ text, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
      {text}

      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-emerald-900/40"
        aria-label={`Remover filtro: ${text}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function CursoOnlineCard({ curso, reduceMotion }) {
  const plataforma = plataformaInfo(curso.plataforma);
  const PlataformaIcon = plataforma.icon;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group relative flex min-h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20"
    >
      {curso.imagem_url ? (
        <div className="relative h-40 overflow-hidden bg-slate-100 dark:bg-slate-900">
          <img
            src={curso.imagem_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="relative grid h-40 place-items-center overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-700 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.20),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,.14),transparent_30%)]" />
          <BookOpen className="relative h-14 w-14 opacity-90" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black",
              plataforma.ring
            )}
          >
            <PlataformaIcon className="h-3.5 w-3.5" />
            {curso.plataforma_label || plataforma.label}
          </span>

          {curso.categoria ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {curso.categoria}
            </span>
          ) : null}
        </div>

        <h3 className="mt-4 text-lg font-black leading-tight text-slate-900 dark:text-white">
          {curso.titulo}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {curso.descricao || "Curso online disponível para acesso externo."}
        </p>

        <div className="mt-4 grid gap-2 text-sm">
          <InfoRow
            icon={Globe2}
            label="Instituição"
            value={curso.canal_ou_instituicao || "Não informada"}
          />

          <InfoRow
            icon={Clock}
            label="Carga"
            value={
              curso.carga_horaria != null
                ? `${curso.carga_horaria}h`
                : "Não informada"
            }
          />

          <InfoRow
            icon={CheckCircle2}
            label="Acesso"
            value={curso.gratuito ? "Gratuito" : "Não gratuito"}
          />

          {curso.certificado_externo ? (
            <InfoRow
              icon={GraduationCap}
              label="Certificado"
              value="Certificado externo"
            />
          ) : null}

          <InfoRow
            icon={Sparkles}
            label="Publicado"
            value={brDateTime(curso.publicado_em)}
          />
        </div>

        <div className="mt-5 flex flex-1 items-end">
          <a
            href={curso.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ExternalLink className="h-4 w-4" />
            Acessar curso
          </a>
        </div>
      </div>
    </motion.article>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
      <Icon className="mt-0.5 h-4 w-4 flex-none text-emerald-600 dark:text-emerald-300" />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20"
        >
          <Skeleton height={160} />
          <div className="p-5">
            <Skeleton height={18} width="70%" />
            <div className="mt-3 space-y-2">
              <Skeleton height={14} />
              <Skeleton height={14} width="85%" />
              <Skeleton height={14} width="60%" />
            </div>
            <div className="mt-5">
              <Skeleton height={44} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}