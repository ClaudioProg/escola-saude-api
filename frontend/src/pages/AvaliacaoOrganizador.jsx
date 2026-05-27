// ✅ frontend/src/pages/Avaliacaoorganizador.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Download,
  FileText,
  MessageSquare,
  RefreshCw,
  School,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
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

const CAMPOS_OBJETIVOS = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "desempenho_organizador",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
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

const NOTA_STYLE = {
  Ótimo: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60",
  Bom: "bg-lime-50 text-lime-800 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800/60",
  Regular: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60",
  Ruim: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-800/60",
  Péssimo: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800/60",
};

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

function getUsuarioLocal() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    return {};
  }
}

function extrairData(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

function limparCSV(value) {
  return String(value ?? "")
    .replaceAll(/[\r\n]+/g, " ")
    .replaceAll(/;/g, ",");
}

function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime || "text/plain" });
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

function normalizarEventosDoorganizador(turmas = []) {
  const porEvento = new Map();

  for (const turma of turmas) {
    const eventoId = turma?.evento?.id || turma?.evento_id;

    if (!eventoId) continue;

    const chave = String(eventoId);
    const titulo =
      turma?.evento?.titulo ||
      turma?.evento?.nome ||
      turma?.evento_titulo ||
      turma?.evento_nome ||
      "Evento";

    if (!porEvento.has(chave)) {
      porEvento.set(chave, {
        id: eventoId,
        titulo,
        turmas: [],
        data_inicio: turma?.data_inicio || null,
        data_fim: turma?.data_fim || null,
      });
    }

    const evento = porEvento.get(chave);

    evento.turmas.push({
      id: turma.id,
      nome: turma.nome || `Turma ${turma.id}`,
      data_inicio: turma.data_inicio || null,
      data_fim: turma.data_fim || null,
    });

    if (
      !evento.data_inicio ||
      (turma.data_inicio && String(turma.data_inicio) < String(evento.data_inicio))
    ) {
      evento.data_inicio = turma.data_inicio;
    }

    if (
      !evento.data_fim ||
      (turma.data_fim && String(turma.data_fim) > String(evento.data_fim))
    ) {
      evento.data_fim = turma.data_fim;
    }
  }

  return Array.from(porEvento.values()).sort((a, b) =>
    String(b.data_inicio || "").localeCompare(String(a.data_inicio || ""))
  );
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

  const mediasValidas = Object.values(medias).filter((value) =>
    Number.isFinite(value)
  );

  const mediaGeral = mediasValidas.length
    ? Number(
        (
          mediasValidas.reduce((acc, value) => acc + value, 0) /
          mediasValidas.length
        ).toFixed(2)
      )
    : null;

  return {
    total: respostas.length,
    dist,
    medias,
    textos,
    mediaorganizador: medias.desempenho_organizador ?? null,
    mediaGeral,
  };
}

function classificarMedia(media) {
  if (media == null) return "Sem dados";
  if (media >= 9) return "Excelente";
  if (media >= 8) return "Muito bom";
  if (media >= 6) return "Regular";
  if (media >= 4) return "Atenção";
  return "Crítico";
}

function obterTopCriterios(medias, modo = "melhores") {
  const itens = CAMPOS_OBJETIVOS.map((campo) => ({
    campo,
    label: labelDoCampo(campo),
    media: medias?.[campo] ?? null,
  })).filter((item) => item.media != null);

  return itens
    .sort((a, b) =>
      modo === "melhores" ? b.media - a.media : a.media - b.media
    )
    .slice(0, 4);
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function StickyControle({
  eventos,
  eventoId,
  setEventoId,
  eventoAtual,
  onExportar,
  exportDisabled,
}) {
  return (
    <section className="sticky top-0 z-30 -mx-3 sm:mx-0 mb-6 border-b border-slate-200/80 bg-slate-50/90 px-3 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 sm:rounded-b-3xl sm:border sm:shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="sel-evento"
            className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400"
          >
            Evento analisado
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                  {evento.data_inicio
                    ? ` • ${formatDateBr(evento.data_inicio)}`
                    : ""}
                  {evento.data_fim
                    ? ` a ${formatDateBr(evento.data_fim)}`
                    : ""}
                </option>
              ))}

              {!eventos.length ? (
                <option value="">Nenhum evento encontrado</option>
              ) : null}
            </select>

            {eventoAtual ? (
              <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
                <School className="h-4 w-4" aria-hidden="true" />
                {eventoAtual.turmas?.length || 0} turma(s)
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onExportar}
          disabled={exportDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200"
          aria-label="Exportar CSV do evento"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Exportar CSV
        </button>
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

          <p className="mt-2 text-2xl sm:text-3xl font-black leading-tight">
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

function CampoBarra({ nome, media, dist }) {
  const percentual = media != null ? Math.min(100, Math.max(0, media * 10)) : 0;
  const linha = dist || criarDistribuicaoNotas();
  const classificacao = classificarMedia(media);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-950 dark:text-white">
            {nome}
          </p>

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
                  {item.label}
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

function QuadroComentarios({ titulo, itens, icon: Icon }) {
  const lista = Array.isArray(itens) ? itens : [];

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
          {Icon ? <Icon className="w-4 h-4 text-violet-600" aria-hidden="true" /> : null}
          {titulo}
        </h3>

        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          {lista.length}
        </span>
      </div>

      {lista.length ? (
        <ul className="space-y-3 text-sm">
          {lista.slice(0, 8).map((texto, index) => (
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
          Sem comentários registrados.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────── */

export default function Avaliacaoorganizador() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const [usuario] = useState(() => getUsuarioLocal());
  const nome = usuario?.nome || "";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState("");
  const [cacheAvaliacoes, setCacheAvaliacoes] = useState({});

  const eventoAtual = useMemo(() => {
    return eventos.find((evento) => String(evento.id) === String(eventoId));
  }, [eventos, eventoId]);

  const avaliacaoAtual = cacheAvaliacoes[String(eventoId)] || null;

  const resumoHero = useMemo(() => {
    const turmas = eventos.reduce(
      (acc, evento) => acc + Number(evento.turmas?.length || 0),
      0
    );

    const respostas = Object.values(cacheAvaliacoes).reduce(
      (acc, item) => acc + Number(item?.agregados?.total || 0),
      0
    );

    return {
      eventos: eventos.length,
      turmas,
      respostas,
    };
  }, [eventos, cacheAvaliacoes]);

  const melhoresCriterios = useMemo(() => {
    return obterTopCriterios(avaliacaoAtual?.agregados?.medias, "melhores");
  }, [avaliacaoAtual]);

  const pontosAtencao = useMemo(() => {
    return obterTopCriterios(avaliacaoAtual?.agregados?.medias, "piores");
  }, [avaliacaoAtual]);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  const carregarEventos = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setLive("Carregando eventos do organizador.");

    try {
      if (typeof api?.organizador?.minhasTurmas !== "function") {
        throw new Error(
          "Facade api.organizador.minhasTurmas não encontrada em frontend/src/services/api.js."
        );
      }

      const response = await api.organizador.minhasTurmas();
      const turmas = extrairData(response);
      const eventosNormalizados = normalizarEventosDoorganizador(turmas);

      setEventos(eventosNormalizados);

      if (!eventosNormalizados.length) {
        setEventoId("");
        setErro("Você não possui eventos vinculados como organizador.");
        setLive("Nenhum evento vinculado ao organizador foi encontrado.");
        return;
      }

      setEventoId((atual) => atual || String(eventosNormalizados[0].id));
      setLive(`Foram encontrados ${eventosNormalizados.length} evento(s).`);
    } catch (error) {
      console.error("[Avaliacaoorganizador] erro ao carregar eventos:", error);

      setEventos([]);
      setEventoId("");
      setErro("Erro ao carregar seus eventos como organizador.");

      notifyError(
        "Não foi possível carregar seus eventos. Tente novamente ou acione o suporte se o problema continuar."
      );

      setLive("Falha ao carregar eventos do organizador.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarAvaliacaoDoEvento = useCallback(
    async (id) => {
      const evento = eventos.find((item) => String(item.id) === String(id));

      if (!evento) {
        return {
          respostas: [],
          agregados: agregarRespostas([]),
        };
      }

      setCarregando(true);
      setErro("");
      setLive("Carregando avaliações do evento.");

      try {
        if (typeof api?.avaliacao?.porTurma !== "function") {
          throw new Error(
            "Facade api.avaliacao.porTurma não encontrada em frontend/src/services/api.js."
          );
        }

        const respostas = [];

        await Promise.all(
          (evento.turmas || []).map(async (turma) => {
            try {
              const response = await api.avaliacao.porTurma(turma.id);
              const lista = extrairData(response);

              if (lista.length) {
                respostas.push(
                  ...lista.map((item) => ({
                    ...item,
                    __turmaId: turma.id,
                    __turmaNome: turma.nome,
                  }))
                );
              }
            } catch (error) {
              console.warn(
                `[Avaliacaoorganizador] falha ao buscar turma ${turma.id}:`,
                error
              );
            }
          })
        );

        const payload = {
          respostas,
          agregados: agregarRespostas(respostas),
        };

        setCacheAvaliacoes((prev) => ({
          ...prev,
          [String(id)]: payload,
        }));

        setLive("Avaliações carregadas.");

        return payload;
      } catch (error) {
        console.error("[Avaliacaoorganizador] erro ao carregar avaliações:", error);

        setErro("Erro ao carregar avaliações do evento.");

        notifyError(
          "Não foi possível carregar as avaliações. Tente novamente ou acione o suporte se o problema continuar."
        );

        setLive("Falha ao carregar avaliações do evento.");

        return {
          respostas: [],
          agregados: agregarRespostas([]),
        };
      } finally {
        setCarregando(false);
      }
    },
    [eventos]
  );

  useEffect(() => {
    document.title = "Avaliação do organizador | Escola da Saúde";
    carregarEventos();
  }, [carregarEventos]);

  useEffect(() => {
    if (!eventoId) return;

    if (cacheAvaliacoes[String(eventoId)]) {
      return;
    }

    carregarAvaliacaoDoEvento(eventoId);
  }, [eventoId, cacheAvaliacoes, carregarAvaliacaoDoEvento]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const editando = ["input", "textarea", "select"].includes(tag);

      if (editando) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();

        if (eventoId) {
          setCacheAvaliacoes((prev) => {
            const next = { ...prev };
            delete next[String(eventoId)];
            return next;
          });

          carregarAvaliacaoDoEvento(eventoId);
        } else {
          carregarEventos();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eventoId, carregarEventos, carregarAvaliacaoDoEvento]);

  function atualizarManual() {
    setCacheAvaliacoes((prev) => {
      const next = { ...prev };

      if (eventoId) {
        delete next[String(eventoId)];
      }

      return next;
    });

    if (eventoId) {
      carregarAvaliacaoDoEvento(eventoId);
    } else {
      carregarEventos();
    }
  }

  function exportarCSV() {
    if (!eventoAtual || !avaliacaoAtual) {
      notifyInfo("Selecione um evento com avaliações para exportar.");
      return;
    }

    const { agregados, respostas } = avaliacaoAtual;
    const linhas = [];
    const periodo =
      eventoAtual.data_inicio || eventoAtual.data_fim
        ? `${formatDateBr(eventoAtual.data_inicio)} — ${formatDateBr(
            eventoAtual.data_fim
          )}`
        : "—";

    linhas.push(["Evento", "Período", "Total respostas"].join(";"));
    linhas.push(
      [
        limparCSV(eventoAtual.titulo),
        limparCSV(periodo),
        agregados?.total ?? 0,
      ].join(";")
    );

    linhas.push("");
    linhas.push(["Médias por critério"].join(";"));
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

    for (const campo of CAMPOS_OBJETIVOS) {
      const nome = labelDoCampo(campo);
      const media = agregados?.medias?.[campo] ?? "";
      const dist = agregados?.dist?.[campo] || criarDistribuicaoNotas();

      linhas.push(
        [
          limparCSV(nome),
          media,
          dist["Ótimo"] || 0,
          dist["Bom"] || 0,
          dist["Regular"] || 0,
          dist["Ruim"] || 0,
          dist["Péssimo"] || 0,
        ].join(";")
      );
    }

    linhas.push("");
    linhas.push(["Comentários qualitativos"].join(";"));

    for (const campo of CAMPOS_TEXTOS) {
      const nome = labelDoCampo(campo);
      const lista = agregados?.textos?.[campo] || [];

      linhas.push([limparCSV(nome)].join(";"));

      if (!lista.length) {
        linhas.push(["(Sem comentários)"].join(";"));
      } else {
        for (const texto of lista) {
          linhas.push([limparCSV(texto)].join(";"));
        }
      }

      linhas.push("");
    }

    if (Array.isArray(respostas) && respostas.length) {
      const colunas = [
        "__turmaId",
        "__turmaNome",
        ...CAMPOS_OBJETIVOS,
        ...CAMPOS_TEXTOS,
      ];

      linhas.push(["Dados brutos por resposta"].join(";"));
      linhas.push(colunas.join(";"));

      for (const resposta of respostas) {
        linhas.push(
          colunas.map((coluna) => limparCSV(resposta[coluna] ?? "")).join(";")
        );
      }
    }

    const csv = linhas.join("\r\n");

    baixarArquivo(
      `avaliacao_evento_${eventoAtual.id}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );

    notifySuccess("CSV gerado com sucesso.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <HeaderHero
  titulo="Avaliação do organizador"
  subtitulo="Acompanhe desempenho, critérios, distribuição oficial de notas e comentários qualitativos das turmas vinculadas aos seus eventos."
  icon={BarChart3}
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
          <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <KPI
      titulo="Eventos"
      valor={resumoHero.eventos}
      descricao="Eventos vinculados ao organizador"
      icon={CalendarRange}
    />

    <KPI
      titulo="Turmas"
      valor={resumoHero.turmas}
      descricao="Turmas consideradas na análise"
      icon={School}
    />

    <KPI
      titulo="Respostas"
      valor={resumoHero.respostas}
      descricao="Avaliações recebidas"
      icon={ClipboardList}
      destaque
    />
  </div>

  <button
    type="button"
    onClick={atualizarManual}
    disabled={carregando}
    className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800 dark:hover:bg-zinc-800"
    aria-label="Atualizar avaliações do organizador"
  >
    <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
    {carregando ? "Atualizando..." : "Atualizar painel"}
  </button>
</section>
          <StickyControle
            eventos={eventos}
            eventoId={eventoId}
            setEventoId={setEventoId}
            eventoAtual={eventoAtual}
            onExportar={exportarCSV}
            exportDisabled={!eventoAtual || !avaliacaoAtual}
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
          ) : !avaliacaoAtual ? (
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
                aria-label="Resumo das avaliações"
              >
                <KPI
                  titulo="Total de respostas"
                  valor={avaliacaoAtual.agregados?.total || 0}
                  descricao="Respostas recebidas nas turmas do evento"
                  icon={ClipboardList}
                  destaque
                />

                <KPI
                  titulo="Desempenho do organizador"
                  valor={
                    avaliacaoAtual.agregados?.mediaorganizador != null
                      ? `${avaliacaoAtual.agregados.mediaorganizador.toFixed(2)} / 10`
                      : "—"
                  }
                  descricao={classificarMedia(
                    avaliacaoAtual.agregados?.mediaorganizador
                  )}
                  icon={Star}
                />

                <KPI
                  titulo="Média geral"
                  valor={
                    avaliacaoAtual.agregados?.mediaGeral != null
                      ? `${avaliacaoAtual.agregados.mediaGeral.toFixed(2)} / 10`
                      : "—"
                  }
                  descricao="Média dos critérios avaliados"
                  icon={TrendingUp}
                />

                <KPI
                  titulo="Turmas avaliadas"
                  valor={eventoAtual.turmas?.length || 0}
                  descricao={
                    eventoAtual.data_inicio || eventoAtual.data_fim
                      ? `${formatDateBr(
                          eventoAtual.data_inicio
                        )} — ${formatDateBr(eventoAtual.data_fim)}`
                      : "Período não informado"
                  }
                  icon={School}
                />
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RankingCriterios
                  titulo="Melhores critérios"
                  itens={melhoresCriterios}
                  icon={Sparkles}
                />

                <RankingCriterios
                  titulo="Pontos de atenção"
                  itens={pontosAtencao}
                  icon={FileText}
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
                  {CAMPOS_OBJETIVOS.map((campo) => (
                    <CampoBarra
                      key={campo}
                      nome={labelDoCampo(campo)}
                      media={avaliacaoAtual.agregados?.medias?.[campo]}
                      dist={avaliacaoAtual.agregados?.dist?.[campo]}
                    />
                  ))}
                </div>
              </section>

              <section
                className="grid grid-cols-1 gap-4 lg:grid-cols-3"
                aria-label="Comentários qualitativos"
              >
                <QuadroComentarios
                  titulo="O que mais gostou"
                  itens={avaliacaoAtual.agregados?.textos?.gostou_mais}
                  icon={MessageSquare}
                />

                <QuadroComentarios
                  titulo="Sugestões de melhoria"
                  itens={avaliacaoAtual.agregados?.textos?.sugestoes_melhoria}
                  icon={MessageSquare}
                />

                <QuadroComentarios
                  titulo="Comentários finais"
                  itens={avaliacaoAtual.agregados?.textos?.comentarios_finais}
                  icon={MessageSquare}
                />
              </section>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}