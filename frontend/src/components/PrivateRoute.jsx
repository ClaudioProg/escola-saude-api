// 📁 src/components/PrivateRoute.jsx — PREMIUM (anti-loop + robusto + compatível com api.js fetch façade)

import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token") ||
    null
  );
}

function normalizePerfis(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((p) => String(p || "").trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean);
}

function logDev(...args) {
  if (import.meta.env.DEV) {
    console.log("[PrivateRoute]", ...args);
  }
}

function errorDev(...args) {
  if (import.meta.env.DEV) {
    console.error("[PrivateRoute]", ...args);
  }
}

export default function PrivateRoute({
  children,
  permitido = [],
  fallback = null,
}) {
  const location = useLocation();

  const [status, setStatus] = useState("checking");
  const [usuario, setUsuario] = useState(null);

  const permitidoNormalizado = useMemo(
    () => normalizePerfis(permitido),
    [permitido]
  );

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const authChangedTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    async function verificarSessao(origem = "init") {
      if (!mountedRef.current) return;

      const token = getStoredToken();

      if (!token) {
        logDev("sem token → unauthenticated", { origem });
        if (!mountedRef.current) return;
        setUsuario(null);
        setStatus("unauthenticated");
        return;
      }

      if (inFlightRef.current) {
        logDev("verificação ignorada porque já existe request em andamento", { origem });
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      inFlightRef.current = true;

      logDev("verificando sessão", {
        origem,
        currentRequestId,
        pathname: location.pathname,
      });

      try {
        const data = await api.authMe({
          on401: "silent",
          on403: "silent",
        });

        if (!mountedRef.current) return;
        if (currentRequestId !== requestIdRef.current) {
          logDev("resposta antiga descartada", { origem, currentRequestId });
          return;
        }

        const usuarioRecebido = data?.usuario || data?.user || null;

        if (usuarioRecebido) {
          setUsuario(usuarioRecebido);
          setStatus("authenticated");

          logDev("sessão válida", {
            origem,
            currentRequestId,
            perfil: usuarioRecebido?.perfil,
          });
          return;
        }

        logDev("sessão inválida: payload sem usuário", { origem, currentRequestId });
        setUsuario(null);
        setStatus("unauthenticated");
      } catch (error) {
        if (!mountedRef.current) return;
        if (currentRequestId !== requestIdRef.current) {
          logDev("erro de request antiga descartado", { origem, currentRequestId });
          return;
        }

        errorDev("falha ao verificar sessão", {
          origem,
          currentRequestId,
          message: error?.message,
        });

        setUsuario(null);
        setStatus("unauthenticated");
      } finally {
        if (currentRequestId === requestIdRef.current) {
          inFlightRef.current = false;
        }
      }
    }

    verificarSessao("mount");

    const handleAuthChanged = () => {
      if (!mountedRef.current) return;

      if (authChangedTimerRef.current) {
        window.clearTimeout(authChangedTimerRef.current);
      }

      authChangedTimerRef.current = window.setTimeout(() => {
        verificarSessao("auth:changed");
      }, 80);
    };

    window.addEventListener("auth:changed", handleAuthChanged);

    return () => {
      mountedRef.current = false;

      if (authChangedTimerRef.current) {
        window.clearTimeout(authChangedTimerRef.current);
      }

      window.removeEventListener("auth:changed", handleAuthChanged);
    };
  }, [location.pathname]);

  if (status === "checking") {
    return fallback || null;
  }

  if (status === "unauthenticated") {
    const next = encodeURIComponent(
      `${location.pathname || "/painel"}${location.search || ""}`
    );

    return (
      <Navigate
        to={`/login?next=${next}`}
        replace
        state={{ from: location }}
      />
    );
  }

  if (permitidoNormalizado.length > 0) {
    const perfisUsuario = normalizePerfis(usuario?.perfil);
    const isAdmin = perfisUsuario.includes("administrador");

    const autorizado =
      isAdmin ||
      permitidoNormalizado.some((perfil) => perfisUsuario.includes(perfil));

    if (!autorizado) {
      return <Navigate to="/painel" replace />;
    }
  }

  return children;
}