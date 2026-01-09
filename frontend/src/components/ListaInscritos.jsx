// 📁 src/components/ListaInscritos.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  User2,
  Mail,
  BadgeCheck,
  Clock3,
  ShieldAlert,
  XCircle,
  CalendarDays,
  Timer,
} from "lucide-react";

import { apiPost } from "../services/api";
import BotaoSecundario from "./BotaoSecundario";

/* ===================== Config / Helpers (Fuso LOCAL / date-only safe) ===================== */

const UNLOCK_MINUTES_AFTER_START = 60; // minutos após início do encontro
const CONFIRM_WINDOW_HOURS = 48; // janela para confirmar após o fim do encontro

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d); // 00:00 local
    }
    return new Date(input); // mantém timezone se houver
  }
  return new Date(input);
}

function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function ymdLocalString(d) {
  const dt = startOfDayLocal(d);
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBRDateOnly(ymd) {
  if (!ymd) return "—";
  if (typeof ymd === "string" && isDateOnly(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = toLocalDate(ymd);
  if (!dt || Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function combineDateAndTimeLocal(dateOnly, timeHHmm, endOfDay = false) {
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;

  const hhmm = typeof timeHHmm === "string" ? timeHHmm.slice(0, 5) : "";
  const [h, m] = hhmm.split(":").map(Number);

  base.setHours(
    Number.isFinite(h) ? h : endOfDay ? 23 : 0,
    Number.isFinite(m) ? m : endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  return base;
}

/** Array de "YYYY-MM-DD" (inclusive) em fuso local */
function generateDateRangeLocal(startDateOnly, endDateOnly) {
  const start = startOfDayLocal(startDateOnly);
  const end = startOfDayLocal(endDateOnly);
  if (!start || !end) return [];
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(ymdLocalString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatCPF(cpf) {
  return cpf?.replace?.(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || "—";
}

function safeUid(inscrito) {
  return inscrito?.usuario_id ?? inscrito?.id ?? inscrito?.email ?? inscrito?.cpf ?? String(Math.random());
}

/* =============================== UI: Pills =============================== */

function Pill({ tone = "slate", icon: Icon, children }) {
  const tones = {
    emerald:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800",
    amber:
      "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800",
    rose:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800",
    indigo:
      "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800",
    slate:
    default:
      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/25 dark:text-slate-200 dark:border-slate-800",
  };

  return (
    <span
      className={cls(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* =============================== Componente =============================== */

export default function ListaInscritos({
  inscritos = [],
  turma,
  token, // depreciado (mantido compat)
  presencas = [],
  carregarPresencas,
  datas = [],
}) {
  const [confirmandoKey, setConfirmandoKey] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // relógio “vivo” (mais responsivo que 30min e ainda leve)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1 * MS_MIN);
    return () => clearInterval(id);
  }, []);

  /** Linhas/dias exibidos: usa encontros reais quando vierem; senão, intervalo */
  const linhasDatas = useMemo(() => {
    if (Array.isArray(datas) && datas.length > 0) {
      return datas
        .map((d) => ({
          data: isDateOnly(d?.data) ? d.data : ymdLocalString(d?.data),
          hi: (d?.horario_inicio || turma?.horario_inicio || "").slice(0, 5),
          hf: (d?.horario_fim || turma?.horario_fim || "").slice(0, 5),
        }))
        .filter((x) => x.data)
        .sort((a, b) => a.data.localeCompare(b.data));
    }

    return generateDateRangeLocal(turma?.data_inicio, turma?.data_fim).map((d) => ({
      data: d,
      hi: (turma?.horario_inicio || "").slice(0, 5),
      hf: (turma?.horario_fim || "").slice(0, 5),
    }));
  }, [datas, turma?.data_inicio, turma?.data_fim, turma?.horario_inicio, turma?.horario_fim]);

  /** Map para lookup O(1) das presenças: key = `${uid}#${YYYY-MM-DD}` */
  const presencasMap = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(presencas) ? presencas : []) {
      const dateKey = ymdLocalString(p?.data);
      const uid = p?.usuario_id ?? p?.usuario ?? p?.user_id;
      if (uid != null && dateKey) m.set(`${uid}#${dateKey}`, !!p?.presente);
    }
    return m;
  }, [presencas]);

  /** Regras: pode confirmar até 48h após o fim do encontro */
  const dentroDoPrazoDeConfirmacao = useCallback(
    (dataRef, horarioFimDoDia, horarioFimTurma) => {
      const fimDia = combineDateAndTimeLocal(dataRef, horarioFimDoDia || horarioFimTurma, true);
      if (!fimDia) return false;
      const limite = new Date(fimDia.getTime() + CONFIRM_WINDOW_HOURS * MS_HOUR);
      return now <= limite;
    },
    [now]
  );

  /** Libera ação após X min do horário de início */
  const liberouPosInicio = useCallback(
    (dataRef, horarioInicio, minutos = UNLOCK_MINUTES_AFTER_START) => {
      const inicioDia = combineDateAndTimeLocal(dataRef, horarioInicio);
      if (!inicioDia) return false;
      const unlockAt = new Date(inicioDia.getTime() + minutos * MS_MIN);
      return now >= unlockAt;
    },
    [now]
  );

  async function confirmarPresenca(usuario_id, dataRef) {
    const key = `${usuario_id}#${dataRef}`;
    try {
      setConfirmandoKey(key);

      // envia como ISO local do dia (backend normaliza por dia)
      const dataISO = `${dataRef}T00:00:00`;

      const res = await apiPost("/api/presencas/confirmar-instrutor", {
        usuario_id,
        turma_id: turma.id,
        data: dataISO,
      });

      if (res?.status && String(res.status)[0] !== "2") throw res;

      toast.success("✅ Presença confirmada com sucesso!");
      await carregarPresencas?.();
    } catch (err) {
      const st = err?.status ?? err?.response?.status;
      if (st === 409 || st === 208) {
        toast.success("✅ Presença já estava confirmada.");
        await carregarPresencas?.();
      } else {
        const msg =
          err?.data?.erro ||
          err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Erro ao confirmar presença.";
        toast.error(`❌ ${msg}`);
      }
    } finally {
      setConfirmandoKey(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
      role="region"
      aria-label="Lista de inscritos por data"
    >
      {/* Empty state */}
      {inscritos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 dark:bg-slate-950/40 dark:border-slate-800 p-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CalendarDays className="text-slate-700 dark:text-slate-200" size={22} aria-hidden="true" />
          </div>
          <p className="mt-3 text-slate-900 dark:text-white font-semibold">Nenhum inscrito nesta turma.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Quando houver inscrições, elas aparecerão aqui com o controle por data.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {inscritos.map((inscrito) => {
            const uid = safeUid(inscrito);
            const nome = inscrito?.nome || "Participante";
            const email = inscrito?.email || "—";
            const cpf = formatCPF(inscrito?.cpf);

            return (
              <li
                key={uid}
                className={cls(
                  "relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur",
                  "shadow-sm hover:shadow-md transition-shadow",
                  "dark:bg-slate-950/40 dark:border-slate-800"
                )}
              >
                {/* Top accent bar */}
                <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 opacity-80" />

                {/* Header */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <span
                          className={cls(
                            "mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                            "bg-slate-100 text-slate-700 border border-slate-200",
                            "dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800"
                          )}
                          aria-hidden="true"
                        >
                          <User2 size={18} />
                        </span>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white break-words">
                            {nome}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 break-all inline-flex items-center gap-2">
                            <Mail size={14} aria-hidden="true" />
                            {email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="slate">
                        CPF: <span className="font-bold">{cpf}</span>
                      </Pill>
                      <Pill tone="indigo" icon={Timer}>
                        Libera em {UNLOCK_MINUTES_AFTER_START}min
                      </Pill>
                      <Pill tone="amber" icon={Clock3}>
                        Janela {CONFIRM_WINDOW_HOURS}h
                      </Pill>
                    </div>
                  </div>

                  {/* Mobile: cards por data */}
                  <div className="mt-4 grid gap-2 md:hidden" aria-label={`Datas e presenças de ${nome}`}>
                    {linhasDatas.map(({ data, hi, hf }) => {
                      const presente = !!presencasMap.get(`${uid}#${data}`);

                      const liberado = liberouPosInicio(data, hi);
                      const noPrazo = dentroDoPrazoDeConfirmacao(data, hf, turma?.horario_fim);

                      const podeConfirmar = !presente && liberado && noPrazo;
                      const foraPrazo = liberado && !noPrazo;
                      const aguardando = !liberado;

                      const isLoading = confirmandoKey === `${uid}#${data}`;

                      const horarioStr =
                        hi || hf ? `${hi || ""}${hi && hf ? " – " : ""}${hf || ""}` : "—";

                      const statusNode = presente ? (
                        <Pill tone="emerald" icon={BadgeCheck}>Presente</Pill>
                      ) : aguardando ? (
                        <Pill tone="amber" icon={Clock3}>Aguardando</Pill>
                      ) : foraPrazo ? (
                        <Pill tone="rose" icon={ShieldAlert}>Fora do prazo</Pill>
                      ) : (
                        <Pill tone="rose" icon={XCircle}>Faltou</Pill>
                      );

                      const hint = presente
                        ? "Presença já confirmada."
                        : aguardando
                          ? `Libera ${UNLOCK_MINUTES_AFTER_START} min após o início.`
                          : foraPrazo
                            ? `Prazo expirou (${CONFIRM_WINDOW_HOURS}h após o fim do dia).`
                            : "Pode confirmar agora.";

                      return (
                        <div
                          key={data}
                          className={cls(
                            "rounded-2xl border border-slate-200 bg-white",
                            "dark:bg-slate-950/40 dark:border-slate-800",
                            "p-3"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {formatBRDateOnly(data)}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                {horarioStr}
                              </p>
                            </div>
                            <div aria-live="polite">{statusNode}</div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>

                            {podeConfirmar ? (
                              <BotaoSecundario
                                onClick={() => confirmarPresenca(uid, data)}
                                loading={isLoading}
                                disabled={isLoading}
                                aria-label={`Confirmar presença em ${formatBRDateOnly(data)} para ${nome}`}
                                title="Confirmar presença deste dia"
                                size="sm"
                                className="rounded-xl"
                              >
                                Confirmar
                              </BotaoSecundario>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: tabela clean */}
                  <div className="mt-4 hidden md:block">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="min-w-full text-sm" aria-label={`Datas e presenças de ${nome}`}>
                        <caption className="sr-only">Controle de presenças por data</caption>
                        <thead className="bg-slate-50 dark:bg-slate-900/40">
                          <tr className="text-slate-600 dark:text-slate-200">
                            <th scope="col" className="p-3 text-left font-semibold">Data</th>
                            <th scope="col" className="p-3 text-left font-semibold">Horário</th>
                            <th scope="col" className="p-3 text-center font-semibold">Status</th>
                            <th scope="col" className="p-3 text-right font-semibold">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {linhasDatas.map(({ data, hi, hf }) => {
                            const presente = !!presencasMap.get(`${uid}#${data}`);

                            const liberado = liberouPosInicio(data, hi);
                            const noPrazo = dentroDoPrazoDeConfirmacao(data, hf, turma?.horario_fim);

                            const podeConfirmar = !presente && liberado && noPrazo;

                            const statusNode = presente ? (
                              <Pill tone="emerald" icon={BadgeCheck}>Presente</Pill>
                            ) : !liberado ? (
                              <Pill tone="amber" icon={Clock3}>Aguardando</Pill>
                            ) : !noPrazo ? (
                              <Pill tone="rose" icon={ShieldAlert}>Fora do prazo</Pill>
                            ) : (
                              <Pill tone="rose" icon={XCircle}>Faltou</Pill>
                            );

                            const horarioStr =
                              hi || hf ? `${hi || ""}${hi && hf ? " – " : ""}${hf || ""}` : "—";

                            const isLoading = confirmandoKey === `${uid}#${data}`;

                            const titleBtn = presente
                              ? "Presença já confirmada."
                              : !liberado
                                ? `Libera ${UNLOCK_MINUTES_AFTER_START} min após o início.`
                                : !noPrazo
                                  ? `Fora do prazo de ${CONFIRM_WINDOW_HOURS}h após o fim do dia.`
                                  : "Confirmar presença deste dia";

                            return (
                              <tr key={data} className="bg-white dark:bg-transparent">
                                <td className="p-3 text-left font-medium text-slate-900 dark:text-white">
                                  {formatBRDateOnly(data)}
                                </td>
                                <td className="p-3 text-left text-slate-700 dark:text-slate-200">
                                  {horarioStr}
                                </td>
                                <td className="p-3 text-center">{statusNode}</td>
                                <td className="p-3">
                                  <div className="flex justify-end">
                                    {podeConfirmar ? (
                                      <BotaoSecundario
                                        onClick={() => confirmarPresenca(uid, data)}
                                        loading={isLoading}
                                        disabled={isLoading}
                                        aria-label={`Confirmar presença em ${formatBRDateOnly(data)} para ${nome}`}
                                        title={titleBtn}
                                        size="sm"
                                        className="rounded-xl"
                                      >
                                        Confirmar presença
                                      </BotaoSecundario>
                                    ) : (
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {titleBtn}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}

/* =============================== PropTypes =============================== */

ListaInscritos.propTypes = {
  inscritos: PropTypes.arrayOf(
    PropTypes.shape({
      usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      email: PropTypes.string,
      cpf: PropTypes.string,
    })
  ),
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,
  }).isRequired,
  token: PropTypes.any,
  presencas: PropTypes.arrayOf(
    PropTypes.shape({
      usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      data: PropTypes.string, // ISO ou "YYYY-MM-DD"
      presente: PropTypes.bool,
    })
  ),
  carregarPresencas: PropTypes.func,
  datas: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.string.isRequired,
      horario_inicio: PropTypes.string,
      horario_fim: PropTypes.string,
    })
  ),
};
