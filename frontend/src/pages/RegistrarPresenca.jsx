// ✅ frontend/src/pages/RegistrarPresenca.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página para registro de presença por leitura de QR Code.
//
// Contratos aplicados:
// - Sem apiPost direto na página;
// - Sem API_BASE_URL na página;
// - Sem QR chamando path livre da API;
// - Sem /api/presencas/confirmar-qr;
// - Sem /presencas;
// - QR oficial deve conter:
//   1) URL com ?turma_id=123
//   2) URL com ?token=...
//   3) JSON { "turma_id": 123 }
//   4) JSON { "token": "..." }
//   5) número puro representando turma_id
// - Registro por turma: api.presenca.confirmarQr(turma_id);
// - Registro por token: api.presenca.confirmarToken(token);
// - Sem toast direto;
// - Sem Footer antigo;
// - Sem PageHeader de caminho incerto;
// - Sem CarregandoSkeleton/ErroCarregamento em caminho antigo;
// - Sem bg-gelo;
// - Scanner com fallback manual;
// - Acessível, mobile-first, dark mode, motion-safe e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  Info,
  Keyboard,
  Loader2,
  QrCode,
  RefreshCw,
  Repeat,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { api } from "../services/api";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import Footer from "../components/layout/Footer";
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

function HeaderHero() {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-orange-800 to-rose-700" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_28%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.20),transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[960px] max-w-[95vw] -translate-x-1/2 rounded-full bg-amber-300/20 blur-3xl"
      />

      <a
        href="#conteudo"
        className="relative sr-only px-3 py-2 text-sm focus:not-sr-only focus:block focus:bg-white/20 focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 sm:py-10 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Leitor de presença v2.0
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
            Registrar presença
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
            Escaneie o QR Code oficial da turma para confirmar sua presença de
            forma autenticada e segura.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15 sm:text-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Leitura rápida
            </span>

            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15 sm:text-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Contrato oficial
            </span>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral:
      "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    info: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100",
  };

  return (
    <article
      className={classNames(
        "rounded-3xl border p-3 text-center shadow-sm sm:p-4",
        tones[tone] || tones.neutral
      )}
    >
      <div className="inline-flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wide opacity-80 sm:text-xs">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>

      <div className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
        {value}
      </div>
    </article>
  );
}

function ScannerToolbar({
  paused,
  togglePause,
  devices,
  switchCamera,
  hasTorch,
  torchOn,
  toggleTorch,
  manualOpen,
  setManualOpen,
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={togglePause}
        className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-white px-3 py-2 text-sm font-black text-orange-800 transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-900/50 dark:bg-slate-900 dark:text-orange-100 dark:hover:bg-orange-950/30"
        aria-pressed={paused}
      >
        {paused ? (
          <Camera className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CameraOff className="h-4 w-4" aria-hidden="true" />
        )}
        {paused ? "Retomar" : "Pausar"}
      </button>

      {devices.length > 1 && (
        <button
          type="button"
          onClick={switchCamera}
          className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-white px-3 py-2 text-sm font-black text-orange-800 transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-900/50 dark:bg-slate-900 dark:text-orange-100 dark:hover:bg-orange-950/30"
        >
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Trocar câmera
        </button>
      )}

      {hasTorch && (
        <button
          type="button"
          onClick={toggleTorch}
          className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-white px-3 py-2 text-sm font-black text-orange-800 transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-orange-900/50 dark:bg-slate-900 dark:text-orange-100 dark:hover:bg-orange-950/30"
          aria-pressed={torchOn}
        >
          {torchOn ? (
            <FlashlightOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Flashlight className="h-4 w-4" aria-hidden="true" />
          )}
          Lanterna
        </button>
      )}

      <button
        type="button"
        onClick={() => setManualOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-expanded={manualOpen}
        aria-controls="manual-panel"
      >
        <Keyboard className="h-4 w-4" aria-hidden="true" />
        Inserir manualmente
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function RegistrarPresenca() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const token = getValidToken();
  const nome = getNomeUsuario();

  const [carregando, setCarregando] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);

  const [paused, setPaused] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  const liveRef = useRef(null);
  const lockRef = useRef(false);
  const lastScanRef = useRef(0);
  const videoWrapRef = useRef(null);
  const currentTrackRef = useRef(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  const cameraConstraints = useMemo(
    () => ({
      video: {
        facingMode: deviceId ? undefined : { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        deviceId: deviceId ? { exact: deviceId } : undefined,
      },
    }),
    [deviceId]
  );

  const motionConfig = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 8 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 8 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  useEffect(() => {
    if (!token) {
      notifyWarning("Faça login para registrar presença.");
    }
  }, [token]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((allDevices) => {
        const cameras = (allDevices || []).filter(
          (device) => device.kind === "videoinput"
        );

        setDevices(cameras);

        if (
          cameras.length &&
          deviceId &&
          !cameras.some((camera) => camera.deviceId === deviceId)
        ) {
          setDeviceId(cameras[0].deviceId);
        }
      })
      .catch(() => {
        // Sem bloqueio: scanner ainda pode funcionar.
      });
  }, [deviceId]);

  const detectTorchSupport = useCallback((track) => {
    if (!track?.getCapabilities) return false;

    const capabilities = track.getCapabilities();

    return Boolean(capabilities?.torch);
  }, []);

  const onVideoLoad = useCallback(() => {
    try {
      const videoEl = videoWrapRef.current?.querySelector("video");

      if (!videoEl?.srcObject) return;

      const [track] = videoEl.srcObject.getVideoTracks?.() || [];

      currentTrackRef.current = track;

      const supported = detectTorchSupport(track);

      setHasTorch(supported);
      setTorchOn(false);
    } catch {
      // noop
    }
  }, [detectTorchSupport]);

  const toggleTorch = useCallback(async () => {
    const track = currentTrackRef.current;

    if (!track) return;

    try {
      const capabilities = track.getCapabilities?.();

      if (!capabilities?.torch) {
        notifyInfo("Lanterna indisponível neste dispositivo ou navegador.");
        return;
      }

      await track.applyConstraints({
        advanced: [{ torch: !torchOn }],
      });

      setTorchOn((value) => !value);
      setLive(!torchOn ? "Lanterna ligada." : "Lanterna desligada.");
    } catch {
      notifyInfo("Lanterna indisponível neste dispositivo ou navegador.");
    }
  }, [setLive, torchOn]);

  const safeUnlock = useCallback(() => {
    window.setTimeout(() => {
      lockRef.current = false;
    }, 450);
  }, []);

  const registrar = useCallback(
    async (parsed, origem = "scan") => {
      try {
        setCarregando(true);
        setLive(
          origem === "manual"
            ? "Registrando presença por inserção manual."
            : "Registrando presença por QR Code."
        );

        if (parsed.tipo === "token") {
          await api.presenca.confirmarToken(parsed.token);
        } else {
          await api.presenca.confirmarQr(parsed.turma_id);
        }

        notifySuccess("Presença registrada com sucesso.");
        setLive("Presença registrada com sucesso.");

        navigate("/minhas-presencas");
      } catch (error) {
        const message = getErrorMessage(
          error,
          "QR Code inválido ou presença já registrada."
        );

        notifyWarning(message);
        setLive(message);
      } finally {
        setCarregando(false);
        safeUnlock();
      }
    },
    [navigate, safeUnlock, setLive]
  );

  const handleScan = useCallback(
    async (data) => {
      if (!data || carregando || paused) return;

      const now = Date.now();

      if (now - lastScanRef.current < 1200) return;

      lastScanRef.current = now;

      if (lockRef.current) return;

      lockRef.current = true;

      const text = data?.text || data;
      const parsed = parseQrPayload(String(text));

      if (!parsed.ok) {
        lockRef.current = false;
        notifyWarning(parsed.message);
        setLive(parsed.message);
        return;
      }

      await registrar(parsed, "scan");
    },
    [carregando, paused, registrar, setLive]
  );

  const handleError = useCallback(
    (error) => {
      console.error("Erro ao acessar câmera:", error);
      setErroCamera(true);
      setLive("Erro ao acessar câmera.");
    },
    [setLive]
  );

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;

      setLive(next ? "Leitura pausada." : "Leitura retomada.");

      return next;
    });
  }, [setLive]);

  const switchCamera = useCallback(() => {
    if (!devices.length) return;

    const index = devices.findIndex((device) => device.deviceId === deviceId);
    const next =
      devices[(index + 1 + devices.length) % devices.length]?.deviceId ||
      devices[0]?.deviceId;

    if (next && next !== deviceId) {
      setDeviceId(next);
      setLive("Câmera alternada.");
    }
  }, [deviceId, devices, setLive]);

  const enviarManual = useCallback(async () => {
    const raw = manualText.trim();

    if (!raw) {
      notifyInfo("Informe o conteúdo do QR oficial.");
      return;
    }

    const parsed = parseQrPayload(raw);

    if (!parsed.ok) {
      notifyWarning(parsed.message);
      setLive(parsed.message);
      return;
    }

    setManualOpen(false);
    setManualText("");

    await registrar(parsed, "manual");
  }, [manualText, registrar, setLive]);

  const limparManual = useCallback(() => {
    setManualText("");
  }, []);

  const kpis = useMemo(
    () => ({
      cameras: devices.length,
      modo: paused ? "Pausado" : "Ativo",
      lanterna: hasTorch ? (torchOn ? "Ligada" : "Disponível") : "—",
    }),
    [devices.length, hasTorch, paused, torchOn]
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
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <HeaderHero />

      <main
        id="conteudo"
        role="main"
        className="mx-auto w-full max-w-4xl flex-1 px-3 py-6 sm:px-4 lg:px-6"
        aria-busy={carregando ? "true" : "false"}
      >
        <p
          ref={liveRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        <motion.section
          {...motionConfig}
          className="space-y-5"
          aria-label="Leitor de QR Code para presença"
        >
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Olá, <strong>{nome}</strong>. Aponte a câmera para o QR Code
              oficial da turma para confirmar sua presença.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Leitura rápida
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Validado pelo backend
              </span>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MiniStat
              icon={Camera}
              label="Câmeras"
              value={kpis.cameras}
              tone="neutral"
            />
            <MiniStat
              icon={ScanLine}
              label="Status"
              value={kpis.modo}
              tone="info"
            />
            <MiniStat
              icon={Flashlight}
              label="Lanterna"
              value={kpis.lanterna}
              tone="ok"
            />
          </div>

          <ScannerToolbar
            paused={paused}
            togglePause={togglePause}
            devices={devices}
            switchCamera={switchCamera}
            hasTorch={hasTorch}
            torchOn={torchOn}
            toggleTorch={toggleTorch}
            manualOpen={manualOpen}
            setManualOpen={setManualOpen}
          />

          <section className="overflow-hidden rounded-[2rem] border border-slate-300 bg-black/70 shadow-sm dark:border-slate-800">
            <div
              ref={videoWrapRef}
              className="relative"
              role="region"
              aria-label="Leitor de QR Code"
            >
              <div className="pointer-events-none absolute inset-0 z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />

                <div className="absolute inset-x-0 top-3 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-black text-white">
                    <ScanLine
                      className={classNames(
                        "h-4 w-4",
                        reduceMotion ? "" : "animate-pulse"
                      )}
                      aria-hidden="true"
                    />
                    Alinhe o QR dentro da área
                  </span>
                </div>
              </div>

              {erroCamera ? (
                <div className="bg-white p-4 dark:bg-slate-900">
                  <ErroCarregamento
                    titulo="Erro ao acessar a câmera"
                    mensagem="Verifique as permissões do navegador. Em celulares, tente usar um navegador atualizado. Se o problema persistir, use a inserção manual."
                  />
                </div>
              ) : carregando ? (
                <div className="bg-white p-4 dark:bg-slate-900">
                  <CarregandoSkeleton height="320px" />

                  <p
                    className="mt-3 text-center text-sm text-slate-600 dark:text-slate-300"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Registrando presença...
                    </span>
                  </p>
                </div>
              ) : paused ? (
                <div className="flex h-[320px] flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center dark:bg-slate-900">
                  <CameraOff
                    className="h-8 w-8 text-orange-600 dark:text-orange-300"
                    aria-hidden="true"
                  />

                  <p className="font-black">Leitura pausada</p>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Toque em <strong>Retomar</strong> para reativar a câmera.
                  </p>
                </div>
              ) : (
                <div className="h-[320px] [&_video]:h-[320px] [&_video]:w-full [&_video]:object-cover">
                  <QrScanner
                    delay={500}
                    onError={handleError}
                    onScan={handleScan}
                    onLoad={onVideoLoad}
                    constraints={cameraConstraints}
                  />
                </div>
              )}
            </div>
          </section>

          <AnimatePresence>
            {manualOpen && (
              <motion.section
                key="manual"
                {...motionConfig}
                id="manual-panel"
                className="rounded-[2rem] border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
                role="region"
                aria-label="Inserção manual do conteúdo do QR"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="mb-2 flex items-center gap-2 font-black">
                    <Keyboard className="h-4 w-4" aria-hidden="true" />
                    Inserir conteúdo do QR
                  </p>

                  <button
                    type="button"
                    onClick={() => setManualOpen(false)}
                    className="rounded-xl p-2 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:bg-slate-800"
                    aria-label="Fechar inserção manual"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

                  <p>
                    Cole o conteúdo oficial do QR: uma URL com{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                      turma_id
                    </code>{" "}
                    ou{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                      token
                    </code>
                    , ou um JSON com{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                      {"{ turma_id }"}
                    </code>{" "}
                    ou{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                      {"{ token }"}
                    </code>
                    .
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 dark:border-slate-800 dark:bg-slate-950"
                  placeholder='Ex.: {"turma_id": 123} ou {"token": "..."}'
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={enviarManual}
                    disabled={carregando}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-700 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Enviar
                  </button>

                  <button
                    type="button"
                    onClick={limparManual}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Limpar
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualOpen(false)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <p className="text-center text-xs text-slate-600 dark:text-slate-400">
            Se a câmera não abrir, verifique as permissões do navegador ou use a
            inserção manual com o conteúdo oficial do QR.
          </p>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}