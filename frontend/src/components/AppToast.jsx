// 📁 src/components/AppToast.jsx
import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Componente global de toasts (monte apenas 1x, ex.: em App.jsx).
 * - Paleta alinhada ao projeto (verde-lousa, azul-petróleo, dourado, vermelho).
 * - Dark-mode automático + foco visível.
 * - A11y: role="alert", aria-live "polite", contraste e tamanho de toque.
 * - Safe-area (iOS notch) e limite anti-spam.
 */
export default function AppToast() {
  return (
    <ToastContainer
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
      transition={Slide}
      rtl={false}
      // 🔝 Respeita notch/safe-area em mobile
      style={{
        maxWidth: "92vw",
        width: 420,
        paddingTop: "env(safe-area-inset-top)",
      }}
      // Camada alta e clique atravessando fora do toast
      containerClassName={() =>
        "z-50 pointer-events-none !top-3 sm:!top-4"
      }
      toastClassName={(context) => {
        const base =
          "pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium shadow-md " +
          "flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 " +
          "focus:ring-white/70";
        // Mapeia tipo → cores do projeto (fallback para 'default')
        const type = context?.type ?? "default";
        const map = {
          success:
            "bg-verde-900 text-white dark:bg-verde-900/90",
          info:
            "bg-azulPetroleo text-white dark:bg-azulPetroleo/90",
          warning:
            "bg-dourado text-black dark:bg-dourado/90 dark:text-black",
          error:
            "bg-red-600 text-white dark:bg-red-600/90",
          default:
            "bg-gray-900 text-white dark:bg-gray-800",
        };
        return `${base} ${map[type] || map.default}`;
      }}
      bodyClassName={() => "flex-1 leading-snug"}
      progressClassName={() => "h-1 rounded-b-xl bg-white/70"}
      // Botão de fechar acessível (ícone + sr-only)
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
      // Ícone padrão com bom contraste (pode ser substituído por toast(..., { icon }))
      icon={({ type }) => {
        const glyphs = {
          success: "✔",
          info: "ℹ",
          warning: "⚠",
          error: "✖",
          default: "•",
        };
        return (
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20"
          >
            {glyphs[type || "default"]}
          </span>
        );
      }}
    />
  );
}

/* 💡 Dica: Se quiser controlar as cores direto via CSS/Tailwind (em vez do map acima),
   você pode adicionar no seu index.css:

   .Toastify__toast--success { @apply bg-verde-900 text-white; }
   .dark .Toastify__toast--success { @apply bg-verde-900/90; }
   .Toastify__toast--info    { @apply bg-azulPetroleo text-white; }
   .Toastify__toast--warning { @apply bg-dourado text-black; }
   .Toastify__toast--error   { @apply bg-red-600 text-white; }
*/
