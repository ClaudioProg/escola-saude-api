// ✅ frontend/src/pages/PesquisasAdmin.jsx — v2.0
// Atualizado em: 19/05/2026
//
// Plataforma Escola da Saúde
//
// Página administrativa do módulo Pesquisas.
//
// Função:
// - Listar pesquisas internas e externas.
// - Criar e editar pesquisa.
// - Criar perguntas/opções para pesquisa interna.
// - Publicar, encerrar, arquivar, voltar para rascunho e excluir.
// - Consultar respostas individuais e resultado agregado.
//
// Contratos oficiais usados:
// - GET    /api/pesquisa/admin
// - POST   /api/pesquisa/admin
// - GET    /api/pesquisa/admin/:id
// - PUT    /api/pesquisa/admin/:id
// - PATCH  /api/pesquisa/admin/:id/status
// - GET    /api/pesquisa/admin/:id/resposta
// - GET    /api/pesquisa/admin/:id/resultado
// - DELETE /api/pesquisa/admin/:id
//
// Diretrizes v2.0:
// - sem legado;
// - sem aliases;
// - sem rota plural;
// - sem chamada direta para /api fora do service;
// - api.pesquisa como facade oficial;
// - tipo oficial: externa | interna;
// - status oficial: rascunho | publicada | encerrada | arquivada;
// - contexto oficial: geral | evento | turma;
// - tipo de pergunta oficial:
//   opcao_unica | multipla_escolha | texto_curto | texto_longo | escala;
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
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Edit2,
  ExternalLink,
  Eye,
  FileQuestion,
  Filter,
  Globe2,
  Layers3,
  Link2,
  ListChecks,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  Send,
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

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_OFICIAL = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicada", label: "Publicada" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const TIPOS_OFICIAIS = [
  { value: "interna", label: "Interna" },
  { value: "externa", label: "Externa" },
];

const CONTEXTOS_OFICIAIS = [
  { value: "geral", label: "Geral" },
  { value: "evento", label: "Evento" },
  { value: "turma", label: "Turma" },
];

const TIPOS_PERGUNTA = [
  { value: "opcao_unica", label: "Opção única" },
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "texto_curto", label: "Texto curto" },
  { value: "texto_longo", label: "Texto longo" },
  { value: "escala", label: "Escala 1 a 5" },
];

const FORM_INICIAL = {
  titulo: "",
  descricao: "",
  tipo: "interna",
  status: "rascunho",
  contexto: "geral",
  evento_id: "",
  turma_id: "",
  link_externo: "",
  exibir_inicio: true,
  destaque: false,
  obrigatoria: false,
  permite_anonima: true,
  uma_resposta_por_usuario: true,
  abre_em: "",
  fecha_em: "",
  perguntas: [],
};

const STORAGE_KEY = "escola:v2:pesquisas-admin:filtros";

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

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function inputDateTimeLocal(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const pad = (number) => String(number).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "";
  }
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
      icon: Clock,
    },
    publicada: {
      label: "Publicada",
      tone: "emerald",
      icon: CheckCircle2,
    },
    encerrada: {
      label: "Encerrada",
      tone: "blue",
      icon: Send,
    },
    arquivada: {
      label: "Arquivada",
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

function tipoInfo(tipo) {
  const value = String(tipo || "").toLowerCase();

  if (value === "externa") {
    return {
      label: "Externa",
      icon: ExternalLink,
      tone: "blue",
    };
  }

  return {
    label: "Interna",
    icon: ClipboardList,
    tone: "emerald",
  };
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

function perguntaExigeOpcoes(tipo) {
  return tipo === "opcao_unica" || tipo === "multipla_escolha";
}

function tipoPerguntaLabel(tipo) {
  return TIPOS_PERGUNTA.find((item) => item.value === tipo)?.label || tipo;
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function criarPerguntaVazia() {
  return {
    local_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: "opcao_unica",
    enunciado: "",
    ordem: 0,
    obrigatoria: true,
    limite_caracteres: "",
    opcoes: [
      criarOpcaoVazia(0),
      criarOpcaoVazia(1),
    ],
  };
}

function criarOpcaoVazia(ordem = 0) {
  return {
    local_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    texto: "",
    ordem,
  };
}

function normalizeFormFromPesquisa(pesquisa) {
  if (!pesquisa) return FORM_INICIAL;

  return {
    titulo: pesquisa.titulo || "",
    descricao: pesquisa.descricao || "",
    tipo: pesquisa.tipo || "interna",
    status: pesquisa.status || "rascunho",
    contexto: pesquisa.contexto || "geral",
    evento_id:
      pesquisa.evento_id !== null && pesquisa.evento_id !== undefined
        ? String(pesquisa.evento_id)
        : "",
    turma_id:
      pesquisa.turma_id !== null && pesquisa.turma_id !== undefined
        ? String(pesquisa.turma_id)
        : "",
    link_externo: pesquisa.link_externo || "",
    exibir_inicio: pesquisa.exibir_inicio !== false,
    destaque: Boolean(pesquisa.destaque),
    obrigatoria: Boolean(pesquisa.obrigatoria),
    permite_anonima: pesquisa.permite_anonima !== false,
    uma_resposta_por_usuario: pesquisa.uma_resposta_por_usuario !== false,
    abre_em: inputDateTimeLocal(pesquisa.abre_em),
    fecha_em: inputDateTimeLocal(pesquisa.fecha_em),
    perguntas: Array.isArray(pesquisa.perguntas)
      ? pesquisa.perguntas.map((pergunta, perguntaIndex) => ({
          local_id:
            pergunta.id ||
            `${Date.now()}-${perguntaIndex}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          tipo: pergunta.tipo || "opcao_unica",
          enunciado: pergunta.enunciado || "",
          ordem:
            pergunta.ordem !== null && pergunta.ordem !== undefined
              ? Number(pergunta.ordem)
              : perguntaIndex,
          obrigatoria: pergunta.obrigatoria !== false,
          limite_caracteres:
            pergunta.limite_caracteres !== null &&
            pergunta.limite_caracteres !== undefined
              ? String(pergunta.limite_caracteres)
              : "",
          opcoes: Array.isArray(pergunta.opcoes)
            ? pergunta.opcoes.map((opcao, opcaoIndex) => ({
                local_id:
                  opcao.id ||
                  `${Date.now()}-${perguntaIndex}-${opcaoIndex}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                texto: opcao.texto || "",
                ordem:
                  opcao.ordem !== null && opcao.ordem !== undefined
                    ? Number(opcao.ordem)
                    : opcaoIndex,
              }))
            : [],
        }))
      : [],
  };
}

/* =========================================================================
   Página
=========================================================================== */

export default function PesquisasAdmin() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);

  const [pesquisas, setPesquisas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroStatus, setFiltroStatus] = useState(persisted.filtroStatus || "");
  const [filtroTipo, setFiltroTipo] = useState(persisted.filtroTipo || "");
  const [filtroContexto, setFiltroContexto] = useState(
    persisted.filtroContexto || ""
  );
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalAberto, setModalAberto] = useState(false);
  const [pesquisaEmEdicao, setPesquisaEmEdicao] = useState(null);

  const [confirmacao, setConfirmacao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [alterandoStatusId, setAlterandoStatusId] = useState(null);

  const [painelResultado, setPainelResultado] = useState(null);
  const [carregandoResultado, setCarregandoResultado] = useState(false);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Pesquisas | Administração";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroStatus,
          filtroTipo,
          filtroContexto,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página
    }
  }, [filtroStatus, filtroTipo, filtroContexto, busca]);

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
      const response = await api.pesquisa.listarAdmin();

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
      if (filtroStatus && String(pesquisa.status) !== String(filtroStatus)) {
        return false;
      }

      if (filtroTipo && String(pesquisa.tipo) !== String(filtroTipo)) {
        return false;
      }

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
            pesquisa.status,
            pesquisa.status_label,
            pesquisa.contexto,
            pesquisa.contexto_label,
            pesquisa.link_externo,
            pesquisa.criado_por_nome,
            pesquisa.evento_titulo,
            pesquisa.turma_nome,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [pesquisas, filtroStatus, filtroTipo, filtroContexto, buscaDebounced]);

  const kpis = useMemo(() => {
    const base = {
      total: pesquisas.length,
      rascunho: 0,
      publicada: 0,
      encerrada: 0,
      arquivada: 0,
      interna: 0,
      externa: 0,
      respostas: 0,
    };

    for (const pesquisa of pesquisas) {
      const status = String(pesquisa.status || "").toLowerCase();
      const tipo = String(pesquisa.tipo || "").toLowerCase();

      if (status === "rascunho") base.rascunho += 1;
      if (status === "publicada") base.publicada += 1;
      if (status === "encerrada") base.encerrada += 1;
      if (status === "arquivada") base.arquivada += 1;
      if (tipo === "interna") base.interna += 1;
      if (tipo === "externa") base.externa += 1;

      base.respostas += Number(pesquisa.total_respostas || 0);
    }

    return base;
  }, [pesquisas]);

  const temFiltrosAtivos = Boolean(
    filtroStatus || filtroTipo || filtroContexto || buscaDebounced
  );

  function limparFiltros() {
    setFiltroStatus("");
    setFiltroTipo("");
    setFiltroContexto("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function removerChip(tipo) {
    if (tipo === "status") setFiltroStatus("");
    if (tipo === "tipo") setFiltroTipo("");
    if (tipo === "contexto") setFiltroContexto("");

    if (tipo === "busca") {
      setBusca("");
      setBuscaDebounced("");
    }

    setLive("Filtro removido.");
  }

  function handleCriar() {
    setPesquisaEmEdicao(null);
    setModalAberto(true);
  }

  async function handleEditar(pesquisa) {
    setErro("");
    setMensagem("");
    setLive("Carregando pesquisa para edição.");

    try {
      const response = await api.pesquisa.obterAdmin(pesquisa.id);
      const completa = unwrapData(response);

      setPesquisaEmEdicao(completa);
      setModalAberto(true);
      setLive("Pesquisa carregada para edição.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar a pesquisa para edição."
      );

      setErro(message);
      setLive("Falha ao carregar pesquisa para edição.");
    }
  }

  function pedirExclusao(pesquisa) {
    setConfirmacao({
      id: pesquisa.id,
      titulo: pesquisa.titulo,
    });
  }

  async function confirmarExclusao() {
    if (!confirmacao?.id) return;

    setExcluindo(true);
    setErro("");
    setMensagem("");
    setLive("Excluindo pesquisa.");

    try {
      await api.pesquisa.excluir(confirmacao.id);

      setPesquisas((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Pesquisa excluída com sucesso.");
      setLive("Pesquisa excluída com sucesso.");
      setConfirmacao(null);
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível excluir a pesquisa.");

      setErro(message);
      setLive("Falha ao excluir pesquisa.");
    } finally {
      setExcluindo(false);
    }
  }

  async function alterarStatus(pesquisa, status) {
    if (!pesquisa?.id || !status || pesquisa.status === status) return;

    setAlterandoStatusId(pesquisa.id);
    setErro("");
    setMensagem("");
    setLive("Alterando status da pesquisa.");

    try {
      const response = await api.pesquisa.alterarStatus(pesquisa.id, status);
      const atualizada = unwrapData(response);

      setPesquisas((current) =>
        current.map((item) =>
          String(item.id) === String(pesquisa.id)
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

      setMensagem("Status da pesquisa atualizado com sucesso.");
      setLive("Status da pesquisa atualizado com sucesso.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível alterar o status da pesquisa."
      );

      setErro(message);
      setLive("Falha ao alterar status da pesquisa.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  async function abrirResultado(pesquisa) {
    setCarregandoResultado(true);
    setPainelResultado({
      pesquisa,
      resultado: null,
      respostas: null,
      erro: "",
    });
    setLive("Carregando resultado da pesquisa.");

    try {
      const [resultadoResponse, respostasResponse] = await Promise.all([
        api.pesquisa.resultado(pesquisa.id),
        api.pesquisa.respostas(pesquisa.id),
      ]);

      setPainelResultado({
        pesquisa,
        resultado: unwrapData(resultadoResponse),
        respostas: unwrapArray(respostasResponse),
        erro: "",
      });

      setLive("Resultado da pesquisa carregado.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar o resultado da pesquisa."
      );

      setPainelResultado({
        pesquisa,
        resultado: null,
        respostas: null,
        erro: message,
      });

      setLive("Falha ao carregar resultado da pesquisa.");
    } finally {
      setCarregandoResultado(false);
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
        painel={painelResultado}
        loading={carregandoResultado}
        onClose={() => {
          if (carregandoResultado) return;
          setPainelResultado(null);
        }}
      />

      <HeaderHero
        totalVisiveis={pesquisasFiltradas.length}
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
                Gestão de pesquisas
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Filtre, publique, encerre e acompanhe pesquisas internas e
                externas da plataforma.
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
              label="Tipo"
              value={filtroTipo}
              onChange={setFiltroTipo}
              placeholder="Todos"
              options={TIPOS_OFICIAIS}
            />

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
              Visíveis:{" "}
              <strong className="font-black text-slate-900 dark:text-white">
                {pesquisasFiltradas.length}
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

                {filtroTipo ? (
                  <Chip
                    text={`Tipo: ${tipoInfo(filtroTipo).label}`}
                    onClear={() => removerChip("tipo")}
                  />
                ) : null}

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

        <section aria-label="Pesquisas cadastradas" className="space-y-3">
          {carregando ? (
            <LoadingList />
          ) : pesquisasFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma pesquisa encontrada"
              descricao="Ajuste os filtros ou cadastre uma nova pesquisa."
            />
          ) : (
            pesquisasFiltradas.map((pesquisa) => (
              <PesquisaCard
                key={pesquisa.id}
                pesquisa={pesquisa}
                reduceMotion={reduceMotion}
                alterandoStatus={String(alterandoStatusId) === String(pesquisa.id)}
                onEditar={() => handleEditar(pesquisa)}
                onExcluir={() => pedirExclusao(pesquisa)}
                onResultado={() => abrirResultado(pesquisa)}
                onAlterarStatus={(status) => alterarStatus(pesquisa, status)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalPesquisa
        aberto={modalAberto}
        pesquisa={pesquisaEmEdicao}
        onClose={() => {
          setModalAberto(false);
          setPesquisaEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setPesquisaEmEdicao(null);
          carregarDados();
        }}
      />
    </div>
  );
}

/* =========================================================================
   Componentes locais — topo/listagem
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
              Administração — Pesquisas
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Gestão de pesquisas institucionais
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
              Crie pesquisas internas, divulgue formulários externos e acompanhe
              respostas para tomada de decisão institucional.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              {totalVisiveis} pesquisa(s) visível(is) nos filtros atuais
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
                Nova pesquisa
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
              <MiniStat label="Total" value={kpis.total} icon={FileQuestion} />
              <MiniStat
                label="Publicadas"
                value={kpis.publicada}
                icon={CheckCircle2}
              />
              <MiniStat
                label="Internas"
                value={kpis.interna}
                icon={ClipboardList}
              />
              <MiniStat
                label="Respostas"
                value={kpis.respostas}
                icon={MessageSquareText}
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
          placeholder="Título, descrição, criador, evento, turma..."
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

function PesquisaCard({
  pesquisa,
  reduceMotion,
  alterandoStatus,
  onEditar,
  onExcluir,
  onResultado,
  onAlterarStatus,
}) {
  const status = statusInfo(pesquisa.status);
  const tipo = tipoInfo(pesquisa.tipo);
  const StatusIcon = status.icon;
  const TipoIcon = tipo.icon;

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
          pesquisa.status === "publicada" && "bg-emerald-600",
          pesquisa.status === "rascunho" && "bg-amber-500",
          pesquisa.status === "encerrada" && "bg-blue-600",
          pesquisa.status === "arquivada" && "bg-slate-500"
        )}
        aria-hidden="true"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {pesquisa.titulo}
            </h3>

            <StatusBadge status={pesquisa.status} />

            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <TipoIcon className="h-3.5 w-3.5" />
              {pesquisa.tipo_label || tipo.label}
            </span>

            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {pesquisa.contexto_label || contextoInfo(pesquisa.contexto)}
            </span>

            {pesquisa.destaque ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
                <Sparkles className="h-3.5 w-3.5" />
                Destaque
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {pesquisa.descricao || "Sem descrição informada."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              icon={Users}
              title="Respostas"
              value={String(pesquisa.total_respostas || 0)}
            />
            <InfoBox
              icon={Layers3}
              title="Contexto"
              value={
                pesquisa.evento_titulo ||
                pesquisa.turma_nome ||
                contextoInfo(pesquisa.contexto)
              }
            />
            <InfoBox
              icon={Clock}
              title="Período"
              value={`${brDateTime(pesquisa.abre_em)} → ${brDateTime(
                pesquisa.fecha_em
              )}`}
            />
            <InfoBox
              icon={ListChecks}
              title="Regras"
              value={[
                pesquisa.obrigatoria ? "Obrigatória" : "Opcional",
                pesquisa.permite_anonima ? "anônima permitida" : "identificada",
              ].join(" · ")}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {pesquisa.link_externo ? (
              <a
                href={pesquisa.link_externo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Link externo
              </a>
            ) : null}

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>

            {pesquisa.criado_por_nome ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Criado por: {pesquisa.criado_por_nome}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <button
            type="button"
            onClick={onResultado}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <BarChart3 className="h-4 w-4" />
            Resultado
          </button>

          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </button>

          {pesquisa.status !== "publicada" ? (
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

          {pesquisa.status !== "encerrada" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("encerrada")}
              disabled={alterandoStatus}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
            >
              {alterandoStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Encerrar
            </button>
          ) : null}

          {pesquisa.status !== "rascunho" ? (
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

          {pesquisa.status !== "arquivada" ? (
            <button
              type="button"
              onClick={() => onAlterarStatus("arquivada")}
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
   Modal de pesquisa
=========================================================================== */

function ModalPesquisa({ aberto, pesquisa, onClose, onSaved }) {
  const isEdicao = Boolean(pesquisa?.id);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;

    setForm(normalizeFormFromPesquisa(pesquisa));
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
  }, [aberto, pesquisa, onClose, salvando]);

  function setCampo(campo, valor) {
    setForm((current) => {
      const next = {
        ...current,
        [campo]: valor,
      };

      if (campo === "tipo") {
        if (valor === "externa") {
          next.perguntas = [];
        } else {
          next.link_externo = "";
          if (!Array.isArray(next.perguntas)) next.perguntas = [];
        }
      }

      if (campo === "contexto") {
        if (valor === "geral") {
          next.evento_id = "";
          next.turma_id = "";
        }

        if (valor === "evento") {
          next.turma_id = "";
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
        {
          ...criarPerguntaVazia(),
          ordem: current.perguntas?.length || 0,
        },
      ],
    }));
  }

  function removerPergunta(localId) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || [])
        .filter((item) => item.local_id !== localId)
        .map((item, index) => ({
          ...item,
          ordem: index,
        })),
    }));
  }

  function atualizarPergunta(localId, campo, valor) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) => {
        if (pergunta.local_id !== localId) return pergunta;

        const next = {
          ...pergunta,
          [campo]: valor,
        };

        if (campo === "tipo") {
          if (perguntaExigeOpcoes(valor)) {
            next.opcoes =
              Array.isArray(next.opcoes) && next.opcoes.length >= 2
                ? next.opcoes
                : [criarOpcaoVazia(0), criarOpcaoVazia(1)];
          } else {
            next.opcoes = [];
          }

          if (valor === "texto_curto") {
            next.limite_caracteres = next.limite_caracteres || "200";
          }

          if (valor === "texto_longo") {
            next.limite_caracteres = next.limite_caracteres || "1000";
          }

          if (valor === "escala") {
            next.limite_caracteres = "";
          }
        }

        return next;
      }),
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

  function atualizarOpcao(perguntaLocalId, opcaoLocalId, campo, valor) {
    setForm((current) => ({
      ...current,
      perguntas: (current.perguntas || []).map((pergunta) => {
        if (pergunta.local_id !== perguntaLocalId) return pergunta;

        return {
          ...pergunta,
          opcoes: (pergunta.opcoes || []).map((opcao) =>
            opcao.local_id === opcaoLocalId ? { ...opcao, [campo]: valor } : opcao
          ),
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

  function validar() {
    if (!cleanStr(form.titulo) || cleanStr(form.titulo).length < 3) {
      return "Informe o título da pesquisa com pelo menos 3 caracteres.";
    }

    if (!TIPOS_OFICIAIS.some((item) => item.value === form.tipo)) {
      return "Selecione um tipo oficial de pesquisa.";
    }

    if (!STATUS_OFICIAL.some((item) => item.value === form.status)) {
      return "Selecione um status oficial.";
    }

    if (!CONTEXTOS_OFICIAIS.some((item) => item.value === form.contexto)) {
      return "Selecione um contexto oficial.";
    }

    if (form.contexto === "geral" && (form.evento_id || form.turma_id)) {
      return "Pesquisa geral não deve estar vinculada a evento ou turma.";
    }

    if (form.contexto === "evento" && !form.evento_id) {
      return "Informe o evento da pesquisa.";
    }

    if (form.contexto === "evento" && form.turma_id) {
      return "Pesquisa de evento não deve estar vinculada diretamente a turma.";
    }

    if (form.contexto === "turma" && !form.turma_id) {
      return "Informe a turma da pesquisa.";
    }

    if (form.tipo === "externa") {
      if (!isHttpUrl(form.link_externo)) {
        return "Pesquisa externa exige um link válido começando com http:// ou https://.";
      }
    }

    if (form.tipo === "interna") {
      if (form.link_externo) {
        return "Pesquisa interna não deve possuir link externo.";
      }

      if (!Array.isArray(form.perguntas) || form.perguntas.length === 0) {
        return "Pesquisa interna precisa ter ao menos uma pergunta.";
      }

      for (let index = 0; index < form.perguntas.length; index += 1) {
        const pergunta = form.perguntas[index];

        if (!TIPOS_PERGUNTA.some((item) => item.value === pergunta.tipo)) {
          return `Tipo inválido na pergunta ${index + 1}.`;
        }

        if (!cleanStr(pergunta.enunciado) || cleanStr(pergunta.enunciado).length < 3) {
          return `Informe o enunciado da pergunta ${index + 1}.`;
        }

        if (pergunta.limite_caracteres) {
          const limite = Number(pergunta.limite_caracteres);

          if (!Number.isInteger(limite) || limite <= 0) {
            return `Limite de caracteres inválido na pergunta ${index + 1}.`;
          }
        }

        if (perguntaExigeOpcoes(pergunta.tipo)) {
          const opcoes = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];

          if (opcoes.length < 2) {
            return `A pergunta ${index + 1} precisa ter pelo menos duas opções.`;
          }

          for (let optionIndex = 0; optionIndex < opcoes.length; optionIndex += 1) {
            if (!cleanStr(opcoes[optionIndex].texto)) {
              return `Informe o texto da opção ${optionIndex + 1} da pergunta ${
                index + 1
              }.`;
            }
          }
        }
      }
    }

    if (form.abre_em && form.fecha_em) {
      const abre = new Date(form.abre_em);
      const fecha = new Date(form.fecha_em);

      if (
        !Number.isNaN(abre.getTime()) &&
        !Number.isNaN(fecha.getTime()) &&
        fecha <= abre
      ) {
        return "A data de fechamento deve ser posterior à data de abertura.";
      }
    }

    return null;
  }

  function montarPayload() {
    const perguntas =
      form.tipo === "interna"
        ? (form.perguntas || []).map((pergunta, perguntaIndex) => ({
            tipo: pergunta.tipo,
            enunciado: cleanStr(pergunta.enunciado),
            ordem: perguntaIndex,
            obrigatoria: Boolean(pergunta.obrigatoria),
            limite_caracteres:
              pergunta.limite_caracteres === "" ||
              pergunta.limite_caracteres === null ||
              pergunta.limite_caracteres === undefined
                ? null
                : Number(pergunta.limite_caracteres),
            opcoes: perguntaExigeOpcoes(pergunta.tipo)
              ? (pergunta.opcoes || []).map((opcao, opcaoIndex) => ({
                  texto: cleanStr(opcao.texto),
                  ordem: opcaoIndex,
                }))
              : [],
          }))
        : [];

    return {
      titulo: cleanStr(form.titulo),
      descricao: cleanStr(form.descricao) || null,
      tipo: form.tipo,
      status: form.status,
      contexto: form.contexto,
      evento_id: form.contexto === "evento" ? Number(form.evento_id) : null,
      turma_id: form.contexto === "turma" ? Number(form.turma_id) : null,
      link_externo: form.tipo === "externa" ? cleanStr(form.link_externo) : null,
      exibir_inicio: Boolean(form.exibir_inicio),
      destaque: Boolean(form.destaque),
      obrigatoria: Boolean(form.obrigatoria),
      permite_anonima: Boolean(form.permite_anonima),
      uma_resposta_por_usuario: Boolean(form.uma_resposta_por_usuario),
      abre_em: form.abre_em || null,
      fecha_em: form.fecha_em || null,
      perguntas,
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
    setA11y(isEdicao ? "Salvando alterações." : "Cadastrando pesquisa.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.pesquisa.atualizar(pesquisa.id, payload);
      } else {
        await api.pesquisa.criar(payload);
      }

      setA11y("Pesquisa salva com sucesso.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível salvar a pesquisa.");

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
        aria-labelledby="modal-pesquisa-title"
        aria-describedby="modal-pesquisa-desc"
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.22),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                Pesquisas
              </div>

              <h2
                id="modal-pesquisa-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                <FileQuestion className="h-5 w-5" />
                {isEdicao ? "Editar pesquisa" : "Nova pesquisa"}
              </h2>

              <p
                id="modal-pesquisa-desc"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
              >
                Crie pesquisa externa por link ou pesquisa interna com perguntas
                e respostas dentro da plataforma.
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
              Dados da pesquisa
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Título" required>
                <input
                  ref={firstRef}
                  value={form.titulo}
                  onChange={(event) => setCampo("titulo", event.target.value)}
                  className={inputClass()}
                  placeholder="Ex.: Pesquisa de satisfação da capacitação"
                  maxLength={220}
                  disabled={salvando}
                />
              </Field>

              <Field label="Tipo" required>
                <select
                  value={form.tipo}
                  onChange={(event) => setCampo("tipo", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                >
                  {TIPOS_OFICIAIS.map((item) => (
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

              <Field label="Contexto" required>
                <select
                  value={form.contexto}
                  onChange={(event) => setCampo("contexto", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                >
                  {CONTEXTOS_OFICIAIS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
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

              {form.tipo === "externa" ? (
                <div className="md:col-span-2">
                  <Field label="Link externo" required>
                    <input
                      value={form.link_externo}
                      onChange={(event) =>
                        setCampo("link_externo", event.target.value)
                      }
                      className={inputClass()}
                      placeholder="https://forms..."
                      disabled={salvando}
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="Abre em">
                <input
                  type="datetime-local"
                  value={form.abre_em}
                  onChange={(event) => setCampo("abre_em", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                />
              </Field>

              <Field label="Fecha em">
                <input
                  type="datetime-local"
                  value={form.fecha_em}
                  onChange={(event) => setCampo("fecha_em", event.target.value)}
                  className={inputClass()}
                  disabled={salvando}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Descrição">
                  <textarea
                    value={form.descricao}
                    onChange={(event) => setCampo("descricao", event.target.value)}
                    rows={4}
                    className={textareaClass()}
                    placeholder="Explique o objetivo da pesquisa."
                    disabled={salvando}
                  />
                </Field>
              </div>

              <div className="md:col-span-2 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2 lg:grid-cols-4">
                <CheckboxField
                  label="Exibir no início"
                  checked={form.exibir_inicio}
                  onChange={(value) => setCampo("exibir_inicio", value)}
                  disabled={salvando}
                />

                <CheckboxField
                  label="Destaque"
                  checked={form.destaque}
                  onChange={(value) => setCampo("destaque", value)}
                  disabled={salvando}
                />

                <CheckboxField
                  label="Obrigatória"
                  checked={form.obrigatoria}
                  onChange={(value) => setCampo("obrigatoria", value)}
                  disabled={salvando}
                />

                <CheckboxField
                  label="Permitir anônima"
                  checked={form.permite_anonima}
                  onChange={(value) => setCampo("permite_anonima", value)}
                  disabled={salvando}
                />

                <CheckboxField
                  label="Uma resposta por usuário"
                  checked={form.uma_resposta_por_usuario}
                  onChange={(value) =>
                    setCampo("uma_resposta_por_usuario", value)
                  }
                  disabled={salvando}
                />
              </div>
            </div>
          </section>

          {form.tipo === "interna" ? (
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Perguntas da pesquisa
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Pesquisas internas precisam ter pelo menos uma pergunta para
                    serem publicadas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={adicionarPergunta}
                  disabled={salvando}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar pergunta
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {form.perguntas.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                    Nenhuma pergunta adicionada.
                  </div>
                ) : (
                  form.perguntas.map((pergunta, index) => (
                    <PerguntaEditor
                      key={pergunta.local_id}
                      index={index}
                      pergunta={pergunta}
                      salvando={salvando}
                      onChange={(campo, valor) =>
                        atualizarPergunta(pergunta.local_id, campo, valor)
                      }
                      onRemove={() => removerPergunta(pergunta.local_id)}
                      onAddOpcao={() => adicionarOpcao(pergunta.local_id)}
                      onChangeOpcao={(opcaoLocalId, campo, valor) =>
                        atualizarOpcao(
                          pergunta.local_id,
                          opcaoLocalId,
                          campo,
                          valor
                        )
                      }
                      onRemoveOpcao={(opcaoLocalId) =>
                        removerOpcao(pergunta.local_id, opcaoLocalId)
                      }
                    />
                  ))
                )}
              </div>
            </section>
          ) : null}
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
                  {isEdicao ? "Salvar alterações" : "Cadastrar pesquisa"}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PerguntaEditor({
  index,
  pergunta,
  salvando,
  onChange,
  onRemove,
  onAddOpcao,
  onChangeOpcao,
  onRemoveOpcao,
}) {
  const exigeOpcoes = perguntaExigeOpcoes(pergunta.tipo);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Pergunta {index + 1}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tipoPerguntaLabel(pergunta.tipo)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={salvando}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <Trash2 className="h-4 w-4" />
          Remover pergunta
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo da pergunta" required>
          <select
            value={pergunta.tipo}
            onChange={(event) => onChange("tipo", event.target.value)}
            className={inputClass()}
            disabled={salvando}
          >
            {TIPOS_PERGUNTA.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Limite de caracteres">
          <input
            type="number"
            min="1"
            value={pergunta.limite_caracteres}
            onChange={(event) => onChange("limite_caracteres", event.target.value)}
            className={inputClass()}
            disabled={salvando || pergunta.tipo === "escala" || exigeOpcoes}
            placeholder={exigeOpcoes || pergunta.tipo === "escala" ? "Não se aplica" : "Ex.: 200"}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Enunciado" required>
            <textarea
              value={pergunta.enunciado}
              onChange={(event) => onChange("enunciado", event.target.value)}
              rows={3}
              className={textareaClass()}
              placeholder="Digite a pergunta..."
              disabled={salvando}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <CheckboxField
            label="Pergunta obrigatória"
            checked={pergunta.obrigatoria}
            onChange={(value) => onChange("obrigatoria", value)}
            disabled={salvando}
          />
        </div>
      </div>

      {exigeOpcoes ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Opções
            </p>

            <button
              type="button"
              onClick={onAddOpcao}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              <Plus className="h-4 w-4" />
              Adicionar opção
            </button>
          </div>

          <div className="space-y-2">
            {(pergunta.opcoes || []).map((opcao, opcaoIndex) => (
              <div
                key={opcao.local_id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <input
                  value={opcao.texto}
                  onChange={(event) =>
                    onChangeOpcao(opcao.local_id, "texto", event.target.value)
                  }
                  className={inputClass()}
                  placeholder={`Opção ${opcaoIndex + 1}`}
                  disabled={salvando}
                />

                <button
                  type="button"
                  onClick={() => onRemoveOpcao(opcao.local_id)}
                  disabled={salvando || pergunta.opcoes.length <= 2}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================================
   Resultado / respostas
=========================================================================== */

function ResultadoDrawer({ painel, loading, onClose }) {
  if (!painel) return null;

  const resultado = painel.resultado || null;
  const respostas = painel.respostas || [];

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
        aria-labelledby="resultado-pesquisa-title"
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950"
      >
        <header className="border-b border-slate-200 bg-slate-950 p-5 text-white dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                <BarChart3 className="h-3.5 w-3.5" />
                Resultado
              </div>

              <h2 id="resultado-pesquisa-title" className="text-xl font-black">
                {painel.pesquisa?.titulo || "Pesquisa"}
              </h2>

              <p className="mt-1 text-sm text-white/70">
                Resultado agregado e respostas individuais.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
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
              <Skeleton height={90} />
              <Skeleton height={90} />
              <Skeleton height={90} />
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
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Resumo
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <InfoBox
                    icon={Users}
                    title="Respostas"
                    value={String(resultado?.total_respostas || 0)}
                  />
                  <InfoBox
                    icon={ClipboardList}
                    title="Perguntas"
                    value={String(resultado?.perguntas?.length || 0)}
                  />
                  <InfoBox
                    icon={Eye}
                    title="Tipo"
                    value={resultado?.pesquisa?.tipo_label || "—"}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Resultado agregado
                </h3>

                <div className="mt-4 space-y-4">
                  {(resultado?.perguntas || []).length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum resultado agregado disponível.
                    </p>
                  ) : (
                    resultado.perguntas.map((pergunta) => (
                      <ResultadoPergunta
                        key={pergunta.pergunta_id}
                        pergunta={pergunta}
                      />
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Respostas individuais
                </h3>

                <div className="mt-4 space-y-3">
                  {respostas.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma resposta registrada.
                    </p>
                  ) : (
                    respostas.map((resposta) => (
                      <RespostaItem key={resposta.id} resposta={resposta} />
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

function ResultadoPergunta({ pergunta }) {
  const total = Number(pergunta.total_respostas || 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-col gap-1">
        <p className="font-black text-slate-900 dark:text-white">
          {pergunta.enunciado}
        </p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {pergunta.tipo_label || tipoPerguntaLabel(pergunta.tipo)} · {total} resposta(s)
        </p>
      </div>

      {pergunta.opcoes?.length ? (
        <div className="mt-4 space-y-2">
          {pergunta.opcoes.map((opcao) => {
            const percentual = total > 0 ? Math.round((Number(opcao.total) / total) * 100) : 0;

            return (
              <div key={opcao.opcao_id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {opcao.texto}
                  </span>
                  <span className="font-black text-slate-900 dark:text-white">
                    {opcao.total} · {percentual}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${percentual}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {pergunta.textos?.length ? (
        <div className="mt-4 space-y-2">
          {pergunta.textos.slice(0, 12).map((item, index) => (
            <div
              key={`${item.texto}-${index}`}
              className="rounded-2xl bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              “{item.texto}”{" "}
              {Number(item.total) > 1 ? (
                <span className="font-black">({item.total}x)</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {pergunta.numeros?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {pergunta.numeros.map((item) => (
            <span
              key={item.numero}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              Nota {item.numero}: {item.total}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RespostaItem({ resposta }) {
  return (
    <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-900 dark:text-white">
            {resposta.anonima ? "Resposta anônima" : resposta.usuario_nome || "Usuário"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enviada em {brDateTime(resposta.enviada_em)}
          </p>
        </div>

        <ChevronDown className="h-4 w-4 text-slate-400" />
      </summary>

      <div className="mt-4 space-y-2">
        {(resposta.itens || []).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-white p-3 text-sm dark:bg-slate-900"
          >
            <p className="font-bold text-slate-900 dark:text-white">
              {item.enunciado}
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {item.opcao_texto ||
                item.resposta_texto ||
                item.resposta_numero ||
                "—"}
            </p>
          </div>
        ))}
      </div>
    </details>
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
        aria-labelledby="confirmar-exclusao-pesquisa-title"
        aria-describedby="confirmar-exclusao-pesquisa-desc"
        className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-900 via-red-800 to-amber-700 p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="confirmar-exclusao-pesquisa-title"
                className="flex items-center gap-2 text-xl font-black tracking-tight"
              >
                <AlertCircle className="h-5 w-5" />
                Excluir pesquisa?
              </h3>

              <p
                id="confirmar-exclusao-pesquisa-desc"
                className="mt-2 text-sm leading-relaxed text-white/90"
              >
                Tem certeza que deseja excluir{" "}
                {titulo ? <strong>“{titulo}”</strong> : "esta pesquisa"}?
                Esta ação remove perguntas, opções e respostas vinculadas.
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
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        disabled={disabled}
      />
      {label}
    </label>
  );
}

function inputClass() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}

function textareaClass() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";
}