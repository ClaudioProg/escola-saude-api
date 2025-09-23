// 📁 frontend/src/pages/Scanner.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { CheckCircle, QrCode, RefreshCw, Repeat } from "lucide-react";

import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";

/* ───────────────── Hero padronizado ───────────────── */
function HeaderHero({ onRestart, onToggleCamera, variant = "orange" }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700", // 🔶 família presenças/QR
  };
  const grad = variants[variant] ?? variants.orange;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Escanear QR Code
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Aponte a câmera para o QR Code fixado na sala. A leitura é automática.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          <BotaoPrimario
            onClick={onRestart}
            variante="secundario"
            icone={<RefreshCw className="w-4 h-4" />}
            aria-label="Reiniciar leitor"
          >
            Reiniciar leitor
          </BotaoPrimario>
          <BotaoPrimario
            onClick={onToggleCamera}
            variante="secundario"
            icone={<Repeat className="w-4 h-4" />}
            aria-label="Alternar câmera"
          >
            Alternar câmera
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

export default function Scanner() {
  const [resultado, setResultado] = useState(null);
  const [detectado, setDetectado] = useState(false);
  const [erro, setErro] = useState(false);
  const [iniciando, setIniciando] = useState(true);
  const [handoff, setHandoff] = useState(false);

  // câmera selecionada: deviceId (string) OU { facingMode: "environment" | "user" }
  const [cameraConfig, setCameraConfig] = useState({ facingMode: "environment" });

  const navigate = useNavigate();

  const html5QrCodeRef = useRef(null);
  const timeoutRef = useRef(null);
  const processedRef = useRef(false);
  const mountedRef = useRef(true);
  const devicesRef = useRef([]); // lista de câmeras disponíveis

  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => setIniciando(false), 300);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
    };
  }, []);

  // util: parar e limpar câmera
  const stopCamera = useMemo(
    () => async () => {
      if (!html5QrCodeRef.current) return;
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
      try {
        await html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    },
    []
  );

  // (re)iniciar com base no cameraConfig atual
  const startCamera = useMemo(
    () => async () => {
      try {
        await new Promise((r) => setTimeout(r, 80)); // pequeno delay
        const el = document.getElementById("leitor-qr");
        if (!el) throw new Error("Elemento 'leitor-qr' não encontrado.");

        // encerra instância anterior
        await stopCamera();

        const html5QrCode = new Html5Qrcode("leitor-qr");
        html5QrCodeRef.current = html5QrCode;

        // tenta descobrir câmeras (para suportar alternância)
        try {
          const devices = await Html5Qrcode.getCameras();
          if (Array.isArray(devices) && devices.length) {
            devicesRef.current = devices;
            // se o config atual é facingMode, tenta escolher a traseira pelo label
            if (cameraConfig?.facingMode) {
              const back = devices.find((d) =>
                (d.label || "").toLowerCase().includes("back")
              );
              if (back) {
                // preferir id da traseira no mobile
                setCameraConfig(back.id);
              }
            }
          }
        } catch {
          // sem getCameras não bloqueia
        }

        const onSuccess = async (decodedText) => {
          if (!decodedText || processedRef.current) return;
          processedRef.current = true;

          clearTimeout(timeoutRef.current);
          setDetectado(true);
          setResultado(decodedText);
          toast.success("✅ QR Code lido com sucesso!");

          setHandoff(true);
          // encerra câmera antes de navegar
          const stop = stopCamera();
          await Promise.race([stop, new Promise((r) => setTimeout(r, 600))]);

          setTimeout(() => {
            if (!mountedRef.current) return;
            navigate(
              `/validar-presenca?codigo=${encodeURIComponent(decodedText)}`,
              { replace: true }
            );
          }, 50);
        };

        const onError = () => {}; // reduz ruído

        const configArg =
          typeof cameraConfig === "string"
            ? { deviceId: { exact: cameraConfig } }
            : cameraConfig; // { facingMode: ... }

        await html5QrCode.start(configArg, { fps: 10, qrbox: 250 }, onSuccess, onError);

        timeoutRef.current = setTimeout(() => {
          if (!processedRef.current) {
            toast.error("⚠️ Nenhum QR Code detectado. Tente novamente.");
          }
        }, 20000);

        setErro(false);
      } catch (err) {
        console.error("Erro ao iniciar QR Code:", err);
        setErro(true);
        toast.error("❌ Erro ao iniciar o scanner.");
      }
    },
    [cameraConfig, navigate, stopCamera]
  );

  // ciclo de vida da câmera
  useEffect(() => {
    if (iniciando) return;
    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);
    startCamera();

    const onVis = async () => {
      if (document.hidden && html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(timeoutRef.current);
      processedRef.current = false;
      stopCamera();
    };
  }, [iniciando, startCamera, stopCamera]);

  // ações do hero
  const handleRestart = async () => {
    processedRef.current = false;
    setResultado(null);
    setDetectado(false);
    setHandoff(false);
    await startCamera();
  };

  const handleToggleCamera = async () => {
    const list = devicesRef.current || [];
    if (list.length >= 2) {
      // alterna entre a atual e a outra
      const currentId = typeof cameraConfig === "string" ? cameraConfig : null;
      if (currentId) {
        const idx = list.findIndex((d) => d.id === currentId);
        const next = list[(idx + 1) % list.length];
        setCameraConfig(next?.id || { facingMode: "environment" });
      } else {
        // estava em facingMode: escolhe a primeira id
        setCameraConfig(list[0].id);
      }
    } else {
      // sem múltiplas: alterna facingMode
      const fm = cameraConfig?.facingMode === "user" ? "environment" : "user";
      setCameraConfig({ facingMode: fm });
    }
    // reinicia automaticamente via useEffect
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900">
      {/* 🔶 Hero laranja (padronizado) */}
      <HeaderHero
        onRestart={handleRestart}
        onToggleCamera={handleToggleCamera}
        variant="orange"
      />

      <main role="main" className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-8 px-4"
        >
          <p
            className="text-gray-700 dark:text-gray-300 mb-4 max-w-md mx-auto"
            aria-live="polite"
          >
            Se solicitado, permita o acesso à câmera do dispositivo.
          </p>

          {erro ? (
            <ErroCarregamento mensagem="Erro ao iniciar o leitor de QR Code." />
          ) : iniciando ? (
            <CarregandoSkeleton height="300px" />
          ) : (
            <div
              id="leitor-qr"
              className={`relative mx-auto w-full max-w-sm aspect-square border-4 ${
                detectado ? "border-green-500" : "border-lousa"
              } rounded-xl transition-all duration-300 overflow-hidden bg-black/5`}
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
                  <div className="animate-spin h-8 w-8 rounded-full border-2 border-lousa border-t-transparent" />
                  <p className="text-lousa dark:text-white font-medium">Registrando presença…</p>
                </div>
              )}
            </div>
          )}

          {resultado && !handoff && (
            <p className="mt-4 text-green-600 dark:text-green-400 font-medium break-words">
              Resultado: {resultado}
            </p>
          )}
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
