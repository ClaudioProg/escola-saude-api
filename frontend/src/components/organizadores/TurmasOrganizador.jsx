// ✅ frontend/src/components/organizadores/Turmasorganizador.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import PropTypes from "prop-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  QrCode,
  Star,
  Users,
  XCircle,
} from "lucide-react";

import AvaliacaoEvento from "../avaliacoes/AvaliacaoEvento";
import Botao from "../ui/Botao";
import CarregandoSkeleton from "../ui/CarregandoSkeleton";
import NadaEncontrado from "../ui/NadaEncontrado";

/**
 * Turmasorganizador
 *
 * Função:
 * - Listar turmas agrupadas por evento.
 * - Exibir inscritos por data da turma.
 * - Exibir presença por data.
 * - Exibir avaliações da turma.
 * - Exportar CSV da data ativa.
 * - Acionar exportação de lista de assinatura e QR Code via componente pai.
 *
 * Diretrizes v2.0:
 * - Sem chamada direta ao api.js.
 * - Sem apiGet/apiPost/apiPatch direto.
 * - Sem react-toastify direto.
 * - Sem múltiplas rotas/tentativas legadas.
 * - Sem aliases de endpoint.
 * - Sem formatarCPF importado de dateTime.
 * - Componente visual e funcional; operações de backend ficam no pai.
 */

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}

function ymd(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function hojeYMD() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hhmm(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const match = text.match(/^(\d{1,2}):?(\d{2})?(?::\d{2})?$/);

  if (!match) return "";

  const hour = Math.min(23, Number(match[1] || 0));
  const minute = Math.min(59, Number(match[2] || 0));

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseYMD(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseHHMM(value) {
  const normalized = hhmm(value) || "00:00";
  const match = normalized.match(/^(\d{2}):(\d{2})$/);

  if (!match) return { hour: 0, minute: 0 };

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function toLocalDateFromYMDTime(dateOnly, timeHHmm = "12:00") {
  const date = parseYMD(dateOnly);

  if (!date) return null;

  const time = parseHHMM(timeHHmm);

  return new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    0,
    0
  );
}

function formatarDataBR(value) {
  const dateOnly = ymd(value);

  if (!dateOnly) return "—";

  const [year, month, day] = dateOnly.split("-");

  return `${day}/${month}/${year}`;
}

function formatarDocumento(value) {
  const digits = String(value || "").replace(/\D+/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
      6,
      9
    )}-${digits.slice(9)}`;
  }

  return value || "—";
}

function statusFromTurma(turma) {
  const inicio = ymd(turma?.data_inicio);
  const fim = ymd(turma?.data_fim);

  if (!inicio || !fim) return "programado";

  const hoje = hojeYMD();

  if (inicio > hoje) return "programado";
  if (inicio <= hoje && fim >= hoje) return "andamento";

  return "encerrado";
}

function dentroDaJanelaConfirmacao(dataYMD, horarioInicio, horarioFim) {
  if (!dataYMD) return false;

  const start = toLocalDateFromYMDTime(dataYMD, hhmm(horarioInicio) || "00:00");
  const end = toLocalDateFromYMDTime(dataYMD, hhmm(horarioFim) || "23:59");

  if (!start || !end) return false;

  const abre = new Date(start.getTime() + 60 * 60 * 1000);
  const fecha = new Date(end.getTime() + 48 * 60 * 60 * 1000);
  const agora = new Date();

  return agora >= abre && agora <= fecha;
}

function getEventoId(turma) {
  return toPositiveInt(turma?.evento?.id || turma?.evento_id);
}

function getEventoNome(turma) {
  return safeText(turma?.evento?.nome || turma?.evento_nome, "Evento");
}

function getEventoLocal(turma) {
  return safeText(turma?.evento?.local || turma?.evento_local);
}

function getTurmaId(turma) {
  return toPositiveInt(turma?.id);
}

function getTurmaNome(turma) {
  const id = getTurmaId(turma);

  return safeText(turma?.nome, id ? `Turma #${id}` : "Turma");
}

function normalizarDataTurma(item, turma) {
  const data = ymd(item?.data || item);

  if (!data) return null;

  return {
    data,
    horario_inicio: hhmm(item?.horario_inicio) || hhmm(turma?.horario_inicio),
    horario_fim: hhmm(item?.horario_fim) || hhmm(turma?.horario_fim),
  };
}

function montarDatasReais(turma, datasPorTurma, presencasPorTurma) {
  const turmaId = getTurmaId(turma);

  const fonte =
    safeArray(datasPorTurma?.[turmaId]).length > 0
      ? safeArray(datasPorTurma[turmaId])
      : safeArray(turma?.datas).length > 0
        ? safeArray(turma.datas)
        : safeArray(presencasPorTurma?.[turmaId]?.detalhado?.datas);

  const map = new Map();

  for (const item of fonte) {
    const data = normalizarDataTurma(item, turma);

    if (!data) continue;

    const key = `${data.data}|${data.horario_inicio}|${data.horario_fim}`;

    map.set(key, data);
  }

  return Array.from(map.values()).sort((a, b) => {
    const left = `${a.data} ${a.horario_inicio || "00:00"}`;
    const right = `${b.data} ${b.horario_inicio || "00:00"}`;

    return left.localeCompare(right);
  });
}

function montarMapaUsuarios(inscritos, presencasDetalhadas) {
  const map = new Map();

  for (const inscrito of safeArray(inscritos)) {
    const usuarioId = toPositiveInt(inscrito?.usuario_id || inscrito?.id);

    if (!usuarioId) continue;

    map.set(usuarioId, {
      id: usuarioId,
      nome: safeText(inscrito?.nome, "—"),
      cpf: safeText(inscrito?.cpf),
      presencas: new Map(),
    });
  }

  for (const usuario of safeArray(presencasDetalhadas?.usuarios)) {
    const usuarioId = toPositiveInt(usuario?.id || usuario?.usuario_id);

    if (!usuarioId || !map.has(usuarioId)) continue;

    const alvo = map.get(usuarioId);

    for (const presenca of safeArray(usuario?.presencas)) {
      const data = ymd(presenca?.data_presenca || presenca?.data);

      if (data) {
        alvo.presencas.set(data, presenca?.presente === true);
      }
    }
  }

  return map;
}

function calcularResumoData({ mapaUsuarios, data, antesDaJanela }) {
  let presentes = 0;
  let faltas = 0;
  let aguardando = 0;

  for (const usuario of mapaUsuarios.values()) {
    const presente = usuario.presencas.get(data) === true;

    if (presente) {
      presentes += 1;
    } else if (antesDaJanela) {
      aguardando += 1;
    } else {
      faltas += 1;
    }
  }

  const total = mapaUsuarios.size;
  const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

  return {
    total,
    presentes,
    faltas,
    aguardando,
    percentual,
  };
}

function exportarCsvDataAtiva({ turmaId, dataAtiva, mapaUsuarios }) {
  const rows = [["Nome", "CPF", "Status"]];

  for (const usuario of mapaUsuarios.values()) {
    const presente = usuario.presencas.get(dataAtiva) === true;

    rows.push([
      usuario.nome,
      formatarDocumento(usuario.cpf),
      presente ? "Presente" : "Sem presença",
    ]);
  }

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `presencas_turma_${turmaId}_${dataAtiva}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function StatusTurmaBadge({ status }) {
  const config = {
    programado: {
      label: "Programado",
      className:
        "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    },
    andamento: {
      label: "Em andamento",
      className:
        "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    },
    encerrado: {
      label: "Encerrado",
      className:
        "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    },
  };

  const item = config[status] || config.programado;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
        item.className
      )}
    >
      {item.label}
    </span>
  );
}

function StatusPresencaBadge({ status }) {
  if (status === "presente") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800/60">
          Presente
        </span>
      </span>
    );
  }

  if (status === "aguardando") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/60">
          Aguardando
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
      <XCircle className="h-4 w-4" aria-hidden="true" />
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-black ring-1 ring-rose-100 dark:bg-rose-950/40 dark:ring-rose-800/60">
        Faltou
      </span>
    </span>
  );
}

function MiniStat({ number, label, tone = "slate" }) {
  const tones = {
    slate:
      "bg-slate-50 text-slate-900 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800",
    emerald:
      "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/60",
    amber:
      "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60",
    rose:
      "bg-rose-50 text-rose-900 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-800/60",
  };

  return (
    <div
      className={cx(
        "min-w-[82px] rounded-2xl p-3 text-center ring-1",
        tones[tone] || tones.slate
      )}
    >
      <p className="text-2xl font-black leading-none">{Number(number) || 0}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
    </div>
  );
}

function DonutPresenca({ pct }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  const strokeDasharray = `${value} ${100 - value}`;

  return (
    <div className="flex h-[76px] w-[76px] items-center justify-center">
      <svg
        role="img"
        aria-label={`Presença: ${value}%`}
        width="76"
        height="76"
        viewBox="0 0 42 42"
        className="rotate-[-90deg]"
      >
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="4"
          className="text-slate-200 dark:text-zinc-800"
        />
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          className={cx(
            value >= 75
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          )}
        />
      </svg>

      <div className="absolute text-center">
        <p
          className={cx(
            "text-lg font-black leading-none",
            value >= 75
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300"
          )}
        >
          {value}%
        </p>
        <p className="text-[8px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          presença
        </p>
      </div>
    </div>
  );
}

function EventoHeader({ evento }) {
  return (
    <header className="bg-gradient-to-r from-indigo-800 via-violet-700 to-fuchsia-700 px-4 py-4 text-white sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-black sm:text-lg">
            {evento.nome}
          </h3>
          <p className="mt-1 text-xs text-white/80">
            {evento.turmas.length} turma(s) vinculada(s)
          </p>
        </div>

        {evento.local ? (
          <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{evento.local}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function TurmaInfo({ turma, status }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h4 className="break-words text-sm font-black text-slate-950 dark:text-white">
          {getTurmaNome(turma)}
        </h4>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
          {turma?.data_inicio && turma?.data_fim ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatarDataBR(turma.data_inicio)} até{" "}
              {formatarDataBR(turma.data_fim)}
            </span>
          ) : null}

          {turma?.horario_inicio || turma?.horario_fim ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {hhmm(turma.horario_inicio) || "—"} às{" "}
              {hhmm(turma.horario_fim) || "—"}
            </span>
          ) : null}
        </div>
      </div>

      <StatusTurmaBadge status={status} />
    </div>
  );
}

function ActionButton({ children, icon: Icon, onClick, disabled, variant = "primary" }) {
  const styles =
    variant === "primary"
      ? "bg-indigo-700 text-white hover:bg-indigo-800"
      : variant === "pink"
        ? "bg-fuchsia-700 text-white hover:bg-fuchsia-800"
        : variant === "emerald"
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : "bg-slate-800 text-white hover:bg-slate-900 dark:bg-white/10 dark:hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        disabled ? "cursor-not-allowed opacity-60" : styles
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function DataTabs({ turmaId, datas, dataAtiva, onChange }) {
  const handleKeyDown = (event, currentIndex) => {
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % datas.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + datas.length) % datas.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = datas.length - 1;
    } else {
      return;
    }

    event.preventDefault();

    const next = datas[nextIndex];

    onChange(next.data);

    window.requestAnimationFrame(() => {
      document.getElementById(`tab-${turmaId}-${next.data}`)?.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label={`Datas da turma ${turmaId}`}
      className="flex flex-wrap gap-2"
    >
      {datas.map((data, index) => {
        const active = dataAtiva === data.data;

        return (
          <button
            key={`${data.data}-${data.horario_inicio}-${data.horario_fim}`}
            id={`tab-${turmaId}-${data.data}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${turmaId}-${data.data}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(data.data)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-black transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              active
                ? "border-violet-700 bg-violet-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            {formatarDataBR(data.data)} · {data.horario_inicio || "—"}-
            {data.horario_fim || "—"}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function Turmasorganizador({
  turmas = [],
  inscritosPorTurma = {},
  avaliacaoPorTurma = {},
  presencasPorTurma = {},
  onVerInscritos,
  onVerAvaliacao,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  onConfirmarPresencaManual,
  carregarPresencas,
  carregando = false,
  turmaExpandidaInscritos = null,
  setTurmaExpandidaInscritos = () => {},
  turmaExpandidaAvaliacao = null,
  setTurmaExpandidaAvaliacao = () => {},
  datasPorTurma = {},
  carregarDatasPorTurma,
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  const [confirmandoKey, setConfirmandoKey] = useState("");
  const [dataAtivaPorTurma, setDataAtivaPorTurma] = useState({});
  const [somenteSemPresencaPorTurma, setSomenteSemPresencaPorTurma] = useState(
    {}
  );

  const eventosAgrupados = useMemo(() => {
    const map = new Map();

    for (const turma of safeArray(turmas)) {
      const turmaId = getTurmaId(turma);
      const eventoId = getEventoId(turma);

      if (!turmaId || !eventoId) continue;

      if (!map.has(eventoId)) {
        map.set(eventoId, {
          id: eventoId,
          nome: getEventoNome(turma),
          local: getEventoLocal(turma),
          turmas: [],
        });
      }

      map.get(eventoId).turmas.push(turma);
    }

    return Array.from(map.values());
  }, [turmas]);

  const handleConfirmarPresenca = useCallback(
    async ({ usuarioId, turmaId, data }) => {
      if (typeof onConfirmarPresencaManual !== "function") return;

      const key = `${usuarioId}-${turmaId}-${data}`;

      try {
        setConfirmandoKey(key);

        await Promise.resolve(
          onConfirmarPresencaManual({
            usuario_id: Number(usuarioId),
            turma_id: Number(turmaId),
            data,
          })
        );

        await Promise.resolve(carregarPresencas?.(turmaId));
      } finally {
        setConfirmandoKey("");
      }
    },
    [onConfirmarPresencaManual, carregarPresencas]
  );

  if (carregando) {
    return (
      <section aria-label="Carregando turmas do organizador" className={className}>
        <div className="space-y-4">
          <CarregandoSkeleton height={150} />
          <CarregandoSkeleton height={150} />
        </div>
      </section>
    );
  }

  if (!eventosAgrupados.length) {
    return (
      <NadaEncontrado
        titulo="Nenhuma turma encontrada"
        descricao="Quando houver turmas vinculadas ao seu perfil de organizador, elas aparecerão aqui."
      />
    );
  }

  return (
    <section aria-label="Turmas do organizador" className={className}>
      <ul className="space-y-6">
        <AnimatePresence initial={false}>
          {eventosAgrupados.map((evento) => (
            <motion.li
              key={evento.id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
            >
              <EventoHeader evento={evento} />

              <div className="space-y-5 p-4 sm:p-5">
                {evento.turmas.map((turma) => {
                  const turmaId = getTurmaId(turma);

                  if (!turmaId) return null;

                  const statusTurma = statusFromTurma(turma);
                  const expandindoInscritos =
                    Number(turmaExpandidaInscritos) === turmaId;
                  const expandindoAvaliacao =
                    Number(turmaExpandidaAvaliacao) === turmaId;

                  const datas = montarDatasReais(
                    turma,
                    datasPorTurma,
                    presencasPorTurma
                  );

                  const dataAtiva =
                    dataAtivaPorTurma[turmaId] || datas[0]?.data || "";
                  const somenteSemPresenca =
                    Boolean(somenteSemPresencaPorTurma[turmaId]);

                  const inscritos = safeArray(inscritosPorTurma[turmaId]);
                  const presencasDetalhadas =
                    presencasPorTurma[turmaId]?.detalhado || {};

                  const mapaUsuarios = montarMapaUsuarios(
                    inscritos,
                    presencasDetalhadas
                  );

                  return (
                    <article
                      key={turmaId}
                      className="overflow-hidden rounded-[1.25rem] bg-slate-50 ring-1 ring-slate-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
                    >
                      <TurmaInfo turma={turma} status={statusTurma} />

                      <div className="flex flex-wrap gap-2 px-4 pb-4">
                        <ActionButton
                          icon={Users}
                          onClick={() => {
                            onVerInscritos?.(turmaId);
                            carregarPresencas?.(turmaId);
                            carregarDatasPorTurma?.(turmaId);

                            if (!expandindoInscritos && datas.length > 0) {
                              setDataAtivaPorTurma((prev) => ({
                                ...prev,
                                [turmaId]: datas[0].data,
                              }));
                            }

                            setTurmaExpandidaInscritos(
                              expandindoInscritos ? null : turmaId
                            );
                            setTurmaExpandidaAvaliacao(null);
                          }}
                        >
                          Ver inscritos
                        </ActionButton>

                        <ActionButton
                          icon={Star}
                          variant="pink"
                          onClick={() => {
                            onVerAvaliacao?.(turmaId);
                            setTurmaExpandidaAvaliacao(
                              expandindoAvaliacao ? null : turmaId
                            );
                            setTurmaExpandidaInscritos(null);
                          }}
                        >
                          Avaliações
                        </ActionButton>

                        <ActionButton
                          icon={FileText}
                          variant="neutral"
                          onClick={() => onExportarListaAssinaturaPDF?.(turmaId)}
                        >
                          Lista de presença
                        </ActionButton>

                        <ActionButton
                          icon={QrCode}
                          variant="emerald"
                          onClick={() =>
                            onExportarQrCodePDF?.(turmaId, evento.nome)
                          }
                        >
                          QR Code
                        </ActionButton>
                      </div>

                      <AnimatePresence initial={false}>
                        {expandindoInscritos ? (
                          <motion.div
                            id={`painel-inscritos-${turmaId}`}
                            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                            animate={
                              reduceMotion ? undefined : { opacity: 1, height: "auto" }
                            }
                            exit={
                              reduceMotion ? undefined : { opacity: 0, height: 0 }
                            }
                            className="overflow-hidden px-4 pb-4"
                          >
                            {!inscritos.length ? (
                              <NadaEncontrado
                                titulo="Nenhum inscrito nesta turma"
                                descricao="Quando houver inscritos, eles aparecerão aqui."
                              />
                            ) : !datas.length ? (
                              <NadaEncontrado
                                titulo="Nenhuma data registrada"
                                descricao="Não há datas encontradas para esta turma."
                              />
                            ) : (
                              <div className="space-y-4">
                                <DataTabs
                                  turmaId={turmaId}
                                  datas={datas}
                                  dataAtiva={dataAtiva}
                                  onChange={(data) =>
                                    setDataAtivaPorTurma((prev) => ({
                                      ...prev,
                                      [turmaId]: data,
                                    }))
                                  }
                                />

                                {(() => {
                                  const dataSelecionada =
                                    datas.find((item) => item.data === dataAtiva) ||
                                    datas[0];

                                  if (!dataSelecionada) return null;

                                  const inicio = toLocalDateFromYMDTime(
                                    dataSelecionada.data,
                                    dataSelecionada.horario_inicio || "00:00"
                                  );
                                  const abreJanela = inicio
                                    ? new Date(inicio.getTime() + 60 * 60 * 1000)
                                    : null;
                                  const antesDaJanela = abreJanela
                                    ? new Date() < abreJanela
                                    : true;

                                  const resumo = calcularResumoData({
                                    mapaUsuarios,
                                    data: dataSelecionada.data,
                                    antesDaJanela,
                                  });

                                  const usuarios = Array.from(
                                    mapaUsuarios.values()
                                  ).filter((usuario) => {
                                    if (!somenteSemPresenca) return true;

                                    return (
                                      usuario.presencas.get(
                                        dataSelecionada.data
                                      ) !== true
                                    );
                                  });

                                  return (
                                    <section
                                      id={`panel-${turmaId}-${dataSelecionada.data}`}
                                      role="tabpanel"
                                      aria-labelledby={`tab-${turmaId}-${dataSelecionada.data}`}
                                      className="overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
                                    >
                                      <header className="flex flex-col gap-4 border-b border-slate-200 p-4 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                          <h5 className="text-sm font-black text-slate-950 dark:text-white">
                                            {formatarDataBR(dataSelecionada.data)}
                                          </h5>

                                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                                            <Clock
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            />
                                            {dataSelecionada.horario_inicio ||
                                              "—"}{" "}
                                            às {dataSelecionada.horario_fim || "—"}
                                          </p>

                                          {antesDaJanela ? (
                                            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                              Confirmação manual libera cerca de
                                              1h após o início da aula.
                                            </p>
                                          ) : null}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <MiniStat
                                            number={resumo.total}
                                            label="inscritos"
                                          />
                                          <MiniStat
                                            number={resumo.presentes}
                                            label="presentes"
                                            tone="emerald"
                                          />
                                          <MiniStat
                                            number={resumo.faltas}
                                            label="faltas"
                                            tone="rose"
                                          />
                                          <MiniStat
                                            number={resumo.aguardando}
                                            label="aguardando"
                                            tone="amber"
                                          />

                                          <div className="relative">
                                            <DonutPresenca
                                              pct={resumo.percentual}
                                            />
                                          </div>

                                          <Botao
                                            type="button"
                                            variant="secondary"
                                            onClick={() =>
                                              exportarCsvDataAtiva({
                                                turmaId,
                                                dataAtiva:
                                                  dataSelecionada.data,
                                                mapaUsuarios,
                                              })
                                            }
                                          >
                                            <span className="inline-flex items-center gap-2">
                                              <Download
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                              />
                                              CSV
                                            </span>
                                          </Botao>
                                        </div>
                                      </header>

                                      <div className="p-4">
                                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-200">
                                            <input
                                              type="checkbox"
                                              checked={somenteSemPresenca}
                                              onChange={(event) =>
                                                setSomenteSemPresencaPorTurma(
                                                  (prev) => ({
                                                    ...prev,
                                                    [turmaId]:
                                                      event.target.checked,
                                                  })
                                                )
                                              }
                                            />
                                            Mostrar apenas sem presença
                                          </label>

                                          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                            {usuarios.length} de {resumo.total}{" "}
                                            exibidos
                                          </p>
                                        </div>

                                        <div className="hidden overflow-x-auto md:block">
                                          <table className="min-w-full text-left text-sm">
                                            <thead>
                                              <tr className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                                                <th className="px-3 py-2">
                                                  Nome
                                                </th>
                                                <th className="px-3 py-2">
                                                  CPF
                                                </th>
                                                <th className="px-3 py-2">
                                                  Situação
                                                </th>
                                                <th className="px-3 py-2 text-right">
                                                  Ações
                                                </th>
                                              </tr>
                                            </thead>

                                            <tbody>
                                              {usuarios.map((usuario) => {
                                                const presente =
                                                  usuario.presencas.get(
                                                    dataSelecionada.data
                                                  ) === true;
                                                const status = presente
                                                  ? "presente"
                                                  : antesDaJanela
                                                    ? "aguardando"
                                                    : "faltou";
                                                const podeConfirmar =
                                                  !presente &&
                                                  dentroDaJanelaConfirmacao(
                                                    dataSelecionada.data,
                                                    dataSelecionada.horario_inicio,
                                                    dataSelecionada.horario_fim
                                                  ) &&
                                                  typeof onConfirmarPresencaManual ===
                                                    "function";
                                                const key = `${usuario.id}-${turmaId}-${dataSelecionada.data}`;
                                                const loadingThis =
                                                  confirmandoKey === key;

                                                return (
                                                  <tr
                                                    key={key}
                                                    className="border-t border-slate-200 dark:border-zinc-800"
                                                  >
                                                    <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                                                      {usuario.nome}
                                                    </td>

                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300">
                                                      {formatarDocumento(
                                                        usuario.cpf
                                                      )}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                      <StatusPresencaBadge
                                                        status={status}
                                                      />
                                                    </td>

                                                    <td className="px-3 py-3 text-right">
                                                      {podeConfirmar ? (
                                                        <Botao
                                                          type="button"
                                                          variant="primary"
                                                          disabled={loadingThis}
                                                          onClick={() =>
                                                            handleConfirmarPresenca(
                                                              {
                                                                usuarioId:
                                                                  usuario.id,
                                                                turmaId,
                                                                data: dataSelecionada.data,
                                                              }
                                                            )
                                                          }
                                                        >
                                                          {loadingThis
                                                            ? "Confirmando..."
                                                            : "Confirmar"}
                                                        </Botao>
                                                      ) : (
                                                        <span className="text-xs text-slate-400">
                                                          —
                                                        </span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        <div className="grid gap-3 md:hidden">
                                          {usuarios.map((usuario) => {
                                            const presente =
                                              usuario.presencas.get(
                                                dataSelecionada.data
                                              ) === true;
                                            const status = presente
                                              ? "presente"
                                              : antesDaJanela
                                                ? "aguardando"
                                                : "faltou";
                                            const podeConfirmar =
                                              !presente &&
                                              dentroDaJanelaConfirmacao(
                                                dataSelecionada.data,
                                                dataSelecionada.horario_inicio,
                                                dataSelecionada.horario_fim
                                              ) &&
                                              typeof onConfirmarPresencaManual ===
                                                "function";
                                            const key = `${usuario.id}-${turmaId}-${dataSelecionada.data}`;
                                            const loadingThis =
                                              confirmandoKey === key;

                                            return (
                                              <article
                                                key={`mobile-${key}`}
                                                className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800"
                                              >
                                                <div className="flex flex-col gap-2">
                                                  <div>
                                                    <p className="font-black text-slate-950 dark:text-white">
                                                      {usuario.nome}
                                                    </p>
                                                    <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                                      {formatarDocumento(
                                                        usuario.cpf
                                                      )}
                                                    </p>
                                                  </div>

                                                  <StatusPresencaBadge
                                                    status={status}
                                                  />

                                                  {podeConfirmar ? (
                                                    <Botao
                                                      type="button"
                                                      variant="primary"
                                                      disabled={loadingThis}
                                                      onClick={() =>
                                                        handleConfirmarPresenca({
                                                          usuarioId: usuario.id,
                                                          turmaId,
                                                          data: dataSelecionada.data,
                                                        })
                                                      }
                                                    >
                                                      {loadingThis
                                                        ? "Confirmando..."
                                                        : "Confirmar presença"}
                                                    </Botao>
                                                  ) : null}
                                                </div>
                                              </article>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </section>
                                  );
                                })()}
                              </div>
                            )}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {expandindoAvaliacao ? (
                          <motion.div
                            id={`painel-avaliacao-${turmaId}`}
                            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                            animate={
                              reduceMotion ? undefined : { opacity: 1, height: "auto" }
                            }
                            exit={
                              reduceMotion ? undefined : { opacity: 0, height: 0 }
                            }
                            className="overflow-hidden px-4 pb-4"
                          >
                            {(() => {
                              const comentarios = safeArray(
                                avaliacaoPorTurma[turmaId]
                              );

                              return comentarios.length > 0 ? (
                                <AvaliacaoEvento avaliacao={comentarios} />
                              ) : (
                                <NadaEncontrado
                                  titulo="Nenhuma avaliação registrada"
                                  descricao="Quando os participantes avaliarem esta turma, os comentários aparecerão aqui."
                                />
                              );
                            })()}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </article>
                  );
                })}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

Turmasorganizador.propTypes = {
  turmas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      nome: PropTypes.string,
      data_inicio: PropTypes.string,
      data_fim: PropTypes.string,
      horario_inicio: PropTypes.string,
      horario_fim: PropTypes.string,
      evento_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      evento_nome: PropTypes.string,
      evento_local: PropTypes.string,
      evento: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        nome: PropTypes.string,
        local: PropTypes.string,
      }),
      datas: PropTypes.arrayOf(
        PropTypes.shape({
          data: PropTypes.string,
          horario_inicio: PropTypes.string,
          horario_fim: PropTypes.string,
        })
      ),
    })
  ),
  inscritosPorTurma: PropTypes.object,
  avaliacaoPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  onVerInscritos: PropTypes.func,
  onVerAvaliacao: PropTypes.func,
  onExportarListaAssinaturaPDF: PropTypes.func,
  onExportarQrCodePDF: PropTypes.func,
  onConfirmarPresencaManual: PropTypes.func,
  carregarPresencas: PropTypes.func,
  carregando: PropTypes.bool,
  turmaExpandidaInscritos: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  setTurmaExpandidaInscritos: PropTypes.func,
  turmaExpandidaAvaliacao: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  setTurmaExpandidaAvaliacao: PropTypes.func,
  datasPorTurma: PropTypes.object,
  carregarDatasPorTurma: PropTypes.func,
  className: PropTypes.string,
};