// Exemplo: componente pronto pra colar em qualquer página admin
import React, { useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { apiPost /* ou: apiResetCertificadosTurma */ } from "../services/api";

export default function ResetCertTurmaButton({ turmaId, className = "", onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleClick() {
    setErr("");
    if (!turmaId) { setErr("turmaId ausente."); return; }

    const ok = confirm(
      `⚠️ Isso vai apagar os certificados já gerados da turma ${turmaId} (e metadados). Continuar?`
    );
    if (!ok) return;

    try {
      setBusy(true);
      // Se criou o helper: await apiResetCertificadosTurma(turmaId);
      const resp = await apiPost(`/certificados/admin/turmas/${turmaId}/reset`, {}); // body opcional

      // feedback básico
      alert("Reset concluído com sucesso.");
      onDone?.(resp);
    } catch (e) {
      setErr(e?.message || "Falha ao resetar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white
                    ${busy ? "bg-zinc-400 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"}`}
        title="Resetar certificados da turma"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        {busy ? "Resetando…" : "Reset certificados da turma"}
      </button>
      {err && <span className="mt-1 text-xs text-red-600">{err}</span>}
    </div>
  );
}
