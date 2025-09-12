// ✅ src/pages/ConfirmarPresenca.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { CheckCircle2, AlertTriangle, LogIn as LogInIcon } from "lucide-react";

import { apiPost } from "../services/api"; // ✅ cliente central

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
    const byParam = turmaIdParam ? parseInt(turmaIdParam, 10) : null;
    if (Number.isFinite(byParam) && byParam > 0) return byParam;

    const qRaw = sp.get("turma") || sp.get("turma_id") || sp.get("id") || "";
    const byQuery = parseInt(qRaw, 10);
    if (Number.isFinite(byQuery) && byQuery > 0) return byQuery;

    try {
      const decoded = decodeURIComponent(location.pathname || "");
      const norm = decoded.replace(/\/{2,}/g, "/");
      const m = norm.match(/\/presenca\/(\d+)/);
      if (m && m[1]) {
        const byPath = parseInt(m[1], 10);
        if (Number.isFinite(byPath) && byPath > 0) return byPath;
      }
    } catch {}
    return null;
  }, [turmaIdParam, sp, location.pathname]);

  const tokenParam = sp.get("t") || sp.get("token");

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
            const dec = decodeURIComponent(window.location.pathname + window.location.search);
            return encodeURIComponent(dec.replace(/\/{2,}/g, "/"));
          } catch {
            return encodeURIComponent(window.location.pathname + window.location.search);
          }
        })();

        setTimeout(() => navigate(`/login?redirect=${back}`, { replace: true }), 1200);
        return;
      }

      try {
        if (tokenParam) {
          // Fluxo com token assinado
          await apiPost("presencas/confirmar-via-token", { token: tokenParam });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else if (turmaId) {
          // Fluxo com turmaId
          await apiPost("presencas/confirmarPresencaViaQR", { turma_id: Number(turmaId) });
          setStatus("ok");
          setMensagem("Presença registrada com sucesso!");
        } else {
          throw new Error("Link inválido: turma ausente.");
        }
      } catch (e) {
        setStatus("error");
        setMensagem(
          e?.data?.erro ||
            e?.message ||
            "Falha na confirmação. Verifique se o período da turma permite registro."
        );
      }

      // Redireciona após exibir mensagem (instrutor/usuário pode ajustar destino depois)
      setTimeout(() => {
        navigate("/agenda-instrutor", { replace: true });
      }, 1800);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, tokenParam]);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟩 Faixa da página (tema presença/confirmar → verde) */}
      <PageHeader title="Confirmação de Presença" icon={CheckCircle2} variant="verde" />

      <main role="main" className="flex-1 px-4 py-8">
        <div className="max-w-md w-full mx-auto bg-white dark:bg-zinc-800 rounded-2xl shadow p-6 text-center">
          <h1
            className={`text-2xl font-bold ${
              status === "ok"
                ? "text-green-700"
                : status === "error"
                ? "text-red-700"
                : status === "auth"
                ? "text-amber-700"
                : "text-zinc-800 dark:text-white"
            }`}
            aria-live="polite"
          >
            {status === "ok"
              ? "Confirmação concluída"
              : status === "error"
              ? "Falha na confirmação"
              : status === "auth"
              ? "Autenticação necessária"
              : "Confirmando presença..."}
          </h1>

          <p
            className={`mt-3 ${
              status === "ok"
                ? "text-green-700"
                : status === "error"
                ? "text-red-700"
                : status === "auth"
                ? "text-amber-700"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {mensagem}
          </p>

          {status === "loading" && (
            <div className="mt-6">
              <CarregandoSkeleton height="20px" />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1b4332] text-white hover:bg-[#14532d]"
            >
              Voltar
            </button>

            {status === "auth" && (
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                <LogInIcon size={16} /> Fazer Login
              </button>
            )}

            {status === "error" && (
              <span className="inline-flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle size={16} />
                Tente novamente mais tarde.
              </span>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
