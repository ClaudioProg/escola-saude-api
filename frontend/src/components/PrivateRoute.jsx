// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";

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

  // rotas isentas do redirect por perfil incompleto
  const PERFIL_EXEMPT = ["/perfil", "/atualizar-cadastro", "/usuario/manual", "/manual", "/ajuda"];
  const isRotaExentaPerfil = PERFIL_EXEMPT.some(
    (r) => path === r || path.startsWith(r + "/")
  );

  const exigidos = useMemo(() => {
    if (Array.isArray(permitido)) return permitido;
    if (typeof perfilPermitido === "string" && perfilPermitido.trim()) return [perfilPermitido];
    return [];
  }, [permitido, perfilPermitido]);

  const [token, setToken] = useState(getValidToken());
  const [perfisUsuario, setPerfisUsuario] = useState(() => getPerfisRobusto());

  const [checandoPerfil, setChecandoPerfil] = useState(true);
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });
  const firstLoadRef = useRef(true);

  const autorizado = useMemo(
    () => temAcesso(perfisUsuario, exigidos),
    [perfisUsuario, exigidos]
  );

  // atualiza sessão/perfis ao mudar de rota
  useEffect(() => {
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
  }, [location.pathname]);

  // ouvinte de storage + evento manual "auth:changed"
  useEffect(() => {
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

  // flag de perfil (broadcast)
  useEffect(() => {
    const unsubscribe = subscribePerfilFlag((next) => {
      DEBUG && console.log("[PR] evento perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsubscribe;
  }, []);

  // checagem inicial do /perfil/me (silenciosa)
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
        DEBUG && console.warn(
          "[PR] Falha ao consultar perfil (ignorada p/ redirect):",
          e?.message || e
        );
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
  }, [token]);

  /* ───────────────── Decisões ───────────────── */

  if (!token) {
    DEBUG && console.warn(`[PR] Redirect → /login (motivo: sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  if (!autorizado) {
    DEBUG &&
      console.warn("[PR] Redirect → /dashboard (motivo: sem perfil exigido)", {
        exigidos,
        perfisUsuario,
      });
    return <Navigate to="/dashboard" replace />;
  }

  if (checandoPerfil && perfilIncompleto === null) {
    DEBUG && console.log("[PR] Aguardando 1ª checagem do perfil...");
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        Carregando…
      </div>
    );
  }

  // 🔑 NÃO redireciona se a rota for exenta (manual, ajuda, perfil)
  if (!isRotaExentaPerfil && perfilIncompleto === true) {
    DEBUG && console.warn("[PR] Redirect → /perfil (motivo: perfil incompleto) a partir de", path);
    const from = location;
    return <Navigate to="/perfil" replace state={{ from, forced: true }} />;
  }

  // Se entrou em /perfil forçado e completou, volta para origem
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
