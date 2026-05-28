// 📁 src/main.jsx — v2.0
// Plataforma Escola da Saúde
//
// Bootstrap oficial da aplicação.
//
// Responsabilidades:
// - aplicar tema antes do React;
// - configurar ReactModal;
// - configurar GoogleOAuthProvider;
// - configurar ToastContainer;
// - proteger a árvore com ErrorBoundary;
// - montar o App.
//
// Não usar:
// - chaves legadas de tema;
// - chaves alternativas de token;
// - PWA manual;
// - App.css;
// - redirects globais duplicando PrivateRoute.

import React from "react";
import ReactDOM from "react-dom/client";
import ReactModal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer, toast } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";
import "./index.css";

import App from "./App";

import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  getStoredTheme,
  watchSystemTheme,
} from "./theme/escolaTheme";

/* ─────────────────────────────────────────
   Flags / env
───────────────────────────────────────── */

const IS_DEV = Boolean(import.meta.env.DEV);
const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

/* ─────────────────────────────────────────
   Recuperação automática de chunk antigo
───────────────────────────────────────── */

const UPDATE_PAGE_URL = "/atualizar.html";

function redirectToUpdatePage(reason) {
  try {
    const url = new URL(UPDATE_PAGE_URL, window.location.origin);
    url.searchParams.set("motivo", reason || "chunk");
    url.searchParams.set("ts", String(Date.now()));

    window.location.replace(url.toString());
  } catch {
    window.location.replace(
      `${UPDATE_PAGE_URL}?motivo=${reason || "chunk"}&ts=${Date.now()}`
    );
  }
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  redirectToUpdatePage("chunk");
});

window.addEventListener(
  "error",
  (event) => {
    const message = String(event?.message || "");
    const filename = String(event?.filename || "");

    const isModuleLoadError =
      message.includes("Failed to load module script") ||
      message.includes("Importing a module script failed") ||
      message.includes("error loading dynamically imported module") ||
      filename.includes("/assets/");

    if (isModuleLoadError) {
      redirectToUpdatePage("module");
    }
  },
  true
);

window.addEventListener("unhandledrejection", (event) => {
  const message = String(event?.reason?.message || event?.reason || "");

  const isDynamicImportError =
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module");

  if (isDynamicImportError) {
    event.preventDefault();
    redirectToUpdatePage("dynamic-import");
  }
});

/* ─────────────────────────────────────────
   Logs DEV
───────────────────────────────────────── */

function logDev(...args) {
  if (IS_DEV) {
    console.log(...args);
  }
}

function warnDev(...args) {
  if (IS_DEV) {
    console.warn(...args);
  }
}

function maskValue(value) {
  const text = String(value || "");

  if (!text) {
    return "(vazio)";
  }

  if (text.length <= 12) {
    return "***";
  }

  return `${text.slice(0, 8)}…${text.slice(-4)} (${text.length} chars)`;
}

/* ─────────────────────────────────────────
   Tema — antes do React
───────────────────────────────────────── */

function bootTheme() {
  const savedTheme = getStoredTheme() || "system";

  applyThemeToHtml(savedTheme);

  if (savedTheme !== "system") {
    return () => {};
  }

  return watchSystemTheme(() => {
    applyThemeToHtml("system");
  });
}

const stopThemeWatcher = bootTheme();

/* ─────────────────────────────────────────
   Diagnóstico DEV
───────────────────────────────────────── */

let disposeThemeDiagnostics = null;
let disposeGoogleDiagnostics = null;

function installThemeDiagnosticsDev() {
  if (!IS_DEV || typeof document === "undefined") {
    return () => {};
  }

  const root = document.documentElement;

  const logTheme = () => {
    const isDark = root.classList.contains("dark");

    console.log("[TEMA]", {
      html: isDark ? "dark" : "light",
      dataTheme: root.getAttribute("data-theme"),
      storageKey: ESCOLA_THEME_KEY,
      stored: (() => {
        try {
          return localStorage.getItem(ESCOLA_THEME_KEY);
        } catch {
          return null;
        }
      })(),
    });
  };

  const observer = new MutationObserver(logTheme);

  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  logTheme();

  return () => {
    try {
      observer.disconnect();
    } catch {
      // noop
    }
  };
}

function installGoogleDiagnosticsDev() {
  if (!IS_DEV || typeof window === "undefined") {
    return () => {};
  }

  console.groupCollapsed(
    "%c[GSI:init]",
    "color:#14532d;font-weight:800",
    "Diagnóstico do Google Sign-In"
  );
console.log("origin:", window.location.origin);
console.log("clientId:", GOOGLE_CLIENT_ID);
console.groupEnd();

  const onError = (event) => {
    const source = event?.filename || "";

    if (/accounts\.google\.com|gstatic\.com/i.test(source)) {
      console.error("[GSI:error]", {
        source,
        message: event?.message,
      });
    }
  };

  const onUnhandledRejection = (event) => {
    const message = event?.reason?.message || String(event?.reason || "");

    if (/accounts\.google\.com|gstatic\.com/i.test(message)) {
      console.error("[GSI:unhandledrejection]", message);
    }
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}

disposeThemeDiagnostics = installThemeDiagnosticsDev();
disposeGoogleDiagnostics = installGoogleDiagnosticsDev();

if (!GOOGLE_CLIENT_ID) {
  warnDev("[GSI] VITE_GOOGLE_CLIENT_ID ausente.");
}

/* ─────────────────────────────────────────
   ReactModal
───────────────────────────────────────── */

function setupReactModal() {
  try {
    const root = document.getElementById("root");

    if (root) {
      ReactModal.setAppElement(root);
    }
  } catch (error) {
    warnDev("[react-modal] setAppElement falhou.", error);
  }
}

/* ─────────────────────────────────────────
   ErrorBoundary
───────────────────────────────────────── */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      info: null,
    };

    this.toastShown = false;
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    logDev("[ErrorBoundary]", {
      error,
      info,
    });

    this.setState({
      info,
    });

    if (!this.toastShown) {
      this.toastShown = true;

      try {
        toast.error("Ocorreu um erro inesperado.");
      } catch {
        // noop
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDetails = async () => {
    try {
      const payload = JSON.stringify(
        {
          error: String(this.state.error),
          info: this.state.info,
        },
        null,
        2
      );

      await navigator.clipboard.writeText(payload);

      toast.success("Detalhes copiados.");
    } catch {
      toast.warn("Não foi possível copiar os detalhes.");
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="grid min-h-screen place-items-center bg-[var(--app-bg)] p-6 text-[var(--app-fg)]">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-lg rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 text-center shadow-[var(--app-shadow-lg)]"
        >
          <h1 className="text-xl font-extrabold">
            Ocorreu um erro inesperado
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
            Tente recarregar a página. Se o erro persistir, copie os detalhes e
            envie ao suporte.
          </p>

          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={this.handleReload}
              className="app-btn"
            >
              Recarregar
            </button>

            <button
              type="button"
              onClick={this.handleCopyDetails}
              className="app-btn-ghost"
            >
              Copiar detalhes
            </button>
          </div>

          {IS_DEV && this.state.info ? (
            <pre className="mt-5 max-h-56 overflow-auto rounded-2xl bg-black/5 p-4 text-left text-xs opacity-80 dark:bg-white/5">
              {JSON.stringify(this.state.info, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}

/* ─────────────────────────────────────────
   Toasts
───────────────────────────────────────── */

function ToastCloseButton({ closeToast }) {
  return (
    <button
      type="button"
      onClick={closeToast}
      aria-label="Fechar notificação"
      title="Fechar"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-white/80"
    >
      ×
    </button>
  );
}

function AppToasts() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="colored"
      closeButton={<ToastCloseButton />}
      toastClassName="rounded-xl shadow-lg ring-1 ring-black/10"
      bodyClassName="text-sm leading-relaxed"
      role="status"
    />
  );
}

/* ─────────────────────────────────────────
   App tree
───────────────────────────────────────── */

function AppProviders() {
  const app = (
    <>
      <App />
      <AppToasts />
    </>
  );

  if (!GOOGLE_CLIENT_ID) {
    return app;
  }

  return (
    <GoogleOAuthProvider
      clientId={GOOGLE_CLIENT_ID}
      onScriptLoadSuccess={() => {
        logDev("[GSI] SDK carregada.");
      }}
      onScriptLoadError={() => {
        console.error("[GSI] Falha ao carregar SDK do Google.");

        try {
          toast.warn(
            "Falha ao carregar login Google. Você ainda pode usar login por e-mail e senha."
          );
        } catch {
          // noop
        }
      }}
    >
      {app}
    </GoogleOAuthProvider>
  );
}

/* ─────────────────────────────────────────
   Render
───────────────────────────────────────── */

function renderBootError(error) {
  const container = document.getElementById("root");

  if (!container) {
    return;
  }

  const message = String(error?.message || error || "Erro desconhecido")
    .replace(/[<>&]/g, (char) => {
      const map = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
      };

      return map[char] || char;
    });

  container.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif;background:#f8fafc;color:#111827;">
      <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08);">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 10px;">Falha ao iniciar a plataforma</h1>
        <p style="margin:0 0 16px;color:#4b5563;">Ocorreu um erro no carregamento inicial da aplicação.</p>
        <pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;background:#f3f4f6;padding:12px;border-radius:12px;">${message}</pre>
        <button onclick="window.location.reload()" style="margin-top:16px;border:0;background:#065f46;color:#fff;padding:12px 16px;border-radius:12px;font-weight:700;cursor:pointer;">
          Recarregar
        </button>
      </div>
    </div>
  `;
}

function startApp() {
  setupReactModal();

  const container = document.getElementById("root");

  if (!container) {
    throw new Error("#root não encontrado no DOM.");
  }

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AppProviders />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

try {
  startApp();
} catch (error) {
  console.error("[BOOT] Falha crítica ao iniciar aplicação.", error);
  renderBootError(error);
}

/* ─────────────────────────────────────────
   Cleanup HMR / unload
───────────────────────────────────────── */

function cleanupGlobals() {
  try {
    stopThemeWatcher?.();
  } catch {
    // noop
  }

  try {
    disposeThemeDiagnostics?.();
  } catch {
    // noop
  }

  try {
    disposeGoogleDiagnostics?.();
  } catch {
    // noop
  }
}

window.addEventListener?.("beforeunload", cleanupGlobals);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupGlobals();
  });
}