// ✅ src/components/layout/PrivateRoute.jsx — v2.0
// Plataforma Escola da Saúde
//
// Rota privada oficial.
//
// Função:
// - proteger rotas privadas do frontend;
// - validar sessão oficial via apiPerfilMe();
// - redirecionar usuário sem sessão para /login?next=...;
// - controlar acesso por perfil quando a rota exigir.
//
// Contrato oficial único:
// - localStorage.token
// - localStorage.perfil
// - API: apiPerfilMe()
//
// Perfil:
// - perfil.perfil deve ser string oficial exata;
// - administrador é o perfil oficial com acesso total;
// - não aceitar aliases;
// - não aceitar roles;
// - não aceitar perfis;
// - não aceitar arrays vindos do backend;
// - não aceitar lista separada por vírgula;
// - não normalizar para tentar corrigir contrato quebrado;
// - se o backend entregar formato incorreto, a sessão é considerada inválida.
//
// Uso oficial:
// <PrivateRoute permitido={["administrador"]}>
//   <PaginaAdministrativa />
// </PrivateRoute>
//
// <PrivateRoute>
//   <ShellPrivado />
// </PrivateRoute>

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";

import { apiPerfilMe, clearAuthSession } from "../../services/api";

const STORAGE_TOKEN_KEY = "token";
const STORAGE_PERFIL_KEY = "perfil";

const PERFIL = {
  usuario: "usuario",
  organizador: "organizador",
  administrador: "administrador",
};

const STATUS = {
  verificando: "verificando",
  autenticado: "autenticado",
  nao_autenticado: "nao_autenticado",
};

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getStoredToken() {
  if (!isBrowser()) return null;

  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function limparSessaoLocal() {
  if (!isBrowser()) return;

  try {
    clearAuthSession();
  } catch {
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_PERFIL_KEY);
      window.dispatchEvent(new CustomEvent("auth:changed"));
    } catch {
      // Não bloquear redirecionamento por falha de storage.
    }
  }
}

function salvarPerfilLocal(perfil) {
  if (!isBrowser()) return false;

  try {
    const novoValor = JSON.stringify(perfil);
    const valorAtual = localStorage.getItem(STORAGE_PERFIL_KEY);

    if (valorAtual === novoValor) {
      return false;
    }

    localStorage.setItem(STORAGE_PERFIL_KEY, novoValor);
    return true;
  } catch {
    return false;
  }
}

function getPerfilData(response) {
  if (response?.data && typeof response.data === "object") {
    return response.data;
  }

  if (response && typeof response === "object") {
    return response;
  }

  return null;
}

function perfilValido(perfil) {
  return Boolean(
    perfil &&
      typeof perfil === "object" &&
      Number.isFinite(Number(perfil.id)) &&
      typeof perfil.perfil === "string" &&
      perfil.perfil.trim() === perfil.perfil &&
      Object.values(PERFIL).includes(perfil.perfil)
  );
}

function permitidoValido(permitido) {
  if (permitido == null) return true;

  if (!Array.isArray(permitido)) return false;

  return permitido.every(
    (perfil) =>
      typeof perfil === "string" &&
      perfil.trim() === perfil &&
      Object.values(PERFIL).includes(perfil)
  );
}

function perfilTemAcesso(perfil, permitido) {
  if (!permitido || permitido.length === 0) return true;

  const perfilAtual = perfil?.perfil;

  if (perfilAtual === PERFIL.administrador) {
    return true;
  }

  return permitido.includes(perfilAtual);
}

function hasCelularObrigatorio(perfil) {
  return Boolean(String(perfil?.celular || "").replace(/\D/g, ""));
}

function perfilEstaIncompleto(perfil) {
  return Boolean(perfil?.perfil_incompleto) || !hasCelularObrigatorio(perfil);
}

function buildNextFromLocation(location) {
  const pathname = location?.pathname || "/painel";
  const search = location?.search || "";
  const hash = location?.hash || "";

  return `${pathname}${search}${hash}`;
}

function logDev(...args) {
  if (import.meta.env.DEV) {
    console.info("[PrivateRoute]", ...args);
  }
}

function errorDev(...args) {
  if (import.meta.env.DEV) {
    console.error("[PrivateRoute]", ...args);
  }
}

export default function PrivateRoute({
  children,
  permitido = null,
  fallback = null,
  rotaLogin = "/login",
  rotaSemPermissao = "/painel",
}) {
  const location = useLocation();

  const [status, setStatus] = useState(STATUS.verificando);
  const [perfil, setPerfil] = useState(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const requestEmAndamentoRef = useRef(false);
  const tokenVerificadoRef = useRef(null);
  const authTimerRef = useRef(null);

  const permitidoFinal = useMemo(() => {
    if (permitido == null) return [];

    if (!permitidoValido(permitido)) {
      return null;
    }

    return permitido;
  }, [permitido]);

  const aplicarSessaoInvalida = useCallback((origem, extra = {}) => {
    if (!mountedRef.current) return;

    logDev("sessão inválida", {
      origem,
      ...extra,
    });

    limparSessaoLocal();
    tokenVerificadoRef.current = null;

    setPerfil(null);
    setStatus(STATUS.nao_autenticado);
  }, []);

const aplicarSessaoValida = useCallback((perfilRecebido, origem, extra = {}) => {
  if (!mountedRef.current) return;

  const perfilFoiAtualizado = salvarPerfilLocal(perfilRecebido);

  logDev("sessão válida", {
    origem,
    perfil_id: perfilRecebido.id,
    perfil: perfilRecebido.perfil,
    perfil_atualizado_no_storage: perfilFoiAtualizado,
    ...extra,
  });

  setPerfil((perfilAtual) => {
    if (
      perfilAtual?.id === perfilRecebido.id &&
      perfilAtual?.perfil === perfilRecebido.perfil
    ) {
      return perfilAtual;
    }

    return perfilRecebido;
  });

  setStatus((statusAtual) => {
    if (statusAtual === STATUS.autenticado) {
      return statusAtual;
    }

    return STATUS.autenticado;
  });
}, []);

  const verificarSessao = useCallback(
    async (origem = "manual", options = {}) => {
      if (!mountedRef.current) return;

      const token = getStoredToken();
      const forcar = Boolean(options?.forcar);

      if (!token) {
        aplicarSessaoInvalida(origem, {
          motivo: "sem_token",
        });
        return;
      }

      if (!forcar && tokenVerificadoRef.current === token) {
        logDev("verificação reaproveitada", {
          origem,
        });
        return;
      }

      if (requestEmAndamentoRef.current) {
        logDev("verificação ignorada: requisição em andamento", {
          origem,
        });
        return;
      }

      const requestId = requestIdRef.current + 1;

      requestIdRef.current = requestId;
      requestEmAndamentoRef.current = true;

      logDev("verificando sessão", {
        origem,
        request_id: requestId,
        forcar,
      });

      try {
        const response = await apiPerfilMe({
          on401: "silent",
          on403: "silent",
        });

        if (!mountedRef.current) return;

        if (requestId !== requestIdRef.current) {
          logDev("resposta antiga descartada", {
            origem,
            request_id: requestId,
          });
          return;
        }

        const perfilRecebido = getPerfilData(response);

        if (!perfilValido(perfilRecebido)) {
          aplicarSessaoInvalida(origem, {
            request_id: requestId,
            motivo: "payload_perfil_invalido",
          });
          return;
        }

        tokenVerificadoRef.current = token;

        aplicarSessaoValida(perfilRecebido, origem, {
          request_id: requestId,
        });
      } catch (error) {
        if (!mountedRef.current) return;

        if (requestId !== requestIdRef.current) {
          logDev("erro de requisição antiga descartado", {
            origem,
            request_id: requestId,
          });
          return;
        }

        errorDev("falha ao verificar sessão", {
          origem,
          request_id: requestId,
          mensagem: error?.message,
          status: error?.status || error?.response?.status || null,
        });

        aplicarSessaoInvalida(origem, {
          request_id: requestId,
          motivo: "perfil_me_error",
        });
      } finally {
        if (requestId === requestIdRef.current) {
          requestEmAndamentoRef.current = false;
        }
      }
    },
    [aplicarSessaoInvalida, aplicarSessaoValida]
  );

  useEffect(() => {
    mountedRef.current = true;

    verificarSessao("mount", {
      forcar: true,
    });

    function handleAuthChanged() {
      if (!mountedRef.current) return;

      if (authTimerRef.current) {
        window.clearTimeout(authTimerRef.current);
      }

      authTimerRef.current = window.setTimeout(() => {
        verificarSessao("auth:changed", {
          forcar: true,
        });
      }, 80);
    }

    function handleStorageChanged(event) {
      if (!mountedRef.current) return;
      if (event.key !== STORAGE_TOKEN_KEY) return;

      verificarSessao("storage:token", {
        forcar: true,
      });
    }

    window.addEventListener("auth:changed", handleAuthChanged);
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      mountedRef.current = false;

      if (authTimerRef.current) {
        window.clearTimeout(authTimerRef.current);
      }

      window.removeEventListener("auth:changed", handleAuthChanged);
      window.removeEventListener("storage", handleStorageChanged);
    };
  }, [verificarSessao]);

  if (status === STATUS.verificando) {
    return fallback;
  }

  if (status === STATUS.nao_autenticado) {
    const next = encodeURIComponent(buildNextFromLocation(location));

    return (
      <Navigate
        to={`${rotaLogin}?next=${next}`}
        replace
        state={{ from: location }}
      />
    );
  }

    if (perfilEstaIncompleto(perfil) && location.pathname !== "/perfil") {
    logDev("perfil incompleto: redirecionando para /perfil", {
      pathname: location.pathname,
      perfil_id: perfil?.id,
      perfil_incompleto: Boolean(perfil?.perfil_incompleto),
      celular_pendente: !hasCelularObrigatorio(perfil),
    });

    return (
      <Navigate
        to="/perfil"
        replace
        state={{ from: location, motivo: "perfil_incompleto" }}
      />
    );
  }

  if (permitidoFinal === null) {
    errorDev("Prop permitido inválida: use array com perfis oficiais.", {
      permitido,
    });

    return <Navigate to={rotaSemPermissao} replace />;
  }

  if (!perfilTemAcesso(perfil, permitidoFinal)) {
    logDev("acesso negado por perfil", {
      pathname: location.pathname,
      perfil_atual: perfil?.perfil,
      permitido: permitidoFinal,
    });

    return <Navigate to={rotaSemPermissao} replace />;
  }

  return children;
}

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
  permitido: PropTypes.arrayOf(
    PropTypes.oneOf([PERFIL.usuario, PERFIL.organizador, PERFIL.administrador])
  ),
  fallback: PropTypes.node,
  rotaLogin: PropTypes.string,
  rotaSemPermissao: PropTypes.string,
};