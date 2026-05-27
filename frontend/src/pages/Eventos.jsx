// ✅ frontend/src/pages/Eventos.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página pública/autenticada de eventos.
//
// Diretrizes aplicadas:
// - Usa EventoService como contrato oficial do domínio de eventos;
// - Sem chamadas diretas espalhadas para /api/eventos ou /api/inscricao;
// - Sem resolveAssetUrl/openAsset para programação/folder;
// - Folder oficial: /api/evento/:id/folder;
// - Programação oficial: /api/evento/:id/programacao;
// - Eventos restritos continuam visíveis, mas inscrição respeita elegibilidade;
// - Date-only seguro, sem new Date("YYYY-MM-DD");
// - Imagens carregam progressivamente;
// - Fluxo mobile-first, acessível e institucional;
// - Sem aliases de evento/turma/status/modal;
// - Sem toast direto;
// - Imports conferidos pela árvore real do projeto;
// - Preserva: visualizar eventos, abrir turmas, inscrever, cancelar inscrição e Google Agenda.

import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInViewOnce } from "../hooks/useInViewOnce";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Clock,
  Download,
  Eye,
  Image as ImageIcon,
  Info,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import ListaTurmasEvento from "../components/eventos/ListaTurmasEvento";
import ModalConfirmacao from "../components/ui/ModalConfirmacao";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "../components/ui/AppToast";

import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";

import EventoService, {
  deduzStatusEvento,
  getEventoFolderUrl,
  getEventoProgramacaoUrl,
  getInscricaoPorTurmaId,
  hhmm,
  isAbortLike,
  normalizeTitleSort,
  sortEventosPublicos,
  ymd,
} from "../services/eventoService";

/* ─────────────────────────────────────────────────────────────
   Constantes e helpers date-only
────────────────────────────────────────────────────────────── */

const MESES_ABREV_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const HOJE_ISO = hojeIsoLocal();

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatarDataCurtaSeguro(value) {
  const data = ymd(value);

  if (!data) return "";

  const [ano, mes, dia] = data.split("-");
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));

  return `${String(dia).padStart(2, "0")} de ${MESES_ABREV_PT[idx]} de ${ano}`;
}

function inRange(dataInicio, dataFim, dia) {
  return Boolean(dataInicio && dataFim && dataInicio <= dia && dia <= dataFim);
}

function rangeDaTurma(turma) {
  let dataInicio = null;
  let dataFim = null;

  const push = (value) => {
    const data = ymd(typeof value === "string" ? value : value?.data);

    if (!data) return;

    if (!dataInicio || data < dataInicio) dataInicio = data;
    if (!dataFim || data > dataFim) dataFim = data;
  };

  if (Array.isArray(turma?.datas) && turma.datas.length) {
    turma.datas.forEach(push);
  } else {
    push(turma?.data_inicio);
    push(turma?.data_fim);
  }

  return { dataInicio, dataFim };
}

function statusTurma(turma) {
  const { dataInicio, dataFim } = rangeDaTurma(turma);

  if (inRange(dataInicio, dataFim, HOJE_ISO)) {
    return {
      status: "Em andamento",
      tone: "warning",
    };
  }

  if (dataFim && dataFim < HOJE_ISO) {
    return {
      status: "Encerrado",
      tone: "danger",
    };
  }

  return {
    status: "Programado",
    tone: "success",
  };
}

function badgeClasses(status) {
  if (status === "Programado") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/50";
  }

  if (status === "Em andamento") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/50";
  }

  return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/50";
}

function statusEventoLabel(status) {
  if (status === "andamento") return "Em andamento";
  if (status === "encerrado") return "Encerrado";
  if (status === "sem_datas") return "Datas a definir";

  return "Programado";
}

function statusEventoClasses(status) {
  if (status === "andamento") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800";
  }

  if (status === "encerrado") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200 border border-rose-200 dark:border-rose-800";
  }

  if (status === "sem_datas") {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800";
  }

  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800";
}

function eventoTemProgramacao(evento) {
  return Boolean(
    evento?.programacao_kind === "blob" ||
      evento?.programacao_pdf_size ||
      evento?.tem_programacao
  );
}

function eventMatchesSearch(evento, termo) {
  const query = normalizeTitleSort(termo);

  if (!query) return true;

  const haystack = [
    evento?.titulo,
    evento?.tipo,
    evento?.local,
    evento?.publico_alvo,
    evento?.descricao,
  ]
    .map(normalizeTitleSort)
    .join(" ");

  return haystack.includes(query);
}

function getEventoElegibilidade(evento) {
  const podeSeInscrever =
    typeof evento?.pode_se_inscrever === "boolean"
      ? evento.pode_se_inscrever
      : true;

  const motivoBloqueio = String(evento?.motivo_bloqueio || "").trim();

  return {
    podeSeInscrever,
    motivoBloqueio,
  };
}

/* ─────────────────────────────────────────────────────────────
   Botões locais da página
────────────────────────────────────────────────────────────── */

function AcaoPrimaria({
  children,
  onClick,
  disabled = false,
  className = "",
  icon,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition",
        "hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

function AcaoSecundaria({
  children,
  onClick,
  href,
  target,
  rel,
  disabled = false,
  className = "",
  icon,
  title,
  type = "button",
  ...props
}) {
  const classes = classNames(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-800 shadow-sm transition",
    "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:focus-visible:ring-offset-zinc-900",
    className
  );

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        className={classes}
        title={title}
        {...props}
      >
        {icon}
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero / stats / modal de dicas
────────────────────────────────────────────────────────────── */
function EventosResumoPremium({ stats }) {
  return (
    <section
  className="relative z-10 mx-auto mt-4 grid max-w-6xl grid-cols-1 gap-3 px-4 sm:grid-cols-3"
  aria-label="Resumo dos eventos"
>
      <MiniStatPremium
        icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
        label="Eventos disponíveis"
        value={stats?.eventosDisponiveis ?? 0}
        description="Programados ou em andamento"
        tone="rose"
      />

      <MiniStatPremium
        icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
        label="Inscrições ativas"
        value={stats?.inscricoesAtivas ?? 0}
        description="Turmas em que você está inscrito"
        tone="emerald"
      />

      <MiniStatPremium
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        label="Em andamento"
        value={stats?.eventosAndamento ?? 0}
        description="Eventos acontecendo agora"
        tone="indigo"
      />
    </section>
  );
}

function MiniStatPremium({ icon, label, value, description, tone = "rose" }) {
  const toneClasses = {
    rose:
      "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/25 dark:text-indigo-100",
  };

  return (
    <div
      className={classNames(
        "group overflow-hidden rounded-[1.6rem] border p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl dark:ring-white/10",
        toneClasses[tone] || toneClasses.rose
      )}
      role="group"
      aria-label={`${label}: ${Number(value) || 0}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/75 shadow-sm ring-1 ring-black/5 transition group-hover:scale-105 dark:bg-white/10 dark:ring-white/10">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
            {label}
          </p>

          <p className="mt-0.5 text-2xl font-black leading-none tracking-tight">
            {Number(value) || 0}
          </p>

          <p className="mt-1 truncate text-xs font-semibold opacity-70">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

EventosResumoPremium.propTypes = {
  stats: PropTypes.shape({
    eventosDisponiveis: PropTypes.number,
    inscricoesAtivas: PropTypes.number,
    eventosAndamento: PropTypes.number,
  }),
};

MiniStatPremium.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  description: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(["rose", "emerald", "indigo"]),
};

function RegrasDicasButton() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const dicas = [
    {
      num: "1",
      titulo: "Como se inscrever em um evento",
      texto:
        "Localize o evento desejado e clique em Ver turmas. Depois, escolha uma turma disponível e confirme sua inscrição. A inscrição só será concluída quando a plataforma exibir a confirmação de sucesso.",
    },
    {
      num: "2",
      titulo: "Eventos visíveis nem sempre permitem inscrição",
      texto:
        "Alguns eventos podem aparecer para todos os usuários, mesmo com público-alvo específico. Nesses casos, você poderá consultar as informações, mas a inscrição ficará bloqueada se seu perfil, cargo, unidade ou registro funcional não atender aos critérios definidos.",
    },
    {
      num: "3",
      titulo: "Conflito de horário entre turmas e eventos",
      texto:
        "Quando você já estiver inscrito em uma turma, outras turmas ou eventos no mesmo dia e horário poderão ficar indisponíveis. Essa regra evita inscrições simultâneas em atividades conflitantes.",
    },
    {
      num: "4",
      titulo: "Inscrição, presença e certificado",
      texto:
        "Após participar do evento, acompanhe sua presença na plataforma. Quando houver avaliação, questionário ou etapa pós-curso obrigatória, será necessário cumprir essa regra para liberação do certificado.",
    },
    {
      num: "5",
      titulo: "Cancelamento de inscrição",
      texto:
        "Caso não possa participar, cancele sua inscrição com antecedência quando essa opção estiver disponível. Isso libera a vaga para outro usuário e mantém o histórico da plataforma mais correto.",
    },
  ];

  return (
    <>
      <AcaoSecundaria
        onClick={() => setOpen(true)}
        icon={<Info className="h-4 w-4" aria-hidden="true" />}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Regras & Dicas
      </AcaoSecundaria>

      {open
        ? createPortal(
            <AnimatePresence>
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="eventos-regras-title"
                className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  className="absolute inset-0 cursor-default"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar orientações"
                />

                <motion.section
                  initial={reduceMotion ? false : { y: 24, opacity: 0, scale: 0.98 }}
                  animate={reduceMotion ? {} : { y: 0, opacity: 1, scale: 1 }}
                  exit={reduceMotion ? {} : { y: 16, opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800"
                >
                  <div
                    className="h-2 bg-gradient-to-r from-rose-600 via-fuchsia-500 to-indigo-500"
                    aria-hidden="true"
                  />

                  <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-rose-50 via-white to-indigo-50 p-6 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950/30">
                    <div className="flex gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60">
                        <Info className="h-6 w-6" aria-hidden="true" />
                      </div>

                      <div>
                        <h2
                          id="eventos-regras-title"
                          className="text-2xl font-black tracking-tight text-slate-950 dark:text-white"
                        >
                          Regras e dicas de inscrição
                        </h2>

                        <p className="mt-1 max-w-xl text-sm font-medium text-slate-600 dark:text-zinc-300">
                          Orientações essenciais para consultar eventos, escolher turmas, evitar conflitos de horário e acompanhar certificados.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      onClick={() => setOpen(false)}
                      aria-label="Fechar regras e dicas"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </header>

                  <div className="max-h-[70vh] overflow-y-auto p-6">
                    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                      <strong>Atenção:</strong> a inscrição depende da disponibilidade da turma, das regras de público-alvo e da ausência de conflito de horário com outras inscrições ativas.
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {dicas.map((dica) => (
                        <article
                          key={dica.num}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-rose-700 ring-1 ring-rose-100 dark:bg-zinc-950 dark:text-rose-300 dark:ring-rose-900/60">
                              {dica.num}
                            </span>

                            <div>
                              <p className="text-sm font-black text-slate-950 dark:text-white">
                                {dica.titulo}
                              </p>

                              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                                {dica.texto}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                      Consulte esta orientação sempre que tiver dúvida sobre inscrição, presença ou certificado.
                    </p>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center rounded-2xl bg-rose-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-rose-800"
                    >
                      Entendi
                    </button>
                  </footer>
                </motion.section>
              </motion.div>
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}

function Tip({ num, titulo, children }) {
  return (
    <div className="rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-50 via-rose-50 to-rose-100 p-4 dark:border-rose-800/40 dark:from-rose-950/40 dark:via-rose-900/40 dark:to-rose-900/30">
      <div className="flex items-start gap-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-600 text-sm font-bold text-white">
          {num}
        </div>

        <div className="min-w-0">
          <h4 className="font-semibold text-rose-900 dark:text-rose-200">
            {titulo}
          </h4>

          <div className="mt-1.5 text-sm leading-relaxed text-rose-950/90 dark:text-rose-100/90">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componentes de card
────────────────────────────────────────────────────────────── */

function RestricaoChip({ evento }) {
  const restrito =
    Boolean(evento?.restrito) ||
    Boolean(String(evento?.motivo_bloqueio || "").trim()) ||
    (Array.isArray(evento?.cargos_permitidos) &&
      evento.cargos_permitidos.length > 0) ||
    (Array.isArray(evento?.unidades_permitidas) &&
      evento.unidades_permitidas.length > 0) ||
    Number(evento?.count_registros_permitidos || 0) > 0;

  if (!restrito) return null;

  const descricao =
    String(evento?.publico_alvo || "").trim() ||
    String(evento?.publico_alvo_label || "").trim() ||
    "público específico";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-[11px] font-extrabold text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-200"
      title={`Evento com inscrição restrita para ${descricao}`}
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
      Exclusivo para {descricao}
    </span>
  );
}

function ThumbEvento({ evento, titulo, canStartLoading }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => getEventoFolderUrl(evento), [evento]);

  const { ref: inViewRef, inView } = useInViewOnce({
    rootMargin: "700px 0px",
    threshold: 0.01,
  });

  useEffect(() => {
    if (canStartLoading && inView) {
      setShouldLoad(true);
    }
  }, [canStartLoading, inView]);

  useEffect(() => {
    setFailed(false);
    setShouldLoad(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div ref={inViewRef} className="w-[120px] shrink-0 sm:w-[140px] md:w-[160px]">
        <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-zinc-200/70 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="flex flex-col items-center justify-center gap-2 px-2 text-center text-xs">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            <span>{canStartLoading ? "Sem folder" : "Folder aguardando"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={inViewRef} className="w-[120px] shrink-0 sm:w-[140px] md:w-[160px]">
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {shouldLoad ? (
          <img
            src={src}
            alt={`Folder do evento: ${titulo}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            <span>Carregando folder...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoProgramacao({ evento }) {
  if (!eventoTemProgramacao(evento)) return null;

  const url = getEventoProgramacaoUrl(evento);

  if (!url) return null;

  return (
    <AcaoSecundaria
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      icon={<Download className="h-4 w-4" aria-hidden="true" />}
      aria-label="Abrir programação em PDF"
      title="Abrir programação em PDF"
      className="min-w-[210px] whitespace-nowrap"
    >
      Programação PDF
    </AcaoSecundaria>
  );
}

function ImageBatchSentinel({ onReach }) {
  const firedRef = useRef(false);

  const { ref, inView } = useInViewOnce({
    rootMargin: "1200px 0px",
    threshold: 0.01,
  });

  useEffect(() => {
    if (inView && !firedRef.current) {
      firedRef.current = true;
      onReach?.();
    }
  }, [inView, onReach]);

  return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}

function SearchBox({ value, onChange }) {
  return (
    <label className="relative block w-full sm:max-w-md">
      <span className="sr-only">Buscar evento</span>

      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        aria-hidden="true"
      />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por título, tipo, local ou público..."
        className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      />
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Eventos() {
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [turmasVisiveis, setTurmasVisiveis] = useState({});
  const [inscricoes, setInscricoes] = useState([]);
  const [inscricaoTurmaIds, setInscricaoTurmaIds] = useState([]);

  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [carregandoTurmas, setCarregandoTurmas] = useState(null);
  const [inscrevendo, setInscrevendo] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [imageLoadBudget, setImageLoadBudget] = useState(0);

  const [confirmCancel, setConfirmCancel] = useState({
    open: false,
    eventoId: null,
    turmaId: null,
    inscricaoId: null,
    turmaNome: "",
  });

  const liveRef = useRef(null);
  const imageStartTimerRef = useRef(null);
  const abortEventosRef = useRef(null);
  const abortInscricaoRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortEventosRef.current?.abort?.("unmount");
      abortInscricaoRef.current?.abort?.("unmount");

      if (imageStartTimerRef.current) {
        clearTimeout(imageStartTimerRef.current);
      }
    };
  }, []);

  const carregarInscricoes = useCallback(async () => {
    abortInscricaoRef.current?.abort?.("new-request");

    const controller = new AbortController();
    abortInscricaoRef.current = controller;

    try {
      const data = await EventoService.inscricao.minhas({
        signal: controller.signal,
      });

      const ativas = (Array.isArray(data) ? data : []).filter((item) => {
        const fimISO = ymd(item?.data_fim || item?.data_inicio || "");
        return !(fimISO && fimISO < HOJE_ISO);
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      setInscricoes(ativas);
      setInscricaoTurmaIds(
        ativas
          .map((item) => Number(item?.turma_id))
          .filter((n) => Number.isInteger(n) && n > 0)
      );
    } catch (error) {
      if (isAbortLike(error)) return;

      notifyError("Erro ao carregar suas inscrições ativas.");
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    setLive("Carregando eventos…");
    setErro("");
    setImageLoadBudget(0);

    if (imageStartTimerRef.current) {
      clearTimeout(imageStartTimerRef.current);
    }

    abortEventosRef.current?.abort?.("new-request");

    const controller = new AbortController();
    abortEventosRef.current = controller;

    try {
      const lista = await EventoService.publico.listarParaMim({
        signal: controller.signal,
      });

      const visiveis = (Array.isArray(lista) ? lista : [])
        .filter((evento) => {
          const status = deduzStatusEvento(evento);
          return status === "programado" || status === "andamento";
        })
        .sort(sortEventosPublicos);

      if (!mountedRef.current || controller.signal.aborted) return;

      setEventos(visiveis);
      setErro("");
      setLive("Eventos carregados. Imagens serão exibidas em seguida.");

      imageStartTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setImageLoadBudget(4);
      }, 450);
    } catch (error) {
      if (isAbortLike(error)) return;

      if (Array.isArray(eventos) && eventos.length > 0) {
        setErro("");
        notifyWarning(
          "Não foi possível atualizar os eventos agora. Mantive a lista atual."
        );
        setLive("Falha ao atualizar eventos; mantendo lista atual.");
        return;
      }

      setErro(error?.message || "Erro ao carregar eventos.");
      notifyError("Erro ao carregar eventos.");
      setLive("Falha ao carregar eventos.");
    } finally {
      if (mountedRef.current) {
        setCarregandoEventos(false);
      }
    }
  }, [eventos, setLive]);

  useEffect(() => {
    carregarEventos();
    carregarInscricoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventosFiltrados = useMemo(() => {
    return [...eventos]
      .filter((evento) => eventMatchesSearch(evento, busca))
      .sort(sortEventosPublicos);
  }, [busca, eventos]);

  const stats = useMemo(() => {
    const eventosDisponiveis = Array.isArray(eventos) ? eventos.length : 0;

    const inscricoesAtivas = Array.isArray(inscricaoTurmaIds)
      ? inscricaoTurmaIds.length
      : 0;

    const eventosAndamento = (eventos || []).filter((evento) => {
      const status = deduzStatusEvento(evento);
      return status === "andamento";
    }).length;

    return {
      eventosDisponiveis,
      inscricoesAtivas,
      eventosAndamento,
    };
  }, [eventos, inscricaoTurmaIds]);

  const carregarTurmas = useCallback(
    async (eventoId) => {
      if (turmasVisiveis[eventoId]) {
        setTurmasVisiveis((prev) => ({
          ...prev,
          [eventoId]: false,
        }));
        return;
      }

      setTurmasVisiveis((prev) => ({
        ...prev,
        [eventoId]: true,
      }));

      if (turmasPorEvento[eventoId] || carregandoTurmas) return;

      setCarregandoTurmas(eventoId);

      try {
        const turmas = await EventoService.publico.listarTurmasSimples(eventoId);

        if (!mountedRef.current) return;

        setTurmasPorEvento((prev) => ({
          ...prev,
          [eventoId]: Array.isArray(turmas) ? turmas : [],
        }));
      } catch {
        notifyError("Erro ao carregar turmas.");
      } finally {
        if (mountedRef.current) {
          setCarregandoTurmas(null);
        }
      }
    },
    [carregandoTurmas, turmasPorEvento, turmasVisiveis]
  );

  const atualizarTurmasDoEvento = useCallback(async (eventoId) => {
    if (!eventoId) return;

    try {
      const turmasAtualizadas =
        await EventoService.publico.listarTurmasSimples(eventoId);

      if (!mountedRef.current) return;

      setTurmasPorEvento((prev) => ({
        ...prev,
        [eventoId]: Array.isArray(turmasAtualizadas) ? turmasAtualizadas : [],
      }));
    } catch {
      // Mantém a lista atual sem quebrar o fluxo principal.
    }
  }, []);

  const buildAgendaHref = useCallback(
  ({
    titulo,
    data_inicio,
    data_fim,
    horario_inicio,
    horario_fim,
    turma_nome,
    local,
  }) => {
    try {
      const inicio = `${data_inicio} ${horario_inicio}:00`;
      const fim = `${data_fim || data_inicio} ${horario_fim}:00`;

      return gerarLinkGoogleAgenda({
        titulo: turma_nome ? `${titulo} — ${turma_nome}` : titulo,
        dataInicio: inicio,
        dataFim: fim,
        local,
      });
    } catch (error) {
      console.warn("[Eventos][GoogleAgenda] falha ao gerar link", {
        message: error?.message,
        titulo,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        turma_nome,
        local,
      });

      return null;
    }
  },
  []
);

  const inscrever = useCallback(
    async (turmaId, eventoId) => {
      if (inscrevendo) return;

      const eventoRef = eventos.find(
        (evento) => Number(evento.id) === Number(eventoId)
      );

      if (!eventoRef) return;

      const { podeSeInscrever, motivoBloqueio } =
        getEventoElegibilidade(eventoRef);

      if (!podeSeInscrever) {
        notifyWarning(
          motivoBloqueio ||
            "Este evento está visível para você, mas a inscrição não está disponível para seu perfil."
        );
        return;
      }

      if (eventoRef?.ja_organizador) {
        notifyWarning(
          "Você é organizador deste evento e não pode se inscrever como participante."
        );
        return;
      }

      setInscrevendo(turmaId);

      try {
        await EventoService.inscricao.inscrever(turmaId);

        notifySuccess("Inscrição realizada com sucesso.");

        await carregarInscricoes();
        await atualizarTurmasDoEvento(eventoId);
      } catch (error) {
        const status = Number(error?.status || 0);
        const serverMsg =
          error?.data?.message || error?.message || "Erro ao se inscrever.";

        if (status === 409) {
          notifyWarning(serverMsg);
        } else {
          notifyError(serverMsg);
        }
      } finally {
        setInscrevendo(null);
      }
    },
    [
      atualizarTurmasDoEvento,
      carregarInscricoes,
      eventos,
      inscrevendo,
    ]
  );

  const cancelarInscricaoByTurmaId = useCallback(
    async (turmaId, turmaNome = "", eventoId = null) => {
      const registro = getInscricaoPorTurmaId(inscricoes, turmaId);
      const inscricaoId = registro?.inscricao_id || registro?.id;

      if (!inscricaoId) {
        notifyInfo("Não foi possível localizar a inscrição para cancelar.");
        return;
      }

      setConfirmCancel({
        open: true,
        eventoId: Number(eventoId) || null,
        turmaId: Number(turmaId),
        inscricaoId: Number(inscricaoId),
        turmaNome: String(turmaNome || registro?.turma_nome || "").trim(),
      });
    },
    [inscricoes]
  );

  const fecharConfirmCancel = useCallback(() => {
    if (cancelandoId) return;

    setConfirmCancel({
      open: false,
      eventoId: null,
      turmaId: null,
      inscricaoId: null,
      turmaNome: "",
    });
  }, [cancelandoId]);

  const executarCancelamento = useCallback(async () => {
    const inscricaoId = confirmCancel?.inscricaoId;
    const eventoId = confirmCancel?.eventoId;

    if (!inscricaoId) {
      fecharConfirmCancel();
      return;
    }

    setCancelandoId(inscricaoId);

    try {
      await EventoService.inscricao.cancelar(inscricaoId);

      notifySuccess("Inscrição cancelada com sucesso.");

      await carregarInscricoes();
      await atualizarTurmasDoEvento(eventoId);
    } catch (error) {
      const status = Number(error?.status || 0);
      const msg =
        error?.data?.message ||
        error?.message ||
        "Não foi possível cancelar a inscrição agora.";

      notifyError(
        `Erro ao cancelar inscrição${status ? ` (${status})` : ""}. ${msg}`
      );
    } finally {
      setCancelandoId(null);
      setConfirmCancel({
        open: false,
        eventoId: null,
        turmaId: null,
        inscricaoId: null,
        turmaNome: "",
      });
    }
  }, [
    atualizarTurmasDoEvento,
    carregarInscricoes,
    confirmCancel?.eventoId,
    confirmCancel?.inscricaoId,
    fecharConfirmCancel,
  ]);

  const liberarMaisImagens = useCallback(() => {
    setImageLoadBudget((prev) => prev + 4);
  }, []);

  const atualizarTudo = useCallback(async () => {
    await carregarEventos();
    await carregarInscricoes();
  }, [carregarEventos, carregarInscricoes]);

  const isCancelModalLoading =
    cancelandoId && cancelandoId === confirmCancel?.inscricaoId;

  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div className="mx-auto max-w-6xl px-4 pt-5">
  <HeaderHero
  titulo="Eventos disponíveis"
  subtitulo="Consulte os eventos abertos, acompanhe suas inscrições e acesse as turmas disponíveis para o seu perfil."
  icone={CalendarDays}
  tamanho="lg"
  raio="xl"
/>
</div>

<section className="mx-auto mt-4 flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <p className="text-sm font-black text-zinc-900 dark:text-white">
      Acompanhe os eventos ativos
    </p>
    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
      Atualize a lista ou consulte as regras de inscrição.
    </p>
  </div>

  <div className="flex flex-col gap-2 sm:flex-row">
    <AcaoPrimaria
      onClick={atualizarTudo}
      disabled={carregandoEventos}
      icon={
        <RefreshCw
          className={classNames(
            "h-4 w-4",
            carregandoEventos && "animate-spin"
          )}
          aria-hidden="true"
        />
      }
      aria-label="Atualizar lista de eventos"
    >
      {carregandoEventos ? "Atualizando..." : "Atualizar"}
    </AcaoPrimaria>

    <RegrasDicasButton />
  </div>
</section>

<EventosResumoPremium stats={stats} />

      {carregandoEventos && (
        <>
          <div
            className="sticky left-0 top-0 z-40 h-1 w-full bg-fuchsia-100 dark:bg-fuchsia-950/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando eventos"
          >
            <div
              className={classNames(
                "h-full w-1/3 bg-fuchsia-600",
                !reduceMotion && "animate-pulse"
              )}
            />
          </div>

          <div className="mx-auto max-w-6xl px-4 pt-4">
            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-900 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20 dark:text-fuchsia-200">
              <span className="font-extrabold">Carregando eventos...</span>{" "}
              Aguarde enquanto a lista é preparada.
            </div>
          </div>
        </>
      )}

      {!carregandoEventos && eventos.length > 0 && imageLoadBudget === 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <span className="font-extrabold">Eventos carregados.</span> Os
            folders serão exibidos em seguida.
          </div>
        </div>
      )}

      <main id="conteudo" className="mx-auto max-w-6xl px-2 pb-8 pt-6 sm:px-4">
        {!carregandoEventos && eventos.length > 0 && (
          <section
            aria-label="Busca de eventos"
            className="mb-4 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  Eventos programados e em andamento
                </h2>

                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Mostrando {eventosFiltrados.length} de {eventos.length}{" "}
                  evento(s).
                </p>
              </div>

              <SearchBox value={busca} onChange={setBusca} />
            </div>
          </section>
        )}

        {carregandoEventos ? (
          <div
            className="grid grid-cols-1 gap-4"
            aria-busy="true"
            aria-live="polite"
          >
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} height={320} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center ring-1 ring-rose-200/50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:ring-rose-900/30">
            <div className="inline-flex items-center gap-2 font-extrabold text-rose-800 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {erro}
            </div>

            <div className="mt-3 flex justify-center">
              <AcaoPrimaria
                onClick={atualizarTudo}
                icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              >
                Tentar novamente
              </AcaoPrimaria>
            </div>
          </div>
        ) : eventos.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum evento programado ou em andamento."
            sugestao="Novas turmas serão abertas em breve."
          />
        ) : eventosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum evento encontrado para a busca informada."
            sugestao="Tente buscar por outro título, local, tipo ou público."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {eventosFiltrados.map((evento, index) => {
              const statusEvt = deduzStatusEvento(evento);
              const statusLabel = statusEventoLabel(statusEvt);
              const ehorganizador = Boolean(evento.ja_organizador);

              const { podeSeInscrever, motivoBloqueio } =
                getEventoElegibilidade(evento);

              const mostrarAvisoRestricao =
                !podeSeInscrever && Boolean(motivoBloqueio);

              const turmasDoEvento = turmasPorEvento[evento.id] || [];
              const temTurmasCarregadas = Array.isArray(turmasDoEvento);

              return (
                <motion.article
                  key={evento.id ?? index}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="group overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-md transition-shadow hover:shadow-xl [contain-intrinsic-size:420px] [content-visibility:auto] dark:border-zinc-800 dark:bg-neutral-900"
                  aria-labelledby={`evt-${evento.id}-titulo`}
                >
                  <div
                    className="h-1 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500"
                    aria-hidden="true"
                  />

                  <div className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <ThumbEvento
                        evento={evento}
                        titulo={evento.titulo}
                        canStartLoading={index < imageLoadBudget}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                id={`evt-${evento.id}-titulo`}
                                className="text-xl font-extrabold text-zinc-900 dark:text-white"
                              >
                                {evento.titulo}
                              </h3>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {String(evento?.tipo || "").trim() && (
                                <span
                                  className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-1 text-[11px] font-extrabold text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-900/30 dark:text-indigo-200"
                                  title="Tipo do evento"
                                >
                                  {evento.tipo}
                                </span>
                              )}

                              {String(evento?.publico_alvo || "").trim() && (
                                <span
                                  className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-[11px] font-extrabold text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200"
                                  title="Público-alvo"
                                >
                                  {evento.publico_alvo}
                                </span>
                              )}

                              {!!evento.ja_inscrito && (
                                <span
                                  className="rounded-full border border-sky-200 bg-sky-100 px-2 py-1 text-[11px] font-extrabold text-sky-900 dark:border-sky-800/60 dark:bg-sky-900/30 dark:text-sky-200"
                                  title="Você já está inscrito em alguma turma deste evento."
                                >
                                  ✓ Inscrito
                                </span>
                              )}

                              <RestricaoChip evento={evento} />
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-xs ${statusEventoClasses(
                              statusEvt
                            )}`}
                            role="status"
                          >
                            {statusLabel}
                          </span>
                        </div>

                        {String(evento?.descricao || "").trim() && (
                          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {evento.descricao}
                          </p>
                        )}

                        {Array.isArray(evento?.organizadores) &&
                          evento.organizadores.length > 0 && (
                            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                              <span className="font-extrabold">
                                organizador
                                {evento.organizadores.length > 1 ? "es" : ""}:
                              </span>{" "}
                              <span className="font-medium">
                                {evento.organizadores
                                  .map((p) => p?.nome)
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}

                        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <MapPin
                            className="h-4 w-4 text-rose-600 dark:text-rose-300"
                            aria-hidden="true"
                          />
                          <span>{evento.local || "Local a definir"}</span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />

                          <span>
                            {evento.data_inicio_geral && evento.data_fim_geral
                              ? `${formatarDataCurtaSeguro(
                                  evento.data_inicio_geral
                                )} até ${formatarDataCurtaSeguro(
                                  evento.data_fim_geral
                                )}`
                              : "Datas a definir"}
                          </span>
                        </div>

                        {ehorganizador && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            Você é organizador deste evento
                          </div>
                        )}

                        {mostrarAvisoRestricao && (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
                            <Eye
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              Este evento está visível para você, mas a inscrição
                              está restrita. <strong>{motivoBloqueio}</strong>
                            </span>
                          </div>
                        )}

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <BotaoProgramacao evento={evento} />
                          </div>

                          <AcaoPrimaria
                            onClick={() => carregarTurmas(evento.id)}
                            disabled={carregandoTurmas === evento.id}
                            aria-expanded={!!turmasVisiveis[evento.id]}
                            aria-controls={`turmas-${evento.id}`}
                            className="sm:min-w-[160px]"
                          >
                            {carregandoTurmas === evento.id
                              ? "Carregando..."
                              : turmasVisiveis[evento.id]
                                ? "Ocultar turmas"
                                : "Ver turmas"}
                          </AcaoPrimaria>
                        </div>
                      </div>
                    </div>

                    {turmasVisiveis[evento.id] && (
                      <div className="mt-5 w-full">
                        {temTurmasCarregadas && (
                          <div id={`turmas-${evento.id}`} className="w-full">
                            <ListaTurmasEvento
                              turmas={turmasDoEvento}
                              eventoId={evento.id}
                              eventoTipo={evento.tipo}
                              hoje={HOJE_ISO}
                              inscricaoConfirmadas={inscricaoTurmaIds}
                              inscrever={(turmaId) =>
                                inscrever(turmaId, evento.id)
                              }
                              inscrevendo={inscrevendo}
                              jaInscritoNoEvento={(() => {
                                const ids = new Set(inscricaoTurmaIds);
                                return turmasDoEvento.some((turma) =>
                                  ids.has(Number(turma.id))
                                );
                              })()}
                              jaorganizadorDoEvento={!!evento.ja_organizador}
                              carregarInscritos={() => {}}
                              carregarAvaliacao={() => {}}
                              gerarRelatorioPDF={() => {}}
                              mostrarStatusTurma={false}
                              exibirRealizadosTotal
                              turmasEmConflito={[]}
                              podeSeInscreverNoEvento={podeSeInscrever}
                              motivoBloqueioEvento={motivoBloqueio}
                            />
                          </div>
                        )}

                        <InscricaoAcoesRapidas
                          evento={evento}
                          turmas={turmasDoEvento}
                          inscricoes={inscricoes}
                          cancelarInscricaoByTurmaId={
                            cancelarInscricaoByTurmaId
                          }
                          buildAgendaHref={buildAgendaHref}
                          cancelandoId={cancelandoId}
                        />
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}

            <ImageBatchSentinel onReach={liberarMaisImagens} />
          </div>
        )}
      </main>

      <Footer />

      <ModalConfirmacao
        open={!!confirmCancel.open}
        titulo="Cancelar inscrição?"
        mensagem={
          confirmCancel?.turmaNome
            ? `Tem certeza que deseja cancelar sua inscrição na turma:\n\n“${confirmCancel.turmaNome}”?`
            : "Tem certeza que deseja cancelar sua inscrição nesta turma?"
        }
        textoConfirmar="Sim, cancelar"
        textoCancelar="Não"
        variant="danger"
        loading={!!isCancelModalLoading}
        onClose={fecharConfirmCancel}
        onConfirm={executarCancelamento}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bloco de ações por turma inscrita
────────────────────────────────────────────────────────────── */

function InscricaoAcoesRapidas({
  evento,
  turmas,
  inscricoes,
  cancelarInscricaoByTurmaId,
  buildAgendaHref,
  cancelandoId,
}) {
  if (!Array.isArray(turmas) || turmas.length === 0) return null;

  const porTurma = new Map();

  for (const inscricao of inscricoes || []) {
    const turmaId = Number(inscricao?.turma_id);

    if (!Number.isFinite(turmaId)) continue;

    if (turmas.some((turma) => Number(turma.id) === turmaId)) {
      porTurma.set(turmaId, inscricao);
    }
  }

  const minhasTurmas = turmas.filter((turma) => porTurma.has(Number(turma.id)));

  if (!minhasTurmas.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        Minhas inscrições neste evento
      </h4>

      <ul className="space-y-3">
        {minhasTurmas.map((turma) => {
          const registro = porTurma.get(Number(turma.id));

          const agendaHref = buildAgendaHref({
            titulo: evento.titulo,
            data_inicio: turma.data_inicio,
            data_fim: turma.data_fim,
            horario_inicio: turma.horario_inicio,
            horario_fim: turma.horario_fim,
            turma_nome: turma.nome,
            local: evento.local,
          });

          const { status } = statusTurma(turma);
          const inscricaoId = registro?.inscricao_id || registro?.id;

          return (
            <li
              key={turma.id}
              className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-neutral-900"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {turma.nome || "Turma"}

                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${badgeClasses(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {turma.horario_inicio && turma.horario_fim
                        ? `${hhmm(turma.horario_inicio)} às ${hhmm(
                            turma.horario_fim
                          )}`
                        : "Horário a definir"}
                    </span>

                    {turma.data_inicio && (
                      <span>
                        {formatarDataCurtaSeguro(turma.data_inicio)}
                        {turma.data_fim
                          ? ` — ${formatarDataCurtaSeguro(turma.data_fim)}`
                          : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <AcaoSecundaria
  href={agendaHref || undefined}
  onClick={(event) => {
    if (!agendaHref) {
      event.preventDefault();

      console.warn("[Eventos][GoogleAgenda] link não gerado", {
        evento_id: evento?.id,
        evento_titulo: evento?.titulo,
        turma_id: turma?.id,
        turma_nome: turma?.nome,
        data_inicio: turma?.data_inicio,
        data_fim: turma?.data_fim,
        horario_inicio: turma?.horario_inicio,
        horario_fim: turma?.horario_fim,
        local: evento?.local,
      });

      notifyInfo(
        "Não foi possível gerar o link do Google Agenda porque a turma não possui data e horário completos."
      );
    }
  }}
  target="_blank"
  rel="noopener noreferrer"
  className="sm:min-w-[180px]"
  icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
  aria-label="Adicionar turma ao Google Agenda"
  title={
    agendaHref
      ? "Adicionar ao Google Agenda"
      : "Datas insuficientes para agendar"
  }
>
                    Google Agenda
                  </AcaoSecundaria>

                  <AcaoPrimaria
                    className="sm:min-w-[180px]"
                    aria-label="Cancelar inscrição nesta turma"
                    onClick={() =>
                      cancelarInscricaoByTurmaId(
                        turma.id,
                        turma.nome,
                        evento.id
                      )
                    }
                    disabled={status !== "Programado" || cancelandoId === inscricaoId}
                    icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                  >
                    {cancelandoId === inscricaoId
                      ? "Cancelando..."
                      : "Cancelar inscrição"}
                  </AcaoPrimaria>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}