// 📁 src/pages/ValidarPresenca.jsx
/* eslint-disable no-console */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiGet } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

// 🧩 faixa + rodapé padronizados
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

// Ícones
import { QrCode, CheckCircle2, XCircle, RefreshCcw, Copy, Home } from "lucide-react";

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/; // JWT x.y.z

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const getParam = useCallback((name) => new URLSearchParams(search).get(name), [search]);
  const isDebug = getParam("debug") === "1" || getParam("dbg") === "1";

  const [status, setStatus] = useState("loading"); // loading | ok | erro
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");
  const [detalhe, setDetalhe] = useState("");

  // Link canônico de validação (útil para suporte)
  const linkValidacao = useMemo(() => {
    const url = new URL(window.location.href);
    return url.toString();
  }, [search]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);
      setDetalhe("Link copiado para a área de transferência.");
    } catch {
      // fallback: prompt
      prompt("Copie o link de validação:", linkValidacao);
    }
  };

  const tentarNovamente = () => {
    // força um "reload" lógico, preservando a URL
    setStatus("loading");
    setMensagem("Validando seu QR Code…");
    setDetalhe("");
    // dispara novamente o efeito abaixo via alteração falsa de search (ou apenas setState + run())
    runValidacao(true);
  };

  // A função principal de validação (extraída para reuso em "tentar novamente")
  const runValidacao = useCallback(
    async (force = false) => {
      let cancelado = false;

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
        // 1) QR com URL → extrair turma_id da query ou do path
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
            const r2 = await apiPost("presencas/confirmarPresencaViaQR", { turma_id: Number(turmaId) });
            if (cancelado) return;
            setStatus("ok");
            setMensagem(r2?.mensagem || "Presença confirmada!");
            return goHome();
          }
        }

        // 2) Número puro → tratar como turma_id
        if (/^\d+$/.test(codigo)) {
          if (isDebug) console.log("[Validar] via ID");
          const r = await apiGet(`presencas/confirmar/${Number(codigo)}`);
          if (cancelado) return;
          setStatus("ok");
          setMensagem(r?.mensagem || "Presença confirmada!");
          return goHome();
        }

        // 3) JWT x.y.z → confirmar via token
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

      return () => {
        cancelado = true;
      };
    },
    [getParam, isDebug, navigate]
  );

  // Dispara validação no mount / mudança de query
  useEffect(() => {
    runValidacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // UI helpers
  const tone = status === "ok" ? "text-green-700 dark:text-green-400" :
               status === "erro" ? "text-red-600 dark:text-red-400" :
               "text-gray-700 dark:text-gray-300";

  const badge = status === "ok" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      <CheckCircle2 className="w-4 h-4" /> Confirmada
    </span>
  ) : status === "erro" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      <XCircle className="w-4 h-4" /> Falhou
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
      Validando…
    </span>
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      {/* 🟧 Faixa compacta e centralizada */}
      <PageHeader title="Validar Presença" icon={QrCode} variant="laranja" />

      {/* Conteúdo */}
      <main id="conteudo" role="main" className="flex-1">
        <section
          aria-live="polite"
          aria-atomic="true"
          className="min-h-[60vh] flex items-center justify-center px-4 py-10"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-6 sm:p-8">
            {/* Estado: carregando */}
            {status === "loading" && (
              <>
                <CarregandoSkeleton height="120px" />
                <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">{mensagem}</p>
              </>
            )}

            {/* Estado: ok/erro */}
            {status !== "loading" && (
              <>
                <div className="flex items-center justify-center mb-3">{badge}</div>

                <h1
                  className={`text-xl sm:text-2xl font-semibold text-center ${tone}`}
                  role={status === "erro" ? "alert" : "status"}
                >
                  {status === "ok" ? "Presença confirmada" : "Falha na confirmação"}
                </h1>

                <p className="mt-3 text-center text-slate-700 dark:text-slate-300">{mensagem}</p>

                {isDebug && detalhe && (
                  <p className="mt-3 text-center text-xs sm:text-sm text-slate-500 break-words">{detalhe}</p>
                )}

                {!isDebug && (
                  <p className="mt-6 text-center text-xs sm:text-sm text-slate-500">Você será redirecionado…</p>
                )}

                {/* Ações úteis (não aparecem durante loading) */}
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {status === "erro" && (
                    <button
                      onClick={tentarNovamente}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Tentar novamente
                    </button>
                  )}

                  <button
                    onClick={copiarLink}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                    aria-label="Copiar link de validação"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </button>

                  <button
                    onClick={() => navigate("/", { replace: true })}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <Home className="w-4 h-4" />
                    Início
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
