// ✅ src/pages/RegistrarPresenca.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

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
} from "lucide-react";

/* ───────── Helpers ───────── */
const ensureLeadingSlash = (path) => (!path ? "/" : path.startsWith("/") ? path : `/${path}`);

function parseQrPayload(text) {
  // Aceita:
  // 1) URL do backend: https://API/.../api/presencas/confirmar-qr?... (origem deve bater com API_BASE_URL)
  // 2) JSON: { "path": "/api/presencas/confirmar-qr", "payload": {...} }
  try {
    const base = new URL(API_BASE_URL);
    const maybeUrl = new URL(text);

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

export default function RegistrarPresenca() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const nome = localStorage.getItem("nome") || "";

  const [carregando, setCarregando] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);

  // Scanner controls
  const [paused, setPaused] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [devices, setDevices] = useState([]); // lista de cameras
  const [deviceId, setDeviceId] = useState(null); // câmera atual

  // Fallback manual
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  // A11y live region
  const liveRef = useRef(null);
  const setLive = useCallback((t) => {
    if (liveRef.current) liveRef.current.textContent = t;
  }, []);

  // Evita excesso de leituras
  const lockRef = useRef(false);
  const lastScanRef = useRef(0);
  const videoRef = useRef(null);
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
      // Alguns navegadores bloqueiam quando não está em full-screen/gesto
      toast.info("Lanterna indisponível neste dispositivo/navegador.");
    }
  }, [torchOn, setLive]);

  // QrScanner dá acesso ao stream dentro de <video>; observamos a track
  const onVideoLoad = useCallback(() => {
    try {
      const videoEl = videoRef.current?.querySelector("video");
      if (!videoEl?.srcObject) return;

      const [track] = videoEl.srcObject.getVideoTracks?.() || [];
      currentTrackRef.current = track;

      const torch = detectTorchSupport(track);
      setHasTorch(!!torch);

      // Se trocar de câmera, reset torch flag
      setTorchOn(false);
    } catch {
      /* noop */
    }
  }, [detectTorchSupport]);

  const handleScan = async (data) => {
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

    try {
      setCarregando(true);
      setLive("Registrando presença…");

      if (parsed.kind === "url") {
        await apiPost(parsed.path, null); // backend infere via querystring/token do QR
      } else {
        await apiPost(parsed.path, parsed.payload);
      }

      toast.success("✅ Presença registrada com sucesso!");
      setLive("Presença registrada com sucesso.");
      navigate("/minhas-presencas"); // consistente com a família Presenças
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
      setTimeout(() => (lockRef.current = false), 500);
    }
  };

  const handleError = (err) => {
    console.error("Erro ao acessar câmera:", err);
    setErroCamera(true);
    setLive("Erro ao acessar câmera.");
  };

  // Pausar/retomar leitura
  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      setLive(next ? "Leitura pausada." : "Leitura retomada.");
      return next;
    });
  };

  // Trocar câmera (se múltiplas)
  const switchCamera = () => {
    if (!devices.length) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1 + devices.length) % devices.length]?.deviceId ?? devices[0]?.deviceId;
    if (next && next !== deviceId) {
      setDeviceId(next);
      setLive("Câmera alternada.");
    }
  };

  // Inserção manual (fallback acessível)
  const enviarManual = async () => {
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
    try {
      setCarregando(true);
      setLive("Registrando presença (manual)...");
      if (parsed.kind === "url") {
        await apiPost(parsed.path, null);
      } else {
        await apiPost(parsed.path, parsed.payload);
      }
      toast.success("✅ Presença registrada!");
      setLive("Presença registrada com sucesso.");
      setManualOpen(false);
      setManualText("");
      navigate("/minhas-presencas");
    } catch (e) {
      const msg =
        e?.data?.erro || e?.data?.message || e?.message || "Falha ao registrar manualmente.";
      toast.error("❌ " + msg);
      setLive("Falha ao registrar manualmente.");
    } finally {
      setCarregando(false);
    }
  };

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900 text-black dark:text-white">
      {/* 🟧 Cabeçalho padrão da família Presenças/QR */}
      <PageHeader title="Registrar Presença" icon={QrCode} variant="laranja" />

      {/* live region for SR */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <motion.main
        role="main"
        className="flex-1 p-4 max-w-2xl mx-auto text-center flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h1 className="sr-only">Escanear QR Code da Sala</h1>

        <p className="mb-4 text-gray-700 dark:text-gray-200">
          Olá, <strong>{nome}</strong>. Aponte sua câmera para o QR Code fixado na sala para confirmar sua presença.
        </p>

        {/* Controles do scanner */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-orange-600 text-orange-700 dark:text-orange-300 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            {paused ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            {paused ? "Retomar" : "Pausar"}
          </button>

          {devices.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-orange-600 text-orange-700 dark:text-orange-300 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
              title="Alternar câmera"
            >
              <Repeat className="w-4 h-4" />
              Trocar câmera
            </button>
          )}

          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-orange-600 text-orange-700 dark:text-orange-300 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-600"
              title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            >
              {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              {torchOn ? "Lanterna" : "Lanterna"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-400 text-gray-700 dark:text-gray-200 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <Keyboard className="w-4 h-4" />
            Inserir conteúdo manualmente
          </button>
        </div>

        {/* Scanner */}
        {erroCamera ? (
          <ErroCarregamento
            titulo="Erro ao acessar a câmera"
            mensagem="Verifique as permissões do navegador. Em celulares, tente Chrome/Firefox atualizados. Se o problema persistir, use a inserção manual."
          />
        ) : (
          <div
            ref={videoRef}
            className="rounded-xl overflow-hidden border border-lousa w-full bg-black/60"
            role="region"
            aria-label="Leitor de QR Code"
          >
            {carregando ? (
              <CarregandoSkeleton height="300px" />
            ) : (
              <QrScanner
                delay={paused ? false : 500}
                onError={handleError}
                onScan={handleScan}
                onLoad={onVideoLoad}
                style={{ width: "100%", height: "300px" }}
                constraints={{ video: defaultConstraints }}
              />
            )}
          </div>
        )}

        {carregando && (
          <p className="mt-4 text-lousa dark:text-white animate-pulse" role="status" aria-live="polite">
            ⏳ Registrando presença...
          </p>
        )}

        {/* Fallback manual */}
        {manualOpen && (
          <div
            className="mt-5 w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 text-left"
            role="group"
            aria-labelledby="man-title"
          >
            <p id="man-title" className="font-medium mb-2 flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> Inserir conteúdo do QR
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">
              Cole aqui a <strong>URL da API</strong> gerada no QR <em>(ex.: {API_BASE_URL}/api/presencas/confirmar-qr?...)</em> ou um JSON válido com <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-700">{"{ path, payload }"}</code>.
            </p>
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              placeholder="Cole aqui a URL da API ou o JSON { path: '/api/presencas/confirmar-qr', payload: {...} }"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enviarManual}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-lousa text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-700"
                disabled={carregando}
              >
                <CheckCircle2 className="w-4 h-4" />
                Enviar manualmente
              </button>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Dica de privacidade/acesso */}
        <p className="mt-6 text-xs text-neutral-600 dark:text-neutral-400 max-w-prose">
          Dica: se a câmera não abre, verifique <em>Configurações &gt; Privacidade</em> do navegador
          e permita o acesso para este site.
        </p>
      </motion.main>

      <Footer />
    </div>
  );
}
