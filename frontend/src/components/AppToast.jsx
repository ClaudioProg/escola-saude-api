// 📁 src/components/AppToast.jsx
import { useEffect, useMemo, useState } from "react";
import { ToastContainer, Slide } from "react-toastify";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Componente global de toasts (monte apenas 1x, ex.: em App.jsx).
 * - Paleta alinhada ao projeto (verde-lousa, azul-petróleo, dourado, vermelho).
 * - Dark-mode automático + foco visível.
 * - A11y: role="alert", aria-live "polite", contraste e tamanho de toque.
 * - Safe-area (iOS notch) e limite anti-spam.
 * - Respeita prefers-reduced-motion.
 */

export default function AppToast() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(Boolean(mq?.matches));
    onChange();
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  // Sem animação para usuários que preferem menos movimento
  const Transition = useMemo(() => (reduced ? undefined : Slide), [reduced]);

  return (
    <ToastContainer
      containerId="global-toasts"
      position="top-center"
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
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
      // 🔝 Respeita notch/safe-area em mobile
      style={{
        maxWidth: "92vw",
        width: 420,
        paddingTop: "env(safe-area-inset-top)",
      }}
      // Camada alta e clique atravessando fora do toast
      containerClassName={() => "z-50 pointer-events-none !top-3 sm:!top-4"}
      toastClassName={(context) => {
        const base =
          "pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium shadow-md " +
          "flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 " +
          "focus:ring-white/70";
        const type = context?.type ?? "default";
        const map = {
          success: "bg-verde-900 text-white dark:bg-verde-900/90",
          info: "bg-azulPetroleo text-white dark:bg-azulPetroleo/90",
          warning: "bg-dourado text-black dark:bg-dourado/90 dark:text-black",
          error: "bg-red-600 text-white dark:bg-red-600/90",
          default: "bg-gray-900 text-white dark:bg-gray-800",
        };
        return `${base} ${map[type] || map.default}`;
      }}
      bodyClassName={() => "flex-1 leading-snug"}
      progressClassName={() => "h-1 rounded-b-xl bg-white/70"}
      closeButton={({ closeToast }) => (
        <button
          onClick={closeToast}
          className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70"
          aria-label="Fechar notificação"
          title="Fechar"
        >
          <span aria-hidden>×</span>
          <span className="sr-only">Fechar</span>
        </button>
      )}
      icon={({ type }) => {
        const glyphs = { success: "✔", info: "ℹ", warning: "⚠", error: "✖", default: "•" };
        return (
          <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20">
            {glyphs[type || "default"]}
          </span>
        );
      }}
    />
  );
}

/* ===================== Helpers de uso (opcional) ===================== */
// Padroniza chamadas ao toast mantendo o tema do projeto.
// Import: import AppToast, { notify, notifySuccess, notifyInfo, notifyWarn, notifyError } from "…/AppToast";
export const notify = (msg, opts = {}) => toast(msg, { containerId: "global-toasts", ...opts });
export const notifySuccess = (msg, opts = {}) => toast.success(msg, { containerId: "global-toasts", ...opts });
export const notifyInfo = (msg, opts = {}) => toast.info(msg, { containerId: "global-toasts", ...opts });
export const notifyWarn = (msg, opts = {}) => toast.warn(msg, { containerId: "global-toasts", ...opts });
export const notifyError = (msg, opts = {}) => toast.error(msg, { containerId: "global-toasts", ...opts });

/* 💡 Dica: Se quiser controlar por Tailwind, também dá para estilizar as classes padrão:

   .Toastify__toast--success { @apply bg-verde-900 text-white; }
   .dark .Toastify__toast--success { @apply bg-verde-900/90; }
   .Toastify__toast--info    { @apply bg-azulPetroleo text-white; }
   .Toastify__toast--warning { @apply bg-dourado text-black; }
   .Toastify__toast--error   { @apply bg-red-600 text-white; }
*/
