// ✅ src/pages/RepositorioTrabalhos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../services/api";
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
} from "lucide-react";

/* ---------------- HeaderHero (paleta exclusiva desta página) ---------------- */
function HeaderHero() {
  // Paleta diferente da ConfirmarPresenca: azul escuro → roxo → pink
  const gradient = "from-sky-900 via-indigo-800 to-fuchsia-700";

  return (
    <header
      className={`relative isolate overflow-hidden bg-gradient-to-br ${gradient} text-white`}
      role="banner"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-4">
        {/* “breadcrumb” / chip do título da página */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur shadow-sm shadow-black/10">
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-medium">
            Repositório de Trabalhos Científicos
          </span>
        </div>

        {/* Título + ícone */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Trabalhos submetidos e avaliados
          </h1>
        </div>

        {/* Subtítulo / descrição */}
        <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl mx-auto">
          Consulte títulos, métodos, resultados e considerações finais dos trabalhos já
          avaliados nas chamadas científicas. As notas ficam ocultas — aqui o foco é o
          conteúdo.
        </p>
      </div>

      {/* Glow decorativo centralizado */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-30 bg-fuchsia-400"
      />
    </header>
  );
}

/* ---------------- Mini stats ---------------- */
function MiniStats({ total, totalChamadas, totalLinhas, totalComBanner }) {
  const items = [
    {
      label: "Trabalhos no repositório",
      value: total,
      helper: "Somente trabalhos já avaliados",
    },
    {
      label: "Chamadas científicas",
      value: totalChamadas,
      helper: "Eventos / editais distintos",
    },
    {
      label: "Linhas temáticas",
      value: totalLinhas,
      helper: "Áreas / eixos de pesquisa",
    },
    {
      label: "Com banner disponível",
      value: totalComBanner,
      helper: "Arquivos para download",
    },
  ];

  return (
    <section
      aria-label="Resumo do repositório"
      className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800/70 px-4 py-3 flex flex-col justify-between"
        >
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {item.value ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {item.helper}
          </p>
        </article>
      ))}
    </section>
  );
}

/* ---------------- Badge helpers ---------------- */
function StatusBadge({ status, statusEscrita, statusOral }) {
  const s = String(status || "").toLowerCase();

  let label = "Em avaliação";
  let classes =
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200";

  if (s === "aprovado_exposicao") {
    label = "Aprovado para exposição";
    classes =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
  } else if (s === "aprovado_oral") {
    label = "Aprovado para apresentação oral";
    classes =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
  } else if (s === "reprovado") {
    label = "Não selecionado";
    classes =
      "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200";
  }

  const tags = [];
  if (statusEscrita === "aprovado") tags.push("Escrita");
  if (statusOral === "aprovado") tags.push("Oral");

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${classes}`}
      >
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
function CardTrabalho({ trabalho }) {
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
    consideracoes,
    bibliografia,
    status,
    status_escrita,
    status_oral,
    banner_url,
    banner_nome,
  } = trabalho;

  const inicioFmt = useMemo(() => {
    if (!inicio_experiencia) return "—";
    // formato esperado: YYYY-MM
    const [y, m] = String(inicio_experiencia).split("-");
    if (!y || !m) return inicio_experiencia;
    return `${m}/${y}`;
  }, [inicio_experiencia]);

  const toggle = () => setAberto((v) => !v);

  const secao = (tituloSecao, texto) => {
    if (!texto) return null;
    return (
      <div className="mt-3">
        <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
          {tituloSecao}
        </h4>
        {/* Justificado nos detalhes */}
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap text-justify">
          {texto}
        </p>
      </div>
    );
  };

  /* Preview: NÃO usa mais a introdução
     – prioriza resultados, depois considerações/objetivos */
  const previewTexto =
    resultados || consideracoes || objetivos || "" /* se nada, não mostra */;

  return (
    <article
      className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800/70 p-4 flex flex-col gap-3 relative overflow-hidden"
      aria-label={`Trabalho ${titulo}`}
    >
      {/* faixinha superior suave */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-fuchsia-500 to-rose-500" />

      {/* Cabeçalho do card */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {titulo || "Trabalho sem título"}
            </h3>
            {chamada_titulo && (
              <p className="mt-0.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {chamada_titulo}
              </p>
            )}
          </div>
          <StatusBadge
            status={status}
            statusEscrita={status_escrita}
            statusOral={status_oral}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <LinhaBadge
            codigo={linha_tematica_codigo}
            nome={linha_tematica_nome}
          />
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            Início da experiência:{" "}
            <span className="font-medium ml-1">{inicioFmt}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            ID #{id}
          </span>
        </div>
      </div>

      {/* Resumo rápido (preview) – sem introdução */}
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
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          aria-expanded={aberto}
          aria-controls={`trabalho-${id}-detalhes`}
        >
          {aberto ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Ocultar detalhes
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Ver detalhes do trabalho
            </>
          )}
        </button>

        {banner_url ? (
          <a
            href={banner_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 text-xs font-medium transition"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Ver banner
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 px-3 py-1.5 text-xs">
            <ImageIcon className="w-3.5 h-3.5" />
            Banner não disponível
          </span>
        )}
      </div>

      {/* Detalhes expansíveis */}
      {aberto && (
        <div
          id={`trabalho-${id}-detalhes`}
          className="mt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-3"
        >
          {secao("Introdução", introducao)}
          {secao("Objetivos", objetivos)}
          {secao("Método / Descrição da prática", metodo)}
          {secao("Resultados / Impactos", resultados)}
          {secao("Considerações finais", consideracoes)}
          {secao("Referências / Bibliografia", bibliografia)}
        </div>
      )}
    </article>
  );
}

/* ---------------- Filtros ---------------- */
function FiltrosRepositorio({
  chamadas,
  linhas,
  chamadaSelecionada,
  linhaSelecionada,
  termo,
  onChangeChamada,
  onChangeLinha,
  onChangeTermo,
}) {
  return (
    <section
      aria-label="Filtros de pesquisa"
      className="mt-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800/70 p-4 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        <Filter className="w-4 h-4" />
        <span>Filtrar trabalhos</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Busca livre */}
        <div className="col-span-1 md:col-span-1">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Buscar por título ou conteúdo
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={termo}
              onChange={(e) => onChangeTermo(e.target.value)}
              placeholder="Digite um termo chave…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Filtro por chamada */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Chamada científica
          </label>
          <select
            value={chamadaSelecionada}
            onChange={(e) => onChangeChamada(e.target.value)}
            className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
          >
            <option value="">Todas</option>
            {chamadas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por linha temática (só nome) */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Linha temática
          </label>
          <select
            value={linhaSelecionada}
            onChange={(e) => onChangeLinha(e.target.value)}
            className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
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

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros controlados também via querystring
  const [termo, setTermo] = useState(() => searchParams.get("q") || "");
  const [chamadaSel, setChamadaSel] = useState(
    () => searchParams.get("chamada") || ""
  );
  const [linhaSel, setLinhaSel] = useState(
    () => searchParams.get("linha") || ""
  );

  // carrega repositório do backend
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true);
      setErro("");
      try {
        // GET /api/trabalhos/repositorio
        const resp = await apiGet("/trabalhos/repositorio");
        if (!ativo) return;
        setDados(Array.isArray(resp.data) ? resp.data : resp);
      } catch (e) {
        if (!ativo) return;
        const status = e?.status || e?.response?.status;
        if (status === 401) {
          // se a API exigir login, redireciona
          navigate(
            `/login?next=${encodeURIComponent("/repositorio-trabalhos")}`,
            {
              replace: true,
            }
          );
          return;
        }
        setErro(
          e?.response?.data?.erro ||
            e?.response?.data?.message ||
            "Não foi possível carregar o repositório no momento."
        );
      } finally {
        if (ativo) setLoading(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [navigate]);

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
    dados.forEach((d) => {
      if (d.chamada_titulo) set.add(d.chamada_titulo);
    });
    return Array.from(set).sort();
  }, [dados]);

  const linhas = useMemo(() => {
    const set = new Set();
    dados.forEach((d) => {
      const nome = d.linha_tematica_nome || d.linha_tematica_codigo;
      if (nome) set.add(nome);
    });
    return Array.from(set).sort();
  }, [dados]);

  const filtrados = useMemo(() => {
    let arr = [...dados];
    if (chamadaSel) {
      arr = arr.filter((d) => d.chamada_titulo === chamadaSel);
    }
    if (linhaSel) {
      arr = arr.filter(
        (d) =>
          d.linha_tematica_nome === linhaSel ||
          d.linha_tematica_codigo === linhaSel
      );
    }
    if (termo.trim()) {
      const t = termo.trim().toLowerCase();
      arr = arr.filter((d) => {
        return [
          d.titulo,
          d.introducao,
          d.objetivos,
          d.metodo,
          d.resultados,
          d.consideracoes,
          d.bibliografia,
        ]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(t));
      });
    }
    return arr;
  }, [dados, chamadaSel, linhaSel, termo]);

  const total = dados.length;
  const totalChamadas = chamadas.length;
  const totalLinhas = linhas.length;
  const totalComBanner = useMemo(
    () => dados.filter((d) => d.banner_url).length,
    [dados]
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-gray-900 dark:bg-zinc-950 dark:text-white">
      <HeaderHero />

      <main role="main" className="flex-1 px-3 sm:px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Mini stats */}
          <MiniStats
            total={total}
            totalChamadas={totalChamadas}
            totalLinhas={totalLinhas}
            totalComBanner={totalComBanner}
          />

          {/* Filtros */}
          <FiltrosRepositorio
            chamadas={chamadas}
            linhas={linhas}
            chamadaSelecionada={chamadaSel}
            linhaSelecionada={linhaSel}
            termo={termo}
            onChangeChamada={setChamadaSel}
            onChangeLinha={setLinhaSel}
            onChangeTermo={setTermo}
          />

          {/* Conteúdo principal */}
          <section
            aria-label="Lista de trabalhos"
            className="mt-6 mb-6 flex flex-col gap-4"
          >
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando trabalhos do repositório…
                </div>
              </div>
            )}

            {!loading && erro && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3 flex items-start gap-2 text-sm text-rose-800 dark:text-rose-100">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Não foi possível carregar os trabalhos.
                  </p>
                  <p className="mt-1 text-xs">{erro}</p>
                </div>
              </div>
            )}

            {!loading && !erro && filtrados.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 px-4 py-6 text-center text-sm text-zinc-600 dark:text-zinc-300">
                Nenhum trabalho encontrado com os filtros atuais. Ajuste os
                filtros ou limpe o campo de busca.
              </div>
            )}

            {!loading && !erro && filtrados.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {filtrados.map((trabalho) => (
                  <CardTrabalho key={trabalho.id} trabalho={trabalho} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
