// ✅ frontend/src/pages/InteracoesNuvemPalavrasAdmin.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página administrativa de Nuvem de Palavras do módulo Interações.
//
// Tipo oficial:
// - nuvem_palavras
//
// Contratos oficiais usados:
// - GET    /api/interacao/admin?tipo=nuvem_palavras
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
// - sem rota /nuvem-palavras separada;
// - sem chamada direta para /api;
// - facade oficial: api.interacao;
// - nuvem com exatamente uma pergunta;
// - resposta textual curta;
// - atualização automática do painel ao vivo;
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
  Cloud,
  Edit2,
  Eye,
  Filter,
  Layers3,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
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

const TIPO_NUVEM = "nuvem_palavras";

const STATUS_OFICIAL = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicada", label: "Publicada" },
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
  permite_anonima: true,
  uma_resposta_por_usuario: true,
  mostrar_resultado_usuario: true,
  mostrar_resultado_admin: true,
  exibir_ranking: false,

  atualizar_automaticamente: true,
  intervalo_atualizacao_segundos: 3,
  limite_palavra_caracteres: 40,

  enunciado: "",
  janelas: [
    {
      local_id: cryptoId(),
      data: "",
      horario_inicio: "08:00",
      horario_fim: "17:00",
    },
  ],
};

const STORAGE_KEY = "escola:v2:interacoes-nuvem-palavras-admin:filtros";

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

  const pergunta = Array.isArray(interacao.perguntas)
    ? interacao.perguntas[0]
    : null;

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
    permite_anonima: interacao.permite_anonima !== false,
    uma_resposta_por_usuario: interacao.uma_resposta_por_usuario !== false,
    mostrar_resultado_usuario: interacao.mostrar_resultado_usuario !== false,
    mostrar_resultado_admin: interacao.mostrar_resultado_admin !== false,
    exibir_ranking: Boolean(interacao.exibir_ranking),

    atualizar_automaticamente: interacao.atualizar_automaticamente !== false,
    intervalo_atualizacao_segundos:
      interacao.intervalo_atualizacao_segundos !== null &&
      interacao.intervalo_atualizacao_segundos !== undefined
        ? String(interacao.intervalo_atualizacao_segundos)
        : "3",
    limite_palavra_caracteres:
      interacao.limite_palavra_caracteres !== null &&
      interacao.limite_palavra_caracteres !== undefined
        ? String(interacao.limite_palavra_caracteres)
        : "40",

    enunciado: pergunta?.enunciado || "",

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

const WORD_CLOUD_COLORS = [
  "#0f766e", // verde petróleo
  "#0369a1", // azul institucional
  "#7c2d12", // cobre
  "#9a3412", // laranja queimado
  "#166534", // verde
  "#4338ca", // índigo
  "#9d174d", // vinho
  "#a16207", // dourado discreto
];

function normalizarPalavrasNuvem(palavras) {
  if (!Array.isArray(palavras)) return [];

  return palavras
    .map((item) => ({
      palavra: cleanStr(item?.palavra),
      total: Number(item?.total || 0),
    }))
    .filter((item) => item.palavra && item.total > 0)
    .sort((a, b) => b.total - a.total || a.palavra.localeCompare(b.palavra))
    .slice(0, 28);
}

function calcularTamanhoPalavra(total, maiorTotal) {
  const min = 18;
  const max = 64;

  if (!maiorTotal || maiorTotal <= 0) return min;

  const ratio = Math.sqrt(Number(total || 0) / maiorTotal);
  return Math.round(min + (max - min) * Math.max(0.14, ratio));
}

function obterCorPalavra(index, total, maiorTotal) {
  const peso = maiorTotal > 0 ? Number(total || 0) / maiorTotal : 0;

  if (peso >= 0.9) return "#7c2d12";
  if (peso >= 0.7) return "#9a3412";
  if (peso >= 0.5) return "#0369a1";

  return WORD_CLOUD_COLORS[index % WORD_CLOUD_COLORS.length];
}

function obterRotacaoPalavra(index, total, maiorTotal) {
  const peso = maiorTotal > 0 ? Number(total || 0) / maiorTotal : 0;

  if (peso >= 0.7) return 0;

  const rotacoes = [-8, 6, -5, 4, -6, 7, -4, 5];
  return rotacoes[index % rotacoes.length];
}

/* =========================================================================
   Página
=========================================================================== */

export default function InteracoesNuvemPalavrasAdmin() {
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

  const [painelNuvem, setPainelNuvem] = useState(null);
  const [carregandoNuvem, setCarregandoNuvem] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Nuvem de palavras | Interações";
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
      // localStorage indisponível não deve quebrar a tela.
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
    setLive("Carregando nuvens de palavras.");

    try {
      const response = await api.interacao.listarAdmin({
        tipo: TIPO_NUVEM,
      });

      const data = unwrapArray(response);
      setInteracoes(data);
      setLive(`Nuvens de palavras carregadas: ${data.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as nuvens de palavras."
      );

      setErro(message);
      setLive("Falha ao carregar nuvens de palavras.");
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
      respostas: 0,
    };

    for (const interacao of interacoes) {
      if (interacao.status === "publicada") base.publicada += 1;
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
    setLive("Carregando nuvem de palavras para edição.");

    try {
      const response = await api.interacao.obterAdmin(interacao.id);
      setInteracaoEmEdicao(unwrapData(response));
      setModalAberto(true);
      setLive("Nuvem carregada para edição.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a nuvem de palavras para edição."
      );

      setErro(message);
      setLive("Falha ao carregar nuvem de palavras.");
    }
  }

  async function alterarStatus(interacao, status) {
    if (!interacao?.id || !status || interacao.status === status) return;

    setAlterandoStatusId(interacao.id);
    setErro("");
    setMensagem("");
    setLive("Alterando status da nuvem de palavras.");

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

      setMensagem("Status da nuvem de palavras atualizado com sucesso.");
      setLive("Status da nuvem atualizado.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível alterar o status da nuvem de palavras."
      );

      setErro(message);
      setLive("Falha ao alterar status da nuvem.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  async function abrirPainel(interacao) {
    setCarregandoNuvem(true);
    setPainelNuvem({
      interacao,
      resultado: null,
      erro: "",
    });
    setLive("Carregando painel da nuvem de palavras.");

    try {
      const response = await api.interacao.resultado(interacao.id);

      setPainelNuvem({
        interacao,
        resultado: unwrapData(response),
        erro: "",
      });

      setLive("Painel da nuvem carregado.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a nuvem de palavras."
      );

      setPainelNuvem({
        interacao,
        resultado: null,
        erro: message,
      });

      setLive("Falha ao carregar painel da nuvem.");
    } finally {
      setCarregandoNuvem(false);
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
    setLive("Excluindo nuvem de palavras.");

    try {
      await api.interacao.excluir(confirmacao.id);

      setInteracoes((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Nuvem de palavras excluída com sucesso.");
      setConfirmacao(null);
      setLive("Nuvem excluída com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível excluir a nuvem de palavras."
      );

      setErro(message);
      setLive("Falha ao excluir nuvem.");
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

      <PainelNuvemDrawer
        painel={painelNuvem}
        loading={carregandoNuvem}
        onClose={() => {
          if (carregandoNuvem) return;
          setPainelNuvem(null);
        }}
        onRefresh={async () => {
          if (!painelNuvem?.interacao?.id) return;

          setCarregandoNuvem(true);

          try {
            const response = await api.interacao.resultado(painelNuvem.interacao.id);

            setPainelNuvem((current) => ({
              ...current,
              resultado: unwrapData(response),
              erro: "",
            }));
          } catch (error) {
            setPainelNuvem((current) => ({
              ...current,
              erro: getErrorMessage(
                error,
                "Não foi possível atualizar a nuvem de palavras."
              ),
            }));
          } finally {
            setCarregandoNuvem(false);
          }
        }}
      />

     <HeaderHero
  titulo="Nuvens de palavras ao vivo"
  subtitulo="Crie perguntas abertas e acompanhe as palavras mais frequentes aparecendo em painel ao vivo."
  icon={Cloud}
/>

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <MiniStatCard label="Total" value={kpis.total} icon={Cloud} />
    <MiniStatCard label="Publicadas" value={kpis.publicada} icon={CheckCircle2} />
    <MiniStatCard label="Encerradas" value={kpis.encerrada} icon={Eye} />
    <MiniStatCard label="Palavras" value={kpis.respostas} icon={MessageSquareText} />
  </div>

  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
    <button
      type="button"
      onClick={abrirCriacao}
      className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-sky-700 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-sky-800"
    >
      <Plus className="h-4 w-4" />
      Nova nuvem
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
                <Filter className="h-5 w-5 text-sky-600" />
                Gestão de nuvens de palavras
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Crie perguntas abertas curtas e acompanhe as palavras mais
                frequentes em painel ao vivo.
              </p>
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
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
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
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
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
                  aria-label="Buscar nuvens de palavras"
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
            Nuvens visíveis:{" "}
            <strong className="font-black text-slate-900 dark:text-white">
              {interacoesFiltradas.length}
            </strong>
          </p>
        </section>

        <section aria-label="Lista de nuvens de palavras" className="space-y-3">
          {carregando ? (
            <LoadingList />
          ) : interacoesFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma nuvem de palavras encontrada"
              descricao="Crie uma nova nuvem de palavras para começar."
            />
          ) : (
            interacoesFiltradas.map((interacao) => (
              <NuvemCard
                key={interacao.id}
                interacao={interacao}
                reduceMotion={reduceMotion}
                alterandoStatus={String(alterandoStatusId) === String(interacao.id)}
                onEditar={() => abrirEdicao(interacao)}
                onPainel={() => abrirPainel(interacao)}
                onExcluir={() => pedirExclusao(interacao)}
                onAlterarStatus={(status) => alterarStatus(interacao, status)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalNuvemPalavras
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

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900">
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
      <div className="mt-0.5 rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
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

function NuvemCard({
  interacao,
  reduceMotion,
  alterandoStatus,
  onEditar,
  onPainel,
  onExcluir,
  onAlterarStatus,
}) {
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20 sm:p-5"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-sky-600" />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {interacao.titulo}
            </h3>

            <StatusBadge status={interacao.status} />

            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <Cloud className="h-3.5 w-3.5" />
              Nuvem
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
              icon={MessageSquareText}
              title="Palavras"
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
              icon={RefreshCcw}
              title="Atualização"
              value={`${interacao.intervalo_atualizacao_segundos || 3}s`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <button
            type="button"
            onClick={onPainel}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <BarChart3 className="h-4 w-4" />
            Painel ao vivo
          </button>

          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
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

function ModalNuvemPalavras({ aberto, interacao, onClose, onSaved }) {
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
      return "Informe o título da nuvem de palavras com pelo menos 3 caracteres.";
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

    if (!cleanStr(form.enunciado) || cleanStr(form.enunciado).length < 3) {
      return "Informe a pergunta da nuvem de palavras.";
    }

    const limite = Number(form.limite_palavra_caracteres);

    if (!Number.isInteger(limite) || limite <= 0) {
      return "Informe um limite de caracteres válido.";
    }

    const intervalo = Number(form.intervalo_atualizacao_segundos);

    if (!Number.isInteger(intervalo) || intervalo <= 0) {
      return "Informe um intervalo de atualização válido.";
    }

    if (!Array.isArray(form.janelas) || form.janelas.length === 0) {
      return "Informe pelo menos uma janela de disponibilidade.";
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

    return null;
  }

  function montarPayload() {
    return {
      titulo: cleanStr(form.titulo),
      descricao: cleanStr(form.descricao) || null,
      tipo: TIPO_NUVEM,
      status: form.status,
      contexto: form.contexto,
      evento_id: form.contexto === "evento" ? Number(form.evento_id) : null,
      turma_id: form.contexto === "turma" ? Number(form.turma_id) : null,

      exige_inscricao_ou_presenca: Boolean(form.exige_inscricao_ou_presenca),
      exige_geolocalizacao: false,

      permite_anonima: Boolean(form.permite_anonima),
      uma_resposta_por_usuario: Boolean(form.uma_resposta_por_usuario),
      mostrar_resultado_usuario: Boolean(form.mostrar_resultado_usuario),
      mostrar_resultado_admin: true,
      exibir_ranking: false,

      atualizar_automaticamente: true,
      intervalo_atualizacao_segundos: Number(form.intervalo_atualizacao_segundos),
      limite_palavra_caracteres: Number(form.limite_palavra_caracteres),

      perguntas: [
        {
          enunciado: cleanStr(form.enunciado),
          ordem: 0,
          obrigatoria: true,
          peso: 1,
          limite_caracteres: Number(form.limite_palavra_caracteres),
          opcoes: [],
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
    setA11y(isEdicao ? "Salvando nuvem de palavras." : "Cadastrando nuvem de palavras.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.interacao.atualizar(interacao.id, payload);
      } else {
        await api.interacao.criar(payload);
      }

      setA11y("Nuvem de palavras salva com sucesso.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível salvar a nuvem de palavras."
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
        aria-labelledby="modal-nuvem-title"
        aria-describedby="modal-nuvem-desc"
className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"
>
<header className="shrink-0 relative overflow-hidden border-b border-white/10 bg-slate-950 p-4 text-white sm:p-5">          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.34),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,.18),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Cloud className="h-3.5 w-3.5 text-sky-200" />
                Nuvem de palavras
              </div>

              <h2
                id="modal-nuvem-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                {isEdicao ? "Editar nuvem de palavras" : "Nova nuvem de palavras"}
              </h2>

              <p
                id="modal-nuvem-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                Configure uma pergunta curta, limite de caracteres e janelas de
                participação.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
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
className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-slate-50 p-4 pb-32 dark:bg-slate-950 sm:p-5 sm:pb-36"
>
            {erro ? (
            <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
          ) : null}

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Dados da nuvem
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Título" required>
                <input
                  ref={firstRef}
                  value={form.titulo}
                  onChange={(event) => setCampo("titulo", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Como você está se sentindo hoje?"
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

              <Field label="Limite de caracteres" required>
                <input
                  type="number"
                  min="1"
                  value={form.limite_palavra_caracteres}
                  onChange={(event) =>
                    setCampo("limite_palavra_caracteres", event.target.value)
                  }
                  className={inputClass()}
                  disabled={salvando}
                />
              </Field>

              <Field label="Atualização do painel em segundos" required>
                <input
                  type="number"
                  min="1"
                  value={form.intervalo_atualizacao_segundos}
                  onChange={(event) =>
                    setCampo(
                      "intervalo_atualizacao_segundos",
                      event.target.value
                    )
                  }
                  className={inputClass()}
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
                    placeholder="Explique o objetivo da nuvem de palavras."
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
                label="Uma resposta por usuário"
                checked={form.uma_resposta_por_usuario}
                onChange={(value) => setCampo("uma_resposta_por_usuario", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Permitir resposta anônima"
                checked={form.permite_anonima}
                onChange={(value) => setCampo("permite_anonima", value)}
                disabled={salvando}
              />

              <CheckboxField
                label="Mostrar ao usuário"
                checked={form.mostrar_resultado_usuario}
                onChange={(value) =>
                  setCampo("mostrar_resultado_usuario", value)
                }
                disabled={salvando}
              />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Pergunta
            </h3>

            <div className="mt-4">
              <Field label="Pergunta da nuvem de palavras" required>
                <textarea
                  value={form.enunciado}
                  onChange={(event) => setCampo("enunciado", event.target.value)}
                  className={textareaClass()}
                  rows={3}
                  placeholder="Ex.: Em uma palavra, como você está se sentindo hoje?"
                  disabled={salvando}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Janelas de participação
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Defina quando os usuários poderão enviar palavras.
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarJanela}
                disabled={salvando}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
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
        </form>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            O painel administrativo atualizará a nuvem conforme o intervalo
            configurado.
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isEdicao ? "Salvar alterações" : "Cadastrar nuvem"}
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
   Painel ao vivo / confirmação / campos
=========================================================================== */

function PainelNuvemDrawer({ painel, loading, onClose, onRefresh }) {
  const intervaloRef = useRef(null);

  const interacao = painel?.resultado?.interacao || painel?.interacao;
  const palavras = normalizarPalavrasNuvem(painel?.resultado?.palavras || []);
const intervalo = Number(interacao?.intervalo_atualizacao_segundos || 3);
const total = palavras.reduce((acc, item) => acc + Number(item.total || 0), 0);
const maiorTotal = Math.max(...palavras.map((item) => Number(item.total || 0)), 1);

  useEffect(() => {
    if (!painel?.interacao?.id) return undefined;

    intervaloRef.current = window.setInterval(() => {
      onRefresh?.();
    }, Math.max(1, intervalo) * 1000);

    return () => {
      if (intervaloRef.current) {
        window.clearInterval(intervaloRef.current);
      }
    };
  }, [painel?.interacao?.id, intervalo, onRefresh]);

  if (!painel) return null;

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
        aria-labelledby="painel-nuvem-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950"
      >
        <header className="border-b border-slate-200 bg-slate-950 p-5 text-white dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                <Cloud className="h-3.5 w-3.5" />
                Painel ao vivo
              </div>

              <h2 id="painel-nuvem-title" className="text-xl font-black">
                {interacao?.titulo || "Nuvem de palavras"}
              </h2>

              <p className="mt-1 text-sm text-white/70">
                Atualização automática a cada {intervalo} segundo(s).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              >
                <RefreshCcw
                  className={cx("h-4 w-4", loading && "animate-spin")}
                />
                Atualizar
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
                aria-label="Fechar painel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
          {loading && !painel.resultado ? (
            <div className="space-y-4">
              <Skeleton height={26} width="60%" />
              <Skeleton height={220} />
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
            <div className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoBox
                    icon={MessageSquareText}
                    title="Total de palavras"
                    value={String(total)}
                  />

                  <InfoBox
                    icon={Cloud}
                    title="Palavras únicas"
                    value={String(palavras.length)}
                  />

                  <InfoBox
                    icon={Clock}
                    title="Atualizado"
                    value={brDateTime(new Date().toISOString())}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Nuvem em tempo real
                    </h3>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      O tamanho da palavra cresce conforme a frequência das respostas.
                    </p>
                  </div>

                  {loading ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      Atualizando
                    </span>
                  ) : null}
                </div>

                {palavras.length === 0 ? (
                  <div className="grid min-h-[240px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950/60">
                    <div>
                      <Cloud className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                        Nenhuma palavra enviada ainda.
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        As respostas aparecerão aqui automaticamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-amber-100 bg-[radial-gradient(circle_at_center,#fffdf8_0%,#fff9ef_46%,#ffffff_100%)] p-4 shadow-inner dark:border-slate-800 dark:bg-[radial-gradient(circle_at_center,rgba(30,41,59,.92)_0%,rgba(15,23,42,1)_100%)] sm:p-6">
  <div className="flex min-h-[320px] flex-wrap content-center items-center justify-center gap-x-6 gap-y-5 overflow-hidden rounded-[2rem] border border-dashed border-amber-200/70 p-6 dark:border-slate-700 sm:min-h-[380px]">
    {palavras.map((item, index) => {
      const totalItem = Number(item.total || 0);
      const fontSize = calcularTamanhoPalavra(totalItem, maiorTotal);
      const cor = obterCorPalavra(index, totalItem, maiorTotal);
      const rotacao = obterRotacaoPalavra(index, totalItem, maiorTotal);

      return (
        <span
          key={`${item.palavra}-${index}`}
          className="inline-block max-w-full select-none whitespace-nowrap font-black leading-none tracking-tight transition-transform duration-200 hover:scale-105"
          style={{
            fontSize: `${fontSize}px`,
            color: cor,
            transform: `rotate(${rotacao}deg)`,
            opacity: index <= 2 ? 1 : 0.9,
          }}
          title={`${item.palavra}: ${totalItem} ocorrência(s)`}
        >
          {item.palavra}
          <span className="ml-1 align-top text-[10px] font-bold opacity-70">
            {totalItem}
          </span>
        </span>
      );
    })}
  </div>

  <div className="mt-3 flex justify-end">
    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-bold text-amber-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      {total} palavra(s) • {palavras.length} termo(s)
    </span>
  </div>
</div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Ranking de palavras
                </h3>

                <div className="mt-4 space-y-2">
                  {palavras.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma palavra registrada.
                    </p>
                  ) : (
                    palavras.map((item, index) => {
                      const percentual =
                        total > 0
                          ? Math.round((Number(item.total || 0) / total) * 100)
                          : 0;

                      return (
                        <div
                          key={`${item.palavra}-ranking-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                                {index + 1}º lugar
                              </p>

                              <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                                {item.palavra}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-black text-sky-700 dark:text-sky-300">
                                {item.total}
                              </p>
                              <p className="text-xs font-bold text-slate-500">
                                {percentual}%
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-sky-600"
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
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
        aria-labelledby="confirmar-exclusao-nuvem-title"
        className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-900 via-red-800 to-amber-700 p-5 text-white sm:p-6">
          <h3
            id="confirmar-exclusao-nuvem-title"
            className="flex items-center gap-2 text-xl font-black tracking-tight"
          >
            <AlertCircle className="h-5 w-5" />
            Excluir nuvem de palavras?
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Tem certeza que deseja excluir{" "}
            {titulo ? <strong>“{titulo}”</strong> : "esta nuvem de palavras"}?
            Esta ação remove a pergunta e as respostas vinculadas.
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
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        disabled={disabled}
      />
      {label}
    </label>
  );
}

function inputClass() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}

function textareaClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}