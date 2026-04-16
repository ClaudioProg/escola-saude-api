import { useEffect, useMemo, useState } from "react";

/**
 * Evento interno para sincronização de perfil na mesma aba.
 * Pode ser disparado manualmente em qualquer ponto da aplicação:
 *
 * window.dispatchEvent(new CustomEvent("escola-perfil-change", {
 *   detail: { storageKey: "perfil", value: "administrador,usuario" }
 * }));
 */
const PERFIL_EVENT = "escola-perfil-change";

/**
 * localStorage SSR-safe.
 */
function getSafeLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* noop */
  }

  return null;
}

/**
 * Normaliza perfis para array em lowercase, sem vazios.
 */
function normalizeRoles(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return [...new Set(
      input
        .map(String)
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean)
    )];
  }

  return [...new Set(
    String(input)
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)
  )];
}

/**
 * Checa interseção entre roles do usuário e permitidos.
 */
function hasAny(allowed, user) {
  if (!allowed.length || !user.length) return false;

  const userSet = new Set(user);
  return allowed.some((role) => userSet.has(role));
}

/**
 * Lê roles do localStorage com segurança.
 */
function readRolesFromStorage(storageKey) {
  const ls = getSafeLocalStorage();
  if (!ls) return [];

  try {
    return normalizeRoles(ls.getItem(storageKey));
  } catch {
    return [];
  }
}

/**
 * Hook para verificar se o usuário logado possui pelo menos um dos perfis permitidos.
 *
 * Prioridade da origem dos perfis:
 *   1) prop `userRoles`
 *   2) localStorage[storageKey]
 *
 * @param {string[]|string} perfilPermitidos
 * @param {object} options
 * @param {string[]|string} [options.userRoles]
 * @param {string} [options.storageKey="perfil"]
 * @returns {{
 *   temAcesso: boolean,
 *   carregando: boolean,
 *   rolesEfetivos: string[],
 *   allowedRoles: string[],
 *   source: "prop" | "storage"
 * }}
 */
export default function usePerfilPermitidos(
  perfilPermitidos = [],
  { userRoles, storageKey = "perfil" } = {}
) {
  const allowedRoles = useMemo(
    () => normalizeRoles(perfilPermitidos),
    [perfilPermitidos]
  );

  const propRoles = useMemo(
    () => normalizeRoles(userRoles),
    [userRoles]
  );

  const [storageRoles, setStorageRoles] = useState(() =>
    readRolesFromStorage(storageKey)
  );

  // sincroniza quando a chave do storage mudar
  useEffect(() => {
    if (propRoles.length > 0) return;
    setStorageRoles(readRolesFromStorage(storageKey));
  }, [storageKey, propRoles]);

  // sincroniza entre abas/janelas
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onStorage = (ev) => {
      if (ev.key !== storageKey) return;
      if (propRoles.length > 0) return;

      setStorageRoles(normalizeRoles(ev.newValue));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, propRoles]);

  // sincroniza na mesma aba
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onPerfilChange = (ev) => {
      const detail = ev?.detail || {};
      const eventStorageKey = detail.storageKey || "perfil";

      if (eventStorageKey !== storageKey) return;
      if (propRoles.length > 0) return;

      setStorageRoles(normalizeRoles(detail.value));
    };

    window.addEventListener(PERFIL_EVENT, onPerfilChange);
    return () => window.removeEventListener(PERFIL_EVENT, onPerfilChange);
  }, [storageKey, propRoles]);

  const source = propRoles.length > 0 ? "prop" : "storage";

  const rolesEfetivos = useMemo(() => {
    return propRoles.length > 0 ? propRoles : storageRoles;
  }, [propRoles, storageRoles]);

  const temAcesso = useMemo(() => {
    try {
      return hasAny(allowedRoles, rolesEfetivos);
    } catch (err) {
      console.error("[usePerfilPermitidos] Falha ao avaliar acesso:", err);
      return false;
    }
  }, [allowedRoles, rolesEfetivos]);

  /**
   * Aqui não existe carregamento assíncrono real.
   * Mantemos `carregando` por compatibilidade com o restante do front.
   */
  const carregando = false;

  return {
    temAcesso,
    carregando,
    rolesEfetivos,
    allowedRoles,
    source,
  };
}

export { PERFIL_EVENT };