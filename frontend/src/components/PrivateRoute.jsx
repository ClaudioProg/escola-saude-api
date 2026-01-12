// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : false;

/* ==== Config robusta ==== */
const FETCH_TIMEOUT_MS = 8000;           // ⏱️ tempo máx. p/ /perfil/me
const MAX_CONSEC_TIMEOUTS = 2;           // 🚫 depois disso, não mostra mais spinner

function log(...args) { if (DEBUG) console.log("[PR]", ...args); }
function warn(...args) { if (DEBUG) console.warn("[PR]", ...args); }

/* ==== JWT helpers (inalterados) ==== */
function safeAtob(b64) { try { return atob(b64); } catch { return ""; } }
function decodeJwtPayload(token) {
  try {
    const [, payloadB64Url] = String(token || "").split(".");
    if (!payloadB64Url) return null;
    let b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const json = safeAtob(b64);
    return json ? JSON.parse(json) : null;
  } catch { return null; }
}
function getValidToken() {
  let token = localStorage.getItem("token");
  if (!token) return null;
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();
  const payload = decodeJwtPayload(token);
  const now = Date.now() / 1000;
  if (payload?.nbf && now < payload.nbf) { warn("Token ainda não válido (nbf)."); return null; }
  if (payload?.exp && now >= payload.exp) {
    warn("Token expirado — limpando sessão");
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("perfil");
    sessionStorage.removeItem("perfil_incompleto");
    return null;
  }
  return token;
}

/* ==== perfis helpers (inalterados) ==== */
function normalizarLista(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((p) => String(p).trim()).filter(Boolean);
  return String(input).split(",").map((p) => p.replace(/[\[\]"]/g, "").trim()).filter(Boolean);
}
function getPerfisRobusto() {
  const out = new Set();
  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) for (const p of normalizarLista(rawPerfil)) out.add(p.toLowerCase());
  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const pushAll = (val) => normalizarLista(val).forEach((p) => out.add(p.toLowerCase()));
      pushAll(u?.perfil); pushAll(u?.perfis); pushAll(u?.roles);
    }
  } catch {}
  if (out.size === 0) out.add("usuario");
  return Array.from(out);
}
function temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }) {
  if (predicate && typeof predicate === "function") return !!predicate(perfisUsuario);
  const setUser = new Set(perfisUsuario.map((p) => String(p).toLowerCase()));
  if (setUser.has("administrador")) return true;
  if (exigidosAll?.length) {
    const allOk = exigidosAll.every((p) => setUser.has(String(p).toLowerCase()));
    if (!allOk) return false;
  }
  if (!exigidosAny?.length) return true;
  return exigidosAny.some((p) => setUser.has(String(p).toLowerCase()));
}
function pathMatches(pathname, arr) {
  return (arr || []).some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/* ==== Componente ==== */
/**
 * Props:
 * - permitido: string[] | string | ((perfisUsuario:string[]) => boolean)
 * - permitidoAll: string[]
 * - perfilPermitido: string
 * - publicPaths: string[]
 * - perfilIsentos: string[]
 * - exigirCompleto: boolean (default: true)
 */
export default function PrivateRoute({
  children,
  permitido,
  permitidoAll,
  perfilPermitido,
  publicPaths = ["/", "/login", "/registro", "/sobre", "/contato"],
  perfilIsentos = ["/perfil", "/atualizar-cadastro", "/usuario/manual", "/manual", "/ajuda"],
  exigirCompleto = true,
}) {
  const location = useLocation();
  const path = location?.pathname || "";
  const search = location?.search || "";
  const nextParam = encodeURIComponent(path + search);

  const isRotaPublica = useMemo(() => pathMatches(path, publicPaths), [path, publicPaths]);
  const isRotaExentaPerfil = useMemo(() => pathMatches(path, perfilIsentos), [path, perfilIsentos]);

  const { exigidosAny, exigidosAll, predicate } = useMemo(() => {
    if (typeof permitido === "function") {
      return { exigidosAny: [], exigidosAll: normalizarLista(permitidoAll), predicate: permitido };
    }
    const any = normalizarLista(permitido).concat(normalizarLista(perfilPermitido));
    const all = normalizarLista(permitidoAll);
    return { exigidosAny: any, exigidosAll: all, predicate: null };
  }, [permitido, permitidoAll, perfilPermitido]);

  const [token, setToken] = useState(() => getValidToken());
  const [perfisUsuario, setPerfisUsuario] = useState(() => getPerfisRobusto());

  const [sessaoValida, setSessaoValida] = useState(false);
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });
  const [checandoPerfil, setChecandoPerfil] = useState(false);
  const [timeoutsSeguidos, setTimeoutsSeguidos] = useState(0);

  const autorizado = useMemo(
    () => temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }),
    [perfisUsuario, exigidosAny, exigidosAll, predicate]
  );

  /* single-flight control */
  const inflightRef = useRef(false);
  const fetchIdRef = useRef(0);

  useOnceEffect(() => {
    const syncFromStorage = () => {
      log("sync storage/auth");
      setToken(getValidToken());
      setPerfisUsuario(getPerfisRobusto());
    };
    const onStorage = (e) => { if (!e.key || ["perfil", "usuario", "token"].includes(e.key)) syncFromStorage(); };
    const onAuthChanged = () => syncFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  useOnceEffect(() => {
    const unsubscribe = subscribePerfilFlag((next) => {
      log("perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const checarPerfilMe = useCallback(async (mode) => {
    if (inflightRef.current) { log("skip: already inflight"); return; }
    inflightRef.current = true;

    const myFetchId = ++fetchIdRef.current;
    const ac = new AbortController();
    let timeoutId;

    setChecandoPerfil(true);

    try {
      log(`checando /perfil/me mode=${mode}…`);
      const timeoutPromise = new Promise((_, rej) => {
        timeoutId = setTimeout(() => {
          try { ac.abort(); } catch {}
          rej(new Error("timeout"));
        }, FETCH_TIMEOUT_MS);
      });

      const me = await Promise.race([
        apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal }),
        timeoutPromise,
      ]);

      if (myFetchId !== fetchIdRef.current) return;

      if (me && typeof me === "object") {
        setSessaoValida(true);
        setPerfilIncompleto(!!me?.perfil_incompleto);
        setTimeoutsSeguidos(0);

        const possiveis = []
          .concat(normalizarLista(me?.perfil))
          .concat(normalizarLista(me?.perfis))
          .concat(normalizarLista(me?.roles))
          .map((p) => p.toLowerCase());
        if (possiveis.length) {
          setPerfisUsuario((prev) => Array.from(new Set([...prev, ...possiveis])));
        }
        log("OK /perfil/me", { perfil_incompleto: !!me?.perfil_incompleto, perfis: possiveis });
      } else {
        log("sem objeto me (provável sem cookie válido)");
      }
    } catch (e) {
      if (e?.message === "timeout") {
        warn("timeout /perfil/me");
        setTimeoutsSeguidos((n) => n + 1);
      } else if (e?.name !== "AbortError") {
        warn("falha /perfil/me:", e?.message || e);
      }
    } finally {
      clearTimeout(timeoutId);
      if (myFetchId === fetchIdRef.current) setChecandoPerfil(false);
      inflightRef.current = false;
    }
  }, []);

  /* Dispara checagens quando necessário */
  useEffect(() => {
    const tk = token;

    if (isRotaPublica) { setChecandoPerfil(false); return; }

    // Sem token → tenta cookie httpOnly
    if (!tk) {
      if (!sessaoValida && timeoutsSeguidos < MAX_CONSEC_TIMEOUTS) {
        void checarPerfilMe("cookie");
      } else {
        // failsafe: não fica preso em loading
        setChecandoPerfil(false);
      }
      return;
    }

    // Com token
    if (!exigirCompleto) { setChecandoPerfil(false); return; }

    if (perfilIncompleto !== null) { setChecandoPerfil(false); return; }

    if (timeoutsSeguidos < MAX_CONSEC_TIMEOUTS) {
      void checarPerfilMe("token");
    } else {
      // Depois de 2 timeouts seguidos, assume "desconhecido, segue" (stale-while-revalidate)
      setChecandoPerfil(false);
    }
  }, [token, isRotaPublica, exigirCompleto, perfilIncompleto, sessaoValida, checarPerfilMe, timeoutsSeguidos]);

  /* ── Decisões ── */

  // 1) Sem token e sem sessão cookie
  if (!token && !sessaoValida) {
    if (isRotaPublica) return children;
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização
  if (!autorizado) {
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Spinner só aparece enquanto realmente precisamos da flag
  if (exigirCompleto && checandoPerfil && perfilIncompleto === null) {
    return (
      <div className="min-h-[45vh] grid place-items-center px-4">
        <div
          className={[
            "w-full max-w-sm rounded-3xl",
            "bg-white/80 dark:bg-zinc-900/70",
            "ring-1 ring-black/5 dark:ring-white/10",
            "shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]",
            "p-5 text-center",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto h-10 w-10 rounded-2xl bg-zinc-900/5 dark:bg-white/10 grid place-items-center">
            <div className="h-5 w-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-transparent animate-spin" />
          </div>
          <div className="mt-3 font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Verificando sua sessão…
          </div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Só um instante.</div>
        </div>
      </div>
    );
  }

  // 4) Perfil incompleto → força completar (exceto rotas isentas)
  if (exigirCompleto && !isRotaExentaPerfil && perfilIncompleto === true) {
    return <Navigate to="/perfil" replace state={{ from: location, forced: true }} />;
  }

  // 5) Voltando da tela de perfil forçado
  if ((path === "/perfil" || path === "/atualizar-cadastro") && exigirCompleto && perfilIncompleto === false && location.state?.forced) {
    const prev = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={prev} replace />;
  }

  return children;
}
