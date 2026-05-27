// ✅ frontend/src/pages/CursosOnlineAdmin.jsx — v2.0
// Atualizado em: 18/05/2026
//
// Plataforma Escola da Saúde
//
// Página administrativa do módulo Cursos Online.
//
// Função:
// - Listar cursos online cadastrados.
// - Criar, editar, publicar, arquivar, voltar para rascunho e excluir cursos.
// - Filtrar por status, plataforma, categoria e busca textual.
//
// Contratos oficiais usados:
// - GET    /api/curso-online/admin
// - POST   /api/curso-online/admin
// - PUT    /api/curso-online/admin/:id
// - PATCH  /api/curso-online/admin/:id/status
// - DELETE /api/curso-online/admin/:id
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota plural;
// - sem chamada direta para /api fora do service;
// - api.cursoOnline como facade oficial;
// - status oficial: rascunho | publicado | arquivado;
// - plataforma oficial: youtube | govbr | universidade | escola_saude | outra;
// - UX/UI premium;
// - mobile-first;
// - acessível;
// - dark mode;
// - estados loading/vazio/erro;
// - confirmação para exclusão.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Filter,
  Globe2,
  GraduationCap,
  Layers3,
  Link2,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  University,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_OFICIAL = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicado", label: "Publicado" },
  { value: "arquivado", label: "Arquivado" },
];

const PLATAFORMAS_OFICIAIS = [
  { value: "youtube", label: "YouTube" },
  { value: "govbr", label: "Gov.br" },
  { value: "universidade", label: "Universidade" },
  { value: "escola_saude", label: "Escola da Saúde" },
  { value: "outra", label: "Outra" },
];

const FORM_INICIAL = {
  titulo: "",
  descricao: "",
  url: "",
  plataforma: "youtube",
  categoria: "",
  carga_horaria: "",
  status: "rascunho",
  imagem_url: "",
  canal_ou_instituicao: "",
  gratuito: true,
  certificado_externo: false,
  ordem: 0,
};

const STORAGE_KEY = "escola:v2:cursos-online-admin:filtros";

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

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function statusInfo(status) {
  const value = String(status || "").toLowerCase();

  const map = {
    rascunho: {
      label: "Rascunho",
      tone: "amber",
      icon: Clock,
    },
    publicado: {
      label: "Publicado",
      tone: "emerald",
      icon: CheckCircle2,
    },
    arquivado: {
      label: "Arquivado",
      tone: "slate",
      icon: Archive,
    },
  };

  return (
    map[value] || {
      label: "Sem status",
      tone: "slate",
      icon: AlertCircle,
    }
  );
}

function plataformaInfo(plataforma) {
  const value = String(plataforma || "").toLowerCase();

  const map = {
    youtube: {
      label: "YouTube",
      icon: MonitorPlay,
      tone: "rose",
    },
    govbr: {
      label: "Gov.br",
      icon: ShieldCheck,
      tone: "blue",
    },
    universidade: {
      label: "Universidade",
      icon: University,
      tone: "violet",
    },
    escola_saude: {
      label: "Escola da Saúde",
      icon: GraduationCap,
      tone: "emerald",
    },
    outra: {
      label: "Outra",
      icon: Globe2,
      tone: "slate",
    },
  };

  return (
    map[value] || {
      label: value || "Plataforma",
      icon: Globe2,
      tone: "slate",
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

function normalizeFormFromCurso(curso) {
  if (!curso) return FORM_INICIAL;

  return {
    titulo: curso.titulo || "",
    descricao: curso.descricao || "",
    url: curso.url || "",
    plataforma: curso.plataforma || "youtube",
    categoria: curso.categoria || "",
    carga_horaria:
      curso.carga_horaria !== null && curso.carga_horaria !== undefined
        ? String(curso.carga_horaria)
        : "",
    status: curso.status || "rascunho",
    imagem_url: curso.imagem_url || "",
    canal_ou_instituicao: curso.canal_ou_instituicao || "",
    gratuito: curso.gratuito !== false,
    certificado_externo: Boolean(curso.certificado_externo),
    ordem:
      curso.ordem !== null && curso.ordem !== undefined
        ? Number(curso.ordem)
        : 0,
  };
}

/* =========================================================================
   Página
=========================================================================== */

export default function CursosOnlineAdmin() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);

  const [cursos, setCursos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroStatus, setFiltroStatus] = useState(persisted.filtroStatus || "");
  const [filtroPlataforma, setFiltroPlataforma] = useState(
    persisted.filtroPlataforma || ""
  );
  const [filtroCategoria, setFiltroCategoria] = useState(
    persisted.filtroCategoria || ""
  );
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalAberto, setModalAberto] = useState(false);
  const [cursoEmEdicao, setCursoEmEdicao] = useState(null);

  const [confirmacao, setConfirmacao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [alterandoStatusId, setAlterandoStatusId] = useState(null);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Cursos Online | Administração";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroStatus,
          filtroPlataforma,
          filtroCategoria,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página
    }
  }, [filtroStatus, filtroPlataforma, filtroCategoria, busca]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setMensagem("");
    setLive("Carregando cursos online.");

    try {
      const response = await api.cursoOnline.listarAdmin();

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
      if (filtroStatus && String(curso.status) !== String(filtroStatus)) {
        return false;
      }

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
            curso.criado_por_nome,
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
  }, [
    cursos,
    filtroStatus,
    filtroPlataforma,
    filtroCategoria,
    buscaDebounced,
  ]);

  const kpis = useMemo(() => {
    const base = {
      total: cursos.length,
      rascunho: 0,
      publicado: 0,
      arquivado: 0,
      gratuito: 0,
      certificadoExterno: 0,
    };

    for (const curso of cursos) {
      const status = String(curso.status || "").toLowerCase();

      if (status === "rascunho") base.rascunho += 1;
      if (status === "publicado") base.publicado += 1;
      if (status === "arquivado") base.arquivado += 1;
      if (curso.gratuito) base.gratuito += 1;
      if (curso.certificado_externo) base.certificadoExterno += 1;
    }

    return base;
  }, [cursos]);

  const temFiltrosAtivos = Boolean(
    filtroStatus || filtroPlataforma || filtroCategoria || buscaDebounced
  );

  function limparFiltros() {
    setFiltroStatus("");
    setFiltroPlataforma("");
    setFiltroCategoria("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function removerChip(tipo) {
    if (tipo === "status") setFiltroStatus("");
    if (tipo === "plataforma") setFiltroPlataforma("");
    if (tipo === "categoria") setFiltroCategoria("");

    if (tipo === "busca") {
      setBusca("");
      setBuscaDebounced("");
    }

    setLive("Filtro removido.");
  }

  function handleCriar() {
    setCursoEmEdicao(null);
    setModalAberto(true);
  }

  function handleEditar(curso) {
    setCursoEmEdicao(curso);
    setModalAberto(true);
  }

  function pedirExclusao(curso) {
    setConfirmacao({
      id: curso.id,
      titulo: curso.titulo,
    });
  }

  async function confirmarExclusao() {
    if (!confirmacao?.id) return;

    setExcluindo(true);
    setErro("");
    setMensagem("");
    setLive("Excluindo curso online.");

    try {
      await api.cursoOnline.excluir(confirmacao.id);

      setCursos((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Curso online excluído com sucesso.");
      setLive("Curso online excluído com sucesso.");
      setConfirmacao(null);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível excluir o curso online."
      );

      setErro(message);
      setLive("Falha ao excluir curso online.");
    } finally {
      setExcluindo(false);
    }
  }

  async function alterarStatus(curso, status) {
    if (!curso?.id || !status || curso.status === status) return;

    setAlterandoStatusId(curso.id);
    setErro("");
    setMensagem("");
    setLive("Alterando status do curso online.");

    try {
      const response = await api.cursoOnline.alterarStatus(curso.id, status);
      const atualizado = response?.data || response?.data?.data || response;

      setCursos((current) =>
        current.map((item) =>
          String(item.id) === String(curso.id)
            ? {
                ...item,
                ...(atualizado && typeof atualizado === "object" ? atualizado : {}),
                status,
              }
            : item
        )
      );

      setMensagem("Status do curso online atualizado com sucesso.");
      setLive("Status do curso online atualizado com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível alterar o status do curso online."
      );

      setErro(message);
      setLive("Falha ao alterar status do curso online.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <ConfirmarExclusaoModal
        open={Boolean(confirmacao)}
        titulo={confirmacao?.titulo}
        loading={excluindo}
        onCancel={() => {
          if (excluindo) return;
          setConfirmacao(null);
        }}
        onConfirm={confirmarExclusao}
      />

      <HeaderHero
        totalVisiveis={cursosFiltrados.length}
        carregando={carregando}
        onRefresh={carregarDados}
        onCriar={handleCriar}
        kpis={kpis}
      />

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {erro ? (
          <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
        ) : null}

        {mensagem ? (
          <AlertBox
            tone="emerald"
            icon={CheckCircle2}
            title="Tudo certo"
            message={mensagem}
          />
        ) : null}

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Filter className="h-5 w-5 text-emerald-600" />
                Gestão dos cursos online
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Filtre, revise, publique e organize links de cursos oficiais
                disponibilizados para os usuários.
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Status"
              value={filtroStatus}
              onChange={setFiltroStatus}
              placeholder="Todos"
              options={STATUS_OFICIAL}
            />

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
              Visíveis:{" "}
              <strong className="font-black text-slate-900 dark:text-white">
                {cursosFiltrados.length}
              </strong>
            </p>

            {temFiltrosAtivos ? (
              <div className="flex flex-wrap items-center gap-2">
                {filtroStatus ? (
                  <Chip
                    text={`Status: ${statusInfo(filtroStatus).label}`}
                    onClear={() => removerChip("status")}
                  />
                ) : null}

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

        <section aria-label="Cursos online cadastrados" className="space-y-3">
          {carregando ? (
            <LoadingList />
          ) : cursosFiltrados.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhum curso online encontrado"
              descricao="Ajuste os filtros ou cadastre um novo curso online."
            />
          ) : (
            cursosFiltrados.map((curso) => (
              <CursoOnlineCard
                key={curso.id}
                curso={curso}
                reduceMotion={reduceMotion}
                alterandoStatus={String(alterandoStatusId) === String(curso.id)}
                onEditar={() => handleEditar(curso)}
                onExcluir={() => pedirExclusao(curso)}
                onAlterarStatus={(status) => alterarStatus(curso, status)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalCursoOnline
        aberto={modalAberto}
        curso={cursoEmEdicao}
        onClose={() => {
          setModalAberto(false);
          setCursoEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setCursoEmEdicao(null);
          carregarDados();
        }}
      />
    </div>
  );
}

/* =========================================================================
   Componentes locais
=========================================================================== */

function HeaderHero({ totalVisiveis, carregando, onRefresh, onCriar, kpis }) {
  return (
    <header className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,.34),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.28),transparent_35%),radial-gradient(circle_at_70%_95%,rgba(6,182,212,.22),transparent_36%)]" />

      <div className="relative mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
              Administração — Cursos Online
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Curadoria de cursos online
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
              Cadastre links de cursos, aulas e trilhas de capacitação em
              plataformas oficiais como YouTube, Gov.br, universidades e Escola
              da Saúde.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              {totalVisiveis} curso(s) visível(is) nos filtros atuais
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              <button
                type="button"
                onClick={onCriar}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-emerald-900 shadow-lg shadow-black/10 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                <Plus className="h-4 w-4" />
                Novo curso
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={carregando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:pointer-events-none disabled:opacity-60"
              >
                <RefreshCcw
                  className={cx("h-4 w-4", carregando && "animate-spin")}
                />
                {carregando ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MiniStat label="Total" value={kpis.total} icon={BookOpen} />
              <MiniStat
                label="Publicados"
                value={kpis.publicado}
                icon={CheckCircle2}
              />
              <MiniStat label="Rascunhos" value={kpis.rascunho} icon={Clock} />
              <MiniStat
                label="Arquivados"
                value={kpis.arquivado}
                icon={Archive}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/65">
          {label}
        </span>
        <Icon className="h-4 w-4 text-white/70" />
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function AlertBox({ tone, icon: Icon, title, message }) {
  const tones = {
    rose:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
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

function CursoOnlineCard({
  curso,
  reduceMotion,
  alterandoStatus,
  onEditar,
  onExcluir,
  onAlterarStatus,
}) {
  const status = statusInfo(curso.status);
  const plataforma = plataformaInfo(curso.plataforma);
  const StatusIcon = status.icon;
  const PlataformaIcon = plataforma.icon;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5"
    >
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-1.5",
          curso.status === "publicado" && "bg-emerald-600",
          curso.status === "rascunho" && "bg-amber-500",
          curso.status === "arquivado" && "bg-slate-500"
        )}
        aria-hidden="true"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {curso.titulo}
            </h3>

            <StatusBadge status={curso.status} />

            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <PlataformaIcon className="h-3.5 w-3.5" />
              {curso.plataforma_label || plataforma.label}
            </span>

            {curso.categoria ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                {curso.categoria}
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {curso.descricao || "Sem descrição informada."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              icon={Link2}
              title="URL"
              value={curso.url}
              truncate={false}
            />
            <InfoBox
              icon={Layers3}
              title="Instituição"
              value={curso.canal_ou_instituicao || "Não informada"}
            />
            <InfoBox
              icon={BookOpen}
              title="Carga"
              value={
                curso.carga_horaria != null
                  ? `${curso.carga_horaria}h`
                  : "Não informada"
              }
            />
            <InfoBox
              icon={Clock}
              title="Atualizado"
              value={brDateTime(curso.atualizado_em)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {curso.gratuito ? "Gratuito" : "Não gratuito"}
            </span>

            {curso.certificado_externo ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                Certificado externo
              </span>
            ) : null}

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>

            {curso.criado_por_nome ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Criado por: {curso.criado_por_nome}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <a
            href={curso.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir curso
          </a>

          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </button>

          {curso.status !== "publicado" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("publicado")}
              disabled={alterandoStatus}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              {alterandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Publicar
            </button>
          ) : null}

          {curso.status !== "rascunho" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("rascunho")}
              disabled={alterandoStatus}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {alterandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Rascunho
            </button>
          ) : null}

          {curso.status !== "arquivado" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("arquivado")}
              disabled={alterandoStatus}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {alterandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Arquivar
            </button>
          ) : null}

          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/60"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function StatusBadge({ status }) {
  const info = statusInfo(status);

  const tones = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        tones[info.tone] || tones.slate
      )}
    >
      {info.label}
    </span>
  );
}

function InfoBox({ icon: Icon, title, value, truncate = true }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p
          className={cx(
            "mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200",
            truncate ? "truncate" : "break-all"
          )}
          title={value}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20"
        >
          <Skeleton height={22} width="60%" />
          <div className="mt-3 space-y-2">
            <Skeleton height={14} />
            <Skeleton height={14} width="80%" />
            <Skeleton height={14} width="50%" />
          </div>
        </div>
      ))}
    </>
  );
}

function ConfirmarExclusaoModal({ open, titulo, loading, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (loading) return;
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-exclusao-curso-online-title"
        aria-describedby="confirmar-exclusao-curso-online-desc"
        className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-900 via-red-800 to-amber-700 p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="confirmar-exclusao-curso-online-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight"
              >
                <AlertCircle className="h-5 w-5" />
                Excluir curso online?
              </h3>

              <p
                id="confirmar-exclusao-curso-online-desc"
                className="mt-2 text-sm leading-relaxed text-white/90"
              >
                Tem certeza que deseja excluir{" "}
                {titulo ? <strong>“{titulo}”</strong> : "este curso online"}?
                Esta ação não pode ser desfeita.
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-60"
              aria-label="Fechar confirmação"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 bg-white p-4 dark:bg-slate-950 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? (
              <>
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Sim, excluir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCursoOnline({ aberto, curso, onClose, onSaved }) {
  const isEdicao = Boolean(curso?.id);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    setForm(normalizeFormFromCurso(curso));
    setSalvando(false);
    setErro("");
    setA11y("");

    const timer = window.setTimeout(() => {
      firstRef.current?.focus?.();
    }, 80);

    function onKeyDown(event) {
      if (event.key === "Escape" && !salvando) {
        onClose?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto, curso, onClose, salvando]);

  function setCampo(campo, valor) {
    setForm((current) => ({
      ...current,
      [campo]: valor,
    }));
  }

  function validar() {
    if (!cleanStr(form.titulo) || cleanStr(form.titulo).length < 3) {
      return "Informe o título do curso com pelo menos 3 caracteres.";
    }

    if (!isHttpUrl(form.url)) {
      return "Informe uma URL válida começando com http:// ou https://.";
    }

    if (!PLATAFORMAS_OFICIAIS.some((item) => item.value === form.plataforma)) {
      return "Selecione uma plataforma oficial.";
    }

    if (!STATUS_OFICIAL.some((item) => item.value === form.status)) {
      return "Selecione um status oficial.";
    }

    if (form.imagem_url && !isHttpUrl(form.imagem_url)) {
      return "Informe uma URL de imagem válida ou deixe o campo vazio.";
    }

    if (form.carga_horaria) {
      const carga = Number(form.carga_horaria);

      if (!Number.isInteger(carga) || carga < 0) {
        return "Carga horária inválida.";
      }
    }

    if (form.ordem !== "" && form.ordem !== null && form.ordem !== undefined) {
      const ordem = Number(form.ordem);

      if (!Number.isInteger(ordem) || ordem < 0) {
        return "Ordem inválida.";
      }
    }

    return null;
  }

  function montarPayload() {
    return {
      titulo: cleanStr(form.titulo),
      descricao: cleanStr(form.descricao) || null,
      url: cleanStr(form.url),
      plataforma: form.plataforma,
      categoria: cleanStr(form.categoria) || null,
      carga_horaria:
        form.carga_horaria === "" || form.carga_horaria == null
          ? null
          : Number(form.carga_horaria),
      status: form.status,
      imagem_url: cleanStr(form.imagem_url) || null,
      canal_ou_instituicao: cleanStr(form.canal_ou_instituicao) || null,
      gratuito: Boolean(form.gratuito),
      certificado_externo: Boolean(form.certificado_externo),
      ordem:
        form.ordem === "" || form.ordem == null ? 0 : Number(form.ordem),
    };
  }

  async function salvar(event) {
    event?.preventDefault?.();

    if (salvando) return;

    setErro("");
    setA11y("");

    const erroValidacao = validar();

    if (erroValidacao) {
      setErro(erroValidacao);
      setA11y(erroValidacao);
      return;
    }

    setSalvando(true);
    setA11y(isEdicao ? "Salvando alterações." : "Cadastrando curso online.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.cursoOnline.atualizar(curso.id, payload);
      } else {
        await api.cursoOnline.criar(payload);
      }

      setA11y("Curso online salvo com sucesso.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível salvar o curso online."
      );

      setErro(message);
      setA11y(message);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (salvando) return;
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-curso-online-title"
        aria-describedby="modal-curso-online-desc"
className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950"      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.22),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                Cursos Online
              </div>

              <h2
                id="modal-curso-online-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                <BookOpen className="h-5 w-5" />
                {isEdicao ? "Editar curso online" : "Novo curso online"}
              </h2>

              <p
                id="modal-curso-online-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                Cadastre links de cursos, aulas e trilhas oficiais para acesso
                dos usuários da plataforma.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div aria-live="polite" className="sr-only">
          {a11y}
        </div>

        <form
          onSubmit={salvar}
className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 pb-28 dark:bg-slate-950 sm:p-6 sm:pb-32"        >
          {erro ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{erro}</span>
              </div>
            </div>
          ) : null}

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Dados do curso
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Título" required>
                <input
                  ref={firstRef}
                  value={form.titulo}
                  onChange={(event) => setCampo("titulo", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Introdução à Saúde Mental na APS"
                  maxLength={200}
                  disabled={salvando}
                />
              </Field>

              <Field label="URL do curso" required>
                <input
                  value={form.url}
                  onChange={(event) => setCampo("url", event.target.value)}
                  className={inputClass()}
                  placeholder="https://..."
                  disabled={salvando}
                />
              </Field>

              <Field label="Plataforma" required>
                <select
                  value={form.plataforma}
                  onChange={(event) =>
                    setCampo("plataforma", event.target.value)
                  }
                  className={inputClass()}
                  disabled={salvando}
                >
                  {PLATAFORMAS_OFICIAIS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(event) => setCampo("status", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                >
                  {STATUS_OFICIAL.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Categoria">
                <input
                  value={form.categoria}
                  onChange={(event) => setCampo("categoria", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Atenção Primária, Urgência, Saúde Mental..."
                  disabled={salvando}
                />
              </Field>

              <Field label="Canal ou instituição">
                <input
                  value={form.canal_ou_instituicao}
                  onChange={(event) =>
                    setCampo("canal_ou_instituicao", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Ex.: Escola da Saúde, Ministério da Saúde..."
                  disabled={salvando}
                />
              </Field>

              <Field label="Carga horária">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.carga_horaria}
                  onChange={(event) =>
                    setCampo("carga_horaria", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Ex.: 20"
                  disabled={salvando}
                />
              </Field>

              <Field label="Ordem">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.ordem}
                  onChange={(event) => setCampo("ordem", event.target.value)}
                  className={inputClass()}
                  placeholder="0"
                  disabled={salvando}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Imagem de capa">
                  <input
                    value={form.imagem_url}
                    onChange={(event) =>
                      setCampo("imagem_url", event.target.value)
                    }
                    className={inputClass()}
                    placeholder="https://... imagem opcional"
                    disabled={salvando}
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Descrição">
                  <textarea
                    value={form.descricao}
                    onChange={(event) => setCampo("descricao", event.target.value)}
                    rows={4}
                    className={textareaClass()}
                    placeholder="Descreva o curso, objetivo e público recomendado."
                    disabled={salvando}
                  />
                </Field>
              </div>

              <div className="md:col-span-2 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.gratuito}
                    onChange={(event) =>
                      setCampo("gratuito", event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                  Curso gratuito
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.certificado_externo}
                    onChange={(event) =>
                      setCampo("certificado_externo", event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                  Emite certificado externo
                </label>
              </div>
            </div>
          </section>
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Campos com <span className="font-bold text-rose-500">*</span> são
            obrigatórios.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isEdicao ? "Salvar alterações" : "Cadastrar curso"}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function inputClass() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}

function textareaClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}