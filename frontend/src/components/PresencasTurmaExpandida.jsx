// 📁 src/pages/PresencasTurmaExpandida.jsx
import { useMemo, useState } from "react";
import StatusPresencaBadge from "./StatusPresencaBadge";
import { toast } from "react-toastify";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ serviço centralizado

export default function PresencasTurmaExpandida({
  turma,
  datasTurma,
  inscritos = [],
  presencas = [],
  carregarPresencas,
}) {
  /* ───────────────── helpers ───────────────── */
  const hhmm = (s, fb = "") =>
    typeof s === "string" && /^\d{1,2}:\d{1,2}/.test(s) ? s.slice(0, 5) : fb;

  const isoDia = (v) => {
    if (!v) return "";
    // Date -> yyyy-mm-dd (sem UTC)
    if (v instanceof Date) return formatarParaISO(v);
    // objeto com .data
    if (typeof v === "object" && v.data) return String(v.data).slice(0, 10);
    // string ISO / yyyy-mm-dd
    if (typeof v === "string") return v.slice(0, 10);
    try {
      // fallback (fixa ao meio-dia local p/ evitar UTC)
      return formatarParaISO(new Date(`${v}T12:00:00`));
    } catch {
      return "";
    }
  };

  const horarioInicioTurma = hhmm(turma?.horario_inicio, "08:00");
  const horarioFimTurma = hhmm(turma?.horario_fim, "17:00");

  /* ───── normaliza a grade de datas (dataISO, hi, hf) ───── */
  const datasGrade = useMemo(() => {
    const baseHi = horarioInicioTurma || "08:00";
    const baseHf = horarioFimTurma || "17:00";

    const src =
      Array.isArray(datasTurma) && datasTurma.length
        ? datasTurma
        : Array.isArray(turma?.datas) && turma.datas.length
        ? turma.datas
        : Array.isArray(turma?.encontros)
        ? turma.encontros
        : [];

    const itens = (src || [])
      .map((d) => {
        // aceita string, Date, objeto com campos diversos
        const dataISO = isoDia(d?.data ?? d);
        const hi = hhmm(d?.horario_inicio ?? d?.inicio, baseHi);
        const hf = hhmm(d?.horario_fim ?? d?.fim, baseHf);
        return dataISO ? { dataISO, hi, hf } : null;
      })
      .filter(Boolean);

    // únicas por data (se vierem repetidas)
    const seen = new Set();
    const unicas = [];
    for (const it of itens) {
      if (!seen.has(it.dataISO)) {
        seen.add(it.dataISO);
        unicas.push(it);
      }
    }

    // ordenadas
    return unicas.sort((a, b) => (a.dataISO < b.dataISO ? -1 : a.dataISO > b.dataISO ? 1 : 0));
  }, [datasTurma, turma?.datas, turma?.encontros, horarioInicioTurma, horarioFimTurma]);

  /* ───── limite global (até 15 dias após término) ─────
     Usa data_fim da turma OU a última data da grade (se não houver data_fim). */
  const limiteGlobal = useMemo(() => {
    const df = isoDia(turma?.data_fim) || datasGrade.at(-1)?.dataISO || formatarParaISO(new Date());
    const hf = horarioFimTurma || datasGrade.at(-1)?.hf || "17:00";
    const fimTurmaDT = new Date(`${df}T${hf}`);
    return new Date(fimTurmaDT.getTime() + 15 * 24 * 60 * 60 * 1000);
  }, [turma?.data_fim, datasGrade, horarioFimTurma]);

  /* ───── mapa de presenças para lookup O(1) ───── */
  const presencasMap = useMemo(() => {
    const m = new Map();
    for (const p of presencas || []) {
      const uid = String(p?.usuario_id ?? p?.id_usuario ?? "");
      const rawData = p?.data_presenca ?? p?.data ?? p?.dia;
      const day = isoDia(rawData);
      const presente =
        p?.presente === true || p?.presente === 1 || String(p?.presente) === "1";
      if (uid && day) m.set(`${uid}|${day}`, presente);
    }
    return m;
  }, [presencas]);

  const estaPresente = (usuarioId, dataISO) =>
    presencasMap.get(`${String(usuarioId)}|${dataISO}`) === true;

  /* ───── estado de envio (evita duplo clique) ───── */
  const [savingKey, setSavingKey] = useState(null);

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    const key = `${usuarioId}|${dataSelecionada}`;
    try {
      setSavingKey(key);
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada, // ajuste p/ "data_presenca" se seu backend exigir
      });

      toast.success(
        `✅ Presença confirmada para ${nome} em ${formatarDataBrasileira(dataSelecionada)}.`
      );
      await carregarPresencas?.(turmaId);
    } catch (err) {
      console.error("Erro ao confirmar presença:", err);
      const msg = err?.data?.erro || err?.message || "Erro ao confirmar presença.";
      toast.error(`❌ ${msg}`);
    } finally {
      setSavingKey(null);
    }
  }

  if (!Array.isArray(inscritos) || inscritos.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-6">
      {inscritos.map((inscrito) => {
        const usuarioId = inscrito.usuario_id ?? inscrito.id;

        return (
          <div
            key={usuarioId}
            className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
            aria-label={`Dados do inscrito ${inscrito.nome}`}
            tabIndex={0}
          >
            <div className="font-semibold text-sm text-lousa dark:text-white mb-1">
              {inscrito.nome}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              CPF: {inscrito.cpf ?? "Não informado"}
            </div>

            <table className="w-full text-xs border-collapse" aria-label="Tabela de presença por data">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <th className="py-2 text-left px-2">📅 Data</th>
                  <th className="py-2 text-left px-2">🟡 Situação</th>
                  <th className="py-2 text-left px-2">✔️ Ações</th>
                </tr>
              </thead>
              <tbody>
                {datasGrade.map(({ dataISO, hi }) => {
                  const presente = estaPresente(usuarioId, dataISO);

                  // janela admin por dia: abre 60 min após início do dia; fecha no limiteGlobal
                  const inicioAulaDT = new Date(`${dataISO}T${hi || horarioInicioTurma || "08:00"}`);
                  const abreJanela = new Date(inicioAulaDT.getTime() + 60 * 60 * 1000);
                  const agora = new Date();
                  const antesDaJanela = agora < abreJanela;
                  const dentroDaJanela = agora >= abreJanela && agora <= limiteGlobal;

                  // status visual
                  const status = presente ? "presente" : antesDaJanela ? "aguardando" : "faltou";

                  const key = `${usuarioId}|${dataISO}`;
                  const disabled = savingKey === key;

                  return (
                    <tr key={`${usuarioId}-${dataISO}`} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="py-1 px-2">{formatarDataBrasileira(dataISO)}</td>
                      <td className="py-1 px-2">
                        <StatusPresencaBadge status={status} />
                      </td>
                      <td className="py-1 px-2">
                        {!presente && dentroDaJanela && !antesDaJanela ? (
                          <button
                            onClick={() =>
                              confirmarPresenca(dataISO, turma.id, usuarioId, inscrito.nome)
                            }
                            disabled={disabled}
                            className={`text-white text-xs py-1 px-3 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                              disabled
                                ? "bg-teal-900 cursor-not-allowed"
                                : "bg-teal-700 hover:bg-teal-800"
                            }`}
                          >
                            {disabled ? "Salvando..." : "Confirmar"}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs" aria-hidden="true">
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
        );
      })}
    </div>
  );
}
