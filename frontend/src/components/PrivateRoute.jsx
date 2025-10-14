// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : true;

/* ───────────────── Helpers ───────────────── */

function decodeJwtPayload(token) {
  try {
    const [, payloadB64Url] = String(token).split(".");
    if (!payloadB64Url) return null;
    let b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    return JSON.parse(atob(b64));
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

function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach((p) => out.add(String(p).toLowerCase()));
      else if (typeof parsed === "string") {
        parsed
          .split(",")
          .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    } catch {
      rawPerfil
        .split(",")
        .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const push = (val) => val && out.add(String(val).toLowerCase());
      if (u?.perfil) Array.isArray(u.perfil) ? u.perfil.forEach(push) : push(u.perfil);
      if (u?.perfis)
        String(u.perfis)
          .split(",")
          .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      if (u?.roles)
        String(u.roles)
          .split(",")
          .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  } catch {}

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}

function temAcesso(perfisUsuario, perfisExigidos) {
  if (!perfisExigidos || perfisExigidos.length === 0) return true; // 🔓 sem regra → libera
  const setUser = new Set(perfisUsuario.map((p) => String(p).toLowerCase()));
  if (setUser.has("administrador")) return true;
  return perfisExigidos.some((p) => setUser.has(String(p).toLowerCase()));
}

/* ───────────────── Componente ───────────────── */

export default function PrivateRoute({ children, permitido, perfilPermitido }) {
  const location = useLocation();
  const path = location?.pathname || "";
  const search = location?.search || "";
  const nextParam = encodeURIComponent(path + search);

  // rotas 100% públicas (sem exigir login)
  const PUBLIC_EXEMPT = ["/", "/login", "/registro", "/sobre", "/contato"];
  const isRotaPublica = PUBLIC_EXEMPT.some((r) => path === r || path.startsWith(r + "/"));

  // rotas isentas do redirect por perfil incompleto
  const PERFIL_EXEMPT = ["/perfil", "/atualizar-cadastro", "/usuario/manual", "/manual", "/ajuda"];
  const isRotaExentaPerfil = PERFIL_EXEMPT.some((r) => path === r || path.startsWith(r + "/"));

  const exigidos = useMemo(() => {
    if (Array.isArray(permitido)) return permitido;
    if (typeof perfilPermitido === "string" && perfilPermitido.trim()) return [perfilPermitido];
    return [];
  }, [permitido, perfilPermitido]);

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
    () => temAcesso(perfisUsuario, exigidos),
    [perfisUsuario, exigidos]
  );

  // ── Guards contra duplo-mount do StrictMode / corrida de efeitos ──
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
        DEBUG && console.log("[PR] storage event → atualizar sessão/perfis");
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

  /* Checagem de /perfil/me:
     - evita rodar 2x no primeiro mount (StrictMode) com ranInitialRef/prevPathRef
     - re-checa ao trocar de rota (path mudou)
     - usa AbortController e trava concorrência com isFetchingRef  */
  useEffect(() => {
    const pathMudou = prevPathRef.current !== path;

    // Ignora a 1ª duplicata do StrictMode (mesmo path, já rodou uma vez)
    if (ranInitialRef.current && !pathMudou) return;

    // Atualiza referência de path e marca que já rodou pelo menos uma vez
    prevPathRef.current = path;
    if (!ranInitialRef.current) ranInitialRef.current = true;

    // Evita concorrência
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const ac = new AbortController();
    const finish = () => {
      isFetchingRef.current = false;
    };

    (async () => {
      const tk = getValidToken();

      // Se não há token:
      //  - Rotas públicas: não precisa checar nada agora (libera).
      //  - Rotas privadas: tenta sessão por cookie httpOnly via /perfil/me.
      if (!tk) {
        if (isRotaPublica) {
          DEBUG && console.log("[PR] Rota pública sem token — sem checagem de perfil necessária.");
          setChecandoPerfil(false);
          finish();
          return;
        }
        try {
          DEBUG && console.log("[PR] Sem token — tentando sessão via cookie em /perfil/me (silent)...");
          const me = await apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal });
          if (me && typeof me === "object") {
            setSessaoValida(true);
            setPerfilIncompleto(!!me?.perfil_incompleto);

            const possiveisPerfis = []
              .concat(me?.perfil ?? [])
              .concat((me?.perfis ?? "").toString().split(","))
              .concat((me?.roles ?? "").toString().split(","))
              .map((p) => String(p || "").replace(/[\[\]"]/g, "").trim().toLowerCase())
              .filter(Boolean);

            if (possiveisPerfis.length > 0) {
              setPerfisUsuario(Array.from(new Set(possiveisPerfis)));
            }

            DEBUG &&
              console.log(
                "[PR] Sessão via cookie detectada. perfil_incompleto=",
                !!me?.perfil_incompleto,
                "perfis=",
                possiveisPerfis
              );
          } else {
            DEBUG && console.log("[PR] Sessão via cookie não encontrada.");
          }
        } catch (e) {
          if (e?.name !== "AbortError") {
            DEBUG && console.warn("[PR] Falha ao checar sessão via cookie (ignorada):", e?.message || e);
          }
        } finally {
          setChecandoPerfil(false);
          finish();
        }
        return;
      }

      // Com token válido:
      if (perfilIncompleto !== null) {
        DEBUG && console.log("[PR] Já tenho flag de perfil:", perfilIncompleto);
        setChecandoPerfil(false);
        finish();
        return;
      }

      try {
        DEBUG && console.log("[PR] Consultando /perfil/me (on401:on403 silent) com token...");
        const me = await apiPerfilMe({ on401: "silent", on403: "silent", signal: ac.signal });
        setPerfilIncompleto(!!me?.perfil_incompleto);
        DEBUG && console.log("[PR] Perfil incompleto? →", !!me?.perfil_incompleto);
      } catch (e) {
        if (e?.name !== "AbortError") {
          DEBUG && console.warn("[PR] Falha ao consultar perfil (ignorada p/ redirect):", e?.message || e);
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
  }, [token, path]); // mantém re-checagem ao trocar de rota

  /* ───────────────── Decisões ───────────────── */

  // 1) Sem token E sem sessão via cookie: libera rotas públicas; privadas → /login
  if (!token && !sessaoValida) {
    if (isRotaPublica) {
      DEBUG && console.log(`[PR] Rota pública sem token — liberando: "${path}"`);
      return children;
    }
    DEBUG && console.warn(`[PR] Redirect → /login (motivo: sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização por perfil/role
  if (!autorizado) {
    DEBUG &&
      console.warn("[PR] Redirect → /dashboard (motivo: sem perfil exigido)", {
        exigidos,
        perfisUsuario,
      });
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Carregando a 1ª checagem de perfil
  if (checandoPerfil && perfilIncompleto === null) {
    DEBUG && console.log("[PR] Aguardando 1ª checagem do perfil...");
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        Carregando…
      </div>
    );
  }

  // 4) Perfil incompleto: redireciona, exceto nas rotas isentas
  if (!isRotaExentaPerfil && perfilIncompleto === true) {
    DEBUG && console.warn("[PR] Redirect → /perfil (motivo: perfil incompleto) a partir de", path);
    const from = location;
    return <Navigate to="/perfil" replace state={{ from, forced: true }} />;
  }

  // 5) Voltando da tela de perfil forçado
  if (
    (path === "/perfil" || path === "/atualizar-cadastro") &&
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
