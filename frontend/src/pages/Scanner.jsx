// ✅ frontend/src/pages/Scanner.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Scanner oficial de QR Code para presença.
//
// Contratos aplicados:
// - Sem toast direto;
// - Sem BotaoPrimario antigo;
// - Sem Footer antigo;
// - Sem CarregandoSkeleton/ErroCarregamento em caminho antigo;
// - Sem bg-gelo;
// - Sem style inline;
// - Sem navegar para /validar-presenca?codigo=...;
// - Sem QR chamando rota livre;
// - QR oficial deve conter:
//   1) URL com ?turma_id=123
//   2) URL com ?token=...
//   3) JSON { "turma_id": 123 }
//   4) JSON { "token": "..." }
//   5) número puro representando turma_id
// - Registro por turma: api.presenca.confirmarQr(turma_id);
// - Registro por token: api.presenca.confirmarToken(token);
// - Footer em src/components/layout/Footer.jsx;
// - CarregandoSkeleton e ErroCarregamento em src/components/ui/;
// - AppToast em src/components/ui/AppToast;
// - Acessível, mobile-first, dark mode, motion-safe e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { api } from "../services/api";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "../components/ui/AppToast";

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isSecureOk() {
  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function mapCameraError(error) {
  const name = String(error?.name || error?.message || "");

  if (/InsecureContext/i.test(name) || !isSecureOk()) {
    return "O acesso à câmera requer conexão segura HTTPS. Em desenvolvimento, use localhost.";
  }

  if (/NotAllowedError|Permission/i.test(name)) {
    return "Permissão de câmera negada. Habilite o acesso nas configurações do navegador.";
  }

  if (/NotFoundError|DevicesNotFound|No camera/i.test(name)) {
    return "Nenhuma câmera foi encontrada neste dispositivo.";
  }

  if (/NotReadableError|TrackStartError|AbortError/i.test(name)) {
    return "A câmera está em uso por outro aplicativo. Feche outros apps e tente novamente.";
  }

  return "Erro ao iniciar o scanner.";
}

function computeQrbox() {
  const max = 320;
  const min = 210;
  const padding = 32;
  const base = Math.min(window.innerWidth, 560) - padding;

  return Math.min(max, Math.max(min, Math.floor(base * 0.9)));
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeAtob(value) {
  try {
    return atob(value);
  } catch {
    const pad =
      value.length % 4 === 2 ? "==" : value.length % 4 === 3 ? "=" : "";

    try {
      return atob(value + pad);
    } catch {
      return "";
    }
  }
}

function getRawToken() {
  try {
    const raw = localStorage.getItem("token");

    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

function getValidToken() {
  const raw = getRawToken();

  if (!raw) return null;

  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  const parts = token.split(".");

  if (parts.length !== 3) return null;

  try {
    const payloadStr = safeAtob(
      parts[1].replace(/-/g, "+").replace(/_/g, "/")
    );

    const payload = JSON.parse(payloadStr || "{}");
    const now = Date.now() / 1000;

    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;

    return token;
  } catch {
    return null;
  }
}

function getNomeUsuario() {
  try {
    return localStorage.getItem("nome") || "usuário";
  } catch {
    return "usuário";
  }
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

/* ─────────────────────────────────────────────────────────────
 * QR oficial
 * ───────────────────────────────────────────────────────────── */

function parseQrPayload(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      ok: false,
      message: "Conteúdo do QR Code vazio.",
    };
  }

  const numeroDireto = toPositiveInt(raw);

  if (numeroDireto) {
    return {
      ok: true,
      tipo: "turma",
      turma_id: numeroDireto,
    };
  }

  try {
    const maybeUrl = new URL(raw);
    const turmaId = toPositiveInt(maybeUrl.searchParams.get("turma_id"));
    const token = String(maybeUrl.searchParams.get("token") || "").trim();

    if (turmaId) {
      return {
        ok: true,
        tipo: "turma",
        turma_id: turmaId,
      };
    }

    if (token) {
      return {
        ok: true,
        tipo: "token",
        token,
      };
    }

    return {
      ok: false,
      message:
        "URL de QR inválida. O QR oficial precisa conter turma_id ou token.",
    };
  } catch {
    // Não era URL. Tenta JSON.
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        message: "JSON do QR Code inválido.",
      };
    }

    const turmaId = toPositiveInt(parsed.turma_id);
    const token = String(parsed.token || "").trim();

    if (turmaId) {
      return {
        ok: true,
        tipo: "turma",
        turma_id: turmaId,
      };
    }

    if (token) {
      return {
        ok: true,
        tipo: "token",
        token,
      };
    }

    return {
      ok: false,
      message:
        "JSON do QR inválido. Use somente { turma_id } ou { token } no contrato oficial.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Conteúdo do QR Code inválido. Use QR oficial com turma_id ou token.",
    };
  }
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais v2.0
 * ───────────────────────────────────────────────────────────── */

function MiniStats({ cameras, ready, status }) {
  return (
    <section
      className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"
      aria-label="Resumo do scanner"
    >
      <article className="rounded-3xl border border-slate-200 bg-white p-3 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Câmeras
        </p>
        <p className="mt-1 text-xl font-black tabular-nums">{cameras ?? "—"}</p>
      </article>

      <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3 text-center shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Pronto
        </p>
        <p className="mt-1 text-xl font-black">{ready ? "Sim" : "Não"}</p>
      </article>

      <article className="rounded-3xl border border-orange-200 bg-orange-50 p-3 text-center shadow-sm dark:border-orange-900/50 dark:bg-orange-950/30">
        <p className="text-[11px] font-black uppercase tracking-wide text-orange-700 dark:text-orange-300">
          Status
        </p>
        <p className="mt-1 truncate text-xl font-black" title={status}>
          {status || "—"}
        </p>
      </article>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function Scanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const token = getValidToken();
  const nome = getNomeUsuario();

  const [resultado, setResultado] = useState(null);
  const [detectado, setDetectado] = useState(false);
  const [erro, setErro] = useState("");
  const [iniciando, setIniciando] = useState(true);
  const [handoff, setHandoff] = useState(false);
  const [status, setStatus] = useState("Inicializando...");
  const [deviceId, setDeviceId] = useState(null);

  const html5QrCodeRef = useRef(null);
  const timeoutRef = useRef(null);
  const processedRef = useRef(false);
  const startLockRef = useRef(false);
  const mountedRef = useRef(true);
  const devicesRef = useRef([]);
  const currentIndexRef = useRef(0);
  const lastRestartRef = useRef(0);
  const liveRef = useRef(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const timer = window.setTimeout(() => setIniciando(false), 260);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      notifyWarning("Faça login para registrar presença.");
    }
  }, [token]);

  const stopCamera = useCallback(async () => {
    if (!html5QrCodeRef.current) return;

    try {
      await html5QrCodeRef.current.stop();
    } catch {
      // noop
    }

    try {
      await html5QrCodeRef.current.clear();
    } catch {
      // noop
    }

    html5QrCodeRef.current = null;
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();

      if (Array.isArray(devices) && devices.length) {
        devicesRef.current = devices;

        if (!deviceId) {
          const idxBack = devices.findIndex((device) =>
            /back|traseir|rear|environment/i.test(device.label || "")
          );

          currentIndexRef.current = idxBack >= 0 ? idxBack : 0;
          setDeviceId(devices[currentIndexRef.current]?.id || null);
        } else {
          const idx = devices.findIndex((device) => device.id === deviceId);
          currentIndexRef.current = idx >= 0 ? idx : 0;
        }
      }
    } catch {
      // Não bloqueia a tentativa com facingMode.
    }
  }, [deviceId]);

  const registrarPresenca = useCallback(
    async (decodedText) => {
      const parsed = parseQrPayload(decodedText);

      if (!parsed.ok) {
        processedRef.current = false;
        setDetectado(false);
        setResultado(null);
        setHandoff(false);
        setStatus("QR inválido");
        notifyWarning(parsed.message);
        setLive(parsed.message);
        return;
      }

      setHandoff(true);
      setStatus("Registrando presença...");
      setLive("Registrando presença.");

      try {
        if (parsed.tipo === "token") {
          await api.presenca.confirmarToken(parsed.token);
        } else {
          await api.presenca.confirmarQr(parsed.turma_id);
        }

        notifySuccess("Presença registrada com sucesso.");
setLive("Presença registrada com sucesso.");

await stopCamera();

if (!mountedRef.current) return;

navigate("/minha-presenca", {
  replace: true,
});
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Não foi possível registrar a presença."
        );

        notifyError(message);
        setLive(message);

        processedRef.current = false;
        setDetectado(false);
        setHandoff(false);
        setStatus("Falha no registro");
      }
    },
    [navigate, setLive, stopCamera]
  );

  const startCamera = useCallback(
    async (reason = "start") => {
      if (startLockRef.current) return;

      startLockRef.current = true;

      try {
        if (!isSecureOk()) throw new Error("InsecureContext");

        setErro("");
        setStatus(reason === "restart" ? "Reiniciando câmera..." : "Iniciando câmera...");
        setLive("Iniciando câmera.");

        const element = document.getElementById("leitor-qr");

        if (!element) {
          throw new Error("Elemento 'leitor-qr' não encontrado.");
        }

        await stopCamera();

        const html5QrCode = new Html5Qrcode("leitor-qr");
        html5QrCodeRef.current = html5QrCode;

        if (!devicesRef.current?.length) {
          await loadDevices();
        }

        const onSuccess = async (decodedText) => {
          if (!decodedText || processedRef.current) return;

          processedRef.current = true;

          try {
            if (navigator.vibrate) navigator.vibrate(40);
          } catch {
            // noop
          }

          window.clearTimeout(timeoutRef.current);

          setDetectado(true);
          setResultado(decodedText);
          setStatus("QR detectado");
          setLive("QR detectado.");

          await Promise.race([
            stopCamera(),
            new Promise((resolve) => {
              window.setTimeout(resolve, 650);
            }),
          ]);

          await registrarPresenca(decodedText);
        };

        const onError = () => {
          // Mantém silencioso para evitar ruído contínuo enquanto procura QR.
        };

        const configArg = deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment" };

        await html5QrCode.start(
          configArg,
          {
            fps: 10,
            qrbox: computeQrbox(),
          },
          onSuccess,
          onError
        );

        setStatus("Aponte para o QR...");
        setLive("Leitor pronto.");

        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
          if (!processedRef.current && mountedRef.current) {
            notifyInfo(
              "Nenhum QR detectado. Tente aproximar o código ou reiniciar o leitor."
            );
            setLive("Nenhum QR detectado.");
          }
        }, 20000);
      } catch (error) {
        const message = mapCameraError(error);

        setErro(message);
        setStatus("Falha ao iniciar");
        setLive("Falha ao iniciar.");
        notifyError(message);
      } finally {
        startLockRef.current = false;
      }
    },
    [deviceId, loadDevices, registrarPresenca, setLive, stopCamera]
  );

  useEffect(() => {
    if (iniciando) return undefined;

    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);

    startCamera("start");

    const onVisibilityChange = async () => {
      if (!html5QrCodeRef.current) return;

      if (document.hidden) {
        try {
          await html5QrCodeRef.current.stop();
          setStatus("Pausado");
          setLive("Leitor pausado.");
        } catch {
          // noop
        }
      } else {
        processedRef.current = false;
        setDetectado(false);
        setResultado(null);
        setHandoff(false);
        startCamera("restart");
      }
    };

    const onResize = () => {
      const now = Date.now();

      if (now - lastRestartRef.current < 900) return;

      lastRestartRef.current = now;

      if (html5QrCodeRef.current && !processedRef.current) {
        startCamera("restart");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timeoutRef.current);
      processedRef.current = false;
      stopCamera();
    };
  }, [iniciando, startCamera, stopCamera, setLive]);

  useEffect(() => {
    if (iniciando) return;
    if (!deviceId) return;
    if (!mountedRef.current) return;

    processedRef.current = false;
    setDetectado(false);
    setResultado(null);
    setHandoff(false);

    startCamera("restart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handleRestart = useCallback(async () => {
    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);

    await startCamera("restart");
  }, [startCamera]);

  const handleToggleCamera = useCallback(async () => {
    const list = devicesRef.current || [];

    if (list.length >= 2) {
      currentIndexRef.current = (currentIndexRef.current + 1) % list.length;

      const next = list[currentIndexRef.current];

      setDeviceId(next?.id || null);
      notifyInfo(`Câmera alternada: ${next?.label || "dispositivo selecionado"}.`);
      setLive("Câmera alternada.");
      return;
    }

    setDeviceId(null);
    notifyInfo("Alternando modo de câmera, se suportado pelo navegador.");
    setLive("Alternando modo de câmera.");

    await startCamera("restart");
  }, [setLive, startCamera]);

  const camerasCount = devicesRef.current?.length || 0;
  const ready = !erro && !iniciando && !handoff;

  const motionConfig = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 14 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.25 },
    }),
    [reduceMotion]
  );

  if (!token) {
    const redirect = `${location.pathname}${location.search}`;

    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  return (
    <div className="flex w-full flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <HeaderHero
  icone={QrCode}
  etiqueta="Scanner de presença"
  titulo="Escanear QR Code"
  subtitulo="Aponte a câmera para o QR Code oficial da turma para registrar sua presença de forma autenticada e segura."
/>

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <main id="conteudo" role="main" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-3 pt-6 sm:px-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">
        Leitor oficial de presença
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Permita o acesso à câmera e mantenha o QR Code dentro da área de leitura.
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleRestart}
        disabled={handoff}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4" />
        Reiniciar leitor
      </button>

      <button
        type="button"
        onClick={handleToggleCamera}
        disabled={handoff}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Repeat className="h-4 w-4" />
        Alternar câmera
      </button>
    </div>
  </div>
</section>
        <motion.div
          {...motionConfig}
          className="mx-auto max-w-6xl px-3 py-6 text-center sm:px-4"
        >
          <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Olá, <strong>{nome}</strong>. Se solicitado, permita o acesso à
              câmera do dispositivo.
            </p>

            <MiniStats cameras={camerasCount || "—"} ready={ready} status={status} />
          </section>

          <section className="mt-5" aria-label="Área de leitura do QR Code">
            {erro ? (
              <div className="mx-auto max-w-md">
                <ErroCarregamento
                  titulo="Erro ao iniciar o leitor de QR Code"
                  mensagem={erro}
                />

                {!isSecureOk() && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="inline-flex items-center gap-2 font-black">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      HTTPS necessário
                    </p>

                    <p className="mt-1 text-xs">
                      Em produção, a câmera só funciona em{" "}
                      <strong>HTTPS</strong>. Em desenvolvimento, use localhost.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRestart}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-orange-700 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            ) : iniciando ? (
              <div className="mx-auto max-w-md">
                <CarregandoSkeleton height="320px" />
              </div>
            ) : (
              <div
                id="leitor-qr"
                className={classNames(
                  "relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem] border-4 bg-black/5 transition-all duration-300 dark:bg-black/30",
                  detectado
                    ? "border-emerald-500"
                    : "border-orange-700 dark:border-orange-500"
                )}
                role="region"
                aria-label="Leitor de QR Code"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
                  aria-hidden="true"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-black text-white">
                    <QrCode className="h-4 w-4" />
                    Alinhe o QR dentro da área
                  </span>
                </div>

                {detectado && (
                  <div
                    className="absolute bottom-3 right-3 z-10 text-emerald-500"
                    aria-hidden="true"
                  >
                    <CheckCircle size={34} />
                  </div>
                )}

                {handoff && (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/92 dark:bg-slate-950/92"
                    role="status"
                    aria-live="assertive"
                  >
                    <Loader2
                      className="h-8 w-8 animate-spin text-orange-700 dark:text-orange-300"
                      aria-hidden="true"
                    />

                    <p className="font-black text-slate-950 dark:text-white">
                      Registrando presença...
                    </p>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Aguarde um instante.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {resultado && !handoff && (
            <p className="mx-auto mt-4 max-w-md break-words rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              QR detectado: {resultado}
            </p>
          )}

          <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Dica: mantenha o QR bem iluminado e dentro do quadrado.
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}