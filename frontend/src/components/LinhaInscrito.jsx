// 📁 src/components/LinhaInscrito.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  ShieldCheck,
  User2,
  BadgeCheck,
} from "lucide-react";

import BotaoSecundario from "./BotaoSecundario";
import { formatarCPF as formatarCPFUtils } from "../utils/data";
import { apiPost } from "../services/api";

/* ======================= Datas (date-only safe / fuso local) ======================= */
const MS = { HOUR: 60 * 60 * 1000 };

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
    return new Date(input); // strings com hora/timezone
  }
  return new Date(input);
}

function ymdLocalString(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function combineDateAndTimeLocal(dateOnly, timeHHmm) {
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;

  const hhmm = typeof timeHHmm === "string" ? timeHHmm.slice(0, 5) : "";
  const [h, m] = hhmm.split(":").map(Number);
  base.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  return base;
}

function formatBrSafe(dateLike) {
  if (!dateLike) return "—";
  if (typeof dateLike === "string" && isDateOnly(dateLike)) {
    const [y, m, d] = dateLike.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = toLocalDate(dateLike);
  if (!dt || Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

/* ======================= UI helpers ======================= */
function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function StatusPill({ kind }) {
  // kind: "presente" | "faltou" | "aguardando" | "fora_prazo"
  const base =
    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border";
  if (kind === "presente") {
    return (
      <span
        className={cls(
          base,
          "bg-emerald-50 text-emerald-800 border-emerald-200",
          "dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
        )}
      >
        <BadgeCheck size={14} aria-hidden="true" />
        Presente
      </span>
    );
  }
  if (kind === "fora_prazo") {
    return (
      <span
        className={cls(
          base,
          "bg-amber-50 text-amber-900 border-amber-200",
          "dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800"
        )}
      >
        <ShieldCheck size={14} aria-hidden="true" />
        Fora do prazo
      </span>
    );
  }
  if (kind === "faltou") {
    return (
      <span
        className={cls(
          base,
          "bg-rose-50 text-rose-800 border-rose-200",
          "dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800"
        )}
      >
        <XCircle size={14} aria-hidden="true" />
        Faltou
      </span>
    );
  }
  return (
    <span
      className={cls(
        base,
        "bg-slate-50 text-slate-700 border-slate-200",
        "dark:bg-slate-900/30 dark:text-slate-200 dark:border-slate-800"
      )}
    >
      <Clock3 size={14} aria-hidden="true" />
      Aguardando
    </span>
  );
}

/* =============================== Componente =============================== */
export default function LinhaInscrito({ inscrito, turma }) {
  const dataInicioStr = useMemo(() => ymdLocalString(turma?.data_inicio), [turma?.data_inicio]);

  const fimDate = useMemo(
    () => combineDateAndTimeLocal(turma?.data_fim, turma?.horario_fim),
    [turma?.data_fim, turma?.horario_fim]
  );

  const temPresenca = inscrito?.data_presenca != null;
  const [status, setStatus] = useState(temPresenca ? "presente" : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(inscrito?.data_presenca != null ? "presente" : null);
  }, [inscrito?.data_presenca]);

  const agora = new Date();
  const hojeStr = ymdLocalString(agora);

  const eventoAindaNaoComecou = dataInicioStr ? hojeStr < dataInicioStr : false;
  const eventoEncerrado = fimDate ? agora > fimDate : false;

  const limiteConfirmacao = fimDate ? new Date(fimDate.getTime() + 48 * MS.HOUR) : null;
  const dentroPrazoConfirmacao = limiteConfirmacao ? agora <= limiteConfirmacao : false;

  const foraDoPrazo = eventoEncerrado && !dentroPrazoConfirmacao;

  const podeConfirmar =
    !status && eventoEncerrado && dentroPrazoConfirmacao && !eventoAindaNaoComecou;

  function motivoBloqueio() {
    if (status) return "Presença já confirmada.";
    if (eventoAindaNaoComecou) return "A confirmação libera no término da turma.";
    if (!eventoEncerrado) return "A confirmação libera após o término da turma.";
    if (!dentroPrazoConfirmacao) return "Fora do prazo de 48h para confirmação.";
    return null;
  }

  async function confirmarPresenca() {
    const motivo = motivoBloqueio();
    if (motivo || loading) {
      if (motivo) toast.info(motivo);
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost("/api/presencas/registrar", {
        usuario_id: inscrito.usuario_id,
        turma_id: turma.id,
        data: hojeStr, // YYYY-MM-DD local
      });

      if (!res || (res.status && String(res.status)[0] !== "2")) throw res;

      setStatus("presente");
      toast.success("✅ Presença confirmada!");
    } catch (err) {
      const st = err?.status ?? err?.response?.status;
      if (st === 409 || st === 208) {
        setStatus("presente");
        toast.success("✅ Presença já estava confirmada.");
      } else {
        setStatus((s) => s || "faltou");
        const msg =
          err?.data?.erro ||
          err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Erro ao confirmar presença.";
        toast.error(`❌ ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const statusKind = status === "presente" ? "presente" : foraDoPrazo ? "fora_prazo" : status === "faltou" ? "faltou" : "aguardando";

  const nome = inscrito?.nome || "—";
  const cpf = formatarCPFUtils(inscrito?.cpf);
  const dataPresencaFmt = inscrito?.data_presenca ? formatBrSafe(inscrito.data_presenca) : "—";

  const tooltip = motivoBloqueio() || "Confirmar presença";

  const labelBotao = status === "presente"
    ? "Confirmado"
    : foraDoPrazo
      ? "Prazo expirado"
      : loading
        ? "Confirmando..."
        : "Confirmar presença";

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cls(
        "group relative",
        "rounded-2xl border border-slate-200 bg-white/80 backdrop-blur",
        "shadow-sm hover:shadow-md transition-shadow",
        "dark:bg-slate-950/40 dark:border-slate-800"
      )}
      role="row"
      aria-label={`Inscrito ${nome}`}
    >
      {/* “Barra” superior sutil */}
      <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 opacity-80" />

      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Identidade */}
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <span
                className={cls(
                  "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl",
                  "bg-slate-100 text-slate-700 border border-slate-200",
                  "dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800"
                )}
                aria-hidden="true"
              >
                <User2 size={16} />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[72vw] md:max-w-[36vw]">
                    {nome}
                  </p>
                  <div aria-live="polite">
                    <StatusPill kind={statusKind} />
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">CPF:</span> {cpf || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Presença:</span> {dataPresencaFmt}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ação */}
          <div className="flex md:justify-end">
            <BotaoSecundario
              onClick={confirmarPresenca}
              disabled={!podeConfirmar || loading || status === "presente" || foraDoPrazo}
              loading={loading}
              aria-label={`Confirmar presença de ${nome}`}
              title={tooltip}
              className={cls(
                "w-full md:w-auto",
                "rounded-xl"
              )}
              icon={status === "presente" ? <CheckCircle2 size={16} /> : undefined}
            >
              {labelBotao}
            </BotaoSecundario>
          </div>
        </div>

        {/* Rodapé contextual (ajuda) */}
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {status === "presente" ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={14} aria-hidden="true" />
              Presença registrada para este inscrito.
            </span>
          ) : foraDoPrazo ? (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} aria-hidden="true" />
              A janela de confirmação (48h após o término) expirou.
            </span>
          ) : podeConfirmar ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} aria-hidden="true" />
              Confirmação liberada (até 48h após o término).
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} aria-hidden="true" />
              {motivoBloqueio() || "Aguardando liberação."}
            </span>
          )}
        </div>
      </div>
    </motion.li>
  );
}

LinhaInscrito.propTypes = {
  inscrito: PropTypes.shape({
    usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string,
    cpf: PropTypes.string,
    email: PropTypes.string,
    data_presenca: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }).isRequired,
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    horario_fim: PropTypes.string,
  }).isRequired,
};
