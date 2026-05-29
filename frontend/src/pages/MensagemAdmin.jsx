/**
 * ✅ frontend/src/pages/MensagemAdmin.jsx — v2.1
 * Atualizado em: 29/05/2026
 * Plataforma Escola da Saúde
 *
 * Página administrativa da Caixa de Mensagens Institucional.
 *
 * Responsabilidades:
 * - Exibir resumo administrativo da caixa de mensagens.
 * - Listar conversas abertas pelos usuários.
 * - Filtrar por status, categoria, prioridade, usuário, responsável e período.
 * - Visualizar histórico completo da conversa.
 * - Responder como administrador.
 * - Criar observação interna não visível ao usuário.
 * - Alterar status, prioridade, atribuição e encerramento.
 *
 * Contratos aplicados:
 * - Service oficial futuro: api.mensagem.*
 * - Backend oficial futuro: /api/mensagem
 * - Tabelas oficiais:
 *   - mensagem_conversas
 *   - mensagem_respostas
 * - Categorias oficiais:
 *   - duvida
 *   - sugestao
 *   - problema
 *   - certificado
 *   - inscricao
 *   - presenca
 *   - reserva
 *   - curso
 *   - pesquisa
 *   - interacao
 *   - outro
 * - Status oficiais:
 *   - aberta
 *   - em_atendimento
 *   - respondida
 *   - encerrada
 *   - arquivada
 * - Prioridades oficiais:
 *   - baixa
 *   - normal
 *   - alta
 *   - urgente
 * - Sem montagem direta de /api
 * - Sem aliases
 * - Sem legado
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Inbox,
  Layers,
  MessageCircle,
  MessageSquareReply,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import api from "../services/api";
import Botao from "../components/ui/Botao";
import Modal from "../components/ui/Modal";
import HeaderHero from "../components/layout/HeaderHero";
import Footer from "../components/layout/Footer";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const CATEGORIAS = [
  { value: "", label: "Todas" },
  { value: "duvida", label: "Dúvida" },
  { value: "sugestao", label: "Sugestão" },
  { value: "problema", label: "Problema" },
  { value: "certificado", label: "Certificado" },
  { value: "inscricao", label: "Inscrição" },
  { value: "presenca", label: "Presença" },
  { value: "reserva", label: "Reserva de sala" },
  { value: "curso", label: "Curso" },
  { value: "pesquisa", label: "Pesquisa" },
  { value: "interacao", label: "Interação" },
  { value: "outro", label: "Outro" },
];

const STATUS = [
  { value: "", label: "Todos" },
  { value: "aberta", label: "Aberta" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "respondida", label: "Respondida" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const STATUS_EDICAO = [
  { value: "aberta", label: "Aberta" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "respondida", label: "Respondida" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const PRIORIDADES = [
  { value: "", label: "Todas" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const PRIORIDADES_EDICAO = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const LIMITES = [20, 50, 100, 200];

const STATUS_FINAIS = new Set(["encerrada", "arquivada"]);

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatarDataHora(valor) {
  if (!valor) return "—";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(valor));
  } catch {
    return "—";
  }
}

function labelCategoria(value) {
  return CATEGORIAS.find((item) => item.value === value)?.label || value || "—";
}

function labelStatus(value) {
  return STATUS.find((item) => item.value === value)?.label || value || "—";
}

function labelPrioridade(value) {
  return PRIORIDADES.find((item) => item.value === value)?.label || value || "—";
}

function normalizarResumo(resumo) {
  const geral = resumo?.geral || {};

  return {
    total_conversas: Number(geral.total_conversas || 0),
    abertas: Number(geral.abertas || 0),
    em_atendimento: Number(geral.em_atendimento || 0),
    respondidas: Number(geral.respondidas || 0),
    encerradas: Number(geral.encerradas || 0),
    arquivadas: Number(geral.arquivadas || 0),
    urgentes: Number(geral.urgentes || 0),
    abertas_ha_mais_de_3_dias: Number(geral.abertas_ha_mais_de_3_dias || 0),
    respondidas_sem_encerramento_ha_mais_de_7_dias: Number(
      geral.respondidas_sem_encerramento_ha_mais_de_7_dias || 0
    ),
    primeira_conversa: geral.primeira_conversa || null,
    ultima_conversa: geral.ultima_conversa || null,
    por_categoria: Array.isArray(resumo?.por_categoria) ? resumo.por_categoria : [],
    por_prioridade: Array.isArray(resumo?.por_prioridade)
      ? resumo.por_prioridade
      : [],
  };
}

function BadgeStatus({ status }) {
  const mapa = {
    aberta:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    em_atendimento:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    respondida:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    encerrada:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
    arquivada:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        mapa[status] || mapa.aberta
      )}
    >
      {labelStatus(status)}
    </span>
  );
}

function BadgePrioridade({ prioridade }) {
  const mapa = {
    baixa:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
    normal:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    alta:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
    urgente:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        mapa[prioridade] || mapa.normal
      )}
    >
      {labelPrioridade(prioridade)}
    </span>
  );
}

function CardResumo({ icone: Icone, titulo, valor, detalhe, destaque }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {titulo}
          </p>

          <p
            className={cx(
              "mt-2 text-2xl font-black tracking-tight",
              destaque || "text-slate-950 dark:text-white"
            )}
          >
            {valor}
          </p>

          {detalhe ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {detalhe}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Icone className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function ConversaAdminCard({ conversa, selecionada, onAbrir }) {
  const semResposta =
    conversa.status === "aberta" || conversa.status === "em_atendimento";

  return (
    <article
      className={cx(
        "rounded-2xl border p-4 shadow-sm transition",
        selecionada
          ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/70"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <BadgeStatus status={conversa.status} />
            <BadgePrioridade prioridade={conversa.prioridade} />
            {semResposta ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Pendência
              </span>
            ) : null}
          </div>

          <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
            {conversa.assunto}
          </h3>

          <div className="mt-2 grid gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {conversa.usuario_nome || "Usuário"} · ID {conversa.usuario_id}
            </span>

            <span className="inline-flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {labelCategoria(conversa.categoria)}
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              Atualizada em {formatarDataHora(conversa.atualizado_em)}
            </span>

            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {Number(conversa.total_respostas || 0)} resposta(s)
            </span>
          </div>

          {conversa.atribuido_para_nome ? (
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Responsável: {conversa.atribuido_para_nome}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onAbrir(conversa)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Eye className="h-4 w-4" />
          Ver
        </button>
      </div>
    </article>
  );
}

function RespostaItem({ resposta }) {
  const ehAdmin = resposta.perfil_autor === "administrador";
  const ehInterna = resposta.visivel_usuario === false;

  return (
    <article
      className={cx(
        "rounded-2xl border p-4",
        ehAdmin
          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
        ehInterna &&
          "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      )}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cx(
              "rounded-full p-2",
              ehAdmin
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
                : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            )}
          >
            <UserRound className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-black text-slate-950 dark:text-white">
              {resposta.autor_nome || "Usuário"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resposta.perfil_autor} · {formatarDataHora(resposta.criado_em)}
            </p>
          </div>
        </div>

        {ehInterna ? (
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Interna
          </span>
        ) : (
          <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-black text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Visível ao usuário
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
        {resposta.mensagem}
      </p>
    </article>
  );
}

function BarraAcoesPagina({ atualizando, onAtualizar }) {
  return (
    <section
      aria-label="Ações da caixa de mensagens administrativa"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950 dark:text-white">
            Atendimento institucional
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Acompanhe, responda, priorize e encerre conversas com rastreabilidade.
          </p>
        </div>

        <button
          type="button"
          onClick={onAtualizar}
          disabled={atualizando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw
            className={cx("h-4 w-4", atualizando && "animate-spin")}
            aria-hidden="true"
          />
          {atualizando ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
    </section>
  );
}

export default function MensagemAdmin() {
  const [conversas, setConversas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    pagina: 1,
    limite: 50,
    total_paginas: 1,
  });

  const [filtros, setFiltros] = useState({
    status: "",
    categoria: "",
    prioridade: "",
    usuario_id: "",
    atribuido_para: "",
    busca: "",
    data_inicio: "",
    data_fim: "",
    pagina: 1,
    limite: 50,
  });

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");

  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const [resposta, setResposta] = useState("");
  const [visivelUsuario, setVisivelUsuario] = useState(true);
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  const [editando, setEditando] = useState({
    status: "aberta",
    prioridade: "normal",
    atribuido_para: "",
    motivo_encerramento: "",
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const resumoNormalizado = useMemo(() => normalizarResumo(resumo), [resumo]);

  const conversaAtiva = detalhe?.conversa
    ? !STATUS_FINAIS.has(detalhe.conversa.status)
    : false;

  const carregarResumo = useCallback(async () => {
    const respostaApi = await api.mensagem.resumoAdmin();
    setResumo(respostaApi?.data || null);
  }, []);

  const carregarConversas = useCallback(
    async ({ silencioso = false } = {}) => {
      try {
        if (silencioso) {
          setAtualizando(true);
        } else {
          setCarregando(true);
        }

        setErro("");

        const params = Object.fromEntries(
          Object.entries(filtros).filter(([, valor]) => valor !== "" && valor !== null)
        );

        const respostaApi = await api.mensagem.listarAdmin(params);

        setConversas(Array.isArray(respostaApi?.data) ? respostaApi.data : []);
        setMeta({
          total: respostaApi?.meta?.total || 0,
          pagina: respostaApi?.meta?.pagina || filtros.pagina || 1,
          limite: respostaApi?.meta?.limite || filtros.limite || 50,
          total_paginas: respostaApi?.meta?.total_paginas || 1,
        });

        await carregarResumo();
      } catch (error) {
        console.error("[MensagemAdmin] Falha ao carregar conversas:", error);

        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar a caixa de mensagens administrativa."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [filtros, carregarResumo]
  );

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  function atualizarFiltro(campo, valor) {
    setFiltros((anterior) => ({
      ...anterior,
      [campo]: valor,
      pagina: campo === "pagina" ? valor : 1,
    }));
  }

  function limparFiltros() {
    setFiltros({
      status: "",
      categoria: "",
      prioridade: "",
      usuario_id: "",
      atribuido_para: "",
      busca: "",
      data_inicio: "",
      data_fim: "",
      pagina: 1,
      limite: 50,
    });
  }

  function preencherEdicao(conversa) {
    setEditando({
      status: conversa?.status || "aberta",
      prioridade: conversa?.prioridade || "normal",
      atribuido_para: conversa?.atribuido_para ? String(conversa.atribuido_para) : "",
      motivo_encerramento: conversa?.motivo_encerramento || "",
    });
  }

  async function abrirConversa(conversa) {
    try {
      setConversaSelecionada(conversa);
      setCarregandoDetalhe(true);
      setDetalhe(null);
      setResposta("");
      setVisivelUsuario(true);
      preencherEdicao(conversa);

      const respostaApi = await api.mensagem.obterAdmin(conversa.id);
      const dados = respostaApi?.data || null;

      setDetalhe(dados);

      if (dados?.conversa) {
        preencherEdicao(dados.conversa);
      }
    } catch (error) {
      console.error("[MensagemAdmin] Falha ao abrir conversa:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível carregar a conversa selecionada."
      );
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function recarregarDetalhe() {
    if (!detalhe?.conversa?.id && !conversaSelecionada?.id) return;

    const id = detalhe?.conversa?.id || conversaSelecionada?.id;
    const respostaApi = await api.mensagem.obterAdmin(id);
    const dados = respostaApi?.data || null;

    setDetalhe(dados);

    if (dados?.conversa) {
      preencherEdicao(dados.conversa);
    }
  }

  async function enviarResposta(event) {
    event.preventDefault();

    if (!detalhe?.conversa?.id) {
      notifyWarning("Selecione uma conversa antes de responder.");
      return;
    }

    if (!conversaAtiva) {
      notifyWarning("Esta conversa já foi encerrada ou arquivada.");
      return;
    }

    if (resposta.trim().length < 2) {
      notifyWarning("Escreva a resposta antes de enviar.");
      return;
    }

    try {
      setEnviandoResposta(true);

      const respostaApi = await api.mensagem.responderAdmin(detalhe.conversa.id, {
  mensagem: resposta.trim(),
  visivel_usuario: visivelUsuario,
});

      notifySuccess(respostaApi?.message || "Resposta enviada com sucesso.");

      setResposta("");
      setVisivelUsuario(true);

      await recarregarDetalhe();
      await carregarConversas({ silencioso: true });
    } catch (error) {
      console.error("[MensagemAdmin] Falha ao responder conversa:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível enviar a resposta. Verifique a conversa e tente novamente."
      );
    } finally {
      setEnviandoResposta(false);
    }
  }

  function validarEdicao() {
    if (!editando.status) {
      notifyWarning("Selecione um status oficial.");
      return false;
    }

    if (!editando.prioridade) {
      notifyWarning("Selecione uma prioridade oficial.");
      return false;
    }

    if (
      STATUS_FINAIS.has(editando.status) &&
      editando.motivo_encerramento.trim().length < 5
    ) {
      notifyWarning(
        "Para encerrar ou arquivar, informe um motivo com pelo menos 5 caracteres."
      );
      return false;
    }

    return true;
  }

  async function salvarEdicao(event) {
    event.preventDefault();

    if (!detalhe?.conversa?.id) {
      notifyWarning("Selecione uma conversa antes de atualizar.");
      return;
    }

    if (!validarEdicao()) return;

    try {
      setSalvandoEdicao(true);

      let respostaApi = null;

respostaApi = await api.mensagem.alterarStatus(detalhe.conversa.id, {
  status: editando.status,
  prioridade: editando.prioridade,
  motivo_encerramento: STATUS_FINAIS.has(editando.status)
    ? editando.motivo_encerramento.trim()
    : null,
});

await api.mensagem.atribuir(
  detalhe.conversa.id,
  editando.atribuido_para ? Number(editando.atribuido_para) : null
);
      notifySuccess(respostaApi?.message || "Conversa atualizada com sucesso.");

      await recarregarDetalhe();
      await carregarConversas({ silencioso: true });
    } catch (error) {
      console.error("[MensagemAdmin] Falha ao atualizar conversa:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível atualizar a conversa. Confira status, prioridade e responsável."
      );
    } finally {
      setSalvandoEdicao(false);
    }
  }

  const paginaAtual = Number(meta.pagina || filtros.pagina || 1);
  const totalPaginas = Math.max(Number(meta.total_paginas || 1), 1);

if (carregando) {
  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <HeaderHero
          titulo="Caixa de Mensagens Administrativa"
          subtitulo="Acompanhe dúvidas, sugestões e problemas enviados pelos usuários."
          icone={MessageCircle}
          tamanho="md"
          raio="xl"
        />
      </div>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <CarregandoSkeleton
          linhas={8}
          titulo="Carregando caixa de mensagens administrativa"
          subtitulo="Buscando conversas, pendências e resumo institucional."
        />
      </section>

      <Footer />
    </main>
  );
}

  if (erro) {
  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <HeaderHero
          titulo="Caixa de Mensagens Administrativa"
          subtitulo="Acompanhe dúvidas, sugestões e problemas enviados pelos usuários."
          icone={MessageCircle}
          tamanho="md"
          raio="xl"
        />
      </div>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <ErroCarregamento
          titulo="Não foi possível carregar a caixa de mensagens"
          mensagem={erro}
          onTentarNovamente={() => carregarConversas()}
        />
      </section>

      <Footer />
    </main>
  );
}

 return (
  <main className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-black dark:text-white">
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <HeaderHero
        titulo="Caixa de Mensagens Administrativa"
        subtitulo="Acompanhe dúvidas, sugestões e problemas enviados pelos usuários. Responda, registre observações internas, priorize atendimentos e encerre conversas com rastreabilidade."
        icone={MessageCircle}
        tamanho="md"
        raio="xl"
      />
    </div>

    <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <BarraAcoesPagina
        atualizando={atualizando}
        onAtualizar={() => carregarConversas({ silencioso: true })}
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          icone={Inbox}
          titulo="Total"
          valor={resumoNormalizado.total_conversas}
          detalhe="Conversas registradas"
        />

        <CardResumo
          icone={AlertTriangle}
          titulo="Abertas"
          valor={resumoNormalizado.abertas}
          detalhe="Aguardam atendimento"
          destaque="text-blue-700 dark:text-blue-300"
        />

        <CardResumo
          icone={Sparkles}
          titulo="Urgentes"
          valor={resumoNormalizado.urgentes}
          detalhe="Prioridade máxima"
          destaque="text-red-700 dark:text-red-300"
        />

        <CardResumo
          icone={CheckCircle2}
          titulo="Respondidas"
          valor={resumoNormalizado.respondidas}
          detalhe="Com resposta administrativa"
          destaque="text-emerald-700 dark:text-emerald-300"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Por categoria
            </h2>
          </div>

          {resumoNormalizado.por_categoria.length > 0 ? (
            <div className="space-y-3">
              {resumoNormalizado.por_categoria.map((item) => {
                const percentual =
                  resumoNormalizado.total_conversas > 0
                    ? Math.round(
                        (Number(item.total || 0) /
                          resumoNormalizado.total_conversas) *
                          100
                      )
                    : 0;

                return (
                  <div key={item.categoria} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {labelCategoria(item.categoria)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-slate-800 dark:bg-slate-200"
                        style={{ width: `${Math.max(percentual, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ainda não há categorias registradas.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Pendências operacionais
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Abertas há mais de 3 dias
              </p>
              <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">
                {resumoNormalizado.abertas_ha_mais_de_3_dias}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Respondidas sem encerramento
              </p>
              <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">
                {
                  resumoNormalizado.respondidas_sem_encerramento_ha_mais_de_7_dias
                }
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Em atendimento
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                {resumoNormalizado.em_atendimento}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Finalizadas
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                {resumoNormalizado.encerradas + resumoNormalizado.arquivadas}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <Filter className="h-4 w-4" />
              Filtros administrativos
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Localize conversas por status, categoria, prioridade, responsável,
              usuário ou período.
            </p>
          </div>

          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Busca
            </span>
            <input
              type="text"
              value={filtros.busca}
              onChange={(event) => atualizarFiltro("busca", event.target.value)}
              placeholder="Assunto, nome ou e-mail"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Status
            </span>
            <select
              value={filtros.status}
              onChange={(event) => atualizarFiltro("status", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {STATUS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Categoria
            </span>
            <select
              value={filtros.categoria}
              onChange={(event) => atualizarFiltro("categoria", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {CATEGORIAS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Prioridade
            </span>
            <select
              value={filtros.prioridade}
              onChange={(event) => atualizarFiltro("prioridade", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {PRIORIDADES.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Usuário ID
            </span>
            <input
              type="number"
              min="1"
              value={filtros.usuario_id}
              onChange={(event) => atualizarFiltro("usuario_id", event.target.value)}
              placeholder="Ex.: 4049"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Responsável ID
            </span>
            <input
              type="number"
              min="1"
              value={filtros.atribuido_para}
              onChange={(event) =>
                atualizarFiltro("atribuido_para", event.target.value)
              }
              placeholder="Ex.: 17"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Data inicial
            </span>
            <input
              type="date"
              value={filtros.data_inicio}
              onChange={(event) => atualizarFiltro("data_inicio", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Data final
            </span>
            <input
              type="date"
              value={filtros.data_fim}
              onChange={(event) => atualizarFiltro("data_fim", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Itens por página
            </span>
            <select
              value={filtros.limite}
              onChange={(event) => atualizarFiltro("limite", Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {LIMITES.map((limite) => (
                <option key={limite} value={limite}>
                  {limite}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <Botao
              type="button"
              onClick={() => carregarConversas({ silencioso: true })}
              disabled={atualizando}
              className="w-full justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Aplicar filtros
            </Botao>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              Conversas institucionais
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.total} conversa(s) encontrada(s).
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Clock3 className="h-3.5 w-3.5" />
            Página {paginaAtual} de {totalPaginas}
          </div>
        </div>

        {conversas.length === 0 ? (
          <div className="p-6">
            <NadaEncontrado
              titulo="Nenhuma conversa encontrada"
              mensagem="Ajuste os filtros ou aguarde o envio de mensagens pelos usuários."
            />
          </div>
        ) : (
          <div className="grid gap-3 p-4">
            {conversas.map((conversa) => (
              <ConversaAdminCard
                key={conversa.id}
                conversa={conversa}
                selecionada={Number(conversaSelecionada?.id) === Number(conversa.id)}
                onAbrir={abrirConversa}
              />
            ))}
          </div>
        )}

        {conversas.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mostrando até {meta.limite} por página.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={paginaAtual <= 1}
                onClick={() => atualizarFiltro("pagina", paginaAtual - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <button
                type="button"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => atualizarFiltro("pagina", paginaAtual + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

<Modal
  open={Boolean(conversaSelecionada)}
  onClose={() => {
    setConversaSelecionada(null);
    setDetalhe(null);
    setResposta("");
    setVisivelUsuario(true);
  }}
  labelledBy="mensagem-admin-modal-title"
  describedBy="mensagem-admin-modal-desc"
  className="w-[96%] max-w-7xl overflow-hidden p-0"
>
  <header className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2
          id="mensagem-admin-modal-title"
          className="text-xl font-black tracking-tight text-slate-950 dark:text-white"
        >
          Atendimento da conversa
        </h2>

        <p
          id="mensagem-admin-modal-desc"
          className="mt-1 text-sm text-slate-500 dark:text-slate-400"
        >
          Visualize o histórico, responda como administrador e registre a gestão da conversa.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setConversaSelecionada(null);
          setDetalhe(null);
          setResposta("");
          setVisivelUsuario(true);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        aria-label="Fechar atendimento"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  </header>

  <div className="max-h-[calc(92vh-88px)] overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-5">
        {carregandoDetalhe ? (
          <CarregandoSkeleton
            linhas={8}
            titulo="Carregando conversa"
            subtitulo="Buscando histórico e dados administrativos."
          />
        ) : detalhe?.conversa ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <BadgeStatus status={detalhe.conversa.status} />
                      <BadgePrioridade prioridade={detalhe.conversa.prioridade} />
                    </div>

                    <h3 className="break-words text-xl font-black text-slate-950 dark:text-white">
                      {detalhe.conversa.assunto}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {labelCategoria(detalhe.conversa.categoria)} · aberta em{" "}
                      {formatarDataHora(detalhe.conversa.criado_em)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConversaSelecionada(null);
                      setDetalhe(null);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    aria-label="Fechar conversa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <UserRound className="h-3.5 w-3.5" />
                      Usuário
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      ID {detalhe.conversa.usuario_id}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <UsersRound className="h-3.5 w-3.5" />
                      Responsável
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {detalhe.conversa.atribuido_para || "Sem atribuição"}
                    </p>
                  </div>
                </div>

                {STATUS_FINAIS.has(detalhe.conversa.status) ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    Esta conversa está {labelStatus(detalhe.conversa.status).toLowerCase()}
                    {detalhe.conversa.encerrado_em
                      ? ` desde ${formatarDataHora(detalhe.conversa.encerrado_em)}`
                      : ""}
                    . Motivo: {detalhe.conversa.motivo_encerramento || "não informado"}.
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  <h4 className="text-base font-black text-slate-950 dark:text-white">
                    Histórico
                  </h4>
                </div>

                {Array.isArray(detalhe.respostas) && detalhe.respostas.length > 0 ? (
                  detalhe.respostas.map((item) => (
                    <RespostaItem key={item.id} resposta={item} />
                  ))
                ) : (
                  <NadaEncontrado
                    titulo="Sem respostas registradas"
                    mensagem="Ainda não há histórico nesta conversa."
                  />
                )}
              </div>

              <form
                onSubmit={enviarResposta}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquareReply className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  <h4 className="text-base font-black text-slate-950 dark:text-white">
                    Responder conversa
                  </h4>
                </div>

                <textarea
                  value={resposta}
                  onChange={(event) => setResposta(event.target.value)}
                  disabled={!conversaAtiva || enviandoResposta}
                  rows={5}
                  placeholder={
                    conversaAtiva
                      ? "Escreva a resposta administrativa..."
                      : "Conversa encerrada ou arquivada."
                  }
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 dark:disabled:bg-slate-900"
                />

                <label className="mt-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <input
                    type="checkbox"
                    checked={visivelUsuario}
                    onChange={(event) => setVisivelUsuario(event.target.checked)}
                    disabled={!conversaAtiva || enviandoResposta}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                      Visível ao usuário
                    </span>
                    <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Desmarque apenas para registrar observação interna administrativa.
                    </span>
                  </span>
                </label>

                <div className="mt-4 flex justify-end">
                  <Botao
                    type="submit"
                    disabled={!conversaAtiva || enviandoResposta}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {enviandoResposta ? "Enviando..." : "Enviar"}
                  </Botao>
                </div>
              </form>
            </section>

            <aside className="space-y-4">
              <form
                onSubmit={salvarEdicao}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Save className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  <h4 className="text-base font-black text-slate-950 dark:text-white">
                    Gestão da conversa
                  </h4>
                </div>

                <div className="space-y-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Status
                    </span>
                    <select
                      value={editando.status}
                      onChange={(event) =>
                        setEditando((anterior) => ({
                          ...anterior,
                          status: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    >
                      {STATUS_EDICAO.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Prioridade
                    </span>
                    <select
                      value={editando.prioridade}
                      onChange={(event) =>
                        setEditando((anterior) => ({
                          ...anterior,
                          prioridade: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    >
                      {PRIORIDADES_EDICAO.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Responsável ID
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={editando.atribuido_para}
                      onChange={(event) =>
                        setEditando((anterior) => ({
                          ...anterior,
                          atribuido_para: event.target.value,
                        }))
                      }
                      placeholder="ID do administrador"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    />
                  </label>

                  {STATUS_FINAIS.has(editando.status) ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Motivo do encerramento/arquivamento
                      </span>
                      <textarea
                        value={editando.motivo_encerramento}
                        onChange={(event) =>
                          setEditando((anterior) => ({
                            ...anterior,
                            motivo_encerramento: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Explique o motivo institucional do encerramento..."
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-4">
                  <Botao
                    type="submit"
                    disabled={salvandoEdicao}
                    className="w-full justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {salvandoEdicao ? "Salvando..." : "Salvar gestão"}
                  </Botao>
                </div>
              </form>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
                <p className="font-black">Orientação operacional</p>
                <p className="mt-1">
                  Use observações internas para registrar contexto administrativo que não
                  deve ser exibido ao usuário. Encerramentos e arquivamentos exigem motivo
                  para manter rastreabilidade.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <p>
                  Criada em: {formatarDataHora(detalhe.conversa.criado_em)}
                </p>
                <p>
                  Atualizada em: {formatarDataHora(detalhe.conversa.atualizado_em)}
                </p>
                <p>
                  Última resposta:{" "}
                  {formatarDataHora(detalhe.conversa.ultima_resposta_em)}
                </p>
                <p>
                  Primeira resposta administrativa:{" "}
                  {formatarDataHora(detalhe.conversa.respondida_em)}
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <ErroCarregamento
            titulo="Não foi possível carregar a conversa"
            mensagem="Selecione novamente a conversa ou atualize a listagem."
            onTentarNovamente={() =>
              conversaSelecionada && abrirConversa(conversaSelecionada)
            }
          />
        )}
          </div>
      </Modal>
    </section>

    <Footer />
  </main>
);
}