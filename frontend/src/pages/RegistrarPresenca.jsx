// ✅ src/pages/RegistrarPresenca.jsx — premium (scanner UX + a11y + motion-safe + torch/câmera + fallback manual + segurança de origem)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { toast } from "react-toastify";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { apiPost, API_BASE_URL } from "../services/api";
import ErroCarregamento from "../components/ErroCarregamento";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

// Cabeçalho compacto e rodapé institucional (padrão do app)
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import {
  QrCode,
  Camera,
  CameraOff,
  Repeat,
  Flashlight,
  FlashlightOff,
  Keyboard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ScanLine,
  Loader2,
  X,
  Info,
} from "lucide-react";

/* ───────── Helpers ───────── */
const cx = (...c) => c.filter(Boolean).join(" ");
const ensureLeadingSlash = (path) => (!path ? "/" : path.startsWith("/") ? path : `/${path}`);

// Permite aceitar QR como URL completa do backend OU JSON { path, payload }
function parseQrPayload(text) {
  try {
    const base = new URL(API_BASE_URL);
    const maybeUrl = new URL(text);

    // Segurança: origem deve bater com API_BASE_URL
    if (maybeUrl.origin !== base.origin) {
      return { kind: "invalid", reason: "Origem do QR não corresponde à API oficial." };
    }

    const pathWithQuery = `${maybeUrl.pathname}${maybeUrl.search || ""}`;
    return { kind: "url", path: ensureLeadingSlash(pathWithQuery) };
  } catch {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.path === "string") {
        return { kind: "json", path: ensureLeadingSlash(parsed.path), payload: parsed.payload ?? {} };
      }
      return { kind: "invalid", reason: "Formato JSON inválido no QR Code." };
    } catch {
      return { kind: "invalid", reason: "Conteúdo do QR Code inválido." };
    }
  }
}

function MiniStat({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral: "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
    ok: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800",
    info: "bg-orange-50 dark:bg-orange-900/20 border-orange-200/60 dark:border-orange-800",
  };
  return (
    <div className={cx("rounded-2xl border p-4 text-center shadow-sm", tones[tone])}>
      <div className="inline-flex items-center justify-center gap-2 text-[11px] sm:text-xs opacity-80">
        {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

/* ───────── Página ───────── */
export default function RegistrarPresenca() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const token = localStorage.getItem("token");
  const nome = localStorage.getItem("nome") || "usuário";

  const [carregando, setCarregando] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);

  // Scanner controls
  const [paused, setPaused] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [devices, setDevices] = useState([]); // cameras
  const [deviceId, setDeviceId] = useState(null); // câmera atual

  // Fallback manual
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  // A11y live region
  const liveRef = useRef(null);
  const setLive = useCallback((t) => {
    if (liveRef.current) liveRef.current.textContent = t || "";
  }, []);

  // Evita excesso de leituras
  const lockRef = useRef(false);
  const lastScanRef = useRef(0);
  const videoWrapRef = useRef(null);
  const currentTrackRef = useRef(null);

  // Preferência por traseira; se deviceId for definido, usamos ele
  const defaultConstraints = useMemo(
    () => ({
      facingMode: deviceId ? undefined : { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      deviceId: deviceId ? { exact: deviceId } : undefined,
    }),
    [deviceId]
  );

  const motionWrap = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 8 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 8 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  useEffect(() => {
    if (!token) toast.error("⚠️ Faça login para registrar presença.");
  }, [token]);

  useEffect(() => {
    // lista de dispositivos para permitir troca de câmera
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((all) => {
        const cams = (all || []).filter((d) => d.kind === "videoinput");
        setDevices(cams);

        // mantém deviceId se ainda válido
        if (cams.length && deviceId && !cams.some((c) => c.deviceId === deviceId)) {
          setDeviceId(cams[0].deviceId);
        }
      })
      .catch(() => {});
  }, [deviceId]);

  // Detecta suporte a lanterna (torch)
  const detectTorchSupport = useCallback((track) => {
    if (!track?.getCapabilities) return false;
    const caps = track.getCapabilities();
    return !!caps?.torch;
  }, []);

  // Liga/desliga a lanterna se suportado
  const toggleTorch = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;

    try {
      const caps = track.getCapabilities?.();
      if (!caps?.torch) return;

      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
      setLive(!torchOn ? "Lanterna ligada." : "Lanterna desligada.");
    } catch (e) {
      console.error(e);
      toast.info("Lanterna indisponível neste dispositivo/navegador.");
    }
  }, [torchOn, setLive]);

  // QrScanner dá acesso ao stream dentro de <video>; observamos a track
  const onVideoLoad = useCallback(() => {
    try {
      const videoEl = videoWrapRef.current?.querySelector("video");
      if (!videoEl?.srcObject) return;

      const [track] = videoEl.srcObject.getVideoTracks?.() || [];
      currentTrackRef.current = track;

      const torch = detectTorchSupport(track);
      setHasTorch(!!torch);

      // ao trocar câmera, reset
      setTorchOn(false);
    } catch {
      /* noop */
    }
  }, [detectTorchSupport]);

  const safeUnlock = () => setTimeout(() => (lockRef.current = false), 450);

  const registrar = useCallback(
    async (parsed, origem = "scan") => {
      try {
        setCarregando(true);
        setLive(origem === "manual" ? "Registrando presença (manual)…" : "Registrando presença…");

        if (parsed.kind === "url") {
          await apiPost(parsed.path, null);
        } else {
          await apiPost(parsed.path, parsed.payload);
        }

        toast.success("✅ Presença registrada com sucesso!");
        setLive("Presença registrada com sucesso.");
        navigate("/minhas-presencas");
      } catch (err) {
        const msg =
          err?.data?.erro ||
          err?.data?.message ||
          err?.message ||
          "QR Code inválido ou presença já registrada.";
        toast.warning(`⚠️ ${msg}`);
        setLive(msg);
      } finally {
        setCarregando(false);
        safeUnlock();
      }
    },
    [navigate, setLive]
  );

  const handleScan = useCallback(
    async (data) => {
      if (!data || carregando || paused) return;

      // Debounce básico (ignora múltiplos scans em < 1.2s)
      const now = Date.now();
      if (now - lastScanRef.current < 1200) return;
      lastScanRef.current = now;

      if (lockRef.current) return;
      lockRef.current = true;

      const text = data?.text || data; // libs podem retornar string crua
      const parsed = parseQrPayload(String(text));

      if (parsed.kind === "invalid") {
        lockRef.current = false;
        toast.warning(`⚠️ ${parsed.reason}`);
        setLive(parsed.reason);
        return;
      }

      await registrar(parsed, "scan");
    },
    [carregando, paused, registrar, setLive]
  );

  const handleError = useCallback(
    (err) => {
      console.error("Erro ao acessar câmera:", err);
      setErroCamera(true);
      setLive("Erro ao acessar câmera.");
    },
    [setLive]
  );

  // Pausar/retomar leitura
  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      setLive(next ? "Leitura pausada." : "Leitura retomada.");
      return next;
    });
  }, [setLive]);

  // Trocar câmera (se múltiplas)
  const switchCamera = useCallback(() => {
    if (!devices.length) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next =
      devices[(idx + 1 + devices.length) % devices.length]?.deviceId ?? devices[0]?.deviceId;
    if (next && next !== deviceId) {
      setDeviceId(next);
      setLive("Câmera alternada.");
    }
  }, [deviceId, devices, setLive]);

  // Inserção manual (fallback acessível)
  const enviarManual = useCallback(async () => {
    const raw = manualText.trim();
    if (!raw) {
      toast.info("Informe o conteúdo do QR (URL da API ou JSON).");
      return;
    }
    const parsed = parseQrPayload(raw);
    if (parsed.kind === "invalid") {
      toast.warning(`⚠️ ${parsed.reason}`);
      return;
    }
    setManualOpen(false);
    setManualText("");
    await registrar(parsed, "manual");
  }, [manualText, registrar]);

  const limparManual = useCallback(() => setManualText(""), []);

  // KPIs (UX)
  const kpis = useMemo(() => {
    const cams = devices.length;
    return {
      cameras: cams,
      modo: paused ? "Pausado" : "Ativo",
      lanterna: hasTorch ? (torchOn ? "Ligada" : "Disponível") : "—",
    };
  }, [devices.length, hasTorch, paused, torchOn]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900 text-black dark:text-white">
      {/* 🟧 Cabeçalho padrão da família Presenças/QR */}
      <PageHeader title="Registrar Presença" icon={QrCode} variant="laranja" />

      {/* live region for SR */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <motion.main
        role="main"
        className="flex-1 p-4 max-w-3xl mx-auto w-full min-w-0"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? {} : { opacity: 1 }}
      >
        <h1 className="sr-only">Escanear QR Code da Sala</h1>

        {/* Top intro */}
        <div className="text-center mb-4">
          <p className="text-gray-700 dark:text-gray-200">
            Olá, <strong>{nome}</strong>. Aponte a câmera para o QR Code fixado na sala para confirmar sua presença.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-200 border border-orange-200/60 dark:border-orange-900/40 text-xs font-semibold">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Leitura rápida
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-900/40 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              QR validado pela API
            </span>
          </div>
        </div>

        {/* ministats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <MiniStat icon={Camera} label="Câmeras" value={kpis.cameras} tone="neutral" />
          <MiniStat icon={ScanLine} label="Status" value={kpis.modo} tone="info" />
          <MiniStat icon={Flashlight} label="Lanterna" value={kpis.lanterna} tone="ok" />
        </div>

        {/* Controles do scanner */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-600 text-orange-700 dark:text-orange-200 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
            aria-pressed={paused ? "true" : "false"}
          >
            {paused ? <Camera className="w-4 h-4" aria-hidden="true" /> : <CameraOff className="w-4 h-4" aria-hidden="true" />}
            {paused ? "Retomar" : "Pausar"}
          </button>

          {devices.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-600 text-orange-700 dark:text-orange-200 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
              title="Alternar câmera"
            >
              <Repeat className="w-4 h-4" aria-hidden="true" />
              Trocar câmera
            </button>
          )}

          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-600 text-orange-700 dark:text-orange-200 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
              title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
              aria-pressed={torchOn ? "true" : "false"}
            >
              {torchOn ? (
                <FlashlightOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Flashlight className="w-4 h-4" aria-hidden="true" />
              )}
              Lanterna
            </button>
          )}

          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-400 text-gray-700 dark:text-gray-200 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-expanded={manualOpen ? "true" : "false"}
            aria-controls="manual-panel"
          >
            <Keyboard className="w-4 h-4" aria-hidden="true" />
            Inserir manualmente
          </button>
        </div>

        {/* Scanner */}
        <div className="rounded-2xl overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-black/60 shadow-sm">
          <div className="relative" ref={videoWrapRef} role="region" aria-label="Leitor de QR Code">
            {/* overlay */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
              <div className="absolute inset-x-0 top-3 flex justify-center">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 text-white text-xs font-semibold">
                  <ScanLine className={cx("w-4 h-4", reduceMotion ? "" : "animate-pulse")} aria-hidden="true" />
                  Alinhe o QR dentro da área
                </span>
              </div>
            </div>

            {erroCamera ? (
              <div className="p-4 bg-white dark:bg-neutral-800">
                <ErroCarregamento
                  titulo="Erro ao acessar a câmera"
                  mensagem="Verifique as permissões do navegador. Em celulares, tente Chrome/Firefox atualizados. Se o problema persistir, use a inserção manual."
                />
              </div>
            ) : carregando ? (
              <div className="p-4 bg-white dark:bg-neutral-800">
                <CarregandoSkeleton height="320px" />
                <p className="mt-3 text-center text-sm text-neutral-600 dark:text-neutral-300" role="status" aria-live="polite">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Registrando presença…
                  </span>
                </p>
              </div>
            ) : paused ? (
              <div className="h-[320px] flex flex-col items-center justify-center gap-3 bg-white/90 dark:bg-neutral-800 text-center p-6">
                <CameraOff className="w-8 h-8 text-orange-600 dark:text-orange-300" aria-hidden="true" />
                <p className="font-extrabold">Leitura pausada</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Toque em <strong>Retomar</strong> para reativar a câmera.
                </p>
              </div>
            ) : (
              <QrScanner
                delay={500}
                onError={handleError}
                onScan={handleScan}
                onLoad={onVideoLoad}
                style={{ width: "100%", height: "320px" }}
                constraints={{ video: defaultConstraints }}
              />
            )}
          </div>
        </div>

        {/* Fallback manual */}
        <AnimatePresence>
          {manualOpen && (
            <motion.section
              key="manual"
              {...motionWrap}
              id="manual-panel"
              className="mt-4 w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-2xl p-4 text-left shadow-sm"
              role="region"
              aria-label="Inserção manual do conteúdo do QR"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold mb-2 flex items-center gap-2">
                  <Keyboard className="w-4 h-4" aria-hidden="true" /> Inserir conteúdo do QR
                </p>

                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-orange-600"
                  aria-label="Fechar inserção manual"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-3 text-xs text-neutral-700 dark:text-neutral-200 flex gap-2">
                <Info className="w-4 h-4 mt-0.5" aria-hidden="true" />
                <p>
                  Cole a <strong>URL da API</strong> gerada no QR{" "}
                  <em>(ex.: {API_BASE_URL}/api/presencas/confirmar-qr?...)</em> ou um JSON válido com{" "}
                  <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-700">{"{ path, payload }"}</code>.
                </p>
              </div>

              <textarea
                rows={4}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="mt-3 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
                placeholder="Cole aqui a URL da API ou o JSON { path: '/api/presencas/confirmar-qr', payload: {...} }"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={enviarManual}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-lousa text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={carregando}
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Enviar
                </button>

                <button
                  type="button"
                  onClick={limparManual}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  Limpar
                </button>

                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  Cancelar
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Dica de privacidade/acesso */}
        <p className="mt-5 text-xs text-neutral-600 dark:text-neutral-400 text-center">
          Dica: se a câmera não abre, verifique as permissões de câmera do navegador e permita o acesso para este site.
        </p>
      </motion.main>

      <Footer />
    </div>
  );
}
