// ✅ src/main.jsx (premium)
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Modal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "./App.css";

import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  watchSystemTheme,
} from "./theme/escolaTheme";

/* ──────────────────────────────────────────────────────────────
   Flags / Helpers
────────────────────────────────────────────────────────────── */
const IS_DEV = !!import.meta.env.DEV;
const IS_PROD = !!import.meta.env.PROD;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function maskClientId(id) {
  if (!id) return "(vazio)";
  const p = String(id);
  return `${p.slice(0, 10)}… (${p.length} chars)`;
}

/* ──────────────────────────────────────────────────────────────
   ✅ TEMA — boot ANTES do React montar
   - Fonte única: escolaTheme (ESCOLA_THEME_KEY)
   - Migra “theme” legado → “escola_theme”
────────────────────────────────────────────────────────────── */
function readSavedEscolaThemeWithMigration() {
  try {
    const saved = localStorage.getItem(ESCOLA_THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;

    const legacy = localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(ESCOLA_THEME_KEY, legacy);
      // opcional: localStorage.removeItem("theme");
      return legacy;
    }
  } catch {
    /* noop */
  }
  return "system";
}

const bootTheme = readSavedEscolaThemeWithMigration();
applyThemeToHtml(bootTheme);

let stopWatch = null;
if (bootTheme === "system") {
  stopWatch = watchSystemTheme(() => applyThemeToHtml("system"));
}

/* ──────────────────────────────────────────────────────────────
   🔎 Tripwire DEV (read-only) — quem mexe em <html>.classList 'dark'
────────────────────────────────────────────────────────────── */
(function installThemeTripwireDev() {
  if (!IS_DEV) return;
  const root = document.documentElement;

  const add = DOMTokenList.prototype.add;
  const remove = DOMTokenList.prototype.remove;

  DOMTokenList.prototype.add = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      console.groupCollapsed("%c[TEMA] add('dark') detectado", "color:#b91c1c;font-weight:700");
      console.trace();
      console.groupEnd();
    }
    return add.apply(this, tokens);
  };

  DOMTokenList.prototype.remove = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      console.groupCollapsed("%c[TEMA] remove('dark') detectado", "color:#b91c1c;font-weight:700");
      console.trace();
      console.groupEnd();
    }
    return remove.apply(this, tokens);
  };

  new MutationObserver(() => {
    const isDark = root.classList.contains("dark");
    console.log(
      "[TEMA] <html> =", isDark ? "dark" : "light",
      "| escola_theme =", localStorage.getItem(ESCOLA_THEME_KEY)
    );
  }).observe(root, { attributes: true, attributeFilter: ["class"] });

  console.log("[TEMA] Tripwire DEV instalado (read-only).");
})();

/* ──────────────────────────────────────────────────────────────
   A11y: react-modal — app element
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
   DEV: logs estratégicos do Google Sign-In
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
   ErrorBoundary premium com ações (Recarregar / Copiar)
────────────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, info: null, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    if (IS_DEV) console.error("[App ErrorBoundary]", error, info);
    this.setState({ info });
    try {
      toast.error("Ocorreu um erro inesperado.");
    } catch {}
  }
  handleReload = () => window.location.reload();
  handleCopy = async () => {
    try {
      const payload = JSON.stringify(
        { error: String(this.state.error), info: this.state.info },
        null,
        2
      );
      await navigator.clipboard.writeText(payload);
      toast.success("Detalhes copiados!");
    } catch {
      toast.warn("Não foi possível copiar os detalhes.");
    }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-white text-gray-900 dark:bg-zinc-950 dark:text-white">
          <div role="alert" aria-live="assertive"
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 shadow p-6 text-center">
            <h1 className="text-xl font-extrabold mb-2">Ocorreu um erro inesperado</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-300 mb-5">
              Tente recarregar a página. Se persistir, envie os detalhes ao suporte.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-extrabold bg-green-900 text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-900/60"
              >
                Recarregar
              </button>
              <button
                onClick={this.handleCopy}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-extrabold bg-zinc-800 text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-900/60"
              >
                Copiar detalhes
              </button>
            </div>
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
   Toasts — botão de fechar acessível
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
const container = document.getElementById("root");
if (!container) throw new Error("#root não encontrado no DOM.");
const root = ReactDOM.createRoot(container);

const Toasts = (
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
    role="status"
  />
);

const AppTree = clientId ? (
  <GoogleOAuthProvider
    clientId={clientId}
    onScriptLoadSuccess={() => {
      if (IS_DEV) console.info("%c[GSI] SDK carregada.", "color:#16a34a");
    }}
    onScriptLoadError={() => {
      console.error("[GSI] Falha ao carregar a SDK do Google.");
      toast.warn("Falha ao carregar login Google. Você ainda pode usar login por e-mail/senha.");
    }}
  >
    <App />
    {Toasts}
  </GoogleOAuthProvider>
) : (
  <>
    <App />
    {Toasts}
  </>
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>{AppTree}</ErrorBoundary>
  </React.StrictMode>
);

/* ──────────────────────────────────────────────────────────────
   PWA (prod): informar atualização aplicada e recarregar
────────────────────────────────────────────────────────────── */
(function setupPWA() {
  if (!IS_PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    try { toast.info("Atualização aplicada — recarregando…", { autoClose: 1200 }); } catch {}
    setTimeout(() => window.location.reload(), 1200);
  });
})();

/* ──────────────────────────────────────────────────────────────
   Cleanup watchers fora do React
────────────────────────────────────────────────────────────── */
window.addEventListener?.("beforeunload", () => {
  try { stopWatch?.(); } catch {}
});
