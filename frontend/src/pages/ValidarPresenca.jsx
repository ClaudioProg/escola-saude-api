//src/pages/ValidarPresenca.jsx
/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [status, setStatus] = useState("loading"); // loading | ok | erro
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");

  // helper: extrai query param
  const getParam = (name) => new URLSearchParams(search).get(name);

  useEffect(() => {
    async function run() {
      const bruto = getParam("codigo");
      if (!bruto) {
        setStatus("erro");
        setMensagem("Código ausente.");
        return;
      }
      const codigo = decodeURIComponent(bruto).trim();
      console.log("[Validar] codigo bruto:", codigo);

      // se 401 → pedir login e voltar
      const handle401 = () => {
        const redirect = `/validar?codigo=${encodeURIComponent(codigo)}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      };

      try {
        // 1) TOKEN (ex.: JWT contém pontos)
        if (codigo.includes(".")) {
          const r = await apiPost("/api/presencas/confirmar-via-token", { token: codigo });
          if (r?.sucesso || r?.ok) {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return setTimeout(() => navigate("/", { replace: true }), 2200);
          }
          throw new Error(r?.mensagem || "Falha ao confirmar via token.");
        }

        // 2) URL (http…) → tenta extrair turma_id
        if (/^https?:\/\//i.test(codigo)) {
          const url = new URL(codigo);
          // padrões aceitos:
          //  - /presenca/:id
          //  - ?turma_id=123
          let turmaId = url.searchParams.get("turma_id");
          if (!turmaId) {
            const parts = url.pathname.split("/").filter(Boolean);
            const i = parts.findIndex((p) => p.toLowerCase() === "presenca");
            if (i >= 0 && parts[i + 1]) turmaId = parts[i + 1];
          }
          if (!turmaId) throw new Error("Não foi possível identificar a turma no QR.");

          const r = await apiPost("/api/presencas/confirmarPresencaViaQR", {
            turma_id: Number(turmaId),
          });
          if (r?.sucesso || r?.ok) {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return setTimeout(() => navigate("/", { replace: true }), 2200);
          }
          throw new Error(r?.mensagem || "Falha ao confirmar presença (URL).");
        }

        // 3) Numérico puro → trata como turma_id
        if (/^\d+$/.test(codigo)) {
          const r = await apiPost("/api/presencas/confirmarPresencaViaQR", {
            turma_id: Number(codigo),
          });
          if (r?.sucesso || r?.ok) {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return setTimeout(() => navigate("/", { replace: true }), 2200);
          }
          throw new Error(r?.mensagem || "Falha ao confirmar presença.");
        }

        throw new Error("Formato de código não reconhecido.");
      } catch (err) {
        // se a lib apiPost expõe status:
        const statusHttp = err?.response?.status || err?.status;
        if (statusHttp === 401) return handle401();

        console.error("[Validar] erro:", err);
        setStatus("erro");
        setMensagem(
          err?.response?.data?.mensagem ||
            err?.message ||
            "Não foi possível confirmar. Verifique horário da turma e se você está logado."
        );
        setTimeout(() => navigate("/", { replace: true }), 3200);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      {status === "loading" && (
        <>
          <CarregandoSkeleton />
          <p className="mt-4">{mensagem}</p>
        </>
      )}
      {status !== "loading" && (
        <>
          <h1
            className={`text-2xl font-semibold ${
              status === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {status === "ok" ? "Presença confirmada" : "Falha na confirmação"}
          </h1>
          <p className="mt-3 text-gray-700">{mensagem}</p>
          <p className="mt-6 text-sm text-gray-500">Você será redirecionado…</p>
        </>
      )}
    </div>
  );
}
