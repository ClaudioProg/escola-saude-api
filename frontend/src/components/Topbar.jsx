// ✅ src/components/Topbar.jsx
// premium + logout robusto + sync de sessão + quick actions + tema + notificações
// + drawer lateral premium de notificações + badge + marcar uma/todas + mobile-first

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  Menu as MenuIcon,
  LogOut,
  Bell,
  ChevronRight,
  UserCog,
  Sun,
  Moon,
  Monitor,
  X,
  Check,
  ExternalLink,
  Sparkles,
  Info,
  CalendarDays,
  CheckCircle2,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import api, { apiGet, apiPatch } from "../services/api";
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
    const rawUser = localStorage.getItem("usuario") || localStorage.getItem("user");

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
function getNavThemeForMonth(month) {
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

/* ────────────────────────────────────────────────────────────── */
/* Helpers de notificações                                        */
/* ────────────────────────────────────────────────────────────── */

function formatarDataNotificacao(s) {
  if (!s) return "";
  const str = String(s).trim();

  const mDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) return `${mDate[3]}/${mDate[2]}/${mDate[1]}`;

  const mDateTime = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (mDateTime) {
    const [, y, mo, d, hh, mm] = mDateTime;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return str;

  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d}/${mo}/${y} ${hh}:${mm}`;
}

function normalizarTipo(tipo) {
  const t = String(tipo || "").trim().toLowerCase();

  if (t === "evento") return "evento";
  if (t === "certificado") return "certificado";
  if (t === "avaliacao" || t === "avaliação") return "avaliacao";
  if (t === "reserva_aprovada") return "reserva_aprovada";
  if (t === "reserva_rejeitada") return "reserva_rejeitada";
  if (t === "submissao") return "submissao";
  if (t === "aviso" || t === "sistema") return "aviso";
  return "outros";
}

function labelTipo(tipo) {
  const t = normalizarTipo(tipo);

  if (t === "evento") return "Evento";
  if (t === "certificado") return "Certificado";
  if (t === "avaliacao") return "Avaliação";
  if (t === "reserva_aprovada") return "Reserva aprovada";
  if (t === "reserva_rejeitada") return "Reserva não aprovada";
  if (t === "submissao") return "Submissão";
  if (t === "aviso") return "Aviso";
  return "Atualização";
}

function NotificationIcon({ tipo }) {
  const t = normalizarTipo(tipo);

  if (t === "evento") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
        <CalendarDays className="w-5 h-5" />
      </span>
    );
  }

  if (t === "certificado" || t === "reserva_aprovada") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="w-5 h-5" />
      </span>
    );
  }

  if (t === "avaliacao") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
        <Star className="w-5 h-5" />
      </span>
    );
  }

  if (t === "reserva_rejeitada" || t === "aviso" || t === "submissao") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
        <Info className="w-5 h-5" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <Bell className="w-5 h-5" />
    </span>
  );
}

function NotificationDrawer({
  open,
  onClose,
  notificacoes,
  totalNaoLidas,
  loading,
  onMarcarUma,
  onMarcarTodas,
  onAbrirCentral,
  marcandoId,
  marcandoTodas,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar painel de notificações"
            className="fixed inset-0 z-[79] bg-slate-950/45 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.aside
            className="fixed right-0 top-0 z-[80] h-dvh w-full max-w-md border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Painel de notificações"
          >
            <div className="flex h-full flex-col">
              <div className="relative overflow-hidden border-b border-slate-200 px-4 py-4 dark:border-white/10">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-700 via-fuchsia-700 to-pink-700 opacity-95" />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />
                <div className="relative flex items-start justify-between gap-3 text-white">
                  <div>
                    <div className="inline-flex items-center gap-2 text-sm font-extrabold">
                      <Bell className="w-5 h-5" />
                      Notificações
                    </div>
                    <p className="mt-1 text-sm text-white/85">
                      {totalNaoLidas} não lida{totalNaoLidas === 1 ? "" : "s"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white hover:bg-white/15 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onMarcarTodas}
                    disabled={marcandoTodas || totalNaoLidas === 0}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                      marcandoTodas || totalNaoLidas === 0
                        ? "cursor-not-allowed bg-white/10 text-white/60"
                        : "bg-white/15 text-white hover:bg-white/20"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {marcandoTodas ? "Marcando..." : "Marcar todas"}
                  </button>

                  <button
                    type="button"
                    onClick={onAbrirCentral}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-100 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver todas
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/60 animate-pulse"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-zinc-800" />
                            <div className="h-3 w-full rounded bg-slate-200 dark:bg-zinc-800" />
                            <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-zinc-800" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !notificacoes.length ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-white/10 dark:bg-zinc-900/50">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white shadow-sm dark:bg-zinc-800">
                      <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-300" />
                    </div>
                    <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
                      Tudo em dia
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                      Você não tem notificações não lidas no momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notificacoes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm transition dark:border-amber-900/40 dark:bg-amber-950/15"
                      >
                        <div className="flex items-start gap-3">
                          <NotificationIcon tipo={n.tipo} />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {n.titulo || "Notificação"}
                              </p>

                              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-extrabold text-slate-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200">
                                {labelTipo(n.tipo)}
                              </span>

                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-200">
                                não lida
                              </span>
                            </div>

                            {n.mensagem ? (
                              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                                {String(n.mensagem)}
                              </p>
                            ) : null}

                            {(n.criado_em || n.data) && (
                              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                                {formatarDataNotificacao(n.criado_em || n.data)}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onMarcarUma(n)}
                                disabled={marcandoId === n.id}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                                  marcandoId === n.id
                                    ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                    : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                                }`}
                              >
                                <Check className="w-4 h-4" />
                                {marcandoId === n.id ? "Salvando..." : "Marcar como lida"}
                              </button>

                              {n.link ? (
                                <button
                                  type="button"
                                  onClick={() => onMarcarUma(n, true)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/5"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Abrir
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
  const [drawerNotifOpen, setDrawerNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notificacoesDrawer, setNotificacoesDrawer] = useState([]);
  const [marcandoNotifId, setMarcandoNotifId] = useState(null);
  const [marcandoTodasNotif, setMarcandoTodasNotif] = useState(false);

  const abortNotifRef = useRef(null);
  const abortDrawerRef = useRef(null);

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

  const carregarDrawerNotificacoes = useCallback(async () => {
    const tk = getValidToken();
    if (!tk) {
      setNotificacoesDrawer([]);
      setTotalNaoLidas(0);
      return;
    }

    abortDrawerRef.current?.abort?.();
    const ac = new AbortController();
    abortDrawerRef.current = ac;

    try {
      setNotifLoading(true);

      const [lista, resumo] = await Promise.all([
        apiGet("/api/notificacao", {
          on401: "silent",
          on403: "silent",
          signal: ac.signal,
          query: {
            apenasNaoLidas: 1,
            limit: 8,
            offset: 0,
          },
        }),
        apiGet("/api/notificacao/resumo", {
          on401: "silent",
          on403: "silent",
          signal: ac.signal,
        }),
      ]);

      if (ac.signal.aborted) return;

      setNotificacoesDrawer(Array.isArray(lista) ? lista : []);
      setTotalNaoLidas(Number(resumo?.naoLidas ?? 0) || 0);
    } catch (e) {
      if (e?.name !== "AbortError") {
        errorDev("erro ao carregar drawer de notificações", e);
        setNotificacoesDrawer([]);
      }
    } finally {
      if (!ac.signal.aborted) setNotifLoading(false);
    }
  }, []);

  const abrirDrawerNotificacoes = useCallback(async () => {
    setDrawerNotifOpen(true);
    await carregarDrawerNotificacoes();
  }, [carregarDrawerNotificacoes]);

  const fecharDrawerNotificacoes = useCallback(() => {
    setDrawerNotifOpen(false);
  }, []);

  const marcarNotificacaoComoLida = useCallback(
    async (notif, navegarApos = false) => {
      if (!notif?.id) return;

      try {
        setMarcandoNotifId(notif.id);
        await apiPatch(`/api/notificacao/${notif.id}/lida`, undefined, {
          on401: "silent",
          on403: "silent",
        });

        setNotificacoesDrawer((prev) => prev.filter((n) => n.id !== notif.id));
        setTotalNaoLidas((prev) => Math.max(0, Number(prev || 0) - 1));

        if (typeof window.atualizarContadorNotificacao === "function") {
          window.atualizarContadorNotificacao();
        }

        if (navegarApos && notif.link) {
          fecharDrawerNotificacoes();
          navigate(notif.link);
        }
      } catch (e) {
        errorDev("erro ao marcar notificação como lida", e);
      } finally {
        setMarcandoNotifId(null);
      }
    },
    [fecharDrawerNotificacoes, navigate]
  );

  const marcarTodasNotificacoesComoLidas = useCallback(async () => {
    if (!totalNaoLidas) return;

    try {
      setMarcandoTodasNotif(true);
      await apiPatch("/api/notificacao/lidas/todas", undefined, {
        on401: "silent",
        on403: "silent",
      });

      setNotificacoesDrawer([]);
      setTotalNaoLidas(0);

      if (typeof window.atualizarContadorNotificacao === "function") {
        window.atualizarContadorNotificacao();
      }
    } catch (e) {
      errorDev("erro ao marcar todas notificações como lidas", e);
    } finally {
      setMarcandoTodasNotif(false);
    }
  }, [totalNaoLidas]);

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
      abortDrawerRef.current?.abort?.();
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
        ["perfil", "usuario", "user", "token", "authToken", "access_token"].includes(e.key)
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

    navigate("/login", { replace: true });

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

    if (path.startsWith("/admin") || path.startsWith("/administrador")) return "Admin";
    if (path.startsWith("/instrutor")) return "Instrutor";
    if (path.startsWith("/usuario")) return "Usuário";
    if (path.startsWith("/avaliacao")) return "Avaliações";
    if (path.startsWith("/notificacao")) return "Notificações";
    if (path.startsWith("/perfil")) return "Perfil";
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
    if (!isUsuario) return null;

    return <div className="hidden sm:flex items-center gap-2" />;
  }, [showQuickActions, isUsuario]);

  return (
    <>
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
              onClick={abrirDrawerNotificacoes}
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
                  {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
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

      <NotificationDrawer
        open={drawerNotifOpen}
        onClose={fecharDrawerNotificacoes}
        notificacoes={notificacoesDrawer}
        totalNaoLidas={totalNaoLidas}
        loading={notifLoading}
        onMarcarUma={marcarNotificacaoComoLida}
        onMarcarTodas={marcarTodasNotificacoesComoLidas}
        onAbrirCentral={() => {
          fecharDrawerNotificacoes();
          navigate("/notificacao");
        }}
        marcandoId={marcandoNotifId}
        marcandoTodas={marcandoTodasNotif}
      />
    </>
  );
}