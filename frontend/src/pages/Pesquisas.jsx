// ✅ frontend/src/pages/Pesquisas.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página do usuário para acesso e resposta às Pesquisas.
//
// Função:
// - Listar pesquisas publicadas e disponíveis.
// - Abrir pesquisa externa em link oficial.
// - Responder pesquisa interna dentro da plataforma.
// - Bloquear nova resposta quando já respondida, conforme regra da pesquisa.
//
// Contratos oficiais usados:
// - GET  /api/pesquisa/publicada
// - GET  /api/pesquisa/:id
// - POST /api/pesquisa/:id/responder
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota plural;
// - sem chamada direta para /api fora do service;
// - api.pesquisa como facade oficial;
// - usuário visualiza somente pesquisas publicadas/disponíveis;
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
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileQuestion,
  Filter,
  Globe2,
  Layers3,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";

/* =========================================================================
   Constantes
=========================================================================== */

const CONTEXTOS_OFICIAIS = [
  { value: "geral", label: "Geral" },
  { value: "evento", label: "Evento" },
  { value: "turma", label: "Turma" },
];

const STORAGE_KEY = "escola:v2:pesquisas:filtros";

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

function unwrapData(response) {
  if (response?.data?.data !== undefined) return response.data.data;
  if (response?.data !== undefined) return response.data;
  return response;
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

function contextoInfo(contexto) {
  const value = String(contexto || "").toLowerCase();

  const map = {
    geral: "Geral",
    evento: "Evento",
    turma: "Turma",
  };

  return map[value] || value || "Contexto";
}

function tipoInfo(tipo) {
  const value = String(tipo || "").toLowerCase();

  if (value === "externa") {
    return {
      label: "Externa",
      icon: ExternalLink,
      badge:
        "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    };
  }

  return {
    label: "Interna",
    icon: ClipboardList,
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  };
}

function perguntaExigeOpcoes(tipo) {
  return tipo === "opcao_unica" || tipo === "multipla_escolha";
}

function perguntaAceitaTexto(tipo) {
  return tipo === "texto_curto" || tipo === "texto_longo";
}

function perguntaAceitaNumero(tipo) {
  return tipo === "escala";
}

function tipoPerguntaLabel(tipo) {
  const labels = {
    opcao_unica: "Opção única",
    multipla_escolha: "Múltipla escolha",
    texto_curto: "Texto curto",
    texto_longo: "Texto longo",
    escala: "Escala 1 a 5",
  };

  return labels[tipo] || tipo || "Pergunta";
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function respostaInicial(perguntas = []) {
  const itens = {};

  for (const pergunta of perguntas) {
    if (pergunta.tipo === "multipla_escolha") {
      itens[pergunta.id] = [];
    } else {
      itens[pergunta.id] = "";
    }
  }

  return {
    anonima: false,
    itens,
  };
}

/* =========================================================================
   Página
=========================================================================== */

export default function Pesquisas() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);

  const [pesquisas, setPesquisas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroContexto, setFiltroContexto] = useState(
    persisted.filtroContexto || ""
  );
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalPesquisa, setModalPesquisa] = useState(null);
  const [carregandoPesquisa, setCarregandoPesquisa] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Pesquisas | Escola da Saúde";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroContexto,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página.
    }
  }, [filtroContexto, busca]);

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
    setLive("Carregando pesquisas.");

    try {
      const response = await api.pesquisa.listarPublicadas();

      const data = unwrapArray(response);
      setPesquisas(data);

      setLive(`Pesquisas carregadas: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as pesquisas."
      );

      setErro(message);
      setLive("Falha ao carregar pesquisas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const pesquisasFiltradas = useMemo(() => {
    const query = norm(buscaDebounced);

    return pesquisas.filter((pesquisa) => {
      if (
        filtroContexto &&
        String(pesquisa.contexto) !== String(filtroContexto)
      ) {
        return false;
      }

      if (query) {
        const haystack = norm(
          [
            pesquisa.titulo,
            pesquisa.descricao,
            pesquisa.tipo,
            pesquisa.tipo_label,
            pesquisa.contexto,
            pesquisa.contexto_label,
            pesquisa.link_externo,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [pesquisas, filtroContexto, buscaDebounced]);

  const kpis = useMemo(() => {
    const base = {
      total: pesquisas.length,
      internas: 0,
      externas: 0,
      destaque: 0,
      respondidas: 0,
    };

    for (const pesquisa of pesquisas) {
      if (pesquisa.tipo === "interna") base.internas += 1;
      if (pesquisa.tipo === "externa") base.externas += 1;
      if (pesquisa.destaque) base.destaque += 1;
      if (pesquisa.respondida) base.respondidas += 1;
    }

    return base;
  }, [pesquisas]);

  const temFiltrosAtivos = Boolean(filtroContexto || buscaDebounced);

  function limparFiltros() {
    setFiltroContexto("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function removerChip(tipo) {
    if (tipo === "contexto") setFiltroContexto("");

    if (tipo === "busca") {
      setBusca("");
      setBuscaDebounced("");
    }

    setLive("Filtro removido.");
  }

  async function abrirPesquisa(pesquisa) {
    setErro("");
    setMensagem("");

    if (pesquisa.tipo === "externa") {
      if (!pesquisa.link_externo) {
        setErro("Esta pesquisa externa não possui link disponível.");
        return;
      }

      window.open(pesquisa.link_externo, "_blank", "noopener,noreferrer");
      return;
    }

    if (pesquisa.respondida && pesquisa.uma_resposta_por_usuario) {
      setMensagem("Você já respondeu esta pesquisa.");
      return;
    }

    setCarregandoPesquisa(true);
    setLive("Carregando pesquisa.");

    try {
      const response = await api.pesquisa.obter(pesquisa.id);
      const completa = unwrapData(response);

      if (completa?.respondida && completa?.uma_resposta_por_usuario) {
        setMensagem("Você já respondeu esta pesquisa.");
        setPesquisas((current) =>
          current.map((item) =>
            String(item.id) === String(pesquisa.id)
              ? { ...item, respondida: true }
              : item
          )
        );
        return;
      }

      setModalPesquisa(completa);
      setLive("Pesquisa carregada.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a pesquisa."
      );

      setErro(message);
      setLive("Falha ao carregar pesquisa.");
    } finally {
      setCarregandoPesquisa(false);
    }
  }

  function handleRespondida(pesquisaId) {
    setPesquisas((current) =>
      current.map((item) =>
        String(item.id) === String(pesquisaId)
          ? {
              ...item,
              respondida: true,
              total_respostas: Number(item.total_respostas || 0) + 1,
            }
          : item
      )
    );

    setModalPesquisa(null);
    setMensagem("Resposta registrada com sucesso. Obrigado por participar!");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <ResponderPesquisaModal
        pesquisa={modalPesquisa}
        onClose={() => setModalPesquisa(null)}
        onRespondida={handleRespondida}
      />

      <HeaderHero
        totalVisiveis={pesquisasFiltradas.length}
        carregando={carregando || carregandoPesquisa}
        onRefresh={carregarDados}
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
                Pesquisas disponíveis
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Responda pesquisas internas ou acesse formulários externos
                divulgados pela Escola da Saúde.
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

          <div className="grid gap-3 md:grid-cols-2">
            <FilterSelect
              label="Contexto"
              value={filtroContexto}
              onChange={setFiltroContexto}
              placeholder="Todos"
              options={CONTEXTOS_OFICIAIS}
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
              Pesquisas visíveis:{" "}
              <strong className="font-black text-slate-900 dark:text-white">
                {pesquisasFiltradas.length}
              </strong>
            </p>

            {temFiltrosAtivos ? (
              <div className="flex flex-wrap items-center gap-2">
                {filtroContexto ? (
                  <Chip
                    text={`Contexto: ${contextoInfo(filtroContexto)}`}
                    onClear={() => removerChip("contexto")}
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

        <section aria-label="Lista de pesquisas" className="space-y-3">
          {carregando ? (
            <LoadingGrid />
          ) : pesquisasFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma pesquisa disponível"
              descricao="Quando houver pesquisas publicadas, elas aparecerão aqui."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {pesquisasFiltradas.map((pesquisa) => (
                <PesquisaCard
                  key={pesquisa.id}
                  pesquisa={pesquisa}
                  reduceMotion={reduceMotion}
                  onAbrir={() => abrirPesquisa(pesquisa)}
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
   Componentes principais
=========================================================================== */

function HeaderHero({ totalVisiveis, carregando, onRefresh, kpis }) {
  return (
    <header className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,.34),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.28),transparent_35%),radial-gradient(circle_at_70%_95%,rgba(6,182,212,.22),transparent_36%)]" />

      <div className="relative mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
              Pesquisas
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Participe das pesquisas da Escola da Saúde
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
              Sua participação ajuda a Escola da Saúde a planejar ações,
              aprimorar capacitações e entender melhor as necessidades dos
              profissionais.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              {totalVisiveis} pesquisa(s) disponível(is) nos filtros atuais
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
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
              <MiniStat label="Pesquisas" value={kpis.total} icon={FileQuestion} />
              <MiniStat
                label="Internas"
                value={kpis.internas}
                icon={ClipboardList}
              />
              <MiniStat
                label="Externas"
                value={kpis.externas}
                icon={ExternalLink}
              />
              <MiniStat
                label="Respondidas"
                value={kpis.respondidas}
                icon={CheckCircle2}
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
          placeholder="Título, descrição, contexto..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Buscar pesquisas"
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

function PesquisaCard({ pesquisa, reduceMotion, onAbrir }) {
  const tipo = tipoInfo(pesquisa.tipo);
  const TipoIcon = tipo.icon;

  const jaRespondida =
    Boolean(pesquisa.respondida) && Boolean(pesquisa.uma_resposta_por_usuario);

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group relative flex min-h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20"
    >
      <div className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.20),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,.14),transparent_30%)]" />
        <FileQuestion className="relative h-14 w-14 opacity-90" />

        {pesquisa.destaque ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
            <Star className="h-3.5 w-3.5" />
            Destaque
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black",
              tipo.badge
            )}
          >
            <TipoIcon className="h-3.5 w-3.5" />
            {pesquisa.tipo_label || tipo.label}
          </span>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {pesquisa.contexto_label || contextoInfo(pesquisa.contexto)}
          </span>

          {jaRespondida ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Respondida
            </span>
          ) : null}
        </div>

        <h3 className="mt-4 text-lg font-black leading-tight text-slate-900 dark:text-white">
          {pesquisa.titulo}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {pesquisa.descricao || "Pesquisa disponível para participação."}
        </p>

        <div className="mt-4 grid gap-2 text-sm">
          <InfoRow
            icon={Layers3}
            label="Contexto"
            value={pesquisa.contexto_label || contextoInfo(pesquisa.contexto)}
          />

          <InfoRow
            icon={Clock}
            label="Prazo"
            value={
              pesquisa.fecha_em
                ? `Até ${brDateTime(pesquisa.fecha_em)}`
                : "Sem prazo informado"
            }
          />

          <InfoRow
            icon={MessageSquareText}
            label="Participação"
            value={
              pesquisa.permite_anonima
                ? "Permite resposta anônima"
                : "Resposta identificada"
            }
          />
        </div>

        <div className="mt-5 flex flex-1 items-end">
          <button
            type="button"
            onClick={onAbrir}
            disabled={jaRespondida}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition focus:outline-none focus:ring-2",
              jaRespondida
                ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
            )}
          >
            {jaRespondida ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Já respondida
              </>
            ) : pesquisa.tipo === "externa" ? (
              <>
                <ExternalLink className="h-4 w-4" />
                Acessar pesquisa
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Responder
              </>
            )}
          </button>
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
          <Skeleton height={144} />
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

/* =========================================================================
   Modal de resposta
=========================================================================== */

function ResponderPesquisaModal({ pesquisa, onClose, onRespondida }) {
  const [form, setForm] = useState(() => respostaInicial(pesquisa?.perguntas));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    if (!pesquisa) return undefined;

    setForm(respostaInicial(pesquisa.perguntas || []));
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
  }, [pesquisa, onClose, salvando]);

  if (!pesquisa) return null;

  function setAnonima(value) {
    setForm((current) => ({
      ...current,
      anonima: value,
    }));
  }

  function setResposta(perguntaId, value) {
    setForm((current) => ({
      ...current,
      itens: {
        ...current.itens,
        [perguntaId]: value,
      },
    }));
  }

  function toggleMultipla(perguntaId, opcaoId) {
    setForm((current) => {
      const atual = Array.isArray(current.itens?.[perguntaId])
        ? current.itens[perguntaId]
        : [];

      const next = atual.includes(opcaoId)
        ? atual.filter((item) => item !== opcaoId)
        : [...atual, opcaoId];

      return {
        ...current,
        itens: {
          ...current.itens,
          [perguntaId]: next,
        },
      };
    });
  }

  function validar() {
    const perguntas = pesquisa.perguntas || [];

    for (const pergunta of perguntas) {
      const value = form.itens?.[pergunta.id];

      if (!pergunta.obrigatoria) continue;

      if (pergunta.tipo === "multipla_escolha") {
        if (!Array.isArray(value) || value.length === 0) {
          return `A pergunta "${pergunta.enunciado}" é obrigatória.`;
        }
      } else if (value === null || value === undefined || value === "") {
        return `A pergunta "${pergunta.enunciado}" é obrigatória.`;
      }
    }

    for (const pergunta of perguntas) {
      const value = form.itens?.[pergunta.id];

      if (perguntaAceitaTexto(pergunta.tipo) && value) {
        const text = cleanStr(value);

        if (
          pergunta.limite_caracteres &&
          text.length > Number(pergunta.limite_caracteres)
        ) {
          return `A resposta de "${pergunta.enunciado}" excede o limite de caracteres.`;
        }
      }

      if (perguntaAceitaNumero(pergunta.tipo) && value) {
        const numero = Number(value);

        if (!Number.isInteger(numero) || numero < 1 || numero > 5) {
          return `Informe uma nota de 1 a 5 para "${pergunta.enunciado}".`;
        }
      }
    }

    return null;
  }

  function montarPayload() {
    const itens = [];

    for (const pergunta of pesquisa.perguntas || []) {
      const value = form.itens?.[pergunta.id];

      if (pergunta.tipo === "opcao_unica") {
        if (value) {
          itens.push({
            pergunta_id: Number(pergunta.id),
            opcao_id: Number(value),
          });
        }

        continue;
      }

      if (pergunta.tipo === "multipla_escolha") {
        const selecionadas = Array.isArray(value) ? value : [];

        for (const opcaoId of selecionadas) {
          itens.push({
            pergunta_id: Number(pergunta.id),
            opcao_id: Number(opcaoId),
          });
        }

        continue;
      }

      if (perguntaAceitaTexto(pergunta.tipo)) {
        if (cleanStr(value)) {
          itens.push({
            pergunta_id: Number(pergunta.id),
            resposta_texto: cleanStr(value),
          });
        }

        continue;
      }

      if (perguntaAceitaNumero(pergunta.tipo)) {
        if (value !== "" && value !== null && value !== undefined) {
          itens.push({
            pergunta_id: Number(pergunta.id),
            resposta_numero: Number(value),
          });
        }
      }
    }

    return {
      anonima: Boolean(form.anonima),
      itens,
    };
  }

  async function enviar(event) {
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
    setA11y("Enviando resposta da pesquisa.");

    try {
      const payload = montarPayload();

      await api.pesquisa.responder(pesquisa.id, payload);

      setA11y("Resposta enviada com sucesso.");
      onRespondida?.(pesquisa.id);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível enviar sua resposta."
      );

      setErro(message);
      setA11y(message);
    } finally {
      setSalvando(false);
    }
  }

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
        aria-labelledby="modal-responder-pesquisa-title"
        aria-describedby="modal-responder-pesquisa-desc"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.22),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                Pesquisa
              </div>

              <h2
                id="modal-responder-pesquisa-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                <FileQuestion className="h-5 w-5" />
                {pesquisa.titulo}
              </h2>

              <p
                id="modal-responder-pesquisa-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                {pesquisa.descricao || "Responda às perguntas abaixo."}
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
          onSubmit={enviar}
          className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6"
        >
          {erro ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{erro}</span>
              </div>
            </div>
          ) : null}

          {pesquisa.permite_anonima ? (
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.anonima}
                onChange={(event) => setAnonima(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                disabled={salvando}
              />

              <span>
                Responder de forma anônima
                <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                  Ao marcar esta opção, sua resposta não será exibida com seu
                  nome na visualização administrativa.
                </span>
              </span>
            </label>
          ) : null}

          {(pesquisa.perguntas || []).map((pergunta, index) => (
            <PerguntaResposta
              key={pergunta.id}
              pergunta={pergunta}
              index={index}
              value={form.itens?.[pergunta.id]}
              disabled={salvando}
              inputRef={index === 0 ? firstRef : null}
              onChange={(value) => setResposta(pergunta.id, value)}
              onToggle={(opcaoId) => toggleMultipla(pergunta.id, opcaoId)}
            />
          ))}
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Campos obrigatórios devem ser respondidos antes do envio.
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
              onClick={enviar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar resposta
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PerguntaResposta({
  pergunta,
  index,
  value,
  disabled,
  inputRef,
  onChange,
  onToggle,
}) {
  const idBase = `pesquisa-pergunta-${pergunta.id}`;

  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <legend className="mb-3 block w-full">
        <span className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
          Pergunta {index + 1} · {tipoPerguntaLabel(pergunta.tipo)}
        </span>

        <span className="mt-1 block text-base font-black text-slate-900 dark:text-white">
          {pergunta.enunciado}
          {pergunta.obrigatoria ? (
            <span className="ml-1 text-rose-500">*</span>
          ) : null}
        </span>
      </legend>

      {pergunta.tipo === "opcao_unica" ? (
        <div className="space-y-2">
          {(pergunta.opcoes || []).map((opcao, opcaoIndex) => (
            <label
              key={opcao.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <input
                ref={opcaoIndex === 0 ? inputRef : null}
                type="radio"
                name={idBase}
                value={opcao.id}
                checked={String(value || "") === String(opcao.id)}
                onChange={() => onChange(opcao.id)}
                disabled={disabled}
                className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              {opcao.texto}
            </label>
          ))}
        </div>
      ) : null}

      {pergunta.tipo === "multipla_escolha" ? (
        <div className="space-y-2">
          {(pergunta.opcoes || []).map((opcao, opcaoIndex) => {
            const checked = Array.isArray(value) && value.includes(opcao.id);

            return (
              <label
                key={opcao.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <input
                  ref={opcaoIndex === 0 ? inputRef : null}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opcao.id)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                {opcao.texto}
              </label>
            );
          })}
        </div>
      ) : null}

      {pergunta.tipo === "texto_curto" ? (
        <input
          ref={inputRef}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          maxLength={pergunta.limite_caracteres || undefined}
          disabled={disabled}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
          placeholder="Digite sua resposta..."
        />
      ) : null}

      {pergunta.tipo === "texto_longo" ? (
        <textarea
          ref={inputRef}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          maxLength={pergunta.limite_caracteres || undefined}
          disabled={disabled}
          rows={5}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
          placeholder="Digite sua resposta..."
        />
      ) : null}

      {pergunta.tipo === "escala" ? (
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((numero) => (
            <button
              key={numero}
              ref={numero === 1 ? inputRef : null}
              type="button"
              onClick={() => onChange(numero)}
              disabled={disabled}
              className={cx(
                "rounded-2xl border px-3 py-3 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60",
                Number(value) === numero
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              )}
              aria-pressed={Number(value) === numero}
            >
              {numero}
            </button>
          ))}
        </div>
      ) : null}

      {pergunta.limite_caracteres && perguntaAceitaTexto(pergunta.tipo) ? (
        <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
          {String(value || "").length}/{pergunta.limite_caracteres}
        </p>
      ) : null}
    </fieldset>
  );
}