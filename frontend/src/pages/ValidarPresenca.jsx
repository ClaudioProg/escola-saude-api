// 📁 src/pages/ValidarPresenca.jsx — premium/robusto
/* eslint-disable no-console */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiGet } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

import { QrCode, CheckCircle2, XCircle, RefreshCcw, Copy, Home } from "lucide-react";

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/; // JWT x.y.z

function safeDecodeURIComponent(input) {
  if (!input) return "";
  try {
    return decodeURIComponent(input);
  } catch {
    return String(input);
  }
}

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const mountedRef = useRef(true);
  const runIdRef = useRef(0); // controla corrida (apenas o último run pode setar estado)
  const lockRef = useRef(false);

  const getParam = useCallback((name) => new URLSearchParams(search).get(name), [search]);
  const isDebug = getParam("debug") === "1" || getParam("dbg") === "1";

  const [status, setStatus] = useState("loading"); // loading | ok | erro
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");
  const [detalhe, setDetalhe] = useState("");

  const [codigoNormalizado, setCodigoNormalizado] = useState(""); // só pra debug/suporte
  const [turmaDetectada, setTurmaDetectada] = useState(""); // só pra debug/suporte

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = (fn) => {
    if (mountedRef.current) fn();
  };

  // Link canônico de validação (útil para suporte)
  const linkValidacao = useMemo(() => {
    const url = new URL(window.location.href);
    return url.toString();
  }, [search]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);
      // feedback leve (sem depender de toast, mas pode usar)
      safeSet(() => setDetalhe("Link copiado para a área de transferência."));
    } catch {
      safeSet(() => setDetalhe("Não foi possível copiar automaticamente (permissão do navegador)."));
      // sem prompt invasivo
    }
  };

  const goHome = useCallback(
    (ms = 2200) => {
      if (isDebug) return; // em debug não redireciona
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        navigate("/", { replace: true });
      }, ms);
    },
    [isDebug, navigate]
  );

  const handle401 = useCallback(
    (codigo) => {
      if (isDebug) {
        safeSet(() => {
          setStatus("erro");
          setMensagem("Não autenticado (401).");
          setDetalhe("Faça login e tente novamente.");
        });
        return;
      }
      const redirect = `/validar-presenca?codigo=${encodeURIComponent(codigo)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    },
    [isDebug, navigate]
  );

  const extrairTurmaIdDeUrl = (rawUrl) => {
    const url = new URL(rawUrl);

    // primeiro tenta query
    let turmaId =
      url.searchParams.get("turma_id") ||
      url.searchParams.get("turmaId") ||
      url.searchParams.get("turma");

    // fallback: tenta inferir do path (mais resiliente)
    if (!turmaId) {
      const parts = url.pathname.split("/").filter(Boolean);
      // tenta encontrar "confirmar" e pegar o próximo
      const idxConfirmar = parts.findIndex((p) => p.toLowerCase() === "confirmar");
      if (idxConfirmar >= 0 && parts[idxConfirmar + 1]) turmaId = parts[idxConfirmar + 1];

      // tenta "presencas/confirmar/:id"
      if (!turmaId) {
        const idxPresencas = parts.findIndex((p) => p.toLowerCase() === "presencas");
        const idx = parts.findIndex((p) => p.toLowerCase() === "confirmar");
        if (idxPresencas >= 0 && idx >= 0 && parts[idx + 1]) turmaId = parts[idx + 1];
      }

      // último fallback: último segmento
      if (!turmaId) turmaId = parts.at(-1);
    }

    return turmaId;
  };

  // Função principal de validação
  const runValidacao = useCallback(
    async (opts = { force: false }) => {
      const { force } = opts || {};
      const myRunId = ++runIdRef.current;

      if (lockRef.current && !force) return;
      lockRef.current = true;

      safeSet(() => {
        setStatus("loading");
        setMensagem("Validando seu QR Code…");
        setDetalhe("");
        setCodigoNormalizado("");
        setTurmaDetectada("");
      });

      const bruto = getParam("codigo");
      if (!bruto) {
        if (myRunId !== runIdRef.current) return;
        safeSet(() => {
          setStatus("erro");
          setMensagem("Código ausente.");
          setDetalhe("Abra novamente pelo QR Code ou confira o link.");
        });
        lockRef.current = false;
        return;
      }

      const codigo = safeDecodeURIComponent(bruto).trim();
      safeSet(() => setCodigoNormalizado(codigo));

      if (isDebug) console.log("[ValidarPresenca] codigo:", codigo);

      try {
        // 1) QR com URL → extrair turma_id
        if (/^https?:\/\//i.test(codigo)) {
          if (isDebug) console.log("[ValidarPresenca] via URL");

          let turmaId = "";
          try {
            turmaId = extrairTurmaIdDeUrl(codigo);
          } catch {
            throw new Error("URL inválida no QR.");
          }

          safeSet(() => setTurmaDetectada(String(turmaId || "")));

          if (!/^\d+$/.test(String(turmaId || ""))) {
            throw new Error("Não foi possível identificar a turma no QR.");
          }

          // tentativa 1: GET confirmar/:turmaId
          try {
            const r = await apiGet(`presencas/confirmar/${Number(turmaId)}`);
            if (myRunId !== runIdRef.current) return;

            safeSet(() => {
              setStatus("ok");
              setMensagem(r?.mensagem || "Presença confirmada!");
            });

            lockRef.current = false;
            return goHome();
          } catch (e1) {
            if (isDebug) console.warn("[ValidarPresenca] fallback POST confirmarPresencaViaQR", e1?.message);

            // tentativa 2: POST confirmarPresencaViaQR
            const r2 = await apiPost("presencas/confirmarPresencaViaQR", { turma_id: Number(turmaId) });
            if (myRunId !== runIdRef.current) return;

            safeSet(() => {
              setStatus("ok");
              setMensagem(r2?.mensagem || "Presença confirmada!");
            });

            lockRef.current = false;
            return goHome();
          }
        }

        // 2) Número puro → turma_id
        if (/^\d+$/.test(codigo)) {
          if (isDebug) console.log("[ValidarPresenca] via ID");
          safeSet(() => setTurmaDetectada(codigo));

          const r = await apiGet(`presencas/confirmar/${Number(codigo)}`);
          if (myRunId !== runIdRef.current) return;

          safeSet(() => {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
          });

          lockRef.current = false;
          return goHome();
        }

        // 3) JWT → confirmar via token
        if (JWT_REGEX.test(codigo)) {
          if (isDebug) console.log("[ValidarPresenca] via TOKEN");

          const r = await apiPost("presencas/confirmar-via-token", { token: codigo });
          if (myRunId !== runIdRef.current) return;

          safeSet(() => {
            setStatus("ok");
            setMensagem(r?.mensagem || "Presença confirmada!");
          });

          lockRef.current = false;
          return goHome();
        }

        throw new Error("Formato de código não reconhecido.");
      } catch (err) {
        const statusHttp = err?.status || err?.response?.status;

        if (statusHttp === 401) {
          lockRef.current = false;
          return handle401(codigo);
        }

        console.error("[ValidarPresenca] erro:", err);

        if (myRunId !== runIdRef.current) return;

        safeSet(() => {
          setStatus("erro");
          setMensagem(
            err?.data?.erro ||
              err?.response?.data?.mensagem ||
              err?.message ||
              "Não foi possível confirmar."
          );
          setDetalhe(
            "Confira: login ativo, inscrição na turma, janela de confirmação (tempo), e conexão com o backend."
          );
        });
      } finally {
        if (myRunId === runIdRef.current) lockRef.current = false;
      }
    },
    [getParam, isDebug, goHome, handle401]
  );

  const tentarNovamente = () => {
    // força re-run mesmo se lock estiver ativo
    runValidacao({ force: true });
  };

  // Dispara validação no mount / mudança de query
  useEffect(() => {
    runValidacao({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // UI helpers
  const tone =
    status === "ok"
      ? "text-green-700 dark:text-green-400"
      : status === "erro"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-700 dark:text-gray-300";

  const badge =
    status === "ok" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Confirmada
      </span>
    ) : status === "erro" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <XCircle className="w-4 h-4" /> Falhou
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
        Validando…
      </span>
    );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <PageHeader title="Validar Presença" icon={QrCode} variant="laranja" />

      <main id="conteudo" role="main" className="flex-1">
        <section
          aria-live="polite"
          aria-atomic="true"
          className="min-h-[60vh] flex items-center justify-center px-4 py-10"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-6 sm:p-8">
            {status === "loading" && (
              <>
                <CarregandoSkeleton height="120px" />
                <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                  {mensagem}
                </p>
              </>
            )}

            {status !== "loading" && (
              <>
                <div className="flex items-center justify-center mb-3">{badge}</div>

                <h1
                  className={`text-xl sm:text-2xl font-semibold text-center ${tone}`}
                  role={status === "erro" ? "alert" : "status"}
                >
                  {status === "ok" ? "Presença confirmada" : "Falha na confirmação"}
                </h1>

                <p className="mt-3 text-center text-slate-700 dark:text-slate-300">
                  {mensagem}
                </p>

                {(isDebug || detalhe) && (
                  <div className="mt-4 rounded-xl border border-black/5 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 p-4">
                    {detalhe ? (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words">
                        {detalhe}
                      </p>
                    ) : null}

                    {isDebug && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">Código</div>
                          <div className="font-mono break-all">{codigoNormalizado || "—"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-400">Turma detectada</div>
                          <div className="font-mono break-all">{turmaDetectada || "—"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isDebug && status === "ok" && (
                  <p className="mt-6 text-center text-xs sm:text-sm text-slate-500">
                    Você será redirecionado…
                  </p>
                )}

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {status === "erro" && (
                    <button
                      onClick={tentarNovamente}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Tentar novamente
                    </button>
                  )}

                  <button
                    onClick={copiarLink}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                    aria-label="Copiar link de validação"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar link
                  </button>

                  <button
                    onClick={() => navigate("/", { replace: true })}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-semibold"
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

      <Footer />
    </div>
  );
}
