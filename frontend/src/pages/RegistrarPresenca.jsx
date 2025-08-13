// ✅ src/pages/RegistrarPresenca.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import QrScanner from "react-qr-scanner";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import { apiPost } from "../services/api";
import ErroCarregamento from "../components/ErroCarregamento";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { API_BASE_URL } from "../services/api"

export default function RegistrarPresenca() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const nome = localStorage.getItem("nome") || "";

  const [carregando, setCarregando] = useState(false);
  const [erroCamera, setErroCamera] = useState(false);
  const lockRef = useRef(false);
  const lastScanRef = useRef(0);

  // Preferência pela câmera traseira quando possível (mobile)
  const videoConstraints = useMemo(
    () => ({
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    }),
    []
  );

  useEffect(() => {
    if (!token) toast.error("⚠️ Faça login para registrar presença.");
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  function ensureLeadingSlash(path) {
    if (!path) return "/";
    return path.startsWith("/") ? path : `/${path}`;
  }

  function parseQrPayload(text) {
    // Aceita dois formatos:
    // 1) URL do backend: https://.../api/presencas/confirmar-qr?token=XYZ
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
          return {
            kind: "json",
            path: ensureLeadingSlash(parsed.path),
            payload: parsed.payload ?? {},
          };
        }
        return { kind: "invalid", reason: "Formato JSON inválido no QR Code." };
      } catch {
        return { kind: "invalid", reason: "Conteúdo do QR Code inválido." };
      }
    }
  }

  const handleScan = async (data) => {
    if (!data || carregando) return;

    // Debounce básico (ignora múltiplos scans em < 1.2s)
    const now = Date.now();
    if (now - lastScanRef.current < 1200) return;
    lastScanRef.current = now;

    if (lockRef.current) return;
    lockRef.current = true;

    const text = data?.text || data; // libs podem retornar string
    const parsed = parseQrPayload(String(text));

    if (parsed.kind === "invalid") {
      lockRef.current = false;
      toast.warning(`⚠️ ${parsed.reason}`);
      return;
    }

    try {
      setCarregando(true);

      if (parsed.kind === "url") {
        await apiPost(parsed.path, null); // backend infere via querystring/token do QR
      } else {
        await apiPost(parsed.path, parsed.payload);
      }

      toast.success("✅ Presença registrada com sucesso!");
      navigate("/meus-certificados");
    } catch (err) {
      const msg =
        err?.data?.erro || err?.data?.message || err?.message || "QR Code inválido ou presença já registrada.";
      toast.warning(`⚠️ ${msg}`);
    } finally {
      setCarregando(false);
      setTimeout(() => (lockRef.current = false), 500);
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
          mensagem="Verifique as permissões do navegador. Em celulares, tente Chrome/Firefox atualizados."
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
              constraints={{ video: videoConstraints }}
            />
          )}
        </div>
      )}

      {carregando && (
        <p className="mt-4 text-lousa dark:text-white animate-pulse" role="status" aria-live="polite">
          ⏳ Registrando presença...
        </p>
      )}
    </motion.main>
  );
}
