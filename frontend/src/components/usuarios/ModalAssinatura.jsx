// ✅ frontend/src/components/usuarios/ModalAssinatura.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Modal premium para assinatura digital do usuário autenticado.
 *
 * Regra oficial:
 * - Qualquer usuário autenticado pode obter, gerar ou salvar a própria assinatura.
 * - A assinatura também é usada em fluxos como termo de reserva de sala.
 *
 * Contrato oficial de API:
 * - GET  /api/assinatura
 * - POST /api/assinatura
 *
 * Services oficiais esperados:
 * - apiAssinaturaObter()
 * - apiAssinaturaSalvar({ assinatura })
 *
 * Não usar:
 * - apiGet/apiPost genérico nesta tela
 * - fallback /api/assinatura
 * - Spinner antigo
 * - Modal antigo
 * - texto "Assinatura do organizador"
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  PenLine,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import { createPortal } from "react-dom";

import {
  apiAssinaturaObter,
  apiAssinaturaSalvar,
} from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

const MAX_FRONTEND_DATAURL_LENGTH = 6 * 1024 * 1024;

const DATA_IMAGE_URL_RE =
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response) {
  return response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

function normalizarAssinatura(value) {
  const assinatura = String(value || "").trim();

  if (!assinatura) return null;

  if (assinatura.startsWith("data:image/")) {
    return assinatura;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(assinatura)) {
    return `data:image/png;base64,${assinatura}`;
  }

  return null;
}

function extrairAssinatura(response) {
  const payload = unwrap(response);

  return normalizarAssinatura(
    payload?.assinatura ||
      payload?.data?.assinatura ||
      payload?.imagem_base64 ||
      payload?.data?.imagem_base64
  );
}

function assinaturaValida(dataUrl) {
  const value = String(dataUrl || "").trim();

  if (!value) return false;
  if (value.length > MAX_FRONTEND_DATAURL_LENGTH) return false;

  return DATA_IMAGE_URL_RE.test(value);
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SpinnerLocal() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      aria-hidden="true"
    />
  );
}

const BotaoModal = React.forwardRef(function BotaoModal(
  {
    children,
    variant = "primary",
    className = "",
    leftIcon = null,
    loading = false,
    disabled = false,
    type = "button",
    ...props
  },
  ref
) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/70",
    secondary:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 focus-visible:ring-emerald-500/70 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/5",
    neutral:
      "bg-zinc-700 text-white hover:bg-zinc-800 focus-visible:ring-zinc-600/70",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/70",
  };

  return (
<button
  ref={ref}
  type={type}
      disabled={disabled || loading}
      className={cx(base, variants[variant] || variants.primary, className)}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
});

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function ModalAssinatura({
  isOpen,
  onClose,
  onSaved,
}) {
  const uid = useId();

  const titleId = `modal-assinatura-title-${uid}`;
  const descId = `modal-assinatura-desc-${uid}`;
  const errorId = `modal-assinatura-error-${uid}`;
  const liveId = `modal-assinatura-live-${uid}`;

  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [msgA11y, setMsgA11y] = useState("");

  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const editRef = useRef(null);
  const saveRef = useRef(null);
  const sigCanvas = useRef(null);
  const containerRef = useRef(null);
  const resizeRO = useRef(null);
  const strokesRef = useRef(null);

  const temAssinatura = Boolean(assinaturaSalva);

  const descricaoModal = useMemo(() => {
    if (editando) {
      return "Use mouse, caneta ou toque para registrar sua assinatura digital.";
    }

    if (temAssinatura) {
      return "Revise sua assinatura atual ou altere quando necessário.";
    }

    return "Crie sua assinatura digital para uso nos fluxos da plataforma.";
  }, [editando, temAssinatura]);

  const setCanvasDpiSize = useCallback((canvas, cssWidth, cssHeight) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }, []);

  const computeCanvasHeight = useCallback((cssWidth) => {
    return Math.max(190, Math.min(340, Math.round(cssWidth * 0.36)));
  }, []);

  const snapshotStrokes = useCallback(() => {
    const instance = sigCanvas.current;

    if (!instance) return;

    try {
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
      // noop
    }
  }, []);

  const resizeSignatureCanvas = useCallback(() => {
    const instance = sigCanvas.current;
    const canvas = instance?.getCanvas?.();
    const parent = canvas?.parentElement;

    if (!canvas || !parent) return;

    snapshotStrokes();

    const cssWidth = parent.clientWidth || 0;

    if (!cssWidth) return;

    const cssHeight = computeCanvasHeight(cssWidth);

    setCanvasDpiSize(canvas, cssWidth, cssHeight);

    try {
      instance.off();
      instance.on();
    } catch {
      // noop
    }

    restoreStrokes();
  }, [
    computeCanvasHeight,
    restoreStrokes,
    setCanvasDpiSize,
    snapshotStrokes,
  ]);

  const fechar = useCallback(() => {
    if (salvando) return;

    onClose?.();
  }, [onClose, salvando]);

  const carregarAssinatura = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setEditando(false);
    setSalvando(false);
    setMsgA11y("Carregando assinatura...");

    try {
      const response = await apiAssinaturaObter();
      const assinatura = extrairAssinatura(response);

      setAssinaturaSalva(assinatura || null);
      setMsgA11y(
        assinatura
          ? "Assinatura carregada."
          : "Nenhuma assinatura cadastrada."
      );
    } catch (error) {
      console.error("[ModalAssinatura] erro ao carregar assinatura", {
        message: error?.message,
        status: error?.status,
      });

      const message = getErrorMessage(
        error,
        "Não foi possível carregar a assinatura."
      );

      setErro(message);
      setAssinaturaSalva(null);
      setMsgA11y(message);
      toast.error(message);
    } finally {
      setCarregando(false);

      window.setTimeout(() => {
        if (isOpen) resizeSignatureCanvas();
      }, 80);
    }
  }, [isOpen, resizeSignatureCanvas]);

  useEffect(() => {
    if (!isOpen) return;

    carregarAssinatura();
  }, [carregarAssinatura, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActive = document.activeElement;

    const timer = window.setTimeout(() => {
      if (temAssinatura && !editando) {
        editRef.current?.focus?.();
      } else {
        closeRef.current?.focus?.();
      }
    }, 60);

    return () => {
      window.clearTimeout(timer);
      previousActive?.focus?.();
    };
  }, [editando, isOpen, temAssinatura]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        fechar();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll(
        [
          "button:not([disabled])",
          "[href]",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(",")
      );

      const elements = Array.from(focusable || []).filter(
        (element) => !element.hasAttribute("aria-hidden")
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fechar, isOpen]);

  useEffect(() => {
    if (!isOpen || !editando) return undefined;

    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;

      scheduled = true;

      window.requestAnimationFrame(() => {
        resizeSignatureCanvas();
        scheduled = false;
      });
    };

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeRO.current = new ResizeObserver(schedule);
      resizeRO.current.observe(containerRef.current);
    }

    window.addEventListener("resize", schedule);

    const timer = window.setTimeout(schedule, 80);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      resizeRO.current?.disconnect?.();
      resizeRO.current = null;
    };
  }, [editando, isOpen, resizeSignatureCanvas]);

  function iniciarEdicao() {
    setEditando(true);
    setErro("");
    setMsgA11y("Modo de edição de assinatura aberto.");

    window.requestAnimationFrame(() => {
      resizeSignatureCanvas();

      const instance = sigCanvas.current;

      if (!instance) return;

      if (assinaturaSalva) {
        try {
          instance.clear();
          instance.fromDataURL(assinaturaSalva);
          snapshotStrokes();
        } catch {
          try {
            instance.clear();
          } catch {
            // noop
          }
        }
      } else {
        try {
          instance.clear();
        } catch {
          // noop
        }
      }
    });
  }

  function limparAssinatura() {
    const instance = sigCanvas.current;

    if (!instance) return;

    instance.clear();
    strokesRef.current = null;
    setMsgA11y("Assinatura limpa.");
  }

  function desfazer() {
    const instance = sigCanvas.current;

    if (!instance) return;

    try {
      const data = instance.toData();

      if (!data?.length) return;

      data.pop();
      instance.fromData(data);
      strokesRef.current = data;
      setMsgA11y("Último traço desfeito.");
    } catch {
      // noop
    }
  }

  async function salvarAssinatura() {
    const instance = sigCanvas.current;

    if (!instance || instance.isEmpty()) {
      toast.warning("Faça a assinatura antes de salvar.");
      setMsgA11y("Faça a assinatura antes de salvar.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMsgA11y("Salvando assinatura...");

    try {
      const canvas = instance.getCanvas();

if (!canvas) {
  throw new Error("Área de assinatura indisponível.");
}

const dataUrl = canvas.toDataURL("image/png");

      if (!assinaturaValida(dataUrl)) {
        throw new Error(
          "Assinatura inválida ou muito grande. Limpe e tente novamente."
        );
      }

      await apiAssinaturaSalvar({
        assinatura: dataUrl,
      });

      setAssinaturaSalva(dataUrl);
      setEditando(false);
      strokesRef.current = null;

      try {
        instance.clear();
      } catch {
        // noop
      }

      toast.success("Assinatura salva com sucesso.");
      setMsgA11y("Assinatura salva com sucesso.");
      onSaved?.(dataUrl);
    } catch (error) {
      console.error("[ModalAssinatura] erro ao salvar assinatura", {
        message: error?.message,
        status: error?.status,
      });

      const message = getErrorMessage(
        error,
        "Erro ao salvar assinatura."
      );

      setErro(message);
      setMsgA11y(message);
      toast.error(message);

      window.setTimeout(() => saveRef.current?.focus?.(), 0);
    } finally {
      setSalvando(false);
    }
  }

  if (!isOpen) return null;

 return createPortal(
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
    role="presentation"
  >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-hidden="true"
        onClick={fechar}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={erro ? `${descId} ${errorId}` : descId}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-100"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-slate-900 px-5 py-5 text-white sm:px-6">
          <div
            className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl"
            aria-hidden="true"
          />

          <button
            ref={closeRef}
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="absolute right-3 top-3 rounded-2xl p-2 text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Fechar assinatura digital"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="relative pr-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Assinatura digital
            </div>

            <h2 id={titleId} className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Minha assinatura
            </h2>

            <p id={descId} className="mt-1 text-sm leading-relaxed text-white/90">
              {descricaoModal}
            </p>
          </div>
        </header>

        <div id={liveId} className="sr-only" aria-live="polite">
          {msgA11y}
        </div>

        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-6">
          {carregando ? (
            <div className="grid min-h-[220px] place-items-center text-sm font-semibold">
              <div className="inline-flex items-center gap-2">
                <SpinnerLocal />
                Carregando assinatura...
              </div>
            </div>
          ) : (
            <>
              {erro ? (
                <div
                  id={errorId}
                  className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200"
                  role="alert"
                >
                  <div className="flex gap-2">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <p>{erro}</p>
                  </div>
                </div>
              ) : null}

              {assinaturaSalva && !editando ? (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
                      aria-hidden="true"
                    />
                    Assinatura atual
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                    <img
                      src={assinaturaSalva}
                      alt="Assinatura digital cadastrada"
                      className="block max-h-44 w-full object-contain"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-200">
                    Esta assinatura poderá ser usada em documentos e termos da
                    plataforma, como o termo de reserva de sala.
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <BotaoModal
                      ref={editRef}
                      onClick={iniciarEdicao}
                      leftIcon={<PenLine className="h-4 w-4" aria-hidden="true" />}
                    >
                      Alterar assinatura
                    </BotaoModal>

                    <BotaoModal
                      variant="secondary"
                      onClick={fechar}
                      leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
                    >
                      Fechar
                    </BotaoModal>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300">
                      Assine no centro. Você pode desfazer o último traço ou
                      limpar para começar novamente.
                    </div>

                    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10">
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="#111827"
                        minWidth={0.9}
                        maxWidth={2.4}
                        throttle={16}
                        onEnd={() => {
                          try {
                            strokesRef.current =
                              sigCanvas.current?.toData?.() || null;
                          } catch {
                            strokesRef.current = null;
                          }
                        }}
                        canvasProps={{
                          className:
                            "w-full rounded-2xl bg-white focus:outline-none touch-manipulation select-none",
                          "aria-label": "Área para assinar digitalmente",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <BotaoModal
                        variant="neutral"
                        onClick={desfazer}
                        disabled={salvando}
                        leftIcon={
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        }
                      >
                        Desfazer
                      </BotaoModal>

                      <BotaoModal
                        variant="neutral"
                        onClick={limparAssinatura}
                        disabled={salvando}
                        leftIcon={<Eraser className="h-4 w-4" aria-hidden="true" />}
                      >
                        Limpar
                      </BotaoModal>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <BotaoModal
                        variant="secondary"
                        onClick={fechar}
                        disabled={salvando}
                        leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
                      >
                        Cancelar
                      </BotaoModal>

                      <BotaoModal
                        ref={saveRef}
                        onClick={salvarAssinatura}
                        loading={salvando}
                        disabled={salvando}
                        leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                      >
                        {salvando ? "Salvando..." : "Salvar assinatura"}
                      </BotaoModal>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>,
      document.body
  );
}