// ✅ src/pages/RepositorioTrabalhos.jsx — premium (hero + ministats + filtros com chips + a11y + debounce + querystring + motion-safe + cache)
// Mantém sua ideia e estrutura, mas melhora: debounce, normalização sem acento, foco/skip, contador “filtrados”, botão limpar, cache leve,
// carregamento/erro premium, detalhes com AnimatePresence e melhor acessibilidade.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiGet } from "../services/api";
import { baixarBannerTrabalho } from "../utils/downloadBannerTrabalho";
import Footer from "../components/Footer";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  Sparkles,
  RefreshCcw,
  Layers,
  Tags,
} from "lucide-react";

/* ---------------- Utils ---------------- */
const cx = (...c) => c.filter(Boolean).join(" ");
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/* ---------------- Cache (sessionStorage) ---------------- */
const CACHE_KEY = "repo:trabalhos:v1";
const CACHE_TTL = 3 * 60 * 1000; // 3 min

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
  } catch {}
}

/* ---------------- HeaderHero (paleta exclusiva desta página) ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  // azul escuro → roxo → pink
  const gradient = "from-sky-900 via-indigo-800 to-fuchsia-700";

  return (
    <header className={cx("relative isolate overflow-hidden bg-gradient-to-br", gradient, "text-white")} role="banner">
      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      {/* Glow decorativo centralizado */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-30 bg-fuchsia-400"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-4">
        {/* Chip título */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur shadow-sm shadow-black/10">
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-medium">Repositório de Trabalhos Científicos</span>
        </div>

        {/* Título */}
        <div className="mt-1 flex items-center justify-center gap-2">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Trabalhos submetidos e avaliados
          </h1>
        </div>

        <p className="mt-1 text-sm sm:text-base text-white/90 max-w-3xl mx-auto">
          Consulte títulos, métodos, resultados e considerações finais dos trabalhos já avaliados nas chamadas científicas.
          As notas ficam ocultas — aqui o foco é o conteúdo.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs font-semibold">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Conteúdo público
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={cx(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition",
              carregando ? "opacity-70 cursor-not-allowed" : ""
            )}
            aria-label="Atualizar repositório"
            title="Atualizar"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="w-4 h-4" aria-hidden="true" />}
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ---------------- Mini stats ---------------- */
function MiniStats({ total, totalChamadas, totalLinhas, totalComBanner, filtrados }) {
  const items = [
    { icon: Layers, label: "Trabalhos no repositório", value: total, helper: "Somente trabalhos já avaliados", tone: "neutral" },
    { icon: Tags, label: "Chamadas científicas", value: totalChamadas, helper: "Eventos / editais distintos", tone: "info" },
    { icon: Filter, label: "Linhas temáticas", value: totalLinhas, helper: "Áreas / eixos de pesquisa", tone: "info" },
    { icon: ImageIcon, label: "Com banner disponível", value: totalComBanner, helper: "Arquivos para download", tone: "ok" },
  ];

  const toneCls = {
    neutral: "bg-white dark:bg-zinc-900 ring-zinc-200/70 dark:ring-zinc-800/70",
    info: "bg-indigo-50 dark:bg-indigo-950/25 ring-indigo-200/70 dark:ring-indigo-900/40",
    ok: "bg-emerald-50 dark:bg-emerald-950/25 ring-emerald-200/70 dark:ring-emerald-900/40",
  };

  return (
    <section aria-label="Resumo do repositório" className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <article
          key={item.label}
          className={cx("rounded-2xl shadow-sm ring-1 px-4 py-3 flex flex-col justify-between", toneCls[item.tone])}
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2">
            <item.icon className="w-4 h-4" aria-hidden="true" />
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
            {item.value ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{item.helper}</p>

          {typeof filtrados === "number" && (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Filtrados agora: <span className="font-semibold tabular-nums">{filtrados}</span>
            </p>
          )}
        </article>
      ))}
    </section>
  );
}

/* ---------------- Badge helpers ---------------- */
function StatusBadge({ status, statusEscrita, statusOral }) {
  const s = String(status || "").toLowerCase();

  let label = "Em avaliação";
  let classes = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200";

  if (s === "aprovado_exposicao") {
    label = "Aprovado para exposição";
    classes = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
  } else if (s === "aprovado_oral") {
    label = "Aprovado para apresentação oral";
    classes = "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
  } else if (s === "reprovado") {
    label = "Não selecionado";
    classes = "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200";
  }

  const tags = [];
  if (statusEscrita === "aprovado") tags.push("Escrita");
  if (statusOral === "aprovado") tags.push("Oral");

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", classes)}>
        {label}
      </span>
      {tags.length > 0 && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {tags.join(" · ")}
        </span>
      )}
    </div>
  );
}

/* Linha temática: mostrar apenas o NOME (sem código) */
function LinhaBadge({ codigo, nome }) {
  const texto = nome || codigo;
  if (!texto) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-800 dark:bg-sky-900/50 dark:text-sky-100 px-2.5 py-0.5 text-[11px] font-medium">
      {texto}
    </span>
  );
}

/* ---------------- Card de Trabalho ---------------- */
function CardTrabalho({ trabalho, reduceMotion }) {
  const [aberto, setAberto] = useState(false);

  const {
    id,
    titulo,
    chamada_titulo,
    linha_tematica_codigo,
    linha_tematica_nome,
    inicio_experiencia,
    introducao,
    objetivos,
    metodo,
    resultados,
    consideracao,
    bibliografia,
    status,
    status_escrita,
    status_oral,
    banner_url,
    banner_nome,
  } = trabalho;

  const inicioFmt = useMemo(() => {
    if (!inicio_experiencia) return "—";
    const [y, m] = String(inicio_experiencia).split("-");
    if (!y || !m) return inicio_experiencia;
    return `${m}/${y}`;
  }, [inicio_experiencia]);

  const toggle = () => setAberto((v) => !v);

  const handleVerBanner = () => {
    const nomeDownload = banner_nome || `banner-trabalho-${id}`;
    baixarBannerTrabalho(id, nomeDownload);
  };

  const secao = (tituloSecao, texto) => {
    if (!texto) return null;
    return (
      <div className="mt-3">
        <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
          {tituloSecao}
        </h4>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap text-justify">
          {texto}
        </p>
      </div>
    );
  };

  // Preview: sem introdução (prioriza resultados, depois considerações/objetivos)
  const previewTexto = resultados || consideracao || objetivos || "";

  return (
    <article
      className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800/70 p-4 flex flex-col gap-3 relative overflow-hidden"
      aria-label={`Trabalho ${titulo || `#${id}`}`}
    >
      {/* faixinha superior suave */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-fuchsia-500 to-rose-500" aria-hidden="true" />

      {/* Cabeçalho do card */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 break-words">
              {titulo || "Trabalho sem título"}
            </h3>
            {chamada_titulo && (
              <p className="mt-0.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 break-words">
                {chamada_titulo}
              </p>
            )}
          </div>
          <StatusBadge status={status} statusEscrita={status_escrita} statusOral={status_oral} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <LinhaBadge codigo={linha_tematica_codigo} nome={linha_tematica_nome} />
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-400" aria-hidden="true" />
            Início da experiência: <span className="font-medium ml-1 tabular-nums">{inicioFmt}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-400" aria-hidden="true" />
            ID <span className="font-medium tabular-nums">#{id}</span>
          </span>
        </div>
      </div>

      {/* Resumo rápido */}
      {previewTexto && (
        <p className="text-sm text-zinc-700 dark:text-zinc-200 line-clamp-3 sm:line-clamp-2">
          {previewTexto}
        </p>
      )}

      {/* Ações principais */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
          aria-expanded={aberto}
          aria-controls={`trabalho-${id}-detalhes`}
        >
          {aberto ? (
            <>
              <ChevronUp className="w-3 h-3" aria-hidden="true" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
              Ver detalhes do trabalho
            </>
          )}
        </button>

        {banner_url ? (
          <button
            type="button"
            onClick={handleVerBanner}
            className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
          >
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Ver banner
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-3 py-1.5 text-xs">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Banner não disponível
          </span>
        )}
      </div>

      {/* Detalhes expansíveis */}
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            key="detalhes"
            id={`trabalho-${id}-detalhes`}
            className="mt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-3"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
          >
            {secao("Introdução", introducao)}
            {secao("Objetivos", objetivos)}
            {secao("Método / Descrição da prática", metodo)}
            {secao("Resultados / Impactos", resultados)}
            {secao("Considerações finais", consideracao)}
            {secao("Referências / Bibliografia", bibliografia)}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/* ---------------- Filtros ---------------- */
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
    <section
      aria-label="Filtros de pesquisa"
      className="mt-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800/70 p-4 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-extrabold text-zinc-800 dark:text-zinc-100">
          <Filter className="w-4 h-4" aria-hidden="true" />
          <span>Filtrar trabalhos</span>
          <span className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            ({totalFiltrados} encontrado{totalFiltrados === 1 ? "" : "s"})
          </span>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
          aria-label="Limpar filtros"
          title="Limpar filtros"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          Limpar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Busca livre */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Buscar por título ou conteúdo
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="text"
              value={termoValue}
              onChange={(e) => onChangeTermo(e.target.value)}
              placeholder="Digite um termo chave…"
              className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              aria-label="Buscar por título ou conteúdo"
            />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Dica: a busca considera resultados, considerações, método, objetivos e mais.
          </p>
        </div>

        {/* Filtro por chamada */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Chamada científica
          </label>
          <select
            value={chamadaSelecionada}
            onChange={(e) => onChangeChamada(e.target.value)}
            className="w-full text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            aria-label="Filtrar por chamada científica"
          >
            <option value="">Todas</option>
            {chamadas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por linha temática */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Linha temática
          </label>
          <select
            value={linhaSelecionada}
            onChange={(e) => onChangeLinha(e.target.value)}
            className="w-full text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            aria-label="Filtrar por linha temática"
          >
            <option value="">Todas</option>
            {linhas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Página principal ---------------- */
export default function RepositorioTrabalhos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros (controlados + querystring)
  const [termo, setTermo] = useState(() => searchParams.get("q") || "");
  const [chamadaSel, setChamadaSel] = useState(() => searchParams.get("chamada") || "");
  const [linhaSel, setLinhaSel] = useState(() => searchParams.get("linha") || "");

  // debounce termo (para não filtrar a cada tecla)
  const [termoDeb, setTermoDeb] = useState(() => searchParams.get("q") || "");
  useEffect(() => {
    const t = setTimeout(() => setTermoDeb(termo), 250);
    return () => clearTimeout(t);
  }, [termo]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      // cache primeiro
      const cached = readCache();
      if (cached?.length) {
        setDados(cached);
        setLoading(false);
      }

      const resp = await apiGet("/trabalhos/repositorio");
      const lista = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
      setDados(lista);
      writeCache(lista);
    } catch (e) {
      const status = e?.status || e?.response?.status;

      if (status === 401) {
        navigate(`/login?next=${encodeURIComponent("/repositorio-trabalhos")}`, { replace: true });
        return;
      }

      setErro(e?.response?.data?.erro || e?.response?.data?.message || "Não foi possível carregar o repositório no momento.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // atualiza querystring quando filtros mudam
  useEffect(() => {
    const q = new URLSearchParams();
    if (termo) q.set("q", termo);
    if (chamadaSel) q.set("chamada", chamadaSel);
    if (linhaSel) q.set("linha", linhaSel);
    setSearchParams(q, { replace: true });
  }, [termo, chamadaSel, linhaSel, setSearchParams]);

  const chamadas = useMemo(() => {
    const set = new Set();
    dados.forEach((d) => d?.chamada_titulo && set.add(d.chamada_titulo));
    return Array.from(set).sort();
  }, [dados]);

  const linhas = useMemo(() => {
    const set = new Set();
    dados.forEach((d) => {
      const nome = d?.linha_tematica_nome || d?.linha_tematica_codigo;
      if (nome) set.add(nome);
    });
    return Array.from(set).sort();
  }, [dados]);

  const filtrados = useMemo(() => {
    let arr = Array.isArray(dados) ? [...dados] : [];

    if (chamadaSel) arr = arr.filter((d) => d?.chamada_titulo === chamadaSel);

    if (linhaSel) {
      arr = arr.filter((d) => d?.linha_tematica_nome === linhaSel || d?.linha_tematica_codigo === linhaSel);
    }

    const t = norm(termoDeb);
    if (t) {
      arr = arr.filter((d) =>
        [
          d?.titulo,
          d?.introducao,
          d?.objetivos,
          d?.metodo,
          d?.resultados,
          d?.consideracao,
          d?.bibliografia,
        ]
          .filter(Boolean)
          .some((campo) => norm(campo).includes(t))
      );
    }

    return arr;
  }, [dados, chamadaSel, linhaSel, termoDeb]);

  const total = dados.length;
  const totalChamadas = chamadas.length;
  const totalLinhas = linhas.length;
  const totalComBanner = useMemo(() => dados.filter((d) => d?.banner_url).length, [dados]);

  const limpar = useCallback(() => {
    setTermo("");
    setChamadaSel("");
    setLinhaSel("");
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-gray-900 dark:bg-zinc-950 dark:text-white">
      <HeaderHero onRefresh={carregar} carregando={loading} />

      <main id="conteudo" role="main" className="flex-1 px-3 sm:px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Mini stats */}
          <MiniStats
            total={total}
            totalChamadas={totalChamadas}
            totalLinhas={totalLinhas}
            totalComBanner={totalComBanner}
            filtrados={filtrados.length}
          />

          {/* Filtros */}
          <FiltrosRepositorio
            chamadas={chamadas}
            linhas={linhas}
            chamadaSelecionada={chamadaSel}
            linhaSelecionada={linhaSel}
            termoValue={termo}
            onChangeChamada={setChamadaSel}
            onChangeLinha={setLinhaSel}
            onChangeTermo={setTermo}
            onClearAll={limpar}
            totalFiltrados={filtrados.length}
          />

          {/* Conteúdo principal */}
          <section aria-label="Lista de trabalhos" className="mt-6 mb-6 flex flex-col gap-4">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-200">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Carregando trabalhos do repositório…
                </div>
              </div>
            )}

            {!loading && erro && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3 flex items-start gap-2 text-sm text-rose-800 dark:text-rose-100">
                <AlertCircle className="w-4 h-4 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-extrabold">Não foi possível carregar os trabalhos.</p>
                  <p className="mt-1 text-xs break-words">{erro}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={carregar}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-600"
                    >
                      <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loading && !erro && filtrados.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 px-4 py-8 text-center">
                <p className="text-sm text-zinc-700 dark:text-zinc-200 font-semibold">
                  Nenhum trabalho encontrado com os filtros atuais.
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Ajuste os filtros ou limpe o campo de busca.
                </p>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={limpar}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-extrabold hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    Limpar filtros
                  </button>
                </div>
              </div>
            )}

            {!loading && !erro && filtrados.length > 0 && (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key="grid"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-1 gap-4"
                >
                  {filtrados.map((trabalho) => (
                    <CardTrabalho key={trabalho.id} trabalho={trabalho} reduceMotion={reduceMotion} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
