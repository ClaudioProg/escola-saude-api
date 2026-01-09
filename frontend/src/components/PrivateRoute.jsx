// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : false;

/* ───────────────── Helpers ───────────────── */

function log(...args) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[PR]", ...args);
}
function warn(...args) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.warn("[PR]", ...args);
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

function getValidToken() {
  let token = localStorage.getItem("token");
  if (!token) return null;

  // Aceita "Bearer x.y.z" ou somente "x.y.z"
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();

  const payload = decodeJwtPayload(token);
  const now = Date.now() / 1000;

  if (payload?.nbf && now < payload.nbf) {
    warn("Token ainda não é válido (nbf).");
    return null;
  }
  if (payload?.exp && now >= payload.exp) {
    warn("Token expirado — limpando sessão");
    // Limpa apenas chaves de autenticação (evita apagar preferências)
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("perfil");
    sessionStorage.removeItem("perfil_incompleto");
    return null;
  }
  return token;
}

function normalizarLista(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((p) => String(p).trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map((p) => p.replace(/[\[\]"]/g, "").trim())
    .filter(Boolean);
}

function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    for (const p of normalizarLista(rawPerfil)) out.add(p.toLowerCase());
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const pushAll = (val) => normalizarLista(val).forEach((p) => out.add(p.toLowerCase()));
      pushAll(u?.perfil);
      pushAll(u?.perfis);
      pushAll(u?.roles);
    }
  } catch {
    // ignora parsing
  }

  if (out.size === 0) out.add("usuario");
  return Array.from(out);
}

function temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }) {
  if (predicate && typeof predicate === "function") {
    return !!predicate(perfisUsuario);
  }
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

/* ───────────────── Componente ───────────────── */

/**
 * Props suportadas:
 * - permitido: string[] | string | ((perfisUsuario:string[]) => boolean)
 * - permitidoAll: string[]
 * - perfilPermitido: string (compat)
 * - publicPaths: string[]
 * - perfilIsentos: string[]
 * - exigirCompleto: boolean (default: true)
 * - children: ReactNode
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

  // Normaliza regras de permissão
  const { exigidosAny, exigidosAll, predicate } = useMemo(() => {
    if (typeof permitido === "function") {
      return {
        exigidosAny: [],
        exigidosAll: normalizarLista(permitidoAll),
        predicate: permitido,
      };
    }
    const any = normalizarLista(permitido).concat(normalizarLista(perfilPermitido));
    const all = normalizarLista(permitidoAll);
    return { exigidosAny: any, exigidosAll: all, predicate: null };
  }, [permitido, permitidoAll, perfilPermitido]);

  // sessão local (token + perfis) — atualiza em storage/auth events
  const [token, setToken] = useState(() => getValidToken());
  const [perfisUsuario, setPerfisUsuario] = useState(() => getPerfisRobusto());

  // fallback: sessão via cookie httpOnly (quando token não existe)
  const [sessaoValida, setSessaoValida] = useState(false);

  // flag perfil incompleto (null = desconhecido)
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });

  // loading apenas quando realmente precisamos descobrir a flag
  const [checandoPerfil, setChecandoPerfil] = useState(false);

  const autorizado = useMemo(
    () => temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }),
    [perfisUsuario, exigidosAny, exigidosAll, predicate]
  );

  // ───────────────── listeners (uma vez) ─────────────────
  useOnceEffect(() => {
    const syncFromStorage = () => {
      log("sync storage/auth → atualizar token/perfis");
      setToken(getValidToken());
      setPerfisUsuario(getPerfisRobusto());
    };

    const onStorage = (e) => {
      if (!e.key || ["perfil", "usuario", "token"].includes(e.key)) syncFromStorage();
    };
    const onAuthChanged = () => syncFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  // flag de perfil via broadcast
  useOnceEffect(() => {
    const unsubscribe = subscribePerfilFlag((next) => {
      log("evento perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsubscribe;
  }, []);

  // sempre que rota muda, sincroniza token/perfis (rápido e barato)
  useEffect(() => {
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // ───────────────── checagem do /perfil/me (com cancelamento) ─────────────────
  const fetchIdRef = useRef(0);

  const checarPerfilMe = useCallback(
    async (mode) => {
      // mode: "cookie" | "token"
      const fetchId = ++fetchIdRef.current;
      const ac = new AbortController();

      setChecandoPerfil(true);

      try {
        log(`checando /perfil/me (silent) mode=${mode}…`);
        const me = await apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal });

        // ignora se já houve outro fetch depois
        if (fetchId !== fetchIdRef.current) return;

        if (me && typeof me === "object") {
          setSessaoValida(true);
          setPerfilIncompleto(!!me?.perfil_incompleto);

          // injeta perfis detectados (se vierem)
          const possiveisPerfis = []
            .concat(normalizarLista(me?.perfil))
            .concat(normalizarLista(me?.perfis))
            .concat(normalizarLista(me?.roles))
            .map((p) => p.toLowerCase());

          if (possiveisPerfis.length) {
            setPerfisUsuario((prev) => Array.from(new Set([...prev, ...possiveisPerfis])));
          }

          log("perfil_incompleto=", !!me?.perfil_incompleto, "perfis=", possiveisPerfis);
        } else {
          log("sem objeto me (provável não autenticado por cookie)");
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          warn("falha /perfil/me (silent):", e?.message || e);
        }
      } finally {
        if (fetchId === fetchIdRef.current) setChecandoPerfil(false);
      }

      return () => ac.abort();
    },
    []
  );

  // Dispara checagem apenas quando necessário:
  useEffect(() => {
    const tk = token;

    // 1) Se rota é pública, não precisamos checar nada
    if (isRotaPublica) {
      setChecandoPerfil(false);
      return;
    }

    // 2) Sem token: tenta cookie httpOnly para liberar privadas quando existir
    if (!tk) {
      // se já detectamos sessão cookie antes, não precisa re-checar
      if (sessaoValida) return;

      // tenta cookie somente quando acessando rota privada
      void checarPerfilMe("cookie");
      return;
    }

    // 3) Com token:
    if (!exigirCompleto) {
      setChecandoPerfil(false);
      return;
    }

    // 4) Se já temos a flag (storage/broadcast), não precisa checar
    if (perfilIncompleto !== null) {
      setChecandoPerfil(false);
      return;
    }

    // 5) Precisamos descobrir a flag via /perfil/me
    void checarPerfilMe("token");
  }, [token, isRotaPublica, exigirCompleto, perfilIncompleto, sessaoValida, checarPerfilMe]);

  /* ───────────────── Decisões ───────────────── */

  // 1) Sem token e sem sessão via cookie: públicas liberadas; privadas → /login
  if (!token && !sessaoValida) {
    if (isRotaPublica) {
      log(`Rota pública sem token — liberando: "${path}"`);
      return children;
    }
    warn(`Redirect → /login (sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização por perfil/role
  if (!autorizado) {
    warn("Redirect → /dashboard (sem perfil exigido)", { exigidosAny, exigidosAll, perfisUsuario });
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Carregando checagem de perfil apenas quando precisamos dela
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
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Só um instante.
          </div>
        </div>
      </div>
    );
  }

  // 4) Perfil incompleto: redireciona, exceto nas rotas isentas
  if (exigirCompleto && !isRotaExentaPerfil && perfilIncompleto === true) {
    warn("Redirect → /perfil (perfil incompleto) a partir de", path);
    return <Navigate to="/perfil" replace state={{ from: location, forced: true }} />;
  }

  // 5) Voltando da tela de perfil forçado (evita loop após completar)
  if (
    (path === "/perfil" || path === "/atualizar-cadastro") &&
    exigirCompleto &&
    perfilIncompleto === false &&
    location.state?.forced
  ) {
    const prev = location.state?.from?.pathname || "/dashboard";
    log("Perfil completo — voltar para origem forçada:", prev);
    return <Navigate to={prev} replace />;
  }

  log("OK: render children para", path);
  return children;
}
