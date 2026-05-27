// ✅ frontend/src/components/avaliacoes/AvaliacaoEvento.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import { useEffect, useId, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Download,
  MessageSquare,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

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

const CAMPOS_NOTA_EVENTO = [
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
      estrutura_local: "Estrutura do local",
      acessibilidade: "Acessibilidade",
      limpeza: "Limpeza",
      inscricao_online: "Inscrição on-line",
      desempenho_organizador: "Desempenho do organizador",
      gostou_mais: "O que mais gostou",
      sugestoes_melhoria: "Sugestões de melhoria",
      comentarios_finais: "Comentários finais",
    }[campo] ||
    campo.replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase())
  );
}

function classificarMedia(media) {
  if (media == null) return "Sem dados";
  if (media >= 9) return "Excelente";
  if (media >= 8) return "Muito bom";
  if (media >= 6) return "Regular";
  if (media >= 4) return "Atenção";
  return "Crítico";
}

function limparCSV(value) {
  return String(value ?? "")
    .replaceAll(/[\r\n]+/g, " ")
    .replaceAll(/;/g, ",");
}

function baixarArquivo(nome, conteudo) {
  const blob = new Blob(["\uFEFF" + conteudo], {
    type: "text/csv;charset=utf-8",
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

/* ─────────────────────────────────────────────
 * Cálculo
 * ───────────────────────────────────────────── */

function calcularMediasAvaliacao(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
    return {
      mediaEvento: null,
      mediaorganizador: null,
      mediaGeral: null,
      distorganizador: criarDistribuicaoNotas(),
      distEvento: {},
      detalhes: [],
      totalRespostas: 0,
      criterios: [],
    };
  }

  const distorganizador = criarDistribuicaoNotas();
  const distEvento = {};

  for (const campo of CAMPOS_NOTA_EVENTO) {
    distEvento[campo] = criarDistribuicaoNotas();
  }

  for (const avaliacao of avaliacoes) {
    const notaorganizador = avaliacao?.desempenho_organizador;

    if (isNotaEnumOficial(notaorganizador)) {
      distorganizador[notaorganizador] += 1;
    }

    for (const campo of CAMPOS_NOTA_EVENTO) {
      const nota = avaliacao?.[campo];

      if (isNotaEnumOficial(nota)) {
        distEvento[campo][nota] += 1;
      }
    }
  }

  const mediaorganizador = mediaFromDist(distorganizador);

  const criterios = CAMPOS_NOTA_EVENTO.map((campo) => ({
    campo,
    label: labelDoCampo(campo),
    media: mediaFromDist(distEvento[campo]),
    dist: distEvento[campo],
  }));

  const mediasEventoValidas = criterios
    .map((item) => item.media)
    .filter((value) => Number.isFinite(value));

  const mediaEvento = mediasEventoValidas.length
    ? Number(
        (
          mediasEventoValidas.reduce((acc, value) => acc + value, 0) /
          mediasEventoValidas.length
        ).toFixed(2)
      )
    : null;

  const mediasGerais = [mediaEvento, mediaorganizador].filter((value) =>
    Number.isFinite(value)
  );

  const mediaGeral = mediasGerais.length
    ? Number(
        (
          mediasGerais.reduce((acc, value) => acc + value, 0) /
          mediasGerais.length
        ).toFixed(2)
      )
    : null;

  const detalhes = avaliacoes
    .map((avaliacao) => ({
      desempenho: avaliacao?.desempenho_organizador,
      gostou: avaliacao?.gostou_mais,
      sugestao: avaliacao?.sugestoes_melhoria,
      comentario: avaliacao?.comentarios_finais,
    }))
    .filter((item) =>
      [
        item?.desempenho,
        item?.gostou,
        item?.sugestao,
        item?.comentario,
      ].some((value) => String(value ?? "").trim())
    );

  return {
    mediaEvento,
    mediaorganizador,
    mediaGeral,
    distorganizador,
    distEvento,
    detalhes,
    totalRespostas: avaliacoes.length,
    criterios,
  };
}

/* ─────────────────────────────────────────────
 * Exportação
 * ───────────────────────────────────────────── */

function exportarCSV(filename, resultado) {
  const linhas = [];

  linhas.push(["Métrica", "Valor"].join(";"));
  linhas.push(["Total de respostas", resultado.totalRespostas ?? 0].join(";"));
  linhas.push(
    [
      "Média do evento (0..10)",
      resultado.mediaEvento != null ? resultado.mediaEvento.toFixed(2) : "—",
    ].join(";")
  );
  linhas.push(
    [
      "Média do organizador (0..10)",
      resultado.mediaorganizador != null
        ? resultado.mediaorganizador.toFixed(2)
        : "—",
    ].join(";")
  );
  linhas.push("");

  linhas.push(["Distribuição do organizador"].join(";"));
  linhas.push(["Nota", "Pontuação", "Quantidade"].join(";"));

  for (const nota of NOTA_ENUM_OFICIAL) {
    linhas.push(
      [
        nota,
        NOTA_PONTUACAO[nota],
        resultado.distorganizador?.[nota] || 0,
      ].join(";")
    );
  }

  linhas.push("");
  linhas.push(["Critérios oficiais do evento"].join(";"));
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

  for (const criterio of resultado.criterios || []) {
    linhas.push(
      [
        limparCSV(criterio.label),
        criterio.media != null ? criterio.media.toFixed(2) : "",
        criterio.dist?.["Ótimo"] || 0,
        criterio.dist?.["Bom"] || 0,
        criterio.dist?.["Regular"] || 0,
        criterio.dist?.["Ruim"] || 0,
        criterio.dist?.["Péssimo"] || 0,
      ].join(";")
    );
  }

  linhas.push("");
  linhas.push(["Comentários"].join(";"));
  linhas.push(
    [
      "Desempenho organizador",
      "O que mais gostou",
      "Sugestões",
      "Comentários finais",
    ].join(";")
  );

  for (const item of resultado.detalhes || []) {
    linhas.push(
      [
        limparCSV(item.desempenho),
        limparCSV(item.gostou),
        limparCSV(item.sugestao),
        limparCSV(item.comentario),
      ].join(";")
    );
  }

  baixarArquivo(`${filename}.csv`, linhas.join("\r\n"));
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function HeroMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-center ring-1 ring-white/15">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      </div>

      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">
        {label}
      </p>
    </div>
  );
}

function NotaBadge({ nota, quantidade }) {
  return (
    <div
      className={`rounded-2xl px-2 py-2 text-center text-[11px] font-bold ring-1 ${
        NOTA_STYLE[nota]
      }`}
    >
      <p>{nota}</p>
      <p className="mt-0.5 text-sm">{quantidade || 0}</p>
    </div>
  );
}

function KPI({ titulo, valor, descricao, icon: Icon, destaque = false }) {
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
                destaque
                  ? "text-white/75"
                  : "text-slate-500 dark:text-zinc-400"
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

function BarraMedia({ label, media, dist }) {
  const percentual = media != null ? Math.min(100, Math.max(0, media * 10)) : 0;

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-slate-950 dark:text-white">
            {label}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Classificação: {classificarMedia(media)}
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
          aria-label={`Média ${label}: ${
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
          <NotaBadge key={nota} nota={nota} quantidade={dist?.[nota] || 0} />
        ))}
      </div>
    </div>
  );
}

function ComentarioCard({ item }) {
  return (
    <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </div>

        <div>
          <p className="text-sm font-black text-slate-950 dark:text-white">
            Comentário do participante
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Resposta anônima
          </p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-700 dark:text-zinc-200">
        {item.desempenho ? (
          <p>
            <strong>Desempenho do organizador:</strong> {item.desempenho}
          </p>
        ) : null}

        {item.gostou ? (
          <p>
            <strong>O que mais gostou:</strong> {item.gostou}
          </p>
        ) : null}

        {item.sugestao ? (
          <p>
            <strong>Sugestões de melhoria:</strong> {item.sugestao}
          </p>
        ) : null}

        {item.comentario ? (
          <p>
            <strong>Comentários finais:</strong> {item.comentario}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function AvaliacaoEvento({
  avaliacao,
  titulo = "Avaliações do Evento",
  maxComentarios = 3,
  exportavel = false,
  onExport,
  compact = false,
  emptyMessage = "Nenhuma avaliação registrada.",
}) {
  const regionId = useId();
  const reduceMotion = useReducedMotion();

  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [buscaComentario, setBuscaComentario] = useState("");

  const resultado = useMemo(
    () => calcularMediasAvaliacao(avaliacao),
    [avaliacao]
  );

  const comentariosFiltrados = useMemo(() => {
    const filtro = buscaComentario.trim().toLowerCase();

    if (!filtro) return resultado.detalhes;

    return resultado.detalhes.filter((item) =>
      [item.desempenho, item.gostou, item.sugestao, item.comentario]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(filtro))
    );
  }, [resultado.detalhes, buscaComentario]);

  const comentariosVisiveis = mostrarTodos
    ? comentariosFiltrados
    : comentariosFiltrados.slice(0, maxComentarios);

  const vazio =
    resultado.mediaEvento == null &&
    resultado.mediaorganizador == null &&
    resultado.detalhes.length === 0;

  const wrapperPadding = compact ? "p-4" : "p-5 sm:p-6";

  function handleExport() {
    exportarCSV("avaliacao_evento", resultado);
    onExport?.(resultado);
  }

  if (!Array.isArray(avaliacao)) {
    return (
      <section className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800/60">
        Erro: avaliações não carregadas corretamente.
      </section>
    );
  }

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-[2rem] bg-slate-50 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800 ${wrapperPadding}`}
      role="region"
      aria-labelledby={`${regionId}-title`}
      aria-describedby={`${regionId}-desc`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-50 opacity-80 dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-cyan-950/20" />

      <div className="relative">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-violet-900 ring-1 ring-violet-100 backdrop-blur dark:bg-zinc-900/80 dark:text-violet-100 dark:ring-violet-900">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Resumo institucional
            </div>

            <h3
              id={`${regionId}-title`}
              className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl"
            >
              {titulo}
            </h3>

            <p
              id={`${regionId}-desc`}
              className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-zinc-300"
            >
              Média oficial do evento, desempenho do organizador, distribuição de
              notas e comentários qualitativos dos participantes.
            </p>
          </div>

          {exportavel ? (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200"
              aria-label="Exportar avaliações em CSV"
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </button>
          ) : null}
        </div>

        {vazio ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-6">
            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Resumo das avaliações"
            >
              <KPI
                titulo="Total de respostas"
                valor={resultado.totalRespostas || 0}
                descricao="Avaliações recebidas"
                icon={BarChart3}
                destaque
              />

              <KPI
                titulo="Média do evento"
                valor={
                  resultado.mediaEvento != null
                    ? `${resultado.mediaEvento.toFixed(2)} / 10`
                    : "—"
                }
                descricao={classificarMedia(resultado.mediaEvento)}
                icon={TrendingUp}
              />

              <KPI
                titulo="Média do organizador"
                valor={
                  resultado.mediaorganizador != null
                    ? `${resultado.mediaorganizador.toFixed(2)} / 10`
                    : "—"
                }
                descricao={classificarMedia(resultado.mediaorganizador)}
                icon={Star}
              />

              <KPI
                titulo="Média geral"
                valor={
                  resultado.mediaGeral != null
                    ? `${resultado.mediaGeral.toFixed(2)} / 10`
                    : "—"
                }
                descricao="Evento + organizador"
                icon={Sparkles}
              />
            </section>

            <section aria-label="Distribuição do desempenho do organizador">
              <BarraMedia
                label="Desempenho do organizador"
                media={resultado.mediaorganizador}
                dist={resultado.distorganizador}
              />
            </section>

            <section aria-labelledby={`${regionId}-criterios`}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4
                    id={`${regionId}-criterios`}
                    className="text-lg font-black text-slate-950 dark:text-white"
                  >
                    Critérios oficiais do evento
                  </h4>

                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Escala oficial convertida para pontuação de 0 a 10.
                  </p>
                </div>

                <span className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
                  Ótimo 10 • Bom 8 • Regular 6 • Ruim 4 • Péssimo 2
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {resultado.criterios.map((criterio) => (
                  <BarraMedia
                    key={criterio.campo}
                    label={criterio.label}
                    media={criterio.media}
                    dist={criterio.dist}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby={`${regionId}-comentarios`}>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4
                    id={`${regionId}-comentarios`}
                    className="text-lg font-black text-slate-950 dark:text-white"
                  >
                    Comentários qualitativos
                  </h4>

                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Comentários exibidos sem identificação nominal do avaliador.
                  </p>
                </div>

                <input
                  type="search"
                  value={buscaComentario}
                  onChange={(event) => setBuscaComentario(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-violet-950 sm:max-w-sm"
                  placeholder="Buscar nos comentários..."
                  aria-label="Buscar nos comentários"
                />
              </div>

              {comentariosFiltrados.length ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {comentariosVisiveis.map((item, index) => (
                      <ComentarioCard key={`${regionId}-${index}`} item={item} />
                    ))}
                  </div>

                  {comentariosFiltrados.length > maxComentarios ? (
                    <button
                      type="button"
                      onClick={() => setMostrarTodos((value) => !value)}
                      className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
                      aria-expanded={mostrarTodos}
                    >
                      {mostrarTodos
                        ? "Mostrar menos"
                        : `Ver mais (${comentariosFiltrados.length - maxComentarios})`}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
                  Nenhum comentário encontrado.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </motion.section>
  );
}

AvaliacaoEvento.propTypes = {
  avaliacao: PropTypes.arrayOf(PropTypes.object),
  titulo: PropTypes.string,
  maxComentarios: PropTypes.number,
  exportavel: PropTypes.bool,
  onExport: PropTypes.func,
  compact: PropTypes.bool,
  emptyMessage: PropTypes.string,
};