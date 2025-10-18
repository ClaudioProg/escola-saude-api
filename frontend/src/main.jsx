// 📁 src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Modal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "./App.css";

/* ──────────────────────────────────────────────────────────────
   TEMA: util central + boot antes do React montar
   ────────────────────────────────────────────────────────────── */
const THEME_KEY = "theme"; // 'light' | 'dark'
const IS_DEV = !!import.meta.env.DEV;

function readSavedTheme() {
  try {
    // MIGRA chave antiga 'darkMode' (true/false)
    const legacy = localStorage.getItem("darkMode");
    if (legacy !== null) {
      const next = legacy === "true" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      localStorage.removeItem("darkMode");
    }
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  // Se nada salvo, usa o que já está no DOM (caso index tenha aplicado)
  const hasDark = document.documentElement.classList.contains("dark");
  return hasDark ? "dark" : "light";
}

function applyTheme(theme, { persist = true } = {}) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
}

function installThemeTripwireDev() {
  if (!IS_DEV) return;
  const root = document.documentElement;
  const add = DOMTokenList.prototype.add;
  const remove = DOMTokenList.prototype.remove;

  DOMTokenList.prototype.add = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      console.groupCollapsed("%c[TEMA] classList.add('dark') detectado", "color:#b91c1c;font-weight:700");
      console.trace();
      console.groupEnd();
    }
    return add.apply(this, tokens);
  };
  DOMTokenList.prototype.remove = function (...tokens) {
    return remove.apply(this, tokens);
  };

  new MutationObserver(() => {
    const isDark = root.classList.contains("dark");
    console.log("[TEMA] <html> =", isDark ? "dark" : "light");
  }).observe(root, { attributes: true, attributeFilter: ["class"] });

  console.log("[TEMA] Tripwire DEV instalado.");
}

// ✅ aplica imediatamente o tema salvo (antes do React)
applyTheme(readSavedTheme(), { persist: false });
// 🔎 em DEV, loga quem tentar forçar 'dark'
installThemeTripwireDev();

/* ──────────────────────────────────────────────────────────────
   Flags/Helpers
   ────────────────────────────────────────────────────────────── */
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function maskClientId(id) {
  if (!id) return "(vazio)";
  const p = String(id);
  return `${p.slice(0, 10)}… (${p.length} chars)`;
}

/* ──────────────────────────────────────────────────────────────
   A11y: react-modal
   ────────────────────────────────────────────────────────────── */
(function ensureModalAppElement() {
  try {
    const el = document.getElementById("root");
    if (el) {
      Modal.setAppElement(el);
    } else {
      requestAnimationFrame(() => {
        const later = document.getElementById("root");
        if (later) Modal.setAppElement(later);
      });
    }
  } catch (e) {
    if (IS_DEV) console.warn("[react-modal] setAppElement falhou:", e);
  }
})();

/* ──────────────────────────────────────────────────────────────
   Logs estratégicos (apenas em dev)
   ────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  console.groupCollapsed("%c[GSI:init]", "color:#14532d;font-weight:700", "Diagnóstico do Google Sign-In");
  console.log("• window.location.origin:", window.location.origin);
  console.log("• Ambiente:", IS_DEV ? "dev" : "prod");
  console.log("• VITE_GOOGLE_CLIENT_ID:", maskClientId(clientId));
  console.groupEnd();

  try { window.__GID = clientId; } catch {}

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

if (!clientId) {
  console.warn("⚠️  VITE_GOOGLE_CLIENT_ID ausente! Verifique seu .env.local e reinicie o Vite.");
}

/* ──────────────────────────────────────────────────────────────
   ErrorBoundary simples com fallback acessível
   ────────────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, info: null };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    if (IS_DEV) console.error("[App ErrorBoundary]", error, info);
    this.setState({ info });
  }
  handleReload = () => { window.location.reload(); };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
          <div role="alert" aria-live="assertive" className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-700 shadow p-6 text-center">
            <h1 className="text-xl font-bold mb-2">Ocorreu um erro inesperado</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Tente recarregar a página. Se o problema persistir, avise o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold bg-green-900 text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-900/60"
            >
              Recarregar
            </button>
            {IS_DEV && this.state.info ? (
              <pre className="text-left text-xs mt-4 overflow-auto max-h-48 opacity-80">
                {JSON.stringify(this.state.info, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ──────────────────────────────────────────────────────────────
   Botão de fechar dos toasts
   ────────────────────────────────────────────────────────────── */
function CloseBtn({ closeToast }) {
  return (
    <button
      type="button"
      onClick={closeToast}
      aria-label="Fechar notificação"
      className="inline-flex items-center justify-center h-6 w-6 rounded-full focus:outline-none focus:ring-2 focus:ring-green-900/60"
      title="Fechar"
    >
      ✕
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Render
   ────────────────────────────────────────────────────────────── */
const root = ReactDOM.createRoot(document.getElementById("root"));

const AppTree = clientId ? (
  <GoogleOAuthProvider
    clientId={clientId}
    onScriptLoadSuccess={() => {
      if (IS_DEV) {
        console.info("%c[GSI] onScriptLoadSuccess", "color:#16a34a", "SDK do Google carregada com sucesso.");
      }
    }}
    onScriptLoadError={() => {
      console.error("[GSI] onScriptLoadError → Falha ao carregar a SDK do Google. Verifique CORS, bloqueadores e rede.");
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
      closeButton={<CloseBtn />}
      toastClassName="rounded-xl shadow-lg ring-1 ring-black/10"
      bodyClassName="text-sm leading-relaxed"
    />
  </GoogleOAuthProvider>
) : (
  <>
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
      closeButton={<CloseBtn />}
      toastClassName="rounded-xl shadow-lg ring-1 ring-black/10"
      bodyClassName="text-sm leading-relaxed"
    />
  </>
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>{AppTree}</ErrorBoundary>
  </React.StrictMode>
);

/* ──────────────────────────────────────────────────────────────
   PWA em produção (aviso de atualização)
   ────────────────────────────────────────────────────────────── */
(function setupPWA() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    try { toast.info("Atualização aplicada — recarregando…", { autoClose: 1200 }); } catch {}
    setTimeout(() => window.location.reload(), 1200);
  });
})();
