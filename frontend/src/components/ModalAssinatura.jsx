// src/components/ModalAssinatura.jsx
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import Modal from "react-modal";
import { toast } from "react-toastify";
import Spinner from "./Spinner";
import { apiGet, apiPost } from "../services/api"; // ✅ usar serviço centralizado

export default function ModalAssinatura({ isOpen, onClose }) {
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const sigCanvas = useRef();

  useEffect(() => {
    if (!isOpen) return;

    const fetchAssinatura = async () => {
      setCarregando(true);
      try {
        const data = await apiGet("/api/assinatura");
        if (data?.assinatura) setAssinaturaSalva(data.assinatura);
      } catch (err) {
        console.error("❌ Erro ao carregar assinatura:", err);
        toast.error("❌ Não foi possível carregar a assinatura.");
      } finally {
        setCarregando(false);
      }
    };

    fetchAssinatura();
  }, [isOpen]);

  const salvarAssinatura = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast.warning("⚠️ Faça a assinatura antes de salvar.");
      return;
    }

    const assinaturaBase64 = sigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      await apiPost("/api/assinatura", { assinatura: assinaturaBase64 });
      toast.success("✅ Assinatura salva com sucesso.");
      setAssinaturaSalva(assinaturaBase64);
      setEditando(false);
      sigCanvas.current.clear();
    } catch (err) {
      console.error("❌", err);
      toast.error("❌ Erro ao salvar assinatura.");
    }
  };

  const limparAssinatura = () => {
    sigCanvas.current?.clear();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false}
      className="max-w-xl mx-auto mt-10 p-6 bg-white dark:bg-zinc-900 shadow rounded-2xl outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      {carregando ? (
        <div className="text-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-4 text-lousa dark:text-white">
            ✍️ Assinatura do instrutor
          </h2>

          {assinaturaSalva && !editando ? (
            <div className="mb-4">
              <p className="font-semibold text-sm text-lousa dark:text-white">Assinatura atual:</p>
              <img
                src={assinaturaSalva}
                alt="Assinatura do instrutor"
                className="border rounded mt-1 max-h-32"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditando(true)}
                  className="bg-blue-600 text-white py-1 px-4 rounded hover:bg-blue-700"
                >
                  Alterar Assinatura
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-600 text-white py-1 px-4 rounded hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <>
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className:
                    "border border-gray-400 rounded-md w-full h-32 bg-white dark:bg-gray-100 cursor-crosshair focus:outline-none",
                  "aria-label": "Área para assinar digitalmente",
                  tabIndex: 0,
                }}
              />

              <div className="flex justify-between mt-4">
                <button
                  onClick={limparAssinatura}
                  className="bg-gray-500 text-white py-1 px-4 rounded hover:bg-gray-600"
                >
                  Limpar
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="bg-gray-600 text-white py-1 px-4 rounded hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarAssinatura}
                    className="bg-green-700 text-white py-1 px-4 rounded hover:bg-green-800"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
