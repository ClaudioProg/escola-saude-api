// 📁 src/components/toastNotificacao.js
import { toast } from "react-toastify";
import { CheckCircle, XCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

/**
 * Toast helper centralizado (React-Toastify)
 * - Tema auto (light/dark), com override
 * - Ícones consistentes (Lucide)
 * - Evita duplicados (opcional via `dedupeKey`)
 * - Retorna `toastId` para controle (dismiss/update)
 * - Atalhos: sucesso, erro, alerta, info, carregando, promessa
 */

/* ===========================
   Opções & utilitários
   =========================== */

/** Posição padrão global — altere se precisar */
export const TOAST_POS = "top-right";

/** Resolve tema: "light" | "dark" | "auto" */
function resolveTheme(theme = "auto") {
  if (theme !== "auto") return theme;
  try {
    // tenta classe 'dark' (Tailwind)
    if (document.documentElement.classList.contains("dark")) return "dark";
    // fallback via prefers-color-scheme
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

/** Opções padrão */
const BASE_DEFAULTS = {
  position: TOAST_POS,
  autoClose: 5000,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
  theme: "auto",
};

/**
 * Evita duplicados: mantém um mapa de dedupeKey -> toastId ativo.
 * Se ainda ativo, retorna o mesmo id e não cria um novo.
 */
const activeByKey = new Map();
function maybeDedup(dedupeKey) {
  if (!dedupeKey) return null;
  const existing = activeByKey.get(dedupeKey);
  if (existing && toast.isActive(existing)) return existing;
  return null;
}
function rememberKey(dedupeKey, id) {
  if (dedupeKey && id) activeByKey.set(dedupeKey, id);
}

/** Cria um ícone consistente (com cor utilitária) */
function iconEl(El, cls) {
  return <El size={20} className={cls} />;
}

/* ===========================
   Núcleo
   =========================== */

/**
 * Exibe um toast genérico.
 * @param {'success'|'error'|'warn'|'info'} type
 * @param {string|React.ReactNode} mensagem
 * @param {object} opts
 *   - icon: ReactNode (sobrepõe o padrão)
 *   - theme: 'light'|'dark'|'auto' (default: 'auto')
 *   - position, autoClose, etc. (qualquer opção do toastify)
 *   - dedupeKey: string (evita duplicados enquanto ativo)
 * @returns {string|number} toastId
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
    ...rest
  } = opts;

  const dedupId = maybeDedup(dedupeKey);
  if (dedupId != null) return dedupId;

  const resolvedTheme = resolveTheme(theme);
  const id = toast[type](mensagem, {
    icon,
    position,
    autoClose,
    closeOnClick,
    pauseOnHover,
    draggable,
    hideProgressBar,
    theme: resolvedTheme,
    ...rest,
  });

  rememberKey(dedupeKey, id);
  return id;
}

/* ===========================
   Atalhos
   =========================== */

export function toastSucesso(
  mensagem = "Ação concluída com sucesso!",
  opts = {}
) {
  const icon = opts.icon ?? iconEl(CheckCircle, "text-green-600");
  return toastCustom("success", mensagem, { ...opts, icon });
}

export function toastErro(
  mensagem = "Ocorreu um erro ao processar.",
  opts = {}
) {
  const icon = opts.icon ?? iconEl(XCircle, "text-red-600");
  return toastCustom("error", mensagem, { ...opts, icon });
}

export function toastAlerta(
  mensagem = "Atenção! Verifique os dados.",
  opts = {}
) {
  const icon = opts.icon ?? iconEl(AlertTriangle, "text-yellow-600");
  return toastCustom("warn", mensagem, { ...opts, icon });
}

export function toastInfo(
  mensagem = "Informação.",
  opts = {}
) {
  const icon = opts.icon ?? iconEl(Info, "text-blue-600");
  return toastCustom("info", mensagem, { ...opts, icon });
}

/**
 * Toast de carregamento persistente.
 * - Não fecha automaticamente (autoClose: false)
 * - Retorna id para depois atualizar/fechar
 */
export function toastCarregando(
  mensagem = "Processando…",
  opts = {}
) {
  const icon = opts.icon ?? iconEl(Loader2, "animate-spin");
  return toast.loading(mensagem, {
    closeOnClick: false,
    autoClose: false,
    draggable: false,
    hideProgressBar: true,
    position: opts.position ?? BASE_DEFAULTS.position,
    theme: resolveTheme(opts.theme ?? BASE_DEFAULTS.theme),
    icon,
    ...opts,
  });
}

/** Atualiza um toast existente (ex.: depois do loading) */
export function toastAtualizar(toastId, mensagem, opts = {}) {
  toast.update(toastId, {
    render: mensagem,
    isLoading: false,
    autoClose: opts.autoClose ?? BASE_DEFAULTS.autoClose,
    type: opts.type, // 'success'|'error'|'info'|'warning'
    icon: opts.icon,
    theme: resolveTheme(opts.theme ?? BASE_DEFAULTS.theme),
    ...opts,
  });
}

/** Fecha um toast específico (ou todos, se omitido) */
export function toastFechar(toastId) {
  if (typeof toastId === "undefined" || toastId === null) {
    toast.dismiss();
  } else {
    toast.dismiss(toastId);
  }
}

/**
 * Toast para promessas (syntactic sugar ao toast.promise)
 * @param {Promise<any>} promessa
 * @param {{pending?: string|ReactNode, success?: string|ReactNode|((val)=>ReactNode), error?: string|ReactNode|((err)=>ReactNode)}} mensagens
 * @param {object} opts Opções adicionais do toast
 * @returns {Promise<any>} reencaminha a promise original
 */
export function toastPromessa(promessa, mensagens = {}, opts = {}) {
  const theme = resolveTheme(opts.theme ?? BASE_DEFAULTS.theme);
  return toast.promise(
    promessa,
    {
      pending: {
        render: mensagens.pending ?? "Enviando…",
        icon: opts.pendingIcon ?? iconEl(Loader2, "animate-spin"),
      },
      success: {
        render: mensagens.success ?? "Concluído!",
        icon: opts.successIcon ?? iconEl(CheckCircle, "text-green-600"),
      },
      error: {
        render: mensagens.error ?? "Falha na operação.",
        icon: opts.errorIcon ?? iconEl(XCircle, "text-red-600"),
      },
    },
    {
      theme,
      position: opts.position ?? BASE_DEFAULTS.position,
      closeOnClick: true,
      hideProgressBar: false,
      ...opts,
    }
  );
}

/* ===========================
   Exemplos de uso:
   ---------------------------
   toastSucesso("Salvo!");
   const id = toastCarregando("Gerando...");
   // depois:
   toastAtualizar(id, "Concluído", { type: "success", autoClose: 3000, icon: iconEl(CheckCircle, "text-green-600") });

   toastPromessa(api.save(data), {
     pending: "Salvando...",
     success: "Registro salvo!",
     error: (e) => `Erro: ${e?.message || "desconhecido"}`
   });
   =========================== */
