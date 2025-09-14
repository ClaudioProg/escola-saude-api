// 📁 src/components/ListaInscritos.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { apiPost } from "../services/api"; // ✅ cliente central

/* ===================== Helpers de data (fuso LOCAL) ===================== */

const MS_HOUR = 60 * 60 * 1000;

function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}
function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d); // 00:00 no fuso local
    }
    return new Date(input); // deixa o JS interpretar quando tiver hora/timezone
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
function combineDateAndTimeLocal(dateOnly, timeHHmm, fallbackEnd = false) {
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;
  const hhmm = typeof timeHHmm === "string" ? timeHHmm.slice(0, 5) : "";
  const [h, m] = hhmm.split(":").map(Number);
  base.setHours(
    Number.isFinite(h) ? h : (fallbackEnd ? 23 : 0),
    Number.isFinite(m) ? m : (fallbackEnd ? 59 : 0),
    fallbackEnd ? 59 : 0,
    fallbackEnd ? 999 : 0
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
  const [confirmando, setConfirmando] = useState(null);
  const agora = new Date();

  /** Define as linhas/datas exibidas: usa encontros reais quando vierem, senão intervalo simples */
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

  /** Prazo: pode confirmar até 48h após o término do dia (usa hf do dia ou hf da turma) */
  const dentroDoPrazoDeConfirmacao = (dataRef, horarioFimDoDia, horarioFimTurma) => {
    const fimDia = combineDateAndTimeLocal(
      dataRef,
      horarioFimDoDia || horarioFimTurma,
      true
    );
    if (!fimDia) return false;
    const limite = new Date(fimDia.getTime() + 48 * MS_HOUR);
    return agora <= limite;
  };

  /** Confirma presença para um (usuario_id, data "YYYY-MM-DD") */
  async function confirmarPresenca(usuario_id, dataRef) {
    try {
      setConfirmando(`${usuario_id}-${dataRef}`);
      // manda "YYYY-MM-DDT00:00:00" (backend pode normalizar para o dia)
      const dataISO = `${dataRef}T00:00:00`;
      await apiPost("/api/presencas/confirmar-instrutor", {
        usuario_id,
        turma_id: turma.id,
        data: dataISO,
      });
      toast.success("✅ Presença confirmada com sucesso!");
      await carregarPresencas?.();
    } catch (err) {
      // tolerante a idempotência
      if (err?.status === 409) {
        toast.success("✅ Presença já estava confirmada.");
        await carregarPresencas?.();
      } else {
        toast.error(err?.message || "❌ Erro ao confirmar presença.");
      }
    } finally {
      setConfirmando(null);
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
            const idKey = inscrito.usuario_id ?? inscrito.id ?? inscrito.email;
            const presencasUsuario = Array.isArray(presencas)
              ? presencas.filter((p) => p.usuario_id === inscrito.usuario_id)
              : [];

            return (
              <li
                key={idKey}
                className="p-4 bg-white dark:bg-zinc-800 rounded-2xl shadow border border-gray-100 dark:border-zinc-700"
              >
                {/* Cabeçalho do inscrito */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white break-words">
                      {inscrito.nome || "Participante"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
                      {inscrito.email || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    {formatCPF(inscrito.cpf)}
                  </span>
                </div>

                {/* Tabela de presenças por data */}
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-sm text-center"
                    aria-label={`Datas e presenças de ${inscrito.nome || "participante"}`}
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

                        // presença já registrada nesse dia?
                        const p = presencasUsuario.find(
                          (px) => (px?.data || "").slice(0, 10) === data
                        );
                        const isPresente = p?.presente === true;

                        // liberar ação após 60min do horário de início do dia
                        const inicioDia = combineDateAndTimeLocal(data, hi);
                        const liberouPosInicio =
                          inicioDia ? agora > new Date(inicioDia.getTime() + 60 * 60 * 1000) : false;

                        const podeConfirmar =
                          !isPresente &&
                          liberouPosInicio &&
                          dentroDoPrazoDeConfirmacao(data, hf, turma?.horario_fim);

                        let statusBadge = null;
                        if (isPresente) {
                          statusBadge = (
                            <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                              ✅ Presente
                            </span>
                          );
                        } else if (!liberouPosInicio) {
                          statusBadge = (
                            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                              ⏳ Aguardando
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                              ❌ Faltou
                            </span>
                          );
                        }

                        return (
                          <tr key={data} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="p-2">{dataBR}</td>
                            <td className="p-2">{horarioStr}</td>
                            <td className="p-2">{statusBadge}</td>
                            <td className="p-2">
                              {podeConfirmar && (
                                <button
                                  type="button"
                                  disabled={confirmando === `${inscrito.usuario_id}-${data}`}
                                  onClick={() => confirmarPresenca(inscrito.usuario_id, data)}
                                  className={`text-xs px-2 py-1 rounded
                                    bg-green-900 hover:bg-green-800
                                    focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:outline-none
                                    text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                                  title="Confirmar presença deste dia"
                                  aria-label={`Confirmar presença em ${dataBR} para ${inscrito.nome || "participante"}`}
                                >
                                  {confirmando === `${inscrito.usuario_id}-${data}`
                                    ? "Confirmando..."
                                    : "Confirmar presença"}
                                </button>
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
