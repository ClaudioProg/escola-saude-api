// ✅ src/components/ModalConfirmacao.jsx — PREMIUM (global + a11y + Enter-to-confirm + stack-safe)
// - ✅ Compat PT/EN: isOpen/open, titulo/title, mensagem/description, onConfirmar/onConfirm, onClose/onCancelar
// - ✅ Usa o Modal ÚNICO (stack-safe) — sem props antigas (level/maxWidth/isOpen/closeOnEsc)
// - ✅ Enter confirma (somente quando foco NÃO estiver em input/textarea/contenteditable)
// - ✅ Foco inicial no confirmar (quando habilitado) ou no cancelar
// - ✅ Suporta async confirm com estado "confirmando"
// - ✅ Variants premium: danger | warning | primary | neutral | success
// - ✅ Mobile-first + dark mode + acessibilidade refinada
// - ✅ Não usa PropTypes .isRequired: se faltar handler, botão fica desabilitado sem warning

import { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import { AlertTriangle, CheckCircle2, XCircle, Info as InfoIcon } from "lucide-react";

/* ───────────────── helpers internos ───────────────── */
function isEditableElement(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = String(el.getAttribute("type") || "text").toLowerCase();
    return !["button", "submit", "checkbox", "radio", "file"].includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

/* ───────────────── componente ───────────────── */
export default function ModalConfirmacao(rawProps) {
  // 🔁 Compat de nomes (PT/EN)
  const open = !!(rawProps.open ?? rawProps.isOpen);

  const onClose = rawProps.onClose ?? rawProps.onCancelar;
  const onConfirm = rawProps.onConfirm ?? rawProps.onConfirmar;

  const titulo = rawProps.titulo ?? rawProps.title ?? "Confirmar ação";
  const mensagem = rawProps.mensagem ?? rawProps.description ?? "Tem certeza que deseja continuar?";

  const confirmText = rawProps.textoBotaoConfirmar ?? rawProps.confirmText ?? "Confirmar";
  const cancelText = rawProps.textoBotaoCancelar ?? rawProps.cancelText ?? "Cancelar";

  const closeOnOverlay = rawProps.closeOnOverlay ?? true;
  const variant = rawProps.variant ?? "danger";
  const confirmOnEnter = rawProps.confirmOnEnter ?? true;

  // stacking (se quiser elevar por cima de outros modais)
  const zIndex = Number(rawProps.zIndex ?? 1300);

  const [confirmando, setConfirmando] = useState(false);

  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);

  // wrapper para checar foco dentro
  const contentRef = useRef(null);

  // IDs únicos por instância (ARIA)
  const uid = useId();
  const titleId = `modal-confirmacao-title-${uid}`;
  const descId = `modal-confirmacao-desc-${uid}`;

  const confirmarHabilitado = typeof onConfirm === "function";
  const cancelarHabilitado = typeof onClose === "function";

  const palette = useMemo(() => {
    // ✅ Paletas premium por variante
    switch (variant) {
      case "primary":
        return {
          header: "from-sky-900 via-sky-800 to-blue-700",
          btn: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-400",
          ring: "focus-visible:ring-sky-400",
          icon: CheckCircle2,
          chip:
            "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
          hint: "Confirmação necessária",
        };
      case "warning":
        return {
          header: "from-amber-900 via-orange-800 to-yellow-700",
          btn: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-400",
          ring: "focus-visible:ring-amber-400",
          icon: AlertTriangle,
          chip:
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
          hint: "Requer atenção",
        };
      case "neutral":
        return {
          header: "from-slate-900 via-slate-800 to-zinc-700",
          btn: "bg-slate-700 hover:bg-slate-800 focus-visible:ring-slate-400",
          ring: "focus-visible:ring-slate-400",
          icon: InfoIcon,
          chip:
            "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
          hint: "Confirmação",
        };
      case "success":
        return {
          header: "from-emerald-900 via-emerald-800 to-teal-700",
          btn: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400",
          ring: "focus-visible:ring-emerald-400",
          icon: CheckCircle2,
          chip:
            "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
          hint: "Tudo certo",
        };
      case "danger":
      default:
        return {
          header: "from-rose-900 via-red-800 to-orange-700",
          btn: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400",
          ring: "focus-visible:ring-rose-400",
          icon: XCircle,
          chip:
            "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
          hint: "Ação irreversível",
        };
    }
  }, [variant]);

  const Icon = palette.icon;

  const handleConfirm = useCallback(async () => {
    if (confirmando) return;
    if (!confirmarHabilitado) return;

    try {
      setConfirmando(true);
      const result = await Promise.resolve(onConfirm());
      // se o confirm retornar explicitamente false, mantém aberto
      if (result !== false) onClose?.();
    } catch {
      // mantém aberto; quem chama pode exibir toast
    } finally {
      setConfirmando(false);
    }
  }, [confirmando, confirmarHabilitado, onConfirm, onClose]);

  // Enter confirma (somente quando foco estiver no modal e NÃO em campos editáveis)
  useEffect(() => {
    if (!open || !confirmOnEnter) return;

    const onKey = (e) => {
      if (e.key !== "Enter") return;
      if (confirmando) return;
      if (!confirmarHabilitado) return;

      const root = contentRef.current;
      const active = document.activeElement;
      const focusInside = !!(root && active && root.contains(active));
      if (!focusInside) return;
      if (isEditableElement(active)) return;

      e.preventDefault();
      e.stopPropagation();
      handleConfirm();
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, confirmOnEnter, confirmando, confirmarHabilitado, handleConfirm]);

  // foco inicial ao abrir: confirmar se habilitado; senão cancelar
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (confirmarHabilitado) confirmBtnRef.current?.focus?.();
      else cancelBtnRef.current?.focus?.();
    }, 30);
    return () => clearTimeout(t);
  }, [open, confirmarHabilitado]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={cancelarHabilitado ? onClose : undefined}
      labelledBy={titleId}
      describedBy={descId}
      ariaLabel={!rawProps.labelledBy ? "Confirmação" : undefined}
      closeOnBackdrop={closeOnOverlay && !confirmando}
      closeOnEscape={!confirmando}
      initialFocusRef={confirmarHabilitado ? confirmBtnRef : cancelBtnRef}
      className="p-0 overflow-hidden"
      // ✅ nosso Modal premium suporta zIndex
      zIndex={zIndex}
      // ✅ já estamos desenhando o nosso header com botão fechar; evita “X” duplicado
      showCloseButton={false}
      // ✅ aqui é um confirm → largura ideal menor e sem padding forçado do Modal
      size="sm"
      padding={false}
      align="center"
    >
      {/* wrapper para checar foco dentro */}
      <div ref={contentRef}>
        {/* Header hero */}
        <header
          className={cls("px-4 sm:px-5 py-4 text-white bg-gradient-to-br", palette.header)}
          role="group"
          aria-label="Confirmação"
        >
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white/15 border border-white/20">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {titulo}
              </h2>
              <p id={descId} className="text-white/90 text-sm mt-1">
                Revise antes de confirmar.
              </p>
            </div>

            {/* botão fechar (opcional) */}
            <button
              type="button"
              onClick={confirmando ? undefined : cancelarHabilitado ? onClose : undefined}
              disabled={!cancelarHabilitado || confirmando}
              className="ml-auto p-2 rounded-2xl hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
              aria-label="Fechar"
            >
              <span className="text-xl leading-none" aria-hidden="true">
                ×
              </span>
            </button>
          </div>

          {/* chip contextual */}
          <div className="mt-3">
            <span
              className={cls(
                "inline-flex items-center gap-2 text-xs font-extrabold px-2.5 py-1 rounded-full border",
                palette.chip
              )}
            >
              {palette.hint}
              {confirmOnEnter ? <span className="opacity-90">• Enter</span> : null}
            </span>
          </div>
        </header>

        {/* Corpo */}
        <section className="px-4 sm:px-5 py-4">
          <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {mensagem}
          </div>

          <div aria-live="polite" className="sr-only">
            {confirmando ? "Processando confirmação." : ""}
          </div>
        </section>

        {/* Rodapé sticky (mobile-first) */}
        <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              ref={cancelBtnRef}
              onClick={cancelarHabilitado && !confirmando ? onClose : undefined}
              disabled={!cancelarHabilitado || confirmando}
              className={cls(
                "w-full sm:w-auto px-4 py-2 rounded-2xl",
                "bg-slate-200 dark:bg-slate-800",
                "text-slate-900 dark:text-slate-100 font-extrabold",
                "hover:bg-slate-300 dark:hover:bg-slate-700 transition",
                "disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
              )}
            >
              {cancelText}
            </button>

            <button
              type="button"
              ref={confirmBtnRef}
              onClick={!confirmando && confirmarHabilitado ? handleConfirm : undefined}
              disabled={!confirmarHabilitado || confirmando}
              className={cls(
                "w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 rounded-2xl",
                "text-white font-extrabold transition disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                palette.btn
              )}
              aria-busy={confirmando ? "true" : "false"}
            >
              <Icon className={cls("w-5 h-5", confirmando ? "animate-pulse" : "")} aria-hidden="true" />
              {confirmando ? "Processando..." : confirmText}
            </button>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-right">
            {confirmOnEnter ? "Dica: pressione Enter para confirmar." : ""}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────── PropTypes (flexíveis) ─────────────────
   Sem .isRequired → sem warning mesmo se faltar handler.
   Botões ficam desabilitados quando não houver callback. */
ModalConfirmacao.propTypes = {
  // abertura
  isOpen: PropTypes.bool,
  open: PropTypes.bool,

  // callbacks
  onClose: PropTypes.func,
  onCancelar: PropTypes.func,
  onConfirm: PropTypes.func,
  onConfirmar: PropTypes.func,

  // textos
  titulo: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  mensagem: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),

  textoBotaoConfirmar: PropTypes.string,
  confirmText: PropTypes.string,
  textoBotaoCancelar: PropTypes.string,
  cancelText: PropTypes.string,

  // comportamento/estilo
  closeOnOverlay: PropTypes.bool,
  variant: PropTypes.oneOf(["danger", "primary", "warning", "neutral", "success"]),
  confirmOnEnter: PropTypes.bool,
  zIndex: PropTypes.number,
};
