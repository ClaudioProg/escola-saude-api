/**
 * ✅ frontend/src/pages/MensagemUsuario.jsx — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Página do usuário para Caixa de Mensagens Institucional.
 *
 * Responsabilidades:
 * - Permitir abertura de dúvida, sugestão, problema ou solicitação.
 * - Listar conversas do próprio usuário.
 * - Exibir histórico da conversa.
 * - Permitir resposta do usuário em conversa ativa.
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
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HelpCircle,
  Inbox,
  LifeBuoy,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  UserRound,
  X,
} from "lucide-react";

import api from "../services/api";
import Botao from "../components/ui/Botao";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Modal from "../components/ui/Modal";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const CATEGORIAS = [
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

const STATUS_FILTRO = [
  { value: "", label: "Todos" },
  { value: "aberta", label: "Aberta" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "respondida", label: "Respondida" },
  { value: "encerrada", label: "Encerrada" },
  { value: "arquivada", label: "Arquivada" },
];

const PRIORIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const STATUS_FINAIS = new Set(["encerrada", "arquivada"]);

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function labelCategoria(value) {
  return CATEGORIAS.find((item) => item.value === value)?.label || value || "—";
}

function labelPrioridade(value) {
  return PRIORIDADES.find((item) => item.value === value)?.label || value || "—";
}

function labelStatus(value) {
  return STATUS_FILTRO.find((item) => item.value === value)?.label || value || "—";
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
        mapa[prioridade] || mapa.normal
      )}
    >
      {labelPrioridade(prioridade)}
    </span>
  );
}

function CardResumo({ icone: Icone, titulo, valor, detalhe }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {titulo}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
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

function ConversaCard({ conversa, selecionada, onSelecionar }) {
  return (
    <button
      type="button"
      onClick={() => onSelecionar(conversa)}
      className={cx(
        "w-full rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400",
        selecionada
          ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950 dark:text-white">
            {conversa.assunto}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <BadgeStatus status={conversa.status} />
            <BadgePrioridade prioridade={conversa.prioridade} />
          </div>
        </div>

        <div className="shrink-0 rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3.5 w-3.5" />
          {labelCategoria(conversa.categoria)}
        </span>

        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          {formatarDataHora(conversa.atualizado_em || conversa.criado_em)}
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {Number(conversa.total_respostas || 0)} resposta(s)
      </p>
    </button>
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
              {resposta.autor_nome || (ehAdmin ? "Administração" : "Você")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ehAdmin ? "Administração" : "Usuário"} ·{" "}
              {formatarDataHora(resposta.criado_em)}
            </p>
          </div>
        </div>

        {ehInterna ? (
          <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Observação interna
          </span>
        ) : null}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
        {resposta.mensagem}
      </p>
    </article>
  );
}

export default function MensagemUsuario() {
  const [conversas, setConversas] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    total_paginas: 1,
  });

  const [filtros, setFiltros] = useState({
    status: "",
    categoria: "",
    pagina: 1,
    limite: 20,
  });

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");

  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [formNova, setFormNova] = useState({
    assunto: "",
    categoria: "duvida",
    prioridade: "normal",
    mensagem: "",
  });

  const [conversaSelecionada, setConversaSelecionada] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [resposta, setResposta] = useState("");
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  const resumo = useMemo(() => {
    const abertas = conversas.filter((item) => item.status === "aberta").length;
    const respondidas = conversas.filter((item) => item.status === "respondida").length;
    const emAtendimento = conversas.filter(
      (item) => item.status === "em_atendimento"
    ).length;
    const finais = conversas.filter((item) => STATUS_FINAIS.has(item.status)).length;

    return {
      abertas,
      respondidas,
      emAtendimento,
      finais,
    };
  }, [conversas]);

  const conversaAtiva = detalhe?.conversa
    ? !STATUS_FINAIS.has(detalhe.conversa.status)
    : false;

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

        const respostaApi = await api.mensagem.minhas(params);

        setConversas(Array.isArray(respostaApi?.data) ? respostaApi.data : []);
        setMeta({
          total: respostaApi?.meta?.total || 0,
          pagina: respostaApi?.meta?.pagina || filtros.pagina || 1,
          limite: respostaApi?.meta?.limite || filtros.limite || 20,
          total_paginas: respostaApi?.meta?.total_paginas || 1,
        });
      } catch (error) {
        console.error("[MensagemUsuario] Falha ao carregar conversas:", error);

        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar suas mensagens."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [filtros]
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

  function atualizarFormNova(campo, valor) {
    setFormNova((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  async function abrirConversa(conversa) {
    try {
      setConversaSelecionada(conversa);
      setCarregandoDetalhe(true);
      setDetalhe(null);
      setResposta("");

      const respostaApi = await api.mensagem.obterUsuario(conversa.id);
      setDetalhe(respostaApi?.data || null);
    } catch (error) {
      console.error("[MensagemUsuario] Falha ao abrir conversa:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível carregar a conversa selecionada."
      );
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  function validarNovaConversa() {
    if (formNova.assunto.trim().length < 5) {
      notifyWarning("Informe um assunto com pelo menos 5 caracteres.");
      return false;
    }

    if (formNova.mensagem.trim().length < 2) {
      notifyWarning("Escreva a mensagem antes de enviar.");
      return false;
    }

    return true;
  }

  async function enviarNovaConversa(event) {
    event.preventDefault();

    if (!validarNovaConversa()) return;

    try {
      setSalvandoNova(true);

      const respostaApi = await api.mensagem.criar({
        assunto: formNova.assunto.trim(),
        categoria: formNova.categoria,
        prioridade: formNova.prioridade,
        mensagem: formNova.mensagem.trim(),
      });

      notifySuccess(
        respostaApi?.message ||
          "Mensagem enviada com sucesso. A administração poderá responder por este canal."
      );

      setFormNova({
        assunto: "",
        categoria: "duvida",
        prioridade: "normal",
        mensagem: "",
      });

      setModalNovaAberto(false);
      await carregarConversas({ silencioso: true });
    } catch (error) {
      console.error("[MensagemUsuario] Falha ao enviar nova conversa:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível enviar sua mensagem. Confira os campos e tente novamente."
      );
    } finally {
      setSalvandoNova(false);
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
      notifyWarning("Escreva sua resposta antes de enviar.");
      return;
    }

    try {
      setEnviandoResposta(true);

      const respostaApi = await api.mensagem.responderUsuario(detalhe.conversa.id, {
        mensagem: resposta.trim(),
      });

      notifySuccess(respostaApi?.message || "Resposta enviada com sucesso.");

      setResposta("");

      const detalheAtualizado = await api.mensagem.obterPorId(detalhe.conversa.id);
      setDetalhe(detalheAtualizado?.data || null);

      await carregarConversas({ silencioso: true });
    } catch (error) {
      console.error("[MensagemUsuario] Falha ao responder:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível enviar sua resposta. Tente novamente."
      );
    } finally {
      setEnviandoResposta(false);
    }
  }

  const paginaAtual = Number(meta.pagina || filtros.pagina || 1);
  const totalPaginas = Math.max(Number(meta.total_paginas || 1), 1);

  if (carregando) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <CarregandoSkeleton
          linhas={8}
          titulo="Carregando sua caixa de mensagens"
          subtitulo="Buscando suas conversas institucionais com a Escola da Saúde."
        />
      </main>
    );
  }

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErroCarregamento
          titulo="Não foi possível carregar suas mensagens"
          mensagem={erro}
          onTentarNovamente={() => carregarConversas()}
        />
      </main>
    );
  }

  return (
  <>
    <HeaderHero
      icone={LifeBuoy}
      etiqueta="Caixa de mensagens"
      titulo="Fale com a Escola da Saúde"
      subtitulo="Envie dúvidas, sugestões ou problemas e acompanhe as respostas da administração em um canal institucional organizado e rastreável."
    />

    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          icone={Inbox}
          titulo="Total"
          valor={meta.total}
          detalhe="Conversas registradas"
        />
        <CardResumo
          icone={AlertCircle}
          titulo="Abertas"
          valor={resumo.abertas}
          detalhe="Aguardando andamento"
        />
        <CardResumo
          icone={Sparkles}
          titulo="Respondidas"
          valor={resumo.respondidas}
          detalhe="Com resposta administrativa"
        />
        <CardResumo
          icone={Archive}
          titulo="Finalizadas"
          valor={resumo.finais}
          detalhe="Encerradas ou arquivadas"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-black text-slate-950 dark:text-white">
                Filtrar mensagens
              </h2>
            </div>

            <div className="grid gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </span>
                <select
                  value={filtros.status}
                  onChange={(event) => atualizarFiltro("status", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                >
                  {STATUS_FILTRO.map((opcao) => (
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
                  <option value="">Todas</option>
                  {CATEGORIAS.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            {conversas.length === 0 ? (
              <NadaEncontrado
                titulo="Nenhuma mensagem encontrada"
                mensagem="Você ainda não possui conversas com a administração ou os filtros não retornaram resultados."
              />
            ) : (
              conversas.map((conversa) => (
                <ConversaCard
                  key={conversa.id}
                  conversa={conversa}
                  selecionada={Number(conversaSelecionada?.id) === Number(conversa.id)}
                  onSelecionar={abrirConversa}
                />
              ))
            )}
          </section>

          {conversas.length > 0 ? (
            <section className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                disabled={paginaAtual <= 1}
                onClick={() => atualizarFiltro("pagina", paginaAtual - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {paginaAtual}/{totalPaginas}
              </span>

              <button
                type="button"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => atualizarFiltro("pagina", paginaAtual + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          ) : null}
        </aside>

        <section className="min-h-[560px] rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {!conversaSelecionada ? (
            <div className="flex min-h-[560px] items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                  <MessageCircle className="h-8 w-8" />
                </div>

                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  Selecione uma conversa
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Escolha uma mensagem na lista ao lado para visualizar o histórico,
                  acompanhar respostas e continuar a conversa.
                </p>

                <Botao
                  type="button"
                  onClick={() => setModalNovaAberto(true)}
                  className="mt-5 inline-flex items-center justify-center gap-2"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Abrir nova mensagem
                </Botao>
              </div>
            </div>
          ) : carregandoDetalhe ? (
            <div className="p-6">
              <CarregandoSkeleton
                linhas={7}
                titulo="Carregando conversa"
                subtitulo="Buscando histórico e respostas."
              />
            </div>
          ) : detalhe?.conversa ? (
            <div className="flex min-h-[560px] flex-col">
              <header className="border-b border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <BadgeStatus status={detalhe.conversa.status} />
                      <BadgePrioridade prioridade={detalhe.conversa.prioridade} />
                    </div>

                    <h2 className="break-words text-xl font-black text-slate-950 dark:text-white">
                      {detalhe.conversa.assunto}
                    </h2>

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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 lg:hidden"
                    aria-label="Fechar conversa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {STATUS_FINAIS.has(detalhe.conversa.status) ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    Esta conversa foi {labelStatus(detalhe.conversa.status).toLowerCase()}
                    {detalhe.conversa.encerrado_em
                      ? ` em ${formatarDataHora(detalhe.conversa.encerrado_em)}`
                      : ""}
                    . Novas respostas não são permitidas.
                  </div>
                ) : null}
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
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
                className="border-t border-slate-200 p-4 dark:border-slate-800"
              >
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Responder conversa
                  </span>

                  <textarea
                    value={resposta}
                    onChange={(event) => setResposta(event.target.value)}
                    disabled={!conversaAtiva || enviandoResposta}
                    rows={4}
                    placeholder={
                      conversaAtiva
                        ? "Escreva sua resposta..."
                        : "Conversa encerrada ou arquivada."
                    }
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 dark:disabled:bg-slate-900"
                  />
                </label>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use este canal apenas para assuntos relacionados à Escola da Saúde.
                  </p>

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
            </div>
          ) : (
            <div className="p-6">
              <ErroCarregamento
                titulo="Não foi possível carregar a conversa"
                mensagem="Selecione novamente a conversa ou atualize a página."
                onTentarNovamente={() =>
                  conversaSelecionada && abrirConversa(conversaSelecionada)
                }
              />
            </div>
          )}
        </section>
      </section>

      <Modal
  open={modalNovaAberto}
  onClose={() => {
    if (!salvandoNova) setModalNovaAberto(false);
  }}
        titulo="Nova mensagem"
        tamanho="lg"
      >
        <form onSubmit={enviarNovaConversa} className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
            <div className="mb-1 flex items-center gap-2 font-black">
              <HelpCircle className="h-4 w-4" />
              Canal institucional
            </div>
            Sua mensagem será encaminhada para a administração da Escola da Saúde.
            Você poderá acompanhar as respostas por esta própria página.
          </div>

          <label className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Assunto
            </span>
            <input
              type="text"
              value={formNova.assunto}
              onChange={(event) => atualizarFormNova("assunto", event.target.value)}
              maxLength={180}
              placeholder="Ex.: Dúvida sobre certificado"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Categoria
              </span>
              <select
                value={formNova.categoria}
                onChange={(event) => atualizarFormNova("categoria", event.target.value)}
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
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Prioridade
              </span>
              <select
                value={formNova.prioridade}
                onChange={(event) => atualizarFormNova("prioridade", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
              >
                {PRIORIDADES.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Mensagem
            </span>
            <textarea
              value={formNova.mensagem}
              onChange={(event) => atualizarFormNova("mensagem", event.target.value)}
              rows={7}
              placeholder="Descreva sua dúvida, sugestão ou problema com clareza..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={salvandoNova}
              onClick={() => setModalNovaAberto(false)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Cancelar
            </button>

            <Botao
              type="submit"
              disabled={salvandoNova}
              className="inline-flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {salvandoNova ? "Enviando..." : "Enviar mensagem"}
            </Botao>
          </div>
        </form>
      </Modal>
    </main>
    <Footer />
    </>
  );
}