// ✅ src/pages/ConfirmarPresenca.jsx (JS puro)
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiPost } from "../services/api";

export default function ConfirmarPresenca() {
  const [searchParams] = useSearchParams();
  const { turmaId: turmaIdFromPath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // turma pode vir como /presenca?turma=123 ou /presenca/123
  const turmaId = useMemo(() => {
    return searchParams.get("turma") || turmaIdFromPath || "";
  }, [searchParams, turmaIdFromPath]);

  const [status, setStatus] = useState("loading"); // "loading" | "ok" | "err"
  const [msg, setMsg] = useState("Confirmando presença…");

  useEffect(() => {
    (async () => {
      if (!turmaId || !/^\d+$/.test(String(turmaId))) {
        setStatus("err");
        setMsg("Parâmetro 'turma' ausente ou inválido.");
        return;
      }

      try {
        // Rota AUTENTICADA do backend
        await apiPost(`/api/presencas/confirmar-qr/${encodeURIComponent(turmaId)}`, {});
        setStatus("ok");
        setMsg("✅ Presença confirmada com sucesso!");
      } catch (e) {
        const code = e?.status || e?.response?.status;

        if (code === 401) {
          // não logado → vai para login e volta pra cá
          const next = `${location.pathname}?turma=${encodeURIComponent(String(turmaId))}`;
          navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
          return;
        }

        if (code === 403) {
          setStatus("err");
          setMsg("Acesso negado: você não está inscrito nesta turma.");
          return;
        }

        if (code === 409) {
          setStatus("err");
          setMsg("Hoje não está dentro do período desta turma.");
          return;
        }

        setStatus("err");
        setMsg("Não foi possível confirmar a presença. Tente novamente.");
      }
    })();
  }, [turmaId, navigate, location.pathname]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Confirmação de Presença</h1>
        <p className={status === "ok" ? "text-emerald-700" : status === "err" ? "text-red-600" : "text-gray-700"}>
          {msg}
        </p>

        {status !== "loading" && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
            >
              Ir para a Home
            </button>
            <button
              onClick={() => navigate("/minhas-presencas")}
              className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
            >
              Ver minhas presenças
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
