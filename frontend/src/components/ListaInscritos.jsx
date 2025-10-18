// 📁 src/components/ListaInscritos.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { toast } from "react-toastify";
import { apiPost } from "../services/api"; // ✅ cliente central
import BotaoSecundario from "./BotaoSecundario";

/* ===================== Config / Helpers (Fuso LOCAL) ===================== */

const UNLOCK_MINUTES_AFTER_START = 60;   // minutos após o início do dia para liberar confirmação
const CONFIRM_WINDOW_HOURS = 48;         // janela para confirmar após o fim do dia

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;

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
    return new Date(input); // strings com horário/timezone mantêm info
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
function combineDateAndTimeLocal(dateOnly, timeHHmm, endOfDay = false) {
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;
  const hhmm = typeof timeHHmm === "string" ? timeHHmm.slice(0, 5) : "";
  const [h, m] = hhmm.split(":").map(Number);
  base.setHours(
    Number.isFinite(h) ? h : (endOfDay ? 23 : 0),
    Number.isFinite(m) ? m : (endOfDay ? 59 : 0),
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
const formatCPF = (cpf) =>
  cpf?.replace?.(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || "—";

/* =============================== Componente =============================== */

export default function ListaInscritos({
  inscritos = [],
  turma,
  // token (depreciado) — mantido por compatibilidade:
  token, // eslint-disable-line no-unused-vars
  presencas = [],        // [{usuario_id, data: 'YYYY-MM-DD' ou ISO, presente: bool}, ...]
  carregarPresencas,     // () => Promise<void>
  datas = [],            // [{ data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM' }]
}) {
  const [confirmandoKey, setConfirmandoKey] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // mantém "agora" razoavelmente fresco se a tela ficar aberta por muito tempo
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * MS_MIN);
    return () => clearInterval(id);
  }, []);

  /** Linhas/dias exibidos: usa encontros reais quando vierem; senão, intervalo simples */
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

  /** Map para lookup O(1) das presenças: key = `${usuario_id}#${YYYY-MM-DD}` */
  const presencasMap = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(presencas) ? presencas : []) {
      const dateKey = ymdLocalString(p?.data);
      const uid = p?.usuario_id ?? p?.usuario ?? p?.user_id;
      if (uid != null && dateKey) {
        m.set(`${uid}#${dateKey}`, !!p?.presente);
      }
    }
    return m;
  }, [presencas]);

  /** Regras de janela: pode confirmar até 48h após o término do dia */
  const dentroDoPrazoDeConfirmacao = (dataRef, horarioFimDoDia, horarioFimTurma) => {
    const fimDia = combineDateAndTimeLocal(
      dataRef,
      horarioFimDoDia || horarioFimTurma,
      true
    );
    if (!fimDia) return false;
    const limite = new Date(fimDia.getTime() + CONFIRM_WINDOW_HOURS * MS_HOUR);
    return now <= limite;
  };

  /** Libera ação após X min do horário de início do dia */
  const liberouPosInicio = (dataRef, horarioInicio, minutos = UNLOCK_MINUTES_AFTER_START) => {
    const inicioDia = combineDateAndTimeLocal(dataRef, horarioInicio);
    if (!inicioDia) return false;
    const unlockAt = new Date(inicioDia.getTime() + minutos * MS_MIN);
    return now >= unlockAt;
  };

  /** Confirma presença para um (usuario_id, data "YYYY-MM-DD") */
  async function confirmarPresenca(usuario_id, dataRef) {
    const key = `${usuario_id}#${dataRef}`;
    try {
      setConfirmandoKey(key);
      // manda "YYYY-MM-DDT00:00:00" (backend normaliza por dia)
      const dataISO = `${dataRef}T00:00:00`;
      const res = await apiPost("/api/presencas/confirmar-instrutor", {
        usuario_id,
        turma_id: turma.id,
        data: dataISO,
      });

      // considera qualquer 2xx sucesso
      if (res?.status && String(res.status)[0] !== "2") {
        throw res;
      }

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
      {inscritos.length === 0 ? (
        <div className="flex flex-col items-center py-10">
          <span className="text-5xl mb-2" aria-hidden="true">🗒️</span>
          <p className="text-gray-600 dark:text-gray-300 font-semibold">
            Nenhum inscrito nesta turma.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {inscritos.map((inscrito) => {
            const usuarioId = inscrito.usuario_id ?? inscrito.id ?? inscrito.email ?? inscrito.cpf;
            const nomeExib = inscrito.nome || "Participante";
            const emailExib = inscrito.email || "—";
            const cpfExib = formatCPF(inscrito.cpf);

            return (
              <li
                key={usuarioId}
                className="p-4 bg-white dark:bg-zinc-800 rounded-2xl shadow border border-gray-100 dark:border-zinc-700"
              >
                {/* Cabeçalho do inscrito */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white break-words">
                      {nomeExib}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
                      {emailExib}
                    </p>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    {cpfExib}
                  </span>
                </div>

                {/* Tabela de presenças por data */}
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-sm text-center"
                    aria-label={`Datas e presenças de ${nomeExib}`}
                  >
                    <caption className="sr-only">Controle de presenças por data</caption>
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-300">
                        <th scope="col" className="p-2 font-medium">Data</th>
                        <th scope="col" className="p-2 font-medium">Horário</th>
                        <th scope="col" className="p-2 font-medium">Status</th>
                        <th scope="col" className="p-2 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDatas.map(({ data, hi, hf }) => {
                        const dataBR = data.split("-").reverse().join("/");
                        const horarioStr =
                          (hi || hf) ? `${hi || ""}${hi && hf ? " – " : ""}${hf || ""}` : "—";

                        const presente = !!presencasMap.get(`${inscrito.usuario_id}#${data}`);

                        // libera ação X minutos após o início do dia
                        const podeAbrirPorInicio = liberouPosInicio(data, hi);
                        const noPrazo = dentroDoPrazoDeConfirmacao(data, hf, turma?.horario_fim);

                        const podeConfirmar = !presente && podeAbrirPorInicio && noPrazo;

                        let statusBadge = null;
                        if (presente) {
                          statusBadge = (
                            <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                              ✅ Presente
                            </span>
                          );
                        } else if (!podeAbrirPorInicio) {
                          statusBadge = (
                            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                              ⏳ Aguardando
                            </span>
                          );
                        } else if (!noPrazo) {
                          statusBadge = (
                            <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                              ❌ Fora do prazo
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                              ❌ Faltou
                            </span>
                          );
                        }

                        const isLoading = confirmandoKey === `${inscrito.usuario_id}#${data}`;
                        const titleBtn = presente
                          ? "Presença já confirmada."
                          : !podeAbrirPorInicio
                          ? `A confirmação libera ${UNLOCK_MINUTES_AFTER_START} min após o início.`
                          : !noPrazo
                          ? `Fora do prazo de ${CONFIRM_WINDOW_HOURS}h após o fim do dia.`
                          : "Confirmar presença deste dia";

                        return (
                          <tr key={data} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="p-2">{dataBR}</td>
                            <td className="p-2">{horarioStr}</td>
                            <td className="p-2">{statusBadge}</td>
                            <td className="p-2">
                              {podeConfirmar && (
                                <BotaoSecundario
                                  onClick={() => confirmarPresenca(inscrito.usuario_id, data)}
                                  loading={isLoading}
                                  disabled={isLoading}
                                  aria-label={`Confirmar presença em ${dataBR} para ${nomeExib}`}
                                  title={titleBtn}
                                  size="sm"
                                >
                                  Confirmar presença
                                </BotaoSecundario>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
      usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      nome: PropTypes.string,
      email: PropTypes.string,
      cpf: PropTypes.string,
    })
  ),
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    horario_inicio: PropTypes.string, // "HH:MM"
    horario_fim: PropTypes.string,    // "HH:MM"
  }).isRequired,
  token: PropTypes.any, // mantido por compatibilidade
  presencas: PropTypes.arrayOf(
    PropTypes.shape({
      usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      data: PropTypes.string,     // ISO ou "YYYY-MM-DD"
      presente: PropTypes.bool,
    })
  ),
  carregarPresencas: PropTypes.func,
  datas: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.string.isRequired,            // "YYYY-MM-DD"
      horario_inicio: PropTypes.string,             // "HH:MM"
      horario_fim: PropTypes.string,                // "HH:MM"
    })
  ),
};
