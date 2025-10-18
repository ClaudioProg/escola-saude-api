// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : false;

/* ───────────────── Helpers ───────────────── */

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
    DEBUG && console.warn("[PR] Token ainda não é válido (nbf).");
    return null;
  }
  if (payload?.exp && now >= payload.exp) {
    DEBUG && console.warn("[PR] Token expirado — limpando sessão");
    // Limpa apenas chaves de autenticação (evita apagar preferências)
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("perfil");
    sessionStorage.removeItem("perfil_incompleto");
    return null;
  }
  return token; // retorna apenas o JWT
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
    // Predicado tem prioridade (pode aplicar regras dinâmicas)
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

/* ───────────────── Componente ───────────────── */

/**
 * Props suportadas:
 * - permitido: string[] | string | ((perfisUsuario:string[]) => boolean)  // any-of OU predicado
 * - permitidoAll: string[]                                                 // all-of
 * - perfilPermitido: string                                               // compat legada (any-of)
 * - publicPaths: string[]                                                 // rotas públicas
 * - perfilIsentos: string[]                                               // rotas isentas de redirect por perfil incompleto
 * - exigirCompleto: boolean                                               // força checagem de perfil (default: true)
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

  const isMatch = (arr) => arr.some((r) => path === r || path.startsWith(r + "/"));
  const isRotaPublica = isMatch(publicPaths);
  const isRotaExentaPerfil = isMatch(perfilIsentos);

  // Normaliza regras de permissão
  const { exigidosAny, exigidosAll, predicate } = useMemo(() => {
    if (typeof permitido === "function") {
      return { exigidosAny: [], exigidosAll: normalizarLista(permitidoAll), predicate: permitido };
    }
    const any = normalizarLista(permitido).concat(normalizarLista(perfilPermitido));
    const all = normalizarLista(permitidoAll);
    return { exigidosAny: any, exigidosAll: all, predicate: null };
  }, [permitido, permitidoAll, perfilPermitido]);

  const [token, setToken] = useState(getValidToken());
  const [perfisUsuario, setPerfisUsuario] = useState(() => getPerfisRobusto());

  // Suporte a sessão com cookie httpOnly (quando não há token no storage)
  const [sessaoValida, setSessaoValida] = useState(false);

  const [checandoPerfil, setChecandoPerfil] = useState(true);
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });

  const autorizado = useMemo(
    () => temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }),
    [perfisUsuario, exigidosAny, exigidosAll, predicate]
  );

  // ── Guards contra duplo-mount e corrida de efeitos ──
  const ranInitialRef = useRef(false);
  const prevPathRef = useRef(path);
  const isFetchingRef = useRef(false);

  /* Atualiza sessão/perfis ao mudar de rota */
  useEffect(() => {
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
  }, [location.pathname]);

  /* Ouvinte de storage + evento manual "auth:changed" (roda uma única vez) */
  useOnceEffect(() => {
    const onStorage = (e) => {
      if (!e.key || ["perfil", "usuario", "token"].includes(e.key)) {
        DEBUG && console.log("[PR] storage → atualizar sessão/perfis");
        setToken(getValidToken());
        setPerfisUsuario(getPerfisRobusto());
      }
    };
    const onAuthChanged = () => {
      DEBUG && console.log("[PR] auth:changed → atualizar sessão/perfis");
      setToken(getValidToken());
      setPerfisUsuario(getPerfisRobusto());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  /* flag de perfil (broadcast) — assinatura única */
  useOnceEffect(() => {
    const unsubscribe = subscribePerfilFlag((next) => {
      DEBUG && console.log("[PR] evento perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsubscribe;
  }, []);

  /* Checagem de /perfil/me */
  useEffect(() => {
    const pathMudou = prevPathRef.current !== path;

    if (ranInitialRef.current && !pathMudou) return;
    prevPathRef.current = path;
    if (!ranInitialRef.current) ranInitialRef.current = true;

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const ac = new AbortController();
    const finish = () => {
      isFetchingRef.current = false;
    };

    (async () => {
      const tk = getValidToken();

      // Sem token:
      if (!tk) {
        if (isRotaPublica) {
          DEBUG && console.log("[PR] Rota pública sem token — sem checagem de perfil.");
          setChecandoPerfil(false);
          finish();
          return;
        }
        // tentar sessão via cookie httpOnly
        try {
          DEBUG && console.log("[PR] Tentando sessão via cookie em /perfil/me (silent)...");
          const me = await apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal });
          if (me && typeof me === "object") {
            setSessaoValida(true);
            setPerfilIncompleto(!!me?.perfil_incompleto);

            // injeta perfis detectados para o ciclo atual
            const possiveisPerfis = []
              .concat(normalizarLista(me?.perfil))
              .concat(normalizarLista(me?.perfis))
              .concat(normalizarLista(me?.roles))
              .map((p) => p.toLowerCase());
            if (possiveisPerfis.length) {
              setPerfisUsuario((prev) => Array.from(new Set([...prev, ...possiveisPerfis])));
            }

            DEBUG && console.log("[PR] Sessão via cookie detectada. perfil_incompleto=", !!me?.perfil_incompleto);
          } else {
            DEBUG && console.log("[PR] Sessão via cookie não encontrada.");
          }
        } catch (e) {
          if (e?.name !== "AbortError") {
            DEBUG && console.warn("[PR] Falha em /perfil/me (cookie) — ignorando:", e?.message || e);
          }
        } finally {
          setChecandoPerfil(false);
          finish();
        }
        return;
      }

      // Com token válido:
      if (!exigirCompleto) {
        // Se não precisamos travar por perfil, não checamos /perfil/me aqui.
        setChecandoPerfil(false);
        finish();
        return;
      }

      if (perfilIncompleto !== null) {
        // Já sabemos a flag (storage/broadcast)
        setChecandoPerfil(false);
        finish();
        return;
      }

      try {
        DEBUG && console.log("[PR] Consultando /perfil/me (silent) com token...");
        const me = await apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal });
        setPerfilIncompleto(!!me?.perfil_incompleto);
        DEBUG && console.log("[PR] Perfil incompleto? →", !!me?.perfil_incompleto);
      } catch (e) {
        if (e?.name !== "AbortError") {
          DEBUG && console.warn("[PR] Falha ao consultar perfil (silent):", e?.message || e);
        }
      } finally {
        setChecandoPerfil(false);
        finish();
      }
    })();

    return () => {
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, path, exigirCompleto, isRotaPublica]);

  /* ───────────────── Decisões ───────────────── */

  // 1) Sem token e sem sessão via cookie: públicas liberadas; privadas → /login
  if (!token && !sessaoValida) {
    if (isRotaPublica) {
      DEBUG && console.log(`[PR] Rota pública sem token — liberando: "${path}"`);
      return children;
    }
    DEBUG && console.warn(`[PR] Redirect → /login (sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização por perfil/role
  if (!autorizado) {
    DEBUG && console.warn("[PR] Redirect → /dashboard (sem perfil exigido)", {
      exigidosAny,
      exigidosAll,
      perfisUsuario,
    });
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Carregando 1ª checagem de perfil (quando exigida)
  if (exigirCompleto && checandoPerfil && perfilIncompleto === null) {
    DEBUG && console.log("[PR] Aguardando checagem de perfil...");
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        Carregando…
      </div>
    );
  }

  // 4) Perfil incompleto: redireciona, exceto nas rotas isentas
  if (exigirCompleto && !isRotaExentaPerfil && perfilIncompleto === true) {
    DEBUG && console.warn("[PR] Redirect → /perfil (perfil incompleto) a partir de", path);
    const from = location;
    return <Navigate to="/perfil" replace state={{ from, forced: true }} />;
  }

  // 5) Voltando da tela de perfil forçado (evita loop após completar)
  if (
    (path === "/perfil" || path === "/atualizar-cadastro") &&
    exigirCompleto &&
    perfilIncompleto === false &&
    location.state?.forced
  ) {
    const prev = location.state?.from?.pathname || "/dashboard";
    DEBUG && console.log("[PR] Perfil completo — voltar para origem forçada:", prev);
    return <Navigate to={prev} replace />;
  }

  DEBUG && console.log("[PR] OK: render children para", path);
  return children;
}
