// 📁 src/components/CardEventoadministrador.jsx (atualizado)
import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import {
  CalendarDays, Users, Star, BarChart, FileDown,
  Eye, Ear, Accessibility,
} from "lucide-react";
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
  (String(v ?? "").replace(/\D/g, "").slice(0, 11).padStart(11, "0") || "")
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

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
    const starts = turmas.map(t => ymd(t?.data_inicio)).filter(Boolean).map(d => toLocalDateFromYMD(d,"12:00")?.getTime()).filter(Boolean);
    const ends   = turmas.map(t => ymd(t?.data_fim)).filter(Boolean).map(d => toLocalDateFromYMD(d,"12:00")?.getTime()).filter(Boolean);
    if (starts.length && ends.length) {
      const a = new Date(Math.min(...starts)), b = new Date(Math.max(...ends));
      const aY = `${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,"0")}-${String(a.getDate()).padStart(2,"0")}`;
      const bY = `${b.getFullYear()}-${String(b.getMonth()+1).padStart(2,"0")}-${String(b.getDate()).padStart(2,"0")}`;
      return fmt(aY,bY);
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
  let fimDT    = dfAgg ? toLocalDateFromYMD(dfAgg, hfAgg) : null;

  if (!inicioDT || !fimDT) {
    const starts=[], ends=[];
    (turmas||[]).forEach(t=>{
      const di=ymd(t.data_inicio), df=ymd(t.data_fim);
      const hi=onlyHHmm(t.horario_inicio||"00:00"), hf=onlyHHmm(t.horario_fim||"23:59");
      const s = di ? toLocalDateFromYMD(di,hi) : null;
      const e = df ? toLocalDateFromYMD(df,hf) : null;
      if (s) starts.push(s.getTime()); if (e) ends.push(e.getTime());
    });
    if (starts.length) inicioDT = new Date(Math.min(...starts));
    if (ends.length)   fimDT    = new Date(Math.max(...ends));
  }
  if (!inicioDT || !fimDT) return "desconhecido";
  if (agora < inicioDT) return "programado";
  if (agora > fimDT) return "encerrado";
  return "andamento";
}

function pctColorHex(p) {
  if (p >= 90) return "#0284c7";  // sky-600
  if (p >= 76) return "#059669";  // emerald-600
  if (p >= 51) return "#d97706";  // amber-600
  return "#e11d48";               // rose-600
}

function PctPill({ value }) {
  // aceita "25%" ou número; normaliza
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

/* ========================= UI helpers ========================= */
function MiniStat({ value, label, className = "" }) {
  return (
    <div className="min-w-[86px]">
      <div className="inline-flex flex-col items-center justify-center px-3 py-2 rounded-xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-800 dark:border-zinc-600">
        <div className={`leading-none font-extrabold text-2xl ${className}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      </div>
    </div>
  );
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
}) {
  const normalizaArr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.lista) ? v.lista : []);

  // estatísticas do EVENTO (quando expandido)
  const stats = useMemo(() => {
    if (!expandido || !Array.isArray(turmas)) return { totalInscritos:0, totalPresentes:0, presencaMedia:"0", totalAvaliacoes:0, notaMedia:"—" };
    let totalInscritos=0, totalPresentes=0;
    for (const t of turmas) {
      const ins = normalizaArr(inscritosPorTurma?.[t.id]);
      const pres = normalizaArr(presencasPorTurma?.[t.id]);
      totalInscritos += ins.length;
      totalPresentes += pres.filter(p=>p?.presente===true).length;
    }
    const presencaMedia = totalInscritos ? Math.round((totalPresentes/totalInscritos)*100).toString() : "0";
    return { totalInscritos, totalPresentes, presencaMedia, totalAvaliacoes:0, notaMedia:"—" };
  }, [expandido, turmas, inscritosPorTurma, presencasPorTurma]);

  // preload blocos ao expandir
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
    if (Array.isArray(evento.instrutor)) return evento.instrutor.map(i=>i?.nome).filter(Boolean).join(", ") || "—";
    if (typeof evento.instrutor === "object" && evento.instrutor?.nome) return evento.instrutor.nome;
    return "—";
  }, [evento]);

  const statusEvento = getStatusEvento({ evento, turmas });

  return (
    <section className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg mb-6 border border-gray-200 dark:border-zinc-700 transition">
      {/* TOPO */}
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-green-900 dark:text-green-200 truncate" title={evento.titulo}>
            {evento.titulo}
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2 mt-1 mb-1">
            <span className="font-semibold">Instrutor:</span>
            <span className="truncate" title={nomeinstrutor}>{nomeinstrutor}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
            <CalendarDays size={16} aria-hidden="true" />
            {getPeriodoEvento(evento, turmas)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <BadgeStatus status={statusEvento} size="sm" variant="soft" />
          <button
            onClick={() => toggleExpandir(evento.id)}
            aria-expanded={expandido}
            className="text-sm px-4 py-1 bg-green-900 text-white rounded-full hover:bg-green-900/90 transition"
          >
            {expandido ? "Recolher" : "Ver Turmas"}
          </button>
        </div>
      </div>

      {/* STATS + TURMAS */}
      {expandido && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <MiniStat value={stats.totalInscritos} label="inscritos" />
            <MiniStat value={stats.totalPresentes} label="presentes" className="text-emerald-600" />
            <MiniStat value={`${stats.presencaMedia}%`} label="presença média" className="text-sky-600" />
          </div>

          {Array.isArray(turmas) && turmas.length ? (
            <div className="mt-6 space-y-6">
              {turmas.map((turma) => {
                const lista = normalizaArr(inscritosPorTurma?.[turma.id]);
                const pres = normalizaArr(presencasPorTurma?.[turma.id]);
                const presentes = pres.filter(p=>p?.presente===true).length;
                const presMedia = lista.length ? Math.round((presentes/lista.length)*100) : 0;

                return (
                  <div key={turma.id} className="space-y-3">
                    {/* Cabeçalho da turma + ministats */}
                    <CardTurmaadministrador
                      turma={turma}
                      inscritos={lista}
                      carregarInscritos={carregarInscritos}
                      carregarAvaliacoes={carregarAvaliacoes}
                      carregarPresencas={carregarPresencas}
                      gerarRelatorioPDF={gerarRelatorioPDF}
                      somenteInfo
                    />
                    <div className="flex flex-wrap items-center gap-3 px-2">
                      <MiniStat value={lista.length} label="inscritos" />
                      <MiniStat value={presentes} label="presentes" className="text-emerald-600" />
                      <MiniStat value={`${presMedia}%`} label="presença" className="text-sky-600" />
                    </div>

                    {/* Lista de inscritos (tabela responsiva em UMA coluna visual) */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          Inscritos da turma
                        </p>
                        <button
                          onClick={() => gerarPdfInscritosTurma?.(turma.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-900 text-white hover:bg-green-900/90"
                        >
                          <FileDown size={16} /> Gerar PDF (curso + inscritos)
                        </button>
                      </div>

                      {lista.length === 0 ? (
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
                            {lista
                              .slice()
                              .sort((a,b)=>String(a?.nome||"").localeCompare(String(b?.nome||"")))
                              .map((i) => {
                                const cpf = formatarCPF(i?.cpf);
                                // 👇 usa idade do backend se existir; senão calcula localmente
                                const idade = (Number.isFinite(i?.idade) ? i.idade : idadeDe(i?.data_nascimento || i?.nascimento));
                                const registro = i?.registro || i?.matricula || null;

                                const pcdVisual   = !!(i?.pcd_visual || i?.def_visual || i?.deficiencia_visual);
                                const pcdAuditiva = !!(i?.pcd_auditiva || i?.def_auditiva || i?.deficiencia_auditiva || i?.surdo);
                                const pcdFisica   = !!(i?.pcd_fisica || i?.def_fisica || i?.deficiencia_fisica);
                                const pcdIntelect = !!(i?.pcd_intelectual || i?.def_mental || i?.def_intelectual);
                                const pcdMultipla = !!(i?.pcd_multipla || i?.def_multipla);
                                const pcdTEA      = !!(i?.pcd_autismo || i?.tea || i?.transtorno_espectro_autista);

                                const freqStr = pres.find(p =>
                                  (p.usuario_id === i.id || p.usuario_id === i.usuario_id || p.cpf === i.cpf)
                                )?.frequencia; // "25%"

                                return (
                                  <li key={i.id || i.usuario_id || i.cpf} className="py-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_150px_120px_80px_140px_100px] gap-2 sm:gap-3 items-center px-2">
                                      {/* Nome */}
                                      <div className="text-sm text-zinc-900 dark:text-zinc-100">
                                        {i?.nome || "—"}
                                      </div>
                                      {/* CPF */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300 font-mono tabular-nums">
                                        {cpf}
                                      </div>
                                      {/* Registro */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300">
                                        {registro || "—"}
                                      </div>
                                      {/* Idade */}
                                      <div className="text-sm text-zinc-600 dark:text-zinc-300">
                                        {Number.isFinite(idade) ? `${idade}` : "—"}
                                      </div>
                                      {/* PcD */}
                                      <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
                                        {pcdVisual   && <Eye size={16} title="Deficiência visual" />}
                                        {pcdAuditiva && <Ear size={16} title="Deficiência auditiva" />}
                                        {pcdFisica   && <Accessibility size={16} title="Deficiência física/motora" />}
                                        {pcdIntelect && <span title="Deficiência intelectual/mental" role="img" aria-label="Deficiência intelectual">🧠</span>}
                                        {pcdMultipla && <span title="Deficiência múltipla" role="img" aria-label="Deficiência múltipla">🔗</span>}
                                        {pcdTEA      && <span title="TEA" role="img" aria-label="autismo">🧩</span>}
                                        {!pcdVisual && !pcdAuditiva && !pcdFisica && !pcdIntelect && !pcdMultipla && !pcdTEA && (
                                          <span className="text-zinc-400">—</span>
                                        )}
                                      </div>
                                      {/* Frequência */}
                                      <div className="sm:text-right">
                                        {freqStr ? <PctPill value={freqStr} /> : <span className="text-zinc-400 text-sm">—</span>}
                                      </div>
                                    </div>

                                    {/* Mobile meta abaixo do nome */}
                                    <div className="sm:hidden mt-1 pl-2 text-[12px] text-zinc-600 dark:text-zinc-300">
                                      <span className="mr-2">CPF: {cpf}</span>
                                      {registro && <span className="mr-2">Reg.: {registro}</span>}
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
    <div className="bg-white dark:bg-zinc-700 rounded-xl p-4 flex flex-col items-start shadow border border-gray-200 dark:border-zinc-600" title={title || label}>
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
};
