// 📁 src/hooks/useEscolaTheme.js — PREMIUM++
// - Fonte única: src/theme/escolaTheme.js
// - Resolve bug “só muda tema no F5” (mesma aba) via CustomEvent
// - Sincroniza entre abas via storage event
// - “system” acompanha o SO em tempo real
// - SSR-safe, StrictMode-safe
// - Evita listeners recriados desnecessariamente
// - Evita reaplicações redundantes

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  getEffectiveTheme,
  watchSystemTheme,
  getStoredTheme,
  setStoredTheme,
} from "../theme/escolaTheme";

/**
 * Evento padrão do projeto para broadcast de tema (mesma aba).
 * Deve ser disparado pelo motor (escolaTheme.js) quando tema mudar.
 */
const THEME_EVENT = "escola-theme-change";

const VALID = new Set(["light", "dark", "system"]);

function normalizeTheme(v) {
  const t = String(v || "").toLowerCase();
  return VALID.has(t) ? t : "system";
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export default function useEscolaTheme() {
  // SSR-safe init
  const [theme, _setTheme] = useState(() =>
    normalizeTheme(getStoredTheme() || "system")
  );

  // refs para evitar closures antigas e loops
  const themeRef = useRef(theme);
  const lastAppliedRef = useRef(null);
  const systemUnsubRef = useRef(null);

  // mantém ref sincronizada com o state atual
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  /**
   * Aplica no DOM + persiste apenas se necessário.
   * Evita duplicidade em StrictMode e eventos em cascata.
   */
  const commitTheme = useCallback((nextTheme) => {
    const normalized = normalizeTheme(nextTheme);

    if (lastAppliedRef.current === normalized) return;

    lastAppliedRef.current = normalized;
    applyThemeToHtml(normalized);
    setStoredTheme(normalized);
  }, []);

  /**
   * Setter premium:
   * - normaliza
   * - ignora se já está igual
   * - aplica e persiste imediatamente
   * - atualiza React state
   * - dispara evento de mesma aba (fallback)
   */
  const setTheme = useCallback(
    (next) => {
      const normalized = normalizeTheme(next);

      if (themeRef.current === normalized) {
        // Mesmo assim garante consistência DOM/storage
        commitTheme(normalized);
        return;
      }

      commitTheme(normalized);
      themeRef.current = normalized;
      _setTheme(normalized);

      if (canUseWindow()) {
        try {
          window.dispatchEvent(
            new CustomEvent(THEME_EVENT, {
              detail: { theme: normalized, source: "hook" },
            })
          );
        } catch {
          /* noop */
        }
      }
    },
    [commitTheme]
  );

  // 1) Ao montar: sincroniza estado React com storage/boot do HTML
  useEffect(() => {
    const stored = normalizeTheme(getStoredTheme() || "system");
    themeRef.current = stored;
    _setTheme(stored);
    commitTheme(stored);
  }, [commitTheme]);

  // 2) Quando theme mudar, garante DOM/storage e watcher do system
  useEffect(() => {
    const normalized = normalizeTheme(theme);

    commitTheme(normalized);

    // limpa watcher anterior
    if (systemUnsubRef.current) {
      systemUnsubRef.current();
      systemUnsubRef.current = null;
    }

    // acompanha SO em tempo real apenas quando "system"
    if (normalized === "system") {
      systemUnsubRef.current = watchSystemTheme(() => {
        commitTheme("system");

        if (canUseWindow()) {
          try {
            window.dispatchEvent(
              new CustomEvent(THEME_EVENT, {
                detail: { theme: "system", source: "system" },
              })
            );
          } catch {
            /* noop */
          }
        }
      });
    }

    return () => {
      if (systemUnsubRef.current) {
        systemUnsubRef.current();
        systemUnsubRef.current = null;
      }
    };
  }, [theme, commitTheme]);

  // 3) Listener: mesma aba (CustomEvent)
  useEffect(() => {
    if (!canUseWindow()) return undefined;

    const onTheme = (ev) => {
      const incoming = normalizeTheme(ev?.detail?.theme);

      if (incoming === themeRef.current) {
        commitTheme(incoming);
        return;
      }

      themeRef.current = incoming;
      _setTheme(incoming);
    };

    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, [commitTheme]);

  // 4) Listener: outras abas (storage)
  useEffect(() => {
    if (!canUseWindow()) return undefined;

    const onStorage = (e) => {
      if (e.key !== ESCOLA_THEME_KEY) return;

      const incoming = normalizeTheme(e.newValue);

      if (incoming === themeRef.current) {
        commitTheme(incoming);
        return;
      }

      themeRef.current = incoming;
      _setTheme(incoming);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commitTheme]);

  const effectiveTheme = useMemo(() => getEffectiveTheme(theme), [theme]);
  const isDark = effectiveTheme === "dark";

  return {
    theme, // "light" | "dark" | "system"
    setTheme,
    effectiveTheme, // "light" | "dark"
    isDark,
    STORAGE_KEY: ESCOLA_THEME_KEY,
    EVENT_NAME: THEME_EVENT,
  };
}