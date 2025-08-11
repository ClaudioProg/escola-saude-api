// 📁 src/components/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";

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
    console.warn("⚠️ Token expirado — limpando sessão");
    localStorage.clear();
    return null;
  }
  return token;
}

/** 👥 Coleta perfis do storage (perfil, usuario.perfil, usuario.perfis) e normaliza */
function getPerfisRobusto() {
  const out = new Set();

  // 1) chave 'perfil' (JSON array, string CSV, etc.)
  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      if (Array.isArray(parsed)) parsed.forEach(p => out.add(String(p).toLowerCase()));
      else if (typeof parsed === "string") {
        parsed.split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
      }
    } catch {
      rawPerfil.split(",").forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
    }
  }

  // 2) chave 'usuario' (objeto com perfil/perfis)
  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      // 'perfil' (string ou array)
      if (u?.perfil) {
        if (Array.isArray(u.perfil)) u.perfil.forEach(p => out.add(String(p).toLowerCase()));
        else out.add(String(u.perfil).toLowerCase());
      }
      // 'perfis' (string ou array)
      if (u?.perfis) {
        if (Array.isArray(u.perfis)) u.perfis.forEach(p => out.add(String(p).toLowerCase()));
        else {
          String(u.perfis)
            .split(",")
            .forEach(p => out.add(p.replace(/[\[\]"]/g, "").trim().toLowerCase()));
        }
      }
    }
  } catch {
    // ignore
  }

  // fallback mínimo para logado comum
  if (out.size === 0) out.add("usuario");

  return Array.from(out).filter(Boolean);
}

/** Verifica autorização: admin é superuser; senão, interseção com exigidos */
function temAcesso(perfisUsuario, perfisExigidos) {
  if (!perfisExigidos || perfisExigidos.length === 0) return true; // só exige login
  const setUser = new Set(perfisUsuario.map(p => String(p).toLowerCase()));
  if (setUser.has("administrador")) return true; // superusuário
  return perfisExigidos.some(p => setUser.has(String(p).toLowerCase()));
}

/**
 * Rota protegida que verifica autenticação e autorização por perfil.
 * Aceita `permitido={['instrutor','administrador']}` ou `perfilPermitido="administrador"`.
 */
export default function PrivateRoute({
  children,
  permitido,        // string[] | undefined
  perfilPermitido,  // string  | undefined (retrocompatibilidade)
}) {
  const location = useLocation();
  const token = getValidToken();

  // 🔎 DEBUG
  const path = location?.pathname || "";
  if (!token) {
    console.warn(`🔒 PrivateRoute: sem token — bloqueando acesso a ${path}`);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // resolve exigidos
  let exigidos = [];
  if (Array.isArray(permitido)) exigidos = permitido;
  else if (typeof perfilPermitido === "string" && perfilPermitido.trim())
    exigidos = [perfilPermitido];

  const perfisUsuario = getPerfisRobusto();
  const ok = temAcesso(perfisUsuario, exigidos);

  // 🔎 DEBUG
  console.log("🧷 PrivateRoute debug:", {
    path,
    exigidos,
    perfisUsuario,
    autorizacao: ok ? "permitido" : "negado",
  });

  if (!ok) {
    // Sem permissão → não limpar sessão; manda para um destino seguro
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
