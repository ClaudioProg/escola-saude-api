import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";

export default function Scanner() {
  const [resultado, setResultado] = useState(null);
  const [detectado, setDetectado] = useState(false);
  const [erro, setErro] = useState(false);
  const [iniciando, setIniciando] = useState(true);

  const navigate = useNavigate();
  const html5QrCodeRef = useRef(null);
  const timeoutRef = useRef(null);

  // Apenas espera o DOM montar o loader (estado visual)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIniciando(false);
    }, 300); // tempo mínimo de delay para garantir renderização do DOM

    return () => clearTimeout(timeout);
  }, []);

  // Inicia o scanner somente depois que o DOM foi montado (e "iniciando" for false)
  useEffect(() => {
    if (iniciando) return;

    const iniciarLeitor = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const elemento = document.getElementById("leitor-qr");
        if (!elemento) throw new Error("Elemento com id 'leitor-qr' não encontrado.");

        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.stop().catch(() => {});
          await html5QrCodeRef.current.clear().catch(() => {});
        }

        const html5QrCode = new Html5Qrcode("leitor-qr");
        html5QrCodeRef.current = html5QrCode;

        const devices = await Html5Qrcode.getCameras();
        if (!devices.length) throw new Error("Nenhuma câmera encontrada.");

        const camera = devices.find((d) => d.label.toLowerCase().includes("back")) || devices[0];

        await html5QrCode.start(
          camera.id,
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            if (decodedText && decodedText !== resultado) {
              clearTimeout(timeoutRef.current);
              setDetectado(true);
              setResultado(decodedText);
              toast.success("✅ QR Code lido com sucesso!");
              html5QrCode.stop().then(() => {
                navigate(`/validar-presenca?codigo=${encodeURIComponent(decodedText)}`);
              });
            }
          },
          () => {}
        );

        timeoutRef.current = setTimeout(() => {
          toast.error("⚠️ Nenhum QR Code detectado. Tente novamente.");
        }, 20000);

        setErro(false);
      } catch (err) {
        console.error("Erro ao iniciar QR Code:", err);
        setErro(true);
        toast.error("❌ Erro ao iniciar o scanner.");
      }
    };

    iniciarLeitor();

    return () => {
      clearTimeout(timeoutRef.current);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => html5QrCodeRef.current.clear())
          .catch(() => {});
      }
    };
  }, [iniciando]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gelo dark:bg-neutral-900 text-center py-8 px-4"
    >
      <h1 className="text-2xl font-bold mb-4 text-lousa dark:text-white" role="heading">
        Escanear QR Code
      </h1>
      <p
        className="text-gray-600 dark:text-gray-300 mb-4 max-w-md mx-auto"
        aria-label="Instruções para escanear"
      >
        Aponte a câmera para o QR Code fixado na sala. A leitura será automática e sua presença será registrada.
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
          } rounded-xl transition-all duration-300`}
          role="region"
          aria-label="Leitor de QR Code"
        >
          <div className="absolute top-2 right-2 animate-pulse">
            <QrCodeIcon />
          </div>
          {detectado && (
            <div className="absolute bottom-2 right-2 text-green-500" aria-hidden="true">
              <CheckCircle size={32} />
            </div>
          )}
        </div>
      )}

      {resultado && (
        <p className="mt-4 text-green-600 dark:text-green-400 font-medium break-words">
          Resultado: {resultado}
        </p>
      )}
    </motion.div>
  );
}

function QrCodeIcon() {
  return (
    <svg
      className="w-6 h-6 text-lousa dark:text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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
