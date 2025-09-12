// 📁 src/pages/ValidarPresenca.jsx
/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiGet } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

// 🧩 novos componentes (faixa + rodapé)
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

// Ícones para header (e acessibilidade se quiser usar depois)
import { QrCode } from "lucide-react";

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/; // JWT x.y.z

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const [status, setStatus] = useState("loading"); // loading | ok | erro
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");
  const [detalhe, setDetalhe] = useState("");

  const getParam = (name) => new URLSearchParams(search).get(name);
  const isDebug = getParam("debug") === "1" || getParam("dbg") === "1";

  useEffect(() => {
    let cancelado = false;

    async function run() {
      // Protege contra decodeURIComponent quebrar
      const bruto = getParam("codigo");
      if (!bruto) {
        setStatus("erro");
        setMensagem("Código ausente.");
        return;
      }

      let codigo;
      try {
        codigo = decodeURIComponent(bruto).trim();
      } catch {
        codigo = (bruto || "").trim();
      }

      if (isDebug) console.log("[Validar] codigo:", codigo);

      const goHome = (ms = 2200) => {
        if (isDebug) return; // em debug não redireciona
        setTimeout(() => {
          if (!cancelado) navigate("/", { replace: true });
        }, ms);
      };

      const handle401 = () => {
        if (isDebug) {
          setStatus("erro");
          setMensagem("Não autenticado (401).");
          setDetalhe("Faça login e tente novamente.");
          return;
        }
        const redirect = `/validar-presenca?codigo=${encodeURIComponent(codigo)}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      };

      try {
        // ─────────────────────────────────────────────────────
        // 1) QR com URL → extrair turma_id da query ou do path
        // ─────────────────────────────────────────────────────
        if (/^https?:\/\//i.test(codigo)) {
          if (isDebug) console.log("[Validar] via URL");
          const url = new URL(codigo);
          let turmaId =
            url.searchParams.get("turma_id") ||
            url.searchParams.get("turmaId") ||
            (() => {
              const parts = url.pathname.split("/").filter(Boolean);
              const i = parts.findIndex((p) => p.toLowerCase() === "presenca");
              return i >= 0 && parts[i + 1] ? parts[i + 1] : parts.at(-1);
            })();

          if (!/^\d+$/.test(String(turmaId || ""))) {
            throw new Error("Não foi possível identificar a turma no QR.");
          }

          try {
            const r = await apiGet(`presencas/confirmar/${Number(turmaId)}`);
            if (cancelado) return;
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
            return goHome();
          } catch (e1) {
            if (isDebug) console.warn("[Validar] fallback POST confirmarPresencaViaQR", e1?.message);
            const r2 = await apiPost("presencas/confirmarPresencaViaQR", {
              turma_id: Number(turmaId),
            });
            if (cancelado) return;
            setStatus("ok");
            setMensagem(r2?.mensagem || "Presença confirmada!");
            return goHome();
          }
        }

        // ─────────────────────────────────────────────────────
        // 2) Número puro → tratar como turma_id
        // ─────────────────────────────────────────────────────
        if (/^\d+$/.test(codigo)) {
          if (isDebug) console.log("[Validar] via ID");
          const r = await apiGet(`presencas/confirmar/${Number(codigo)}`);
          if (cancelado) return;
          setStatus("ok");
          setMensagem(r?.mensagem || "Presença confirmada!");
          return goHome();
        }

        // ─────────────────────────────────────────────────────
        // 3) JWT x.y.z → confirmar via token
        // ─────────────────────────────────────────────────────
        if (JWT_REGEX.test(codigo)) {
          if (isDebug) console.log("[Validar] via TOKEN");
          const r = await apiPost("presencas/confirmar-via-token", { token: codigo });
          if (cancelado) return;
          setStatus("ok");
          setMensagem(r?.mensagem || "Presença confirmada!");
          return goHome();
        }

        // Caso não bata em nenhum formato
        throw new Error("Formato de código não reconhecido.");
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
    return () => {
      cancelado = true; // evita state update após unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 🟧 Faixa compacta e centralizada */}
      <PageHeader title="Validar Presença" icon={QrCode} variant="laranja" />

      {/* Conteúdo */}
      <main role="main" className="flex-1">
        <section
          aria-live="polite"
          aria-atomic="true"
          className="max-w-xl mx-auto p-6 text-center"
        >
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
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
