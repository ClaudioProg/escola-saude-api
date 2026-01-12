// 📁 src/components/ResetCertTurmaButton.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { RotateCcw, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { apiPost } from "../services/api";
import ModalConfirmacao from "./ModalConfirmacao";

/**
 * ResetCertTurmaButton (Premium)
 * - Modal de confirmação com opção de exigir frase e/ou checkbox "Entendi"
 * - Robustez contra unmount
 * - Erros tratados de forma consistente
 */
export default function ResetCertTurmaButton({
  turmaId,
  className = "",
  onDone,
  endpoint, // opcional: sobrescreve endpoint

  requirePhrase = false, // se true, exige digitar confirmPhrase
  confirmPhrase = "RESETAR",

  // extra premium (não quebra): exige marcar "entendi"
  requireAcknowledge = true,
  acknowledgeText = "Entendi que esta ação é irreversível.",

  btnLabel = "Reset certificados da turma",
  btnVariant = "danger", // "danger" | "neutral"
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);

  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolvedEndpoint = useMemo(() => {
    if (endpoint) return endpoint;
    return `/api/certificados/admin/turmas/${turmaId}/reset`;
  }, [endpoint, turmaId]);

  const resetLocalState = useCallback(() => {
    setErr("");
    setTyped("");
    setAck(false);
  }, []);

  const extractErrorMessage = (e) => {
    // axios-like + api helper
    const d = e?.response?.data ?? e?.data ?? null;
    return (
      d?.mensagem ||
      d?.message ||
      d?.erro ||
      e?.message ||
      "Falha ao resetar certificados."
    );
  };

  function handleClick() {
    setErr("");
    if (!turmaId) {
      setErr("turmaId ausente.");
      return;
    }
    setOpen(true);
  }

  // foco “premium” ao abrir modal
  useEffect(() => {
    if (!open) return;
    // dá um tick pro modal montar
    const t = setTimeout(() => {
      if (requirePhrase) inputRef.current?.focus?.();
    }, 30);
    return () => clearTimeout(t);
  }, [open, requirePhrase]);

  async function doReset() {
    if (busy) return false; // mantém modal aberto

    const phraseOk =
      !requirePhrase || typed.trim().toUpperCase() === String(confirmPhrase).trim().toUpperCase();
    const ackOk = !requireAcknowledge || ack === true;

    if (!ackOk) {
      setErr("Marque a confirmação de ciência para continuar.");
      return false;
    }

    if (!phraseOk) {
      setErr(`Digite ${confirmPhrase} para confirmar.`);
      inputRef.current?.focus?.();
      return false;
    }

    try {
      setBusy(true);
      setErr("");

      const resp = await apiPost(resolvedEndpoint, {});

      toast.success("✅ Reset concluído com sucesso.");
      onDone?.(resp);

      return true; // fecha modal
    } catch (e) {
      const msg = extractErrorMessage(e);
      toast.error(`❌ ${msg}`);
      if (mountedRef.current) setErr(msg);
      return false; // mantém modal aberto
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setTyped("");
        setAck(false);
      }
    }
  }

  const btnBase =
    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold text-white " +
    "shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)] ring-1 ring-black/10 " +
    "focus-visible:outline-none focus-visible:ring-2";

  const dangerClasses =
    "bg-gradient-to-br from-rose-600 via-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 " +
    "focus-visible:ring-rose-400/70 disabled:from-rose-300 disabled:to-rose-300";
  const neutralClasses =
    "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black hover:from-zinc-900 hover:to-black " +
    "focus-visible:ring-zinc-400/60 disabled:from-zinc-500 disabled:to-zinc-500";

  const disabled = busy || !turmaId;

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={[
          btnBase,
          btnVariant === "danger" ? dangerClasses : neutralClasses,
          disabled ? "cursor-not-allowed opacity-90" : "",
        ].join(" ")}
        title="Resetar certificados da turma"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        {busy ? "Resetando…" : btnLabel}
      </button>

      {/* erro inline (quando fora do modal) */}
      {err && !open && (
        <span className="mt-1 text-xs text-rose-700 dark:text-rose-300" aria-live="polite">
          {err}
        </span>
      )}

      <ModalConfirmacao
        isOpen={open}
        closeOnOverlay={false}
        titulo="Confirmar reset de certificados"
        textoBotaoConfirmar={busy ? "Processando…" : "Apagar certificados"}
        textoBotaoCancelar="Cancelar"
        onClose={() => {
          if (busy) return;
          setOpen(false);
          resetLocalState();
        }}
        onConfirmar={doReset}
        mensagem={
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-rose-600/10 text-rose-700 dark:text-rose-300 p-2 ring-1 ring-rose-700/20">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <div className="text-sm text-zinc-800 dark:text-zinc-100">
                  Você está prestes a <b>apagar todos os certificados já gerados</b> e metadados desta turma.
                </div>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-white/10 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-200">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Turma: <b className="font-extrabold">{String(turmaId)}</b>
                </div>

                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Esta ação é <b>irreversível</b>.
                </div>
              </div>
            </div>

            {requireAcknowledge && (
              <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-100">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  disabled={busy}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-white/20"
                />
                <span>{acknowledgeText}</span>
              </label>
            )}

            {requirePhrase && (
              <label className="block text-sm text-zinc-800 dark:text-zinc-100">
                Digite <strong className="font-extrabold">{confirmPhrase}</strong> para confirmar:
                <input
                  ref={inputRef}
                  data-autofocus
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy}
                  className={[
                    "mt-2 w-full rounded-2xl border px-3 py-2 text-sm",
                    "bg-white/80 dark:bg-zinc-900/50",
                    "border-zinc-200 dark:border-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-rose-400/60",
                  ].join(" ")}
                  placeholder={confirmPhrase}
                />
              </label>
            )}

            {err && (
              <span className="block text-xs text-rose-700 dark:text-rose-300" aria-live="assertive">
                {err}
              </span>
            )}
          </div>
        }
      />
    </div>
  );
}

ResetCertTurmaButton.propTypes = {
  turmaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  className: PropTypes.string,
  onDone: PropTypes.func,
  endpoint: PropTypes.string,

  requirePhrase: PropTypes.bool,
  confirmPhrase: PropTypes.string,

  requireAcknowledge: PropTypes.bool,
  acknowledgeText: PropTypes.string,

  btnLabel: PropTypes.string,
  btnVariant: PropTypes.oneOf(["danger", "neutral"]),
};
