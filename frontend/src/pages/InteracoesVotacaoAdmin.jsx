// ✅ frontend/src/pages/InteracoesVotacaoAdmin.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página administrativa de Votações do módulo Interações.
//
// Tipo oficial:
// - votacao
//
// Contratos oficiais usados:
// - GET    /api/interacao/admin?tipo=votacao
// - POST   /api/interacao/admin
// - GET    /api/interacao/admin/:id
// - PUT    /api/interacao/admin/:id
// - PATCH  /api/interacao/admin/:id/status
// - DELETE /api/interacao/admin/:id
// - GET    /api/interacao/admin/:id/resultado
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota /votacao antiga;
// - sem chamada direta para /api;
// - facade oficial: api.interacao;
// - votação sempre vinculada a evento ou turma;
// - votação possui exatamente uma pergunta;
// - votação possui duas ou mais opções;
// - votação possui janelas de disponibilidade;
// - votação pode exigir geolocalização;
// - ranking administrativo;
// - QR/token tratado como dado da interação;
// - mobile-first;
// - acessível;
// - dark mode;
// - estados loading/vazio/erro.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Crosshair,
  Edit2,
  Eye,
  FileQuestion,
  Filter,
  Layers3,
  Link2,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Vote,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";

/* =========================================================================
   Constantes
=========================================================================== */

const TIPO_VOTACAO = "votacao";

const STATUS_OFICIAL = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicada", label: "Publicada" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const CONTEXTOS_VOTACAO = [
  { value: "evento", label: "Evento" },
  { value: "turma", label: "Turma" },
];

const FORM_INICIAL = {
  titulo: "",
  descricao: "",
  status: "rascunho",
  contexto: "evento",
  evento_id: "",
  turma_id: "",

  exige_inscricao_ou_presenca: true,
  exige_geolocalizacao: false,
  latitude: "",
  longitude: "",
  raio_metros: "",

  permite_anonima: false,
  uma_resposta_por_usuario: true,
  mostrar_resultado_usuario: false,
  mostrar_resultado_admin: true,
  exibir_ranking: true,

  enunciado: "",
  opcoes: [
    { local_id: cryptoId(), texto: "", ordem: 0 },
    { local_id: cryptoId(), texto: "", ordem: 1 },
  ],

  janelas: [
    {
      local_id: cryptoId(),
      data: "",
      horario_inicio: "08:00",
      horario_fim: "17:00",
    },
  ],
};

const STORAGE_KEY = "escola:v2:interacoes-votacao-admin:filtros";

/* =========================================================================
   Helpers
=========================================================================== */

function cryptoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

function statusInfo(status) {
  const value = String(status || "").toLowerCase();

  const map = {
    rascunho: {
      label: "Rascunho",
      tone: "amber",
    },
    publicada: {
      label: "Publicada",
      tone: "emerald",
    },
    em_andamento: {
      label: "Em andamento",
      tone: "violet",
    },
    encerrada: {
      label: "Encerrada",
      tone: "blue",
    },
    arquivada: {
      label: "Arquivada",
      tone: "slate",
    },
  };

  return (
    map[value] || {
      label: value || "Sem status",
      tone: "slate",
    }
  );
}

function contextoLabel(value) {
  const map = {
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

  const pergunta = Array.isArray(interacao.perguntas)
    ? interacao.perguntas[0]
    : null;

  return {
    titulo: interacao.titulo || "",
    descricao: interacao.descricao || "",
    status: interacao.status || "rascunho",
    contexto:
      interacao.contexto === "turma" || interacao.contexto === "evento"
        ? interacao.contexto
        : "evento",
    evento_id:
      interacao.evento_id !== null && interacao.evento_id !== undefined
        ? String(interacao.evento_id)
        : "",
    turma_id:
      interacao.turma_id !== null && interacao.turma_id !== undefined
        ? String(interacao.turma_id)
        : "",

    exige_inscricao_ou_presenca:
      interacao.exige_inscricao_ou_presenca !== false,
    exige_geolocalizacao: Boolean(interacao.exige_geolocalizacao),
    latitude:
      interacao.latitude !== null && interacao.latitude !== undefined
        ? String(interacao.latitude)
        : "",
    longitude:
      interacao.longitude !== null && interacao.longitude !== undefined
        ? String(interacao.longitude)
        : "",
    raio_metros:
      interacao.raio_metros !== null && interacao.raio_metros !== undefined
        ? String(interacao.raio_metros)
        : "",

    permite_anonima: Boolean(interacao.permite_anonima),
    uma_resposta_por_usuario: interacao.uma_resposta_por_usuario !== false,
    mostrar_resultado_usuario: Boolean(interacao.mostrar_resultado_usuario),
    mostrar_resultado_admin: interacao.mostrar_resultado_admin !== false,
    exibir_ranking: interacao.exibir_ranking !== false,

    enunciado: pergunta?.enunciado || "",
    opcoes:
      Array.isArray(pergunta?.opcoes) && pergunta.opcoes.length > 0
        ? pergunta.opcoes.map((opcao, index) => ({
            local_id: String(opcao.id || cryptoId()),
            texto: opcao.texto || "",
            ordem:
              opcao.ordem !== null && opcao.ordem !== undefined
                ? Number(opcao.ordem)
                : index,
          }))
        : [
            { local_id: cryptoId(), texto: "", ordem: 0 },
            { local_id: cryptoId(), texto: "", ordem: 1 },
          ],

    janelas:
      Array.isArray(interacao.janelas) && interacao.janelas.length > 0
        ? interacao.janelas.map((janela) => ({
            local_id: String(janela.id || cryptoId()),
            data: String(janela.data || "").slice(0, 10),
            horario_inicio: brTime(janela.horario_inicio),
            horario_fim: brTime(janela.horario_fim),
          }))
        : [
            {
              local_id: cryptoId(),
              data: "",
              horario_inicio: "08:00",
              horario_fim: "17:00",
            },
          ],
  };
}

function getFrontendBaseUrl() {
  const envUrl = import.meta.env?.VITE_FRONTEND_URL;

  if (envUrl) return String(envUrl).replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
}

function montarLinkInteracao(interacao) {
  if (!interacao?.id) return "";

  const base = getFrontendBaseUrl();
  const token = interacao.qr_token ? `?token=${encodeURIComponent(interacao.qr_token)}` : "";

  return `${base}/interacao/${interacao.id}${token}`;
}

/* =========================================================================
   Página
=========================================================================== */

export default function InteracoesVotacaoAdmin() {
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

  const [resultadoPainel, setResultadoPainel] = useState(null);
  const [carregandoResultado, setCarregandoResultado] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Votações | Interações";
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
    setLive("Carregando votações.");

    try {
      const response = await api.interacao.listarAdmin({
        tipo: TIPO_VOTACAO,
      });

      const data = unwrapArray(response);
      setInteracoes(data);
      setLive(`Votações carregadas: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as votações."
      );

      setErro(message);
      setLive("Falha ao carregar votações.");
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
      encerrada: 0,
      rascunho: 0,
      respostas: 0,
    };

    for (const interacao of interacoes) {
      if (interacao.status === "publicada") base.publicada += 1;
      if (interacao.status === "encerrada") base.encerrada += 1;
      if (interacao.status === "rascunho") base.rascunho += 1;

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
    setLive("Carregando votação para edição.");

    try {
      const response = await api.interacao.obterAdmin(interacao.id);
      setInteracaoEmEdicao(unwrapData(response));
      setModalAberto(true);
      setLive("Votação carregada para edição.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a votação para edição."
      );

      setErro(message);
      setLive("Falha ao carregar votação para edição.");
    }
  }

  async function alterarStatus(interacao, status) {
    if (!interacao?.id || !status || interacao.status === status) return;

    setAlterandoStatusId(interacao.id);
    setErro("");
    setMensagem("");
    setLive("Alterando status da votação.");

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

      setMensagem("Status da votação atualizado com sucesso.");
      setLive("Status da votação atualizado com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível alterar o status da votação."
      );

      setErro(message);
      setLive("Falha ao alterar status da votação.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  async function abrirResultado(interacao) {
    setCarregandoResultado(true);
    setResultadoPainel({
      interacao,
      resultado: null,
      erro: "",
    });
    setLive("Carregando resultado da votação.");

    try {
      const response = await api.interacao.resultado(interacao.id);

      setResultadoPainel({
        interacao,
        resultado: unwrapData(response),
        erro: "",
      });

      setLive("Resultado da votação carregado.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar o resultado da votação."
      );

      setResultadoPainel({
        interacao,
        resultado: null,
        erro: message,
      });

      setLive("Falha ao carregar resultado da votação.");
    } finally {
      setCarregandoResultado(false);
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
    setLive("Excluindo votação.");

    try {
      await api.interacao.excluir(confirmacao.id);

      setInteracoes((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Votação excluída com sucesso.");
      setConfirmacao(null);
      setLive("Votação excluída com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível excluir a votação."
      );

      setErro(message);
      setLive("Falha ao excluir votação.");
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

      <ResultadoDrawer
        painel={resultadoPainel}
        loading={carregandoResultado}
        onClose={() => {
          if (carregandoResultado) return;
          setResultadoPainel(null);
        }}
      />

      <HeaderHero
        totalVisiveis={interacoesFiltradas.length}
        carregando={carregando}
        onRefresh={carregarDados}
        onCriar={abrirCriacao}
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
                Gestão de votações
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Crie votações com opções, janelas de horário, regra de
                participação e ranking automático.
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
                Status
              </span>

              <select
                value={filtroStatus}
                onChange={(event) => setFiltroStatus(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
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
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                  aria-label="Buscar votações"
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
            Votações visíveis:{" "}
            <strong className="font-black text-slate-900 dark:text-white">
              {interacoesFiltradas.length}
            </strong>
          </p>
        </section>

        <section aria-label="Lista de votações" className="space-y-3">
          {carregando ? (
            <LoadingList />
          ) : interacoesFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma votação encontrada"
              descricao="Crie uma nova votação para começar."
            />
          ) : (
            interacoesFiltradas.map((interacao) => (
              <VotacaoCard
                key={interacao.id}
                interacao={interacao}
                reduceMotion={reduceMotion}
                alterandoStatus={String(alterandoStatusId) === String(interacao.id)}
                onEditar={() => abrirEdicao(interacao)}
                onResultado={() => abrirResultado(interacao)}
                onExcluir={() => pedirExclusao(interacao)}
                onAlterarStatus={(status) => alterarStatus(interacao, status)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalVotacao
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
   Topo / cards / filtros
=========================================================================== */

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
      <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
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

function VotacaoCard({
  interacao,
  reduceMotion,
  alterandoStatus,
  onEditar,
  onResultado,
  onExcluir,
  onAlterarStatus,
}) {
  const link = montarLinkInteracao(interacao);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Se o navegador bloquear, o usuário ainda consegue copiar visualmente se necessário.
    }
  }

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-emerald-600" />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {interacao.titulo}
            </h3>

            <StatusBadge status={interacao.status} />

            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Vote className="h-3.5 w-3.5" />
              Votação
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {interacao.contexto_label || contextoLabel(interacao.contexto)}
            </span>

            {interacao.exige_geolocalizacao ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <MapPin className="h-3.5 w-3.5" />
                Geolocalização
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {interacao.descricao || "Sem descrição informada."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              icon={Trophy}
              title="Votos"
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
              title="Criada em"
              value={brDateTime(interacao.criado_em)}
            />
            <InfoBox
              icon={ShieldCheck}
              title="Regra"
              value={
                interacao.exige_inscricao_ou_presenca
                  ? "Inscrição/presença obrigatória"
                  : "Aberta a usuários logados"
              }
            />
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
                  <QrCode className="h-3.5 w-3.5" />
                  Link para QR Code
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {link}
                </p>
              </div>

              <button
                type="button"
                onClick={copiarLink}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <button
            type="button"
            onClick={onResultado}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <BarChart3 className="h-4 w-4" />
            Ranking
          </button>

          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
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
                <Eye className="h-4 w-4" />
              )}
              Encerrar
            </button>
          ) : null}

          {interacao.status !== "rascunho" ? (
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

function ModalVotacao({ aberto, interacao, onClose, onSaved }) {
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
        if (valor === "evento") {
          next.turma_id = "";
        }

        if (valor === "turma") {
          next.evento_id = "";
        }
      }

      if (campo === "exige_geolocalizacao" && !valor) {
        next.latitude = "";
        next.longitude = "";
        next.raio_metros = "";
      }

      return next;
    });
  }

  function adicionarOpcao() {
    setForm((current) => ({
      ...current,
      opcoes: [
        ...(current.opcoes || []),
        {
          local_id: cryptoId(),
          texto: "",
          ordem: current.opcoes?.length || 0,
        },
      ],
    }));
  }

  function atualizarOpcao(localId, valor) {
    setForm((current) => ({
      ...current,
      opcoes: (current.opcoes || []).map((opcao) =>
        opcao.local_id === localId ? { ...opcao, texto: valor } : opcao
      ),
    }));
  }

  function removerOpcao(localId) {
    setForm((current) => ({
      ...current,
      opcoes: (current.opcoes || [])
        .filter((opcao) => opcao.local_id !== localId)
        .map((opcao, index) => ({
          ...opcao,
          ordem: index,
        })),
    }));
  }

  function adicionarJanela() {
    setForm((current) => ({
      ...current,
      janelas: [
        ...(current.janelas || []),
        {
          local_id: cryptoId(),
          data: "",
          horario_inicio: "08:00",
          horario_fim: "17:00",
        },
      ],
    }));
  }

  function atualizarJanela(localId, campo, valor) {
    setForm((current) => ({
      ...current,
      janelas: (current.janelas || []).map((janela) =>
        janela.local_id === localId ? { ...janela, [campo]: valor } : janela
      ),
    }));
  }

  function removerJanela(localId) {
    setForm((current) => ({
      ...current,
      janelas: (current.janelas || []).filter(
        (janela) => janela.local_id !== localId
      ),
    }));
  }

  function validar() {
    if (!cleanStr(form.titulo) || cleanStr(form.titulo).length < 3) {
      return "Informe o título da votação com pelo menos 3 caracteres.";
    }

    if (!["evento", "turma"].includes(form.contexto)) {
      return "Votação precisa estar vinculada a evento ou turma.";
    }

    if (form.contexto === "evento" && !form.evento_id) {
      return "Informe o ID do evento.";
    }

    if (form.contexto === "turma" && !form.turma_id) {
      return "Informe o ID da turma.";
    }

    if (!cleanStr(form.enunciado) || cleanStr(form.enunciado).length < 3) {
      return "Informe a pergunta da votação.";
    }

    const opcoesValidas = (form.opcoes || []).filter((opcao) =>
      cleanStr(opcao.texto)
    );

    if (opcoesValidas.length < 2) {
      return "Informe pelo menos duas opções de voto.";
    }

    if (!Array.isArray(form.janelas) || form.janelas.length === 0) {
      return "Informe pelo menos uma janela de votação.";
    }

    for (let index = 0; index < form.janelas.length; index += 1) {
      const janela = form.janelas[index];

      if (!janela.data) {
        return `Informe a data da janela ${index + 1}.`;
      }

      if (!janela.horario_inicio || !janela.horario_fim) {
        return `Informe os horários da janela ${index + 1}.`;
      }

      if (janela.horario_fim <= janela.horario_inicio) {
        return `Na janela ${index + 1}, o horário final deve ser posterior ao inicial.`;
      }
    }

    if (form.exige_geolocalizacao) {
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      const raio = Number(form.raio_metros);

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return "Informe uma latitude válida.";
      }

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return "Informe uma longitude válida.";
      }

      if (!Number.isInteger(raio) || raio <= 0) {
        return "Informe um raio em metros válido.";
      }
    }

    return null;
  }

  function montarPayload() {
    return {
      titulo: cleanStr(form.titulo),
      descricao: cleanStr(form.descricao) || null,
      tipo: TIPO_VOTACAO,
      status: form.status,
      contexto: form.contexto,
      evento_id: form.contexto === "evento" ? Number(form.evento_id) : null,
      turma_id: form.contexto === "turma" ? Number(form.turma_id) : null,

      exige_inscricao_ou_presenca: Boolean(form.exige_inscricao_ou_presenca),
      exige_geolocalizacao: Boolean(form.exige_geolocalizacao),
      latitude: form.exige_geolocalizacao ? Number(form.latitude) : null,
      longitude: form.exige_geolocalizacao ? Number(form.longitude) : null,
      raio_metros: form.exige_geolocalizacao
        ? Number(form.raio_metros)
        : null,

      permite_anonima: Boolean(form.permite_anonima),
      uma_resposta_por_usuario: true,
      mostrar_resultado_usuario: Boolean(form.mostrar_resultado_usuario),
      mostrar_resultado_admin: Boolean(form.mostrar_resultado_admin),
      exibir_ranking: Boolean(form.exibir_ranking),

      perguntas: [
        {
          enunciado: cleanStr(form.enunciado),
          ordem: 0,
          obrigatoria: true,
          peso: 1,
          opcoes: (form.opcoes || [])
            .filter((opcao) => cleanStr(opcao.texto))
            .map((opcao, index) => ({
              texto: cleanStr(opcao.texto),
              ordem: index,
              correta: false,
            })),
        },
      ],

      janelas: (form.janelas || []).map((janela) => ({
        data: janela.data,
        horario_inicio: janela.horario_inicio,
        horario_fim: janela.horario_fim,
      })),
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
    setA11y(isEdicao ? "Salvando votação." : "Cadastrando votação.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.interacao.atualizar(interacao.id, payload);
      } else {
        await api.interacao.criar(payload);
      }

      setA11y("Votação salva com sucesso.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível salvar a votação.");

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
        aria-labelledby="modal-votacao-title"
        aria-describedby="modal-votacao-desc"
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.22),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Vote className="h-3.5 w-3.5 text-emerald-200" />
                Votação
              </div>

              <h2
                id="modal-votacao-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                {isEdicao ? "Editar votação" : "Nova votação"}
              </h2>

              <p
                id="modal-votacao-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                Configure a pergunta, as opções, a vinculação com evento/turma e
                as janelas em que os usuários poderão votar.
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
            <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
          ) : null}

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Dados da votação
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Título" required>
                <input
                  ref={firstRef}
                  value={form.titulo}
                  onChange={(event) => setCampo("titulo", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Melhor trabalho oral"
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
                  {CONTEXTOS_VOTACAO.map((contexto) => (
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

              <div className="md:col-span-2">
                <Field label="Descrição">
                  <textarea
                    value={form.descricao}
                    onChange={(event) => setCampo("descricao", event.target.value)}
                    className={textareaClass()}
                    rows={3}
                    placeholder="Explique o objetivo da votação."
                    disabled={salvando}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Pergunta e opções
            </h3>

            <div className="mt-4">
              <Field label="Pergunta da votação" required>
                <textarea
                  value={form.enunciado}
                  onChange={(event) => setCampo("enunciado", event.target.value)}
                  className={textareaClass()}
                  rows={3}
                  placeholder="Ex.: Qual desses trabalhos orais foi o melhor?"
                  disabled={salvando}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  Opções de voto
                </p>

                <button
                  type="button"
                  onClick={adicionarOpcao}
                  disabled={salvando}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar opção
                </button>
              </div>

              <div className="space-y-2">
                {(form.opcoes || []).map((opcao, index) => (
                  <div
                    key={opcao.local_id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      value={opcao.texto}
                      onChange={(event) =>
                        atualizarOpcao(opcao.local_id, event.target.value)
                      }
                      className={inputClass()}
                      placeholder={`Opção ${index + 1}`}
                      disabled={salvando}
                    />

                    <button
                      type="button"
                      onClick={() => removerOpcao(opcao.local_id)}
                      disabled={salvando || form.opcoes.length <= 2}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Janelas de votação
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Defina os dias e horários em que o voto será permitido.
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarJanela}
                disabled={salvando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Adicionar janela
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(form.janelas || []).map((janela, index) => (
                <div
                  key={janela.local_id}
                  className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <Field label={`Data ${index + 1}`} required>
                    <input
                      type="date"
                      value={janela.data}
                      onChange={(event) =>
                        atualizarJanela(
                          janela.local_id,
                          "data",
                          event.target.value
                        )
                      }
                      className={inputClass()}
                      disabled={salvando}
                    />
                  </Field>

                  <Field label="Início" required>
                    <input
                      type="time"
                      value={janela.horario_inicio}
                      onChange={(event) =>
                        atualizarJanela(
                          janela.local_id,
                          "horario_inicio",
                          event.target.value
                        )
                      }
                      className={inputClass()}
                      disabled={salvando}
                    />
                  </Field>

                  <Field label="Fim" required>
                    <input
                      type="time"
                      value={janela.horario_fim}
                      onChange={(event) =>
                        atualizarJanela(
                          janela.local_id,
                          "horario_fim",
                          event.target.value
                        )
                      }
                      className={inputClass()}
                      disabled={salvando}
                    />
                  </Field>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removerJanela(janela.local_id)}
                      disabled={salvando || form.janelas.length <= 1}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Regras de segurança
            </h3>

            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2 lg:grid-cols-3">
              <CheckboxField
                label="Exigir inscrição ou presença"
                checked={form.exige_inscricao_ou_presenca}
                onChange={(value) =>
                  setCampo("exige_inscricao_ou_presenca", value)
                }
                disabled={salvando}
              />

              <CheckboxField
                label="Uma resposta por usuário"
                checked={form.uma_resposta_por_usuario}
                onChange={() => setCampo("uma_resposta_por_usuario", true)}
                disabled
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

              <CheckboxField
                label="Exibir ranking no admin"
                checked={form.exibir_ranking}
                onChange={(value) => setCampo("exibir_ranking", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Exigir geolocalização"
                checked={form.exige_geolocalizacao}
                onChange={(value) => setCampo("exige_geolocalizacao", value)}
                disabled={salvando}
              />
            </div>

            {form.exige_geolocalizacao ? (
              <div className="mt-4 grid gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30 md:grid-cols-3">
                <Field label="Latitude" required>
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.latitude}
                    onChange={(event) => setCampo("latitude", event.target.value)}
                    className={inputClass()}
                    placeholder="-23.9600000"
                    disabled={salvando}
                  />
                </Field>

                <Field label="Longitude" required>
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.longitude}
                    onChange={(event) => setCampo("longitude", event.target.value)}
                    className={inputClass()}
                    placeholder="-46.3300000"
                    disabled={salvando}
                  />
                </Field>

                <Field label="Raio em metros" required>
                  <input
                    type="number"
                    min="1"
                    value={form.raio_metros}
                    onChange={(event) =>
                      setCampo("raio_metros", event.target.value)
                    }
                    className={inputClass()}
                    placeholder="Ex.: 250"
                    disabled={salvando}
                  />
                </Field>
              </div>
            ) : null}
          </section>
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            A votação só aceitará votos dentro das janelas definidas e conforme
            as regras de participação.
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
                  {isEdicao ? "Salvar alterações" : "Cadastrar votação"}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}