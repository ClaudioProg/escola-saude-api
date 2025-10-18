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
  otimismo = true, // 👈 toggle p/ otimistic UI (padrão ligado)
}) {
  /* ───────────────── helpers ───────────────── */
  const hhmm = (s, fb = "") =>
    typeof s === "string" && /^\d{1,2}:\d{1,2}/.test(s) ? s.slice(0, 5) : fb;

  const isoDia = (v) => {
    if (!v) return "";
    if (v instanceof Date) return formatarParaISO(v);
    if (typeof v === "object" && v?.data) return String(v.data).slice(0, 10);
    if (typeof v === "string") return v.slice(0, 10);
    try {
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
        const dataISO = isoDia(d?.data ?? d);
        const hi = hhmm(d?.horario_inicio ?? d?.inicio, baseHi);
        const hf = hhmm(d?.horario_fim ?? d?.fim, baseHf);
        return dataISO ? { dataISO, hi, hf } : null;
      })
      .filter(Boolean);

    const seen = new Set();
    const unicas = [];
    for (const it of itens) {
      if (!seen.has(it.dataISO)) {
        seen.add(it.dataISO);
        unicas.push(it);
      }
    }
    return unicas.sort((a, b) => (a.dataISO < b.dataISO ? -1 : a.dataISO > b.dataISO ? 1 : 0));
  }, [datasTurma, turma?.datas, turma?.encontros, horarioInicioTurma, horarioFimTurma]);

  /* ───── limite global (até 15 dias após término) ───── */
  const limiteGlobal = useMemo(() => {
    const df = isoDia(turma?.data_fim) || datasGrade.at(-1)?.dataISO || formatarParaISO(new Date());
    const hf = horarioFimTurma || datasGrade.at(-1)?.hf || "17:00";
    const fimTurmaDT = new Date(`${df}T${hf}`);
    return new Date(fimTurmaDT.getTime() + 15 * 24 * 60 * 60 * 1000);
  }, [turma?.data_fim, datasGrade, horarioFimTurma]);

  /* ───── mapa de presenças ───── */
  const presencasMapBase = useMemo(() => {
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

  // estado local para otimistic UI (apenas toggles de true)
  const [localPresencas, setLocalPresencas] = useState(() => new Map());

  const getPresente = (usuarioId, dataISO) => {
    const key = `${String(usuarioId)}|${dataISO}`;
    return localPresencas.has(key)
      ? localPresencas.get(key) === true
      : presencasMapBase.get(key) === true;
  };

  /* ───── estado de envio / A11y ───── */
  const [savingKey, setSavingKey] = useState(null);
  const [ariaMsg, setAriaMsg] = useState("");

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    const key = `${usuarioId}|${dataSelecionada}`;
    try {
      setSavingKey(key);
      if (otimismo) {
        setLocalPresencas((prev) => new Map(prev).set(key, true));
      }

      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada, // ajuste p/ "data_presenca" se seu backend exigir
      });

      toast.success(
        `✅ Presença confirmada para ${nome} em ${formatarDataBrasileira(dataSelecionada)}.`
      );
      setAriaMsg(`Presença confirmada para ${nome} em ${formatarDataBrasileira(dataSelecionada)}.`);
      await carregarPresencas?.(turmaId);
    } catch (err) {
      if (otimismo) {
        setLocalPresencas((prev) => {
          const clone = new Map(prev);
          clone.delete(key);
          return clone;
        });
      }
      console.error("Erro ao confirmar presença:", err);
      const msg = err?.data?.erro || err?.message || "Erro ao confirmar presença.";
      toast.error(`❌ ${msg}`);
      setAriaMsg(`Erro ao confirmar presença: ${msg}.`);
    } finally {
      setSavingKey(null);
    }
  }

  if (!Array.isArray(inscritos) || inscritos.length === 0) {
    return null;
  }

  const fmtHora = (s) => (s && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : "");

  return (
    <div className="mt-4 space-y-6">
      {/* região live para leitor de tela */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaMsg}
      </span>

      {inscritos.map((inscrito) => {
        const usuarioId = inscrito.usuario_id ?? inscrito.id;

        return (
          <section
            key={usuarioId}
            className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
            aria-labelledby={`aluno-${usuarioId}-titulo`}
          >
            <div id={`aluno-${usuarioId}-titulo`} className="font-semibold text-sm text-lousa dark:text-white mb-1">
              {inscrito.nome}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              CPF: {inscrito.cpf ?? "Não informado"}
            </div>

            {/* Tabela desktop */}
            <div className="hidden md:block">
              <table className="w-full text-xs border-collapse" aria-label={`Presenças de ${inscrito.nome}`}>
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    <th scope="col" className="py-2 text-left px-2">📅 Data</th>
                    <th scope="col" className="py-2 text-left px-2">🕒 Horário</th>
                    <th scope="col" className="py-2 text-left px-2">🟡 Situação</th>
                    <th scope="col" className="py-2 text-left px-2">✔️ Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {datasGrade.map(({ dataISO, hi, hf }) => {
                    const presente = getPresente(usuarioId, dataISO);

                    const inicioAulaDT = new Date(`${dataISO}T${hi || horarioInicioTurma || "08:00"}`);
                    const abreJanela = new Date(inicioAulaDT.getTime() + 60 * 60 * 1000);
                    const agora = new Date();
                    const antesDaJanela = agora < abreJanela;
                    const dentroDaJanela = agora >= abreJanela && agora <= limiteGlobal;

                    // status visual + dica
                    let status = "faltou";
                    if (presente) status = "presente";
                    else if (antesDaJanela) status = "aguardando";
                    else if (dentroDaJanela) status = "em_aberto";

                    const janelaHint =
                      !presente && dentroDaJanela
                        ? `Janela aberta até ${formatarDataBrasileira(limiteGlobal)} ${fmtHora(horarioFimTurma)}`
                        : "";

                    const key = `${usuarioId}|${dataISO}`;
                    const disabled = savingKey === key;

                    return (
                      <tr key={`${usuarioId}-${dataISO}`} className="border-t border-gray-200 dark:border-gray-600">
                        <td className="py-1 px-2">{formatarDataBrasileira(dataISO)}</td>
                        <td className="py-1 px-2">{(hi && hf) ? `${fmtHora(hi)}–${fmtHora(hf)}` : "—"}</td>
                        <td className="py-1 px-2">
                          <div className="flex items-center gap-2">
                            <StatusPresencaBadge status={status} />
                            {janelaHint && (
                              <span className="text-[11px] text-gray-500">{janelaHint}</span>
                            )}
                          </div>
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
                              title="Confirmar presença"
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

            {/* Cards mobile */}
            <div className="md:hidden space-y-2" role="list" aria-label={`Presenças de ${inscrito.nome} (mobile)`}>
              {datasGrade.map(({ dataISO, hi, hf }) => {
                const presente = getPresente(usuarioId, dataISO);

                const inicioAulaDT = new Date(`${dataISO}T${hi || horarioInicioTurma || "08:00"}`);
                const abreJanela = new Date(inicioAulaDT.getTime() + 60 * 60 * 1000);
                const agora = new Date();
                const antesDaJanela = agora < abreJanela;
                const dentroDaJanela = agora >= abreJanela && agora <= limiteGlobal;

                let status = "faltou";
                if (presente) status = "presente";
                else if (antesDaJanela) status = "aguardando";
                else if (dentroDaJanela) status = "em_aberto";

                const janelaHint =
                  !presente && dentroDaJanela
                    ? `Janela até ${formatarDataBrasileira(limiteGlobal)} ${fmtHora(horarioFimTurma)}`
                    : "";

                const key = `${usuarioId}|${dataISO}`;
                const disabled = savingKey === key;

                return (
                  <div
                    key={`${usuarioId}-${dataISO}`}
                    role="listitem"
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-800 dark:text-white">
                        {formatarDataBrasileira(dataISO)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(hi && hf) ? `${fmtHora(hi)}–${fmtHora(hf)}` : ""}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusPresencaBadge status={status} />
                        {janelaHint && (
                          <span className="text-[11px] text-gray-500">{janelaHint}</span>
                        )}
                      </div>

                      {!presente && dentroDaJanela && !antesDaJanela ? (
                        <button
                          onClick={() =>
                            confirmarPresenca(dataISO, turma.id, usuarioId, inscrito.nome)
                          }
                          disabled={disabled}
                          className={`text-white text-xs py-1 px-3 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                            disabled ? "bg-teal-900 cursor-not-allowed" : "bg-teal-700 hover:bg-teal-800"
                          }`}
                          title="Confirmar presença"
                        >
                          {disabled ? "Salvando..." : "Confirmar"}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs" aria-hidden="true">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
