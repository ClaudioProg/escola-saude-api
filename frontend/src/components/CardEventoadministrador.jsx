// 📁 src/components/CardEventoadministrador.jsx
import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import { CalendarDays, FileDown, Eye, Ear, Accessibility } from "lucide-react";
import BadgeStatus from "./BadgeStatus";
import CardTurmaadministrador from "./CardTurmaadministrador";
import { idadeDe } from "../utils/data";

/* ========================= Helpers ========================= */
const isDateOnly = (str) => typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const onlyHHmm = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const toLocalDateFromYMD = (ymdStr, hhmm = "12:00") =>
  ymdStr ? new Date(`${ymdStr}T${(hhmm || "12:00").slice(0, 5)}:00`) : null;

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [Y, M, D] = input.split("-").map(Number);
      return new Date(Y, M - 1, D);
    }
    return new Date(input);
  }
  return new Date(input);
}
function formatarDataLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
}
const formatarCPF = (v) =>
  (String(v ?? "").replace(/\D/g, "").slice(0, 11).padStart(11, "0") || "").replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );

// Normaliza lista (aceita array direto ou objeto { lista: [] })
const normalizaArr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.lista) ? v.lista : []);

/* ===== período & status do evento (anti-fuso) ===== */
function getPeriodoEvento(evento, turmas) {
  const diAggY = ymd(evento?.data_inicio_geral);
  const dfAggY = ymd(evento?.data_fim_geral);
  const fmt = (iniY, fimY) => {
    if (!iniY || !fimY) return "Período não informado";
    const a = toLocalDateFromYMD(iniY, "12:00");
    const b = toLocalDateFromYMD(fimY, "12:00");
    if (!a || !b || isNaN(a) || isNaN(b)) return "Período não informado";
    const same = a.toDateString() === b.toDateString();
    return same ? formatarDataLocal(a) : `${formatarDataLocal(a)} até ${formatarDataLocal(b)}`;
  };
  if (diAggY && dfAggY) return fmt(diAggY, dfAggY);

  if (Array.isArray(turmas) && turmas.length) {
    const starts = turmas
      .map((t) => ymd(t?.data_inicio))
      .filter(Boolean)
      .map((d) => toLocalDateFromYMD(d, "12:00")?.getTime())
      .filter(Boolean);
    const ends = turmas
      .map((t) => ymd(t?.data_fim))
      .filter(Boolean)
      .map((d) => toLocalDateFromYMD(d, "12:00")?.getTime())
      .filter(Boolean);
    if (starts.length && ends.length) {
      const a = new Date(Math.min(...starts));
      const b = new Date(Math.max(...ends));
      const aY = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(
        a.getDate()
      ).padStart(2, "0")}`;
      const bY = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(
        b.getDate()
      ).padStart(2, "0")}`;
      return fmt(aY, bY);
    }
  }
  return "Período não informado";
}

function getStatusEvento({ evento, turmas }) {
  const agora = new Date();
  const diAgg = ymd(evento?.data_inicio_geral);
  const dfAgg = ymd(evento?.data_fim_geral);
  const hiAgg = onlyHHmm(evento?.horario_inicio_geral || "00:00");
  const hfAgg = onlyHHmm(evento?.horario_fim_geral || "23:59");
  let inicioDT = diAgg ? toLocalDateFromYMD(diAgg, hiAgg) : null;
  let fimDT = dfAgg ? toLocalDateFromYMD(dfAgg, hfAgg) : null;

  if (!inicioDT || !fimDT) {
    const starts = [];
    const ends = [];
    (turmas || []).forEach((t) => {
      const di = ymd(t.data_inicio),
        df = ymd(t.data_fim);
      const hi = onlyHHmm(t.horario_inicio || "00:00"),
        hf = onlyHHmm(t.horario_fim || "23:59");
      const s = di ? toLocalDateFromYMD(di, hi) : null;
      const e = df ? toLocalDateFromYMD(df, hf) : null;
      if (s) starts.push(s.getTime());
      if (e) ends.push(e.getTime());
    });
    if (starts.length) inicioDT = new Date(Math.min(...starts));
    if (ends.length) fimDT = new Date(Math.max(...ends));
  }
  if (!inicioDT || !fimDT) return "todos"; // fallback neutro
  if (agora < inicioDT) return "programado";
  if (agora > fimDT) return "encerrado";
  return "em_andamento";
}

/* ===== presença visual ===== */
function pctColorHex(p) {
  if (p >= 90) return "#0284c7"; // sky-600
  if (p >= 76) return "#059669"; // emerald-600
  if (p >= 51) return "#d97706"; // amber-600
  return "#e11d48"; // rose-600
}
function PctPill({ value }) {
  const n = typeof value === "string" ? parseInt(value.replace(/\D/g, ""), 10) : Number(value || 0);
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const color = pctColorHex(pct);
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold"
      style={{ color, background: "rgba(2, 8, 23, 0.03)", border: `1px solid ${color}20` }}
      title={`${pct}% de presença`}
    >
      {pct}%
    </span>
  );
}

/* ===== Regra dinâmica ≥75% sobre encontros ocorridos ===== */
function isElegivel75(u, resumo) {
  const total =
    typeof u?.total_ocorridos === "number" ? u.total_ocorridos : resumo?.encontrosOcorridos ?? 0;
  if (total <= 0) return false;

  if (typeof u?.presentes_ocorridos === "number") {
    return u.presentes_ocorridos / total >= 0.75 - 1e-9;
  }
  const n =
    typeof u?.frequencia_num === "number"
      ? u.frequencia_num
      : parseInt(String(u?.frequencia || "0").replace(/\D/g, ""), 10) || 0;
  return n >= 75;
}

/* ===== Constrói visão uniforme de presenças por turma ===== */
function mapPresencasParaLista(presencasPorTurma, turmaId) {
  const raw = presencasPorTurma?.[turmaId];
  const resumo = raw?.resumo || raw?.detalhado?.resumo || {};

  const coerceFreqNum = (u) => {
    if (typeof u?.frequencia_num === "number") return u.frequencia_num;
    const parsed = parseInt(String(u?.frequencia || "").replace(/\D/g, ""), 10);
    if (!Number.isNaN(parsed)) return parsed;
    const totalOc = u?.total_ocorridos ?? resumo?.encontrosOcorridos ?? 0;
    const presOc =
      u?.presentes_ocorridos ??
      (Array.isArray(u?.presencas) ? u.presencas.filter((p) => p?.presente).length : 0);
    return totalOc > 0 ? Math.round((presOc / totalOc) * 100) : 0;
  };

  const normalizeOne = (u) => {
    const id = u?.usuario_id ?? u?.id ?? null;
    if (!id) return null;
    const freqNum = coerceFreqNum(u);

    const elegivel =
      typeof u?.elegivel === "boolean" ? u.elegivel : isElegivel75({ ...u, frequencia_num: freqNum }, resumo);

    return {
      usuario_id: id,
      cpf: u?.cpf,
      frequencia_num: freqNum,
      frequencia: `${freqNum}%`,
      elegivel,
      presente: elegivel, // espelha ≥75%
    };
  };

  // Caso 1: já seja array simples
  if (Array.isArray(raw)) return raw.map(normalizeOne).filter(Boolean);

  // Caso 2: objeto com lista
  const lista = normalizaArr(raw);
  if (lista.length) return lista.map(normalizeOne).filter(Boolean);

  // Caso 3: estruturas alternativas (usuarios/users)
  const arrUsuarios = Array.isArray(raw?.usuarios)
    ? raw.usuarios
    : Array.isArray(raw?.users)
    ? raw.users
    : [];
  return arrUsuarios.map(normalizeOne).filter(Boolean);
}

/* ===== Barrinha/cores por status ===== */
const STATUS_STYLES = {
  programado: { bar: "from-emerald-600 via-emerald-500 to-emerald-400" },
  em_andamento: { bar: "from-amber-600 via-amber-500 to-amber-400" },
  encerrado: { bar: "from-rose-600 via-rose-500 to-rose-400" },
  todos: { bar: "from-indigo-500 via-fuchsia-500 to-pink-500" },
};

/* ========================= UI helpers ========================= */
function MiniStat({ value, label, className = "" }) {
  return (
    <div className="min-w-[86px]">
      <div className="inline-flex flex-col items-center justify-center px-3 py-2 rounded-xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-800 dark:border-zinc-600">
        <div className={`leading-none font-extrabold text-2xl ${className}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
      </div>
    </div>
  );
}

/* ===== Resolve nome do assinante por turma ===== */
function resolveAssinanteNome(turma, evento) {
  // 0) se o backend já mandou o objeto pronto
  if (turma?.instrutor_assinante?.nome) return turma.instrutor_assinante.nome;

  // 1) nome direto (legado) — mantém por compat
  if (turma?.assinante_nome) return turma.assinante_nome;

  // 2) id novo (oficial)
  const assinanteId = Number(turma?.instrutor_assinante_id ?? turma?.assinante_id /* compat */);
  if (!Number.isFinite(assinanteId)) return null;

  // 3) procurar na própria turma
  const turInstr = Array.isArray(turma?.instrutores) ? turma.instrutores : [];
  for (const it of turInstr) {
    const id = Number(it?.id ?? it);
    const nome = typeof it === "object" ? it?.nome : null;
    if (id === assinanteId) return nome || null;
  }

  // 4) fallback: procurar na lista do evento
  const evInstr = Array.isArray(evento?.instrutor) ? evento.instrutor : [];
  for (const it of evInstr) {
    const id = Number(it?.id ?? it);
    const nome = typeof it === "object" ? it?.nome : null;
    if (id === assinanteId) return nome || null;
  }

  return null;
}

/* ===== Lista uniforme de instrutores da turma (para os chips) ===== */
function resolverInstrutoresTurma(turma) {
  if (!turma) return [];
  const toObj = (x) =>
    typeof x === "object" && x ? { id: Number(x.id), nome: x.nome ?? null } : { id: Number(x), nome: null };

  const arrRaw = Array.isArray(turma?.instrutores)
    ? turma.instrutores
    : Array.isArray(turma?.instrutor)
    ? turma.instrutor
    : turma?.instrutor != null
    ? [turma.instrutor]
    : [];

  const list = arrRaw.map(toObj).filter((i) => Number.isFinite(i.id));
  const seen = new Set();
  const out = [];
  for (const i of list) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    out.push({ id: i.id, nome: i.nome && String(i.nome).trim() ? String(i.nome).trim() : `ID ${i.id}` });
  }
  return out;
}

/* ========================= Componente ========================= */
export default function CardEventoadministrador({
  evento,
  expandido,
  toggleExpandir,
  turmas,
  carregarInscritos,
  inscritosPorTurma,
  carregarAvaliacoes,
  avaliacoesPorTurma,
  presencasPorTurma,
  carregarPresencas,
  gerarRelatorioPDF,
  gerarPdfInscritosTurma,
  classNomeEventoMultiLinha,
  classInstrutoresMultiLinha,
}) {
  // ===== Estatísticas do EVENTO (usando regra ≥ 75% dinâmica)
  const stats = useMemo(() => {
    if (!expandido || !Array.isArray(turmas) || !turmas.length) {
      return { totalInscritos: 0, totalPresentes: 0, presencaMedia: "0" };
    }
    let totalInscritos = 0;
    let totalElegiveis = 0;

    for (const t of turmas) {
      const inscritos = normalizaArr(inscritosPorTurma?.[t.id]);
      const presencas = mapPresencasParaLista(presencasPorTurma, t.id);

      totalInscritos += inscritos.length;
      totalElegiveis += presencas.filter((p) => p?.elegivel === true || p?.presente === true).length;
    }

    const presencaMedia = totalInscritos
      ? Math.round((totalElegiveis / totalInscritos) * 100).toString()
      : "0";

    return { totalInscritos, totalPresentes: totalElegiveis, presencaMedia };
  }, [expandido, turmas, inscritosPorTurma, presencasPorTurma]);

  // ===== Preload blocos ao expandir
  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos?.(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas?.(turma.id);
      if (!avaliacoesPorTurma?.[turma.id]) carregarAvaliacoes?.(turma.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, turmas]);

  const nomeinstrutor = useMemo(() => {
    if (Array.isArray(evento.instrutor))
      return evento.instrutor.map((i) => i?.nome).filter(Boolean).join(", ") || "—";
    if (typeof evento.instrutor === "object" && evento.instrutor?.nome) return evento.instrutor.nome;
    return "—";
  }, [evento]);

  const tituloEvento = evento?.titulo || evento?.nome || "—";

  const statusEvento = getStatusEvento({ evento, turmas });
  const styles = STATUS_STYLES[statusEvento] || STATUS_STYLES.todos;

  const nomeEventoClass =
    classNomeEventoMultiLinha ||
    "break-words whitespace-normal text-xl font-bold text-green-900 dark:text-green-200 leading-snug";
  const instrutoresClass =
    classInstrutoresMultiLinha ||
    "break-words whitespace-normal text-sm text-gray-700 dark:text-gray-200 leading-snug";

  const turmasId = `admin-evt-${evento?.id}-turmas`;

  return (
    <section
      className="relative overflow-hidden bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 transition"
      aria-label={`Evento: ${tituloEvento}`}
    >
      {/* 🔹 barrinha degradê superior (3 cores) */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${styles.bar}`} />

      {/* TOPO */}
      <div className="flex justify-between items-start gap-4 min-w-0">
        {/* bloco da esquerda */}
        <div className="min-w-0 flex-1">
          {/* Título do evento - AGORA QUEBRA LINHA */}
          <h3 className={nomeEventoClass + " min-w-0"} title={tituloEvento}>
            {tituloEvento}
          </h3>

          {/* Instrutor - AGORA QUEBRA LINHA */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-y-0.5 gap-x-2 mt-2 mb-1 min-w-0">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 shrink-0">
              Instrutor:
            </span>
            <span className={instrutoresClass + " flex-1 min-w-0"} title={nomeinstrutor}>
              {nomeinstrutor}
            </span>
          </div>

          {/* Período */}
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5 break-words whitespace-normal leading-snug">
            <CalendarDays size={16} aria-hidden="true" />
            {getPeriodoEvento(evento, turmas)}
          </p>
        </div>

        {/* bloco da direita */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <BadgeStatus status={statusEvento} size="sm" variant="soft" />
          <button
            type="button"
            onClick={() => toggleExpandir(evento.id)}
            aria-expanded={!!expandido}
            aria-controls={turmasId}
            className="text-sm px-4 py-1 bg-green-900 text-white rounded-full hover:bg-green-900/90 transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500/60"
            title={expandido ? "Recolher detalhes do evento" : "Ver turmas do evento"}
          >
            {expandido ? "Recolher" : "Ver Turmas"}
          </button>
        </div>
      </div>

      {/* STATS + TURMAS */}
      {expandido && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>

          {/* indicativos do evento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <MiniStat value={stats.totalInscritos} label="inscritos" />
            <MiniStat value={stats.totalPresentes} label="presentes (≥75%)" className="text-emerald-600" />
            <MiniStat value={`${stats.presencaMedia}%`} label="presença média (≥75%)" className="text-sky-600" />
          </div>

          {Array.isArray(turmas) && turmas.length ? (
            <div id={turmasId} className="mt-6 space-y-6">
              {turmas.map((turma) => {
                const inscritos = normalizaArr(inscritosPorTurma?.[turma.id]);
                const presencas = mapPresencasParaLista(presencasPorTurma, turma.id);

                const elegiveis = presencas.filter((p) => p?.elegivel === true || p?.presente === true).length;
                const pctElegiveis = inscritos.length ? Math.round((elegiveis / inscritos.length) * 100) : 0;

                const assinanteNome = resolveAssinanteNome(turma, evento);
                const instrutores = resolverInstrutoresTurma(turma);

                return (
                  <div key={turma.id} className="space-y-3">
                    {/* Cabeçalho da turma */}
                    <CardTurmaadministrador
                      turma={turma}
                      inscritos={inscritos}
                      carregarInscritos={carregarInscritos}
                      carregarAvaliacoes={carregarAvaliacoes}
                      carregarPresencas={carregarPresencas}
                      gerarRelatorioPDF={gerarRelatorioPDF}
                      somenteInfo
                    />

                    {/* 🧾 Assinante e chips de instrutores */}
                    <div className="px-2 -mt-1">
                      {/* Assinante */}
                      <div className="text-[12px]">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200 mr-2">Assinante:</span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800"
                          title={assinanteNome || "—"}
                        >
                          {assinanteNome || "—"}
                        </span>
                      </div>

                      {/* Chips de instrutores (se houver) */}
                      {instrutores.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {instrutores.map((ins) => (
                            <span
                              key={ins.id}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[12px] font-medium
                                         bg-indigo-50 text-indigo-700 border border-indigo-200
                                         dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800"
                              title={ins.nome}
                            >
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-300" aria-hidden />
                              {ins.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ministats da turma */}
                    <div className="flex flex-wrap items-center gap-3 px-2">
                      <MiniStat value={inscritos.length} label="inscritos" />
                      <MiniStat value={elegiveis} label="presentes (≥75%)" className="text-emerald-600" />
                      <MiniStat value={`${pctElegiveis}%`} label="presença (≥75%)" className="text-sky-600" />
                    </div>

                    {/* Lista de inscritos */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Inscritos da turma</p>
                        <button
                          type="button"
                          onClick={() => gerarPdfInscritosTurma?.(turma.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-900 text-white hover:bg-green-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500/60"
                          title="Gerar PDF com dados do curso e lista de inscritos"
                        >
                          <FileDown size={16} />
                          <span className="whitespace-nowrap">Gerar PDF (curso + inscritos)</span>
                        </button>
                      </div>

                      {inscritos.length === 0 ? (
                        <p className="text-xs text-zinc-500 mt-2">Nenhum inscrito.</p>
                      ) : (
                        <div className="mt-3 w-full overflow-x-auto">
                          {/* Cabeçalho (sm+) */}
                          <div className="hidden sm:grid grid-cols-[minmax(220px,1fr)_150px_120px_80px_140px_100px] gap-3 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
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
                              .sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || "")))
                              .map((i) => {
                                const cpf = formatarCPF(i?.cpf);
                                const idade = Number.isFinite(i?.idade)
                                  ? i.idade
                                  : idadeDe(i?.data_nascimento || i?.nascimento);
                                const registro = i?.registro || i?.matricula || null;

                                const pcdVisual = !!(i?.pcd_visual || i?.def_visual || i?.deficiencia_visual);
                                const pcdAuditiva = !!(
                                  i?.pcd_auditiva || i?.def_auditiva || i?.deficiencia_auditiva || i?.surdo
                                );
                                const pcdFisica = !!(i?.pcd_fisica || i?.def_fisica || i?.deficiencia_fisica);
                                const pcdIntelect = !!(i?.pcd_intelectual || i?.def_mental || i?.def_intelectual);
                                const pcdMultipla = !!(i?.pcd_multipla || i?.def_multipla);
                                const pcdTEA = !!(i?.pcd_autismo || i?.tea || i?.transtorno_espectro_autista);

                                const presAluno = mapPresencasParaLista(presencasPorTurma, turma.id).find(
                                  (p) => p.usuario_id === i.id || p.usuario_id === i.usuario_id || p.cpf === i.cpf
                                );
                                const freqStr =
                                  presAluno?.frequencia_num != null
                                    ? `${presAluno.frequencia_num}%`
                                    : presAluno?.frequencia || null;

                                return (
                                  <li key={i.id || i.usuario_id || i.cpf} className="py-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_150px_120px_80px_140px_100px] gap-2 sm:gap-3 items-center px-2">
                                      {/* Nome */}
                                      <div className="text-sm text-zinc-900 dark:text-zinc-100 break-words whitespace-normal leading-snug">
                                        {i?.nome || "—"}
                                      </div>

                                      {/* CPF */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300 font-mono tabular-nums">
                                        {cpf}
                                      </div>

                                      {/* Registro */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300 break-words whitespace-normal leading-snug">
                                        {registro || "—"}
                                      </div>

                                      {/* Idade */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300">
                                        {Number.isFinite(idade) ? `${idade}` : "—"}
                                      </div>

                                      {/* PcD */}
                                      <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-200 flex-wrap text-sm leading-snug">
                                        {pcdVisual && <Eye size={16} title="Deficiência visual" />}
                                        {pcdAuditiva && <Ear size={16} title="Deficiência auditiva" />}
                                        {pcdFisica && <Accessibility size={16} title="Deficiência física/motora" />}
                                        {pcdIntelect && (
                                          <span title="Deficiência intelectual/mental" role="img" aria-label="Deficiência intelectual">
                                            🧠
                                          </span>
                                        )}
                                        {pcdMultipla && (
                                          <span title="Deficiência múltipla" role="img" aria-label="Deficiência múltipla">
                                            🔗
                                          </span>
                                        )}
                                        {pcdTEA && (
                                          <span title="TEA" role="img" aria-label="autismo">
                                            🧩
                                          </span>
                                        )}
                                        {!pcdVisual &&
                                          !pcdAuditiva &&
                                          !pcdFisica &&
                                          !pcdIntelect &&
                                          !pcdMultipla &&
                                          !pcdTEA && <span className="text-zinc-400">—</span>}
                                      </div>

                                      {/* Frequência */}
                                      <div className="sm:text-right">
                                        {freqStr ? (
                                          <PctPill value={freqStr} />
                                        ) : (
                                          <span className="text-zinc-400 text-sm">—</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Mobile meta abaixo do nome */}
                                    <div className="sm:hidden mt-1 pl-2 text-[12px] text-zinc-600 dark:text-zinc-300 flex flex-wrap gap-x-2 gap-y-1 leading-snug break-words whitespace-normal">
                                      <span>CPF: {cpf}</span>
                                      {registro && <span>Reg.: {registro}</span>}
                                      {Number.isFinite(idade) && <span>Idade: {idade}</span>}
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-300 mt-4">Nenhuma turma cadastrada.</div>
          )}
        </>
      )}
    </section>
  );
}

/* ========================= UI: Stat Card (mantido p/ topo) ========================= */
function StatCard({ icon, label, value, title }) {
  return (
    <div
      className="bg-white dark:bg-zinc-700 rounded-xl p-4 flex flex-col items-start shadow border border-gray-200 dark:border-zinc-600"
      title={title || label}
    >
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-xl font-bold text-green-900 dark:text-green-200">{value}</div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
};

CardEventoadministrador.propTypes = {
  evento: PropTypes.object.isRequired,
  expandido: PropTypes.bool,
  toggleExpandir: PropTypes.func.isRequired,
  turmas: PropTypes.array,
  carregarInscritos: PropTypes.func,
  inscritosPorTurma: PropTypes.object,
  carregarAvaliacoes: PropTypes.func,
  avaliacoesPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  gerarPdfInscritosTurma: PropTypes.func,
  classNomeEventoMultiLinha: PropTypes.string,
  classInstrutoresMultiLinha: PropTypes.string,
};
