// ✅ src/components/ui/ModalConfirmacao.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Modal genérico oficial de confirmação.
//
// Revisão premium:
// - componente genérico real de UI;
// - usa o Modal.jsx v2.0 como motor único;
// - contrato oficial limpo;
// - sem aliases PT/EN paralelos;
// - confirmação assíncrona com estado de processamento;
// - erro de confirmação exibido de forma clara ao usuário;
// - Enter confirma apenas fora de campos editáveis;
// - foco inicial controlado;
// - variantes visuais para ações sensíveis;
// - mobile-first;
// - dark mode;
// - acessibilidade refinada;
// - visual premium consistente com a plataforma.
//
// Contrato oficial:
// - open
// - onClose
// - onConfirm
// - titulo
// - mensagem
// - textoConfirmar
// - textoCancelar
// - variant
//
// Sem aliases:
// - sem isOpen;
// - sem description;
// - sem confirmarTexto;
// - sem cancelarTexto.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";

import Modal from "./Modal";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEditableElement(element) {
  if (!element) return false;

  const tagName = String(element.tagName || "").toLowerCase();

  if (tagName === "textarea") return true;

  if (tagName === "input") {
    const type = String(element.getAttribute("type") || "text").toLowerCase();

    return !["button", "submit", "checkbox", "radio", "file"].includes(type);
  }

  return Boolean(element.isContentEditable);
}

function normalizarMensagemErro(error) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const candidates = [
    error?.data?.message,
    error?.response?.data?.message,
    error?.message,
  ];

  const found = candidates.find(
    (item) => typeof item === "string" && item.trim()
  );

  return found?.trim() || "";
}

function renderMensagem(content) {
  if (typeof content === "string") {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {content}
      </div>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {content}
    </div>
  );
}

const VARIANTES = {
  danger: {
    tituloPadrao: "Confirmar ação sensível",
    subtitulo: "Revise antes de confirmar. Esta ação pode afetar registros importantes.",
    hint: "Ação sensível",
    icon: XCircle,
    header: "from-rose-950 via-rose-800 to-orange-700",
    iconBox: "bg-white/15 text-white ring-1 ring-white/20",
    chip:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
    confirmButton:
      "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-500",
    errorBox:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
  },
  warning: {
    tituloPadrao: "Confirmar ação",
    subtitulo: "Esta ação requer atenção antes de continuar.",
    hint: "Requer atenção",
    icon: AlertTriangle,
    header: "from-amber-900 via-orange-800 to-yellow-700",
    iconBox: "bg-white/15 text-white ring-1 ring-white/20",
    chip:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    confirmButton:
      "bg-amber-700 text-white hover:bg-amber-800 focus-visible:ring-amber-500",
    errorBox:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  },
  primary: {
    tituloPadrao: "Confirmar ação",
    subtitulo: "Confirme para continuar com esta operação.",
    hint: "Confirmação necessária",
    icon: CheckCircle2,
    header: "from-sky-950 via-sky-800 to-blue-700",
    iconBox: "bg-white/15 text-white ring-1 ring-white/20",
    chip:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
    confirmButton:
      "bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500",
    errorBox:
      "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
  },
  success: {
    tituloPadrao: "Confirmar conclusão",
    subtitulo: "Confirme para registrar esta ação como concluída.",
    hint: "Tudo certo",
    icon: CheckCircle2,
    header: "from-emerald-950 via-emerald-800 to-teal-700",
    iconBox: "bg-white/15 text-white ring-1 ring-white/20",
    chip:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    confirmButton:
      "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-500",
    errorBox:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  },
  neutral: {
    tituloPadrao: "Confirmar ação",
    subtitulo: "Revise as informações antes de continuar.",
    hint: "Confirmação",
    icon: Info,
    header: "from-slate-950 via-slate-800 to-zinc-700",
    iconBox: "bg-white/15 text-white ring-1 ring-white/20",
    chip:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
    confirmButton:
      "bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-500 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white",
    errorBox:
      "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
  },
};

export default function ModalConfirmacao({
  open,
  onClose,
  onConfirm,
  titulo,
  mensagem = "Tem certeza que deseja continuar?",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  variant = "danger",
  closeOnBackdrop = true,
  confirmOnEnter = true,
  loading = false,
  zIndex = 1300,
  erroTitulo = "Não foi possível concluir a ação.",
  erroAcao = "Tente novamente e, se o problema persistir, acione o suporte.",
  onError,
}) {
  const uid = useId();

  const titleId = `modal-confirmacao-title-${uid}`;
  const descId = `modal-confirmacao-desc-${uid}`;
  const errorId = `modal-confirmacao-error-${uid}`;

  const contentRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  const [confirmandoInterno, setConfirmandoInterno] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState("");

  const config = VARIANTES[variant] || VARIANTES.danger;
  const Icon = config.icon;

  const confirmando = Boolean(loading || confirmandoInterno);
  const confirmarHabilitado = typeof onConfirm === "function";
  const cancelarHabilitado = typeof onClose === "function";
  const tituloFinal = titulo || config.tituloPadrao;

  const describedBy = useMemo(
    () => [descId, erroConfirmacao ? errorId : null].filter(Boolean).join(" "),
    [descId, errorId, erroConfirmacao]
  );

  const fechar = useCallback(() => {
    if (confirmando) return;

    onClose?.();
  }, [confirmando, onClose]);

  const confirmar = useCallback(async () => {
    if (confirmando || !confirmarHabilitado) return;

    setErroConfirmacao("");
    setConfirmandoInterno(true);

    try {
      const result = await Promise.resolve(onConfirm());

      if (result !== false) {
        onClose?.();
      }
    } catch (error) {
      const detalhe = normalizarMensagemErro(error);

      const mensagemErro = detalhe
        ? `${erroTitulo} ${detalhe} ${erroAcao}`
        : `${erroTitulo} ${erroAcao}`;

      setErroConfirmacao(mensagemErro);
      onError?.(error);
    } finally {
      setConfirmandoInterno(false);
    }
  }, [
    confirmando,
    confirmarHabilitado,
    erroAcao,
    erroTitulo,
    onClose,
    onConfirm,
    onError,
  ]);

  useEffect(() => {
    if (!open) {
      setErroConfirmacao("");
      setConfirmandoInterno(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !confirmOnEnter) return undefined;

    function handleKeyDown(event) {
      if (event.key !== "Enter") return;
      if (confirmando || !confirmarHabilitado) return;

      const root = contentRef.current;
      const active = document.activeElement;
      const focusInside = Boolean(root && active && root.contains(active));

      if (!focusInside) return;
      if (isEditableElement(active)) return;

      event.preventDefault();
      event.stopPropagation();

      confirmar();
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [confirmOnEnter, confirmando, confirmar, confirmarHabilitado, open]);

  useEffect(() => {
    if (!open) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (confirmarHabilitado) {
        confirmButtonRef.current?.focus?.();
      } else {
        cancelButtonRef.current?.focus?.();
      }
    }, 40);

    return () => window.clearTimeout(timeoutId);
  }, [confirmarHabilitado, open]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={cancelarHabilitado ? fechar : undefined}
      labelledBy={titleId}
      describedBy={describedBy}
      ariaLabel="Confirmação"
      closeOnBackdrop={closeOnBackdrop && !confirmando}
      closeOnEscape={!confirmando}
      preventCloseWhenBusy={confirmando}
      initialFocusRef={confirmarHabilitado ? confirmButtonRef : cancelButtonRef}
      className="overflow-hidden p-0"
      zIndex={zIndex}
      showCloseButton={false}
      size="sm"
      padding={false}
      align="center"
    >
      <section ref={contentRef} className="flex min-h-full flex-col">
        <header
          className={classNames(
            "relative overflow-hidden bg-gradient-to-br px-5 py-5 text-white",
            config.header
          )}
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-start gap-3">
            <span
              className={classNames(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                config.iconBox
              )}
              aria-hidden="true"
            >
              <Icon className="h-6 w-6" />
            </span>

            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                {tituloFinal}
              </h2>

              <p id={descId} className="mt-1 text-sm font-medium text-white/88">
                {config.subtitulo}
              </p>

              <div className="mt-3">
                <span
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black",
                    config.chip
                  )}
                >
                  {config.hint}
                  {confirmOnEnter && confirmarHabilitado && (
                    <span className="opacity-75">• Enter confirma</span>
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={fechar}
              disabled={!cancelarHabilitado || confirmando}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Fechar confirmação"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 px-5 py-5">
          {renderMensagem(mensagem)}

          <div aria-live="polite" className="sr-only">
            {confirmando ? "Processando confirmação." : ""}
          </div>

          {erroConfirmacao && (
            <div
              id={errorId}
              role="alert"
              className={classNames(
                "mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold leading-relaxed",
                config.errorBox
              )}
            >
              <div className="flex items-start gap-2">
                <ShieldAlert
                  className="mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
                <span>{erroConfirmacao}</span>
              </div>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              ref={cancelButtonRef}
              onClick={fechar}
              disabled={!cancelarHabilitado || confirmando}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
            >
              {textoCancelar}
            </button>

            <button
              type="button"
              ref={confirmButtonRef}
              onClick={confirmar}
              disabled={!confirmarHabilitado || confirmando}
              aria-busy={confirmando || undefined}
              className={classNames(
                "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                "disabled:cursor-not-allowed disabled:opacity-60",
                config.confirmButton,
                "sm:w-auto"
              )}
            >
              {confirmando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}

              {confirmando ? "Processando..." : textoConfirmar}
            </button>
          </div>

          {confirmOnEnter && confirmarHabilitado && (
            <p className="mt-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-right">
              Dica: pressione Enter para confirmar quando não estiver digitando em um campo.
            </p>
          )}
        </footer>
      </section>
    </Modal>
  );
}

ModalConfirmacao.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  titulo: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  mensagem: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  textoConfirmar: PropTypes.string,
  textoCancelar: PropTypes.string,
  closeOnBackdrop: PropTypes.bool,
  variant: PropTypes.oneOf(["danger", "primary", "warning", "neutral", "success"]),
  confirmOnEnter: PropTypes.bool,
  zIndex: PropTypes.number,
  loading: PropTypes.bool,
  erroTitulo: PropTypes.string,
  erroAcao: PropTypes.string,
  onError: PropTypes.func,
};