// 📁 src/components/ModalAssinatura.jsx
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "react-toastify";
import Spinner from "./Spinner";
import Modal from "./Modal"; // ✅ use o seu Modal
import { apiGet, apiPost } from "../services/api";

export default function ModalAssinatura({ isOpen, onClose }) {
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);
  const sigCanvas = useRef(null);

  // Carrega assinatura quando abrir
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      if (!isOpen) return;
      setCarregando(true);
      setEditando(false); // sempre volta pro modo visualização ao abrir
      try {
        const data = await apiGet("/api/assinatura");
        if (ativo) setAssinaturaSalva(data?.assinatura || null);
      } catch (err) {
        console.error("❌ Erro ao carregar assinatura:", err);
        if (ativo) toast.error("❌ Não foi possível carregar a assinatura.");
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    carregar();
    return () => {
      ativo = false;
    };
  }, [isOpen]);

  const salvarAssinatura = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast.warning("⚠️ Faça a assinatura antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const dataUrl = sigCanvas.current.getCanvas().toDataURL("image/png");
      await apiPost("/api/assinatura", { assinatura: dataUrl });
      setAssinaturaSalva(dataUrl);
      setEditando(false);
      sigCanvas.current?.clear();
      toast.success("✅ Assinatura salva com sucesso.");
    } catch (err) {
      console.error("❌", err);
      toast.error("❌ Erro ao salvar assinatura.");
    } finally {
      setSalvando(false);
    }
  };

  const limparAssinatura = () => {
    if (!sigCanvas.current) return;
    if (sigCanvas.current.isEmpty()) return;
    sigCanvas.current.clear();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-assinatura"
      describedBy="desc-assinatura"
      className="max-w-xl w-full"
    >
      {carregando ? (
        <div className="text-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          <h2
            id="titulo-assinatura"
            className="text-xl font-bold mb-4 text-lousa dark:text-white"
          >
            ✍️ Assinatura do instrutor
          </h2>

          {assinaturaSalva && !editando ? (
            <div className="mb-4" id="desc-assinatura">
              <p className="font-semibold text-sm text-lousa dark:text-white">
                Assinatura atual:
              </p>
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
              <p id="desc-assinatura" className="sr-only">
                Desenhe sua assinatura no quadro abaixo usando mouse ou toque.
              </p>

              <SignatureCanvas
                ref={sigCanvas}
                penColor="#111827"           // cinza-900
                minWidth={0.8}
                maxWidth={2.2}
                throttle={16}
                canvasProps={{
                  className:
                    "border border-gray-400 rounded-md w-full h-40 bg-white cursor-crosshair focus:outline-none",
                  "aria-label": "Área para assinar digitalmente",
                }}
              />

              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={limparAssinatura}
                  className="bg-gray-500 text-white py-1 px-4 rounded hover:bg-gray-600"
                >
                  Limpar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-gray-600 text-white py-1 px-4 rounded hover:bg-gray-700"
                    disabled={salvando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarAssinatura}
                    className="bg-green-700 text-white py-1 px-4 rounded hover:bg-green-800 disabled:opacity-60"
                    disabled={salvando}
                  >
                    {salvando ? "Salvando..." : "Salvar"}
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
