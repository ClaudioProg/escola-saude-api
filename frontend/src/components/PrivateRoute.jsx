// 📁 src/components/PrivateRoute.jsx — PREMIUM
// - anti-loop
// - verificação de sessão robusta
// - compatível com api.js fetch façade
// - evita revalidação desnecessária a cada pathname
// - logs estratégicos
// - redirect seguro com next
// - controle de permissões mais previsível

import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

function buildNextFromLocation(location) {
  const pathname = location?.pathname || "/painel";
  const search = location?.search || "";
  const hash = location?.hash || "";
  return `${pathname}${search}${hash}`;
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
  const lastVerifiedTokenRef = useRef(null);

  const aplicarSessaoInvalida = useCallback((origem, extra = {}) => {
    if (!mountedRef.current) return;

    logDev("sessão inválida", { origem, ...extra });
    setUsuario(null);
    setStatus("unauthenticated");
  }, []);

  const aplicarSessaoValida = useCallback((usuarioRecebido, origem, extra = {}) => {
    if (!mountedRef.current) return;

    logDev("sessão válida", {
      origem,
      perfil: usuarioRecebido?.perfil,
      usuarioId: usuarioRecebido?.id || usuarioRecebido?.usuario_id || null,
      ...extra,
    });

    setUsuario(usuarioRecebido);
    setStatus("authenticated");
  }, []);

  const verificarSessao = useCallback(
    async (origem = "manual", options = {}) => {
      if (!mountedRef.current) return;

      const token = getStoredToken();
      const force = Boolean(options?.force);

      if (!token) {
        aplicarSessaoInvalida(origem, { reason: "sem_token" });
        lastVerifiedTokenRef.current = null;
        return;
      }

      if (!force && status === "authenticated" && lastVerifiedTokenRef.current === token) {
        logDev("verificação reaproveitada", {
          origem,
          pathname: location.pathname,
        });
        return;
      }

      if (inFlightRef.current) {
        logDev("verificação ignorada porque já existe request em andamento", {
          origem,
          pathname: location.pathname,
        });
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      inFlightRef.current = true;

      logDev("verificando sessão", {
        origem,
        currentRequestId,
        pathname: location.pathname,
        force,
      });

      try {
        const data = await api.authMe({
          on401: "silent",
          on403: "silent",
        });

        if (!mountedRef.current) return;

        if (currentRequestId !== requestIdRef.current) {
          logDev("resposta antiga descartada", {
            origem,
            currentRequestId,
          });
          return;
        }

        const usuarioRecebido = data?.usuario || data?.user || null;

        if (!usuarioRecebido || typeof usuarioRecebido !== "object") {
          aplicarSessaoInvalida(origem, {
            currentRequestId,
            reason: "payload_sem_usuario",
          });
          lastVerifiedTokenRef.current = null;
          return;
        }

        lastVerifiedTokenRef.current = token;
        aplicarSessaoValida(usuarioRecebido, origem, { currentRequestId });
      } catch (error) {
        if (!mountedRef.current) return;

        if (currentRequestId !== requestIdRef.current) {
          logDev("erro de request antiga descartado", {
            origem,
            currentRequestId,
          });
          return;
        }

        errorDev("falha ao verificar sessão", {
          origem,
          currentRequestId,
          message: error?.message,
          status: error?.status || error?.response?.status || null,
        });

        lastVerifiedTokenRef.current = null;
        aplicarSessaoInvalida(origem, {
          currentRequestId,
          reason: "auth_me_error",
        });
      } finally {
        if (currentRequestId === requestIdRef.current) {
          inFlightRef.current = false;
        }
      }
    },
    [aplicarSessaoInvalida, aplicarSessaoValida, location.pathname, status]
  );

  useEffect(() => {
    mountedRef.current = true;
    verificarSessao("mount", { force: true });

    const handleAuthChanged = () => {
      if (!mountedRef.current) return;

      if (authChangedTimerRef.current) {
        window.clearTimeout(authChangedTimerRef.current);
      }

      authChangedTimerRef.current = window.setTimeout(() => {
        verificarSessao("auth:changed", { force: true });
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
  }, [verificarSessao]);

  if (status === "checking") {
    return fallback || null;
  }

  if (status === "unauthenticated") {
    const next = encodeURIComponent(buildNextFromLocation(location));

    logDev("redirect para login", {
      pathname: location.pathname,
      next,
    });

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
      logDev("acesso negado por perfil", {
        pathname: location.pathname,
        perfisUsuario,
        permitido: permitidoNormalizado,
      });

      return <Navigate to="/painel" replace />;
    }
  }

  return children;
}