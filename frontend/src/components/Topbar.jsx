// ✅ src/components/Topbar.jsx
// premium + logout robusto + sync de sessão + quick actions + tema + notificações
import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  Menu as MenuIcon,
  LogOut,
  Bell,
  ChevronRight,
  UserCog,
  CalendarDays,
  ListChecks,
  FileText,
  LayoutDashboard,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

import api, { apiGet } from "../services/api";
import useEscolaTheme from "../hooks/useEscolaTheme";

/* ────────────────────────────────────────────────────────────── */
/* Helpers robustos de sessão / perfil                           */
/* ────────────────────────────────────────────────────────────── */

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_TOPBAR
    ? String(import.meta.env.VITE_DEBUG_TOPBAR) === "true"
    : false;

function logDev(...args) {
  if (DEBUG) console.log("[Topbar]", ...args);
}

function errorDev(...args) {
  if (DEBUG) console.error("[Topbar]", ...args);
}

function safeAtob(b64) {
  try {
    return atob(b64);
  } catch {
    return "";
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payloadB64Url] = String(token || "").split(".");
    if (!payloadB64Url) return null;

    let b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";

    const json = safeAtob(b64);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

function clearLegacyAuthKeys() {
  [
    "token",
    "authToken",
    "access_token",
    "refresh_token",
    "perfil",
    "usuario",
    "user",
  ].forEach((k) => localStorage.removeItem(k));

  sessionStorage.removeItem("perfil_incompleto");
}

function getValidToken() {
  let token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token");

  if (!token) return null;

  if (token.startsWith("Bearer ")) token = token.slice(7).trim();

  const payload = decodeJwtPayload(token);
  const now = Date.now() / 1000;

  if (payload?.nbf && now < payload.nbf) return null;

  if (payload?.exp && now >= payload.exp) {
    clearLegacyAuthKeys();
    return null;
  }

  return token;
}

function normPerfilStr(p) {
  return String(p ?? "")
    .replace(/[\[\]"]/g, "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => out.add(String(p).toLowerCase()));
      } else {
        normPerfilStr(rawPerfil).forEach((p) => out.add(p));
      }
    } catch {
      normPerfilStr(rawPerfil).forEach((p) => out.add(p));
    }
  }

  try {
    const rawUser =
      localStorage.getItem("usuario") || localStorage.getItem("user");

    if (rawUser) {
      const u = JSON.parse(rawUser);

      const pushAll = (val) =>
        normPerfilStr(Array.isArray(val) ? val.join(",") : val).forEach((p) =>
          out.add(p)
        );

      if (u?.perfil) pushAll(u.perfil);
      if (u?.perfis) pushAll(u.perfis);
      if (u?.roles) pushAll(u.roles);
    }
  } catch {
    // noop
  }

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}

function getUsuarioLS() {
  try {
    return JSON.parse(
      localStorage.getItem("usuario") || localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
}

function getNomeUsuario() {
  return getUsuarioLS()?.nome || "";
}

function getEmailUsuario() {
  return getUsuarioLS()?.email || "";
}

function getIniciais(nome, email) {
  const n = String(nome || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  const e = String(email || "").trim();
  if (e) return (e.split("@")[0].slice(0, 2) || "?").toUpperCase();

  return "?";
}

/* Tema sazonal (jul–dez) — “accent” da topbar */
function getNavThemeForMonth(month /* 1-12 */) {
  const themes = {
    7: "from-yellow-600 via-amber-600 to-orange-600",
    8: "from-amber-600 via-yellow-600 to-orange-600",
    9: "from-yellow-600 via-emerald-700 to-teal-800",
    10: "from-pink-700 via-rose-700 to-fuchsia-700",
    11: "from-blue-700 via-indigo-700 to-purple-700",
    12: "from-red-700 via-rose-700 to-orange-700",
  };
  return themes[month] || null;
}

function ChipLink({ to, children, title }) {
  return (
    <Link
      to={to}
      title={title}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
    >
      {children}
    </Link>
  );
}

function nextTheme(t) {
  if (t === "light") return "dark";
  if (t === "dark") return "system";
  return "light";
}

function ThemeCycleButton() {
  const { theme, setTheme, isDark } = useEscolaTheme();

  const label =
    theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : "Sistema";

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(theme))}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold border transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        isDark
          ? "border-white/10 bg-zinc-900/35 hover:bg-white/10 text-zinc-100"
          : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700",
      ].join(" ")}
      aria-label={`Tema: ${label}. Clique para alternar.`}
      title={`Tema: ${label} (clique para alternar)`}
    >
      <Icon className="w-4 h-4 opacity-90" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function Topbar({
  title = "Escola da Saúde",
  onOpenMenu,
  showQuickActions = true,
  drawerId = "app-drawer",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState(getValidToken());
  const [perfis, setPerfis] = useState(() => getPerfisRobusto());
  const [nomeUsuario, setNomeUsuario] = useState(() => getNomeUsuario());
  const [emailUsuario, setEmailUsuario] = useState(() => getEmailUsuario());

  const iniciais = useMemo(
    () => getIniciais(nomeUsuario, emailUsuario),
    [nomeUsuario, emailUsuario]
  );

  /* ───────────────── Notificações ───────────────── */
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const abortNotifRef = useRef(null);

  const atualizarContadorNotificacao = useCallback(async () => {
    const tk = getValidToken();
    if (!tk || document.hidden) return;

    abortNotifRef.current?.abort?.();
    const ac = new AbortController();
    abortNotifRef.current = ac;

    try {
      const data = await apiGet("/api/notificacao/nao-lidas/contagem", {
        on401: "silent",
        on403: "silent",
        signal: ac.signal,
      });

      if (ac.signal.aborted) return;

      setTotalNaoLidas(Number(data?.totalNaoLidas ?? data?.total ?? 0) || 0);
    } catch (e) {
      if (e?.name !== "AbortError") {
        setTotalNaoLidas(0);
        errorDev("erro ao atualizar notificações", e);
      }
    }
  }, []);

  useEffect(() => {
    let intervalId;

    const tick = () => atualizarContadorNotificacao();

    if (token) {
      tick();
      intervalId = setInterval(tick, 30000);
    }

    const onVisibility = () => {
      if (!document.hidden) tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.atualizarContadorNotificacao = tick;

    return () => {
      abortNotifRef.current?.abort?.();
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.atualizarContadorNotificacao;
    };
  }, [token, atualizarContadorNotificacao]);

  /* ───────────────── Sync de sessão ───────────────── */
  const refreshFromLS = useCallback(() => {
    setToken(getValidToken());
    setPerfis(getPerfisRobusto());
    setNomeUsuario(getNomeUsuario());
    setEmailUsuario(getEmailUsuario());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (
        !e.key ||
        [
          "perfil",
          "usuario",
          "user",
          "token",
          "authToken",
          "access_token",
        ].includes(e.key)
      ) {
        logDev("storage → refresh");
        refreshFromLS();
      }
    };

    const onAuthChanged = () => {
      logDev("auth:changed → refresh");
      refreshFromLS();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, [refreshFromLS]);

  useEffect(() => {
    refreshFromLS();
  }, [location.pathname, refreshFromLS]);

  const isUsuario =
    perfis.includes("usuario") ||
    perfis.includes("instrutor") ||
    perfis.includes("administrador");

  const isInstrutor =
    perfis.includes("instrutor") || perfis.includes("administrador");

  const isAdmin = perfis.includes("administrador");

  const sair = useCallback(() => {
    logDev("logout iniciado", {
      pathname: location.pathname,
      perfis,
      hasTokenBefore: !!getValidToken(),
    });

    try {
      if (typeof api.clearSession === "function") {
        api.clearSession();
      } else {
        clearLegacyAuthKeys();
        window.dispatchEvent(
          new CustomEvent("auth:changed", {
            detail: { authenticated: false },
          })
        );
      }
    } catch (error) {
      errorDev("falha ao limpar sessão via api.clearSession", error);
      clearLegacyAuthKeys();
      window.dispatchEvent(
        new CustomEvent("auth:changed", {
          detail: { authenticated: false },
        })
      );
    }

    refreshFromLS();

    logDev("logout concluído", {
      hasTokenAfter: !!getValidToken(),
    });

    // ✅ replace evita voltar para painel pelo histórico
    navigate("/login", { replace: true });

    // fallback extra: se algo interceptar a navegação SPA, força a rota
    window.setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 80);
  }, [location.pathname, navigate, perfis, refreshFromLS]);

  const month = new Date().getMonth() + 1;
  const accent =
    getNavThemeForMonth(month) || "from-emerald-600 via-teal-600 to-sky-700";

  const routeName = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith("/admin") || path.startsWith("/administrador")) {
      return "Admin";
    }
    if (path.startsWith("/instrutor")) {
      return "Instrutor";
    }
    if (path.startsWith("/usuario")) {
      return "Usuário";
    }

    if (path.startsWith("/avaliacao")) {
      return "Avaliações";
    }
    if (path.startsWith("/notificacao")) {
      return "Notificações";
    }
    if (path.startsWith("/perfil")) {
      return "Perfil";
    }
    return "";
  }, [location.pathname]);

  const safeOpenMenu = () => {
    if (typeof onOpenMenu === "function") onOpenMenu();
    else {
      const el = document.getElementById(drawerId);
      el?.focus?.();
    }
  };

  const quickActions = useMemo(() => {
    if (!showQuickActions) return null;

    return (
      <div className="hidden sm:flex items-center gap-2">
        {isUsuario && (
          <>
              </>
        )}

              </div>
    );
  }, [showQuickActions, isUsuario, isInstrutor, isAdmin]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 dark:border-white/10 dark:bg-zinc-950/60 backdrop-blur-xl shadow-sm">
      <div className="relative">
        <div className={`h-[3px] w-full bg-gradient-to-r ${accent}`} />
        <div
          className={`pointer-events-none absolute inset-x-0 -top-2 h-10 bg-gradient-to-r ${accent} opacity-35 blur-2xl`}
          aria-hidden="true"
        />
      </div>

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={safeOpenMenu}
            className="md:hidden inline-flex items-center justify-center rounded-2xl p-2.5 border border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Abrir menu"
            aria-controls={drawerId}
            aria-haspopup="dialog"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm sm:text-base font-extrabold tracking-tight truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-xl px-1"
            aria-label="Ir para a página inicial"
            title={title}
          >
            {title}
          </button>

          {routeName && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-extrabold text-slate-700 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200">
              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              <span className="truncate max-w-[240px]">{routeName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {quickActions}

          <ThemeCycleButton />

          <button
            type="button"
            onClick={() => navigate("/notificacao")}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label={`Abrir notificações${totalNaoLidas ? `, ${totalNaoLidas} não lidas` : ""}`}
            title="Notificações"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {totalNaoLidas > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 rounded-full leading-tight"
                aria-live="polite"
              >
                {totalNaoLidas}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/perfil")}
            className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            title={nomeUsuario ? `Logado como ${nomeUsuario}` : "Conta"}
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-xs">
              {iniciais}
            </span>
            <span className="max-w-[11rem] truncate">{nomeUsuario || "Conta"}</span>
            <UserCog className="w-4 h-4 opacity-90" />
          </button>

          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}