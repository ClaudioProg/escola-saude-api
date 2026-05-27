// ✅ src/components/ui/AppToast.jsx — v2.0
// Plataforma Escola da Saúde
//
// Toast global oficial da plataforma.
//
// Revisão premium:
// - componente genérico de UI;
// - feedback claro ao usuário;
// - erros nunca devem ser genéricos sem orientação;
// - helpers padronizados para sucesso, informação, aviso e erro;
// - helper oficial para erro de API;
// - helper oficial para bloqueios de regra de negócio;
// - dedupe por chave;
// - toast de loading/processamento;
// - atualização de toast existente;
// - promise helper;
// - task helper para fluxo async completo;
// - extração segura de mensagens vindas da API;
// - acessibilidade;
// - mobile-first;
// - reduced motion;
// - limite anti-spam;
// - safe-area mobile;
// - contrato único de toast da plataforma;
// - pronto para uso global em App.jsx.

import { useEffect, useMemo, useState } from "react";
import { toast, ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const TOAST_CONTAINER_ID = "global-toasts";

const DEFAULT_OPTIONS = {
  containerId: TOAST_CONTAINER_ID,
};

const DEFAULT_AUTO_CLOSE = {
  default: 5200,
  success: 5200,
  info: 5800,
  warning: 7200,
  error: 9000,
};

const activeToastByKey = new Map();

function isObject(value) {
  return value !== null && typeof value === "object";
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (!isObject(acc)) return undefined;
    return acc[key];
  }, obj);
}

function primeiraStringValida(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extrairMensagemErro(error) {
  if (typeof error === "string") {
    return error.trim();
  }

  const mensagemDireta = primeiraStringValida(
    getNestedValue(error, "data.message"),
    getNestedValue(error, "data.mensagem"),
    getNestedValue(error, "data.erro"),
    getNestedValue(error, "data.error"),
    getNestedValue(error, "response.data.message"),
    getNestedValue(error, "response.data.mensagem"),
    getNestedValue(error, "response.data.erro"),
    getNestedValue(error, "response.data.error"),
    getNestedValue(error, "message")
  );

  if (mensagemDireta) {
    return mensagemDireta;
  }

  return "";
}

function extrairStatusErro(error) {
  const status = Number(
    getNestedValue(error, "status") ??
      getNestedValue(error, "response.status") ??
      getNestedValue(error, "data.status")
  );

  return Number.isFinite(status) ? status : null;
}

function mensagemPorStatus(status) {
  const mensagens = {
    400: "A solicitação não pôde ser processada. Revise os dados informados e tente novamente.",
    401: "Sua sessão expirou ou você não está autenticado. Faça login novamente.",
    403: "Você não tem permissão para executar esta ação.",
    404: "O registro solicitado não foi encontrado. Ele pode ter sido removido ou atualizado por outro usuário.",
    409: "A ação foi bloqueada porque há conflito com registros já existentes.",
    422: "Alguns dados enviados não passaram na validação. Revise as informações destacadas.",
    429: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    500: "O sistema encontrou uma falha interna. Tente novamente e, se persistir, acione o suporte.",
    502: "O servidor está temporariamente indisponível. Tente novamente em instantes.",
    503: "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    504: "O servidor demorou demais para responder. Tente novamente em instantes.",
  };

  return mensagens[status] || "";
}

function normalizarMensagem(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const texto = value.filter(Boolean).join(" ").trim();
    return texto || fallback;
  }

  return fallback;
}

function montarMensagemComDetalhe(titulo, detalhe, acao) {
  const partes = [titulo, detalhe, acao]
    .filter((parte) => typeof parte === "string" && parte.trim())
    .map((parte) => parte.trim());

  return partes.join(" ");
}

function getActiveToastIdByKey(key) {
  if (!key) return null;

  const id = activeToastByKey.get(key);

  if (id && toast.isActive(id)) {
    return id;
  }

  activeToastByKey.delete(key);
  return null;
}

function rememberToastKey(key, id) {
  if (!key || id == null) return;
  activeToastByKey.set(key, id);
}

function forgetToastKey(key, id) {
  if (!key) return;

  const current = activeToastByKey.get(key);

  if (current == null) return;

  if (id == null || current === id) {
    activeToastByKey.delete(key);
  }
}

function getAutoCloseByType(type) {
  if (type === "success") return DEFAULT_AUTO_CLOSE.success;
  if (type === "info") return DEFAULT_AUTO_CLOSE.info;
  if (type === "warning" || type === "warn") return DEFAULT_AUTO_CLOSE.warning;
  if (type === "error") return DEFAULT_AUTO_CLOSE.error;
  return DEFAULT_AUTO_CLOSE.default;
}

function notifyWithDedupe(type, message, options = {}) {
  const {
    dedupeKey,
    dedupeMode = "ignore",
    autoClose,
    onClose,
    ...toastOptions
  } = options;

  const texto = normalizarMensagem(message, "Notificação da plataforma.");
  const existingId = getActiveToastIdByKey(dedupeKey);

  if (existingId != null) {
    if (dedupeMode === "update") {
      toast.update(existingId, {
        render: texto,
        type,
        isLoading: false,
        autoClose: autoClose ?? getAutoCloseByType(type),
        closeOnClick: toastOptions.closeOnClick ?? false,
        draggable: toastOptions.draggable ?? true,
        hideProgressBar: toastOptions.hideProgressBar ?? false,
        ...toastOptions,
      });
    }

    return existingId;
  }

  const notifyFn = type === "warn" ? toast.warn : toast[type] || toast;

  const id = notifyFn(texto, {
    ...DEFAULT_OPTIONS,
    autoClose: autoClose ?? getAutoCloseByType(type),
    onClose: (...args) => {
      forgetToastKey(dedupeKey, id);
      onClose?.(...args);
    },
    ...toastOptions,
  });

  rememberToastKey(dedupeKey, id);

  return id;
}

export default function AppToast() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const handleChange = () => {
      setReducedMotion(Boolean(mediaQuery?.matches));
    };

    handleChange();

    mediaQuery?.addEventListener?.("change", handleChange);

    return () => {
      mediaQuery?.removeEventListener?.("change", handleChange);
    };
  }, []);

  const Transition = useMemo(
    () => (reducedMotion ? undefined : Slide),
    [reducedMotion]
  );

  return (
    <ToastContainer
      containerId={TOAST_CONTAINER_ID}
      position="top-center"
      autoClose={DEFAULT_AUTO_CLOSE.default}
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      pauseOnHover
      draggable
      draggablePercent={20}
      pauseOnFocusLoss={false}
      role="alert"
      aria-live="polite"
      theme="colored"
      limit={4}
      transition={Transition}
      rtl={false}
      style={{
        maxWidth: "92vw",
        width: 460,
        paddingTop: "env(safe-area-inset-top)",
      }}
      containerClassName={() => "z-50 pointer-events-none !top-3 sm:!top-4"}
      toastClassName={(context) => {
        const base = [
          "pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70",
          "min-h-[56px]",
        ].join(" ");

        const type = context?.type ?? "default";

        const classes = {
          success: "bg-verde-900 text-white dark:bg-verde-900/90",
          info: "bg-azulPetroleo text-white dark:bg-azulPetroleo/90",
          warning: "bg-dourado text-black dark:bg-dourado/90 dark:text-black",
          error: "bg-red-700 text-white dark:bg-red-700/95",
          default: "bg-slate-900 text-white dark:bg-slate-800",
        };

        return `${base} ${classes[type] || classes.default}`;
      }}
      bodyClassName={() => "flex-1 leading-snug"}
      progressClassName={() => "h-1 rounded-b-xl bg-white/70"}
      closeButton={({ closeToast }) => (
        <button
          type="button"
          onClick={closeToast}
          className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg leading-none transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70"
          aria-label="Fechar notificação"
          title="Fechar"
        >
          <span aria-hidden="true">×</span>
          <span className="sr-only">Fechar notificação</span>
        </button>
      )}
      icon={({ type }) => {
        const glyphs = {
          success: "✓",
          info: "i",
          warning: "!",
          error: "×",
          default: "•",
        };

        return (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black"
          >
            {glyphs[type || "default"]}
          </span>
        );
      }}
    />
  );
}

/* =============================================================================
 * Helpers oficiais de notificação simples
 * ============================================================================= */

export function notify(message, options = {}) {
  const texto = normalizarMensagem(message, "Operação realizada.");
  return toast(texto, { ...DEFAULT_OPTIONS, ...options });
}

export function notifySuccess(message, options = {}) {
  const texto = normalizarMensagem(message, "Operação concluída com sucesso.");
  return toast.success(texto, { ...DEFAULT_OPTIONS, ...options });
}

export function notifyInfo(message, options = {}) {
  const texto = normalizarMensagem(message, "Informação atualizada.");
  return toast.info(texto, { ...DEFAULT_OPTIONS, ...options });
}

export function notifyWarn(message, options = {}) {
  const texto = normalizarMensagem(
    message,
    "Atenção: revise as informações antes de continuar."
  );

  return toast.warn(texto, {
    ...DEFAULT_OPTIONS,
    autoClose: DEFAULT_AUTO_CLOSE.warning,
    ...options,
  });
}

export function notifyWarning(message, options = {}) {
  return notifyWarn(message, options);
}

export function notifyError(message, options = {}) {
  const texto = normalizarMensagem(
    message,
    "Não foi possível concluir a ação. Tente novamente e, se o problema persistir, acione o suporte."
  );

  return toast.error(texto, {
    ...DEFAULT_OPTIONS,
    autoClose: DEFAULT_AUTO_CLOSE.error,
    ...options,
  });
}

/* =============================================================================
 * Helpers oficiais com dedupe
 * ============================================================================= */

export function notifySuccessOnce(message, options = {}) {
  return notifyWithDedupe("success", message, options);
}

export function notifyInfoOnce(message, options = {}) {
  return notifyWithDedupe("info", message, options);
}

export function notifyWarnOnce(message, options = {}) {
  return notifyWithDedupe("warn", message, {
    autoClose: DEFAULT_AUTO_CLOSE.warning,
    ...options,
  });
}

export function notifyWarningOnce(message, options = {}) {
  return notifyWarnOnce(message, options);
}

export function notifyErrorOnce(message, options = {}) {
  return notifyWithDedupe("error", message, {
    autoClose: DEFAULT_AUTO_CLOSE.error,
    ...options,
  });
}

/* =============================================================================
 * Helpers oficiais de erro e regra de negócio
 * ============================================================================= */

/**
 * Helper oficial para erros de API.
 *
 * Use quando capturar erro em catch:
 *
 * catch (error) {
 *   notifyApiError(error, {
 *     titulo: "Não foi possível salvar o evento.",
 *     acao: "Revise os dados e tente novamente.",
 *   });
 * }
 */
export function notifyApiError(
  error,
  {
    titulo = "Não foi possível concluir a ação.",
    detalhe,
    acao = "Tente novamente e, se o problema persistir, acione o suporte.",
    options = {},
  } = {}
) {
  const status = extrairStatusErro(error);
  const mensagemApi = extrairMensagemErro(error);
  const mensagemStatus = mensagemPorStatus(status);

  const detalheFinal = detalhe || mensagemApi || mensagemStatus;

  const mensagem = montarMensagemComDetalhe(titulo, detalheFinal, acao);

  return toast.error(mensagem, {
    ...DEFAULT_OPTIONS,
    autoClose: DEFAULT_AUTO_CLOSE.error,
    ...options,
  });
}

/**
 * Helper para bloqueios esperados de regra de negócio.
 *
 * Exemplo:
 * notifyBlockedAction({
 *   titulo: "Não é possível excluir esta turma.",
 *   motivo: "Já existem presenças vinculadas.",
 *   acao: "Mantenha a turma para preservar o histórico."
 * });
 */
export function notifyBlockedAction({
  titulo = "Ação bloqueada pelo sistema.",
  motivo = "Esta ação não pode ser executada nas condições atuais.",
  acao = "Verifique as informações e tente novamente.",
  options = {},
} = {}) {
  return toast.warn(montarMensagemComDetalhe(titulo, motivo, acao), {
    ...DEFAULT_OPTIONS,
    autoClose: DEFAULT_AUTO_CLOSE.warning,
    ...options,
  });
}

/**
 * Helper para salvamento com contexto.
 */
export function notifySaved(entityName = "registro", options = {}) {
  return notifySuccess(`${entityName} salvo com sucesso.`, options);
}

/**
 * Helper para exclusão com contexto.
 */
export function notifyDeleted(entityName = "registro", options = {}) {
  return notifySuccess(`${entityName} removido com sucesso.`, options);
}

/* =============================================================================
 * Helpers oficiais de loading, update e dismiss
 * ============================================================================= */

/**
 * Toast oficial de carregamento/processamento.
 *
 * Exemplo:
 * const id = notifyLoading("Salvando evento...", { dedupeKey: "salvar-evento" });
 */
export function notifyLoading(message = "Processando...", options = {}) {
  const {
    dedupeKey,
    dedupeMode = "update",
    onClose,
    ...toastOptions
  } = options;

  const texto = normalizarMensagem(message, "Processando...");
  const existingId = getActiveToastIdByKey(dedupeKey);

  if (existingId != null) {
    if (dedupeMode === "update") {
      toast.update(existingId, {
        render: texto,
        isLoading: true,
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        hideProgressBar: true,
        ...toastOptions,
      });
    }

    return existingId;
  }

  const id = toast.loading(texto, {
    ...DEFAULT_OPTIONS,
    autoClose: false,
    closeOnClick: false,
    draggable: false,
    hideProgressBar: true,
    onClose: (...args) => {
      forgetToastKey(dedupeKey, id);
      onClose?.(...args);
    },
    ...toastOptions,
  });

  rememberToastKey(dedupeKey, id);

  return id;
}

/**
 * Atualiza um toast existente.
 */
export function notifyUpdate(toastId, message, options = {}) {
  if (toastId == null) return null;

  const texto = normalizarMensagem(message, "Notificação atualizada.");

  toast.update(toastId, {
    render: texto,
    isLoading: false,
    autoClose: options.autoClose ?? DEFAULT_AUTO_CLOSE.default,
    closeOnClick: options.closeOnClick ?? false,
    draggable: options.draggable ?? true,
    hideProgressBar: options.hideProgressBar ?? false,
    ...options,
  });

  return toastId;
}

/**
 * Finaliza um toast de loading com sucesso.
 */
export function notifyLoadingSuccess(
  toastId,
  message = "Operação concluída com sucesso.",
  options = {}
) {
  return notifyUpdate(toastId, message, {
    type: "success",
    autoClose: DEFAULT_AUTO_CLOSE.success,
    ...options,
  });
}

/**
 * Finaliza um toast de loading com erro.
 */
export function notifyLoadingError(
  toastId,
  message = "Não foi possível concluir a operação. Tente novamente e, se o problema persistir, acione o suporte.",
  options = {}
) {
  return notifyUpdate(toastId, message, {
    type: "error",
    autoClose: DEFAULT_AUTO_CLOSE.error,
    ...options,
  });
}

/**
 * Fecha um toast específico ou todos.
 */
export function notifyDismiss(toastId) {
  if (toastId == null) {
    toast.dismiss();
    return;
  }

  toast.dismiss(toastId);
}

/* =============================================================================
 * Helpers oficiais de promise e task async
 * ============================================================================= */

/**
 * Promise oficial com mensagens claras.
 *
 * Exemplo:
 * await notifyPromise(apiPost(...), {
 *   pending: "Salvando evento...",
 *   success: "Evento salvo com sucesso.",
 *   error: "Não foi possível salvar o evento. Revise os dados e tente novamente.",
 * });
 */
export function notifyPromise(promise, messages = {}, options = {}) {
  return toast.promise(
    promise,
    {
      pending: messages.pending || "Processando solicitação...",
      success: messages.success || "Operação concluída com sucesso.",
      error:
        messages.error ||
        "Não foi possível concluir a operação. Tente novamente e, se o problema persistir, acione o suporte.",
    },
    {
      ...DEFAULT_OPTIONS,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      hideProgressBar: false,
      ...options,
    }
  );
}

/**
 * Executa uma função async com toast oficial de loading, sucesso e erro.
 *
 * Exemplo:
 * await notifyTask(
 *   () => salvarEvento(payload),
 *   {
 *     pending: "Salvando evento...",
 *     success: "Evento salvo com sucesso.",
 *     error: (error) =>
 *       `Não foi possível salvar o evento. ${
 *         extrairMensagemErro(error) || "Revise os dados e tente novamente."
 *       }`,
 *   },
 *   { dedupeKey: "salvar-evento" }
 * );
 */
export async function notifyTask(task, messages = {}, options = {}) {
  const toastId = notifyLoading(messages.pending || "Processando...", {
    dedupeKey: options.dedupeKey,
    dedupeMode: "update",
    ...options,
  });

  try {
    const result = await task();

    const successMessage =
      typeof messages.success === "function"
        ? messages.success(result)
        : messages.success || "Operação concluída com sucesso.";

    notifyLoadingSuccess(toastId, successMessage);

    return result;
  } catch (error) {
    const errorMessage =
      typeof messages.error === "function"
        ? messages.error(error)
        : messages.error ||
          montarMensagemComDetalhe(
            "Não foi possível concluir a operação.",
            extrairMensagemErro(error) || mensagemPorStatus(extrairStatusErro(error)),
            "Tente novamente e, se o problema persistir, acione o suporte."
          );

    notifyLoadingError(toastId, errorMessage);

    throw error;
  }
}

export {
  TOAST_CONTAINER_ID,
  extrairMensagemErro,
  extrairStatusErro,
  mensagemPorStatus,
  montarMensagemComDetalhe,
};