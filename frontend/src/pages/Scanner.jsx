// ✅ frontend/src/pages/Scanner.jsx — premium (a11y + motion-safe + controle real de câmeras + restart robusto + sem loop infinito)
// Observação importante:
// - Sidebar NÃO deve ser renderizada aqui. Ela vem do Layout (shell) das rotas.
// - Este arquivo foi ajustado para “encaixar” perfeitamente dentro do Layout (sem min-h-screen duplicado).

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle,
  QrCode,
  RefreshCw,
  Repeat,
  Loader2,
  ShieldCheck,
  Sparkles,
  Camera,
  AlertTriangle,
} from "lucide-react";

import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";

/* ───────────────── helpers ───────────────── */
const cx = (...c) => c.filter(Boolean).join(" ");

function isSecureOk() {
  return (
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

function mapCameraError(err) {
  const name = err?.name || err?.message || "";
  if (/InsecureContext/i.test(name) || !isSecureOk()) {
    return "O acesso à câmera requer conexão segura (HTTPS). Acesse a página por HTTPS.";
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

// qrbox responsivo (quadrado), limitado
function computeQrbox() {
  const max = 320;
  const min = 210;
  const padding = 32;
  const base = Math.min(window.innerWidth, 560) - padding;
  return Math.min(max, Math.max(min, Math.floor(base * 0.9)));
}

/* ───────────────── Hero padronizado ───────────────── */
function HeaderHero({ onRestart, onToggleCamera, variant = "orange", disabled }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
  };
  const grad = variants[variant] ?? variants.orange;

  return (
    <header className={cx("relative overflow-hidden bg-gradient-to-br", grad, "text-white")} role="banner">
      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Escanear QR Code</h1>
        </div>

        <p className="text-sm text-white/90 max-w-xl">
          Aponte a câmera para o QR Code fixado na sala. A leitura é automática e segura.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          <BotaoPrimario
            onClick={onRestart}
            variante="secundario"
            icone={<RefreshCw className="w-4 h-4" />}
            aria-label="Reiniciar leitor"
            disabled={disabled}
          >
            Reiniciar leitor
          </BotaoPrimario>

          <BotaoPrimario
            onClick={onToggleCamera}
            variante="secundario"
            icone={<Repeat className="w-4 h-4" />}
            aria-label="Alternar câmera"
            disabled={disabled}
          >
            Alternar câmera
          </BotaoPrimario>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Conexão segura
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Leitura rápida
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────────────── MiniStats ───────────────── */
function MiniStats({ cameras, ready, status }) {
  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-3 mt-4" aria-label="Resumo do scanner">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-neutral-200/70 dark:ring-neutral-800/70 p-4 text-center">
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Câmeras</p>
        <p className="text-xl font-extrabold tabular-nums">{cameras ?? "—"}</p>
      </div>
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40 p-4 text-center">
        <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Pronto</p>
        <p className="text-xl font-extrabold">{ready ? "Sim" : "Não"}</p>
      </div>
      <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/25 ring-1 ring-orange-200/60 dark:ring-orange-900/40 p-4 text-center">
        <p className="text-[11px] text-orange-700 dark:text-orange-300">Status</p>
        <p className="text-xl font-extrabold truncate" title={status}>
          {status || "—"}
        </p>
      </div>
    </section>
  );
}

export default function Scanner() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [resultado, setResultado] = useState(null);
  const [detectado, setDetectado] = useState(false);
  const [erro, setErro] = useState(false);
  const [iniciando, setIniciando] = useState(true);
  const [handoff, setHandoff] = useState(false);
  const [status, setStatus] = useState("Inicializando…");

  // deviceId selecionado (string) ou null (auto)
  const [deviceId, setDeviceId] = useState(null);

  const html5QrCodeRef = useRef(null);
  const timeoutRef = useRef(null);
  const processedRef = useRef(false);
  const startLockRef = useRef(false);
  const mountedRef = useRef(true);

  const devicesRef = useRef([]); // [{ id, label }]
  const currentIndexRef = useRef(0);
  const lastRestartRef = useRef(0);

  // a11y live region
  const liveRef = useRef(null);
  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg || "";
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => setIniciando(false), 260);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
    };
  }, []);

  const stopCamera = useCallback(async () => {
    if (!html5QrCodeRef.current) return;
    try {
      await html5QrCodeRef.current.stop();
    } catch {}
    try {
      await html5QrCodeRef.current.clear();
    } catch {}
    html5QrCodeRef.current = null;
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (Array.isArray(devices) && devices.length) {
        devicesRef.current = devices;

        // Se ainda não escolheu, tenta preferir “traseira” pelo label; se não, pega a primeira.
        if (!deviceId) {
          const idxBack = devices.findIndex((d) =>
            /back|traseir|rear|environment/i.test(d.label || "")
          );
          currentIndexRef.current = idxBack >= 0 ? idxBack : 0;
          setDeviceId(devices[currentIndexRef.current]?.id || null);
        } else {
          const idx = devices.findIndex((d) => d.id === deviceId);
          currentIndexRef.current = idx >= 0 ? idx : 0;
        }
      }
    } catch {
      // não bloqueia
    }
  }, [deviceId]);

  const startCamera = useCallback(
    async (reason = "start") => {
      if (startLockRef.current) return;
      startLockRef.current = true;

      try {
        if (!isSecureOk()) throw new Error("InsecureContext");

        setErro(false);
        setStatus(reason === "restart" ? "Reiniciando câmera…" : "Iniciando câmera…");
        setLive("Iniciando câmera…");

        // Elemento destino
        const el = document.getElementById("leitor-qr");
        if (!el) throw new Error("Elemento 'leitor-qr' não encontrado.");

        // limpa instância anterior
        await stopCamera();

        // cria nova instância
        const html5QrCode = new Html5Qrcode("leitor-qr");
        html5QrCodeRef.current = html5QrCode;

        // garante lista de devices (uma vez, mas pode reavaliar)
        if (!devicesRef.current?.length) await loadDevices();

        const onSuccess = async (decodedText) => {
          if (!decodedText || processedRef.current) return;
          processedRef.current = true;

          try {
            if (navigator.vibrate) navigator.vibrate(40);
          } catch {}

          clearTimeout(timeoutRef.current);
          setDetectado(true);
          setResultado(decodedText);
          setStatus("QR detectado ✅");
          setLive("QR detectado.");
          toast.success("✅ QR Code lido com sucesso!");

          setHandoff(true);

          // encerra câmera antes de navegar
          const stop = stopCamera();
          await Promise.race([stop, new Promise((r) => setTimeout(r, 650))]);

          setTimeout(() => {
            if (!mountedRef.current) return;
            navigate(`/validar-presenca?codigo=${encodeURIComponent(decodedText)}`, { replace: true });
          }, 60);
        };

        const onError = () => {}; // reduz ruído

        // configuração: preferimos deviceId se houver; senão tentamos facingMode environment
        const configArg = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" };

        await html5QrCode.start(configArg, { fps: 10, qrbox: computeQrbox() }, onSuccess, onError);

        setStatus("Aponte para o QR…");
        setLive("Leitor pronto.");

        // timeout de detecção (reinicia leve para reativar autofocus em alguns devices)
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
          if (!processedRef.current && mountedRef.current) {
            toast.info("⚠️ Nenhum QR detectado. Tente aproximar ou reinicie o leitor.");
            setLive("Nenhum QR detectado.");
            // não auto-loop agressivo: só sugere e mantém rodando
          }
        }, 20000);
      } catch (err) {
        console.error("Erro ao iniciar QR Code:", err);
        setErro(true);
        setStatus("Falha ao iniciar");
        setLive("Falha ao iniciar.");
        toast.error(`❌ ${mapCameraError(err)}`);
      } finally {
        startLockRef.current = false;
      }
    },
    [deviceId, loadDevices, navigate, setLive, stopCamera]
  );

  // lifecycle
  useEffect(() => {
    if (iniciando) return;

    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);

    startCamera("start");

    const onVis = async () => {
      if (!html5QrCodeRef.current) return;

      if (document.hidden) {
        try {
          await html5QrCodeRef.current.stop();
          setStatus("Pausado (aba em segundo plano)");
          setLive("Leitor pausado.");
        } catch {}
      } else {
        // ao voltar, reinicia
        processedRef.current = false;
        setDetectado(false);
        setResultado(null);
        setHandoff(false);
        startCamera("restart");
      }
    };

    // restart em resize/orientation com throttle
    const onResize = () => {
      const now = Date.now();
      if (now - lastRestartRef.current < 900) return;
      lastRestartRef.current = now;
      if (html5QrCodeRef.current && !processedRef.current) startCamera("restart");
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("resize", onResize);
      clearTimeout(timeoutRef.current);
      processedRef.current = false;
      stopCamera();
    };
  }, [iniciando, startCamera, stopCamera, setLive]);

  // se deviceId mudar (troca de câmera), reinicia
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

  // ações do hero
  const handleRestart = async () => {
    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);
    await startCamera("restart");
  };

  const handleToggleCamera = async () => {
    const list = devicesRef.current || [];
    if (list.length >= 2) {
      currentIndexRef.current = (currentIndexRef.current + 1) % list.length;
      const next = list[currentIndexRef.current];
      setDeviceId(next?.id || null);
      toast.info(`📷 Câmera: ${next?.label || "alternada"}`);
      setLive("Câmera alternada.");
      return;
    }

    // fallback: alternar entre environment/user quando não listou devices
    setDeviceId(null);
    toast.info("📷 Alternando modo de câmera (se suportado).");
    setLive("Alternando modo de câmera.");
    await startCamera("restart");
  };

  const camerasCount = devicesRef.current?.length || 0;
  const ready = !erro && !iniciando && !handoff;

  return (
    // ✅ Não usa min-h-screen aqui para não “brigar” com o Layout que já define altura/scroll.
    <div className="flex flex-col w-full bg-gelo dark:bg-neutral-900">
      <HeaderHero
        onRestart={handleRestart}
        onToggleCamera={handleToggleCamera}
        variant="orange"
        disabled={handoff}
      />

      {/* SR live */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <main id="conteudo" role="main" className="flex-1">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          // ✅ container consistente com páginas premium (Eventos etc.)
          className="text-center px-2 sm:px-4 py-6 max-w-6xl mx-auto"
        >
          <p className="text-gray-700 dark:text-gray-300 mb-3 max-w-md mx-auto" aria-live="polite">
            Se solicitado, permita o acesso à câmera do dispositivo.
          </p>

          <MiniStats cameras={camerasCount || "—"} ready={ready} status={status} />

          <div className="mt-5">
            {erro ? (
              <div className="max-w-md mx-auto">
                <ErroCarregamento mensagem="Erro ao iniciar o leitor de QR Code." />
                {!isSecureOk() && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-amber-900 text-sm">
                    <p className="font-semibold inline-flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> HTTPS necessário
                    </p>
                    <p className="mt-1 text-xs">
                      Em produção, a câmera só funciona em <strong>HTTPS</strong>. Em dev, use localhost.
                    </p>
                  </div>
                )}
              </div>
            ) : iniciando ? (
              <CarregandoSkeleton height="320px" />
            ) : (
              <div
                id="leitor-qr"
                className={cx(
                  "relative mx-auto w-full max-w-sm aspect-square border-4 rounded-2xl transition-all duration-300 overflow-hidden bg-black/5",
                  detectado ? "border-green-500" : "border-lousa"
                )}
                role="region"
                aria-label="Leitor de QR Code"
              >
                <div className="absolute top-2 right-2 animate-pulse" aria-hidden="true">
                  <QrCodeIcon />
                </div>

                {detectado && (
                  <div className="absolute bottom-2 right-2 text-green-500" aria-hidden="true">
                    <CheckCircle size={32} />
                  </div>
                )}

                {/* overlay de handoff para evitar tela branca */}
                {handoff && (
                  <div
                    className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 flex flex-col items-center justify-center gap-2"
                    role="status"
                    aria-live="assertive"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-lousa dark:text-white" aria-hidden="true" />
                    <p className="text-lousa dark:text-white font-medium">Registrando presença…</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">Aguarde um instante</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {resultado && !handoff && (
            <p className="mt-4 text-green-600 dark:text-green-400 font-medium break-words">
              Resultado: {resultado}
            </p>
          )}

          {/* dica compacta */}
          <div className="mt-6 max-w-md mx-auto text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" aria-hidden="true" />
            Dica: mantenha o QR bem iluminado e dentro do quadrado.
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

function QrCodeIcon() {
  return (
    <svg
      className="w-6 h-6 text-lousa dark:text-white"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4h5v5H4V4zm11 0h5v5h-5V4zM4 15h5v5H4v-5zm11 0h5v5h-5v-5z"
      />
    </svg>
  );
}