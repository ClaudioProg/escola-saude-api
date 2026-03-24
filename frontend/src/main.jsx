// ✅ src/main.jsx — PREMIUM (2026)
// - Tema aplicado antes do React
// - Bootstrap global de sessão
// - Sem toast indevido no bootstrap de autenticação
// - Logs DEV estratégicos
// - ErrorBoundary premium
// - PWA update safe

import React from "react";
import ReactDOM from "react-dom/client";
import ReactModal from "react-modal";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import App from "./App";
import "./index.css";
import "./App.css";

import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  watchSystemTheme,
} from "./theme/escolaTheme";

import api from "./services/api";

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

function safeGetLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getStoredToken() {
  return (
    safeGetLS("token") ||
    safeGetLS("authToken") ||
    safeGetLS("access_token") ||
    null
  );
}

function isAuthRoute(pathname) {
  return ["/login", "/cadastro", "/recuperar-senha"].some((route) =>
    pathname.startsWith(route)
  );
}

function canSilentlyRedirectToLogin(pathname) {
  return (
    !isAuthRoute(pathname) &&
    !pathname.startsWith("/validar") &&
    !pathname.startsWith("/presenca")
  );
}

/* ──────────────────────────────────────────────────────────────
   ✅ TEMA — boot ANTES do React montar
────────────────────────────────────────────────────────────── */
function readSavedEscolaThemeWithMigration() {
  const saved = safeGetLS(ESCOLA_THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;

  const legacy = safeGetLS("theme");
  if (legacy === "light" || legacy === "dark" || legacy === "system") {
    localStorage.setItem(ESCOLA_THEME_KEY, legacy);
    return legacy;
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
   🔎 Tripwire DEV
────────────────────────────────────────────────────────────── */
(function installThemeTripwireDev() {
  if (!IS_DEV) return;
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  const log = () => {
    const isDark = root.classList.contains("dark");
    const stack = Number(document.body?.dataset?.__modal_stack_count__ || "0");

    console.log(
      "[TEMA] <html> =",
      isDark ? "dark" : "light",
      "| escola_theme =",
      safeGetLS(ESCOLA_THEME_KEY),
      "| modalStack =",
      stack
    );
  };

  const mo = new MutationObserver(log);
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });

  log();
  console.log("[TEMA] Tripwire DEV instalado (MutationObserver, read-only).");

  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      try {
        mo.disconnect();
      } catch {
        /* noop */
      }
    });
  }
})();

/* ──────────────────────────────────────────────────────────────
   A11y: react-modal — app element
────────────────────────────────────────────────────────────── */
(function ensureModalAppElement() {
  try {
    const el = document.getElementById("root");
    if (el) {
      ReactModal.setAppElement(el);
    } else {
      requestAnimationFrame(() => {
        const later = document.getElementById("root");
        if (later) ReactModal.setAppElement(later);
      });
    }
  } catch (e) {
    if (IS_DEV) {
      console.warn("[react-modal] setAppElement falhou:", e);
    }
  }
})();

/* ──────────────────────────────────────────────────────────────
   DEV: logs estratégicos do Google Sign-In
────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  console.groupCollapsed(
    "%c[GSI:init]",
    "color:#14532d;font-weight:800",
    "Diagnóstico do Google Sign-In"
  );
  console.log("• window.location.origin:", window.location.origin);
  console.log("• Ambiente:", IS_DEV ? "dev" : "prod");
  console.log("• VITE_GOOGLE_CLIENT_ID:", maskClientId(clientId));
  console.groupEnd();

  try {
    window.__GID = clientId;
  } catch {
    /* noop */
  }

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
  console.warn("⚠️ VITE_GOOGLE_CLIENT_ID ausente! Verifique o .env.");
}

/* ──────────────────────────────────────────────────────────────
   ✅ Bootstrap global de sessão
   - Não mostra toast de erro ao validar sessão
   - Só redireciona quando necessário
────────────────────────────────────────────────────────────── */
async function bootstrapAuthSession() {
  const pathname = window.location.pathname;
  const token = getStoredToken();

  if (IS_DEV) {
    console.log("[AUTH] bootstrap iniciado", {
      pathname,
      hasToken: !!token,
    });
  }

  if (!token) {
    if (canSilentlyRedirectToLogin(pathname)) {
      if (IS_DEV) {
        console.log("[AUTH] sem token -> redirecionando para /login");
      }
      window.location.replace("/login");
      return;
    }

    if (IS_DEV) {
      console.log("[AUTH] rota pública sem token -> seguindo normalmente");
    }
    return;
  }

  try {
    const data = await api.authMe();

    if (data?.usuario) {
      if (IS_DEV) {
        console.log("[AUTH] sessão válida", {
          userId: data.usuario?.id,
          email: data.usuario?.email,
          perfil: data.usuario?.perfil,
        });
      }
      return;
    }

    if (IS_DEV) {
      console.warn("[AUTH] authMe respondeu sem usuário válido");
    }

    api.clearSession();

    if (canSilentlyRedirectToLogin(pathname)) {
      if (IS_DEV) {
        console.log("[AUTH] sessão sem usuário -> redirecionando para /login");
      }
      window.location.replace("/login");
    }
  } catch (error) {
    if (IS_DEV) {
      console.warn("[AUTH] falha no bootstrap", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
      });
    }

    api.clearSession();

    if (canSilentlyRedirectToLogin(pathname)) {
      window.location.replace("/login");
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   ErrorBoundary premium
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
    if (IS_DEV) {
      console.error("[App ErrorBoundary]", error, info);
    }

    this.setState({ info });

    try {
      toast.error("Ocorreu um erro inesperado.");
    } catch {
      /* noop */
    }
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
          <div
            role="alert"
            aria-live="assertive"
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 shadow p-6 text-center"
          >
            <h1 className="text-xl font-extrabold mb-2">
              Ocorreu um erro inesperado
            </h1>
            <p className="text-sm text-gray-600 dark:text-zinc-300 mb-5">
              Tente recarregar a página. Se persistir, envie os detalhes ao
              suporte.
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
      className="inline-flex items-center justify-center h-7 w-7 rounded-full focus:outline-none focus:ring-2 focus:ring-green-900/60"
      title="Fechar"
    >
      ✕
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Render
────────────────────────────────────────────────────────────── */
async function startApp() {
  await bootstrapAuthSession();

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
        if (IS_DEV) {
          console.info(
            "%c[GSI] SDK carregada.",
            "color:#16a34a;font-weight:800"
          );
        }
      }}
      onScriptLoadError={() => {
        console.error("[GSI] Falha ao carregar a SDK do Google.");
        toast.warn(
          "Falha ao carregar login Google. Você ainda pode usar login por e-mail/senha."
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
}

startApp().catch((error) => {
  console.error("[BOOT] Falha crítica ao iniciar aplicação:", error);

  const container = document.getElementById("root");
  if (!container) return;

  container.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif;background:#fafafa;color:#111827;">
      <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08);">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 10px;">Falha ao iniciar a plataforma</h1>
        <p style="margin:0 0 16px;color:#4b5563;">Ocorreu um erro no carregamento inicial da aplicação.</p>
        <pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;background:#f3f4f6;padding:12px;border-radius:12px;">${String(error?.message || error)}</pre>
        <button onclick="window.location.reload()" style="margin-top:16px;border:0;background:#065f46;color:#fff;padding:12px 16px;border-radius:12px;font-weight:700;cursor:pointer;">
          Recarregar
        </button>
      </div>
    </div>
  `;
});

/* ──────────────────────────────────────────────────────────────
   PWA (prod): informar atualização aplicada e recarregar
────────────────────────────────────────────────────────────── */
(function setupPWA() {
  if (!IS_PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  let reloaded = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;

    try {
      toast.info("Atualização aplicada — recarregando…", { autoClose: 1200 });
    } catch {
      /* noop */
    }

    setTimeout(() => window.location.reload(), 1200);
  });
})();

/* ──────────────────────────────────────────────────────────────
   Cleanup watchers fora do React
────────────────────────────────────────────────────────────── */
window.addEventListener?.("beforeunload", () => {
  try {
    stopWatch?.();
  } catch {
    /* noop */
  }
});