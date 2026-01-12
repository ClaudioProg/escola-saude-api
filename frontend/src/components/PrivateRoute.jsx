// 📁 src/components/PrivateRoute.jsx — FAILSAFE (sem loop de spinner)
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiPerfilMe, getPerfilIncompletoFlag, subscribePerfilFlag } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* === Debug control === */
const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_DEBUG_PRIVATE_ROUTE
    ? String(import.meta.env.VITE_DEBUG_PRIVATE_ROUTE) === "true"
    : false;

const FETCH_TIMEOUT_MS = 8000;      // tempo máx. da chamada /perfil/me
const SPINNER_MAX_MS   = 3000;      // spinner nunca passa de 3s
const MAX_CONSEC_TIMEOUTS = 2;      // depois disso, não tentamos mais bloquear render

const log  = (...a) => DEBUG && console.log("[PR]", ...a);
const warn = (...a) => DEBUG && console.warn("[PR]", ...a);

/* === Helpers JWT === */
function safeAtob(b64){try{return atob(b64);}catch{return"";}}
function decodeJwtPayload(token){
  try{
    const[,payloadB64Url]=String(token||"").split(".");
    if(!payloadB64Url)return null;
    let b64=payloadB64Url.replace(/-/g,"+").replace(/_/g,"/");
    while(b64.length%4!==0)b64+="=";
    const json=safeAtob(b64);
    return json?JSON.parse(json):null;
  }catch{return null;}
}
function getValidToken(){
  let token=localStorage.getItem("token");
  if(!token) return null;
  if(token.startsWith("Bearer ")) token=token.slice(7).trim();
  const payload=decodeJwtPayload(token);
  const now=Date.now()/1000;
  if(payload?.nbf && now<payload.nbf){ warn("Token ainda não válido (nbf)"); return null; }
  if(payload?.exp && now>=payload.exp){
    warn("Token expirado — limpando sessão");
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("perfil");
    sessionStorage.removeItem("perfil_incompleto");
    return null;
  }
  return token;
}

/* === Helpers perfis === */
function normalizarLista(input){
  if(!input) return [];
  if(Array.isArray(input)) return input.map(p=>String(p).trim()).filter(Boolean);
  return String(input).split(",").map(p=>p.replace(/[\[\]"]/g,"").trim()).filter(Boolean);
}
function getPerfisRobusto(){
  const out=new Set();
  const rawPerfil=localStorage.getItem("perfil");
  if(rawPerfil) for(const p of normalizarLista(rawPerfil)) out.add(p.toLowerCase());
  try{
    const rawUser=localStorage.getItem("usuario");
    if(rawUser){
      const u=JSON.parse(rawUser);
      const pushAll=(val)=>normalizarLista(val).forEach(p=>out.add(p.toLowerCase()));
      pushAll(u?.perfil); pushAll(u?.perfis); pushAll(u?.roles);
    }
  }catch{}
  if(out.size===0) out.add("usuario");
  return Array.from(out);
}
function temAcesso({perfisUsuario, exigidosAny, exigidosAll, predicate}){
  if(predicate && typeof predicate==="function") return !!predicate(perfisUsuario);
  const setUser=new Set(perfisUsuario.map(p=>String(p).toLowerCase()));
  if(setUser.has("administrador")) return true;
  if(exigidosAll?.length){
    const allOk=exigidosAll.every(p=>setUser.has(String(p).toLowerCase()));
    if(!allOk) return false;
  }
  if(!exigidosAny?.length) return true;
  return exigidosAny.some(p=>setUser.has(String(p).toLowerCase()));
}
function pathMatches(pathname, arr){
  return (arr||[]).some(r=>pathname===r || pathname.startsWith(r+"/"));
}

/* === Componente === */
export default function PrivateRoute({
  children,
  permitido,
  permitidoAll,
  perfilPermitido,
  publicPaths = ["/", "/login", "/registro", "/sobre", "/contato"],
  perfilIsentos = ["/perfil", "/atualizar-cadastro", "/usuario/manual", "/manual", "/ajuda"],
  exigirCompleto = true,
}){
  const location = useLocation();
  const path     = location?.pathname || "";
  const search   = location?.search || "";
  const nextParam = encodeURIComponent(path + search);

  const isRotaPublica     = useMemo(()=>pathMatches(path, publicPaths), [path, publicPaths]);
  const isRotaExentaPerfil= useMemo(()=>pathMatches(path, perfilIsentos), [path, perfilIsentos]);

  const { exigidosAny, exigidosAll, predicate } = useMemo(()=>{
    if(typeof permitido==="function"){
      return {exigidosAny:[], exigidosAll:normalizarLista(permitidoAll), predicate:permitido};
    }
    const any = normalizarLista(permitido).concat(normalizarLista(perfilPermitido));
    const all = normalizarLista(permitidoAll);
    return {exigidosAny:any, exigidosAll:all, predicate:null};
  }, [permitido, permitidoAll, perfilPermitido]);

  const [token, setToken]                 = useState(()=>getValidToken());
  const [perfisUsuario, setPerfisUsuario] = useState(()=>getPerfisRobusto());

  const [sessaoValida, setSessaoValida]           = useState(false);
  const [perfilIncompleto, setPerfilIncompleto]   = useState(()=>{
    const f=getPerfilIncompletoFlag();
    return f===null? null : !!f;
  });

  const [checandoPerfil, setChecandoPerfil]       = useState(false);
  const [timeoutsSeguidos, setTimeoutsSeguidos]   = useState(0);

  const spinnerStartRef = useRef(0);
  const inflightRef     = useRef(false);
  const fetchIdRef      = useRef(0);

  const autorizado = useMemo(
    ()=>temAcesso({perfisUsuario, exigidosAny, exigidosAll, predicate}),
    [perfisUsuario, exigidosAny, exigidosAll, predicate]
  );

  /* sync básicos */
  useOnceEffect(()=>{
    const sync=()=>{
      log("sync storage/auth");
      setToken(getValidToken());
      setPerfisUsuario(getPerfisRobusto());
    };
    const onStorage=(e)=>{ if(!e.key || ["perfil","usuario","token"].includes(e.key)) sync(); };
    const onAuthChanged=()=>sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:changed", onAuthChanged);
    return ()=>{ window.removeEventListener("storage", onStorage); window.removeEventListener("auth:changed", onAuthChanged); };
  }, []);

  useOnceEffect(()=>{
    const unsub = subscribePerfilFlag((next)=>{
      log("perfil:flag →", next);
      setPerfilIncompleto(next);
    });
    return unsub;
  }, []);

  useEffect(()=>{
    setToken(getValidToken());
    setPerfisUsuario(getPerfisRobusto());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /* Checagem com timeout + single-flight */
  const checarPerfilMe = useCallback(async (mode)=>{
    if(inflightRef.current){ log("skip inflight"); return; }
    inflightRef.current = true;
    const myFetchId = ++fetchIdRef.current;

    const ac = new AbortController();
    let tId;

    setChecandoPerfil(true);
    spinnerStartRef.current = performance.now();

    try{
      log(`GET /perfil/me (mode=${mode})`);
      const timeoutPromise = new Promise((_,rej)=>{
        tId=setTimeout(()=>{
          try{ ac.abort(); }catch{}
          rej(new Error("timeout"));
        }, FETCH_TIMEOUT_MS);
      });

      const me = await Promise.race([
        apiPerfilMe({ on401:"silent", on403:"silent", signal: ac.signal }),
        timeoutPromise,
      ]);

      if(myFetchId!==fetchIdRef.current) return;

      if(me && typeof me==="object"){
        setSessaoValida(true);
        setPerfilIncompleto(!!me?.perfil_incompleto);
        setTimeoutsSeguidos(0);

        const possiveis=[]
          .concat(normalizarLista(me?.perfil))
          .concat(normalizarLista(me?.perfis))
          .concat(normalizarLista(me?.roles))
          .map(p=>p.toLowerCase());

        if(possiveis.length){
          setPerfisUsuario(prev=>Array.from(new Set([...prev, ...possiveis])));
        }
        log("OK /perfil/me", { perfil_incompleto: !!me?.perfil_incompleto, perfis: possiveis });
      }else{
        log("sem objeto me (provável sem cookie válido)");
      }
    }catch(e){
      if(e?.message==="timeout"){
        warn("timeout /perfil/me");
        setTimeoutsSeguidos(n=>n+1);
      }else if(e?.name!=="AbortError"){
        warn("falha /perfil/me:", e?.message || e);
      }
    }finally{
      clearTimeout(tId);
      if(myFetchId===fetchIdRef.current) setChecandoPerfil(false);
      inflightRef.current=false;
    }
  }, []);

  /* Disparos controlados */
  useEffect(()=>{
    const tk = token;

    if(isRotaPublica){ setChecandoPerfil(false); return; }

    if(!tk){
      if(!sessaoValida && timeoutsSeguidos < MAX_CONSEC_TIMEOUTS){
        void checarPerfilMe("cookie");
      }else{
        setChecandoPerfil(false);
      }
      return;
    }

    if(!exigirCompleto){ setChecandoPerfil(false); return; }

    if(perfilIncompleto !== null){ setChecandoPerfil(false); return; }

    if(timeoutsSeguidos < MAX_CONSEC_TIMEOUTS){
      void checarPerfilMe("token");
    }else{
      setChecandoPerfil(false); // não tenta mais bloquear render
    }
  }, [token, isRotaPublica, exigirCompleto, perfilIncompleto, sessaoValida, checarPerfilMe, timeoutsSeguidos]);

  /* ===== Decisões de render ===== */

  // 1) Sem token e sem sessão → públicas liberadas, privadas → login
  if(!token && !sessaoValida){
    if(isRotaPublica) return children;
    return <Navigate to={`/login?next=${nextParam}`} replace state={{ from: location }} />;
  }

  // 2) Autorização por perfil/role
  if(!autorizado){
    return <Navigate to="/dashboard" replace />;
  }

  // 3) Spinner: nunca por mais de 3s (failsafe)
  const spinnerTooLong =
    checandoPerfil &&
    spinnerStartRef.current &&
    performance.now() - spinnerStartRef.current > SPINNER_MAX_MS;

  if(exigirCompleto && checandoPerfil && perfilIncompleto === null && !spinnerTooLong){
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
  if(exigirCompleto && !isRotaExentaPerfil && perfilIncompleto === true){
    return <Navigate to="/perfil" replace state={{ from: location, forced: true }} />;
  }

  // 5) Voltando da tela de perfil forçado
  if((path==="/perfil" || path==="/atualizar-cadastro") && exigirCompleto && perfilIncompleto===false && location.state?.forced){
    const prev = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={prev} replace />;
  }

  // ✅ Fallback otimista: renderiza a rota mesmo sem a flag (SWR)
  return children;
}
