// 📁 src/components/ModalAssinatura.jsx
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "react-toastify";
import Spinner from "./Spinner";
import Modal from "./Modal";
import { apiGet, apiPost } from "../services/api";
import { lockScroll, unlockScroll } from "../utils/scroll";
import { PenLine, Eraser, Save, X } from "lucide-react";

export default function ModalAssinatura({ isOpen, onClose }) {
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);
  const sigCanvas = useRef(null);
  const containerRef = useRef(null);

  // 🔁 força o canvas a recalcular dimensões quando o modal abrir
  const forceResizeCanvas = () => {
    const c = sigCanvas.current;
    if (!c) return;
    try {
      // limpa e re-renderiza; ajuda quando o modal abre com display: none
      const data = !c.isEmpty() ? c.getTrimmedCanvas().toDataURL() : null;
      c.clear();
      // pequena espera pro layout assentar
      setTimeout(() => {
        if (data) {
          // não dá pra “repor” o desenho no plugin; o importante aqui é garantir
          // que a área de assinatura esteja com o tamanho correto pro usuário assinar.
        }
        // nada a fazer; apenas garantir que o wrapper tenha dimensões
      }, 0);
    } catch {}
  };

  // 🔒 scroll lock no open/unlock no close
  useEffect(() => {
    if (isOpen) {
      lockScroll();
    }
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  // Carrega assinatura quando abrir
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      if (!isOpen) return;
      setCarregando(true);
      setEditando(false);
      try {
        // tenta rota curta; cai pra /api/assinatura se 404
        let data;
        try {
          data = await apiGet("/assinatura", { on403: "silent" });
        } catch (e1) {
          if (e1?.status === 404) {
            data = await apiGet("/api/assinatura", { on403: "silent" });
          } else {
            throw e1;
          }
        }
        if (ativo) setAssinaturaSalva(data?.assinatura || null);
      } catch (err) {
        console.error("❌ Erro ao carregar assinatura:", err);
        if (ativo) toast.error("❌ Não foi possível carregar a assinatura.");
      } finally {
        if (ativo) setCarregando(false);
        // dá um tempo pro modal renderizar, aí ajusta o canvas
        setTimeout(forceResizeCanvas, 60);
      }
    };
    carregar();
    return () => { ativo = false; };
  }, [isOpen]);

  const salvarAssinatura = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast.warning("⚠️ Faça a assinatura antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const dataUrl = sigCanvas.current.getCanvas().toDataURL("image/png");
      // tenta rota curta; fallback pra /api/assinatura
      try {
        await apiPost("/assinatura", { assinatura: dataUrl });
      } catch (e1) {
        if (e1?.status === 404) {
          await apiPost("/api/assinatura", { assinatura: dataUrl });
        } else {
          throw e1;
        }
      }
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
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    sigCanvas.current.clear();
  };

  const fechar = () => {
    unlockScroll();
    onClose?.();
  };

  return (
    <Modal
      open={isOpen}
      onClose={fechar}
      labelledBy="titulo-assinatura"
      describedBy="desc-assinatura"
      className="max-w-xl w-full"
    >
      {carregando ? (
        <div className="text-center py-10">
          <Spinner />
        </div>
      ) : (
        <div ref={containerRef} className="flex flex-col max-h-[75vh]">
          {/* Hero do modal */}
          <div className="rounded-t-xl -m-4 mb-4 p-4 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
            <h2 id="titulo-assinatura" className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2">
              <PenLine className="w-5 h-5" aria-hidden="true" />
              Assinatura do Instrutor
            </h2>
            <p id="desc-assinatura" className="text-xs sm:text-sm text-white/90">
              Use o mouse ou o toque para assinar digitalmente.
            </p>
          </div>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-auto pr-1">
            {assinaturaSalva && !editando ? (
              <div className="mb-4">
                <p className="font-semibold text-sm text-lousa dark:text-white">
                  Assinatura atual:
                </p>
                <img
                  src={assinaturaSalva}
                  alt="Assinatura do instrutor"
                  className="border rounded mt-2 max-h-36 bg-white"
                />

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setEditando(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white py-1.5 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/40"
                  >
                    <PenLine className="w-4 h-4" /> Alterar
                  </button>
                  <button
                    onClick={fechar}
                    className="inline-flex items-center gap-2 bg-gray-600 text-white py-1.5 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700/40"
                  >
                    <X className="w-4 h-4" /> Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-gray-300 dark:border-zinc-700 bg-white">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#111827"
                    minWidth={0.8}
                    maxWidth={2.2}
                    throttle={16}
                    canvasProps={{
                      className:
                        "w-full h-48 sm:h-56 rounded-md bg-white cursor-crosshair focus:outline-none",
                      "aria-label": "Área para assinar digitalmente",
                    }}
                  />
                </div>

                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    onClick={limparAssinatura}
                    className="inline-flex items-center gap-2 bg-gray-500 text-white py-1.5 px-4 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600/40"
                  >
                    <Eraser className="w-4 h-4" /> Limpar
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={fechar}
                      className="inline-flex items-center gap-2 bg-gray-600 text-white py-1.5 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700/40"
                      disabled={salvando}
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={salvarAssinatura}
                      className="inline-flex items-center gap-2 bg-emerald-700 text-white py-1.5 px-4 rounded-lg hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/40 disabled:opacity-60"
                      disabled={salvando}
                    >
                      <Save className="w-4 h-4" />
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
