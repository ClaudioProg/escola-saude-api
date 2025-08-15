// 📁 src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Modal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "./App.css";

// ▶️ Flags/Helpers
const IS_DEV = !!import.meta.env.DEV;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function maskClientId(id) {
  if (!id) return "(vazio)";
  const p = String(id);
  return `${p.slice(0, 10)}… (${p.length} chars)`;
}

// Necessário para acessibilidade do react-modal
Modal.setAppElement("#root");

// 🔎 Logs estratégicos (apenas em dev)
if (IS_DEV) {
  console.groupCollapsed(
    `%c[GSI:init]`,
    "color:#0ea5e9;font-weight:700",
    "Diagnóstico do Google Sign-In"
  );
  console.log("• window.location.origin:", window.location.origin);
  console.log("• Ambiente:", IS_DEV ? "dev" : "prod");
  console.log("• VITE_GOOGLE_CLIENT_ID:", maskClientId(clientId));
  if (!clientId) {
    console.warn(
      "⚠️  VITE_GOOGLE_CLIENT_ID não definido. O botão de Login com Google não funcionará (403 em accounts.google.com)."
    );
  }
  console.groupEnd();

  // Escuta erros globais que venham do domínio do Google
  window.addEventListener("error", (ev) => {
    const src = ev?.filename || "";
    if (/accounts\.google\.com|gstatic\.com/i.test(src)) {
      console.error("[GSI:error] script", src, ev?.message || ev?.error);
    }
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const msg = ev?.reason?.message || String(ev?.reason || "");
    if (/accounts\.google\.com|gstatic\.com/i.test(msg)) {
      console.error("[GSI:unhandledrejection]", msg);
    }
  });
}

// ✅ Render
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {clientId ? (
      <GoogleOAuthProvider
        clientId={clientId}
        // Dispara quando a lib do Google termina de carregar
        onScriptLoadSuccess={() => {
          if (IS_DEV) {
            console.info(
              "%c[GSI] onScriptLoadSuccess",
              "color:#16a34a",
              "SDK do Google carregado com sucesso."
            );
          }
        }}
        // Dispara se houver problema para baixar a lib do Google
        onScriptLoadError={() => {
          console.error(
            "[GSI] onScriptLoadError → Falha ao carregar a SDK do Google. Verifique CORS, bloqueadores e rede."
          );
        }}
      >
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
