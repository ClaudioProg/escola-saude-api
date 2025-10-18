// 📁 src/components/ModalAssinatura.jsx
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "react-toastify";
import Spinner from "./Spinner";
import Modal from "./Modal";
import { apiGet, apiPost } from "../services/api";
import { PenLine, Eraser, Save, X } from "lucide-react";

/**
 * ModalAssinatura
 * - Carrega assinatura salva ao abrir (tenta /assinatura; fallback /api/assinatura).
 * - Permite desenhar/limpar/salvar (PNG base64).
 * - Canvas responsivo e com DPI (linhas nítidas em telas retina).
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSaved?: (dataUrl: string) => void
 */
export default function ModalAssinatura({ isOpen, onClose, onSaved }) {
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  const sigCanvas = useRef(null);
  const containerRef = useRef(null);
  const resizeRO = useRef(null);

  // ====================== Canvas: responsivo + DPI =======================
  // Observa o container e ajusta o canvas (sem restaurar desenho — esperado)
  const resizeSignatureCanvas = () => {
    const instance = sigCanvas.current;
    const canvas = instance?.getCanvas?.();
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    // guarda desenho (opcional). Como o lib não tem fromData direto aqui,
    // priorizamos corretude do tamanho (UX); não “restauramos” strokes.
    // Se quiser snapshot, use getTrimmedCanvas().toDataURL() e exiba como <img>.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = parent.clientWidth || 0;

    // altura “inteligente”: entre 192 e 320px; 35% da largura como base
    const cssHeight = Math.max(192, Math.min(320, Math.round(cssWidth * 0.35)));

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // força o lib a recalc internamente (clear “soft” não apaga traços futuros)
    try {
      instance.off(); // encerra desenho atual
      instance.on();  // reabilita
    } catch {
      /* no-op */
    }
  };

  // Throttle resize com rAF
  useEffect(() => {
    if (!isOpen) return;
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        resizeSignatureCanvas();
        scheduled = false;
      });
    };

    // ResizeObserver para mudança de layout
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeRO.current = new ResizeObserver(schedule);
      resizeRO.current.observe(containerRef.current);
    }

    // fallback: evento global de resize
    window.addEventListener("resize", schedule);
    // primeira medição depois de montar
    setTimeout(schedule, 60);

    return () => {
      window.removeEventListener("resize", schedule);
      resizeRO.current?.disconnect();
      resizeRO.current = null;
    };
  }, [isOpen]);

  // ======================== Carregamento inicial =========================
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!isOpen) return;
      setCarregando(true);
      setEditando(false);
      try {
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
        // garante um ajuste após render
        setTimeout(() => isOpen && resizeSignatureCanvas(), 80);
      }
    })();
    return () => { ativo = false; };
  }, [isOpen]);

  // ============================ Ações ====================================
  const salvarAssinatura = async () => {
    const instance = sigCanvas.current;
    if (!instance || instance.isEmpty()) {
      toast.warning("⚠️ Faça a assinatura antes de salvar.");
      return;
    }

    setSalvando(true);
    try {
      const dataUrl = instance.getCanvas().toDataURL("image/png");
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
      instance.clear();
      toast.success("✅ Assinatura salva com sucesso.");
      onSaved?.(dataUrl);
    } catch (err) {
      console.error("❌", err);
      toast.error("❌ Erro ao salvar assinatura.");
    } finally {
      setSalvando(false);
    }
  };

  const limparAssinatura = () => {
    const instance = sigCanvas.current;
    if (!instance || instance.isEmpty()) return;
    instance.clear();
  };

  const fechar = () => {
    onClose?.();
  };

  // ============================== UI =====================================
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
          {/* Cabeçalho do modal */}
          <div className="rounded-t-xl -m-4 mb-4 p-4 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
            <h2
              id="titulo-assinatura"
              className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2"
            >
              <PenLine className="w-5 h-5" aria-hidden="true" />
              Assinatura do Instrutor
            </h2>
            <p id="desc-assinatura" className="text-xs sm:text-sm text-white/90">
              Use o mouse, caneta ou o toque para assinar digitalmente.
            </p>
          </div>

          {/* Conteúdo */}
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
                    type="button"
                    onClick={() => setEditando(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white py-1.5 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/40"
                    aria-label="Alterar assinatura"
                    title="Alterar assinatura"
                  >
                    <PenLine className="w-4 h-4" /> Alterar
                  </button>
                  <button
                    type="button"
                    onClick={fechar}
                    className="inline-flex items-center gap-2 bg-gray-600 text-white py-1.5 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700/40"
                    aria-label="Fechar"
                    title="Fechar"
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
                    aria-label="Limpar assinatura"
                    title="Limpar assinatura"
                  >
                    <Eraser className="w-4 h-4" /> Limpar
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={fechar}
                      className="inline-flex items-center gap-2 bg-gray-600 text-white py-1.5 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700/40"
                      disabled={salvando}
                      aria-label="Cancelar"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={salvarAssinatura}
                      className="inline-flex items-center gap-2 bg-emerald-700 text-white py-1.5 px-4 rounded-lg hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/40 disabled:opacity-60"
                      disabled={salvando}
                      aria-label="Salvar assinatura"
                      title="Salvar assinatura"
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
