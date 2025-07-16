// src/components/AppToast.jsx
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Componente global de toasts da aplicação.
 * Deve ser usado uma única vez em App.jsx ou Main.jsx.
 */
export default function AppToast() {
  return (
    <ToastContainer
      position="top-center"
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      pauseOnHover
      draggable
      pauseOnFocusLoss={false}
      theme="colored"
    />
  );
}
