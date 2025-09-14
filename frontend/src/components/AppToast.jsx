// 📁 src/components/AppToast.jsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Componente global de toasts.
 * Deve ser montado apenas uma vez (ex.: App.jsx).
 * - Integração com tema (verde-900, azul-petróleo, dourado, vermelho).
 * - Dark-mode automático.
 * - Ajustes de acessibilidade (role="alert", aria-live).
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
      pauseOnFocusLoss={false}
      role="alert"
      aria-live="polite"
      theme="colored"
      toastClassName={() =>
        // base para todos os toasts
        "rounded-2xl px-4 py-3 text-sm font-medium shadow-md flex items-center gap-3"
      }
      bodyClassName={() => "flex-1 leading-snug"}
      progressClassName={() => "h-1 rounded-b-xl"}
      style={{ maxWidth: "92vw", width: 420 }}
    />
  );
}

/* Sugestão (opcional):
   No index.css ou tailwind.css, você pode sobrepor as cores nativas da lib:

   .Toastify__toast--success { background-color: theme('colors.verde.900'); }
   .Toastify__toast--info    { background-color: theme('colors.azulPetroleo'); }
   .Toastify__toast--warning { background-color: theme('colors.dourado'); color: #000; }
   .Toastify__toast--error   { background-color: theme('colors.red.600'); }
   .dark .Toastify__toast--success { background-color: theme('colors.verde.900 / 0.9'); }
*/
