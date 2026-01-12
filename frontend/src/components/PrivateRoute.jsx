// 📁 src/components/PrivateRoute.jsx — NO-SPINNER / NO-BLOCK
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : false;

const FETCH_TIMEOUT_MS = 8000; // safety

const log  = (...a) => DEBUG && console.log("[PR]", ...a);
const warn = (...a) => DEBUG && console.warn("[PR]", ...a);

/* ===== Helpers ===== */
function safeAtob(b64){ try { return atob(b64); } catch { return ""; } }
function decodeJwtPayload(token){
  try{
    const [,payloadB64Url] = String(token||"").split(".");
    if(!payloadB64Url) return null;
    let b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    while(b64.length % 4 !== 0) b64 += "=";
    const json = safeAtob(b64);
    return json ? JSON.parse(json) : null;
  } catch { return null; }
}
function getValidToken(){
  let token = localStorage.getItem("token");
  if(!token) return null;
  if(token.startsWith("Bearer ")) token = token.slice(7).trim();
  const payload = decodeJwtPayload(token);
  const now = Date.now()/1000;
  if(payload?.nbf && now < payload.nbf) { warn("Token ainda não válido (nbf)"); return null; }
  if(payload?.exp && now >= payload.exp){
    // limpa somente chaves de auth
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("perfil");
    sessionStorage.removeItem("perfil_incompleto");
    warn("Token expirado — sessão limpa");
    return null;
  }
  return token;
}
function normalizarLista(v){
  if(!v) return [];
  if(Array.isArray(v)) return v.map(s=>String(s).trim()).filter(Boolean);
  return String(v).split(",").map(s=>s.replace(/[\[\]"]/g,"").trim()).filter(Boolean);
}
function getPerfisRobusto(){
  const out = new Set();
  const rawPerfil = localStorage.getItem("perfil");
  if(rawPerfil) for(const p of normalizarLista(rawPerfil)) out.add(p.toLowerCase());
  try{
    const rawUser = localStorage.getItem("usuario");
    if(rawUser){
      const u = JSON.parse(rawUser);
      const push = (val)=>normalizarLista(val).forEach(p=>out.add(p.toLowerCase()));
      push(u?.perfil); push(u?.perfis); push(u?.roles);
    }
  }catch{}
  if(out.size===0) out.add("usuario");
  return Array.from(out);
}
function temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }){
  if(predicate && typeof predicate==="function") return !!predicate(perfisUsuario);
  const setUser = new Set(perfisUsuario.map(p=>String(p).toLowerCase()));
  if(setUser.has("administrador")) return true;
  if(exigidosAll?.length && !exigidosAll.every(p=>setUser.has(String(p).toLowerCase()))) return false;
  if(!exigidosAny?.length) return true;
  return exigidosAny.some(p=>setUser.has(String(p).toLowerCase()));
}
function pathMatches(pathname, arr){
  return (arr||[]).some(r => pathname===r || pathname.startsWith(r + "/"));
}

/* ===== Componente ===== */
export default function PrivateRoute({
  children,
  permitido,
  permitidoAll,
  perfilPermitido,
  publicPaths = ["/", "/login", "/registro", "/sobre", "/contato"],
  perfilIsentos = ["/perfil", "/atualizar-cadastro", "/usuario/manual", "/manual", "/ajuda"],
  exigirCompleto = true,
}){
  const location   = useLocation();
  const path       = location?.pathname || "";
  const search     = location?.search   || "";
  const nextParam  = encodeURIComponent(path + search);

  const isPublic   = useMemo(()=>pathMatches(path, publicPaths),  [path, publicPaths]);
  const isIsento   = useMemo(()=>pathMatches(path, perfilIsentos), [path, perfilIsentos]);

  const { exigidosAny, exigidosAll, predicate } = useMemo(()=>{
    if(typeof permitido === "function"){
      return { exigidosAny: [], exigidosAll: normalizarLista(permitidoAll), predicate: permitido };
    }
    const any = normalizarLista(permitido).concat(normalizarLista(perfilPermitido));
    const all = normalizarLista(permitidoAll);
    return { exigidosAny: any, exigidosAll: all, predicate: null };
  }, [permitido, permitidoAll, perfilPermitido]);

  const [token, setToken]               = useState(()=>getValidToken());
  const [perfisUsuario, setPerfis]      = useState(()=>getPerfisRobusto());
  const [sessaoValida, setSessaoValida] = useState(false);

  // null = desconhecido; true/false = conhecido
  const [perfilIncompleto, setPerfilIncompleto] = useState(()=>{
    const f = getPerfilIncompletoFlag();
    return f === null ? null : !!f;
  });

  // controles internos
  const inflightRef = useRef(false);
  const fetchIdRef  = useRef(0);

  const autorizado = useMemo(
    ()=>temAcesso({ perfisUsuario, exigidosAny, exigidosAll, predicate }),
    [perfisUsuario, exigidosAny, exigidosAll, predicate]
  );

  // sync storage/auth uma vez
  useOnceEffect(()=>{
    const sync = () => {
      setToken(getValidToken());
      setPerfis(getPerfisRobusto());
    };
    const onStorage = (e)=>{ if(!e.key || ["perfil","usuario","token"].includes(e.key)) sync(); };
    const onAuth    = ()=>sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuth);
    return ()=>{ window.removeEventListener("storage", onStorage); window.removeEventListener("auth:changed", onAuth); };
  }, []);

  // broadcast da flag
  useOnceEffect(()=>{
    const unsub = subscribePerfilFlag(next => setPerfilIncompleto(next));
    return unsub;
  }, []);

  // ao mudar de rota, sincroniza token/perfis (barato)
  useEffect(()=>{
    setToken(getValidToken());
    setPerfis(getPerfisRobusto());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // checar /perfil/me em background (sem travar UI)
  const checarPerfilMe = useCallback(async (mode)=>{
    if(inflightRef.current) return;
    inflightRef.current = true;

    const myId = ++fetchIdRef.current;
    const ac   = new AbortController();
    let tId;

    try{
      const timeout = new Promise((_,rej)=>{
        tId = setTimeout(()=>{ try{ac.abort();}catch{}; rej(new Error("timeout")); }, FETCH_TIMEOUT_MS);
      });

      const me = await Promise.race([
        apiPerfilMe({ on401:"silent", on403:"silent", signal: ac.signal }),
        timeout,
      ]);

      if(myId !== fetchIdRef.current) return;

      if(me && typeof me === "object"){
        setSessaoValida(true);
        // undefined → false (considera completo)
        setPerfilIncompleto(!!me?.perfil_incompleto);

        const possiveis = []
          .concat(normalizarLista(me?.perfil))
          .concat(normalizarLista(me?.perfis))
          .concat(normalizarLista(me?.roles))
          .map(p=>p.toLowerCase());

        if(possiveis.length) {
          setPerfis(prev => Array.from(new Set([...prev, ...possiveis])));
        }
      }
    } catch(e){
      // não faz nada: segue em modo otimista
      if(e?.message !== "timeout" && e?.name !== "AbortError") warn("perfil/me falhou:", e?.message || e);
    } finally {
      clearTimeout(tId);
      inflightRef.current = false;
    }
  }, []);

  // **NUNCA** bloqueia render: só dispara checagens quando necessário
  useEffect(()=>{
    const tk = token;

    if(isPublic) return;

    if(!tk){
      if(!sessaoValida) void checarPerfilMe("cookie");
      return;
    }

    if(exigirCompleto && perfilIncompleto === null){
      void checarPerfilMe("token");
    }
  }, [token, isPublic, exigirCompleto, perfilIncompleto, sessaoValida, checarPerfilMe]);

  /* ===== Decisões que realmente redirecionam ===== */

  // 1) Rota privada sem token e sem sessão cookie → /login
  if(!token && !sessaoValida && !isPublic){
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização por perfil/role
  if(!autorizado){
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Perfil incompleto confirmado → força completar (exceto rotas isentas)
  if(exigirCompleto && perfilIncompleto === true && !isIsento){
    return <Navigate to="/perfil" replace state={{ from: location, forced: true }} />;
  }

  // ✅ Render otimista SEM overlay
  return children;
}
