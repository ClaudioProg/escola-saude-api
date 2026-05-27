/* eslint-disable no-console */
// ✅ frontend/src/components/eventos/CardEventoAdministrador.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Card administrativo premium de evento.
//
// Diretrizes aplicadas:
// - Visual reestruturado, não apenas mantido;
// - Pasta do domínio: src/components/eventos/;
// - BadgeStatus vem de ../ui/BadgeStatus;
// - CardTurmaAdministrador vem de ./CardTurmaAdministrador;
// - Folder oficial vem de getEventoFolderUrl(evento);
// - Status oficial: programado | andamento | encerrado | sem_datas;
// - Sem status em_andamento;
// - Sem status todos;
// - Sem evento.organizador como alias;
// - Sem normalização multi-formato de listas;
// - Sem resolveAssetUrl;
// - Sem helper legado de data;
// - Sem new Date("YYYY-MM-DD");
// - Presença ≥75% calculada sobre ocorrências oficiais;
// - Layout administrativo claro: evento → métricas → turmas → inscritos;
// - Mobile-first, acessível, rastreável e mais legível.

import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Image as ImageIcon,
  ListChecks,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import BadgeStatus from "../ui/BadgeStatus";
import CardTurmaAdministrador from "./CardTurmaAdministrador";
import {
  EVENTO_STATUS,
  deduzStatusEvento,
  getEventoFolderUrl,
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

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ymd(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate()
    )}`;
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (isDateOnly(raw)) return raw;

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  return "";
}

function formatDateBr(value) {
  const date = ymd(value);

  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function idadePorDataNascimento(value) {
  const nascimento = ymd(value);

  if (!nascimento) return null;

  const [year, month, day] = nascimento.split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - year;

  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();

  if (mesAtual < month || (mesAtual === month && diaAtual < day)) {
    idade -= 1;
  }

  return Number.isFinite(idade) && idade >= 0 ? idade : null;
}

/* ─────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatarCPF(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);

  if (!digits) return "—";

  return digits
    .padStart(11, "0")
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function getDatasTurmas(turmas = []) {
  const datas = [];

  for (const turma of Array.isArray(turmas) ? turmas : []) {
    const turmaInicio = ymd(turma?.data_inicio);
    const turmaFim = ymd(turma?.data_fim || turma?.data_inicio);

    if (turmaInicio) datas.push(turmaInicio);
    if (turmaFim) datas.push(turmaFim);

    if (Array.isArray(turma?.datas)) {
      for (const item of turma.datas) {
        const data = ymd(item?.data);
        if (data) datas.push(data);
      }
    }
  }

  return datas.filter(Boolean).sort();
}

function getPeriodoEvento(evento, turmas) {
  const dataInicioEvento = ymd(evento?.data_inicio_geral || evento?.data_inicio);
  const dataFimEvento = ymd(evento?.data_fim_geral || evento?.data_fim);

  if (dataInicioEvento && dataFimEvento) {
    return dataInicioEvento === dataFimEvento
      ? formatDateBr(dataInicioEvento)
      : `${formatDateBr(dataInicioEvento)} até ${formatDateBr(dataFimEvento)}`;
  }

  const datas = getDatasTurmas(turmas);

  if (datas.length) {
    const min = datas[0];
    const max = datas.at(-1);

    return min === max
      ? formatDateBr(min)
      : `${formatDateBr(min)} até ${formatDateBr(max)}`;
  }

  return "Período não informado";
}

function getStatusEvento({ evento, turmas }) {
  const statusServidor = deduzStatusEvento(evento);

  if (
    statusServidor === EVENTO_STATUS.PROGRAMADO ||
    statusServidor === EVENTO_STATUS.ANDAMENTO ||
    statusServidor === EVENTO_STATUS.ENCERRADO ||
    statusServidor === EVENTO_STATUS.SEM_DATAS
  ) {
    return statusServidor;
  }

  let dataInicio = ymd(evento?.data_inicio_geral || evento?.data_inicio);
  let dataFim = ymd(evento?.data_fim_geral || evento?.data_fim);

  if (!dataInicio || !dataFim) {
    const datas = getDatasTurmas(turmas);

    if (datas.length) {
      dataInicio = datas[0];
      dataFim = datas.at(-1);
    }
  }

  if (!dataInicio || !dataFim) return EVENTO_STATUS.SEM_DATAS;

  const hoje = hojeIsoLocal();

  if (hoje < dataInicio) return EVENTO_STATUS.PROGRAMADO;
  if (hoje > dataFim) return EVENTO_STATUS.ENCERRADO;

  return EVENTO_STATUS.ANDAMENTO;
}

/* ─────────────────────────────────────────────────────────────
   Presença / frequência
────────────────────────────────────────────────────────────── */

function calcularFrequencia(usuario) {
  const frequenciaNum = Number(usuario?.frequencia_num);

  if (Number.isFinite(frequenciaNum)) {
    return Math.max(0, Math.min(100, Math.round(frequenciaNum)));
  }

  const totalOcorridos = Number(usuario?.total_ocorridos);
  const presentesOcorridos = Number(usuario?.presentes_ocorridos);

  if (
    Number.isFinite(totalOcorridos) &&
    totalOcorridos > 0 &&
    Number.isFinite(presentesOcorridos)
  ) {
    return Math.max(
      0,
      Math.min(100, Math.round((presentesOcorridos / totalOcorridos) * 100))
    );
  }

  return 0;
}

function mapPresencasParaLista(presencasPorTurma, turmaId) {
  const raw = presencasPorTurma?.[turmaId];

  return asArray(raw)
    .map((usuario) => {
      const usuarioId = Number(usuario?.usuario_id);

      if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;

      const frequenciaNum = calcularFrequencia(usuario);

      return {
        usuario_id: usuarioId,
        cpf: usuario?.cpf || null,
        frequencia_num: frequenciaNum,
        frequencia: `${frequenciaNum}%`,
        elegivel: frequenciaNum >= 75,
        presente: usuario?.presente === true,
      };
    })
    .filter(Boolean);
}

/* ─────────────────────────────────────────────────────────────
   Turma helpers
────────────────────────────────────────────────────────────── */

function resolveAssinanteNome(turma) {
  if (turma?.organizador_assinante?.nome) {
    return turma.organizador_assinante.nome;
  }

  const assinanteId = Number(turma?.organizador_assinante_id);

  if (!Number.isFinite(assinanteId)) return null;

  const organizadores = Array.isArray(turma?.organizadores) ? turma.organizadores : [];

  for (const organizador of organizadores) {
    const id = Number(organizador?.id ?? organizador);
    const nome = typeof organizador === "object" ? organizador?.nome : null;

    if (id === assinanteId) return nome || null;
  }

  return null;
}

function resolverorganizadoresTurma(turma) {
  const raw = Array.isArray(turma?.organizadores) ? turma.organizadores : [];

  const seen = new Set();
  const result = [];

  for (const item of raw) {
    const id = Number(item?.id ?? item);

    if (!Number.isFinite(id) || seen.has(id)) continue;

    seen.add(id);

    result.push({
      id,
      nome:
        typeof item === "object" && item?.nome
          ? String(item.nome).trim()
          : `ID ${id}`,
    });
  }

  return result;
}

function resolverorganizadoresEvento(evento) {
  const raw = Array.isArray(evento?.organizadores) ? evento.organizadores : [];

  return raw
    .map((item) => {
      const id = Number(item?.id ?? item);

      if (!Number.isFinite(id)) return null;

      return {
        id,
        nome:
          typeof item === "object" && item?.nome
            ? String(item.nome).trim()
            : `ID ${id}`,
      };
    })
    .filter(Boolean);
}

/* ─────────────────────────────────────────────────────────────
   Estilos
────────────────────────────────────────────────────────────── */

const STATUS_STYLES = {
  [EVENTO_STATUS.PROGRAMADO]: {
    bar: "from-emerald-500 via-teal-500 to-cyan-500",
    aura: "bg-emerald-500/10",
    label: "Programado",
  },
  [EVENTO_STATUS.ANDAMENTO]: {
    bar: "from-amber-500 via-orange-500 to-rose-500",
    aura: "bg-amber-500/10",
    label: "Em andamento",
  },
  [EVENTO_STATUS.ENCERRADO]: {
    bar: "from-rose-600 via-red-600 to-zinc-700",
    aura: "bg-rose-500/10",
    label: "Encerrado",
  },
  [EVENTO_STATUS.SEM_DATAS]: {
    bar: "from-indigo-500 via-fuchsia-500 to-pink-500",
    aura: "bg-indigo-500/10",
    label: "Sem datas completas",
  },
};

function statusStyles(status) {
  return STATUS_STYLES[status] || STATUS_STYLES[EVENTO_STATUS.SEM_DATAS];
}

/* ─────────────────────────────────────────────────────────────
   UI
────────────────────────────────────────────────────────────── */

function MetricCard({ icon: Icon, label, value, tone = "slate", hint }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-50/80 text-slate-900 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    sky:
      "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
    amber:
      "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50/80 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100",
  };

  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${tones[tone] || tones.slate}`}
      title={hint || `${label}: ${value}`}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/65 shadow-sm dark:bg-white/5">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
            {label}
          </div>
          <div className="truncate text-xl font-black leading-tight">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function PctPill({ value }) {
  const number = Number(value);
  const pct = Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;

  let cls =
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-200";

  if (pct >= 90) {
    cls =
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-200";
  } else if (pct >= 75) {
    cls =
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200";
  } else if (pct >= 50) {
    cls =
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200";
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border px-2.5 py-1 text-xs font-black ${cls}`}
      title={`${pct}% de presença`}
    >
      {pct}%
    </span>
  );
}

function DeficienciaBadges({ inscrito }) {
  const possuiDeficiencia = inscrito?.deficiencia === true;
  const descricao = String(inscrito?.deficiencia_descricao || "").trim();

  if (!possuiDeficiencia && !descricao) {
    return <span className="text-zinc-400">—</span>;
  }

  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200"
      title={descricao || "Pessoa com deficiência"}
    >
      <Accessibility size={15} aria-hidden="true" />
      {descricao || "Sim"}
    </span>
  );
}

function EmptyPoster({ hasUrl }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
      <ImageIcon className="h-8 w-8" aria-hidden="true" />
      <span className="text-xs font-semibold">
        {hasUrl ? "Imagem indisponível" : "Sem folder"}
      </span>
    </div>
  );
}

function InstructorChips({ organizadores }) {
  if (!organizadores.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {organizadores.map((organizador) => (
        <span
          key={organizador.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200"
          title={organizador.nome}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-300"
            aria-hidden="true"
          />
          {organizador.nome}
        </span>
      ))}
    </div>
  );
}

function InscritosTable({ inscritos, presencasPorTurma, turmaId }) {
  if (!inscritos.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/30 dark:text-zinc-400">
        Nenhum inscrito nesta turma.
      </div>
    );
  }

  const presencas = mapPresencasParaLista(presencasPorTurma, turmaId);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="hidden grid-cols-[minmax(240px,1fr)_150px_120px_80px_140px_100px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:grid">
        <div>Nome</div>
        <div>CPF</div>
        <div>Registro</div>
        <div>Idade</div>
        <div>PcD</div>
        <div className="text-right">Frequência</div>
      </div>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {inscritos
          .slice()
          .sort((a, b) =>
            String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR")
          )
          .map((inscrito) => {
            const usuarioId = Number(inscrito?.usuario_id);
            const key = `${usuarioId || "usuario"}-${inscrito?.cpf || inscrito?.email || Math.random()}`;

            const cpf = formatarCPF(inscrito?.cpf);
            const idade = Number.isFinite(Number(inscrito?.idade))
              ? Number(inscrito.idade)
              : idadePorDataNascimento(inscrito?.data_nascimento);

            const registro = inscrito?.registro || "—";

            const presencaAluno = presencas.find(
              (presenca) =>
                Number(presenca.usuario_id) === usuarioId ||
                (presenca.cpf && inscrito?.cpf && presenca.cpf === inscrito.cpf)
            );

            const frequencia =
              presencaAluno?.frequencia_num != null
                ? Number(presencaAluno.frequencia_num)
                : null;

            return (
              <li key={key} className="px-4 py-3">
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(240px,1fr)_150px_120px_80px_140px_100px] sm:gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                      {inscrito?.nome || "—"}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[12px] leading-snug text-zinc-500 dark:text-zinc-400 sm:hidden">
                      <span>CPF: {cpf}</span>
                      <span>Reg.: {registro}</span>
                      {Number.isFinite(idade) && <span>Idade: {idade}</span>}
                    </div>
                  </div>

                  <div className="hidden font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-300 sm:block">
                    {cpf}
                  </div>

                  <div className="hidden break-words text-sm leading-snug text-zinc-600 dark:text-zinc-300 sm:block">
                    {registro}
                  </div>

                  <div className="hidden text-sm text-zinc-600 dark:text-zinc-300 sm:block">
                    {Number.isFinite(idade) ? `${idade}` : "—"}
                  </div>

                  <DeficienciaBadges inscrito={inscrito} />

                  <div className="sm:text-right">
                    {Number.isFinite(frequencia) ? (
                      <PctPill value={frequencia} />
                    ) : (
                      <span className="text-sm text-zinc-400">—</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function CardEventoAdministrador({
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
  gerarPdfInscritosTurma,
  classNomeEventoMultiLinha,
  classorganizadoresMultiLinha,
}) {
  const tituloEvento = evento?.titulo || "Evento sem título";

  const folderUrl = useMemo(() => getEventoFolderUrl(evento), [evento]);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [folderUrl]);

  const statusEvento = getStatusEvento({ evento, turmas });
  const styles = statusStyles(statusEvento);

  const turmasId = `admin-evento-${evento?.id}-turmas`;
  const tituloId = `admin-evento-${evento?.id}-titulo`;

  const periodo = useMemo(() => getPeriodoEvento(evento, turmas), [evento, turmas]);

  const nomeorganizador = useMemo(() => {
    const nomes = resolverorganizadoresEvento(evento)
      .map((item) => item.nome)
      .filter(Boolean);

    return nomes.length ? nomes.join(", ") : "organizador não informado";
  }, [evento]);

  const stats = useMemo(() => {
    if (!Array.isArray(turmas) || !turmas.length) {
      return {
        totalTurmas: 0,
        totalInscritos: 0,
        totalPresentes: 0,
        presencaMedia: "0",
      };
    }

    let totalInscritos = 0;
    let totalElegiveis = 0;

    for (const turma of turmas) {
      const inscritos = asArray(inscritosPorTurma?.[turma.id]);
      const presencas = mapPresencasParaLista(presencasPorTurma, turma.id);

      totalInscritos += inscritos.length;
      totalElegiveis += presencas.filter((presenca) => presenca?.elegivel === true)
        .length;
    }

    const presencaMedia = totalInscritos
      ? Math.round((totalElegiveis / totalInscritos) * 100).toString()
      : "0";

    return {
      totalTurmas: turmas.length,
      totalInscritos,
      totalPresentes: totalElegiveis,
      presencaMedia,
    };
  }, [inscritosPorTurma, presencasPorTurma, turmas]);

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;

    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos?.(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas?.(turma.id);
      if (!avaliacaoPorTurma?.[turma.id]) carregarAvaliacao?.(turma.id);
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

  const nomeEventoClass =
    classNomeEventoMultiLinha ||
    "break-words text-2xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-3xl";

  const organizadoresClass =
    classorganizadoresMultiLinha ||
    "break-words text-sm font-medium leading-snug text-zinc-600 dark:text-zinc-300";

  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_18px_70px_-44px_rgba(15,23,42,0.65)] dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby={tituloId}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${styles.bar}`}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl ${styles.aura}`}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[210px_minmax(0,1fr)_180px] lg:p-6">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="aspect-[4/3] w-full lg:aspect-[3/4]">
            {folderUrl && imgOk ? (
              <img
                src={folderUrl}
                alt={`Folder do evento ${tituloEvento}`}
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
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
            <BadgeStatus status={statusEvento} size="sm" variant="soft" />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {periodo}
            </span>
          </div>

          <h3 id={tituloId} className={`${nomeEventoClass} mt-3`} title={tituloEvento}>
            {tituloEvento}
          </h3>

          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              organizadores responsáveis
            </div>
            <div className={organizadoresClass} title={nomeorganizador}>
              {nomeorganizador}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard
              icon={ListChecks}
              label="Turmas"
              value={stats.totalTurmas}
              tone="violet"
            />
            <MetricCard
              icon={Users}
              label="Inscritos"
              value={stats.totalInscritos}
              tone="slate"
            />
            <MetricCard
              icon={UserCheck}
              label="≥75%"
              value={stats.totalPresentes}
              tone="emerald"
              hint="Participantes com presença igual ou superior a 75%"
            />
            <MetricCard
              icon={BarChart3}
              label="Presença"
              value={`${stats.presencaMedia}%`}
              tone="sky"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Gestão do evento
            </div>

            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Acesse turmas, inscritos, presença e relatórios administrativos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleExpandir(evento.id)}
            aria-expanded={!!expandido}
            aria-controls={turmasId}
            className={[
              "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-sm transition",
              "bg-gradient-to-br from-zinc-950 via-emerald-950 to-emerald-800 hover:brightness-[1.06]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
            ].join(" ")}
            title={expandido ? "Recolher detalhes do evento" : "Ver turmas do evento"}
          >
            {expandido ? (
              <>
                Recolher
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Ver turmas
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {expandido && (
        <div
          id={turmasId}
          className="relative border-t border-zinc-200 bg-zinc-50/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-5 lg:p-6"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-lg font-black text-zinc-950 dark:text-white">
                Turmas e acompanhamento
              </h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Controle de inscritos, presença, assinante e relatórios por turma.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Presença mínima: 75%
            </div>
          </div>

          {Array.isArray(turmas) && turmas.length ? (
            <div className="space-y-6">
              {turmas.map((turma) => {
                const inscritos = asArray(inscritosPorTurma?.[turma.id]);
                const presencas = mapPresencasParaLista(presencasPorTurma, turma.id);

                const elegiveis = presencas.filter(
                  (presenca) => presenca?.elegivel === true
                ).length;

                const pctElegiveis = inscritos.length
                  ? Math.round((elegiveis / inscritos.length) * 100)
                  : 0;

                const assinanteNome = resolveAssinanteNome(turma);
                const organizadores = resolverorganizadoresTurma(turma);

                return (
                  <article
                    key={turma.id}
                    className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <CardTurmaAdministrador
                        turma={turma}
                        inscritos={inscritos}
                        carregarInscritos={carregarInscritos}
                        carregarAvaliacao={carregarAvaliacao}
                        carregarPresencas={carregarPresencas}
                        gerarRelatorioPDF={gerarRelatorioPDF}
                        somenteInfo
                      />
                    </div>

                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-black text-zinc-900 dark:text-white">
                                Equipe da turma
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                organizadores vinculados e assinante oficial.
                              </div>
                            </div>

                            <span
                              className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                              title={assinanteNome || "—"}
                            >
                              Assinante: {assinanteNome || "—"}
                            </span>
                          </div>

                          <InstructorChips organizadores={organizadores} />
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-zinc-900 dark:text-white">
                                Inscritos da turma
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Dados principais, PcD e frequência calculada.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => gerarPdfInscritosTurma?.(turma.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-900 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-green-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                              title="Gerar PDF com dados do curso e lista de inscritos"
                            >
                              <FileDown size={16} aria-hidden="true" />
                              Gerar PDF
                            </button>
                          </div>

                          <InscritosTable
                            inscritos={inscritos}
                            presencasPorTurma={presencasPorTurma}
                            turmaId={turma.id}
                          />
                        </div>
                      </div>

                      <aside className="space-y-3">
                        <MetricCard
                          icon={Users}
                          label="Inscritos"
                          value={inscritos.length}
                          tone="slate"
                        />
                        <MetricCard
                          icon={UserCheck}
                          label="Presentes ≥75%"
                          value={elegiveis}
                          tone="emerald"
                        />
                        <MetricCard
                          icon={BarChart3}
                          label="Presença"
                          value={`${pctElegiveis}%`}
                          tone="sky"
                        />
                      </aside>
                    </div>
                  </article>
                );
              })}
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

MetricCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tone: PropTypes.oneOf(["slate", "emerald", "sky", "amber", "violet"]),
  hint: PropTypes.string,
};

PctPill.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

DeficienciaBadges.propTypes = {
  inscrito: PropTypes.object,
};

EmptyPoster.propTypes = {
  hasUrl: PropTypes.bool,
};

InstructorChips.propTypes = {
  organizadores: PropTypes.array,
};

InscritosTable.propTypes = {
  inscritos: PropTypes.array,
  presencasPorTurma: PropTypes.object,
  turmaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

CardEventoAdministrador.propTypes = {
  evento: PropTypes.object.isRequired,
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
  gerarPdfInscritosTurma: PropTypes.func,
  classNomeEventoMultiLinha: PropTypes.string,
  classorganizadoresMultiLinha: PropTypes.string,
};