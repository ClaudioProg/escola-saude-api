// 📁 src/pages/ListaPresencasTurma.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página/componente:
// - Lista de presenças por turma.
//
// Função:
// - Exibir turmas;
// - expandir inscritos por turma;
// - mostrar datas por inscrito;
// - permitir confirmação manual administrativa;
// - respeitar janela administrativa:
//   1h após início da aula até 15 dias após o fim.
//
// Contratos oficiais esperados:
// - POST /api/presenca/confirmar-simples
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem apiPost direto;
// - sem rota com /api embutido na chamada;
// - sem PageHeader antigo;
// - sem Footer antigo;
// - sem Breadcrumbs antigo;
// - sem ModalConfirmacao antigo;
// - sem bg-gelo;
// - sem aliases de status;
// - resposta padrão ok/data/message/code;
// - anti-fuso: date-only em YYYY-MM-DD;
// - nunca usar new Date("YYYY-MM-DD");
// - UX/UI premium real;
// - mobile-first;
// - acessível.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Info,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import NadaEncontrado from "../components/ui/NadaEncontrado";

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_TURMA_OFICIAL = new Set([
  "programado",
  "andamento",
  "encerrado",
  "cancelado",
]);

const STATUS_PRESENCA = {
  PRESENTE: "presente",
  FALTOU: "faltou",
  AGUARDANDO: "aguardando",
};

const JANELA_ADMIN = {
  LIBERAR_APOS_MINUTOS: 60,
  EXPIRAR_APOS_DIAS: 15,
};

/* =========================================================================
   Helpers gerais
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatarCPFSeguro(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) return value || "Não informado";

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

/* =========================================================================
   Helpers anti-fuso
=========================================================================== */

function ymdParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match
    ? {
        y: Number(match[1]),
        mo: Number(match[2]),
        d: Number(match[3]),
      }
    : null;
}

function hmsParts(value, fallback = "00:00") {
  const raw = String(value || fallback);
  const [hhRaw, mmRaw] = raw.split(":");

  const hh = Number.parseInt(hhRaw, 10);
  const mm = Number.parseInt(mmRaw, 10);

  return {
    hh: Number.isFinite(hh) ? hh : 0,
    mm: Number.isFinite(mm) ? mm : 0,
  };
}

function makeLocalDate(dateISO, hhmm = "00:00") {
  const date = ymdParts(dateISO);
  const time = hmsParts(hhmm);

  return date
    ? new Date(date.y, date.mo - 1, date.d, time.hh, time.mm, 0, 0)
    : new Date(Number.NaN);
}

function isoDia(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(Number(value))) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate()
    )}`;
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function formatarDataBR(value) {
  const iso = isoDia(value);

  if (!iso) return "—";

  const [year, month, day] = iso.split("-");

  return `${day}/${month}/${year}`;
}

function addDaysMs(ms, days) {
  return ms + days * 24 * 60 * 60 * 1000;
}

function compararTurmasPorInicioDesc(a, b) {
  const dataA = isoDia(a?.data_inicio) || "0000-00-00";
  const dataB = isoDia(b?.data_inicio) || "0000-00-00";

  if (dataA < dataB) return 1;
  if (dataA > dataB) return -1;
  return 0;
}

/* =========================================================================
   Status
=========================================================================== */

function normalizarStatusTurma(status) {
  const value = String(status || "").trim().toLowerCase();

  return STATUS_TURMA_OFICIAL.has(value) ? value : "programado";
}

function labelStatusTurma(status) {
  const normalized = normalizarStatusTurma(status);

  const map = {
    programado: "Programado",
    andamento: "Em andamento",
    encerrado: "Encerrado",
    cancelado: "Cancelado",
  };

  return map[normalized] || "Programado";
}

function statusBarClass(statusRaw) {
  const status = normalizarStatusTurma(statusRaw);

  if (status === "programado") {
    return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-400";
  }

  if (status === "andamento") {
    return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  }

  if (status === "encerrado") {
    return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  }

  return "bg-gradient-to-r from-slate-700 via-slate-600 to-slate-400";
}

function pessoaEstaPresente(pessoa, dia) {
  if (Array.isArray(pessoa?.presencas)) {
    return pessoa.presencas.some(
      (presenca) =>
        isoDia(presenca?.data_presenca || presenca?.data) === dia &&
        presenca?.presente === true
    );
  }

  if (pessoa?.presencas && typeof pessoa.presencas === "object") {
    return pessoa.presencas[dia] === true;
  }

  return false;
}

function calcularJanelaConfirmacao({ dia, horarioInicio, horarioFim }) {
  const inicioLocal = makeLocalDate(dia, horarioInicio || "08:00");
  const fimLocal = makeLocalDate(dia, horarioFim || "17:00");

  const inicioValido = Number.isFinite(Number(inicioLocal));
  const fimValido = Number.isFinite(Number(fimLocal));
  const agoraMs = Date.now();

  const passou60 =
    inicioValido &&
    agoraMs >=
      inicioLocal.getTime() +
        JANELA_ADMIN.LIBERAR_APOS_MINUTOS * 60 * 1000;

  const deadlineAdmin = fimValido
    ? addDaysMs(fimLocal.getTime(), JANELA_ADMIN.EXPIRAR_APOS_DIAS)
    : Number.NaN;

  const dentroJanelaAdmin =
    Number.isFinite(deadlineAdmin) && agoraMs <= deadlineAdmin;

  return {
    passou60,
    dentroJanelaAdmin,
    podeConfirmar: passou60 && dentroJanelaAdmin,
  };
}

/* =========================================================================
   UI local
=========================================================================== */

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Badge({ tone = "zinc", children, className = "" }) {
  const tones = {
    zinc: "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/40 dark:text-amber-200",
    rose:
      "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/40 dark:text-rose-200",
    sky: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-900/40 dark:text-sky-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        tones[tone] || tones.zinc,
        className
      )}
    >
      {children}
    </span>
  );
}

function Collapser({ id, open, onToggle, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx("inline-flex items-center gap-1 text-left", className)}
      aria-expanded={open}
      aria-controls={id}
    >
      {open ? (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "emerald" }) {
  const tones = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    sky: "text-sky-700 dark:text-sky-300",
    amber: "text-amber-700 dark:text-amber-300",
    zinc: "text-zinc-700 dark:text-zinc-200",
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>

      <div className={cx("mt-1 text-3xl font-black", tones[tone] || tones.zinc)}>
        {value}
      </div>
    </div>
  );
}

function HeaderHero({ totalTurmas }) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-800 to-teal-700"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.6)_1px,transparent_0)] [background-size:18px_18px]"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white/20 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
              Gestão de presenças • turmas e inscritos
            </div>

            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>

              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Presenças por Turma
                </h1>
                <p className="mt-1 text-sm text-white/85 sm:text-base">
                  {totalTurmas} turma{totalTurmas === 1 ? "" : "s"} disponível
                  {totalTurmas === 1 ? "" : "is"} para consulta.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 backdrop-blur">
            <div className="flex items-center gap-2 font-black text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              Regra administrativa
            </div>
            <p className="mt-1 max-w-sm text-xs leading-relaxed">
              Confirmação manual liberada 1h após o início e até 15 dias após o fim da aula.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

function ModalConfirmarPresenca({
  open,
  dados,
  loading,
  onClose,
  onConfirm,
}) {
  if (!open || !dados) return null;

  return (
    <div className="fixed inset-0 z-[1200]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-presenca-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="confirmar-presenca-title"
                  className="text-lg font-black text-slate-900 dark:text-white"
                >
                  Confirmar presença?
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Esta ação registra presença manual para a data selecionada.
                </p>
              </div>

              <button
                type="button"
                onClick={loading ? undefined : onClose}
                disabled={loading}
                className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <p className="text-emerald-900 dark:text-emerald-100">
                <span className="font-black">Pessoa:</span>{" "}
                {dados.nome || `ID ${dados.usuarioId}`}
              </p>
              <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Data:</span>{" "}
                {formatarDataBR(dados.diaISO)}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              Confirme apenas se a presença foi verificada administrativamente.
            </p>
          </div>

          <footer className="flex justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={loading ? undefined : onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {loading ? "Confirmando..." : "Confirmar presença"}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Subcomponentes de presença
=========================================================================== */

function StatusPresencaBadge({ status }) {
  if (status === STATUS_PRESENCA.PRESENTE) {
    return (
      <Badge tone="emerald">
        <CheckCircle size={14} aria-hidden="true" />
        Presente
      </Badge>
    );
  }

  if (status === STATUS_PRESENCA.FALTOU) {
    return (
      <Badge tone="rose">
        <XCircle size={14} aria-hidden="true" />
        Faltou
      </Badge>
    );
  }

  return <Badge tone="amber">Aguardando</Badge>;
}

function calcularStatusPresenca({ presente, passou60 }) {
  if (presente) return STATUS_PRESENCA.PRESENTE;
  if (passou60) return STATUS_PRESENCA.FALTOU;
  return STATUS_PRESENCA.AGUARDANDO;
}

function BotaoConfirmarPresenca({
  disabled,
  loading,
  onClick,
  label = "Confirmar",
  title,
  ariaLabel,
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-black transition focus-visible:ring-2 focus-visible:ring-emerald-300",
        disabled
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          : "bg-emerald-700 text-white hover:bg-emerald-800",
        loading ? "opacity-70" : ""
      )}
      aria-label={ariaLabel}
      title={title}
    >
      {loading ? "Confirmando..." : label}
    </button>
  );
}

/* =========================================================================
   Componente principal
=========================================================================== */

export default function ListaPresencasTurma({
  turmas = [],
  hoje = new Date(),
  inscritosPorTurma = {},
  carregarInscritos,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [inscritosState, setInscritosState] = useState(inscritosPorTurma);
  const [loading, setLoading] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [executandoConfirmacao, setExecutandoConfirmacao] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Presenças por Turma | Escola da Saúde";
  }, []);

  useEffect(() => {
    setInscritosState(inscritosPorTurma || {});
  }, [inscritosPorTurma]);

  const turmasOrdenadas = useMemo(() => {
    return [...(Array.isArray(turmas) ? turmas : [])].sort(
      compararTurmasPorInicioDesc
    );
  }, [turmas]);

  useEffect(() => {
    if (!turmaExpandidaId || !carregarInscritos) return;

    const lista = inscritosState?.[turmaExpandidaId];

    if (!Array.isArray(lista) || lista.length === 0) {
      carregarInscritos(turmaExpandidaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaExpandidaId]);

  const hojeISO = isoDia(hoje);

  const inscritosCarregados = useMemo(() => {
    return Object.values(inscritosState || {}).reduce(
      (acc, lista) => acc + (Array.isArray(lista) ? lista.length : 0),
      0
    );
  }, [inscritosState]);

  const executarConfirmarPresenca = useCallback(
    async ({ turmaId, usuarioId, diaISO }) => {
      setLoading({
        turmaId,
        usuarioId,
        data: diaISO,
      });

      setMensagem(null);

      try {
        setLive(`Confirmando presença em ${formatarDataBR(diaISO)}.`);

        await api.post("/presenca/confirmar-simples", {
          turma_id: turmaId,
          usuario_id: usuarioId,
          data: diaISO,
        });

        setMensagem({
          type: "success",
          title: "Presença confirmada",
          message: "A presença foi confirmada com sucesso.",
        });

        setInscritosState((prev) => {
          const next = { ...(prev || {}) };
          const lista = Array.isArray(next[turmaId]) ? next[turmaId] : [];

          next[turmaId] = lista.map((pessoa) => {
            const idNormalizado = pessoa.usuario_id ?? pessoa.id;

            if (String(idNormalizado) !== String(usuarioId)) return pessoa;

            if (Array.isArray(pessoa.presencas)) {
              const jaExiste = pessoa.presencas.some(
                (presenca) => isoDia(presenca?.data_presenca) === diaISO
              );

              return jaExiste
                ? pessoa
                : {
                    ...pessoa,
                    presencas: [
                      ...pessoa.presencas,
                      {
                        data_presenca: diaISO,
                        presente: true,
                      },
                    ],
                  };
            }

            return {
              ...pessoa,
              presencas: {
                ...(pessoa.presencas || {}),
                [diaISO]: true,
              },
            };
          });

          return next;
        });

        if (carregarInscritos) {
          await carregarInscritos(turmaId);
        }

        setLive("Presença confirmada.");
      } catch (error) {
        setMensagem({
          type: "error",
          title: "Erro ao confirmar presença",
          message: getErrorMessage(
            error,
            "Não foi possível confirmar a presença. Verifique a janela administrativa e tente novamente."
          ),
        });

        setLive("Falha ao confirmar presença.");
      } finally {
        setLoading(null);
      }
    },
    [carregarInscritos]
  );

  function abrirModalConfirmar(turmaId, usuarioId, diaISO, nome) {
    setConfirmar({
      turmaId,
      usuarioId,
      diaISO,
      nome: nome || null,
    });
  }

  async function onConfirmarModal() {
    if (!confirmar?.turmaId || !confirmar?.usuarioId || !confirmar?.diaISO) {
      setConfirmar(null);
      return;
    }

    try {
      setExecutandoConfirmacao(true);

      await executarConfirmarPresenca({
        turmaId: confirmar.turmaId,
        usuarioId: confirmar.usuarioId,
        diaISO: confirmar.diaISO,
      });
    } finally {
      setExecutandoConfirmacao(false);
      setConfirmar(null);
    }
  }

  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
        <HeaderHero totalTurmas={0} />

        <main id="conteudo" className="flex-1 px-3 py-6 sm:px-4">
          <div className="mx-auto max-w-6xl">
            <NadaEncontrado
              mensagem="Nenhuma turma encontrada."
              sugestao="Verifique os filtros ou cadastre uma nova turma."
            />
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero totalTurmas={turmasOrdenadas.length} />

      <main id="conteudo" className="flex-1 px-3 py-6 sm:px-4">
        <div className="mx-auto max-w-6xl">
          {mensagem ? (
            <div className="mb-4">
              <AlertBox
                type={mensagem.type}
                title={mensagem.title}
                message={mensagem.message}
                onClose={() => setMensagem(null)}
              />
            </div>
          ) : null}

          <section
            aria-label="Resumo"
            className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <MiniStat
              icon={CalendarDays}
              label="Turmas"
              value={turmasOrdenadas.length}
              tone="emerald"
            />

            <MiniStat
              icon={UsersRound}
              label="Inscritos carregados"
              value={inscritosCarregados}
              tone="sky"
            />

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Janela de confirmação
              </div>

              <div className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {modoadministradorPresencas
                  ? "Admin: 1h após início até 15 dias após o fim"
                  : "Somente leitura"}
              </div>
            </div>
          </section>

          <div className="space-y-5">
            {turmasOrdenadas.map((turma) => {
              const inicioDia = isoDia(turma.data_inicio);
              const fimDia = isoDia(turma.data_fim);

              const aberto = turmaExpandidaId === turma.id;
              const secId = `detalhes-turma-${turma.id}`;

              const statusLabel = labelStatusTurma(turma.status);
              const bar = statusBarClass(turma.status);

              const inscritos = inscritosState?.[turma.id];
              const inscritosCount = Array.isArray(inscritos) ? inscritos.length : 0;

              return (
                <section
                  key={turma.id}
                  className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  aria-labelledby={`turma-${turma.id}-titulo`}
                >
                  <div className={cx("absolute left-0 right-0 top-0 h-1.5", bar)} aria-hidden="true" />

                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2
                          id={`turma-${turma.id}-titulo`}
                          className="break-words text-lg font-black text-slate-950 dark:text-emerald-200 sm:text-xl"
                        >
                          {turma.nome}
                        </h2>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" aria-hidden="true" />
                            {inicioDia ? formatarDataBR(inicioDia) : "—"} até{" "}
                            {fimDia ? formatarDataBR(fimDia) : "—"}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            {turma.horario_inicio?.slice?.(0, 5) || "—"} às{" "}
                            {turma.horario_fim?.slice?.(0, 5) || "—"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="zinc">{statusLabel}</Badge>

                          <Badge tone="sky">
                            Inscritos:{" "}
                            <strong className="ml-1">{inscritosCount}</strong>
                          </Badge>

                          {modoadministradorPresencas ? (
                            <Badge tone="amber">Admin</Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <Collapser
                          id={secId}
                          open={aberto}
                          onToggle={() =>
                            setTurmaExpandidaId(aberto ? null : turma.id)
                          }
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-white/5"
                        >
                          {aberto ? "Recolher" : "Ver detalhes"}
                        </Collapser>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {aberto ? (
                      <motion.div
                        id={secId}
                        className="border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-5"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22 }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-100 sm:text-base">
                            Inscritos
                          </h3>

                          <span className="text-xs text-zinc-500">
                            {inscritosCount} pessoa(s)
                          </span>
                        </div>

                        {!Array.isArray(inscritos) ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                            <RefreshCcw className="h-4 w-4 animate-spin" />
                            Carregando inscritos...
                          </div>
                        ) : inscritos.length === 0 ? (
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                            Nenhum inscrito encontrado para esta turma.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {inscritos.map((pessoa) => {
                              const usuarioIdNorm = pessoa.usuario_id ?? pessoa.id;
                              const datas = Array.isArray(pessoa.datas)
                                ? pessoa.datas
                                : [];

                              return (
                                <article
                                  key={usuarioIdNorm}
                                  className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/30 sm:p-4"
                                  aria-label={`Inscrito: ${pessoa.nome}`}
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="break-words font-black text-zinc-900 dark:text-white">
                                        {pessoa.nome}
                                      </div>

                                      <div className="break-words text-xs text-zinc-600 dark:text-zinc-300">
                                        {pessoa.email || "—"}
                                      </div>

                                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                                        CPF: {pessoa.cpf ? formatarCPFSeguro(pessoa.cpf) : "Não informado"}
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      {datas.length ? (
                                        <Badge tone="sky">Datas: {datas.length}</Badge>
                                      ) : (
                                        <Badge tone="zinc">Sem datas</Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    {datas.length === 0 ? (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Nenhuma data cadastrada para esta pessoa.
                                      </p>
                                    ) : (
                                      <>
                                        <div className="hidden overflow-x-auto sm:block">
                                          <table className="min-w-full text-sm">
                                            <thead>
                                              <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                                <th className="py-2 pr-4">Data</th>
                                                <th className="py-2 pr-4">Situação</th>
                                                <th className="py-2 pr-4">Ações</th>
                                              </tr>
                                            </thead>

                                            <tbody>
                                              {datas.map((data) => {
                                                const dia = isoDia(data);
                                                const presente = pessoaEstaPresente(pessoa, dia);

                                                const janela = calcularJanelaConfirmacao({
                                                  dia,
                                                  horarioInicio:
                                                    turma.horario_inicio || "08:00",
                                                  horarioFim:
                                                    turma.horario_fim || "17:00",
                                                });

                                                const podeConfirmar =
                                                  modoadministradorPresencas &&
                                                  janela.podeConfirmar;

                                                const isLoading =
                                                  loading &&
                                                  loading.turmaId === turma.id &&
                                                  loading.usuarioId === usuarioIdNorm &&
                                                  loading.data === dia;

                                                const status = calcularStatusPresenca({
                                                  presente,
                                                  passou60: janela.passou60,
                                                });

                                                return (
                                                  <tr
                                                    key={`${usuarioIdNorm}-${dia}`}
                                                    className="border-t border-zinc-200 dark:border-zinc-800"
                                                  >
                                                    <td className="py-2 pr-4">
                                                      {formatarDataBR(dia)}
                                                    </td>

                                                    <td className="py-2 pr-4">
                                                      <StatusPresencaBadge status={status} />
                                                    </td>

                                                    <td className="py-2 pr-4">
                                                      {!presente ? (
                                                        <BotaoConfirmarPresenca
                                                          disabled={!podeConfirmar}
                                                          loading={Boolean(isLoading)}
                                                          onClick={() =>
                                                            abrirModalConfirmar(
                                                              turma.id,
                                                              usuarioIdNorm,
                                                              dia,
                                                              pessoa.nome
                                                            )
                                                          }
                                                          ariaLabel={`Confirmar presença de ${pessoa.nome} em ${formatarDataBR(dia)}`}
                                                          title={
                                                            podeConfirmar
                                                              ? "Confirmar presença"
                                                              : modoadministradorPresencas
                                                                ? !janela.passou60
                                                                  ? "Disponível 1h após o início"
                                                                  : "Fora do prazo administrativo"
                                                                : "Ação indisponível"
                                                          }
                                                        />
                                                      ) : (
                                                        <span className="text-zinc-400">—</span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        <ul className="space-y-2 sm:hidden">
                                          {datas.map((data) => {
                                            const dia = isoDia(data);
                                            const presente = pessoaEstaPresente(pessoa, dia);

                                            const janela = calcularJanelaConfirmacao({
                                              dia,
                                              horarioInicio:
                                                turma.horario_inicio || "08:00",
                                              horarioFim:
                                                turma.horario_fim || "17:00",
                                            });

                                            const podeConfirmar =
                                              modoadministradorPresencas &&
                                              janela.podeConfirmar;

                                            const isLoading =
                                              loading &&
                                              loading.turmaId === turma.id &&
                                              loading.usuarioId === usuarioIdNorm &&
                                              loading.data === dia;

                                            const status = calcularStatusPresenca({
                                              presente,
                                              passou60: janela.passou60,
                                            });

                                            return (
                                              <li
                                                key={`${usuarioIdNorm}-${dia}-mobile`}
                                                className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="min-w-0">
                                                    <div className="text-sm font-black text-zinc-900 dark:text-white">
                                                      {formatarDataBR(dia)}
                                                    </div>

                                                    <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                                                      {turma.horario_inicio?.slice?.(0, 5) || "—"} às{" "}
                                                      {turma.horario_fim?.slice?.(0, 5) || "—"}
                                                    </div>
                                                  </div>

                                                  <StatusPresencaBadge status={status} />
                                                </div>

                                                <div className="mt-2">
                                                  {!presente ? (
                                                    <BotaoConfirmarPresenca
                                                      disabled={!podeConfirmar}
                                                      loading={Boolean(isLoading)}
                                                      label="Confirmar presença"
                                                      onClick={() =>
                                                        abrirModalConfirmar(
                                                          turma.id,
                                                          usuarioIdNorm,
                                                          dia,
                                                          pessoa.nome
                                                        )
                                                      }
                                                      ariaLabel={`Confirmar presença de ${pessoa.nome} em ${formatarDataBR(dia)}`}
                                                      title={
                                                        podeConfirmar
                                                          ? "Confirmar presença"
                                                          : modoadministradorPresencas
                                                            ? !janela.passou60
                                                              ? "Disponível 1h após o início"
                                                              : "Fora do prazo administrativo"
                                                            : "Ação indisponível"
                                                      }
                                                    />
                                                  ) : (
                                                    <div className="text-sm text-zinc-400">—</div>
                                                  )}
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>

                                        {modoadministradorPresencas ? (
                                          <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                                            Janela admin: confirmação liberada{" "}
                                            <strong>1h após o início</strong> e até{" "}
                                            <strong>15 dias</strong> após o fim da aula.
                                          </p>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-4 text-[12px] text-zinc-500 dark:text-zinc-400">
                          Hoje:{" "}
                          <strong>{hojeISO ? formatarDataBR(hojeISO) : "—"}</strong>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />

      <ModalConfirmarPresenca
        open={Boolean(confirmar)}
        dados={confirmar}
        loading={executandoConfirmacao}
        onClose={() => {
          if (executandoConfirmacao) return;
          setConfirmar(null);
        }}
        onConfirm={onConfirmarModal}
      />
    </div>
  );
}