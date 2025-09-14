// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : true;

/* ────────────────────────────────────────────────────────────── */
/* Helpers                                                        */
/* ────────────────────────────────────────────────────────────── */

/** Decodifica payload JWT lidando com base64url e padding */
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

/** 🔐 Lê e valida token (exp/nbf em segundos, se existirem) */
function getValidToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const now = Date.now() / 1000;
  if (payload?.nbf && now < payload.nbf) {
    DEBUG && console.warn("[PR] Token ainda não é válido (nbf).");
    return null;
  }
  if (payload?.exp && now >= payload.exp) {
    DEBUG && console.warn("[PR] Token expirado — limpando sessão");
    localStorage.clear();
    sessionStorage.removeItem("perfil_incompleto");
    return null;
  }
  return token;
}

/** 👥 Coleta perfis do storage e normaliza */
function getPerfisRobusto() {
  const out = new Set();

  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach((p) => out.add(String(p).toLowerCase()));
      else if (typeof parsed === "string") {
        parsed.split(",").forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    } catch {
      rawPerfil.split(",").forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  }

  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      // aceita varios formatos
      const push = (val) => val && out.add(String(val).toLowerCase());
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach(push);
        else push(u.perfil);
      }
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach(push);
        else String(u.perfis)
          .split(",")
          .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
      // suporte opcional a 'roles'
      if (u?.roles) {
        if (Array.isArray(u.roles)) u.roles.forEach(push);
        else String(u.roles)
          .split(",")
          .forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    }
  } catch {
    /* ignore */
  }

  if (out.size === 0) out.add("usuario");
  return Array.from(out).filter(Boolean);
}

/** Verifica autorização: admin é superuser; senão, interseção com exigidos */
function temAcesso(perfisUsuario, perfisExigidos) {
  if (!perfisExigidos || perfisExigidos.length === 0) return true;
  const setUser = new Set(perfisUsuario.map((p) => String(p).toLowerCase()));
  if (setUser.has("administrador")) return true;
  return perfisExigidos.some((p) => setUser.has(String(p).toLowerCase()));
}

/* ────────────────────────────────────────────────────────────── */
/* Componente                                                     */
/* ────────────────────────────────────────────────────────────── */

export default function PrivateRoute({
  children,
  permitido,
  perfilPermitido,
}) {
  const location = useLocation();
  const path = location?.pathname || "";
  const search = location?.search || "";
  const nextParam = encodeURIComponent(path + search);

  // telas que podem receber redirect por perfil incompleto
  const isAtualizarCadastro = path === "/atualizar-cadastro" || path === "/perfil";

  /** Normaliza perfis exigidos (string | string[]) */
  const exigidos = useMemo(() => {
    if (Array.isArray(permitido)) return permitido;
    if (typeof perfilPermitido === "string" && perfilPermitido.trim()) return [perfilPermitido];
    return [];
  }, [permitido, perfilPermitido]);

  // ── token
  const [token, setToken] = useState(getValidToken());

  // ── perfis do usuário (reativo a mudanças de rota, token e storage)
  const [perfisUsuario, setPerfisUsuario] = useState(() => getPerfisRobusto());

  // ── perfil incompleto
  const [checandoPerfil, setChecandoPerfil] = useState(true);
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });
  const firstLoadRef = useRef(true);

  // autorizado?
  const autorizado = useMemo(
    () => temAcesso(perfisUsuario, exigidos),
    [perfisUsuario, exigidos]
  );

  /* ───────────────── listeners/efeitos ───────────────── */

  // Atualiza quando a rota muda (útil quando o app troca perfis em runtime)
  useEffect(() => {
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
  }, [location.pathname]);

  // Ouvinte de storage (outras abas) e também no próprio tab se app lançar o evento manualmente
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || ["perfil", "usuario", "token"].includes(e.key)) {
        DEBUG && console.log("[PR] storage event → atualizar sessão/perfis");
        setToken(getValidToken());
        setPerfisUsuario(getPerfisRobusto());
      }
    };
    window.addEventListener("storage", onStorage);
    // canal manual (útil se app disparar: window.dispatchEvent(new Event("auth:changed")))
    const onAuthChanged = () => {
      DEBUG && console.log("[PR] auth:changed → atualizar sessão/perfis");
      setToken(getValidToken());
      setPerfisUsuario(getPerfisRobusto());
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  // 👂 OUVE mudanças na flag emitidas pelo api.js (sem F5)
  useEffect(() => {
    const unsubscribe = subscribePerfilFlag((next) => {
      DEBUG && console.log("[PR] evento perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsubscribe;
  }, []);

  // 🔎 Checagem do perfil incompleto (NUNCA faz logout por 401/403 aqui)
  useEffect(() => {
    let alive = true;
    (async () => {
      const tk = getValidToken();
      if (!tk) {
        DEBUG && console.log("[PR] Sem token, não checa perfil.");
        setChecandoPerfil(false);
        firstLoadRef.current = false;
        return;
      }
      if (!firstLoadRef.current && perfilIncompleto !== null) {
        DEBUG && console.log("[PR] Já tenho flag de perfil:", perfilIncompleto);
        setChecandoPerfil(false);
        return;
      }
      try {
        DEBUG && console.log("[PR] Consultando /perfil/me (on401:on403 silent)...");
        const me = await apiPerfilMe({ on401: "silent", on403: "silent" });
        if (!alive) return;
        setPerfilIncompleto(!!me?.perfil_incompleto);
        DEBUG && console.log("[PR] Perfil incompleto? →", !!me?.perfil_incompleto);
      } catch (e) {
        DEBUG && console.warn("[PR] Falha ao consultar perfil (ignorada p/ redirect):", e?.message || e);
      } finally {
        if (alive) {
          setChecandoPerfil(false);
          firstLoadRef.current = false;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // dependências mínimas: token muda ou primeira carga
  }, [token]);

  /* ───────────────── decisões ───────────────── */

  // 1) Sem token → login
  if (!token) {
    DEBUG && console.warn(`[PR] Redirect → /login (motivo: sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Sem autorização por perfil
  if (!autorizado) {
    DEBUG && console.warn("[PR] Redirect → /dashboard (motivo: sem perfil exigido)", { exigidos, perfisUsuario });
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Aguardando checagem inicial da flag (apenas 1ª vez)
  if (checandoPerfil && perfilIncompleto === null) {
    DEBUG && console.log("[PR] Aguardando 1ª checagem do perfil...");
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        Carregando…
      </div>
    );
  }

  // 4) Perfil incompleto → força atualização (marca forced:true), exceto se já estiver lá
  if (perfilIncompleto === true && !isAtualizarCadastro) {
    DEBUG && console.warn("[PR] Redirect → /perfil (motivo: perfil incompleto) a partir de", path);
    const from = location;
    return <Navigate to="/perfil" replace state={{ from, forced: true }} />;
  }

  // 5) Já na tela de atualização e perfil ficou OK:
  //    só volta para a origem se a navegação foi "forçada".
  if (isAtualizarCadastro && perfilIncompleto === false && location.state?.forced) {
    const prev = location.state?.from?.pathname || "/dashboard";
    DEBUG && console.log("[PR] Perfil completo — voltar para origem forçada:", prev);
    return <Navigate to={prev} replace />;
  }

  DEBUG && console.log("[PR] OK: render children para", path);
  return children;
}
