// ✅ src/main.jsx
import React from "react";
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
   Flags/Helpers
────────────────────────────────────────────────────────────── */
const IS_DEV = !!import.meta.env.DEV;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function maskClientId(id) {
  if (!id) return "(vazio)";
  const p = String(id);
  return `${p.slice(0, 10)}… (${p.length} chars)`;
}

/* ──────────────────────────────────────────────────────────────
   ✅ TEMA: boot ANTES do React montar (fonte única: escolaTheme)
   - chave oficial: ESCOLA_THEME_KEY ("escola_theme")
   - valores: "light" | "dark" | "system"
   - migra do legado ("theme") se existir
────────────────────────────────────────────────────────────── */
function readSavedEscolaThemeWithMigration() {
  try {
    // ✅ Se já existe o novo, respeita
    const saved = localStorage.getItem(ESCOLA_THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;

    // 🔁 MIGRA: chave antiga "theme" (light/dark)
    const legacy = localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(ESCOLA_THEME_KEY, legacy);
      // opcional: remove a antiga para não confundir
      // localStorage.removeItem("theme");
      return legacy;
    }
  } catch {
    /* silent */
  }
  return "system";
}

// aplica imediatamente (antes do React)
const bootTheme = readSavedEscolaThemeWithMigration();
applyThemeToHtml(bootTheme);

// se estiver em "system", reage ao SO (fora do React)
let stopWatch = null;
if (bootTheme === "system") {
  stopWatch = watchSystemTheme(() => applyThemeToHtml("system"));
}

/**
 * 🔎 Tripwire DEV (read-only):
 * - detecta QUEM mexe na classe "dark" no <html>
 * - NÃO aplica tema
 */
function installThemeTripwireDev() {
  if (!IS_DEV) return;
  const root = document.documentElement;

  const add = DOMTokenList.prototype.add;
  const remove = DOMTokenList.prototype.remove;

  DOMTokenList.prototype.add = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      console.groupCollapsed(
        "%c[TEMA] classList.add('dark') detectado",
        "color:#b91c1c;font-weight:700"
      );
      console.trace();
      console.groupEnd();
    }
    return add.apply(this, tokens);
  };

  DOMTokenList.prototype.remove = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      console.groupCollapsed(
        "%c[TEMA] classList.remove('dark') detectado",
        "color:#b91c1c;font-weight:700"
      );
      console.trace();
      console.groupEnd();
    }
    return remove.apply(this, tokens);
  };

  new MutationObserver(() => {
    const isDark = root.classList.contains("dark");
    console.log(
      "[TEMA] <html> =",
      isDark ? "dark" : "light",
      "| escola_theme =",
      localStorage.getItem(ESCOLA_THEME_KEY)
    );
  }).observe(root, { attributes: true, attributeFilter: ["class"] });

  console.log("[TEMA] Tripwire DEV instalado (read-only).");
}
installThemeTripwireDev();

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
  console.groupCollapsed(
    "%c[GSI:init]",
    "color:#14532d;font-weight:700",
    "Diagnóstico do Google Sign-In"
  );
  console.log("• window.location.origin:", window.location.origin);
  console.log("• Ambiente:", IS_DEV ? "dev" : "prod");
  console.log("• VITE_GOOGLE_CLIENT_ID:", maskClientId(clientId));
  console.groupEnd();

  try {
    window.__GID = clientId;
  } catch {}

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
  console.warn(
    "⚠️  VITE_GOOGLE_CLIENT_ID ausente! Verifique seu .env.local e reinicie o Vite."
  );
}

/* ──────────────────────────────────────────────────────────────
   ErrorBoundary simples com fallback acessível
────────────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, info: null };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    if (IS_DEV) console.error("[App ErrorBoundary]", error, info);
    this.setState({ info });
  }
  handleReload = () => {
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-white text-gray-900 dark:bg-zinc-950 dark:text-white">
          <div
            role="alert"
            aria-live="assertive"
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 shadow p-6 text-center"
          >
            <h1 className="text-xl font-extrabold mb-2">
              Ocorreu um erro inesperado
            </h1>
            <p className="text-sm text-gray-600 dark:text-zinc-300 mb-4">
              Tente recarregar a página. Se o problema persistir, avise o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-extrabold bg-green-900 text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-900/60"
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
  />
);

const AppTree = clientId ? (
  <GoogleOAuthProvider
    clientId={clientId}
    onScriptLoadSuccess={() => {
      if (IS_DEV) {
        console.info(
          "%c[GSI] onScriptLoadSuccess",
          "color:#16a34a",
          "SDK do Google carregada com sucesso."
        );
      }
    }}
    onScriptLoadError={() => {
      console.error(
        "[GSI] onScriptLoadError → Falha ao carregar a SDK do Google. Verifique CORS, bloqueadores e rede."
      );
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
   PWA em produção (aviso de atualização)
────────────────────────────────────────────────────────────── */
(function setupPWA() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    try {
      toast.info("Atualização aplicada — recarregando…", { autoClose: 1200 });
    } catch {}
    setTimeout(() => window.location.reload(), 1200);
  });
})();

// (Opcional) cleanup de watchers fora do React (não é crítico)
window.addEventListener?.("beforeunload", () => {
  try { stopWatch?.(); } catch {}
});
