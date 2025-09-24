// ✅ src/components/TurmasInstrutor.jsx (abas por DATA + ministats por dia)
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import AvaliacoesEvento from "./AvaliacoesEvento";
import { toast } from "react-toastify";
import { apiPatch, apiPost } from "../services/api";
import { formatarCPF } from "../utils/data";
import {
  Users,
  Star,
  FileText,
  QrCode,
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

/* ===== Helpers ===== */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const hojeYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
const toLocalDateFromYMDTime = (dateOnly, timeHHmm = "12:00") =>
  dateOnly ? new Date(`${dateOnly}T${(hhmm(timeHHmm) || "12:00")}:00`) : null;

function statusFromTurma(t) {
  const di = ymd(t?.data_inicio);
  const df = ymd(t?.data_fim);
  if (!di || !df) return "programado";
  const hoje = hojeYMD();
  if (di > hoje) return "programado";
  if (di <= hoje && df >= hoje) return "andamento";
  return "encerrado";
}

/** Abre 60min após início; fecha 48h após término do dia */
function dentroDaJanelaConfirmacao(dataYMD, hIni = "00:00", hFim = "23:59") {
  if (!dataYMD) return false;
  const start = toLocalDateFromYMDTime(dataYMD, hhmm(hIni) || "00:00");
  const end = toLocalDateFromYMDTime(dataYMD, hhmm(hFim) || "23:59");
  if (!start || !end || Number.isNaN(start) || Number.isNaN(end)) return false;
  const abre = new Date(start.getTime() + 60 * 60 * 1000); // +60min
  const fecha = new Date(end.getTime() + 48 * 60 * 60 * 1000); // +48h
  const now = new Date();
  return now >= abre && now <= fecha;
}

/* Chips de status */
const CHIP_STYLES = {
  programado:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800",
  andamento:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
  encerrado:
    "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800",
};
const CHIP_TEXT = { programado: "Programado", andamento: "Em andamento", encerrado: "Encerrado" };

/* Badges */
const Badge = ({ children, kind = "waiting" }) => {
  const cls =
    kind === "ok"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-600/30 dark:text-emerald-300"
      : kind === "absent"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-600/30 dark:text-rose-200"
      : "bg-amber-100 text-amber-700 dark:bg-amber-600/30 dark:text-amber-200";
  return <span className={`px-2.5 py-[2px] text-xs font-semibold rounded-full ${cls}`}>{children}</span>;
};

/* Mini-stat (número grande + rótulo pequeno) */
function pctColor(p) {
  if (p >= 90) return "text-sky-600 dark:text-sky-400";
  if (p >= 76) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 51) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
const MiniStat = ({ number, label, className = "" }) => (
  <div className="min-w-[64px] text-right">
    <div className={`leading-none font-extrabold text-2xl sm:text-3xl ${className}`}>{number}</div>
    <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
  </div>
);

export default function TurmasInstrutor({
  turmas,
  inscritosPorTurma,
  avaliacoesPorTurma,
  presencasPorTurma,
  onVerInscritos,
  onVerAvaliacoes,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  token,
  carregarPresencas,
  carregando = false,
  turmaExpandidaInscritos,
  setTurmaExpandidaInscritos,
  turmaExpandidaAvaliacoes,
  setTurmaExpandidaAvaliacoes,
  datasPorTurma = {},
  carregarDatasPorTurma,
  className = "",
}) {
  const [abrindo, setAbrindo] = useState(null);
  const [dataAtivaPorTurma, setDataAtivaPorTurma] = useState({}); // { [turmaId]: "YYYY-MM-DD" }

  // Agrupar por evento
  const eventosAgrupados = useMemo(() => {
    const out = {};
    for (const t of turmas || []) {
      if (!t || !t.id || !t.evento?.id) continue;
      const eventoId = String(t.evento.id);
      const eventoNome = t.evento.nome || t.evento.titulo || "Evento";
      const eventoLocal = t.local || t.evento.local || "";
      if (!out[eventoId]) out[eventoId] = { nome: eventoNome, local: eventoLocal, turmas: [] };
      out[eventoId].turmas.push(t);
    }
    return out;
  }, [turmas]);

  // confirmação manual
  async function confirmarPresencaManual(usuarioId, turmaId, dataReferencia) {
    const dataYMD = String(dataReferencia).slice(0, 10);
    const payload = { usuario_id: Number(usuarioId), turma_id: Number(turmaId), data: dataYMD, data_presenca: dataYMD };
    const tentativas = [
      { fn: apiPost, url: "/api/presencas/confirmarPresencaInstrutor" },
      { fn: apiPost, url: "/api/presencas/confirmar" },
      { fn: apiPatch, url: "/api/presencas/confirmar" },
      { fn: apiPost, url: "/api/presencas/confirmar-manual" },
      { fn: apiPost, url: "/api/presencas/confirmar_presenca" },
    ];
    let ultimoErro = null;
    try {
      setAbrindo(`${usuarioId}-${turmaId}-${dataYMD}`);
      for (const t of tentativas) {
        try {
          await t.fn(t.url, payload, { on403: "silent" });
          toast.success("✅ Presença confirmada!");
          await carregarPresencas?.(turmaId);
          return;
        } catch (err) {
          const status = err?.status || err?.response?.status;
          if (status !== 404) {
            const data = err?.data || err?.response?.data;
            toast.error(`❌ ${data?.erro || data?.message || err?.message || "Erro ao confirmar presença."}`);
            return;
          }
          ultimoErro = err;
        }
      }
      console.error("Nenhuma rota de confirmação encontrada.", ultimoErro);
      toast.error("❌ Rota não encontrada para confirmar presença. Verifique o backend.");
    } finally {
      setAbrindo(null);
    }
  }

  if (carregando) {
    return (
      <ul className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <li key={i} className="p-8 bg-gray-100 dark:bg-zinc-700 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  return (
    <ul className={`space-y-6 ${className}`}>
      <AnimatePresence>
        {Object.entries(eventosAgrupados).map(([eventoId, evento]) => (
          <motion.li
            key={eventoId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm"
            aria-label={`Evento: ${evento.nome}`}
          >
            {/* Cabeçalho evento */}
            <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-600 text-white px-4 sm:px-5 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <h3 className="text-base sm:text-lg font-semibold truncate">{evento.nome}</h3>
                {evento.local && (
                  <div className="flex items-center gap-1 text-xs sm:text-[13px] opacity-95">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span className="truncate">{evento.local}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Turmas */}
            <div className="p-4 sm:p-5 space-y-5">
              {evento.turmas.map((turma) => {
                const idSeguro = Number(turma.id);
                if (Number.isNaN(idSeguro)) return null;

                const expandindoInscritos = turmaExpandidaInscritos === idSeguro;
                const expandindoAvaliacoes = turmaExpandidaAvaliacoes === idSeguro;

                const st = statusFromTurma(turma);
                const chipCls = `inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${CHIP_STYLES[st]}`;

                // Datas reais
                const datasReais =
                  (Array.isArray(datasPorTurma[idSeguro]) && datasPorTurma[idSeguro].length
                    ? datasPorTurma[idSeguro]
                    : null) ??
                  (Array.isArray(turma?.datas) && turma.datas.length ? turma.datas : null) ??
                  presencasPorTurma[idSeguro]?.detalhado?.datas ??
                  [];

                const datas = (datasReais || [])
                  .map((d) => {
                    const dataYMD = ymd(d?.data) || ymd(d);
                    return dataYMD
                      ? {
                          data: dataYMD,
                          horario_inicio: hhmm(d?.horario_inicio) || hhmm(turma?.horario_inicio),
                          horario_fim: hhmm(d?.horario_fim) || hhmm(turma?.horario_fim),
                        }
                      : null;
                  })
                  .filter(Boolean);

                const dataAtiva = dataAtivaPorTurma[idSeguro] || (datas[0]?.data ?? null);

                return (
                  <section
                    key={idSeguro}
                    className="rounded-xl ring-1 ring-gray-200 dark:ring-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30"
                  >
                    {/* Info + chips */}
                    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-lousa dark:text-white truncate">
                          Turma: {turma.nome || `Turma ${turma.id}`}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          {turma?.data_inicio && turma?.data_fim && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {ymd(turma.data_inicio).split("-").reverse().join("/")} →{" "}
                              {ymd(turma.data_fim).split("-").reverse().join("/")}
                            </span>
                          )}
                          {(turma?.horario_inicio || turma?.horario_fim) && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {hhmm(turma.horario_inicio)}–{hhmm(turma.horario_fim)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={chipCls}>• {CHIP_TEXT[st]}</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          onVerInscritos?.(idSeguro);
                          carregarPresencas?.(idSeguro);
                          carregarDatasPorTurma?.(idSeguro);
                          if (!expandindoInscritos && datas.length > 0) {
                            setDataAtivaPorTurma((p) => ({ ...p, [idSeguro]: datas[0].data }));
                          }
                          setTurmaExpandidaInscritos(expandindoInscritos ? null : idSeguro);
                          setTurmaExpandidaAvaliacoes(null);
                        }}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/40"
                      >
                        <Users className="w-4 h-4" /> Ver inscritos
                      </button>

                      <button
                        onClick={() => {
                          onVerAvaliacoes?.(idSeguro);
                          setTurmaExpandidaAvaliacoes(expandindoAvaliacoes ? null : idSeguro);
                          setTurmaExpandidaInscritos(null);
                        }}
                        className="inline-flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-700/40"
                      >
                        <Star className="w-4 h-4" /> Avaliações
                      </button>

                      <button
                        onClick={() => onExportarListaAssinaturaPDF?.(idSeguro)}
                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700/40"
                      >
                        <FileText className="w-4 h-4" /> Lista de Presença
                      </button>

                      <button
                        onClick={() => onExportarQrCodePDF?.(idSeguro, evento.nome)}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/40"
                      >
                        <QrCode className="w-4 h-4" /> QR Code de Presença
                      </button>
                    </div>

                    {/* Painel: Inscritos — ABAS POR DATA + MINISTATS */}
                    <AnimatePresence>
                      {expandindoInscritos && (
                        <motion.div
                          id={`painel-inscritos-${idSeguro}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden px-4 pb-4"
                        >
                          {(() => {
                            const alunos = inscritosPorTurma[idSeguro] || [];
                            const det = presencasPorTurma[idSeguro]?.detalhado || { datas: [], usuarios: [] };
                            if (!alunos.length) {
                              return <p className="text-sm text-gray-600 italic dark:text-gray-300">Nenhum inscrito nesta turma.</p>;
                            }

                            // mapa de usuários/presenças
                            const mapaUsuarios = new Map();
                            for (const a of alunos) {
                              const uid = a?.usuario_id ?? a?.id;
                              if (!uid) continue;
                              mapaUsuarios.set(uid, { id: uid, nome: a?.nome || "—", cpf: a?.cpf || "", presencas: new Map() });
                            }
                            for (const u of (det.usuarios || [])) {
                              const uid = u?.id ?? u?.usuario_id;
                              if (!uid || !mapaUsuarios.has(uid)) continue;
                              const alvo = mapaUsuarios.get(uid);
                              (u.presencas || []).forEach((p) => {
                                const d = ymd(p?.data_presenca || p?.data);
                                if (d) alvo.presencas.set(d, !!p?.presente);
                              });
                            }

                            if (!datas.length) {
                              return <p className="text-sm text-gray-600 italic dark:text-gray-300">Nenhuma data registrada para esta turma.</p>;
                            }

                            // tabs de datas
                            return (
                              <div className="space-y-4">
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {datas.map((d) => {
                                    const active = (dataAtivaPorTurma[idSeguro] || datas[0].data) === d.data;
                                    return (
                                      <button
                                        key={d.data}
                                        type="button"
                                        onClick={() => setDataAtivaPorTurma((p) => ({ ...p, [idSeguro]: d.data }))}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                                          ${active ? "bg-violet-700 text-white border-violet-700" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                        aria-pressed={active}
                                      >
                                        {d.data.split("-").reverse().join("/")} · {d.horario_inicio}–{d.horario_fim}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Tabela da data ativa + MINISTATS */}
                                {(() => {
                                  const d = datas.find((x) => x.data === (dataAtivaPorTurma[idSeguro] || datas[0].data)) || datas[0];
                                  if (!d) return null;

                                  const inicioDia = toLocalDateFromYMDTime(d.data, d.horario_inicio);
                                  const abreJanela = inicioDia ? new Date(inicioDia.getTime() + 60 * 60 * 1000) : null;
                                  const now = new Date();
                                  const antesDaJanela = abreJanela ? now < abreJanela : true;

                                  // === RESUMO (inscritos/presentes/faltas/%)
                                  const totalInscritos = mapaUsuarios.size;
                                  let presentes = 0, faltas = 0;
                                  for (const u of mapaUsuarios.values()) {
                                    const pr = !!u.presencas.get(d.data);
                                    if (pr) presentes += 1;
                                    else if (!antesDaJanela) faltas += 1; // virou falta ao passar +1h
                                  }
                                  const pct = totalInscritos > 0 ? Math.round((presentes / totalInscritos) * 100) : 0;

                                  return (
                                    <section
                                      key={d.data}
                                      className="rounded-xl bg-white dark:bg-zinc-900/40 ring-1 ring-zinc-200 dark:ring-zinc-800"
                                    >
                                      <header className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="flex items-center gap-3">
                                          <CalendarDays className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                          <div>
                                            <h4 className="text-sm font-semibold">{d.data.split("-").reverse().join("/")}</h4>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                              <Clock className="inline w-3.5 h-3.5 mr-1" />
                                              {d.horario_inicio}–{d.horario_fim}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Ministats à direita */}
                                        <div className="ml-0 sm:ml-auto flex flex-wrap gap-4">
                                          <MiniStat number={totalInscritos} label="inscritos" className="text-zinc-700 dark:text-zinc-100" />
                                          <MiniStat number={presentes} label="presentes" className="text-emerald-600 dark:text-emerald-400" />
                                          <MiniStat number={faltas} label="faltas" className="text-rose-600 dark:text-rose-400" />
                                          <MiniStat number={`${pct}%`} label="presença" className={pctColor(pct)} />
                                        </div>
                                      </header>

                                      <div className="px-4 pb-4 overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                          <thead>
                                            <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                              <th className="py-2 pr-4">👤 Nome</th>
                                              <th className="py-2 pr-4">CPF</th>
                                              <th className="py-2 pr-4">Situação</th>
                                              <th className="py-2 pr-4">Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Array.from(mapaUsuarios.values()).map((u) => {
                                              const presente = !!u.presencas.get(d.data);
                                              const status = presente ? "presente" : (antesDaJanela ? "aguardando" : "faltou");
                                              const podeConfirmar = !presente && dentroDaJanelaConfirmacao(d.data, d.horario_inicio, d.horario_fim);
                                              const loadingThis = abrindo === `${u.id}-${idSeguro}-${d.data}`;

                                              return (
                                                <tr key={`${u.id}-${d.data}`} className="border-t border-zinc-200 dark:border-zinc-800">
                                                  <td className="py-2 pr-4 whitespace-nowrap">{u.nome}</td>
                                                  <td className="py-2 pr-4 whitespace-nowrap">{formatarCPF(u.cpf) || u.cpf || "—"}</td>
                                                  <td className="py-2 pr-4">
                                                    {status === "presente" ? (
                                                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        <Badge kind="ok">Presente</Badge>
                                                      </span>
                                                    ) : status === "aguardando" ? (
                                                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                                        <AlertCircle className="w-4 h-4" />
                                                        <Badge>Aguardando</Badge>
                                                      </span>
                                                    ) : (
                                                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                                                        <XCircle className="w-4 h-4" />
                                                        <Badge kind="absent">Faltou</Badge>
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="py-2 pr-4">
                                                    {podeConfirmar ? (
                                                      <button
                                                        onClick={() => confirmarPresencaManual(u.id, idSeguro, d.data)}
                                                        disabled={loadingThis}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-700/40"
                                                      >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        {loadingThis ? "Confirmando..." : "Confirmar"}
                                                      </button>
                                                    ) : (
                                                      <span className="text-xs text-zinc-400">—</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </section>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Avaliações */}
                    <AnimatePresence>
                      {expandindoAvaliacoes && (
                        <motion.div
                          id={`painel-avaliacoes-${idSeguro}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden px-4 pb-4"
                        >
                          {(() => {
                            const raw = avaliacoesPorTurma[idSeguro];
                            const comentarios =
                              Array.isArray(raw)
                                ? raw
                                : Array.isArray(raw?.comentarios)
                                ? raw.comentarios
                                : Array.isArray(raw?.itens)
                                ? raw.itens
                                : Array.isArray(raw?.avaliacoes)
                                ? raw.avaliacoes
                                : [];
                            return comentarios.length > 0 ? (
                              <AvaliacoesEvento avaliacoes={comentarios} />
                            ) : (
                              <p className="text-sm text-gray-600 italic dark:text-gray-300">
                                Nenhuma avaliação registrada para esta turma.
                              </p>
                            );
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                );
              })}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/* ===== PropTypes / defaults (inalterados) ===== */
TurmasInstrutor.propTypes = {
  turmas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      nome: PropTypes.string,
      evento: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        nome: PropTypes.string,
        titulo: PropTypes.string,
        local: PropTypes.string,
      }),
      local: PropTypes.string,
      datas: PropTypes.array,
      horario_inicio: PropTypes.string,
      horario_fim: PropTypes.string,
      data_inicio: PropTypes.string,
      data_fim: PropTypes.string,
    })
  ),
  inscritosPorTurma: PropTypes.object,
  avaliacoesPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  onVerInscritos: PropTypes.func,
  onVerAvaliacoes: PropTypes.func,
  onExportarListaAssinaturaPDF: PropTypes.func,
  onExportarQrCodePDF: PropTypes.func,
  token: PropTypes.any,
  carregarPresencas: PropTypes.func,
  carregando: PropTypes.bool,
  turmaExpandidaInscritos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  setTurmaExpandidaInscritos: PropTypes.func,
  turmaExpandidaAvaliacoes: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  setTurmaExpandidaAvaliacoes: PropTypes.func,
  datasPorTurma: PropTypes.object,
  carregarDatasPorTurma: PropTypes.func,
  className: PropTypes.string,
};
TurmasInstrutor.defaultProps = {
  turmas: [],
  inscritosPorTurma: {},
  avaliacoesPorTurma: {},
  presencasPorTurma: {},
  carregarPresencas: undefined,
  onVerInscritos: undefined,
  onVerAvaliacoes: undefined,
  onExportarListaAssinaturaPDF: undefined,
  onExportarQrCodePDF: undefined,
  setTurmaExpandidaInscritos: () => {},
  setTurmaExpandidaAvaliacoes: () => {},
  carregarDatasPorTurma: undefined,
  className: "",
};
