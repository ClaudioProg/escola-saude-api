// 📁 src/components/ModalAssinatura.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "react-toastify";
import Spinner from "./Spinner";
import Modal from "./Modal";
import { apiGet, apiPost } from "../services/api";
import { PenLine, Eraser, Save, X, RotateCcw } from "lucide-react";

/**
 * ModalAssinatura (premium)
 * - Carrega assinatura salva ao abrir (tenta /assinatura; fallback /api/assinatura).
 * - Visualiza a assinatura atual e permite editar.
 * - Canvas responsivo com DPI real (sem blur) + restaura strokes ao redimensionar.
 * - Salva PNG base64 (trimmed).
 */
export default function ModalAssinatura({ isOpen, onClose, onSaved }) {
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  const sigCanvas = useRef(null);
  const containerRef = useRef(null);
  const resizeRO = useRef(null);

  // snapshot de strokes para restaurar após resize
  const strokesRef = useRef(null);

  const pickAssinatura = (data) => data?.assinatura || data?.dataUrl || data?.imagem_base64 || null;

  const setCanvasDpiSize = useCallback((canvas, cssWidth, cssHeight) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ✅ não acumula escala
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }, []);

  const computeCanvasHeight = (cssWidth) =>
    Math.max(190, Math.min(340, Math.round(cssWidth * 0.36)));

  const snapshotStrokes = useCallback(() => {
    const instance = sigCanvas.current;
    if (!instance) return;
    try {
      // react-signature-canvas expõe toData()
      strokesRef.current = instance.toData();
    } catch {
      strokesRef.current = null;
    }
  }, []);

  const restoreStrokes = useCallback(() => {
    const instance = sigCanvas.current;
    if (!instance) return;

    try {
      if (Array.isArray(strokesRef.current) && strokesRef.current.length) {
        instance.fromData(strokesRef.current);
      }
    } catch {
      /* no-op */
    }
  }, []);

  const resizeSignatureCanvas = useCallback(() => {
    const instance = sigCanvas.current;
    const canvas = instance?.getCanvas?.();
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    // ✅ salva strokes antes do resize
    snapshotStrokes();

    const cssWidth = parent.clientWidth || 0;
    if (!cssWidth) return;

    const cssHeight = computeCanvasHeight(cssWidth);
    setCanvasDpiSize(canvas, cssWidth, cssHeight);

    // reabilita listeners do lib (alguns browsers precisam)
    try {
      instance.off();
      instance.on();
    } catch {}

    // ✅ restaura strokes depois
    restoreStrokes();
  }, [restoreStrokes, setCanvasDpiSize, snapshotStrokes]);

  // =============== ResizeObserver + window resize (throttle rAF) ===============
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

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeRO.current = new ResizeObserver(schedule);
      resizeRO.current.observe(containerRef.current);
    }
    window.addEventListener("resize", schedule);

    // 1ª medição
    const id = setTimeout(schedule, 60);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", schedule);
      resizeRO.current?.disconnect();
      resizeRO.current = null;
    };
  }, [isOpen, resizeSignatureCanvas]);

  // ======================== Carregamento inicial =========================
  useEffect(() => {
    let ativo = true;

    (async () => {
      if (!isOpen) return;

      setCarregando(true);
      setEditando(false);
      setSalvando(false);

      try {
        let data;
        try {
          data = await apiGet("/assinatura", { on403: "silent" });
        } catch (e1) {
          if (e1?.status === 404) data = await apiGet("/api/assinatura", { on403: "silent" });
          else throw e1;
        }

        if (ativo) {
          const assinatura = pickAssinatura(data);
          setAssinaturaSalva(assinatura || null);
        }
      } catch (err) {
        console.error("❌ Erro ao carregar assinatura:", err);
        if (ativo) toast.error("❌ Não foi possível carregar a assinatura.");
      } finally {
        if (ativo) setCarregando(false);
        // ajuste após render
        setTimeout(() => isOpen && resizeSignatureCanvas(), 80);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [isOpen, resizeSignatureCanvas]);

  // ============================ Ações ====================================
  const fechar = () => onClose?.();

  const iniciarEdicao = () => {
    setEditando(true);

    // ao entrar em edição, tentar “pré-carregar” assinatura salva no canvas
    requestAnimationFrame(() => {
      resizeSignatureCanvas();
      const instance = sigCanvas.current;
      if (!instance) return;

      if (assinaturaSalva) {
        try {
          instance.clear();
          instance.fromDataURL(assinaturaSalva, { ratio: 1, width: 0, height: 0 });
          // after fromDataURL, salva strokes para resizes futuros
          snapshotStrokes();
        } catch {
          /* se falhar, segue em branco */
        }
      } else {
        try {
          instance.clear();
        } catch {}
      }
    });
  };

  const limparAssinatura = () => {
    const instance = sigCanvas.current;
    if (!instance) return;
    instance.clear();
    strokesRef.current = null;
  };

  const desfazer = () => {
    const instance = sigCanvas.current;
    if (!instance) return;
    try {
      const data = instance.toData();
      if (!data?.length) return;
      data.pop();
      instance.fromData(data);
      strokesRef.current = data;
    } catch {}
  };

  const salvarAssinatura = async () => {
    const instance = sigCanvas.current;
    if (!instance || instance.isEmpty()) {
      toast.warning("⚠️ Faça a assinatura antes de salvar.");
      return;
    }

    setSalvando(true);
    try {
      // ✅ recorta bordas vazias (fica mais leve e bonito)
      const trimmed = instance.getTrimmedCanvas?.() || instance.getCanvas();
      const dataUrl = trimmed.toDataURL("image/png");

      try {
        await apiPost("/assinatura", { assinatura: dataUrl });
      } catch (e1) {
        if (e1?.status === 404) await apiPost("/api/assinatura", { assinatura: dataUrl });
        else throw e1;
      }

      setAssinaturaSalva(dataUrl);
      setEditando(false);
      instance.clear();
      strokesRef.current = null;

      toast.success("✅ Assinatura salva com sucesso.");
      onSaved?.(dataUrl);
    } catch (err) {
      console.error("❌", err);
      toast.error("❌ Erro ao salvar assinatura.");
    } finally {
      setSalvando(false);
    }
  };

  // ============================== UI =====================================
  return (
    <Modal
      open={isOpen}
      onClose={fechar}
      labelledBy="titulo-assinatura"
      describedBy="desc-assinatura"
      className="max-w-2xl w-[min(720px,92vw)]"
    >
      {carregando ? (
        <div className="text-center py-10">
          <Spinner />
        </div>
      ) : (
        <div ref={containerRef} className="flex flex-col max-h-[78vh]">
          {/* Cabeçalho */}
          <div className="rounded-3xl -m-1 mb-4 p-[1px] bg-gradient-to-br from-emerald-600 via-teal-500 to-indigo-500">
            <div className="rounded-3xl p-4 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
              <h2
                id="titulo-assinatura"
                className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2"
              >
                <PenLine className="w-5 h-5" aria-hidden="true" />
                Assinatura do Instrutor
              </h2>
              <p id="desc-assinatura" className="text-xs sm:text-sm text-white/90">
                Use o mouse, caneta ou o toque para assinar. A confirmação libera linhas nítidas em telas retina.
              </p>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-auto pr-1">
            {assinaturaSalva && !editando ? (
              <div className="mb-4">
                <p className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Assinatura atual
                </p>

                <div className="mt-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white p-3">
                  <img
                    src={assinaturaSalva}
                    alt="Assinatura do instrutor"
                    className="block max-h-40 w-full object-contain"
                  />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={iniciarEdicao}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-xl
                               hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700/40"
                    aria-label="Alterar assinatura"
                    title="Alterar assinatura"
                  >
                    <PenLine className="w-4 h-4" /> Alterar
                  </button>

                  <button
                    type="button"
                    onClick={fechar}
                    className="inline-flex items-center gap-2 bg-zinc-700 text-white py-2 px-4 rounded-xl
                               hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700/40"
                    aria-label="Fechar"
                    title="Fechar"
                  >
                    <X className="w-4 h-4" /> Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold text-zinc-600 bg-zinc-50 border-b border-zinc-200">
                    Dica: assine no centro. Você pode desfazer o último traço.
                  </div>

                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#111827"
                    minWidth={0.9}
                    maxWidth={2.4}
                    throttle={16}
                    onEnd={() => {
                      // guarda strokes para manter em resize
                      try {
                        strokesRef.current = sigCanvas.current?.toData?.() || null;
                      } catch {}
                    }}
                    canvasProps={{
                      className:
                        "w-full rounded-b-2xl bg-white focus:outline-none touch-manipulation select-none",
                      "aria-label": "Área para assinar digitalmente",
                    }}
                  />
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={desfazer}
                      className="inline-flex items-center gap-2 bg-zinc-600 text-white py-2 px-4 rounded-xl
                                 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-700/40"
                      aria-label="Desfazer último traço"
                      title="Desfazer"
                    >
                      <RotateCcw className="w-4 h-4" /> Desfazer
                    </button>

                    <button
                      type="button"
                      onClick={limparAssinatura}
                      className="inline-flex items-center gap-2 bg-zinc-500 text-white py-2 px-4 rounded-xl
                                 hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
                      aria-label="Limpar assinatura"
                      title="Limpar assinatura"
                    >
                      <Eraser className="w-4 h-4" /> Limpar
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={fechar}
                      className="inline-flex items-center gap-2 bg-zinc-700 text-white py-2 px-4 rounded-xl
                                 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700/40"
                      disabled={salvando}
                      aria-label="Cancelar"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={salvarAssinatura}
                      className="inline-flex items-center gap-2 bg-emerald-700 text-white py-2 px-4 rounded-xl
                                 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/40
                                 disabled:opacity-60 disabled:cursor-not-allowed"
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
