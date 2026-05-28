// ✅ frontend/src/components/ui/AtualizacaoPlataformaBanner.jsx — v2.0
// Atualizado em: 28/05/2026
//
// Banner global para atualização controlada da Plataforma Escola da Saúde.
// Aparece quando /version.json indica que há uma versão nova disponível.

import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { usePlatformVersionCheck } from "../../hooks/usePlatformVersionCheck";

function formatarBuildAt(buildAt) {
  if (!buildAt) return null;

  const data = new Date(buildAt);

  if (Number.isNaN(data.getTime())) return null;

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AtualizacaoPlataformaBanner() {
  const { novaVersaoDisponivel, versaoNova, atualizarPlataforma } =
    usePlatformVersionCheck();

  const [oculto, setOculto] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  if (!novaVersaoDisponivel || oculto) return null;

  const buildFormatado = formatarBuildAt(versaoNova?.buildAt);

  const handleAtualizar = async () => {
    if (atualizando) return;

    setAtualizando(true);
    await atualizarPlataforma();
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-3 sm:px-4 sm:pb-4"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl shadow-blue-900/10 dark:border-blue-800/70 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Nova versão da plataforma disponível
          </p>

          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Atualize para carregar os arquivos mais recentes da Escola da
            Saúde.
            {buildFormatado ? (
              <>
                {" "}
                Build: <span className="font-medium">{buildFormatado}</span>.
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleAtualizar}
            disabled={atualizando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw
              className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {atualizando ? "Atualizando..." : "Atualizar plataforma"}
          </button>

          <button
            type="button"
            onClick={() => setOculto(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Ocultar aviso de atualização"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}