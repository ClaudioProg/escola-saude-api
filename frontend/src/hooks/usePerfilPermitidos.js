// 📁 src/hooks/usePerfilPermitido.js — v2.0
import { useEffect, useMemo, useState } from "react";

/**
 * Hook para verificar se o usuário possui pelo menos um dos perfis permitidos.
 *
 * Uso:
 * const { temAcesso } = usePerfilPermitido(["administrador"]);
 *
 * Contrato oficial:
 * - localStorage["perfil"]
 * - evento global: "auth:changed"
 *
 * Perfis oficiais:
 * - usuario
 * - organizador
 * - administrador
 *
 * Não usar:
 * - roles
 * - role
 * - perfis
 * - admin
 */

const STORAGE_KEY_PERFIL = "perfil";
const AUTH_EVENT = "auth:changed";

const PERFIL_OFICIAL = new Set(["usuario", "organizador", "administrador"]);

function canUseWindow() {
  return typeof window !== "undefined";
}

function getSafeLocalStorage() {
  try {
    if (canUseWindow() && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // noop
  }

  return null;
}

function removerDuplicado(lista) {
  return [...new Set(lista)];
}

function normalizarPerfil(value) {
  if (!value) {
    return [];
  }

  const lista = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;,|]/g)
      : [];

  return removerDuplicado(
    lista
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function filtrarPerfilOficial(lista) {
  return normalizarPerfil(lista).filter((perfil) =>
    PERFIL_OFICIAL.has(perfil)
  );
}

function lerPerfilStorage() {
  const localStorageSafe = getSafeLocalStorage();

  if (!localStorageSafe) {
    return [];
  }

  try {
    return filtrarPerfilOficial(localStorageSafe.getItem(STORAGE_KEY_PERFIL));
  } catch {
    return [];
  }
}

function possuiIntersecao(perfilPermitido, perfilUsuario) {
  if (!perfilPermitido.length || !perfilUsuario.length) {
    return false;
  }

  const usuarioSet = new Set(perfilUsuario);

  return perfilPermitido.some((perfil) => usuarioSet.has(perfil));
}

/**
 * @param {string[]|string} perfilPermitido
 * @param {object} options
 * @param {string[]|string} [options.perfilUsuario]
 * @returns {{
 *   temAcesso: boolean,
 *   perfilEfetivo: string[],
 *   perfilPermitido: string[]
 * }}
 */
export default function usePerfilPermitido(
  perfilPermitido = [],
  { perfilUsuario } = {}
) {
  const perfilPermitidoNormalizado = useMemo(
    () => filtrarPerfilOficial(perfilPermitido),
    [perfilPermitido]
  );

  const perfilUsuarioProp = useMemo(
    () => filtrarPerfilOficial(perfilUsuario),
    [perfilUsuario]
  );

  const [perfilStorage, setPerfilStorage] = useState(() => lerPerfilStorage());

  useEffect(() => {
    if (perfilUsuarioProp.length > 0) {
      return undefined;
    }

    setPerfilStorage(lerPerfilStorage());

    return undefined;
  }, [perfilUsuarioProp]);

  useEffect(() => {
    if (!canUseWindow()) {
      return undefined;
    }

    const atualizarPerfil = () => {
      if (perfilUsuarioProp.length > 0) {
        return;
      }

      setPerfilStorage(lerPerfilStorage());
    };

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY_PERFIL) {
        return;
      }

      atualizarPerfil();
    };

    window.addEventListener(AUTH_EVENT, atualizarPerfil);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_EVENT, atualizarPerfil);
      window.removeEventListener("storage", onStorage);
    };
  }, [perfilUsuarioProp]);

  const perfilEfetivo = useMemo(() => {
    return perfilUsuarioProp.length > 0 ? perfilUsuarioProp : perfilStorage;
  }, [perfilUsuarioProp, perfilStorage]);

  const temAcesso = useMemo(() => {
    return possuiIntersecao(perfilPermitidoNormalizado, perfilEfetivo);
  }, [perfilPermitidoNormalizado, perfilEfetivo]);

  return {
    temAcesso,
    perfilEfetivo,
    perfilPermitido: perfilPermitidoNormalizado,
  };
}