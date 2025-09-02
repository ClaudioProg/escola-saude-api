// 📁 src/pages/ConfirmarPresenca.jsx
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

const apiBase =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "/api";

export default function ConfirmarPresenca() {
  const { turmaId: turmaIdParam } = useParams();
  const [sp] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading | ok | error | auth
  const [mensagem, setMensagem] = useState("Processando sua confirmação...");

  // Extrai turmaId de:
  // 1) /presenca/:turmaId
  // 2) ?turma / ?turma_id / ?id
  // 3) pathname possivelmente codificado: "/%2Fpresenca%2F13"
  const turmaId = useMemo(() => {
    // 1) parámetro da rota
    const byParam = turmaIdParam ? parseInt(turmaIdParam, 10) : null;
    if (Number.isFinite(byParam) && byParam > 0) return byParam;

    // 2) querystring
    const qRaw =
      sp.get("turma") || sp.get("turma_id") || sp.get("id") || "";
    const byQuery = parseInt(qRaw, 10);
    if (Number.isFinite(byQuery) && byQuery > 0) return byQuery;

    // 3) pathname quebrado/encodado
    try {
      const decoded = decodeURIComponent(location.pathname || "");
      const norm = decoded.replace(/\/{2,}/g, "/");
      const m = norm.match(/\/presenca\/(\d+)/);
      if (m && m[1]) {
        const byPath = parseInt(m[1], 10);
        if (Number.isFinite(byPath) && byPath > 0) return byPath;
      }
    } catch {
      /* no-op */
    }
    return null;
  }, [turmaIdParam, sp, location.pathname]);

  const tokenParam = sp.get("t") || sp.get("token");

  // Helper POST JSON com bearer do localStorage
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
        `Erro HTTP ${res.status}${
          res.statusText ? " - " + res.statusText : ""
        }`;
      throw new Error(msg);
    }
    return data;
  }

  useEffect(() => {
    (async () => {
      // Exige autenticação
      const hasAuth = !!localStorage.getItem("token");
      if (!hasAuth) {
        setStatus("auth");
        setMensagem("Você precisa entrar para confirmar a presença.");
        // preserva o retorno (decodifica → normaliza → re-encoda)
        const back = (() => {
          try {
            const dec = decodeURIComponent(
              window.location.pathname + window.location.search
            );
            return encodeURIComponent(dec.replace(/\/{2,}/g, "/"));
          } catch {
            return encodeURIComponent(
              window.location.pathname + window.location.search
            );
          }
        })();
        setTimeout(() => {
          navigate(`/login?redirect=${back}`, { replace: true });
        }, 1200);
        return;
      }

      try {
        if (tokenParam) {
          // Fluxo com token assinado
          await postJson(`/api/presencas/confirmar-via-token`, {
            token: tokenParam,
          });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else if (turmaId) {
          // Fluxo com turmaId
          await postJson(`/api/presencas/confirmarPresencaViaQR`, {
            turma_id: turmaId,
          });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else {
          throw new Error("Link inválido. (turma ausente)");
        }
      } catch (e) {
        setStatus("error");
        setMensagem(
          e?.message ||
            "Falha na confirmação. Hoje pode não estar dentro do período da turma."
        );
      }

      // Redireciona após exibir mensagem
      setTimeout(() => {
        navigate("/agenda-instrutor", { replace: true });
      }, 1800);
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
          <div className="mt-6 flex justify-center" aria-label="Carregando">
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
