/**
 * ✅ frontend/src/pages/SaudePlataformaAdmin.jsx — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Página administrativa da Saúde da Plataforma.
 *
 * Responsabilidades:
 * - Exibir classificação geral da saúde operacional.
 * - Exibir indicadores críticos, alertas e saudáveis.
 * - Listar indicadores derivados da view v_saude_plataforma.
 * - Filtrar por módulo, status, severidade, janela e busca.
 * - Exibir detalhes técnicos controlados de cada indicador.
 * - Apoiar diagnóstico executivo, auditoria, pendências e operação administrativa.
 *
 * Contratos aplicados:
 * - Service oficial futuro: api.saudePlataforma.*
 * - Backend oficial futuro: /api/saude-plataforma
 * - View oficial: v_saude_plataforma
 * - Status oficiais:
 *   - saudavel
 *   - alerta
 *   - critico
 * - Severidades oficiais:
 *   - info
 *   - aviso
 *   - erro
 *   - critico
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
  Gauge,
  HeartPulse,
  Info,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import Botao from "../components/ui/Botao";
import Modal from "../components/ui/Modal";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";

const STATUS = [
  { value: "", label: "Todos" },
  { value: "saudavel", label: "Saudável" },
  { value: "alerta", label: "Alerta" },
  { value: "critico", label: "Crítico" },
];

const SEVERIDADES = [
  { value: "", label: "Todas" },
  { value: "info", label: "Info" },
  { value: "aviso", label: "Aviso" },
  { value: "erro", label: "Erro" },
  { value: "critico", label: "Crítico" },
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
    total_indicadores: Number(geral.total_indicadores || 0),
    saudaveis: Number(geral.saudaveis || 0),
    alertas: Number(geral.alertas || 0),
    criticos: Number(geral.criticos || 0),
    info: Number(geral.info || 0),
    aviso: Number(geral.aviso || 0),
    erro: Number(geral.erro || 0),
    severidade_critica: Number(geral.severidade_critica || 0),
    atualizado_em: geral.atualizado_em || null,
    status_geral: geral.status_geral || "saudavel",
    titulo: geral.titulo || "Saúde da Plataforma",
    descricao: geral.descricao || "Indicadores operacionais carregados.",
    por_modulo: Array.isArray(resumo?.por_modulo) ? resumo.por_modulo : [],
    por_status: Array.isArray(resumo?.por_status) ? resumo.por_status : [],
    por_severidade: Array.isArray(resumo?.por_severidade)
      ? resumo.por_severidade
      : [],
    destaques: Array.isArray(resumo?.destaques) ? resumo.destaques : [],
  };
}

function statusLabel(status) {
  const mapa = {
    saudavel: "Saudável",
    alerta: "Alerta",
    critico: "Crítico",
  };

  return mapa[status] || status || "—";
}

function severidadeLabel(severidade) {
  const mapa = {
    info: "Info",
    aviso: "Aviso",
    erro: "Erro",
    critico: "Crítico",
  };

  return mapa[severidade] || severidade || "—";
}

function statusClasses(status) {
  const mapa = {
    saudavel:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    alerta:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    critico:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  };

  return mapa[status] || mapa.saudavel;
}

function severidadeClasses(severidade) {
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

  return mapa[severidade] || mapa.info;
}

function BadgeStatus({ status }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        statusClasses(status)
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function BadgeSeveridade({ severidade }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        severidadeClasses(severidade)
      )}
    >
      {severidadeLabel(severidade)}
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

function IndicadorCard({ indicador, onAbrir }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <BadgeStatus status={indicador.status} />
            <BadgeSeveridade severidade={indicador.severidade} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              {indicador.janela || "sem janela"}
            </span>
          </div>

          <h3 className="break-words text-base font-black text-slate-950 dark:text-white">
            {indicador.titulo}
          </h3>

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {indicador.descricao}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {indicador.modulo}
            </span>

            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              Valor: {Number(indicador.valor || 0)}
            </span>

            <span className="inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              {indicador.indicador_id}
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatarDataHora(indicador.atualizado_em)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAbrir(indicador)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Eye className="h-4 w-4" />
          Ver
        </button>
      </div>
    </article>
  );
}

function HeroSaude({ resumo }) {
  const mapa = {
    saudavel: {
      icon: ShieldCheck,
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
      halo: "bg-emerald-100 dark:bg-emerald-950/40",
    },
    alerta: {
      icon: AlertTriangle,
      badge:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
      halo: "bg-amber-100 dark:bg-amber-950/40",
    },
    critico: {
      icon: ShieldAlert,
      badge:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
      halo: "bg-red-100 dark:bg-red-950/40",
    },
  };

  const config = mapa[resumo.status_geral] || mapa.saudavel;
  const Icone = config.icon;

  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
      <div
        className={cx(
          "absolute right-0 top-0 h-44 w-44 rounded-full blur-3xl",
          config.halo
        )}
      />
      <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-blue-100 blur-3xl dark:bg-blue-950/40" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div
            className={cx(
              "mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide",
              config.badge
            )}
          >
            <Icone className="h-3.5 w-3.5" />
            {statusLabel(resumo.status_geral)}
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Saúde da Plataforma
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {resumo.descricao}
          </p>

          <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Última atualização: {formatarDataHora(resumo.atualizado_em)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Classificação geral
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {resumo.titulo}
          </p>
        </div>
      </div>
    </header>
  );
}

export default function SaudePlataformaAdmin() {
  const [indicadores, setIndicadores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [meta, setMeta] = useState({
    total: 0,
    pagina: 1,
    limite: 100,
    total_paginas: 1,
  });

  const [filtros, setFiltros] = useState({
    indicador_id: "",
    modulo: "",
    status: "",
    severidade: "",
    janela: "",
    busca: "",
    pagina: 1,
    limite: 100,
  });

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");

  const [indicadorSelecionado, setIndicadorSelecionado] = useState(null);
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

    const resposta = await api.saudePlataforma.resumo(params);
    setResumo(resposta?.data || null);
  }, [filtros]);

  const carregarDiagnostico = useCallback(async () => {
    const resposta = await api.saudePlataforma.diagnostico();
    setDiagnostico(resposta?.data || null);
  }, []);

  const carregarIndicadores = useCallback(
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

        const resposta = await api.saudePlataforma.listar(params);

        setIndicadores(Array.isArray(resposta?.data) ? resposta.data : []);
        setMeta({
          total: resposta?.meta?.total || 0,
          pagina: resposta?.meta?.pagina || filtros.pagina || 1,
          limite: resposta?.meta?.limite || filtros.limite || 100,
          total_paginas: resposta?.meta?.total_paginas || 1,
        });

        await carregarResumo();
        await carregarDiagnostico();
      } catch (error) {
        console.error("[SaudePlataformaAdmin] Falha ao carregar saúde:", error);

        setErro(
          error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar a Saúde da Plataforma."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [filtros, carregarResumo, carregarDiagnostico]
  );

  useEffect(() => {
    carregarIndicadores();
  }, [carregarIndicadores]);

  function atualizarFiltro(campo, valor) {
    setFiltros((anterior) => ({
      ...anterior,
      [campo]: valor,
      pagina: campo === "pagina" ? valor : 1,
    }));
  }

  function limparFiltros() {
    setFiltros({
      indicador_id: "",
      modulo: "",
      status: "",
      severidade: "",
      janela: "",
      busca: "",
      pagina: 1,
      limite: 100,
    });
  }

  async function abrirDetalhe(indicador) {
    try {
      setCarregandoDetalhe(true);
      setIndicadorSelecionado(indicador);

      const resposta = await api.saudePlataforma.obterPorId(indicador.indicador_id);
      setIndicadorSelecionado(resposta?.data || indicador);
    } catch (error) {
      console.error("[SaudePlataformaAdmin] Falha ao carregar indicador:", error);

      notifyError(
        error?.response?.data?.message ||
          "Não foi possível carregar os detalhes do indicador."
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
          titulo="Carregando Saúde da Plataforma"
          subtitulo="Buscando indicadores, alertas, críticos e diagnóstico executivo."
        />
      </main>
    );
  }

  if (erro) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErroCarregamento
          titulo="Não foi possível carregar a Saúde da Plataforma"
          mensagem={erro}
          onTentarNovamente={() => carregarIndicadores()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <HeroSaude resumo={resumoNormalizado} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          icone={Activity}
          titulo="Indicadores"
          valor={resumoNormalizado.total_indicadores}
          detalhe="Total monitorado"
        />

        <CardResumo
          icone={CheckCircle2}
          titulo="Saudáveis"
          valor={resumoNormalizado.saudaveis}
          detalhe="Sem ação imediata"
          destaque="text-emerald-700 dark:text-emerald-300"
        />

        <CardResumo
          icone={AlertTriangle}
          titulo="Alertas"
          valor={resumoNormalizado.alertas}
          detalhe="Requerem acompanhamento"
          destaque="text-amber-700 dark:text-amber-300"
        />

        <CardResumo
          icone={ShieldAlert}
          titulo="Críticos"
          valor={resumoNormalizado.criticos}
          detalhe="Exigem atenção imediata"
          destaque="text-red-700 dark:text-red-300"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Saúde por módulo
            </h2>
          </div>

          {resumoNormalizado.por_modulo.length > 0 ? (
            <div className="space-y-3">
              {resumoNormalizado.por_modulo.map((item) => {
                const total = Number(item.total || 0);
                const criticos = Number(item.criticos || 0);
                const alertas = Number(item.alertas || 0);
                const percentualRisco =
                  total > 0 ? Math.round(((criticos + alertas) / total) * 100) : 0;

                return (
                  <div key={item.modulo} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {item.modulo}
                      </span>

                      <span className="text-slate-500 dark:text-slate-400">
                        {total} indicador(es)
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cx(
                          "h-full rounded-full",
                          criticos > 0
                            ? "bg-red-600"
                            : alertas > 0
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                        )}
                        style={{ width: `${Math.max(percentualRisco, total > 0 ? 5 : 0)}%` }}
                      />
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {criticos} crítico(s) · {alertas} alerta(s) · soma de valores:{" "}
                      {Number(item.soma_valores || 0)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum agrupamento por módulo disponível.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              Diagnóstico executivo
            </h2>
          </div>

          {diagnostico?.criticos?.length || diagnostico?.alertas?.length ? (
            <div className="space-y-3">
              {diagnostico?.criticos?.slice(0, 4).map((item) => (
                <button
                  type="button"
                  key={item.indicador_id}
                  onClick={() => abrirDetalhe(item)}
                  className="w-full rounded-2xl border border-red-200 bg-red-50 p-3 text-left transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:hover:bg-red-950/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-red-900 dark:text-red-100">
                      {item.titulo}
                    </p>
                    <span className="text-sm font-black text-red-900 dark:text-red-100">
                      {item.valor}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                    {item.modulo} · {item.janela}
                  </p>
                </button>
              ))}

              {diagnostico?.alertas?.slice(0, 4).map((item) => (
                <button
                  type="button"
                  key={item.indicador_id}
                  onClick={() => abrirDetalhe(item)}
                  className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-amber-900 dark:text-amber-100">
                      {item.titulo}
                    </p>
                    <span className="text-sm font-black text-amber-900 dark:text-amber-100">
                      {item.valor}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                    {item.modulo} · {item.janela}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="font-black">Sem alertas relevantes</p>
              <p className="mt-1">
                Não há indicadores críticos ou em alerta para exibir no diagnóstico
                executivo.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
              <Filter className="h-4 w-4" />
              Filtros da Saúde da Plataforma
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Localize indicadores por módulo, status, severidade, janela ou texto.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={() => carregarIndicadores({ silencioso: true })}
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
              Indicador ID
            </span>
            <input
              type="text"
              value={filtros.indicador_id}
              onChange={(event) =>
                atualizarFiltro("indicador_id", event.target.value)
              }
              placeholder="Ex.: pendencias_total_atual"
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
              placeholder="Ex.: reserva"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Janela
            </span>
            <input
              type="text"
              value={filtros.janela}
              onChange={(event) => atualizarFiltro("janela", event.target.value)}
              placeholder="Ex.: atual"
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
              Severidade
            </span>
            <select
              value={filtros.severidade}
              onChange={(event) =>
                atualizarFiltro("severidade", event.target.value)
              }
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
              Itens por página
            </span>
            <select
              value={filtros.limite}
              onChange={(event) =>
                atualizarFiltro("limite", Number(event.target.value))
              }
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
              onClick={() => carregarIndicadores({ silencioso: true })}
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
              Indicadores monitorados
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.total} indicador(es) encontrado(s).
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Clock3 className="h-3.5 w-3.5" />
            Página {paginaAtual} de {totalPaginas}
          </div>
        </div>

        {indicadores.length === 0 ? (
          <div className="p-6">
            <NadaEncontrado
              titulo="Nenhum indicador encontrado"
              mensagem="Ajuste os filtros para visualizar outros indicadores da Saúde da Plataforma."
            />
          </div>
        ) : (
          <div className="grid gap-3 p-4">
            {indicadores.map((indicador) => (
              <IndicadorCard
                key={indicador.indicador_id}
                indicador={indicador}
                onAbrir={abrirDetalhe}
              />
            ))}
          </div>
        )}

        {indicadores.length > 0 ? (
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
        aberto={Boolean(indicadorSelecionado)}
        onFechar={() => setIndicadorSelecionado(null)}
        titulo="Detalhes do indicador"
        tamanho="xl"
      >
        {carregandoDetalhe ? (
          <CarregandoSkeleton
            linhas={6}
            titulo="Carregando indicador"
            subtitulo="Buscando detalhes da Saúde da Plataforma."
          />
        ) : indicadorSelecionado ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <BadgeStatus status={indicadorSelecionado.status} />
                    <BadgeSeveridade severidade={indicadorSelecionado.severidade} />
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                      {indicadorSelecionado.janela || "sem janela"}
                    </span>
                  </div>

                  <h3 className="break-words text-xl font-black text-slate-950 dark:text-white">
                    {indicadorSelecionado.titulo}
                  </h3>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {indicadorSelecionado.descricao}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copiarTexto(
                      indicadorSelecionado.indicador_id,
                      "ID do indicador copiado."
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
                    Valor
                  </div>
                  <p className="text-2xl font-black text-slate-950 dark:text-white">
                    {Number(indicadorSelecionado.valor || 0)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Módulo
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {indicadorSelecionado.modulo || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Janela
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {indicadorSelecionado.janela || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Atualizado em
                  </div>
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {formatarDataHora(indicadorSelecionado.atualizado_em)}
                  </p>
                </div>
              </div>
            </section>

            <JsonPreview
              titulo="Critérios e detalhes técnicos"
              valor={indicadorSelecionado.detalhes}
            />

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <p className="font-black">Orientação operacional</p>
              <p className="mt-1">
                Este indicador é derivado da view oficial da Saúde da Plataforma. Para
                resolver alertas ou críticos, corrija a causa nos módulos de origem,
                especialmente quando o indicador apontar pendências, certificados,
                reservas, notificações ou auditoria.
              </p>
            </section>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}