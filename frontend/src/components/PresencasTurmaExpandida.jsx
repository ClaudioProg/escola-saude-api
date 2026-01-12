// 📁 src/pages/PresencasTurmaExpandida.jsx
import { useMemo, useState, useCallback } from "react";
import { toast } from "react-toastify";
import StatusPresencaBadge from "./StatusPresencaBadge";
import ModalConfirmacao from "../components/ModalConfirmacao";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import { apiPost } from "../services/api";

/* ──────────────────────────────────────────────────────────────
   Helpers: robustos e “timezone-safe” (não cria Date de YYYY-MM-DD puro)
────────────────────────────────────────────────────────────── */
function hhmm(s, fb = "") {
  return typeof s === "string" && /^\d{1,2}:\d{1,2}/.test(s) ? s.slice(0, 5) : fb;
}

// retorna YYYY-MM-DD
function isoDia(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (typeof v === "object" && v?.data) return String(v.data).slice(0, 10);
  if (v instanceof Date) return formatarParaISO(v);
  return "";
}

// Cria Date SEM risco de “pular 1 dia”: sempre com hora
function makeLocalDateTime(isoDate, timeHHMM = "08:00") {
  const d = typeof isoDate === "string" ? isoDate.slice(0, 10) : "";
  const t = hhmm(timeHHMM, "08:00");
  if (!d) return null;
  const dt = new Date(`${d}T${t}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtHora(s) {
  return s && /^\d{1,2}:\d{1,2}/.test(s) ? hhmm(s) : "";
}

function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function PresencasTurmaExpandida({
  turma,
  datasTurma,
  inscritos = [],
  presencas = [],
  carregarPresencas,
  otimismo = true,
}) {
  /* ───── horários base ───── */
  const horarioInicioTurma = hhmm(turma?.horario_inicio, "08:00");
  const horarioFimTurma = hhmm(turma?.horario_fim, "17:00");

  /* ───── normaliza grade de datas (dataISO, hi, hf) ───── */
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

    // únicas por data (mantém o primeiro horário)
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

  /* ───── limite global: até 60 dias após término ───── */
  const limiteGlobal = useMemo(() => {
    const ultimo = datasGrade.at(-1);
    const df = isoDia(turma?.data_fim) || ultimo?.dataISO || formatarParaISO(new Date());
    const hf = horarioFimTurma || ultimo?.hf || "17:00";

    const fim = makeLocalDateTime(df, hf);
    const fimMs = fim ? fim.getTime() : Date.now();

    return new Date(fimMs + 60 * 24 * 60 * 60 * 1000);
  }, [turma?.data_fim, datasGrade, horarioFimTurma]);

  /* ───── mapa base de presenças (uid|date -> bool) ───── */
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

  // estado local p/ optimistic UI (apenas toggles de true)
  const [localPresencas, setLocalPresencas] = useState(() => new Map());

  const getPresente = useCallback(
    (usuarioId, dataISO) => {
      const key = `${String(usuarioId)}|${dataISO}`;
      return localPresencas.has(key)
        ? localPresencas.get(key) === true
        : presencasMapBase.get(key) === true;
    },
    [localPresencas, presencasMapBase]
  );

  /* ───── estado de envio / A11y ───── */
  const [savingKey, setSavingKey] = useState(null);
  const [ariaMsg, setAriaMsg] = useState("");

  // ✅ confirmação premium (substitui window.confirm)
  const [confirm, setConfirm] = useState({
    open: false,
    key: null,
    dataISO: "",
    turmaId: null,
    usuarioId: null,
    nome: "",
  });

  // “agora” por render (evita ficar congelado)
  const agora = new Date();

  const solicitarConfirmacaoPresenca = useCallback((dataISO, turmaId, usuarioId, nome) => {
    const key = `${usuarioId}|${dataISO}`;
    setConfirm({
      open: true,
      key,
      dataISO,
      turmaId,
      usuarioId,
      nome: nome || "Participante",
    });
  }, []);

  const executarConfirmacaoPresenca = useCallback(async () => {
    if (!confirm?.turmaId || !confirm?.usuarioId || !confirm?.dataISO) {
      setConfirm((c) => ({ ...c, open: false }));
      return;
    }

    const { dataISO, turmaId, usuarioId, nome, key } = confirm;

    try {
      setSavingKey(key);

      if (otimismo) {
        setLocalPresencas((prev) => {
          const clone = new Map(prev);
          clone.set(key, true);
          return clone;
        });
      }

      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataISO, // se seu backend exigir "data_presenca", troque aqui
      });

      const okMsg = `Presença confirmada para ${nome} em ${formatarDataBrasileira(dataISO)}.`;
      toast.success(`✅ ${okMsg}`);
      setAriaMsg(okMsg);

      await carregarPresencas?.(turmaId);
    } catch (err) {
      if (otimismo) {
        setLocalPresencas((prev) => {
          const clone = new Map(prev);
          clone.delete(key);
          return clone;
        });
      }

      // eslint-disable-next-line no-console
      console.error("Erro ao confirmar presença:", err);
      const msg = err?.data?.erro || err?.message || "Erro ao confirmar presença.";
      toast.error(`❌ ${msg}`);
      setAriaMsg(`Erro ao confirmar presença: ${msg}.`);
    } finally {
      setSavingKey(null);
      setConfirm((c) => ({ ...c, open: false }));
    }
  }, [confirm, carregarPresencas, otimismo]);

  if (!Array.isArray(inscritos) || inscritos.length === 0) return null;

  const confirmLoading = !!confirm?.key && savingKey === confirm.key;

  return (
    <div className="mt-5 space-y-6">
      {/* live region */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaMsg}
      </span>

      {inscritos.map((inscrito) => {
        const usuarioId = inscrito.usuario_id ?? inscrito.id;
        const nome = inscrito?.nome || "Participante";

        return (
          <section
            key={usuarioId}
            className={classNames(
              "rounded-2xl border border-zinc-200/70 dark:border-white/10",
              "bg-white/90 dark:bg-zinc-900/70",
              "ring-1 ring-black/5 dark:ring-white/10",
              "shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]",
              "p-4 sm:p-5"
            )}
            aria-labelledby={`aluno-${usuarioId}-titulo`}
            aria-busy={savingKey ? "true" : "false"}
          >
            {/* header do aluno */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div
                  id={`aluno-${usuarioId}-titulo`}
                  className="font-extrabold tracking-tight text-sm sm:text-base text-zinc-900 dark:text-white truncate"
                  title={nome}
                >
                  {nome}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                  CPF: <span className="font-medium">{inscrito.cpf ?? "Não informado"}</span>
                </div>
              </div>

              {/* mini chip de ajuda */}
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                Janela abre <span className="font-semibold">+1h</span> do início • válida até{" "}
                <span className="font-semibold">{formatarDataBrasileira(limiteGlobal)}</span>
              </div>
            </div>

            {/* ───────────── Tabela desktop ───────────── */}
            <div className="hidden md:block mt-4">
              <div className="overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-white/10">
                <table className="w-full text-xs border-collapse" aria-label={`Presenças de ${nome}`}>
                  <thead className="bg-zinc-50 dark:bg-white/5">
                    <tr className="text-zinc-700 dark:text-zinc-200">
                      <th scope="col" className="py-3 text-left px-3">Data</th>
                      <th scope="col" className="py-3 text-left px-3">Horário</th>
                      <th scope="col" className="py-3 text-left px-3">Situação</th>
                      <th scope="col" className="py-3 text-left px-3">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {datasGrade.map(({ dataISO, hi, hf }) => {
                      const presente = getPresente(usuarioId, dataISO);

                      const inicioAulaDT = makeLocalDateTime(dataISO, hi || horarioInicioTurma || "08:00");
                      const abreJanela = inicioAulaDT
                        ? new Date(inicioAulaDT.getTime() + 60 * 60 * 1000)
                        : null;

                      const antesDaJanela = abreJanela ? agora < abreJanela : true;
                      const dentroDaJanela = abreJanela ? agora >= abreJanela && agora <= limiteGlobal : false;

                      let status = "faltou";
                      if (presente) status = "presente";
                      else if (antesDaJanela) status = "aguardando";
                      else if (dentroDaJanela) status = "em_aberto";

                      const hint =
                        !presente && dentroDaJanela
                          ? `Até ${formatarDataBrasileira(limiteGlobal)} ${fmtHora(horarioFimTurma)}`
                          : "";

                      const key = `${usuarioId}|${dataISO}`;
                      const disabled = savingKey === key;

                      return (
                        <tr key={`${usuarioId}-${dataISO}`} className="border-t border-zinc-200/70 dark:border-white/10">
                          <td className="py-2 px-3">
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {formatarDataBrasileira(dataISO)}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-200">
                            {hi && hf ? `${fmtHora(hi)}–${fmtHora(hf)}` : "—"}
                          </td>

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <StatusPresencaBadge status={status} />
                              {hint && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>}
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            {!presente && dentroDaJanela && !antesDaJanela ? (
                              <button
                                type="button"
                                onClick={() => solicitarConfirmacaoPresenca(dataISO, turma.id, usuarioId, nome)}
                                disabled={disabled}
                                className={classNames(
                                  "inline-flex items-center justify-center",
                                  "rounded-2xl px-3 py-1.5 text-xs font-semibold text-white",
                                  "bg-emerald-600 hover:bg-emerald-700",
                                  "ring-1 ring-emerald-800/30",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70",
                                  "disabled:opacity-60 disabled:cursor-not-allowed"
                                )}
                                title="Confirmar presença"
                                aria-label={`Confirmar presença de ${nome} em ${formatarDataBrasileira(dataISO)}`}
                              >
                                {disabled ? "Salvando…" : "Confirmar"}
                              </button>
                            ) : (
                              <span className="text-zinc-400 text-xs" aria-hidden="true">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ───────────── Cards mobile ───────────── */}
            <div className="md:hidden mt-4 space-y-2" role="list" aria-label={`Presenças de ${nome} (mobile)`}>
              {datasGrade.map(({ dataISO, hi, hf }) => {
                const presente = getPresente(usuarioId, dataISO);

                const inicioAulaDT = makeLocalDateTime(dataISO, hi || horarioInicioTurma || "08:00");
                const abreJanela = inicioAulaDT ? new Date(inicioAulaDT.getTime() + 60 * 60 * 1000) : null;

                const antesDaJanela = abreJanela ? agora < abreJanela : true;
                const dentroDaJanela = abreJanela ? agora >= abreJanela && agora <= limiteGlobal : false;

                let status = "faltou";
                if (presente) status = "presente";
                else if (antesDaJanela) status = "aguardando";
                else if (dentroDaJanela) status = "em_aberto";

                const hint =
                  !presente && dentroDaJanela
                    ? `Até ${formatarDataBrasileira(limiteGlobal)} ${fmtHora(horarioFimTurma)}`
                    : "";

                const key = `${usuarioId}|${dataISO}`;
                const disabled = savingKey === key;

                return (
                  <div
                    key={`${usuarioId}-${dataISO}`}
                    role="listitem"
                    className={classNames(
                      "rounded-2xl border border-zinc-200/70 dark:border-white/10",
                      "bg-zinc-50 dark:bg-white/5",
                      "p-3"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-zinc-900 dark:text-white">
                          {formatarDataBrasileira(dataISO)}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                          {hi && hf ? `${fmtHora(hi)}–${fmtHora(hf)}` : "—"}
                        </div>
                      </div>

                      <StatusPresencaBadge status={status} />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {hint || " "}
                      </div>

                      {!presente && dentroDaJanela && !antesDaJanela ? (
                        <button
                          type="button"
                          onClick={() => solicitarConfirmacaoPresenca(dataISO, turma.id, usuarioId, nome)}
                          disabled={disabled}
                          className={classNames(
                            "inline-flex items-center justify-center",
                            "rounded-2xl px-3 py-1.5 text-xs font-semibold text-white",
                            "bg-emerald-600 hover:bg-emerald-700",
                            "ring-1 ring-emerald-800/30",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70",
                            "disabled:opacity-60 disabled:cursor-not-allowed"
                          )}
                          title="Confirmar presença"
                          aria-label={`Confirmar presença de ${nome} em ${formatarDataBrasileira(dataISO)}`}
                        >
                          {disabled ? "Salvando…" : "Confirmar"}
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-xs" aria-hidden="true">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ✅ ModalConfirmacao: substitui window.confirm */}
      <ModalConfirmacao
        isOpen={!!confirm.open}
        title="Confirmar presença?"
        description={
          confirm?.dataISO
            ? `Confirmar presença de ${confirm.nome} em ${formatarDataBrasileira(confirm.dataISO)}?`
            : "Confirmar presença?"
        }
        confirmText="Sim, confirmar"
        cancelText="Cancelar"
        loading={confirmLoading}
        onClose={() => {
          if (confirmLoading) return;
          setConfirm((c) => ({ ...c, open: false }));
        }}
        onConfirm={executarConfirmacaoPresenca}
      />
    </div>
  );
}
