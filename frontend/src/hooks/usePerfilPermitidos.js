import { useEffect, useMemo, useState, useRef } from "react";

/**
 * Lê com segurança o localStorage (SSR-safe).
 */
function safeLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {}
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

/**
 * Normaliza perfis para array em lowercase, sem vazios.
 */
function normalizeRoles(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map((r) => r.trim().toLowerCase()).filter(Boolean);
  // string "admin,coordenador"
  return String(input)
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checa se há interseção entre roles do usuário e permitidos.
 */
function hasAny(allowed, user) {
  if (!allowed.length || !user.length) return false;
  const set = new Set(user);
  return allowed.some((r) => set.has(r));
}

/**
 * Hook para verificar se o usuário logado possui pelo menos um dos perfis permitidos.
 *
 * Origem dos perfis do usuário (prioridade):
 *   1) prop `userRoles` (ex.: vindo do contexto/JWT)
 *   2) localStorage[storageKey] (fallback)
 *
 * @param {string[]|string} perfilPermitidos - lista ou string separada por vírgulas.
 * @param {object} options
 * @param {string[]|string} [options.userRoles]  - roles do usuário já disponíveis na UI (opcional)
 * @param {string} [options.storageKey="perfil"] - chave do localStorage para fallback
 * @returns {{ temAcesso: boolean, carregando: boolean, rolesEfetivos: string[] }}
 */
export default function usePerfilPermitidos(
  perfilPermitidos = [],
  { userRoles, storageKey = "perfil" } = {}
) {
  const allowed = useMemo(() => normalizeRoles(perfilPermitidos), [perfilPermitidos]);
  const ls = safeLocalStorage();

  const [rolesEfetivos, setRolesEfetivos] = useState(() => {
    const fromProp = normalizeRoles(userRoles);
    if (fromProp.length) return fromProp;
    return normalizeRoles(ls.getItem(storageKey));
  });

  const [temAcesso, setTemAcesso] = useState(() => hasAny(allowed, rolesEfetivos));
  const [carregando, setCarregando] = useState(false);
  const mountedRef = useRef(false);

  // Sincroniza quando userRoles muda (tem prioridade sobre localStorage)
  useEffect(() => {
    if (!mountedRef.current) mountedRef.current = true;
    const next = normalizeRoles(userRoles);
    if (next.length) {
      setRolesEfetivos(next);
    } else {
      // fallback para localStorage
      setRolesEfetivos(normalizeRoles(ls.getItem(storageKey)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRoles, storageKey]);

  // Recalcula acesso quando allowed ou roles mudam
  useEffect(() => {
    setCarregando(true);
    try {
      setTemAcesso(hasAny(allowed, rolesEfetivos));
    } catch (err) {
      // Log enxuto e útil
      console.error("[usePerfilPermitidos] Falha ao avaliar acesso:", err);
      setTemAcesso(false);
    } finally {
      setCarregando(false);
    }
  }, [allowed, rolesEfetivos]);

  // Escuta mudanças entre abas/janelas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (ev) => {
      if (ev.key !== storageKey) return;
      // só atualiza se NÃO houver userRoles vindo de props/contexto
      const hasPropRoles = normalizeRoles(userRoles).length > 0;
      if (!hasPropRoles) {
        setRolesEfetivos(normalizeRoles(ev.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, userRoles]);

  return { temAcesso, carregando, rolesEfetivos };
}
