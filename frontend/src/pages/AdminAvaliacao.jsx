// ✅ frontend/src/pages/AdminAvaliacao.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown01,
  ArrowUp01,
  BarChart3,
  ClipboardList,
  Download,
  Filter,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifyInfo, notifySuccess } from "../components/ui/AppToast";
import { api } from "../services/api";
import { formatDateBr } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contrato oficial de avaliação
 * ───────────────────────────────────────────── */

const NOTA_ENUM_OFICIAL = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const NOTA_PONTUACAO = {
  Ótimo: 10,
  Bom: 8,
  Regular: 6,
  Ruim: 4,
  Péssimo: 2,
};

const NOTA_STYLE = {
  Ótimo:
    "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60",
  Bom:
    "bg-lime-50 text-lime-800 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800/60",
  Regular:
    "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60",
  Ruim:
    "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-800/60",
  Péssimo:
    "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800/60",
};

const CAMPOS_OFICIAIS_MEDIA = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

const CAMPOS_OBJETIVOS = [
  ...CAMPOS_OFICIAIS_MEDIA,
  "desempenho_organizador",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];

const CAMPOS_TEXTOS = [
  "gostou_mais",
  "sugestoes_melhoria",
  "comentarios_finais",
];

function isNotaEnumOficial(value) {
  return NOTA_ENUM_OFICIAL.includes(value);
}

function notaParaPontuacao(value) {
  if (!isNotaEnumOficial(value)) return null;
  return NOTA_PONTUACAO[value];
}

function criarDistribuicaoNotas() {
  return {
    Ótimo: 0,
    Bom: 0,
    Regular: 0,
    Ruim: 0,
    Péssimo: 0,
  };
}

function mediaFromDist(dist) {
  let total = 0;
  let soma = 0;

  for (const nota of NOTA_ENUM_OFICIAL) {
    const quantidade = Number(dist?.[nota] || 0);
    total += quantidade;
    soma += quantidade * NOTA_PONTUACAO[nota];
  }

  return total ? Number((soma / total).toFixed(2)) : null;
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function extrairData(response) {
  return response?.data ?? response ?? null;
}

function limparCSV(value) {
  return String(value ?? "")
    .replaceAll(/[\r\n]+/g, " ")
    .replaceAll(/;/g, ",");
}

function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob(["\uFEFF" + conteudo], {
    type: mime || "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nome;
  link.rel = "noopener";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function labelDoCampo(campo) {
  return (
    {
      divulgacao_evento: "Divulgação do evento",
      recepcao: "Recepção",
      credenciamento: "Credenciamento",
      material_apoio: "Material de apoio",
      pontualidade: "Pontualidade",
      sinalizacao_local: "Sinalização do local",
      conteudo_temas: "Conteúdo e temas",
      desempenho_organizador: "Desempenho do organizador",
      estrutura_local: "Estrutura do local",
      acessibilidade: "Acessibilidade",
      limpeza: "Limpeza",
      inscricao_online: "Inscrição on-line",
      exposicao_trabalhos: "Exposição de trabalhos",
      apresentacao_oral_mostra: "Apresentação oral/mostra",
      apresentacao_tcrs: "Apresentação TCRs",
      oficinas: "Oficinas",
      gostou_mais: "O que mais gostou",
      sugestoes_melhoria: "Sugestões de melhoria",
      comentarios_finais: "Comentários finais",
    }[campo] ||
    campo.replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase())
  );
}

function normalizarEventos(response) {
  const lista = Array.isArray(response) ? response : [];

  return lista.map((evento) => ({
    id: evento.id,
    titulo: evento.titulo || "Evento",
    data_inicio: evento.data_inicio || evento.di || null,
    data_fim: evento.data_fim || evento.df || null,
    total_respostas: Number(evento.total_respostas || 0),
  }));
}

function normalizarPayloadEvento(payload) {
  const respostas = Array.isArray(payload?.respostas) ? payload.respostas : [];
  const turmas = Array.isArray(payload?.turmas) ? payload.turmas : [];

  if (payload?.agregados) {
    return {
      respostas,
      turmas,
      agregados: normalizarAgregados(payload.agregados, respostas),
    };
  }

  return {
    respostas,
    turmas,
    agregados: agregarRespostas(respostas),
  };
}

function normalizarAgregados(agregados, respostas) {
  const dist = {};
  const medias = {};
  const textos = {};

  for (const campo of CAMPOS_OBJETIVOS) {
    const distOriginal = agregados?.dist?.[campo];

    if (distOriginal && NOTA_ENUM_OFICIAL.some((nota) => nota in distOriginal)) {
      dist[campo] = {
        Ótimo: Number(distOriginal["Ótimo"] || 0),
        Bom: Number(distOriginal["Bom"] || 0),
        Regular: Number(distOriginal["Regular"] || 0),
        Ruim: Number(distOriginal["Ruim"] || 0),
        Péssimo: Number(distOriginal["Péssimo"] || 0),
      };
    } else {
      dist[campo] = criarDistribuicaoNotas();

      for (const resposta of respostas) {
        const nota = resposta?.[campo];

        if (isNotaEnumOficial(nota)) {
          dist[campo][nota] += 1;
        }
      }
    }

    const mediaBackend = agregados?.medias?.[campo];

    medias[campo] =
      mediaBackend != null && Number.isFinite(Number(mediaBackend))
        ? Number(mediaBackend)
        : mediaFromDist(dist[campo]);
  }

  for (const campo of CAMPOS_TEXTOS) {
    const textosBackend = agregados?.textos?.[campo];

    textos[campo] = Array.isArray(textosBackend)
      ? textosBackend.filter((texto) => typeof texto === "string" && texto.trim())
      : respostas
          .map((resposta) => resposta?.[campo])
          .filter((texto) => typeof texto === "string" && texto.trim())
          .map((texto) => texto.trim());
  }

  const mediaOficial =
    agregados?.mediaOficial != null && Number.isFinite(Number(agregados.mediaOficial))
      ? Number(agregados.mediaOficial)
      : calcularMediaOficial(medias);

  return {
    total: Number(agregados?.total ?? respostas.length),
    dist,
    medias,
    textos,
    mediaOficial,
  };
}

function agregarRespostas(respostas) {
  const dist = {};
  const medias = {};
  const textos = {};

  for (const campo of CAMPOS_OBJETIVOS) {
    dist[campo] = criarDistribuicaoNotas();
  }

  for (const resposta of respostas) {
    for (const campo of CAMPOS_OBJETIVOS) {
      const nota = resposta?.[campo];

      if (isNotaEnumOficial(nota)) {
        dist[campo][nota] += 1;
      }
    }
  }

  for (const campo of CAMPOS_OBJETIVOS) {
    medias[campo] = mediaFromDist(dist[campo]);
  }

  for (const campo of CAMPOS_TEXTOS) {
    textos[campo] = respostas
      .map((resposta) => resposta?.[campo])
      .filter((texto) => typeof texto === "string" && texto.trim().length > 0)
      .map((texto) => texto.trim());
  }

  return {
    total: respostas.length,
    dist,
    medias,
    textos,
    mediaOficial: calcularMediaOficial(medias),
  };
}

function calcularMediaOficial(medias) {
  const valores = CAMPOS_OFICIAIS_MEDIA.map((campo) => medias?.[campo]).filter(
    (value) => Number.isFinite(value)
  );

  return valores.length
    ? Number((valores.reduce((acc, value) => acc + value, 0) / valores.length).toFixed(2))
    : null;
}

function classificarMedia(media) {
  if (media == null) return "Sem dados";
  if (media >= 9) return "Excelente";
  if (media >= 8) return "Muito bom";
  if (media >= 6) return "Regular";
  if (media >= 4) return "Atenção";
  return "Crítico";
}

function ordenarCampos(campos, medias, ordem) {
  return campos
    .map((campo) => ({
      campo,
      nome: labelDoCampo(campo),
      media: medias?.[campo] ?? null,
    }))
    .sort((a, b) => {
      if (a.media == null && b.media == null) return 0;
      if (a.media == null) return 1;
      if (b.media == null) return -1;

      return ordem === "desc" ? b.media - a.media : a.media - b.media;
    });
}

function obterTopCriterios(campos, medias, modo = "melhores") {
  return campos
    .map((campo) => ({
      campo,
      nome: labelDoCampo(campo),
      media: medias?.[campo] ?? null,
    }))
    .filter((item) => item.media != null)
    .sort((a, b) => (modo === "melhores" ? b.media - a.media : a.media - b.media))
    .slice(0, 4);
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function HeaderHero({ onRefresh, carregando, resumo }) {
  return (
    <header
      className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 text-white"
      role="banner"
    >
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500 blur-3xl" />
        <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-indigo-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400 blur-3xl" />
      </div>

      <a
        href="#conteudo"
        className="sr-only relative z-10 focus:not-sr-only focus:block focus:bg-white/20 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Painel administrativo
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                <BarChart3 className="h-7 w-7" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
                  Avaliações — Administração
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-white/85 sm:text-base">
                  Analise eventos avaliados, médias oficiais, distribuição de notas,
                  comentários qualitativos e turmas com respostas registradas.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 p-4 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-3">
              <HeroMetric label="Eventos" value={resumo.eventos} />
              <HeroMetric label="Turmas" value={resumo.turmas} />
              <HeroMetric label="Respostas" value={resumo.respostas} />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={carregando}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-violet-950 shadow-lg transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Atualizar dados de avaliações"
            >
              <RefreshCw
                className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {carregando ? "Atualizando painel..." : "Atualizar painel"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-center ring-1 ring-white/15">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">
        {label}
      </p>
    </div>
  );
}

function ControlePainel({
  eventos,
  eventoId,
  setEventoId,
  somenteOficiais,
  setSomenteOficiais,
  ordenar,
  setOrdenar,
  onExportar,
  exportDisabled,
}) {
  return (
    <section className="sticky top-0 z-30 -mx-3 mb-6 border-b border-slate-200/80 bg-slate-50/90 px-3 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 sm:mx-0 sm:rounded-b-3xl sm:border sm:shadow-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <label
            htmlFor="sel-evento"
            className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400"
          >
            Evento analisado
          </label>

          <select
            id="sel-evento"
            value={eventoId}
            onChange={(event) => setEventoId(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-950 shadow-sm outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-violet-950"
            aria-label="Selecionar evento"
          >
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>
                {evento.titulo}
                {evento.data_inicio ? ` • ${formatDateBr(evento.data_inicio)}` : ""}
                {evento.data_fim ? ` a ${formatDateBr(evento.data_fim)}` : ""}
                {typeof evento.total_respostas === "number"
                  ? ` • ${evento.total_respostas} resp.`
                  : ""}
              </option>
            ))}

            {!eventos.length ? <option value="">Nenhum evento encontrado</option> : null}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setSomenteOficiais((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            {somenteOficiais ? "Só oficiais" : "Todos critérios"}
          </button>

          <button
            type="button"
            onClick={() => setOrdenar((value) => (value === "desc" ? "asc" : "desc"))}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
          >
            {ordenar === "desc" ? (
              <ArrowDown01 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowUp01 className="h-4 w-4" aria-hidden="true" />
            )}
            {ordenar === "desc" ? "Maiores" : "Menores"}
          </button>

          <button
            type="button"
            onClick={onExportar}
            disabled={exportDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar CSV
          </button>
        </div>
      </div>
    </section>
  );
}

function KPI({ titulo, valor, icon: Icon, descricao, destaque = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-5 shadow-sm ring-1 ${
        destaque
          ? "bg-gradient-to-br from-violet-700 to-fuchsia-700 text-white ring-violet-400/40"
          : "bg-white text-slate-950 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800"
      }`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-wide ${
              destaque ? "text-white/75" : "text-slate-500 dark:text-zinc-400"
            }`}
          >
            {titulo}
          </p>

          <p className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
            {valor}
          </p>

          {descricao ? (
            <p
              className={`mt-1 text-xs ${
                destaque ? "text-white/75" : "text-slate-500 dark:text-zinc-400"
              }`}
            >
              {descricao}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            destaque
              ? "bg-white/15 ring-1 ring-white/20"
              : "bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900"
          }`}
        >
          {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
}

function RankingCriterios({ titulo, itens, icon: Icon }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900">
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        </div>

        <h3 className="text-sm font-black text-slate-950 dark:text-white">
          {titulo}
        </h3>
      </div>

      {itens.length ? (
        <ol className="space-y-3">
          {itens.map((item, index) => (
            <li
              key={item.campo}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100 dark:bg-zinc-800 dark:ring-zinc-700"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                  #{index + 1}
                </p>
                <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                  {item.nome}
                </p>
              </div>

              <span className="rounded-xl bg-white px-2.5 py-1 text-sm font-black text-violet-800 ring-1 ring-violet-100 dark:bg-zinc-900 dark:text-violet-200 dark:ring-violet-900">
                {item.media.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Ainda não há dados suficientes.
        </p>
      )}
    </div>
  );
}

function CampoBarra({ nome, media, dist, oficial = false }) {
  const percentual = media != null ? Math.min(100, Math.max(0, media * 10)) : 0;
  const linha = dist || criarDistribuicaoNotas();
  const classificacao = classificarMedia(media);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-slate-950 dark:text-white">
              {nome}
            </p>

            {oficial ? (
              <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-fuchsia-800 ring-1 ring-fuchsia-100 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/60">
                Oficial
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Classificação: {classificacao}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-100 dark:bg-zinc-800 dark:ring-zinc-700">
          <p className="text-xl font-black text-slate-950 dark:text-white">
            {media != null ? media.toFixed(2) : "—"}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            de 10
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700"
          role="img"
          aria-label={`Média ${nome}: ${
            media != null ? media.toFixed(2) : "não disponível"
          } de 10`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-emerald-500"
            style={{ width: `${percentual}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {NOTA_ENUM_OFICIAL.map((nota) => (
          <div
            key={nota}
            className={`rounded-2xl px-2 py-2 text-center text-[11px] font-bold ring-1 ${NOTA_STYLE[nota]}`}
          >
            <p>{nota}</p>
            <p className="mt-0.5 text-sm">{linha[nota] || 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuadroComentarios({ titulo, itens }) {
  const lista = Array.isArray(itens) ? itens : [];

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
          <MessageSquare className="h-4 w-4 text-violet-600" aria-hidden="true" />
          {titulo}
        </h3>

        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          {lista.length}
        </span>
      </div>

      {lista.length ? (
        <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm">
          {lista.map((texto, index) => (
            <li
              key={`${titulo}-${index}`}
              className="rounded-2xl bg-slate-50 p-3 text-slate-700 ring-1 ring-slate-100 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
            >
              “{texto}”
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 ring-1 ring-slate-100 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
          Sem comentários encontrados.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────── */

export default function AdminAvaliacao() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState("");
  const [payload, setPayload] = useState(null);
  const [somenteOficiais, setSomenteOficiais] = useState(true);
  const [ordenar, setOrdenar] = useState("desc");
  const [buscaComentario, setBuscaComentario] = useState("");

  const eventoAtual = useMemo(() => {
    return eventos.find((evento) => String(evento.id) === String(eventoId));
  }, [eventos, eventoId]);

  const camposVisiveis = useMemo(() => {
    return somenteOficiais ? CAMPOS_OFICIAIS_MEDIA : CAMPOS_OBJETIVOS;
  }, [somenteOficiais]);

  const mediasOrdenadas = useMemo(() => {
    return ordenarCampos(camposVisiveis, payload?.agregados?.medias, ordenar);
  }, [payload, camposVisiveis, ordenar]);

  const melhoresCriterios = useMemo(() => {
    return obterTopCriterios(camposVisiveis, payload?.agregados?.medias, "melhores");
  }, [camposVisiveis, payload]);

  const pontosAtencao = useMemo(() => {
    return obterTopCriterios(camposVisiveis, payload?.agregados?.medias, "piores");
  }, [camposVisiveis, payload]);

  const textosFiltrados = useMemo(() => {
    const filtro = buscaComentario.trim().toLowerCase();

    const filtrar = (campo) => {
      const lista = payload?.agregados?.textos?.[campo] || [];

      if (!filtro) return lista;

      return lista.filter((texto) => texto.toLowerCase().includes(filtro));
    };

    return {
      gostou_mais: filtrar("gostou_mais"),
      sugestoes_melhoria: filtrar("sugestoes_melhoria"),
      comentarios_finais: filtrar("comentarios_finais"),
    };
  }, [payload, buscaComentario]);

  const resumoHero = useMemo(() => {
    const turmas = Array.isArray(payload?.turmas) ? payload.turmas.length : 0;
    const respostas = Number(payload?.agregados?.total || 0);

    return {
      eventos: eventos.length,
      turmas,
      respostas,
    };
  }, [eventos, payload]);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  const carregarEventos = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setPayload(null);
    setLive("Carregando eventos com avaliações.");

    try {
      if (typeof api?.avaliacao?.adminEventos !== "function") {
        throw new Error(
          "Facade api.avaliacao.adminEventos não encontrada em frontend/src/services/api.js."
        );
      }

      const response = await api.avaliacao.adminEventos();
      const lista = normalizarEventos(extrairData(response));

      setEventos(lista);

      if (!lista.length) {
        setEventoId("");
        setErro("Não há eventos com avaliações registradas.");
        setLive("Nenhum evento com avaliação foi encontrado.");
        return;
      }

      setEventoId((atual) => atual || String(lista[0].id));
      setLive(`Foram encontrados ${lista.length} evento(s) com avaliações.`);
    } catch (error) {
      console.error("[AdminAvaliacao] erro ao carregar eventos:", error);

      setEventos([]);
      setEventoId("");
      setErro("Erro ao carregar eventos com avaliações.");

      notifyError(
        "Não foi possível carregar os eventos com avaliações. Tente novamente ou acione o suporte se o problema continuar."
      );

      setLive("Falha ao carregar eventos com avaliações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarEvento = useCallback(async (id) => {
    if (!id) return;

    setCarregando(true);
    setErro("");
    setPayload(null);
    setLive("Carregando avaliações do evento.");

    try {
      if (typeof api?.avaliacao?.adminEvento !== "function") {
        throw new Error(
          "Facade api.avaliacao.adminEvento não encontrada em frontend/src/services/api.js."
        );
      }

      const response = await api.avaliacao.adminEvento(id);
      const dados = normalizarPayloadEvento(extrairData(response));

      setPayload(dados);
      setLive("Avaliações do evento carregadas.");
    } catch (error) {
      console.error("[AdminAvaliacao] erro ao carregar evento:", error);

      setPayload(null);
      setErro("Erro ao carregar avaliações do evento.");

      notifyError(
        "Não foi possível carregar as avaliações do evento. Tente novamente ou acione o suporte se o problema continuar."
      );

      setLive("Falha ao carregar avaliações do evento.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Avaliações — Administração | Escola da Saúde";
    carregarEventos();
  }, [carregarEventos]);

  useEffect(() => {
    if (!eventoId) return;
    carregarEvento(eventoId);
  }, [eventoId, carregarEvento]);

  function atualizarManual() {
    if (eventoId) {
      carregarEvento(eventoId);
    } else {
      carregarEventos();
    }
  }

  function exportarCSV() {
    if (!payload) {
      notifyInfo("Selecione um evento com avaliações para exportar.");
      return;
    }

    try {
      const linhas = [];

      linhas.push(["Evento", "Total respostas", "Média oficial"].join(";"));
      linhas.push(
        [
          limparCSV(eventoAtual?.titulo || "Evento"),
          payload?.agregados?.total ?? 0,
          payload?.agregados?.mediaOficial ?? "",
        ].join(";")
      );

      linhas.push("");
      linhas.push(
        [
          "Critério",
          "Média (0..10)",
          "Ótimo",
          "Bom",
          "Regular",
          "Ruim",
          "Péssimo",
        ].join(";")
      );

      for (const campo of camposVisiveis) {
        const dist = payload?.agregados?.dist?.[campo] || criarDistribuicaoNotas();
        const media = payload?.agregados?.medias?.[campo];

        linhas.push(
          [
            limparCSV(labelDoCampo(campo)),
            media ?? "",
            dist["Ótimo"] || 0,
            dist["Bom"] || 0,
            dist["Regular"] || 0,
            dist["Ruim"] || 0,
            dist["Péssimo"] || 0,
          ].join(";")
        );
      }

      linhas.push("");
      linhas.push(["Comentários — O que mais gostou"].join(";"));
      for (const texto of payload?.agregados?.textos?.gostou_mais || []) {
        linhas.push([limparCSV(texto)].join(";"));
      }

      linhas.push("");
      linhas.push(["Comentários — Sugestões de melhoria"].join(";"));
      for (const texto of payload?.agregados?.textos?.sugestoes_melhoria || []) {
        linhas.push([limparCSV(texto)].join(";"));
      }

      linhas.push("");
      linhas.push(["Comentários — Comentários finais"].join(";"));
      for (const texto of payload?.agregados?.textos?.comentarios_finais || []) {
        linhas.push([limparCSV(texto)].join(";"));
      }

      const titulo = String(eventoAtual?.titulo || "evento")
        .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
        .replace(/\s+/g, "_")
        .slice(0, 80);

      baixarArquivo(
        `avaliacao_${titulo || "evento"}.csv`,
        linhas.join("\r\n"),
        "text/csv;charset=utf-8"
      );

      notifySuccess("CSV gerado com sucesso.");
    } catch (error) {
      console.error("[AdminAvaliacao] erro ao exportar CSV:", error);
      notifyError("Não foi possível exportar o CSV.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <HeaderHero
        carregando={carregando}
        onRefresh={atualizarManual}
        resumo={resumoHero}
      />

      {carregando ? (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-violet-100 dark:bg-violet-950"
          role="progressbar"
          aria-label="Carregando avaliações"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full w-1/3 bg-gradient-to-r from-violet-700 to-fuchsia-600 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      ) : null}

      <main id="conteudo" className="flex-1">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
          <ControlePainel
            eventos={eventos}
            eventoId={eventoId}
            setEventoId={setEventoId}
            somenteOficiais={somenteOficiais}
            setSomenteOficiais={setSomenteOficiais}
            ordenar={ordenar}
            setOrdenar={setOrdenar}
            onExportar={exportarCSV}
            exportDisabled={!payload}
          />

          {carregando ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CarregandoSkeleton height={130} />
                <CarregandoSkeleton height={130} />
                <CarregandoSkeleton height={130} />
                <CarregandoSkeleton height={130} />
              </div>
              <CarregandoSkeleton height={340} />
              <CarregandoSkeleton height={260} />
            </div>
          ) : erro ? (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <NadaEncontrado mensagem={erro} />
            </div>
          ) : !eventoAtual ? (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <NadaEncontrado mensagem="Nenhum evento encontrado." />
            </div>
          ) : !payload ? (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <NadaEncontrado mensagem="Sem avaliações para este evento até o momento." />
            </div>
          ) : (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              <section
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                aria-label="Resumo administrativo das avaliações"
              >
                <KPI
                  titulo="Total de respostas"
                  valor={payload.agregados?.total || 0}
                  descricao="Respostas registradas no evento"
                  icon={ClipboardList}
                  destaque
                />

                <KPI
                  titulo="Média oficial"
                  valor={
                    payload.agregados?.mediaOficial != null
                      ? `${Number(payload.agregados.mediaOficial).toFixed(2)} / 10`
                      : "—"
                  }
                  descricao="Somente critérios oficiais"
                  icon={Star}
                />

                <KPI
                  titulo="Eventos carregados"
                  valor={eventos.length}
                  descricao="Eventos com avaliação"
                  icon={BarChart3}
                />

                <KPI
                  titulo="Turmas no evento"
                  valor={Array.isArray(payload.turmas) ? payload.turmas.length : 0}
                  descricao="Turmas vinculadas ao evento"
                  icon={Users}
                />
              </section>

              {Array.isArray(payload.turmas) && payload.turmas.length ? (
                <section aria-label="Turmas do evento">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-600" aria-hidden="true" />
                    <h2 className="text-sm font-black text-slate-950 dark:text-white">
                      Turmas com respostas
                    </h2>
                  </div>

                  <ul className="flex flex-wrap gap-2">
                    {payload.turmas.map((turma) => (
                      <li
                        key={turma.id}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
                        title={`${turma.nome} — ${turma.total_respostas ?? 0} respostas`}
                      >
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-fuchsia-600 px-2 text-xs font-black text-white">
                          {turma.total_respostas ?? 0}
                        </span>
                        {turma.nome || `Turma ${turma.id}`}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RankingCriterios
                  titulo="Melhores critérios"
                  itens={melhoresCriterios}
                  icon={Sparkles}
                />

                <RankingCriterios
                  titulo="Pontos de atenção"
                  itens={pontosAtencao}
                  icon={Info}
                />
              </section>

              <section aria-labelledby="medias-criterio-titulo">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="medias-criterio-titulo"
                      className="text-xl font-black text-slate-950 dark:text-white"
                    >
                      Médias por critério
                    </h2>

                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      Escala oficial convertida para pontuação de 0 a 10.
                    </p>
                  </div>

                  <span className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
                    Ótimo 10 • Bom 8 • Regular 6 • Ruim 4 • Péssimo 2
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {mediasOrdenadas.map(({ campo, nome, media }) => (
                    <CampoBarra
                      key={campo}
                      nome={nome}
                      media={media}
                      dist={payload?.agregados?.dist?.[campo]}
                      oficial={CAMPOS_OFICIAIS_MEDIA.includes(campo)}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="comentarios-titulo">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="comentarios-titulo"
                      className="text-xl font-black text-slate-950 dark:text-white"
                    >
                      Comentários qualitativos
                    </h2>

                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                      Busque rapidamente termos citados pelos participantes.
                    </p>
                  </div>

                  <div className="relative w-full sm:max-w-md">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />

                    <input
                      type="search"
                      value={buscaComentario}
                      onChange={(event) => setBuscaComentario(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm font-medium text-slate-950 outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-violet-950"
                      placeholder="Buscar nos comentários..."
                      aria-label="Buscar nos comentários"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <QuadroComentarios
                    titulo="O que mais gostaram"
                    itens={textosFiltrados.gostou_mais}
                  />

                  <QuadroComentarios
                    titulo="Sugestões de melhoria"
                    itens={textosFiltrados.sugestoes_melhoria}
                  />

                  <QuadroComentarios
                    titulo="Comentários finais"
                    itens={textosFiltrados.comentarios_finais}
                  />
                </div>
              </section>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}