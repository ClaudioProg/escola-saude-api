/**
 * ✅ frontend/src/pages/AuditoriaAdmin.jsx — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Página administrativa da Auditoria Premium Centralizada.
 *
 * Responsabilidades:
 * - Exibir resumo da auditoria.
 * - Listar eventos auditáveis com filtros.
 * - Permitir consulta detalhada de evento.
 * - Apoiar diagnóstico administrativo com requestId, módulo, ação, severidade e rota.
 *
 * Contratos aplicados:
 * - Service oficial: api.auditoria.*
 * - Backend oficial: /api/auditoria
 * - Tabela oficial: auditoria_eventos
 * - Perfis oficiais: usuario, organizador, administrador
 * - Severidades oficiais: debug, info, aviso, erro, critico
 * - Sem montagem direta de /api
 * - Sem aliases
 * - Sem legado
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Filter,
  Info,
  Layers,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Modal from "../components/ui/Modal";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const SEVERIDADES = [
  { value: "", label: "Todas" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "aviso", label: "Aviso" },
  { value: "erro", label: "Erro" },
  { value: "critico", label: "Crítico" },
];

const SUCESSO_OPCOES = [
  { value: "", label: "Todos" },
  { value: "true", label: "Sucesso" },
  { value: "false", label: "Falha" },
];

const LIMITE_OPCOES = [25, 50, 100, 200];

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
    total_eventos: Number(geral.total_eventos || 0),
    total_sucesso: Number(geral.total_sucesso || 0),
    total_falha: Number(geral.total_falha || 0),
    total_debug: Number(geral.total_debug || 0),
    total_info: Number(geral.total_info || 0),
    total_aviso: Number(geral.total_aviso || 0),
    total_erro: Number(geral.total_erro || 0),
    total_critico: Number(geral.total_critico || 0),
    primeiro_registro: geral.primeiro_registro || null,
    ultimo_registro: geral.ultimo_registro || null,
    por_modulo: Array.isArray(resumo?.por_modulo) ? resumo.por_modulo : [],
    por_acao: Array.isArray(resumo?.por_acao) ? resumo.por_acao : [],
  };
}

function BadgeSeveridade({ severidade }) {
  const valor = severidade || "info";

  const mapa = {
    debug:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        mapa[valor] || mapa.info
      )}
    >
      {valor}
    </span>
  );
}

function BadgeSucesso({ sucesso }) {
  if (sucesso) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Sucesso
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
      <XCircle className="h-3.5 w-3.5" />
      Falha
    </span>
  );
}

function CardResumo({ icone: Icone, titulo, valor, detalhe, destaque }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {titulo}
          </p>
          <p
            className={cx(
              "mt-2 text-2xl font-bold tracking-tight",
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
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          {titulo}
        </h4>

        <button
          type="button"
          onClick={() => copiarTexto(conteudo, `${titulo} copiado.`)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </button>
      </div>

      {conteudo ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-100">
          {conteudo}
        </pre>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sem dados registrados.
        </p>
      )}
    </div>
  );
}

export default function AuditoriaAdmin() {
  const [eventos, setEventos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    pagina: 1,
    limite: 50,
    total_paginas: 1,
  });

  const [filtros, setFiltros] = useState({
    usuario_id: "",
    modulo: "",
    acao: "",
    entidade: "",
    entidade_id: "",
    sucesso: "",
    severidade: "",
    request_id: "",
    data_inicio: "",
    data_fim: "",
    limite: 50,
    pagina: 1,
  });

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const resumoNormalizado = useMemo(() => normalizarResumo(resumo), [resumo]);

  const carregarResumo = useCallback(async () => {
    const params = {};

    if (filtros.data_inicio) params.data_inicio = filtros.data_inicio;
    if (filtros.data_fim) params.data_fim = filtros.data_fim;

    const resposta = await api.auditoria.resumo(params);
    setResumo(resposta?.data || null);
  }, [filtros.data_inicio, filtros.data_fim]);

  const carregarEventos = useCallback(
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

        const resposta = await api.auditoria.listar(params);

        setEventos(Array.isArray(resposta?.data) ? resposta.data : []);
        setMeta({
          total: resposta?.meta?.total || 0,
          pagina: resposta?.meta?.pagina || filtros.pagina || 1,
          limite: resposta?.meta?.limite || filtros.limite || 50,
          total_paginas: resposta?.meta?.total_paginas || 1,
        });

        await carregarResumo();
      } catch (error) {
        console.error("[AuditoriaAdmin] Falha ao carregar auditoria:", error);

        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar os eventos de auditoria."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [filtros, carregarResumo]
  );

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  function atualizarFiltro(campo, valor) {
    setFiltros((anterior) => ({
      ...anterior,
      [campo]: valor,
      pagina: campo === "pagina" ? valor : 1,
    }));
  }

  function limparFiltros() {
    setFiltros({
      usuario_id: "",
      modulo: "",
      acao: "",
      entidade: "",
      entidade_id: "",
      sucesso: "",
      severidade: "",
      request_id: "",
      data_inicio: "",
      data_fim: "",
      limite: 50,
      pagina: 1,
    });
  }

  async function abrirDetalhe(evento) {
    try {
      setCarregandoDetalhe(true);
      setEventoSelecionado(evento);

      const resposta = await api.auditoria.obterPorId(evento.id);
      setEventoSelecionado(resposta?.data || evento);
    } catch (error) {
      console.error("[AuditoriaAdmin] Falha ao carregar detalhe:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível carregar os detalhes da auditoria."
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
          titulo="Carregando auditoria da plataforma"
          subtitulo="Buscando eventos, indicadores e rastreabilidade administrativa."
        />
      </main>
    );
  }

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErroCarregamento
          titulo="Não foi possível carregar a auditoria"
          mensagem={erro}
          onTentarNovamente={() => carregarEventos()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100 blur-3xl dark:bg-blue-950/50" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-emerald-100 blur-3xl dark:bg-emerald-950/40" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Auditoria Premium Centralizada
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Auditoria da Plataforma
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Consulte ações sensíveis, alterações administrativas, falhas relevantes,
              módulos afetados, requestId, rotas e diagnósticos controlados da Escola da
              Saúde.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Botao
              type="button"
              onClick={() => carregarEventos({ silencioso: true })}
              disabled={atualizando}
              className="inline-flex items-center justify-center gap-2"
            >
              <RefreshCw
                className={cx("h-4 w-4", atualizando && "animate-spin")}
                aria-hidden="true"
              />
              Atualizar
            </Botao>

            <button
              type="button"
              onClick={() =>
                copiarTexto(
                  `Total: ${resumoNormalizado.total_eventos} | Falhas: ${resumoNormalizado.total_falha} | Críticos: ${resumoNormalizado.total_critico}`,
                  "Resumo da auditoria copiado."
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Copy className="h-4 w-4" />
              Copiar resumo
            </button>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          icone={Activity}
          titulo="Eventos auditados"
          valor={resumoNormalizado.total_eventos}
          detalhe={
            resumoNormalizado.ultimo_registro
              ? `Último: ${formatarDataHora(resumoNormalizado.ultimo_registro)}`
              : "Nenhum evento registrado ainda"
          }
        />

        <CardResumo
          icone={CheckCircle2}
          titulo="Sucessos"
          valor={resumoNormalizado.total_sucesso}
          detalhe="Ações concluídas com sucesso"
          destaque="text-emerald-700 dark:text-emerald-300"
        />

        <CardResumo
          icone={ShieldAlert}
          titulo="Falhas"
          valor={resumoNormalizado.total_falha}
          detalhe="Eventos registrados como falha"
          destaque="text-red-700 dark:text-red-300"
        />

        <CardResumo
          icone={AlertTriangle}
          titulo="Críticos"
          valor={resumoNormalizado.total_critico}
          detalhe="Exigem atenção administrativa"
          destaque="text-purple-700 dark:text-purple-300"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Módulos mais auditados
            </h2>
          </div>

          {resumoNormalizado.por_modulo.length > 0 ? (
            <div className="space-y-3">
              {resumoNormalizado.por_modulo.slice(0, 8).map((item) => {
                const percentual =
                  resumoNormalizado.total_eventos > 0
                    ? Math.round((Number(item.total || 0) / resumoNormalizado.total_eventos) * 100)
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
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ainda não há módulos auditados.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Ações mais registradas
            </h2>
          </div>

          {resumoNormalizado.por_acao.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {resumoNormalizado.por_acao.slice(0, 10).map((item) => (
                <div
                  key={item.acao}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {item.acao}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.total} registro(s)
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ainda não há ações auditadas.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <Filter className="h-4 w-4" />
              Filtros de auditoria
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use filtros objetivos para investigar módulos, ações, falhas e requestId.
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
              Módulo
            </span>
            <input
              type="text"
              value={filtros.modulo}
              onChange={(event) => atualizarFiltro("modulo", event.target.value)}
              placeholder="Ex.: certificado"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Ação
            </span>
            <input
              type="text"
              value={filtros.acao}
              onChange={(event) => atualizarFiltro("acao", event.target.value)}
              placeholder="Ex.: emitir"
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
              Resultado
            </span>
            <select
              value={filtros.sucesso}
              onChange={(event) => atualizarFiltro("sucesso", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            >
              {SUCESSO_OPCOES.map((opcao) => (
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
              placeholder="Ex.: 17"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Entidade
            </span>
            <input
              type="text"
              value={filtros.entidade}
              onChange={(event) => atualizarFiltro("entidade", event.target.value)}
              placeholder="Ex.: turma"
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
              placeholder="Ex.: 165"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Request ID
            </span>
            <input
              type="text"
              value={filtros.request_id}
              onChange={(event) => atualizarFiltro("request_id", event.target.value)}
              placeholder="Buscar requestId"
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
              {LIMITE_OPCOES.map((limite) => (
                <option key={limite} value={limite}>
                  {limite}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <Botao
              type="button"
              onClick={() => carregarEventos({ silencioso: true })}
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
              Eventos registrados
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.total} evento(s) encontrado(s).
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Clock3 className="h-3.5 w-3.5" />
            Página {paginaAtual} de {totalPaginas}
          </div>
        </div>

        {eventos.length === 0 ? (
          <div className="p-6">
            <NadaEncontrado
              titulo="Nenhum evento de auditoria encontrado"
              mensagem="Ajuste os filtros ou aguarde os módulos começarem a registrar ações auditáveis."
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Módulo / Ação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Entidade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Resultado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Request
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {eventos.map((evento) => (
                    <tr
                      key={evento.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-4 align-top text-sm text-slate-700 dark:text-slate-200">
                        <div className="font-semibold">
                          {formatarDataHora(evento.criado_em)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          #{evento.id}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-black text-slate-950 dark:text-white">
                          {evento.modulo}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {evento.acao}
                        </div>
                        <div className="mt-2">
                          <BadgeSeveridade severidade={evento.severidade} />
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-slate-700 dark:text-slate-200">
                        <div>{evento.entidade || "—"}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {evento.entidade_id || "Sem ID"}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <BadgeSucesso sucesso={evento.sucesso} />
                      </td>

                      <td className="max-w-xs px-4 py-4 align-top text-sm text-slate-700 dark:text-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            copiarTexto(evento.request_id, "Request ID copiado.")
                          }
                          className="truncate text-left font-mono text-xs text-blue-700 hover:underline dark:text-blue-300"
                          title={evento.request_id || ""}
                        >
                          {evento.request_id || "—"}
                        </button>
                        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {evento.rota || "Sem rota"}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() => abrirDetalhe(evento)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {eventos.map((evento) => (
                <article
                  key={evento.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        #{evento.id} · {formatarDataHora(evento.criado_em)}
                      </p>
                      <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">
                        {evento.modulo}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {evento.acao}
                      </p>
                    </div>

                    <BadgeSeveridade severidade={evento.severidade} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <BadgeSucesso sucesso={evento.sucesso} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      <Layers className="h-3.5 w-3.5" />
                      {evento.entidade || "sem entidade"}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Route className="h-3.5 w-3.5" />
                      <span className="truncate">{evento.rota || "Sem rota"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copiarTexto(evento.request_id, "Request ID copiado.")}
                      className="mt-2 block max-w-full truncate font-mono text-blue-700 hover:underline dark:text-blue-300"
                    >
                      {evento.request_id || "Sem requestId"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirDetalhe(evento)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <Eye className="h-4 w-4" />
                    Ver detalhes
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

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
      </section>

      <Modal
        aberto={Boolean(eventoSelecionado)}
        onFechar={() => setEventoSelecionado(null)}
        titulo="Detalhes do evento de auditoria"
        tamanho="xl"
      >
        {carregandoDetalhe ? (
          <CarregandoSkeleton
            linhas={6}
            titulo="Carregando detalhe"
            subtitulo="Buscando informações completas do evento."
          />
        ) : eventoSelecionado ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Evento #{eventoSelecionado.id}
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                    {eventoSelecionado.modulo} · {eventoSelecionado.acao}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {eventoSelecionado.mensagem || "Sem mensagem institucional registrada."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <BadgeSucesso sucesso={eventoSelecionado.sucesso} />
                  <BadgeSeveridade severidade={eventoSelecionado.severidade} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    Data/hora
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatarDataHora(eventoSelecionado.criado_em)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <UserRound className="h-3.5 w-3.5" />
                    Usuário
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {eventoSelecionado.usuario_id || "—"} ·{" "}
                    {eventoSelecionado.perfil_usuario || "sem perfil"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Layers className="h-3.5 w-3.5" />
                    Entidade
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {eventoSelecionado.entidade || "—"} ·{" "}
                    {eventoSelecionado.entidade_id || "sem ID"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Info className="h-3.5 w-3.5" />
                    Request ID
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copiarTexto(eventoSelecionado.request_id, "Request ID copiado.")
                    }
                    className="max-w-full truncate text-left font-mono text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {eventoSelecionado.request_id || "—"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <Route className="h-3.5 w-3.5" />
                  Requisição
                </div>

                <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                  {eventoSelecionado.metodo_http || "—"} {eventoSelecionado.rota || ""}
                </p>

                <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                  IP: {eventoSelecionado.ip || "—"}
                </p>

                <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                  User-Agent: {eventoSelecionado.user_agent || "—"}
                </p>
              </div>

              {eventoSelecionado.admin_hint ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <strong>Diagnóstico administrativo:</strong>{" "}
                  {eventoSelecionado.admin_hint}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <JsonPreview
                titulo="Dados anteriores"
                valor={eventoSelecionado.dados_anteriores}
              />
              <JsonPreview titulo="Dados novos" valor={eventoSelecionado.dados_novos} />
              <JsonPreview titulo="Detalhes" valor={eventoSelecionado.detalhes} />
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}