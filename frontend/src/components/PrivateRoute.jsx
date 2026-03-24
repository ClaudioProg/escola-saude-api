// 📁 src/components/PrivateRoute.jsx — PREMIUM (compatível com api.js fetch façade)

import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
    return value.map((p) => String(p || "").trim().toLowerCase()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean);
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

  useEffect(() => {
    let active = true;

    async function verificarSessao() {
      const token = getStoredToken();

      if (!token) {
        if (active) setStatus("unauthenticated");
        return;
      }

      try {
        const data = await api.authMe({
          on401: "silent",
          on403: "silent",
        });

        if (!active) return;

        if (data?.usuario) {
          setUsuario(data.usuario);
          setStatus("authenticated");
          return;
        }

        api.clearSession();
        setStatus("unauthenticated");
      } catch (error) {
        if (!active) return;

        api.clearSession();
        setStatus("unauthenticated");
      }
    }

    verificarSessao();

    const handleAuthChanged = () => {
      verificarSessao();
    };

    window.addEventListener("auth:changed", handleAuthChanged);

    return () => {
      active = false;
      window.removeEventListener("auth:changed", handleAuthChanged);
    };
  }, []);

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