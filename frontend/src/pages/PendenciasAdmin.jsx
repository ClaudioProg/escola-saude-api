/**
 * ✅ frontend/src/pages/PendenciasAdmin.jsx — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Página administrativa do Painel de Pendências.
 *
 * Responsabilidades:
 * - Exibir resumo consolidado das pendências administrativas.
 * - Listar pendências derivadas da view v_pendencias_administrativas.
 * - Filtrar por módulo, tipo, severidade, prioridade, status, entidade, usuário e período.
 * - Exibir detalhes técnicos controlados da pendência.
 * - Apoiar diagnóstico administrativo, Saúde da Plataforma e priorização operacional.
 *
 * Contratos aplicados:
 * - Service oficial futuro: api.pendencia.*
 * - Backend oficial futuro: /api/pendencia
 * - View oficial: v_pendencias_administrativas
 * - Status derivado inicial: pendente
 * - Severidades oficiais:
 *   - info
 *   - aviso
 *   - erro
 *   - critico
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
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Filter,
  Info,
  Layers,
  ListChecks,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import Botao from "../components/ui/Botao";
import Modal from "../components/ui/Modal";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const SEVERIDADES = [
  { value: "", label: "Todas" },
  { value: "info", label: "Info" },
  { value: "aviso", label: "Aviso" },
  { value: "erro", label: "Erro" },
  { value: "critico", label: "Crítico" },
];

const PRIORIDADES = [
  { value: "", label: "Todas" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const STATUS = [
  { value: "", label: "Todos" },
  { value: "pendente", label: "Pendente" },
];

const LIMITES = [25, 50, 100, 200];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatarDataHora(valor) {
  if (!valor) return "—";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(valor));
  } catch {
    return "—";
  }
}

function copiarTexto(texto, mensagem = "Conteúdo copiado.") {
  if (!texto) {
    notifyWarning("Não há conteúdo disponível para copiar.");
    return;
  }

  navigator.clipboard
    .writeText(String(texto))
    .then(() => notifySuccess(mensagem))
    .catch(() =>
      notifyError(
        "Não foi possível copiar automaticamente. Selecione o conteúdo manualmente."
      )
    );
}

function normalizarResumo(resumo) {
  const geral = resumo?.geral || {};

  return {
    total_pendencias: Number(geral.total_pendencias || 0),
    info: Number(geral.info || 0),
    aviso: Number(geral.aviso || 0),
    erro: Number(geral.erro || 0),
    critico: Number(geral.critico || 0),
    baixa: Number(geral.baixa || 0),
    normal: Number(geral.normal || 0),
    alta: Number(geral.alta || 0),
    urgente: Number(geral.urgente || 0),
    primeira_pendencia: geral.primeira_pendencia || null,
    ultima_atualizacao: geral.ultima_atualizacao || null,
    por_modulo: Array.isArray(resumo?.por_modulo) ? resumo.por_modulo : [],
    por_tipo: Array.isArray(resumo?.por_tipo) ? resumo.por_tipo : [],
    por_prioridade: Array.isArray(resumo?.por_prioridade)
      ? resumo.por_prioridade
      : [],
  };
}

function BadgeSeveridade({ severidade }) {
  const mapa = {
    info:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    aviso:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    erro:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
    critico:
      "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        mapa[severidade] || mapa.info
      )}
    >
      {severidade || "info"}
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
      {prioridade || "normal"}
    </span>
  );
}

function BadgeStatus({ status }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
      {status || "pendente"}
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

function JsonPreview({ titulo, valor }) {
  const conteudo = useMemo(() => {
    if (valor === null || valor === undefined) return "";

    try {
      return JSON.stringify(valor, null, 2);
    } catch {
      return String(valor);
    }
  }, [valor]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-black text-slate-950 dark:text-white">
          {titulo}
        </h4>

        <button
          type="button"
          onClick={() => copiarTexto(conteudo, `${titulo} copiado.`)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </button>
      </div>

      {conteudo ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-100">
          {conteudo}
        </pre>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sem detalhes registrados.
        </p>
      )}
    </div>
  );
}

function PendenciaCard({ pendencia, onAbrir }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <BadgePrioridade prioridade={pendencia.prioridade} />
            <BadgeSeveridade severidade={pendencia.severidade} />
            <BadgeStatus status={pendencia.status} />
          </div>

          <h3 className="break-words text-base font-black text-slate-950 dark:text-white">
            {pendencia.titulo}
          </h3>

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {pendencia.descricao}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {pendencia.modulo}
            </span>

            <span className="inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              {pendencia.tipo}
            </span>

            <span className="inline-flex items-center gap-1">
              <Route className="h-3.5 w-3.5" />
              {pendencia.entidade || "sem entidade"}
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatarDataHora(pendencia.atualizado_em || pendencia.criado_em)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAbrir(pendencia)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Eye className="h-4 w-4" />
          Ver
        </button>
      </div>
    </article>
  );
}

export default function PendenciasAdmin() {
  const [pendencias, setPendencias] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    pagina: 1,
    limite: 50,
    total_paginas: 1,
  });

  const [filtros, setFiltros] = useState({
    modulo: "",
    tipo: "",
    severidade: "",
    prioridade: "",
    status: "",
    entidade: "",
    entidade_id: "",
    origem: "",
    usuario_id: "",
    busca: "",
    data_inicio: "",
    data_fim: "",
    pagina: 1,
    limite: 50,
  });

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");

  const [pendenciaSelecionada, setPendenciaSelecionada] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const resumoNormalizado = useMemo(() => normalizarResumo(resumo), [resumo]);

  const carregarResumo = useCallback(async () => {
    const params = Object.fromEntries(
      Object.entries(filtros).filter(
        ([chave, valor]) =>
          !["pagina", "limite"].includes(chave) &&
          valor !== "" &&
          valor !== null
      )
    );

    const resposta = await api.pendencia.resumo(params);
    setResumo(resposta?.data || null);
  }, [filtros]);

  const carregarPendencias = useCallback(
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

        const resposta = await api.pendencia.listar(params);

        setPendencias(Array.isArray(resposta?.data) ? resposta.data : []);
        setMeta({
          total: resposta?.meta?.total || 0,
          pagina: resposta?.meta?.pagina || filtros.pagina || 1,
          limite: resposta?.meta?.limite || filtros.limite || 50,
          total_paginas: resposta?.meta?.total_paginas || 1,
        });

        await carregarResumo();
      } catch (error) {
        console.error("[PendenciasAdmin] Falha ao carregar pendências:", error);

        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar as pendências administrativas."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [filtros, carregarResumo]
  );

  useEffect(() => {
    carregarPendencias();
  }, [carregarPendencias]);

  function atualizarFiltro(campo, valor) {
    setFiltros((anterior) => ({
      ...anterior,
      [campo]: valor,
      pagina: campo === "pagina" ? valor : 1,
    }));
  }

  function limparFiltros() {
    setFiltros({
      modulo: "",
      tipo: "",
      severidade: "",
      prioridade: "",
      status: "",
      entidade: "",
      entidade_id: "",
      origem: "",
      usuario_id: "",
      busca: "",
      data_inicio: "",
      data_fim: "",
      pagina: 1,
      limite: 50,
    });
  }

  async function abrirDetalhe(pendencia) {
    try {
      setCarregandoDetalhe(true);
      setPendenciaSelecionada(pendencia);

      const resposta = await api.pendencia.obterPorId(pendencia.pendencia_id);
      setPendenciaSelecionada(resposta?.data || pendencia);
    } catch (error) {
      console.error("[PendenciasAdmin] Falha ao carregar detalhe:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível carregar os detalhes da pendência."
      );
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  const paginaAtual = Number(meta.pagina || filtros.pagina || 1);
  const totalPaginas = Math.max(Number(meta.total_paginas || 1), 1);

  if (carregando) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <CarregandoSkeleton
          linhas={8}
          titulo="Carregando pendências administrativas"
          subtitulo="Buscando pendências derivadas dos módulos operacionais e diagnósticos."
        />
      </main>
    );
  }

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErroCarregamento
          titulo="Não foi possível carregar as pendências"
          mensagem={erro}
          onTentarNovamente={() => carregarPendencias()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-red-100 blur-3xl dark:bg-red-950/40" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-blue-100 blur-3xl dark:bg-blue-950/40" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              Painel de Pendências
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Pendências Administrativas
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Acompanhe pendências derivadas de mensagens, auditoria e demais
              módulos operacionais. Este painel ajuda a priorizar atendimentos,
              falhas recentes e situações que exigem ação administrativa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => carregarPendencias({ silencioso: true })}
            disabled={atualizando}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RefreshCw
              className={cx("h-4 w-4", atualizando && "animate-spin")}
              aria-hidden="true"
            />
            Atualizar
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          icone={ListChecks}
          titulo="Total"
          valor={resumoNormalizado.total_pendencias}
          detalhe="Pendências derivadas"
        />

        <CardResumo
          icone={AlertTriangle}
          titulo="Urgentes"
          valor={resumoNormalizado.urgente}
          detalhe="Prioridade máxima"
          destaque="text-red-700 dark:text-red-300"
        />

        <CardResumo
          icone={XCircle}
          titulo="Erros"
          valor={resumoNormalizado.erro}
          detalhe="Falhas ou erros operacionais"
          destaque="text-red-700 dark:text-red-300"
        />

        <CardResumo
          icone={ShieldCheck}
          titulo="Críticas"
          valor={resumoNormalizado.critico}
          detalhe="Exigem atenção imediata"
          destaque="text-purple-700 dark:text-purple-300"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Pendências por módulo
            </h2>
          </div>

          {resumoNormalizado.por_modulo.length > 0 ? (
            <div className="space-y-3">
              {resumoNormalizado.por_modulo.map((item) => {
                const percentual =
                  resumoNormalizado.total_pendencias > 0
                    ? Math.round(
                        (Number(item.total || 0) /
                          resumoNormalizado.total_pendencias) *
                          100
                      )
                    : 0;

                return (
                  <div key={item.modulo} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {item.modulo}
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

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {Number(item.urgentes || 0)} urgente(s) ·{" "}
                      {Number(item.criticas || 0)} crítica(s)
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma pendência por módulo neste momento.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Tipos mais recorrentes
            </h2>
          </div>

          {resumoNormalizado.por_tipo.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {resumoNormalizado.por_tipo.slice(0, 10).map((item) => (
                <div
                  key={`${item.modulo}-${item.tipo}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                    {item.tipo}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.modulo} · {item.total} registro(s)
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {Number(item.urgentes || 0)} urgente(s) ·{" "}
                    {Number(item.criticas || 0)} crítica(s)
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum tipo recorrente neste momento.
            </p>
          )}
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
              Localize pendências por módulo, severidade, prioridade, origem,
              entidade ou período.
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
              placeholder="Título, descrição, módulo..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Módulo
            </span>
            <input
              type="text"
              value={filtros.modulo}
              onChange={(event) => atualizarFiltro("modulo", event.target.value)}
              placeholder="Ex.: mensagem"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo
            </span>
            <input
              type="text"
              value={filtros.tipo}
              onChange={(event) => atualizarFiltro("tipo", event.target.value)}
              placeholder="Ex.: mensagem_urgente"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Severidade
            </span>
            <select
              value={filtros.severidade}
              onChange={(event) => atualizarFiltro("severidade", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {SEVERIDADES.map((opcao) => (
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
              Entidade
            </span>
            <input
              type="text"
              value={filtros.entidade}
              onChange={(event) => atualizarFiltro("entidade", event.target.value)}
              placeholder="Ex.: mensagem_conversa"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Entidade ID
            </span>
            <input
              type="text"
              value={filtros.entidade_id}
              onChange={(event) => atualizarFiltro("entidade_id", event.target.value)}
              placeholder="Ex.: 15"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Origem
            </span>
            <input
              type="text"
              value={filtros.origem}
              onChange={(event) => atualizarFiltro("origem", event.target.value)}
              placeholder="Ex.: auditoria_eventos"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
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
              onClick={() => carregarPendencias({ silencioso: true })}
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
              Pendências encontradas
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.total} pendência(s) encontrada(s).
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Clock3 className="h-3.5 w-3.5" />
            Página {paginaAtual} de {totalPaginas}
          </div>
        </div>

        {pendencias.length === 0 ? (
          <div className="p-6">
            <NadaEncontrado
              titulo="Nenhuma pendência encontrada"
              mensagem="A view não identificou pendências administrativas para os filtros atuais."
            />
          </div>
        ) : (
          <div className="grid gap-3 p-4">
            {pendencias.map((pendencia) => (
              <PendenciaCard
                key={pendencia.pendencia_id}
                pendencia={pendencia}
                onAbrir={abrirDetalhe}
              />
            ))}
          </div>
        )}

        {pendencias.length > 0 ? (
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
        aberto={Boolean(pendenciaSelecionada)}
        onFechar={() => setPendenciaSelecionada(null)}
        titulo="Detalhes da pendência"
        tamanho="xl"
      >
        {carregandoDetalhe ? (
          <CarregandoSkeleton
            linhas={6}
            titulo="Carregando pendência"
            subtitulo="Buscando detalhes da pendência administrativa."
          />
        ) : pendenciaSelecionada ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <BadgePrioridade prioridade={pendenciaSelecionada.prioridade} />
                    <BadgeSeveridade severidade={pendenciaSelecionada.severidade} />
                    <BadgeStatus status={pendenciaSelecionada.status} />
                  </div>

                  <h3 className="break-words text-xl font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.titulo}
                  </h3>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {pendenciaSelecionada.descricao}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copiarTexto(
                      pendenciaSelecionada.pendencia_id,
                      "ID da pendência copiado."
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Copy className="h-4 w-4" />
                  Copiar ID
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Módulo
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.modulo || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Tipo
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.tipo || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Origem
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.origem || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Usuário
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.usuario_id || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Entidade
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {pendenciaSelecionada.entidade || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Entidade ID
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copiarTexto(
                        pendenciaSelecionada.entidade_id,
                        "Entidade ID copiado."
                      )
                    }
                    className="max-w-full truncate text-left font-mono text-sm font-black text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {pendenciaSelecionada.entidade_id || "—"}
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Criada em
                  </div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    {formatarDataHora(pendenciaSelecionada.criado_em)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Atualizada em
                  </div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    {formatarDataHora(pendenciaSelecionada.atualizado_em)}
                  </p>
                </div>
              </div>
            </section>

            <JsonPreview
              titulo="Detalhes técnicos controlados"
              valor={pendenciaSelecionada.detalhes}
            />

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <p className="font-black">Orientação operacional</p>
              <p className="mt-1">
                Esta pendência é derivada da view oficial. Para resolvê-la, corrija a
                entidade de origem indicada. Quando a condição deixar de existir, a
                pendência desaparecerá automaticamente da listagem.
              </p>
            </section>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}