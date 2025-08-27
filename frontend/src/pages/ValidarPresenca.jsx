// 📁 src/pages/ValidarPresenca.jsx
/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiGet } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [status, setStatus] = useState("loading"); // loading | ok | erro
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");
  const [detalhe, setDetalhe] = useState("");

  const getParam = (name) => new URLSearchParams(search).get(name);
  const isDebug = getParam("debug") === "1" || getParam("dbg") === "1";

  useEffect(() => {
    async function run() {
      const bruto = getParam("codigo");
      if (!bruto) {
        setStatus("erro");
        setMensagem("Código ausente.");
        return;
      }
      const codigo = decodeURIComponent(bruto).trim();
      if (isDebug) console.log("[Validar] codigo:", codigo);

      const goHome = (ms = 2200) => {
        if (isDebug) return; // em debug não redireciona
        setTimeout(() => navigate("/", { replace: true }), ms);
      };

      const handle401 = () => {
        if (isDebug) {
          setStatus("erro");
          setMensagem("Não autenticado (401).");
          setDetalhe("Faça login e tente novamente.");
          return;
        }
        const redirect = `/validar?codigo=${encodeURIComponent(codigo)}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      };

      try {
        // 1) TOKEN (tem ponto)
        if (codigo.includes(".")) {
          if (isDebug) console.log("[Validar] via TOKEN");
          const r = await apiPost("presencas/confirmar-via-token", { token: codigo });
          if (r?.sucesso || r?.ok || r?.mensagem) {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return goHome();
          }
          throw new Error(r?.mensagem || "Falha ao confirmar via token.");
        }

        // 2) URL → extrair turma_id
        let turmaId = null;
        if (/^https?:\/\//i.test(codigo)) {
          const url = new URL(codigo);
          turmaId = url.searchParams.get("turma_id");
          if (!turmaId) {
            const parts = url.pathname.split("/").filter(Boolean);
            const i = parts.findIndex((p) => p.toLowerCase() === "presenca");
            if (i >= 0 && parts[i + 1]) turmaId = parts[i + 1];
          }
        }

        // 3) Numérico puro?
        if (!turmaId && /^\d+$/.test(codigo)) turmaId = codigo;

        if (!turmaId) throw new Error("Não foi possível identificar a turma no QR.");

        // ---- chamada principal (POST novo) ----
        if (isDebug) console.log("[Validar] POST confirmarPresencaViaQR turma_id=", turmaId);
        try {
          const r = await apiPost("presencas/confirmarPresencaViaQR", { turma_id: Number(turmaId) });
          if (r?.sucesso || r?.ok || r?.mensagem) {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return goHome();
          }
          throw new Error(r?.mensagem || "Falha ao confirmar (POST).");
        } catch (e) {
          // ---- fallback p/ rotas antigas (GET/POST por params) ----
          if (isDebug) console.warn("[Validar] fallback GET /confirmar-qr/:id", e?.message || e);
          try {
            const r2 = await apiGet(`presencas/confirmar-qr/${Number(turmaId)}`);
            if (r2?.sucesso || r2?.ok || r2?.mensagem) {
              setStatus("ok");
              setMensagem(r2?.mensagem || "Presença confirmada!");
              return goHome();
            }
            throw new Error(r2?.mensagem || "Falha no fallback (GET).");
          } catch (e2) {
            throw e2;
          }
        }
      } catch (err) {
        const statusHttp = err?.status || err?.response?.status;
        if (statusHttp === 401) return handle401();
        console.error("[Validar] erro final:", err);
        setStatus("erro");
        setMensagem(
          err?.data?.erro ||
            err?.response?.data?.mensagem ||
            err?.message ||
            "Não foi possível confirmar."
        );
        setDetalhe(
          "Confira: login ativo, CORS do backend, endpoint /presencas, inscrição na turma e janela de datas."
        );
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
          {isDebug && detalhe && <p className="mt-2 text-sm text-gray-500">{detalhe}</p>}
          {!isDebug && <p className="mt-6 text-sm text-gray-500">Você será redirecionado…</p>}
        </>
      )}
    </div>
  );
}
