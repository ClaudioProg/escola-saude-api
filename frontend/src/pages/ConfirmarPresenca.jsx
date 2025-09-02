// 📁 src/pages/ConfirmarPresenca.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
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

  // aceita ?t=, ?token= ou ?codigo= (compat)
  const tokenParam = sp.get("t") || sp.get("token") || sp.get("codigo");

  // perfil do usuário para decidir retorno
  const destinoDefault = useMemo(() => {
    try {
      const perfil = (JSON.parse(localStorage.getItem("usuario") || "{}")?.perfil || "").toLowerCase();
      if (perfil === "instrutor" || perfil === "administrador") return "/agenda-instrutor";
    } catch {}
    return "/dashboard";
  }, []);

  // helper POST com bearer e propagando status em caso de erro
  async function postJson(url, body) {
    const jwt = localStorage.getItem("token");
    const res = await fetch(`${apiBase}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(
        data?.erro ||
          data?.message ||
          `Erro HTTP ${res.status}${res.statusText ? " - " + res.statusText : ""}`
      );
      // propaga status pra chamador poder diferenciar 401
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const executar = useCallback(async () => {
    // precisa estar autenticado (as rotas são protegidas)
    const hasAuth = !!localStorage.getItem("token");
    if (!hasAuth) {
      setStatus("auth");
      setMensagem("Você precisa entrar para confirmar a presença.");
      return;
    }

    setStatus("loading");
    setMensagem("Processando sua confirmação...");

    try {
      if (tokenParam) {
        // fluxo via token assinado
        await postJson(`/api/presencas/confirmar-via-token`, { token: tokenParam });
      } else if (turmaId) {
        // fluxo via turmaId
        await postJson(`/api/presencas/confirmarPresencaViaQR`, { turma_id: turmaId });
      } else {
        throw Object.assign(new Error("Link inválido."), { status: 400 });
      }
      setStatus("ok");
      setMensagem("Presença registrada com sucesso!");
      // redireciona suave
      setTimeout(() => navigate(destinoDefault, { replace: true }), 1800);
    } catch (e) {
      if (e?.status === 401) {
        setStatus("auth");
        setMensagem("Sua sessão expirou. Entre novamente para confirmar a presença.");
      } else {
        setStatus("error");
        setMensagem(
          e?.message ||
            "Falha na confirmação. Verifique se a turma está no período correto."
        );
      }
    }
  }, [tokenParam, turmaId, destinoDefault, navigate]);

  useEffect(() => {
    executar();
  }, [executar]);

  const corMsg =
    status === "ok"
      ? "text-green-700"
      : status === "error"
      ? "text-red-700"
      : status === "auth"
      ? "text-amber-700"
      : "text-gray-600";

  const titulo =
    status === "ok"
      ? "Confirmação concluída"
      : status === "error"
      ? "Falha na confirmação"
      : status === "auth"
      ? "Autenticação necessária"
      : "Confirmando presença...";

  const handleLogin = () => {
    const back = encodeURIComponent(window.location.pathname + window.location.search);
    navigate(`/login?redirect=${back}`, { replace: true });
  };

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
          {titulo}
        </h1>

        <p className={`mt-3 ${corMsg}`}>{mensagem}</p>

        {status === "loading" && (
          <div className="mt-6 flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-center">
          {status === "auth" ? (
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1b4332] text-white hover:bg-[#14532d]"
            >
              Fazer login
            </button>
          ) : (
            <button
              onClick={executar}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1b4332] text-white hover:bg-[#14532d]"
            >
              Tentar novamente
            </button>
          )}

          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-200 dark:bg-zinc-700 dark:text-white hover:bg-gray-300"
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}
