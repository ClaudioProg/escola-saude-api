// ✅ src/pages/RegistrarPresenca.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import ErroCarregamento from "../components/ErroCarregamento";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

export default function RegistrarPresenca() {
  const [carregando, setCarregando] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const nome = localStorage.getItem("nome") || "";

  const handleScan = async (data) => {
    if (!data || carregando) return;

    try {
      setCarregando(true);
      const res = await fetch(data.text, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const resultado = await res.json();
      if (res.ok) {
        toast.success("✅ Presença registrada com sucesso!");
        navigate("/meus-certificados");
      } else {
        toast.warning(`⚠️ ${resultado.erro || "QR Code inválido."}`);
      }
    } catch (error) {
      toast.error("❌ Erro ao registrar presença.");
    } finally {
      setCarregando(false);
    }
  };

  const handleError = (err) => {
    console.error("Erro ao acessar câmera:", err);
    setErroCamera(true);
  };

  return (
    <motion.main
      className="p-4 max-w-2xl mx-auto text-center min-h-screen flex flex-col justify-center items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h1 className="text-2xl font-bold text-lousa mb-2 dark:text-white">📸 Escanear QR Code da Sala</h1>
      <p className="mb-4 text-gray-700 dark:text-gray-200">
        Seja bem-vindo(a), <strong>{nome}</strong>. Aponte sua câmera para o QR Code fixado na sala.
      </p>

      {erroCamera ? (
        <ErroCarregamento
          titulo="Erro ao acessar a câmera"
          mensagem="Verifique se o navegador tem permissão para usar a câmera."
        />
      ) : (
        <div className="rounded-xl overflow-hidden border border-lousa w-full">
          {carregando ? (
            <CarregandoSkeleton height="300px" />
          ) : (
            <QrScanner
              delay={500}
              onError={handleError}
              onScan={handleScan}
              style={{ width: "100%", height: "300px" }}
            />
          )}
        </div>
      )}

      {carregando && (
        <p
          className="mt-4 text-lousa dark:text-white animate-pulse"
          role="status"
          aria-live="polite"
        >
          ⏳ Registrando presença...
        </p>
      )}
    </motion.main>
  );
}
