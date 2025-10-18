// 📁 src/components/ResetCertTurmaButton.jsx
import React, { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { apiPost /* ou importe apiResetCertificadosTurma */ } from "../services/api";
import ModalConfirmacao from "./ModalConfirmacao";

export default function ResetCertTurmaButton({
  turmaId,
  className = "",
  onDone,
  endpoint,               // opcional: sobrescreve endpoint
  requirePhrase = false,  // se true, exige digitar "RESETAR"
  confirmPhrase = "RESETAR",
  btnLabel = "Reset certificados da turma",
  btnVariant = "danger",  // "danger" | "neutral"
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);

  const resolvedEndpoint = useMemo(() => {
    if (endpoint) return endpoint;
    // padrão alinhado ao restante da app:
    return `/api/certificados/admin/turmas/${turmaId}/reset`;
  }, [endpoint, turmaId]);

  function handleClick() {
    setErr("");
    if (!turmaId) {
      setErr("turmaId ausente.");
      return;
    }
    setOpen(true);
  }

  async function doReset() {
    if (busy) return false; // mantém modal aberto
    if (requirePhrase && typed.trim().toUpperCase() !== confirmPhrase) {
      setErr(`Digite ${confirmPhrase} para confirmar.`);
      inputRef.current?.focus();
      return false; // mantém modal aberto
    }

    try {
      setBusy(true);
      setErr("");
      // Se você tiver um helper dedicado, troque a linha abaixo:
      const resp = await apiPost(resolvedEndpoint, {});
      toast.success("✅ Reset concluído com sucesso.");
      onDone?.(resp);
      return true; // fecha modal
    } catch (e) {
      const msg = e?.data?.mensagem || e?.data?.message || e?.message || "Falha ao resetar.";
      setErr(msg);
      toast.error(`❌ ${msg}`);
      return false; // mantém modal p/ usuário ver o erro
    } finally {
      setBusy(false);
      setTyped("");
    }
  }

  const dangerClasses =
    "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500 disabled:bg-rose-300";
  const neutralClasses =
    "bg-zinc-800 hover:bg-zinc-900 focus-visible:ring-zinc-500 disabled:bg-zinc-500";

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        disabled={busy || !turmaId}
        onClick={handleClick}
        className={[
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2",
          btnVariant === "danger" ? dangerClasses : neutralClasses,
          busy ? "cursor-not-allowed opacity-90" : "",
        ].join(" ")}
        title="Resetar certificados da turma"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        {busy ? "Resetando…" : btnLabel}
      </button>

      {/* Inline error (opcional) */}
      {err && !open && (
        <span className="mt-1 text-xs text-red-600" aria-live="polite">
          {err}
        </span>
      )}

      {/* Modal de confirmação */}
      <ModalConfirmacao
        isOpen={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setErr("");
            setTyped("");
          }
        }}
        onConfirmar={doReset}
        titulo="Confirmar reset de certificados"
        mensagem={
          <>
            <span className="block mb-2">
              ⚠️ Esta ação apagará todos os certificados já gerados e metadados da turma{" "}
              <strong>{String(turmaId)}</strong>. Não poderá ser desfeita.
            </span>
            {requirePhrase && (
              <label className="block text-sm mt-2">
                Digite <strong>{confirmPhrase}</strong> para confirmar:
                <input
                  ref={inputRef}
                  data-autofocus
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-white"
                />
              </label>
            )}
            {err && (
              <span className="mt-2 block text-xs text-red-600" aria-live="assertive">
                {err}
              </span>
            )}
          </>
        }
        textoBotaoConfirmar={busy ? "Processando..." : "Apagar certificados"}
        textoBotaoCancelar="Cancelar"
        closeOnOverlay={false}
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
  btnLabel: PropTypes.string,
  btnVariant: PropTypes.oneOf(["danger", "neutral"]),
};
