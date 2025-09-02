import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const apiBase =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "/api";

export default function ConfirmarPresenca() {
  const { turmaId: turmaIdParam } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading | ok | error | auth
  const [mensagem, setMensagem] = useState("Processando sua confirmação...");
  const turmaId = useMemo(
    () => (turmaIdParam ? parseInt(turmaIdParam, 10) : null),
    [turmaIdParam]
  );
  const tokenParam = sp.get("t") || sp.get("token"); // link com token opcional

  // helper de POST com token do localStorage
  async function postJson(url, body) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${apiBase}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.erro ||
        data?.message ||
        `Erro HTTP ${res.status}${res.statusText ? " - " + res.statusText : ""}`;
      throw new Error(msg);
    }
    return data;
  }

  useEffect(() => {
    (async () => {
      // precisa estar autenticado (rota exige auth)
      const hasAuth = !!localStorage.getItem("token");
      if (!hasAuth) {
        setStatus("auth");
        setMensagem("Você precisa entrar para confirmar a presença.");
        // redireciona para login mantendo retorno
        setTimeout(() => {
          const back = encodeURIComponent(window.location.pathname + window.location.search);
          navigate(`/login?redirect=${back}`, { replace: true });
        }, 1500);
        return;
      }

      try {
        // 1) se veio token no link (?t=...), usar confirmação por token
        if (tokenParam) {
          await postJson(`/api/presencas/confirmar-via-token`, { token: tokenParam });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else if (turmaId) {
          // 2) fluxo padrão via turmaId
          await postJson(`/api/presencas/confirmarPresencaViaQR`, { turma_id: turmaId });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else {
          throw new Error("Link inválido.");
        }
      } catch (e) {
        setStatus("error");
        setMensagem(
          e?.message ||
            "Falha na confirmação. Hoje pode não estar dentro do período da turma."
        );
      }

      // redireciona suave após mensagem
      setTimeout(() => {
        navigate("/agenda-instrutor", { replace: true }); // ajuste o destino se preferir
      }, 2000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, tokenParam]);

  const color =
    status === "ok"
      ? "text-green-700"
      : status === "error"
      ? "text-red-700"
      : status === "auth"
      ? "text-amber-700"
      : "text-gray-600";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-2xl shadow p-6 text-center">
        <h1
          className={`text-2xl font-bold ${
            status === "ok"
              ? "text-green-700"
              : status === "error"
              ? "text-red-700"
              : "text-zinc-800 dark:text-white"
          }`}
        >
          {status === "ok"
            ? "Confirmação concluída"
            : status === "error"
            ? "Falha na confirmação"
            : status === "auth"
            ? "Autenticação necessária"
            : "Confirmando presença..."}
        </h1>

        <p className={`mt-3 ${color}`}>{mensagem}</p>

        {status === "loading" && (
          <div className="mt-6 flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1b4332] text-white hover:bg-[#14532d]"
        >
          Voltar
        </button>
      </div>
    </main>
  );
}
