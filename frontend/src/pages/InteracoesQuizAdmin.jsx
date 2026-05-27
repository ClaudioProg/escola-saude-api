// ✅ frontend/src/pages/InteracoesQuizAdmin.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página administrativa de Quiz do módulo Interações.
//
// Tipo oficial:
// - quiz
//
// Contratos oficiais usados:
// - GET    /api/interacao/admin?tipo=quiz
// - POST   /api/interacao/admin
// - GET    /api/interacao/admin/:id
// - PUT    /api/interacao/admin/:id
// - PATCH  /api/interacao/admin/:id/status
// - DELETE /api/interacao/admin/:id
// - POST   /api/interacao/admin/:id/execucao/iniciar
// - POST   /api/interacao/admin/:id/pergunta/abrir
// - POST   /api/interacao/admin/:id/pergunta/fechar
// - POST   /api/interacao/admin/:id/pergunta/gabarito
// - GET    /api/interacao/admin/:id/resultado
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota /votacao antiga;
// - sem chamada direta para /api;
// - facade oficial: api.interacao;
// - quiz com perguntas de múltipla escolha;
// - cada pergunta exige ao menos uma opção correta;
// - controle ao vivo por pergunta;
// - ranking com primeiro e segundo nome vindo do backend;
// - mobile-first;
// - acessível;
// - dark mode;
// - estados loading/vazio/erro.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  FileQuestion,
  Filter,
  Layers3,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Target,
  Trash2,
  Trophy,
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

const TIPO_QUIZ = "quiz";

const STATUS_OFICIAL = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicada", label: "Publicada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const CONTEXTOS_OFICIAIS = [
  { value: "geral", label: "Geral" },
  { value: "evento", label: "Evento" },
  { value: "turma", label: "Turma" },
];

const FORM_INICIAL = {
  titulo: "",
  descricao: "",
  status: "rascunho",
  contexto: "geral",
  evento_id: "",
  turma_id: "",

  exige_inscricao_ou_presenca: false,
  permite_anonima: false,
  uma_resposta_por_usuario: false,
  mostrar_resultado_usuario: false,
  mostrar_resultado_admin: true,
  exibir_ranking: true,

  tempo_por_pergunta_segundos: "60",
  mostrar_gabarito: true,
  embaralhar_opcoes: false,
  tentativas_max: "",
  nota_minima: "",

  perguntas: [criarPerguntaVazia(0)],
};

const STORAGE_KEY = "escola:v2:interacoes-quiz-admin:filtros";

/* =========================================================================
   Helpers
=========================================================================== */

function cryptoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function criarOpcaoVazia(ordem = 0) {
  return {
    local_id: cryptoId(),
    texto: "",
    ordem,
    correta: false,
  };
}

function criarPerguntaVazia(ordem = 0) {
  return {
    local_id: cryptoId(),
    enunciado: "",
    ordem,
    obrigatoria: true,
    peso: 1,
    tempo_segundos: "60",
    feedback_correto: "",
    feedback_incorreto: "",
    opcoes: [
      criarOpcaoVazia(0),
      criarOpcaoVazia(1),
      criarOpcaoVazia(2),
      criarOpcaoVazia(3),
    ],
  };
}

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

function cleanStr(value) {
  return String(value ?? "").trim();
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
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

function statusInfo(status) {
  const value = String(status || "").toLowerCase();

  const map = {
    rascunho: { label: "Rascunho", tone: "amber" },
    publicada: { label: "Publicada", tone: "emerald" },
    em_andamento: { label: "Em andamento", tone: "violet" },
    encerrada: { label: "Encerrada", tone: "blue" },
    arquivada: { label: "Arquivada", tone: "slate" },
  };

  return map[value] || { label: value || "Sem status", tone: "slate" };
}

function contextoLabel(value) {
  const map = {
    geral: "Geral",
    evento: "Evento",
    turma: "Turma",
  };

  return map[value] || value || "Contexto";
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeFormFromInteracao(interacao) {
  if (!interacao) return FORM_INICIAL;

  return {
    titulo: interacao.titulo || "",
    descricao: interacao.descricao || "",
    status: interacao.status || "rascunho",
    contexto: interacao.contexto || "geral",
    evento_id:
      interacao.evento_id !== null && interacao.evento_id !== undefined
        ? String(interacao.evento_id)
        : "",
    turma_id:
      interacao.turma_id !== null && interacao.turma_id !== undefined
        ? String(interacao.turma_id)
        : "",

    exige_inscricao_ou_presenca: Boolean(interacao.exige_inscricao_ou_presenca),
    permite_anonima: Boolean(interacao.permite_anonima),
    uma_resposta_por_usuario: Boolean(interacao.uma_resposta_por_usuario),
    mostrar_resultado_usuario: Boolean(interacao.mostrar_resultado_usuario),
    mostrar_resultado_admin: interacao.mostrar_resultado_admin !== false,
    exibir_ranking: interacao.exibir_ranking !== false,

    tempo_por_pergunta_segundos:
      interacao.tempo_por_pergunta_segundos !== null &&
      interacao.tempo_por_pergunta_segundos !== undefined
        ? String(interacao.tempo_por_pergunta_segundos)
        : "60",
    mostrar_gabarito: interacao.mostrar_gabarito !== false,
    embaralhar_opcoes: Boolean(interacao.embaralhar_opcoes),
    tentativas_max:
      interacao.tentativas_max !== null &&
      interacao.tentativas_max !== undefined
        ? String(interacao.tentativas_max)
        : "",
    nota_minima:
      interacao.nota_minima !== null && interacao.nota_minima !== undefined
        ? String(interacao.nota_minima)
        : "",

    perguntas:
      Array.isArray(interacao.perguntas) && interacao.perguntas.length > 0
        ? interacao.perguntas.map((pergunta, perguntaIndex) => ({
            local_id: String(pergunta.id || cryptoId()),
            id: pergunta.id,
            enunciado: pergunta.enunciado || "",
            ordem:
              pergunta.ordem !== null && pergunta.ordem !== undefined
                ? Number(pergunta.ordem)
                : perguntaIndex,
            obrigatoria: pergunta.obrigatoria !== false,
            peso:
              pergunta.peso !== null && pergunta.peso !== undefined
                ? Number(pergunta.peso)
                : 1,
            tempo_segundos:
              pergunta.tempo_segundos !== null &&
              pergunta.tempo_segundos !== undefined
                ? String(pergunta.tempo_segundos)
                : "60",
            feedback_correto: pergunta.feedback_correto || "",
            feedback_incorreto: pergunta.feedback_incorreto || "",
            status: pergunta.status || "aguardando",
            opcoes:
              Array.isArray(pergunta.opcoes) && pergunta.opcoes.length > 0
                ? pergunta.opcoes.map((opcao, opcaoIndex) => ({
                    local_id: String(opcao.id || cryptoId()),
                    id: opcao.id,
                    texto: opcao.texto || "",
                    ordem:
                      opcao.ordem !== null && opcao.ordem !== undefined
                        ? Number(opcao.ordem)
                        : opcaoIndex,
                    correta: Boolean(opcao.correta),
                  }))
                : [
                    criarOpcaoVazia(0),
                    criarOpcaoVazia(1),
                    criarOpcaoVazia(2),
                    criarOpcaoVazia(3),
                  ],
          }))
        : [criarPerguntaVazia(0)],
  };
}

/* =========================================================================
   Página
=========================================================================== */

export default function InteracoesQuizAdmin() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);
  const persisted = useMemo(() => readPersistedFilters(), []);

  const [interacoes, setInteracoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroStatus, setFiltroStatus] = useState(
    persisted.filtroStatus || ""
  );
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalAberto, setModalAberto] = useState(false);
  const [interacaoEmEdicao, setInteracaoEmEdicao] = useState(null);

  const [confirmacao, setConfirmacao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [alterandoStatusId, setAlterandoStatusId] = useState(null);
  const [acaoAoVivo, setAcaoAoVivo] = useState("");

  const [resultadoPainel, setResultadoPainel] = useState(null);
  const [carregandoResultado, setCarregandoResultado] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Quiz | Interações";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroStatus,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página.
    }
  }, [filtroStatus, busca]);

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
    setLive("Carregando quizzes.");

    try {
      const response = await api.interacao.listarAdmin({
        tipo: TIPO_QUIZ,
      });

      const data = unwrapArray(response);
      setInteracoes(data);
      setLive(`Quizzes carregados: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar os quizzes."
      );

      setErro(message);
      setLive("Falha ao carregar quizzes.");
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
      if (filtroStatus && interacao.status !== filtroStatus) return false;

      if (query) {
        const haystack = norm(
          [
            interacao.titulo,
            interacao.descricao,
            interacao.status,
            interacao.status_label,
            interacao.contexto,
            interacao.contexto_label,
            interacao.evento_titulo,
            interacao.turma_nome,
            interacao.criado_por_nome,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [interacoes, filtroStatus, buscaDebounced]);

  const kpis = useMemo(() => {
    const base = {
      total: interacoes.length,
      publicada: 0,
      andamento: 0,
      encerrada: 0,
      respostas: 0,
    };

    for (const interacao of interacoes) {
      if (interacao.status === "publicada") base.publicada += 1;
      if (interacao.status === "em_andamento") base.andamento += 1;
      if (interacao.status === "encerrada") base.encerrada += 1;

      base.respostas += Number(interacao.total_respostas || 0);
    }

    return base;
  }, [interacoes]);

  function limparFiltros() {
    setFiltroStatus("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function abrirCriacao() {
    setInteracaoEmEdicao(null);
    setModalAberto(true);
  }

  async function abrirEdicao(interacao) {
    setErro("");
    setMensagem("");
    setLive("Carregando quiz para edição.");

    try {
      const response = await api.interacao.obterAdmin(interacao.id);
      setInteracaoEmEdicao(unwrapData(response));
      setModalAberto(true);
      setLive("Quiz carregado para edição.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar o quiz para edição."
      );

      setErro(message);
      setLive("Falha ao carregar quiz para edição.");
    }
  }
    async function alterarStatus(interacao, status) {
    if (!interacao?.id || !status || interacao.status === status) return;

    setAlterandoStatusId(interacao.id);
    setErro("");
    setMensagem("");
    setLive("Alterando status do quiz.");

    try {
      const response = await api.interacao.alterarStatus(interacao.id, status);
      const atualizada = unwrapData(response);

      setInteracoes((current) =>
        current.map((item) =>
          String(item.id) === String(interacao.id)
            ? {
                ...item,
                ...(atualizada && typeof atualizada === "object"
                  ? atualizada
                  : {}),
                status,
              }
            : item
        )
      );

      setMensagem("Status do quiz atualizado com sucesso.");
      setLive("Status do quiz atualizado com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível alterar o status do quiz."
      );

      setErro(message);
      setLive("Falha ao alterar status do quiz.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  async function abrirResultado(interacao) {
    setCarregandoResultado(true);
    setResultadoPainel({
      interacao,
      completo: null,
      resultado: null,
      erro: "",
    });
    setLive("Carregando ranking do quiz.");

    try {
      const [completoResponse, resultadoResponse] = await Promise.all([
        api.interacao.obterAdmin(interacao.id),
        api.interacao.resultado(interacao.id),
      ]);

      setResultadoPainel({
        interacao,
        completo: unwrapData(completoResponse),
        resultado: unwrapData(resultadoResponse),
        erro: "",
      });

      setLive("Ranking do quiz carregado.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar o ranking do quiz."
      );

      setResultadoPainel({
        interacao,
        completo: null,
        resultado: null,
        erro: message,
      });

      setLive("Falha ao carregar ranking do quiz.");
    } finally {
      setCarregandoResultado(false);
    }
  }

  async function executarAcaoAoVivo(tipo, interacaoId, perguntaId = null) {
    if (!interacaoId) return;

    const chave = `${tipo}-${interacaoId}-${perguntaId || "execucao"}`;
    setAcaoAoVivo(chave);
    setErro("");
    setMensagem("");

    try {
      if (tipo === "iniciar") {
  await api.interacao.iniciarExecucao(interacaoId);

  const completoResponse = await api.interacao.obterAdmin(interacaoId);
  const completo = unwrapData(completoResponse);

  const primeiraPergunta = Array.isArray(completo?.perguntas)
    ? completo.perguntas.find((pergunta) => pergunta?.id)
    : null;

  if (primeiraPergunta?.id) {
    await api.interacao.abrirPergunta(interacaoId, primeiraPergunta.id);
  }
}

      if (tipo === "abrir") {
        await api.interacao.abrirPergunta(interacaoId, perguntaId);
      }

      if (tipo === "fechar") {
        await api.interacao.fecharPergunta(interacaoId, perguntaId);
      }

      if (tipo === "gabarito") {
        await api.interacao.exibirGabarito(interacaoId, perguntaId);
      }

      setMensagem("Ação ao vivo executada com sucesso.");

      if (resultadoPainel?.interacao?.id === interacaoId) {
        const [completoResponse, resultadoResponse] = await Promise.all([
          api.interacao.obterAdmin(interacaoId),
          api.interacao.resultado(interacaoId),
        ]);

        setResultadoPainel((current) => ({
          ...current,
          completo: unwrapData(completoResponse),
          resultado: unwrapData(resultadoResponse),
        }));
      }

      await carregarDados();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível executar a ação ao vivo."
      );

      setErro(message);
    } finally {
      setAcaoAoVivo("");
    }
  }

  function pedirExclusao(interacao) {
    setConfirmacao({
      id: interacao.id,
      titulo: interacao.titulo,
    });
  }

  async function confirmarExclusao() {
    if (!confirmacao?.id) return;

    setExcluindo(true);
    setErro("");
    setMensagem("");
    setLive("Excluindo quiz.");

    try {
      await api.interacao.excluir(confirmacao.id);

      setInteracoes((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Quiz excluído com sucesso.");
      setConfirmacao(null);
      setLive("Quiz excluído com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível excluir o quiz."
      );

      setErro(message);
      setLive("Falha ao excluir quiz.");
    } finally {
      setExcluindo(false);
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

      <ResultadoQuizDrawer
        painel={resultadoPainel}
        loading={carregandoResultado}
        acaoAoVivo={acaoAoVivo}
        onClose={() => {
          if (carregandoResultado) return;
          setResultadoPainel(null);
        }}
        onAcao={executarAcaoAoVivo}
      />

      <HeaderHero
  titulo="Quiz ao vivo"
  subtitulo="Publique quizzes, libere perguntas uma a uma, revele gabarito e acompanhe o ranking em tempo real."
  icon={Trophy}
/>

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <MiniStatCard label="Total" value={kpis.total} icon={Trophy} />
    <MiniStatCard label="Publicados" value={kpis.publicada} icon={CheckCircle2} />
    <MiniStatCard label="Ao vivo" value={kpis.andamento} icon={Play} />
    <MiniStatCard label="Respostas" value={kpis.respostas} icon={Target} />
  </div>

  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
    <button
      type="button"
      onClick={abrirCriacao}
      className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-violet-700 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-violet-800"
    >
      <Plus className="h-4 w-4" />
      Novo quiz
    </button>

    <button
      type="button"
      onClick={carregarDados}
      disabled={carregando}
      className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:ring-slate-800"
    >
      <RefreshCcw className={cx("h-4 w-4", carregando && "animate-spin")} />
      {carregando ? "Atualizando..." : "Atualizar"}
    </button>
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
                <Filter className="h-5 w-5 text-violet-600" />
                Gestão de quizzes
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Crie quizzes, libere perguntas ao vivo, exiba gabarito e acompanhe
                o ranking.
              </p>
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[280px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Status
              </span>

              <select
                value={filtroStatus}
                onChange={(event) => setFiltroStatus(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Todos</option>
                {STATUS_OFICIAL.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
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
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950"
                  aria-label="Buscar quizzes"
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
            Quizzes visíveis:{" "}
            <strong className="font-black text-slate-900 dark:text-white">
              {interacoesFiltradas.length}
            </strong>
          </p>
        </section>

        <section aria-label="Lista de quizzes" className="space-y-3">
          {carregando ? (
            <LoadingList />
          ) : interacoesFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhum quiz encontrado"
              descricao="Crie um novo quiz para começar."
            />
          ) : (
            interacoesFiltradas.map((interacao) => (
              <QuizCard
                key={interacao.id}
                interacao={interacao}
                reduceMotion={reduceMotion}
                alterandoStatus={String(alterandoStatusId) === String(interacao.id)}
                acaoAoVivo={acaoAoVivo}
                onEditar={() => abrirEdicao(interacao)}
                onResultado={() => abrirResultado(interacao)}
                onExcluir={() => pedirExclusao(interacao)}
                onAlterarStatus={(status) => alterarStatus(interacao, status)}
                onIniciar={() => executarAcaoAoVivo("iniciar", interacao.id)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalQuiz
        aberto={modalAberto}
        interacao={interacaoEmEdicao}
        onClose={() => {
          setModalAberto(false);
          setInteracaoEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setInteracaoEmEdicao(null);
          carregarDados();
        }}
      />
    </div>
  );
}

/* =========================================================================
   Topo / cards
=========================================================================== */
function MiniStatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-4 text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{Number(value) || 0}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900">
          <Icon className="h-5 w-5" />
        </div>
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

function StatusBadge({ status }) {
  const info = statusInfo(status);

  const tones = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
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
function InfoBox({ icon: Icon, title, value }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mt-0.5 rounded-xl bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p
          className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200"
          title={value}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function QuizCard({
  interacao,
  reduceMotion,
  alterandoStatus,
  acaoAoVivo,
  onEditar,
  onResultado,
  onExcluir,
  onAlterarStatus,
  onIniciar,
}) {
  const iniciando = acaoAoVivo === `iniciar-${interacao.id}-execucao`;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-violet-600" />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {interacao.titulo}
            </h3>

            <StatusBadge status={interacao.status} />

            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
              <Trophy className="h-3.5 w-3.5" />
              Quiz
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {interacao.contexto_label || contextoLabel(interacao.contexto)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {interacao.descricao || "Sem descrição informada."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              icon={Target}
              title="Respostas"
              value={String(interacao.total_respostas || 0)}
            />
            <InfoBox
              icon={Layers3}
              title="Vínculo"
              value={
                interacao.evento_titulo ||
                interacao.turma_nome ||
                contextoLabel(interacao.contexto)
              }
            />
            <InfoBox
              icon={Clock}
              title="Criado em"
              value={brDateTime(interacao.criado_em)}
            />
            <InfoBox
              icon={ShieldCheck}
              title="Regra"
              value={
                interacao.exige_inscricao_ou_presenca
                  ? "Inscrição/presença obrigatória"
                  : "Aberto a usuários logados"
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <button
            type="button"
            onClick={onResultado}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <BarChart3 className="h-4 w-4" />
            Ao vivo / ranking
          </button>

          <button
            type="button"
            onClick={onIniciar}
            disabled={Boolean(acaoAoVivo)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200"
          >
            {iniciando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Iniciar execução
          </button>

          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </button>

          {interacao.status !== "publicada" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("publicada")}
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

          {interacao.status !== "encerrada" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("encerrada")}
              disabled={alterandoStatus}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
            >
              {alterandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )}
              Encerrar
            </button>
          ) : null}

          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      </div>
    </motion.article>
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

/* =========================================================================
   Modal de criação/edição
=========================================================================== */

function ModalQuiz({ aberto, interacao, onClose, onSaved }) {
  const isEdicao = Boolean(interacao?.id);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    setForm(normalizeFormFromInteracao(interacao));
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
  }, [aberto, interacao, onClose, salvando]);

  if (!aberto) return null;

  function setCampo(campo, valor) {
    setForm((current) => {
      const next = {
        ...current,
        [campo]: valor,
      };

      if (campo === "contexto") {
        if (valor === "geral") {
          next.evento_id = "";
          next.turma_id = "";
        }

        if (valor === "evento") {
          next.turma_id = "";
        }

        if (valor === "turma") {
          next.evento_id = "";
        }
      }

      return next;
    });
  }

  function adicionarPergunta() {
    setForm((current) => ({
      ...current,
      perguntas: [
        ...(current.perguntas || []),
        criarPerguntaVazia(current.perguntas?.length || 0),
      ],
    }));
  }

  function removerPergunta(localId) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || [])
        .filter((pergunta) => pergunta.local_id !== localId)
        .map((pergunta, index) => ({
          ...pergunta,
          ordem: index,
        })),
    }));
  }

  function atualizarPergunta(localId, campo, valor) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) =>
        pergunta.local_id === localId ? { ...pergunta, [campo]: valor } : pergunta
      ),
    }));
  }

  function adicionarOpcao(perguntaLocalId) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) => {
        if (pergunta.local_id !== perguntaLocalId) return pergunta;

        return {
          ...pergunta,
          opcoes: [
            ...(pergunta.opcoes || []),
            criarOpcaoVazia(pergunta.opcoes?.length || 0),
          ],
        };
      }),
    }));
  }

  function removerOpcao(perguntaLocalId, opcaoLocalId) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) => {
        if (pergunta.local_id !== perguntaLocalId) return pergunta;

        return {
          ...pergunta,
          opcoes: (pergunta.opcoes || [])
            .filter((opcao) => opcao.local_id !== opcaoLocalId)
            .map((opcao, index) => ({
              ...opcao,
              ordem: index,
            })),
        };
      }),
    }));
  }

  function atualizarOpcao(perguntaLocalId, opcaoLocalId, campo, valor) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) => {
        if (pergunta.local_id !== perguntaLocalId) return pergunta;

        return {
          ...pergunta,
          opcoes: (pergunta.opcoes || []).map((opcao) =>
            opcao.local_id === opcaoLocalId
              ? { ...opcao, [campo]: valor }
              : opcao
          ),
        };
      }),
    }));
  }

  function validar() {
    if (!cleanStr(form.titulo) || cleanStr(form.titulo).length < 3) {
      return "Informe o título do quiz com pelo menos 3 caracteres.";
    }

    if (!["geral", "evento", "turma"].includes(form.contexto)) {
      return "Contexto inválido.";
    }

    if (form.contexto === "evento" && !form.evento_id) {
      return "Informe o ID do evento.";
    }

    if (form.contexto === "turma" && !form.turma_id) {
      return "Informe o ID da turma.";
    }

    const perguntas = Array.isArray(form.perguntas) ? form.perguntas : [];

    if (perguntas.length === 0) {
      return "Informe pelo menos uma pergunta para o quiz.";
    }

    for (let pIndex = 0; pIndex < perguntas.length; pIndex += 1) {
      const pergunta = perguntas[pIndex];

      if (!cleanStr(pergunta.enunciado) || cleanStr(pergunta.enunciado).length < 3) {
        return `Informe o enunciado da pergunta ${pIndex + 1}.`;
      }

      const peso = Number(pergunta.peso);

      if (!Number.isFinite(peso) || peso < 0) {
        return `Informe um peso válido na pergunta ${pIndex + 1}.`;
      }

      const tempo = Number(pergunta.tempo_segundos);

      if (!Number.isInteger(tempo) || tempo <= 0) {
        return `Informe um tempo válido na pergunta ${pIndex + 1}.`;
      }

      const opcoes = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];
      const opcoesValidas = opcoes.filter((opcao) => cleanStr(opcao.texto));

      if (opcoesValidas.length < 2) {
        return `A pergunta ${pIndex + 1} precisa ter pelo menos duas opções.`;
      }

      const corretas = opcoesValidas.filter((opcao) => Boolean(opcao.correta));

      if (corretas.length < 1) {
        return `Marque pelo menos uma opção correta na pergunta ${pIndex + 1}.`;
      }
    }

    const tempoPadrao = Number(form.tempo_por_pergunta_segundos);

    if (!Number.isInteger(tempoPadrao) || tempoPadrao <= 0) {
      return "Informe um tempo padrão por pergunta válido.";
    }

    if (form.tentativas_max) {
      const tentativas = Number(form.tentativas_max);

      if (!Number.isInteger(tentativas) || tentativas <= 0) {
        return "Informe uma quantidade máxima de tentativas válida.";
      }
    }

    if (form.nota_minima) {
      const nota = Number(form.nota_minima);

      if (!Number.isFinite(nota) || nota < 0) {
        return "Informe uma nota mínima válida.";
      }
    }

    return null;
  }

  function montarPayload() {
    return {
      titulo: cleanStr(form.titulo),
      descricao: cleanStr(form.descricao) || null,
      tipo: TIPO_QUIZ,
      status: form.status,
      contexto: form.contexto,
      evento_id: form.contexto === "evento" ? Number(form.evento_id) : null,
      turma_id: form.contexto === "turma" ? Number(form.turma_id) : null,

      exige_inscricao_ou_presenca: Boolean(form.exige_inscricao_ou_presenca),
      exige_geolocalizacao: false,

      permite_anonima: Boolean(form.permite_anonima),
      uma_resposta_por_usuario: false,
      mostrar_resultado_usuario: Boolean(form.mostrar_resultado_usuario),
      mostrar_resultado_admin: Boolean(form.mostrar_resultado_admin),
      exibir_ranking: Boolean(form.exibir_ranking),

      tempo_por_pergunta_segundos: Number(form.tempo_por_pergunta_segundos),
      mostrar_gabarito: Boolean(form.mostrar_gabarito),
      embaralhar_opcoes: Boolean(form.embaralhar_opcoes),
      tentativas_max: form.tentativas_max ? Number(form.tentativas_max) : null,
      nota_minima: form.nota_minima ? Number(form.nota_minima) : null,

      atualizar_automaticamente: true,
      intervalo_atualizacao_segundos: 3,

      perguntas: (form.perguntas || []).map((pergunta, perguntaIndex) => ({
        enunciado: cleanStr(pergunta.enunciado),
        ordem: perguntaIndex,
        obrigatoria: pergunta.obrigatoria !== false,
        peso: Number(pergunta.peso || 1),
        tempo_segundos: Number(
          pergunta.tempo_segundos || form.tempo_por_pergunta_segundos || 60
        ),
        feedback_correto: cleanStr(pergunta.feedback_correto) || null,
        feedback_incorreto: cleanStr(pergunta.feedback_incorreto) || null,
        opcoes: (pergunta.opcoes || [])
          .filter((opcao) => cleanStr(opcao.texto))
          .map((opcao, opcaoIndex) => ({
            texto: cleanStr(opcao.texto),
            ordem: opcaoIndex,
            correta: Boolean(opcao.correta),
          })),
      })),

      // O quiz ao vivo não depende de janela de disponibilidade.
      // A abertura/fechamento é controlada pelo administrador pergunta a pergunta.
      janelas: [],
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
    setA11y(isEdicao ? "Salvando quiz." : "Cadastrando quiz.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.interacao.atualizar(interacao.id, payload);
      } else {
        await api.interacao.criar(payload);
      }

      setA11y("Quiz salvo com sucesso.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível salvar o quiz.");

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
        aria-labelledby="modal-quiz-title"
        aria-describedby="modal-quiz-desc"
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,.34),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.18),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Trophy className="h-3.5 w-3.5 text-violet-200" />
                Quiz
              </div>

              <h2
                id="modal-quiz-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                {isEdicao ? "Editar quiz" : "Novo quiz"}
              </h2>

              <p
                id="modal-quiz-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                Configure as perguntas, opções corretas, tempo de resposta e
                regras de exibição do quiz ao vivo.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60"
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
          className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 pb-28 dark:bg-slate-950 sm:p-6 sm:pb-32"
        >
          {erro ? (
            <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
          ) : null}

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Dados do quiz
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Título" required>
                <input
                  ref={firstRef}
                  value={form.titulo}
                  onChange={(event) => setCampo("titulo", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Quiz da capacitação"
                  disabled={salvando}
                />
              </Field>

              <Field label="Status" required>
                <select
                  value={form.status}
                  onChange={(event) => setCampo("status", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                >
                  {STATUS_OFICIAL.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Contexto" required>
                <select
                  value={form.contexto}
                  onChange={(event) => setCampo("contexto", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                >
                  {CONTEXTOS_OFICIAIS.map((contexto) => (
                    <option key={contexto.value} value={contexto.value}>
                      {contexto.label}
                    </option>
                  ))}
                </select>
              </Field>

              {form.contexto === "evento" ? (
                <Field label="ID do evento" required>
                  <input
                    type="number"
                    min="1"
                    value={form.evento_id}
                    onChange={(event) => setCampo("evento_id", event.target.value)}
                    className={inputClass()}
                    placeholder="Informe o ID do evento"
                    disabled={salvando}
                  />
                </Field>
              ) : null}

              {form.contexto === "turma" ? (
                <Field label="ID da turma" required>
                  <input
                    type="number"
                    min="1"
                    value={form.turma_id}
                    onChange={(event) => setCampo("turma_id", event.target.value)}
                    className={inputClass()}
                    placeholder="Informe o ID da turma"
                    disabled={salvando}
                  />
                </Field>
              ) : null}

              <Field label="Tempo padrão por pergunta (segundos)" required>
                <input
                  type="number"
                  min="1"
                  value={form.tempo_por_pergunta_segundos}
                  onChange={(event) =>
                    setCampo("tempo_por_pergunta_segundos", event.target.value)
                  }
                  className={inputClass()}
                  disabled={salvando}
                />
              </Field>

              <Field label="Tentativas máximas">
                <input
                  type="number"
                  min="1"
                  value={form.tentativas_max}
                  onChange={(event) =>
                    setCampo("tentativas_max", event.target.value)
                  }
                  className={inputClass()}
                  placeholder="Opcional"
                  disabled={salvando}
                />
              </Field>

              <Field label="Nota mínima">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.nota_minima}
                  onChange={(event) => setCampo("nota_minima", event.target.value)}
                  className={inputClass()}
                  placeholder="Opcional"
                  disabled={salvando}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Descrição">
                  <textarea
                    value={form.descricao}
                    onChange={(event) => setCampo("descricao", event.target.value)}
                    className={textareaClass()}
                    rows={3}
                    placeholder="Explique o objetivo do quiz."
                    disabled={salvando}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2 lg:grid-cols-4">
              <CheckboxField
                label="Exigir inscrição/presença"
                checked={form.exige_inscricao_ou_presenca}
                onChange={(value) =>
                  setCampo("exige_inscricao_ou_presenca", value)
                }
                disabled={salvando}
              />

              <CheckboxField
                label="Mostrar gabarito"
                checked={form.mostrar_gabarito}
                onChange={(value) => setCampo("mostrar_gabarito", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Embaralhar opções"
                checked={form.embaralhar_opcoes}
                onChange={(value) => setCampo("embaralhar_opcoes", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Exibir ranking"
                checked={form.exibir_ranking}
                onChange={(value) => setCampo("exibir_ranking", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Permitir resposta anônima"
                checked={form.permite_anonima}
                onChange={(value) => setCampo("permite_anonima", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Mostrar resultado ao usuário"
                checked={form.mostrar_resultado_usuario}
                onChange={(value) =>
                  setCampo("mostrar_resultado_usuario", value)
                }
                disabled={salvando}
              />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Perguntas do quiz
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Cada pergunta precisa ter ao menos duas opções e uma opção
                  correta.
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarPergunta}
                disabled={salvando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Adicionar pergunta
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {(form.perguntas || []).map((pergunta, perguntaIndex) => (
                <div
                  key={pergunta.local_id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      Pergunta {perguntaIndex + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => removerPergunta(pergunta.local_id)}
                      disabled={salvando || form.perguntas.length <= 1}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover pergunta
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_160px_160px]">
                    <Field label="Enunciado" required>
                      <textarea
                        value={pergunta.enunciado}
                        onChange={(event) =>
                          atualizarPergunta(
                            pergunta.local_id,
                            "enunciado",
                            event.target.value
                          )
                        }
                        className={textareaClass()}
                        rows={3}
                        placeholder="Digite a pergunta..."
                        disabled={salvando}
                      />
                    </Field>

                    <Field label="Peso" required>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pergunta.peso}
                        onChange={(event) =>
                          atualizarPergunta(
                            pergunta.local_id,
                            "peso",
                            event.target.value
                          )
                        }
                        className={inputClass()}
                        disabled={salvando}
                      />
                    </Field>

                    <Field label="Tempo (s)" required>
                      <input
                        type="number"
                        min="1"
                        value={pergunta.tempo_segundos}
                        onChange={(event) =>
                          atualizarPergunta(
                            pergunta.local_id,
                            "tempo_segundos",
                            event.target.value
                          )
                        }
                        className={inputClass()}
                        disabled={salvando}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Feedback correto">
                      <input
                        value={pergunta.feedback_correto}
                        onChange={(event) =>
                          atualizarPergunta(
                            pergunta.local_id,
                            "feedback_correto",
                            event.target.value
                          )
                        }
                        className={inputClass()}
                        placeholder="Opcional"
                        disabled={salvando}
                      />
                    </Field>

                    <Field label="Feedback incorreto">
                      <input
                        value={pergunta.feedback_incorreto}
                        onChange={(event) =>
                          atualizarPergunta(
                            pergunta.local_id,
                            "feedback_incorreto",
                            event.target.value
                          )
                        }
                        className={inputClass()}
                        placeholder="Opcional"
                        disabled={salvando}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        Opções
                      </p>

                      <button
                        type="button"
                        onClick={() => adicionarOpcao(pergunta.local_id)}
                        disabled={salvando}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar opção
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(pergunta.opcoes || []).map((opcao, opcaoIndex) => (
                        <div
                          key={opcao.local_id}
                          className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-[1fr_auto_auto]"
                        >
                          <input
                            value={opcao.texto}
                            onChange={(event) =>
                              atualizarOpcao(
                                pergunta.local_id,
                                opcao.local_id,
                                "texto",
                                event.target.value
                              )
                            }
                            className={inputClass()}
                            placeholder={`Opção ${opcaoIndex + 1}`}
                            disabled={salvando}
                          />

                          <label className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                            <input
                              type="checkbox"
                              checked={Boolean(opcao.correta)}
                              onChange={(event) =>
                                atualizarOpcao(
                                  pergunta.local_id,
                                  opcao.local_id,
                                  "correta",
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              disabled={salvando}
                            />
                            Correta
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              removerOpcao(pergunta.local_id, opcao.local_id)
                            }
                            disabled={salvando || pergunta.opcoes.length <= 2}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            O quiz será aplicado ao vivo pelo administrador, liberando uma
            pergunta por vez.
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isEdicao ? "Salvar alterações" : "Cadastrar quiz"}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* =========================================================================
   Resultado / execução ao vivo
=========================================================================== */

function ResultadoQuizDrawer({ painel, loading, acaoAoVivo, onClose, onAcao }) {
  if (!painel) return null;

  const interacao = painel.completo || painel.interacao;
  const ranking = painel.resultado?.ranking || [];
  const perguntas = Array.isArray(interacao?.perguntas) ? interacao.perguntas : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (loading) return;
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="resultado-quiz-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950"
      >
        <header className="border-b border-slate-200 bg-slate-950 p-5 text-white dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                <Trophy className="h-3.5 w-3.5" />
                Quiz ao vivo
              </div>

              <h2 id="resultado-quiz-title" className="text-xl font-black">
                {interacao?.titulo || "Quiz"}
              </h2>

              <p className="mt-1 text-sm text-white/70">
                Libere perguntas, exiba gabarito e acompanhe o ranking.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60"
              aria-label="Fechar resultado"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton height={26} width="60%" />
              <Skeleton height={120} />
              <Skeleton height={120} />
            </div>
          ) : painel.erro ? (
            <AlertBox
              tone="rose"
              icon={AlertCircle}
              title="Atenção"
              message={painel.erro}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        Controle das perguntas
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Abra a pergunta, aguarde as respostas, feche e exiba o
                        gabarito.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAcao?.("iniciar", interacao.id)}
                      disabled={Boolean(acaoAoVivo)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
                    >
                      {acaoAoVivo === `iniciar-${interacao.id}-execucao` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Iniciar execução
                    </button>
                  </div>
                </div>

                {perguntas.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    Nenhuma pergunta cadastrada.
                  </div>
                ) : (
                  perguntas.map((pergunta, index) => (
                    <div
                      key={pergunta.id || pergunta.local_id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-wide text-violet-600 dark:text-violet-300">
                            Pergunta {index + 1} · {pergunta.status || "aguardando"}
                          </p>

                          <h4 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                            {pergunta.enunciado}
                          </h4>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(pergunta.opcoes || []).map((opcao) => (
                              <span
                                key={opcao.id}
                                className={cx(
                                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                                  opcao.correta
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                                    : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                )}
                              >
                                {opcao.texto}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                          <button
                            type="button"
                            onClick={() =>
                              onAcao?.("abrir", interacao.id, pergunta.id)
                            }
                            disabled={Boolean(acaoAoVivo)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200"
                          >
                            {acaoAoVivo ===
                            `abrir-${interacao.id}-${pergunta.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            Abrir
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onAcao?.("fechar", interacao.id, pergunta.id)
                            }
                            disabled={Boolean(acaoAoVivo)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
                          >
                            {acaoAoVivo ===
                            `fechar-${interacao.id}-${pergunta.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <StopCircle className="h-4 w-4" />
                            )}
                            Fechar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onAcao?.("gabarito", interacao.id, pergunta.id)
                            }
                            disabled={Boolean(acaoAoVivo)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                          >
                            {acaoAoVivo ===
                            `gabarito-${interacao.id}-${pergunta.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            Gabarito
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Ranking
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Ordenado por acertos, pontuação e tempo acumulado.
                  </p>
                </div>

                <div className="space-y-3">
                  {ranking.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma resposta registrada.
                    </p>
                  ) : (
                    ranking.map((item, index) => (
                      <div
                        key={item.usuario_id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                              {index + 1}º lugar
                            </p>

                            <p className="truncate text-base font-black text-slate-900 dark:text-white">
                              {item.nome_exibicao}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-violet-700 dark:text-violet-300">
                              {item.acertos}
                            </p>
                            <p className="text-xs font-bold text-slate-500">
                              acerto(s)
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-2xl bg-white p-2 dark:bg-slate-900">
                            <p className="font-black text-slate-400">Resp.</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                              {item.respostas}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white p-2 dark:bg-slate-900">
                            <p className="font-black text-slate-400">Pontos</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                              {Number(item.pontuacao || 0)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white p-2 dark:bg-slate-900">
                            <p className="font-black text-slate-400">Tempo</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                              {Math.round(Number(item.tempo_total_ms || 0) / 1000)}s
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* =========================================================================
   Confirmação / campos
=========================================================================== */

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
        aria-labelledby="confirmar-exclusao-quiz-title"
        className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-900 via-red-800 to-amber-700 p-5 text-white sm:p-6">
          <h3
            id="confirmar-exclusao-quiz-title"
            className="flex items-center gap-2 text-xl font-black tracking-tight"
          >
            <AlertCircle className="h-5 w-5" />
            Excluir quiz?
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Tem certeza que deseja excluir{" "}
            {titulo ? <strong>“{titulo}”</strong> : "este quiz"}? Esta ação
            remove perguntas, opções e respostas vinculadas.
          </p>
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

function CheckboxField({ label, checked, onChange, disabled }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        disabled={disabled}
      />
      {label}
    </label>
  );
}

function inputClass() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}

function textareaClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}