// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag } from "../services/api";

const DEBUG = true;

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

/** 🔐 Lê e valida token (exp em segundos, se existir) */
function getValidToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (payload?.exp && Date.now() >= payload.exp * 1000) {
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
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach((p) => out.add(String(p).toLowerCase()));
        else out.add(String(u.perfil).toLowerCase());
      }
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach((p) => out.add(String(p).toLowerCase()));
        else {
          String(u.perfis).split(",").forEach((p) => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
        }
      }
    }
  } catch { /* ignore */ }

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

export default function PrivateRoute({
  children,
  permitido,
  perfilPermitido,
}) {
  const location = useLocation();
  const path = location?.pathname || "";
  const search = location?.search || "";
  const nextParam = encodeURIComponent(path + search);

  // Trate como tela de atualização: /atualizar-cadastro e /perfil
  const isAtualizarCadastro = path === "/atualizar-cadastro" || path === "/perfil";

  const exigidos = useMemo(() => {
    if (Array.isArray(permitido)) return permitido;
    if (typeof perfilPermitido === "string" && perfilPermitido.trim()) return [perfilPermitido];
    return [];
  }, [permitido, perfilPermitido]);

  const perfisUsuario = useMemo(() => getPerfisRobusto(), []);
  const [checandoPerfil, setChecandoPerfil] = useState(true);
  const [perfilIncompleto, setPerfilIncompleto] = useState(() => {
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });
  const firstLoadRef = useRef(true);

  const token = getValidToken();
  const autorizado = temAcesso(perfisUsuario, exigidos);

  // 🔎 Checagem do perfil incompleto (NUNCA faz logout por 401 aqui)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) {
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
        DEBUG && console.log("[PR] Consultando /perfil/me (on401:silent)...");
        const me = await apiPerfilMe({ on401: "silent", on403: "silent" });
        if (!alive) return;
        setPerfilIncompleto(!!me?.perfil_incompleto);
        DEBUG && console.log("[PR] Perfil incompleto? →", !!me?.perfil_incompleto, me);
      } catch (e) {
        DEBUG && console.warn("[PR] Falha ao consultar perfil (ignorada p/ redirect):", e?.message || e);
      } finally {
        if (alive) {
          setChecandoPerfil(false);
          firstLoadRef.current = false;
        }
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // ─────────────────────────────
  // Decisões (com logs)
  // ─────────────────────────────
  if (!token) {
    DEBUG && console.warn(`[PR] Redirect → /login (motivo: sem token) ao acessar "${path}"`);
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  if (!autorizado) {
    DEBUG && console.warn("[PR] Redirect → /dashboard (motivo: sem perfil exigido)", { exigidos, perfisUsuario });
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

  // Perfil incompleto → força atualização (marca forced:true)
  if (perfilIncompleto === true && !isAtualizarCadastro) {
    DEBUG && console.warn("[PR] Redirect → /perfil (motivo: perfil incompleto) a partir de", path);
    const from = location;
    return <Navigate to="/perfil" replace state={{ from, forced: true }} />;
  }

  // Já na tela de atualização e perfil ficou OK:
  // só volta para a origem se a navegação foi "forçada".
  if (isAtualizarCadastro && perfilIncompleto === false && location.state?.forced) {
    const prev = location.state?.from?.pathname || "/";
    DEBUG && console.log("[PR] Perfil completo — voltar para origem forçada:", prev);
    return <Navigate to={prev} replace />;
  }

  DEBUG && console.log("[PR] OK: render children para", path);
  return children;
}
