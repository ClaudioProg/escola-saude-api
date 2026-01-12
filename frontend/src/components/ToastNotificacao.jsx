// 📁 src/components/toastNotificacao.js
import React from "react";
import { toast } from "react-toastify";
import { CheckCircle, XCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

/**
 * Toast helper centralizado (React-Toastify) — PREMIUM
 * - Tema auto (tailwind 'dark' + prefers-color-scheme)
 * - Ícones consistentes (Lucide) sem JSX (arquivo .js safe)
 * - Dedupe por chave com opção de "atualizar em vez de ignorar"
 * - Retorna toastId para controle (dismiss/update)
 * - Atalhos: ok/erro/alerta/info/loading/promise
 */

/* ===========================
   Config
=========================== */

export const TOAST_POS = "top-right";

const BASE_DEFAULTS = {
  position: TOAST_POS,
  autoClose: 5000,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
  theme: "auto", // 'auto' | 'light' | 'dark'
};

function resolveTheme(theme = "auto") {
  if (theme !== "auto") return theme;
  try {
    if (document.documentElement.classList.contains("dark")) return "dark";
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

/* ===========================
   Dedupe
=========================== */

/**
 * Map dedupeKey -> toastId
 * - removemos quando o toast fecha (onClose) pra evitar leak.
 */
const activeByKey = new Map();

function getActiveIdByKey(key) {
  if (!key) return null;
  const id = activeByKey.get(key);
  if (id && toast.isActive(id)) return id;
  return null;
}

function rememberKey(key, id) {
  if (!key || id == null) return;
  activeByKey.set(key, id);
}

function forgetKey(key, id) {
  if (!key) return;
  const current = activeByKey.get(key);
  if (current == null) return;
  if (id == null || current === id) activeByKey.delete(key);
}

/* ===========================
   Icon factory (no JSX)
=========================== */

function iconEl(Icon, className) {
  return React.createElement(Icon, { size: 20, className });
}

// Classes de ícone que funcionam bem em light/dark
const ICON_CLS = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  warn: "text-amber-600 dark:text-amber-300",
  info: "text-sky-600 dark:text-sky-400",
  spin: "animate-spin text-zinc-700 dark:text-zinc-200",
};

/* ===========================
   Core
=========================== */

/**
 * toastCustom(type, mensagem, opts)
 * opts extras:
 * - dedupeKey?: string
 * - dedupeMode?: 'ignore' | 'update'  (default 'ignore')
 */
export function toastCustom(type, mensagem, opts = {}) {
  const {
    icon,
    theme = BASE_DEFAULTS.theme,
    position = BASE_DEFAULTS.position,
    autoClose = BASE_DEFAULTS.autoClose,
    closeOnClick = BASE_DEFAULTS.closeOnClick,
    pauseOnHover = BASE_DEFAULTS.pauseOnHover,
    draggable = BASE_DEFAULTS.draggable,
    hideProgressBar = BASE_DEFAULTS.hideProgressBar,

    dedupeKey,
    dedupeMode = "ignore", // 'ignore' | 'update'
    ...rest
  } = opts;

  const resolvedTheme = resolveTheme(theme);
  const existing = getActiveIdByKey(dedupeKey);

  // 🔁 Se já existe e for "update", atualiza; se "ignore", só retorna
  if (existing != null) {
    if (dedupeMode === "update") {
      toast.update(existing, {
        render: mensagem,
        type,
        icon,
        isLoading: false,
        autoClose,
        closeOnClick,
        pauseOnHover,
        draggable,
        hideProgressBar,
        theme: resolvedTheme,
        ...rest,
      });
    }
    return existing;
  }

  const id = toast[type](mensagem, {
    icon,
    position,
    autoClose,
    closeOnClick,
    pauseOnHover,
    draggable,
    hideProgressBar,
    theme: resolvedTheme,
    onClose: () => forgetKey(dedupeKey, id),
    ...rest,
  });

  rememberKey(dedupeKey, id);
  return id;
}

/* ===========================
   Shortcuts (padrão)
=========================== */

export function toastSucesso(mensagem = "Ação concluída com sucesso!", opts = {}) {
  const icon = opts.icon ?? iconEl(CheckCircle, ICON_CLS.success);
  return toastCustom("success", mensagem, { ...opts, icon });
}

export function toastErro(mensagem = "Ocorreu um erro ao processar.", opts = {}) {
  const icon = opts.icon ?? iconEl(XCircle, ICON_CLS.error);
  return toastCustom("error", mensagem, { ...opts, icon });
}

export function toastAlerta(mensagem = "Atenção! Verifique os dados.", opts = {}) {
  const icon = opts.icon ?? iconEl(AlertTriangle, ICON_CLS.warn);
  return toastCustom("warn", mensagem, { ...opts, icon });
}

export function toastInfo(mensagem = "Informação.", opts = {}) {
  const icon = opts.icon ?? iconEl(Info, ICON_CLS.info);
  return toastCustom("info", mensagem, { ...opts, icon });
}

/* ===========================
   Loading + update helpers
=========================== */

/**
 * Toast de carregamento persistente.
 * - Não fecha automaticamente
 * - Suporta dedupeKey (com update)
 */
export function toastCarregando(mensagem = "Processando…", opts = {}) {
  const {
    theme = BASE_DEFAULTS.theme,
    position = BASE_DEFAULTS.position,
    dedupeKey,
    dedupeMode = "update",
    icon,
    ...rest
  } = opts;

  const resolvedTheme = resolveTheme(theme);
  const existing = getActiveIdByKey(dedupeKey);

  if (existing != null) {
    if (dedupeMode === "update") {
      toast.update(existing, {
        render: mensagem,
        isLoading: true,
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: true,
        theme: resolvedTheme,
        icon: icon ?? iconEl(Loader2, ICON_CLS.spin),
        ...rest,
      });
    }
    return existing;
  }

  const id = toast.loading(mensagem, {
    autoClose: false,
    closeOnClick: false,
    draggable: false,
    hideProgressBar: true,
    position,
    theme: resolvedTheme,
    icon: icon ?? iconEl(Loader2, ICON_CLS.spin),
    onClose: () => forgetKey(dedupeKey, id),
    ...rest,
  });

  rememberKey(dedupeKey, id);
  return id;
}

/**
 * Atualiza um toast existente (ex.: depois do loading)
 * opts:
 * - type: 'success'|'error'|'info'|'warning'
 * - autoClose
 * - icon
 * - theme
 */
export function toastAtualizar(toastId, mensagem, opts = {}) {
  if (toastId == null) return;

  toast.update(toastId, {
    render: mensagem,
    isLoading: false,
    autoClose: opts.autoClose ?? BASE_DEFAULTS.autoClose,
    closeOnClick: opts.closeOnClick ?? true,
    draggable: opts.draggable ?? true,
    hideProgressBar: opts.hideProgressBar ?? false,
    type: opts.type,
    icon: opts.icon,
    theme: resolveTheme(opts.theme ?? BASE_DEFAULTS.theme),
    ...opts,
  });
}

/** Helpers semânticos p/ finalizar loading */
export function toastConcluir(toastId, mensagem = "Concluído!", opts = {}) {
  toastAtualizar(toastId, mensagem, {
    type: "success",
    icon: opts.icon ?? iconEl(CheckCircle, ICON_CLS.success),
    ...opts,
  });
}

export function toastFalhar(toastId, mensagem = "Falha na operação.", opts = {}) {
  toastAtualizar(toastId, mensagem, {
    type: "error",
    icon: opts.icon ?? iconEl(XCircle, ICON_CLS.error),
    ...opts,
  });
}

/** Fecha um toast específico (ou todos, se omitido) */
export function toastFechar(toastId) {
  if (toastId == null) toast.dismiss();
  else toast.dismiss(toastId);
}

/* ===========================
   Promise helper (premium)
=========================== */

/**
 * toastPromessa(promessa, mensagens, opts)
 * mensagens:
 * - pending: string|ReactNode
 * - success: string|ReactNode|((val)=>ReactNode)
 * - error: string|ReactNode|((err)=>ReactNode)
 */
export function toastPromessa(promessa, mensagens = {}, opts = {}) {
  const theme = resolveTheme(opts.theme ?? BASE_DEFAULTS.theme);

  return toast.promise(
    promessa,
    {
      pending: {
        render: mensagens.pending ?? "Enviando…",
        icon: opts.pendingIcon ?? iconEl(Loader2, ICON_CLS.spin),
      },
      success: {
        render: mensagens.success ?? "Concluído!",
        icon: opts.successIcon ?? iconEl(CheckCircle, ICON_CLS.success),
      },
      error: {
        render: mensagens.error ?? "Falha na operação.",
        icon: opts.errorIcon ?? iconEl(XCircle, ICON_CLS.error),
      },
    },
    {
      theme,
      position: opts.position ?? BASE_DEFAULTS.position,
      closeOnClick: opts.closeOnClick ?? true,
      pauseOnHover: opts.pauseOnHover ?? true,
      draggable: opts.draggable ?? true,
      hideProgressBar: opts.hideProgressBar ?? false,
      ...opts,
    }
  );
}

/* ===========================
   Extras úteis (opcional)
=========================== */

/**
 * Executa uma função async e dá feedback automático:
 * - mostra loading
 * - conclui/falha
 * - dedupe por key (ex.: "salvar-perfil")
 */
export async function toastTask(task, messages = {}, opts = {}) {
  const id = toastCarregando(messages.pending ?? "Processando…", {
    dedupeKey: opts.dedupeKey,
    dedupeMode: "update",
    ...opts,
  });

  try {
    const res = await task();
    toastConcluir(id, typeof messages.success === "function" ? messages.success(res) : messages.success ?? "Concluído!");
    return res;
  } catch (e) {
    const msg =
      typeof messages.error === "function"
        ? messages.error(e)
        : messages.error ?? (e?.data?.message || e?.message || "Falha na operação.");
    toastFalhar(id, msg);
    throw e;
  }
}
