// 📁 src/components/ListaInscritos.jsx
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "react-toastify";
import { apiPost } from "../services/api"; // ✅ usar serviço centralizado

/* ===== Helpers de data no fuso local ===== */

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
    // strings com hora explícita (ex.: "2025-08-15T09:00:00") deixam o JS interpretar
    return new Date(input);
  }
  return new Date(input);
}

function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function endOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
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

  if (timeHHmm) {
    const [h, m] = timeHHmm.split(":").map(Number);
    base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  } else if (fallbackEnd) {
    base.setHours(23, 59, 59, 999);
  }
  return base;
}

/** Gera array de "YYYY-MM-DD" (inclusive) usando fuso local */
function generateDateRangeLocal(startDateOnly, endDateOnly) {
  const start = startOfDayLocal(startDateOnly);
  const end = startOfDayLocal(endDateOnly);
  if (!start || !end) return [];

  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(ymdLocalString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/* ===== Componente ===== */

export default function ListaInscritos({
  inscritos = [],
  turma,
  token,              // pode continuar recebendo, mas não vamos usar
  presencas = [],
  carregarPresencas,
}) {
  const [confirmando, setConfirmando] = useState(null);
  const agora = new Date();

  const formatarCPF = (cpf) =>
    cpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || "CPF inválido";

  /** Dentro do prazo: até 48h após o término daquele dia (dataRef + horario_fim) */
  const dentroDoPrazoDeConfirmacao = (dataRef) => {
    const fimDia = combineDateAndTimeLocal(dataRef, turma?.horario_fim, true);
    if (!fimDia) return false;
    const limite = new Date(fimDia.getTime() + 48 * 60 * 60 * 1000);
    return agora <= limite;
  };

  /** Confirma presença para (usuario_id, dataRef "YYYY-MM-DD") */
  const confirmarPresenca = async (usuario_id, dataRef) => {
    try {
      setConfirmando(`${usuario_id}-${dataRef}`);

      // manda a data como "YYYY-MM-DDT00:00:00" (interpretação local no backend ou normalizada por lá)
      const dataISO = `${dataRef}T00:00:00`;

      await apiPost("/api/presencas/confirmar-instrutor", {
        usuario_id,
        turma_id: turma.id,
        data: dataISO,
      });

      toast.success("✅ Presença confirmada com sucesso!");
      await carregarPresencas();
    } catch (err) {
      console.error("Erro ao confirmar presença:", err);
      toast.error(err?.message || "❌ Erro ao confirmar presença.");
    } finally {
      setConfirmando(null);
    }
  };

  // logs de apoio
  console.log("📋 Inscritos:", inscritos);
  console.log("📋 Presenças recebidas:", presencas);
  console.log("📆 Intervalo de datas da turma:", turma?.data_inicio, "→", turma?.data_fim);

  // Intervalo de datas da turma no fuso local
  const datasTurma = generateDateRangeLocal(turma?.data_inicio, turma?.data_fim);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
    >
      {inscritos.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <span className="text-4xl mb-2">🗒️</span>
          <p className="text-gray-500 dark:text-gray-300 font-semibold">
            Nenhum inscrito nesta turma.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {inscritos.map((inscrito) => {
            const presencasUsuario = presencas.filter((p) => p.usuario_id === inscrito.usuario_id);

            return (
              <li key={inscrito.usuario_id} className="p-4 bg-white dark:bg-zinc-800 rounded-xl shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{inscrito.nome}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{inscrito.email}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2 sm:mt-0">
                    {formatarCPF(inscrito.cpf)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-center">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-300">
                        <th className="p-2">Data</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasTurma.map((dataRef) => {
                        const dataBR = dataRef.split("-").reverse().join("/");

                        // presença registrada nesse dia?
                        const p = presencasUsuario.find(
                          (px) => (px?.data || "").slice(0, 10) === dataRef
                        );
                        const isPresente = p?.presente === true;

                        // liberação do botão: após 60min do horário de início daquele dia
                        const inicioDia = combineDateAndTimeLocal(dataRef, turma?.horario_inicio);
                        const passou60min =
                          inicioDia ? agora > new Date(inicioDia.getTime() + 60 * 60000) : false;

                        const podeConfirmar = passou60min && dentroDoPrazoDeConfirmacao(dataRef);

                        let statusBadge = null;
                        if (isPresente) {
                          statusBadge = (
                            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                              ✅ Presente
                            </span>
                          );
                        } else if (!passou60min) {
                          statusBadge = (
                            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                              ⏳ Aguardando
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                              ❌ Faltou
                            </span>
                          );
                        }

                        return (
                          <tr key={dataRef} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="p-2">{dataBR}</td>
                            <td className="p-2">{statusBadge}</td>
                            <td className="p-2">
                              {!isPresente && podeConfirmar && (
                                <button
                                  disabled={confirmando === `${inscrito.usuario_id}-${dataRef}`}
                                  onClick={() => confirmarPresenca(inscrito.usuario_id, dataRef)}
                                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                                >
                                  {confirmando === `${inscrito.usuario_id}-${dataRef}`
                                    ? "Confirmando..."
                                    : "✅ Confirmar presença"}
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
