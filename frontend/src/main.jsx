// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Modal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "./App.css";

// ✅ Google OAuth Client ID vindo das envs do Vite/Vercel
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Necessário para acessibilidade do react-modal
Modal.setAppElement("#root");

// Aviso em dev/preview se a env não estiver configurada
if (!clientId) {
  console.warn(
    "VITE_GOOGLE_CLIENT_ID não definido. O botão de Login com Google não funcionará."
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId}>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="colored"
        />
      </GoogleOAuthProvider>
    ) : (
      <>
        {/* Renderiza o app mesmo sem o Provider, para não quebrar a UI */}
        <App />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="colored"
        />
      </>
    )}
  </React.StrictMode>
);
