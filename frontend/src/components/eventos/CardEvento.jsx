/* eslint-disable no-console */
// ✅ frontend/src/components/eventos/CardEvento.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Card público/base premium de evento.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - CardTurma vem de ./CardTurma
// - Folder oficial vem de getEventoFolderUrl(evento)
// - Programação oficial vem de getEventoProgramacaoUrl(evento)
// - Status oficial: programado | andamento | encerrado | sem_datas
// - Local oficial: evento.local
// - Turma oficial: turma.organizadores
// - Média de avaliação em escala oficial 0..10
// - Sem resolveAssetUrl
// - Sem folder_url/programacao_pdf_url como fonte funcional
// - Sem localizacao/endereco/localidade
// - Sem turma.organizador como alias
// - Sem status em_andamento
// - Sem conversão textual de nota como ótimo/bom/regular
// - Date-only seguro, sem new Date("YYYY-MM-DD")
// - Visual reestruturado em padrão premium
// - Melhor hierarquia: imagem → status → título → período/público → ações → turmas

import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  FileText,
  Image as ImageIcon,
  Layers3,
  MapPin,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react";

import CardTurma from "./CardTurma";
import {
  EVENTO_STATUS,
  deduzStatusEvento,
  getEventoFolderUrl,
  getEventoProgramacaoUrl,
  ymd,
} from "../../services/eventoService";

/* ─────────────────────────────────────────────────────────────
   Helpers date-only
────────────────────────────────────────────────────────────── */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymdSeguro(value) {
  if (typeof value === "string") return ymd(value);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate()
    )}`;
  }

  return "";
}

function formatDateBr(value) {
  const date = ymdSeguro(value);

  if (!date) return "";

  const [, month, day] = date.split("-");
  return `${day}/${month}/${date.slice(0, 4)}`;
}

function getDatasTurma(turma) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datas.length) {
    return datas
      .map((item) => ymdSeguro(item?.data || item))
      .filter(Boolean)
      .sort();
  }

  const dataInicio = ymdSeguro(turma?.data_inicio);
  const dataFim = ymdSeguro(turma?.data_fim || turma?.data_inicio);

  if (!dataInicio) return [];

  if (dataFim && dataFim !== dataInicio) {
    return [dataInicio, dataFim].sort();
  }

  return [dataInicio];
}

function getPeriodoEvento(evento, turmas = []) {
  const inicioEvento = ymdSeguro(evento?.data_inicio_geral || evento?.data_inicio);
  const fimEvento = ymdSeguro(evento?.data_fim_geral || evento?.data_fim);

  if (inicioEvento && fimEvento) {
    return inicioEvento === fimEvento
      ? formatDateBr(inicioEvento)
      : `${formatDateBr(inicioEvento)} até ${formatDateBr(fimEvento)}`;
  }

  const datas = [];

  for (const turma of Array.isArray(turmas) ? turmas : []) {
    datas.push(...getDatasTurma(turma));
  }

  const validas = datas.filter(Boolean).sort();

  if (validas.length) {
    const min = validas[0];
    const max = validas.at(-1);

    return min === max
      ? formatDateBr(min)
      : `${formatDateBr(min)} até ${formatDateBr(max)}`;
  }

  return "Período não informado";
}

function getStatusEvento(evento, turmas = [], hoje = "") {
  const statusServidor = deduzStatusEvento(evento);

  if (
    statusServidor === EVENTO_STATUS.PROGRAMADO ||
    statusServidor === EVENTO_STATUS.ANDAMENTO ||
    statusServidor === EVENTO_STATUS.ENCERRADO ||
    statusServidor === EVENTO_STATUS.SEM_DATAS
  ) {
    return statusServidor;
  }

  const datas = [];

  const inicioEvento = ymdSeguro(evento?.data_inicio_geral || evento?.data_inicio);
  const fimEvento = ymdSeguro(evento?.data_fim_geral || evento?.data_fim);

  if (inicioEvento) datas.push(inicioEvento);
  if (fimEvento) datas.push(fimEvento);

  if (!datas.length) {
    for (const turma of Array.isArray(turmas) ? turmas : []) {
      datas.push(...getDatasTurma(turma));
    }
  }

  const ordenadas = datas.filter(Boolean).sort();

  if (!ordenadas.length) return EVENTO_STATUS.SEM_DATAS;

  const hojeYmd = ymdSeguro(hoje) || hojeIsoLocal();
  const inicio = ordenadas[0];
  const fim = ordenadas.at(-1);

  if (hojeYmd < inicio) return EVENTO_STATUS.PROGRAMADO;
  if (hojeYmd > fim) return EVENTO_STATUS.ENCERRADO;

  return EVENTO_STATUS.ANDAMENTO;
}

/* ─────────────────────────────────────────────────────────────
   Helpers de avaliação
────────────────────────────────────────────────────────────── */

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

function notaParaNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  const number = Number(valor);

  if (Number.isFinite(number) && number >= 0 && number <= 10) {
    return number;
  }

  return null;
}

function calcularMediaEventoViaLista(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) return "—";

  const medias = avaliacoes
    .map((avaliacao) => {
      let soma = 0;
      let qtd = 0;

      for (const campo of CAMPOS_NOTA_EVENTO) {
        const nota = notaParaNumero(avaliacao?.[campo]);

        if (nota !== null) {
          soma += nota;
          qtd += 1;
        }
      }

      return qtd ? soma / qtd : null;
    })
    .filter((value) => value !== null);

  if (!medias.length) return "—";

  const media = medias.reduce((acc, value) => acc + value, 0) / medias.length;

  return media.toFixed(1);
}

/* ─────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function eventoTemProgramacao(evento) {
  return Boolean(
    evento?.programacao_kind === "blob" ||
      evento?.tem_programacao ||
      evento?.programacao_pdf_size ||
      evento?.programacao_pdf_updated_at
  );
}

function normalizeTurmaParaCard(turma) {
  return {
    ...turma,
    organizadores: Array.isArray(turma?.organizadores) ? turma.organizadores : [],
  };
}

function statusLabel(status) {
  if (status === EVENTO_STATUS.PROGRAMADO) return "Programado";
  if (status === EVENTO_STATUS.ANDAMENTO) return "Em andamento";
  if (status === EVENTO_STATUS.ENCERRADO) return "Encerrado";

  return "Datas a definir";
}

function statusClasses(status) {
  if (status === EVENTO_STATUS.PROGRAMADO) {
    return {
      chip:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
      aura: "bg-emerald-500/10",
    };
  }

  if (status === EVENTO_STATUS.ANDAMENTO) {
    return {
      chip:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
      bar: "from-amber-500 via-orange-500 to-rose-500",
      aura: "bg-amber-500/10",
    };
  }

  if (status === EVENTO_STATUS.ENCERRADO) {
    return {
      chip:
        "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
      bar: "from-rose-600 via-red-600 to-zinc-700",
      aura: "bg-rose-500/10",
    };
  }

  return {
    chip:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
    bar: "from-indigo-500 via-fuchsia-500 to-pink-500",
    aura: "bg-indigo-500/10",
  };
}

/* ─────────────────────────────────────────────────────────────
   UI
────────────────────────────────────────────────────────────── */

function EmptyPoster({ hasUrl }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
      <ImageIcon className="h-9 w-9" aria-hidden="true" />
      <span className="text-xs font-semibold">
        {hasUrl ? "Imagem indisponível" : "Sem folder"}
      </span>
    </div>
  );
}

function Chip({ icon, children, title }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-xs font-bold text-zinc-700 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200"
    >
      <span className="shrink-0 opacity-80" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function InscricaoBadge({ jaInscrito }) {
  const ok = Boolean(jaInscrito);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black shadow-sm",
        ok
          ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
      ].join(" ")}
      title={
        ok
          ? "Você já está inscrito em alguma turma deste evento."
          : "Você ainda não está inscrito neste evento."
      }
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <CircleDashed className="h-4 w-4" aria-hidden="true" />
      )}
      {ok ? "Inscrito" : "Não inscrito"}
    </span>
  );
}

function TechButton({
  as = "button",
  href,
  onClick,
  children,
  title,
  ariaLabel,
  variant = "ghost",
  disabled = false,
}) {
  const base = [
    "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5",
    "text-sm font-black shadow-sm transition select-none hover:shadow",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
  ].join(" ");

  const styles = {
    ghost: [
      "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
      "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/70",
    ].join(" "),
    filled:
      "border-white/10 bg-gradient-to-r from-zinc-950 via-emerald-950 to-emerald-800 text-white hover:brightness-[1.06]",
    soft: [
      "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
      "dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/45",
    ].join(" "),
  };

  const cls = [
    base,
    styles[variant] || styles.ghost,
    disabled ? "pointer-events-none cursor-not-allowed opacity-60" : "",
  ].join(" ");

  if (as === "a") {
    return (
      <a
        className={cls}
        href={href}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, title, tone = "slate" }) {
  const tones = {
    slate:
      "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    teal:
      "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-100",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100",
  };

  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${tones[tone] || tones.slate}`}
      title={title || `${label}: ${value ?? "—"}`}
      role="group"
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-white/5">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide opacity-65">
            {label}
          </div>
          <div className="truncate text-lg font-black leading-tight">
            {value ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function CardEvento({
  evento,
  expandido = false,
  toggleExpandir,
  turmas = [],

  carregarInscritos,
  inscritosPorTurma = {},

  carregarAvaliacao,
  avaliacaoPorTurma = {},

  presencasPorTurma = {},
  carregarPresencas,

  gerarRelatorioPDF,

  hoje = "",
  inscrever,
  inscrevendo,
  inscricaoConfirmadas = [],
}) {
  const eventoId = evento?.id;
  const titulo = evento?.titulo || "Evento";
  const descricao = String(evento?.descricao || "").trim();

  const stats = useMemo(() => {
    if (!Array.isArray(turmas) || !turmas.length) {
      return {
        totalTurmas: 0,
        totalInscritos: 0,
        totalPresentes: 0,
        presencaMedia: "0",
        totalAvaliacao: 0,
        notaMedia: "—",
      };
    }

    let totalInscritos = 0;
    let totalPresentes = 0;
    let totalAvaliacao = 0;

    const mediasDiretas = [];
    const todasAvaliacoes = [];

    for (const turma of turmas) {
      const inscritos = asArray(inscritosPorTurma?.[turma.id]);
      totalInscritos += inscritos.length;

      const presencas = asArray(presencasPorTurma?.[turma.id]);
      totalPresentes += presencas.filter((item) => item?.presente === true).length;

      const blocoAval = avaliacaoPorTurma?.[turma.id] || {};
      const avaliacoes = Array.isArray(blocoAval?.avaliacao)
        ? blocoAval.avaliacao
        : [];

      const totalAvalTurma = Number(blocoAval?.total_avaliacao);
      totalAvaliacao += Number.isFinite(totalAvalTurma)
        ? totalAvalTurma
        : avaliacoes.length;

      if (
        blocoAval?.media_evento !== null &&
        blocoAval?.media_evento !== undefined &&
        blocoAval?.media_evento !== "—"
      ) {
        const mediaDireta = Number(blocoAval.media_evento);

        if (
          Number.isFinite(mediaDireta) &&
          mediaDireta >= 0 &&
          mediaDireta <= 10
        ) {
          mediasDiretas.push(mediaDireta);
        }
      } else {
        todasAvaliacoes.push(...avaliacoes);
      }
    }

    const presencaMedia = totalInscritos
      ? ((totalPresentes / totalInscritos) * 100).toFixed(0)
      : "0";

    let notaMedia = "—";

    if (mediasDiretas.length) {
      const media =
        mediasDiretas.reduce((acc, value) => acc + value, 0) /
        mediasDiretas.length;

      notaMedia = media.toFixed(1);
    } else if (todasAvaliacoes.length) {
      notaMedia = calcularMediaEventoViaLista(todasAvaliacoes);
    }

    return {
      totalTurmas: turmas.length,
      totalInscritos,
      totalPresentes,
      presencaMedia,
      totalAvaliacao,
      notaMedia,
    };
  }, [avaliacaoPorTurma, inscritosPorTurma, presencasPorTurma, turmas]);

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;

    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos?.(turma.id);
      if (!avaliacaoPorTurma?.[turma.id]) carregarAvaliacao?.(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas?.(turma.id);
    }
  }, [
    avaliacaoPorTurma,
    carregarAvaliacao,
    carregarInscritos,
    carregarPresencas,
    expandido,
    inscritosPorTurma,
    presencasPorTurma,
    turmas,
  ]);

  const periodoTexto = useMemo(
    () => getPeriodoEvento(evento, turmas),
    [evento, turmas]
  );

  const status = useMemo(
    () => getStatusEvento(evento, turmas, hoje),
    [evento, hoje, turmas]
  );

  const statusStyle = statusClasses(status);

  const turmasId = `evento-${eventoId}-turmas`;
  const tituloId = `evento-${eventoId}-titulo`;
  const periodoId = `evento-${eventoId}-periodo`;

  const folderUrl = useMemo(() => getEventoFolderUrl(evento), [evento]);
  const programacaoUrl = useMemo(() => getEventoProgramacaoUrl(evento), [evento]);

  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [folderUrl]);

  const tipo = String(evento?.tipo || "").trim();
  const publico = String(evento?.publico_alvo || "").trim();
  const local = String(evento?.local || "").trim();

  const jaInscrito = Boolean(evento?.ja_inscrito);
  const temProgramacao = eventoTemProgramacao(evento) && Boolean(programacaoUrl);

  const handleToggle = useCallback(() => {
    toggleExpandir?.(eventoId);
  }, [eventoId, toggleExpandir]);

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_18px_70px_-45px_rgba(15,23,42,0.62)] transition hover:shadow-[0_22px_80px_-48px_rgba(15,23,42,0.75)] dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${statusStyle.bar}`}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl ${statusStyle.aura}`}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)_210px] lg:p-6">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="aspect-[16/9] w-full lg:aspect-[3/4]">
            {folderUrl && imgOk ? (
              <img
                src={folderUrl}
                alt={`Folder do evento ${titulo}`}
                loading="lazy"
                className="h-full w-full object-cover"
                draggable={false}
                referrerPolicy="no-referrer"
                onError={() => setImgOk(false)}
              />
            ) : (
              <EmptyPoster hasUrl={Boolean(folderUrl)} />
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black shadow-sm ${statusStyle.chip}`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {statusLabel(status)}
            </span>

            <InscricaoBadge jaInscrito={jaInscrito} />
          </div>

          <h3
            id={tituloId}
            className="mt-3 break-words text-2xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-3xl"
            title={titulo}
            aria-live="polite"
          >
            {titulo}
          </h3>

          {descricao ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {descricao}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip
              icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
              title="Período do evento"
            >
              <span id={periodoId}>{periodoTexto}</span>
            </Chip>

            {local ? (
              <Chip
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                title="Local"
              >
                {local}
              </Chip>
            ) : null}

            {tipo ? (
              <Chip
                icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
                title="Tipo do evento"
              >
                {tipo}
              </Chip>
            ) : null}

            {publico ? (
              <Chip
                icon={<Target className="h-4 w-4" aria-hidden="true" />}
                title="Público-alvo"
              >
                {publico}
              </Chip>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={Users}
              label="Turmas"
              value={stats.totalTurmas}
              tone="indigo"
            />
            <StatCard
              icon={Users}
              label="Inscritos"
              value={stats.totalInscritos}
              tone="emerald"
            />
            <StatCard
              icon={Users}
              label="Presentes"
              value={stats.totalPresentes}
              tone="teal"
            />
            <StatCard
              icon={BarChart3}
              label="Presença"
              value={`${stats.presencaMedia}%`}
              tone="cyan"
            />
            <StatCard
              icon={Star}
              label="Avaliações"
              value={stats.totalAvaliacao}
              tone="amber"
            />
            <StatCard
              icon={Star}
              label="Nota"
              value={stats.notaMedia}
              tone="violet"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div>
            <div className="text-sm font-black text-zinc-950 dark:text-white">
              Ações do evento
            </div>

            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Consulte a programação e escolha uma turma disponível.
            </p>
          </div>

          <div className="grid gap-2">
            {temProgramacao ? (
              <TechButton
                as="a"
                href={programacaoUrl}
                title="Abrir programação em PDF"
                ariaLabel="Abrir programação em PDF"
                variant="soft"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Programação
                <Download className="h-4 w-4 opacity-90" aria-hidden="true" />
              </TechButton>
            ) : null}

            <TechButton
              onClick={handleToggle}
              ariaLabel={
                expandido ? "Recolher turmas do evento" : "Ver turmas do evento"
              }
              title={expandido ? "Recolher turmas" : "Ver turmas"}
              variant={expandido ? "filled" : "ghost"}
            >
              {expandido ? (
                <>
                  Ocultar turmas{" "}
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  Ver turmas{" "}
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </TechButton>
          </div>
        </div>
      </div>

      {expandido && (
        <div
          id={turmasId}
          className="relative border-t border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-5 lg:p-6"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-lg font-black text-zinc-950 dark:text-white">
                Turmas disponíveis
              </h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Escolha a turma, consulte vagas, horários e situação da inscrição.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              {jaInscrito
                ? "Você já possui inscrição"
                : "Inscrição disponível conforme vagas/regras"}
            </div>
          </div>

          {Array.isArray(turmas) && turmas.length > 0 ? (
            <div className="space-y-4">
              {turmas.map((turma) => (
                <CardTurma
                  key={turma.id}
                  turma={normalizeTurmaParaCard(turma)}
                  eventoId={eventoId}
                  hoje={hoje}
                  inscrever={inscrever}
                  inscrevendo={inscrevendo}
                  inscricaoConfirmadas={inscricaoConfirmadas}
                  carregarInscritos={carregarInscritos}
                  inscritos={asArray(inscritosPorTurma?.[turma.id])}
                  carregarAvaliacao={carregarAvaliacao}
                  avaliacao={avaliacaoPorTurma?.[turma.id]}
                  carregarPresencas={carregarPresencas}
                  presencas={asArray(presencasPorTurma?.[turma.id])}
                  gerarRelatorioPDF={gerarRelatorioPDF}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
              Nenhuma turma cadastrada.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

EmptyPoster.propTypes = {
  hasUrl: PropTypes.bool,
};

Chip.propTypes = {
  icon: PropTypes.node,
  children: PropTypes.node,
  title: PropTypes.string,
};

InscricaoBadge.propTypes = {
  jaInscrito: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
};

TechButton.propTypes = {
  as: PropTypes.oneOf(["button", "a"]),
  href: PropTypes.string,
  onClick: PropTypes.func,
  children: PropTypes.node,
  title: PropTypes.string,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["ghost", "filled", "soft"]),
  disabled: PropTypes.bool,
};

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
  tone: PropTypes.oneOf([
    "emerald",
    "teal",
    "cyan",
    "amber",
    "violet",
    "slate",
    "indigo",
  ]),
};

CardEvento.propTypes = {
  evento: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    titulo: PropTypes.string.isRequired,
    descricao: PropTypes.string,

    status: PropTypes.oneOf([
      EVENTO_STATUS.PROGRAMADO,
      EVENTO_STATUS.ANDAMENTO,
      EVENTO_STATUS.ENCERRADO,
      EVENTO_STATUS.SEM_DATAS,
    ]),

    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,
    data_inicio_geral: PropTypes.string,
    data_fim_geral: PropTypes.string,

    tipo: PropTypes.string,
    publico_alvo: PropTypes.string,
    local: PropTypes.string,
    ja_inscrito: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),

    folder_kind: PropTypes.string,
    tem_folder: PropTypes.bool,
    folder_size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    folder_updated_at: PropTypes.string,

    programacao_kind: PropTypes.string,
    tem_programacao: PropTypes.bool,
    programacao_pdf_size: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    programacao_pdf_updated_at: PropTypes.string,
  }).isRequired,

  expandido: PropTypes.bool,
  toggleExpandir: PropTypes.func.isRequired,

  turmas: PropTypes.array,

  carregarInscritos: PropTypes.func,
  inscritosPorTurma: PropTypes.object,

  carregarAvaliacao: PropTypes.func,
  avaliacaoPorTurma: PropTypes.object,

  presencasPorTurma: PropTypes.object,
  carregarPresencas: PropTypes.func,

  gerarRelatorioPDF: PropTypes.func,

  hoje: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  inscricaoConfirmadas: PropTypes.array,
};