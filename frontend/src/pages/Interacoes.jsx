// ✅ frontend/src/pages/Interacoes.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página única do usuário para Interações.
//
// Tipos oficiais:
// - votacao
// - quiz
// - nuvem_palavras
//
// Contratos oficiais usados:
// - GET  /api/interacao/publicada
// - GET  /api/interacao/:id
// - POST /api/interacao/:id/responder
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota /votacao antiga;
// - sem chamada direta para /api;
// - facade oficial: api.interacao;
// - mobile-first;
// - acessível;
// - dark mode;
// - estados loading/vazio/erro;
// - geolocalização opcional quando exigida pela interação.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Crosshair,
  FileQuestion,
  Layers3,
  Loader2,
  MapPin,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Vote,
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

const TIPO = {
  votacao: "votacao",
  quiz: "quiz",
  nuvem_palavras: "nuvem_palavras",
};

const TIPO_LABEL = {
  votacao: "Votação",
  quiz: "Quiz",
  nuvem_palavras: "Nuvem de palavras",
};

const CONTEXTO_LABEL = {
  geral: "Geral",
  evento: "Evento",
  turma: "Turma",
};

const STORAGE_KEY = "escola:v2:interacoes:filtros";

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

function brDate(value) {
  if (!value) return "—";

  try {
    const [ano, mes, dia] = String(value).slice(0, 10).split("-");
    if (!ano || !mes || !dia) return "—";
    return `${dia}/${mes}/${ano}`;
  } catch {
    return "—";
  }
}

function brTime(value) {
  if (!value) return "—";
  return String(value).slice(0, 5);
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

function tipoInfo(tipo) {
  const value = String(tipo || "");

  const map = {
    votacao: {
      label: "Votação",
      icon: Vote,
      card: "from-emerald-700 via-teal-700 to-cyan-700",
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    quiz: {
      label: "Quiz",
      icon: Trophy,
      card: "from-indigo-700 via-violet-700 to-fuchsia-700",
      badge:
        "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200",
    },
    nuvem_palavras: {
      label: "Nuvem de palavras",
      icon: Cloud,
      card: "from-sky-700 via-cyan-700 to-emerald-700",
      badge:
        "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
    },
  };

  return map[value] || map.votacao;
}

function contextoLabel(value) {
  return CONTEXTO_LABEL[value] || value || "Contexto";
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function obterPerguntaAtiva(interacao) {
  const perguntas = Array.isArray(interacao?.perguntas) ? interacao.perguntas : [];

  if (interacao?.tipo === TIPO.quiz) {
    const atualId = Number(interacao?.pergunta_atual_id);

    if (atualId) {
      const atual = perguntas.find((item) => Number(item.id) === atualId);
      if (atual) return atual;
    }

    return (
      perguntas.find((item) => item.status === "aberta") ||
      perguntas[0] ||
      null
    );
  }

  return perguntas[0] || null;
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "Este navegador não permite obter localização. Não foi possível validar sua presença na área autorizada."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude_usuario: position.coords.latitude,
          longitude_usuario: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        reject(
          new Error(
            "Não foi possível obter sua localização. Autorize a localização do navegador e tente novamente."
          )
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  });
}

/* =========================================================================
   Página
=========================================================================== */

export default function Interacoes() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);

  const [interacoes, setInteracoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroTipo, setFiltroTipo] = useState(persisted.filtroTipo || "");
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalInteracao, setModalInteracao] = useState(null);
  const [carregandoInteracao, setCarregandoInteracao] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Interações | Escola da Saúde";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroTipo,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a tela.
    }
  }, [filtroTipo, busca]);

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
    setLive("Carregando interações.");

    try {
      const response = await api.interacao.listarPublicadas();
      const data = unwrapArray(response);

      setInteracoes(data);
      setLive(`Interações carregadas: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as interações."
      );

      setErro(message);
      setLive("Falha ao carregar interações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const interacoesFiltradas = useMemo(() => {
    const query = norm(buscaDebounced);

    return interacoes.filter((interacao) => {
      if (filtroTipo && interacao.tipo !== filtroTipo) return false;

      if (query) {
        const haystack = norm(
          [
            interacao.titulo,
            interacao.descricao,
            interacao.tipo,
            interacao.tipo_label,
            interacao.contexto,
            interacao.contexto_label,
            interacao.evento_titulo,
            interacao.turma_nome,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [interacoes, filtroTipo, buscaDebounced]);

  const kpis = useMemo(() => {
    const base = {
      total: interacoes.length,
      votacao: 0,
      quiz: 0,
      nuvem: 0,
      respondidas: 0,
    };

    for (const interacao of interacoes) {
      if (interacao.tipo === TIPO.votacao) base.votacao += 1;
      if (interacao.tipo === TIPO.quiz) base.quiz += 1;
      if (interacao.tipo === TIPO.nuvem_palavras) base.nuvem += 1;
      if (interacao.respondida) base.respondidas += 1;
    }

    return base;
  }, [interacoes]);

  function limparFiltros() {
    setFiltroTipo("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  async function abrirInteracao(interacao) {
    setErro("");
    setMensagem("");
    setCarregandoInteracao(true);
    setLive("Carregando interação.");

    try {
      const response = await api.interacao.obter(interacao.id);
      const completa = unwrapData(response);

      if (completa?.respondida && completa?.uma_resposta_por_usuario) {
        setMensagem("Você já respondeu esta interação.");
        setInteracoes((current) =>
          current.map((item) =>
            String(item.id) === String(interacao.id)
              ? { ...item, respondida: true }
              : item
          )
        );
        return;
      }

      setModalInteracao(completa);
      setLive("Interação carregada.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a interação."
      );

      setErro(message);
      setLive("Falha ao carregar interação.");
    } finally {
      setCarregandoInteracao(false);
    }
  }

  function handleRespondida(interacaoId, respostaTipo) {
    setInteracoes((current) =>
      current.map((item) =>
        String(item.id) === String(interacaoId)
          ? {
              ...item,
              respondida:
                item.tipo === TIPO.quiz ? item.respondida : true,
              total_respostas: Number(item.total_respostas || 0) + 1,
            }
          : item
      )
    );

    setModalInteracao(null);

    if (respostaTipo === TIPO.quiz) {
      setMensagem("Resposta enviada com sucesso.");
    } else {
      setMensagem("Participação registrada com sucesso. Obrigado!");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <ResponderInteracaoModal
        interacao={modalInteracao}
        onClose={() => setModalInteracao(null)}
        onRespondida={handleRespondida}
      />

      <HeaderHero
  icone={Sparkles}
  etiqueta="Interações"
  titulo="Participe das interações ao vivo"
  subtitulo="Vote, responda quizzes e participe de nuvens de palavras em ações institucionais da Escola da Saúde."
/>

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
  <section className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Interações disponíveis
        </h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Participe de votações, quizzes ao vivo e nuvens de palavras publicadas pela Escola da Saúde.
        </p>
      </div>

      <button
        type="button"
        onClick={carregarDados}
        disabled={carregando || carregandoInteracao}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:pointer-events-none disabled:opacity-60"
      >
        <RefreshCcw
          className={cx(
            "h-4 w-4",
            (carregando || carregandoInteracao) && "animate-spin"
          )}
        />

        {carregando || carregandoInteracao
          ? "Atualizando..."
          : "Atualizar"}
      </button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MiniStat label="Total" value={kpis.total} icon={FileQuestion} />
      <MiniStat label="Votações" value={kpis.votacao} icon={Vote} />
      <MiniStat label="Quiz" value={kpis.quiz} icon={Trophy} />
      <MiniStat label="Nuvens" value={kpis.nuvem} icon={Cloud} />
    </div>
  </section>

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
                <Sparkles className="h-5 w-5 text-emerald-600" />
                Interações disponíveis
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Participe de votações, quizzes ao vivo e nuvens de palavras
                publicadas pela Escola da Saúde.
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

          <div className="grid gap-3 md:grid-cols-[280px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Tipo
              </span>

              <select
                value={filtroTipo}
                onChange={(event) => setFiltroTipo(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Todos</option>
                <option value="votacao">Votação</option>
                <option value="quiz">Quiz</option>
                <option value="nuvem_palavras">Nuvem de palavras</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Busca
              </span>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Título, descrição, evento, turma..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                  aria-label="Buscar interações"
                />

                {busca ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBusca("");
                      setBuscaDebounced("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Interações visíveis:{" "}
            <strong className="font-black text-slate-900 dark:text-white">
              {interacoesFiltradas.length}
            </strong>
          </p>
        </section>

        <section aria-label="Lista de interações">
          {carregando ? (
            <LoadingGrid />
          ) : interacoesFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma interação disponível"
              descricao="Quando houver votação, quiz ou nuvem de palavras publicada, aparecerá aqui."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {interacoesFiltradas.map((interacao) => (
                <InteracaoCard
                  key={interacao.id}
                  interacao={interacao}
                  reduceMotion={reduceMotion}
                  onAbrir={() => abrirInteracao(interacao)}
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

function InteracaoCard({ interacao, reduceMotion, onAbrir }) {
  const info = tipoInfo(interacao.tipo);
  const Icon = info.icon;

  const respondida =
    Boolean(interacao.respondida) &&
    Boolean(interacao.uma_resposta_por_usuario) &&
    interacao.tipo !== TIPO.quiz;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group relative flex min-h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20"
    >
      <div
        className={cx(
          "relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br text-white",
          info.card
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.20),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,.14),transparent_30%)]" />
        <Icon className="relative h-14 w-14 opacity-90" />

        {interacao.exige_geolocalizacao ? (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
            <MapPin className="h-3.5 w-3.5" />
            Localização
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black",
              info.badge
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {interacao.tipo_label || info.label}
          </span>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {interacao.contexto_label || contextoLabel(interacao.contexto)}
          </span>

          {respondida ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Respondida
            </span>
          ) : null}
        </div>

        <h3 className="mt-4 text-lg font-black leading-tight text-slate-900 dark:text-white">
          {interacao.titulo}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {interacao.descricao || "Interação disponível para participação."}
        </p>

        <div className="mt-4 grid gap-2 text-sm">
          <InfoRow
            icon={Layers3}
            label="Contexto"
            value={
              interacao.evento_titulo ||
              interacao.turma_nome ||
              contextoLabel(interacao.contexto)
            }
          />

          <InfoRow
            icon={Clock}
            label="Status"
            value={interacao.status_label || interacao.status || "Disponível"}
          />

          <InfoRow
            icon={MessageSquareText}
            label="Respostas"
            value={String(interacao.total_respostas || 0)}
          />
        </div>

        <div className="mt-5 flex flex-1 items-end">
          <button
            type="button"
            onClick={onAbrir}
            disabled={respondida}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition focus:outline-none focus:ring-2",
              respondida
                ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
            )}
          >
            {respondida ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Já respondida
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Participar
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

function ResponderInteracaoModal({ interacao, onClose, onRespondida }) {
  const [valor, setValor] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");
  const startedAtRef = useRef(null);
  const firstRef = useRef(null);

  const pergunta = useMemo(() => obterPerguntaAtiva(interacao), [interacao]);
  const info = tipoInfo(interacao?.tipo);

  useEffect(() => {
    if (!interacao) return undefined;

    setValor("");
    setAnonima(false);
    setErro("");
    setA11y("");
    setSalvando(false);
    startedAtRef.current = Date.now();

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
  }, [interacao, onClose, salvando]);

  if (!interacao) return null;

  const Icon = info.icon;

  function validar() {
    if (!pergunta?.id) {
      return "Esta interação ainda não possui pergunta disponível.";
    }

    if (interacao.tipo === TIPO.quiz && pergunta.status !== "aberta") {
      return "Esta pergunta ainda não está aberta para resposta.";
    }

    if (interacao.tipo === TIPO.votacao || interacao.tipo === TIPO.quiz) {
      if (!valor) return "Selecione uma opção para enviar.";
    }

    if (interacao.tipo === TIPO.nuvem_palavras) {
      const texto = cleanStr(valor);

      if (!texto) return "Digite uma palavra para enviar.";

      const limite = Number(interacao.limite_palavra_caracteres || 40);

      if (texto.length > limite) {
        return `A palavra deve ter no máximo ${limite} caracteres.`;
      }
    }

    return null;
  }

  async function montarPayload() {
    const payload = {
      pergunta_id: Number(pergunta.id),
      anonima: Boolean(anonima && interacao.permite_anonima),
    };

    if (interacao.tipo === TIPO.votacao || interacao.tipo === TIPO.quiz) {
      payload.opcao_id = Number(valor);
    }

    if (interacao.tipo === TIPO.nuvem_palavras) {
      payload.resposta_texto = cleanStr(valor);
    }

    if (interacao.tipo === TIPO.quiz) {
      payload.tempo_resposta_ms = Math.max(
        0,
        Date.now() - Number(startedAtRef.current || Date.now())
      );
    }

    if (interacao.exige_geolocalizacao) {
      const geo = await getGeolocation();
      payload.latitude_usuario = geo.latitude_usuario;
      payload.longitude_usuario = geo.longitude_usuario;
      payload.metadata = {
        ...(payload.metadata || {}),
        geolocation_accuracy: geo.accuracy,
      };
    }

    return payload;
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
    setA11y("Enviando resposta.");

    try {
      const payload = await montarPayload();

      await api.interacao.responder(interacao.id, payload);

      setA11y("Resposta enviada com sucesso.");
      onRespondida?.(interacao.id, interacao.tipo);
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
        aria-labelledby="modal-interacao-title"
        aria-describedby="modal-interacao-desc"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <header
          className={cx(
            "relative overflow-hidden border-b border-white/10 bg-gradient-to-br p-5 text-white sm:p-6",
            info.card
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.20),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,.16),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Icon className="h-3.5 w-3.5 text-white" />
                {interacao.tipo_label || info.label}
              </div>

              <h2
                id="modal-interacao-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                {interacao.titulo}
              </h2>

              <p
                id="modal-interacao-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85"
              >
                {interacao.descricao || "Responda à interação abaixo."}
              </p>

              {interacao.exige_geolocalizacao ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/90">
                  <Crosshair className="h-3.5 w-3.5" />
                  Esta interação exige validação de localização.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-60"
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
            <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {pergunta?.status
                  ? `Status: ${pergunta.status}`
                  : "Pergunta disponível"}
              </span>

              {interacao.tipo === TIPO.quiz && pergunta?.tempo_segundos ? (
                <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                  Tempo: {pergunta.tempo_segundos}s
                </span>
              ) : null}
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {pergunta?.enunciado || "Pergunta indisponível"}
            </h3>

            {interacao.tipo === TIPO.votacao || interacao.tipo === TIPO.quiz ? (
              <div className="mt-5 space-y-2">
                {(pergunta?.opcoes || []).map((opcao, index) => (
                  <label
                    key={opcao.id}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-semibold transition",
                      String(valor) === String(opcao.id)
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-100"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800"
                    )}
                  >
                    <input
                      ref={index === 0 ? firstRef : null}
                      type="radio"
                      name={`interacao-${interacao.id}-pergunta-${pergunta?.id}`}
                      value={opcao.id}
                      checked={String(valor) === String(opcao.id)}
                      onChange={() => setValor(String(opcao.id))}
                      disabled={salvando}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {opcao.texto}
                  </label>
                ))}
              </div>
            ) : null}

            {interacao.tipo === TIPO.nuvem_palavras ? (
              <div className="mt-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Sua palavra
                  </span>

                  <input
                    ref={firstRef}
                    value={valor}
                    onChange={(event) => setValor(event.target.value)}
                    maxLength={Number(interacao.limite_palavra_caracteres || 40)}
                    disabled={salvando}
                    placeholder="Ex.: motivado"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
                  />
                </label>

                <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
                  {valor.length}/{Number(interacao.limite_palavra_caracteres || 40)}
                </p>
              </div>
            ) : null}
          </section>

          {interacao.permite_anonima ? (
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <input
                type="checkbox"
                checked={anonima}
                onChange={(event) => setAnonima(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                disabled={salvando}
              />

              <span>
                Responder de forma anônima
                <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                  Quando permitido, sua resposta não será exibida com seu nome
                  na visualização administrativa.
                </span>
              </span>
            </label>
          ) : null}

          {Array.isArray(interacao.janelas) && interacao.janelas.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Janelas de participação
              </h4>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {interacao.janelas.map((janela) => (
                  <div
                    key={`${janela.data}-${janela.horario_inicio}-${janela.horario_fim}`}
                    className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
                  >
                    <strong>{brDate(janela.data)}</strong>{" "}
                    {brTime(janela.horario_inicio)} às{" "}
                    {brTime(janela.horario_fim)}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {interacao.exige_geolocalizacao
              ? "Ao enviar, a plataforma solicitará sua localização para validar a área autorizada."
              : "Confira sua resposta antes de enviar."}
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