// 📁 src/hooks/useEscolaTheme.js — v2.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  getEffectiveTheme,
  watchSystemTheme,
  getStoredTheme,
  setStoredTheme,
} from "../theme/escolaTheme";

/**
 * Evento oficial do projeto para sincronização de tema na mesma aba.
 */
const THEME_EVENT = "escola-theme-change";

const THEME_VALIDO = new Set(["light", "dark", "system"]);

function normalizeTheme(value) {
  const theme = String(value || "").trim().toLowerCase();

  return THEME_VALIDO.has(theme) ? theme : "system";
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export default function useEscolaTheme() {
  const [theme, setThemeState] = useState(() =>
    normalizeTheme(getStoredTheme() || "system")
  );

  const themeRef = useRef(theme);
  const lastAppliedRef = useRef(null);
  const systemUnsubRef = useRef(null);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  /**
   * Aplica tema no DOM e persiste no storage.
   *
   * Importante:
   * - O controle de redundância usa theme + effectiveTheme.
   * - Isso corrige o caso em que theme = "system", mas o SO muda de light para dark.
   */
  const commitTheme = useCallback((nextTheme, options = {}) => {
    const { force = false, persist = true } = options;

    const normalized = normalizeTheme(nextTheme);
    const effective = getEffectiveTheme(normalized);
    const appliedKey = `${normalized}:${effective}`;

    if (!force && lastAppliedRef.current === appliedKey) {
      return;
    }

    lastAppliedRef.current = appliedKey;

    applyThemeToHtml(normalized);

    if (persist) {
      setStoredTheme(normalized);
    }
  }, []);

  const dispatchThemeEvent = useCallback((nextTheme, source = "hook") => {
    if (!canUseWindow()) {
      return;
    }

    try {
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, {
          detail: {
            theme: normalizeTheme(nextTheme),
            source,
          },
        })
      );
    } catch {
      // não bloquear a interface por falha de evento
    }
  }, []);

  /**
   * Setter oficial.
   */
  const setTheme = useCallback(
    (nextTheme) => {
      const normalized = normalizeTheme(nextTheme);

      commitTheme(normalized, {
        force: normalized === "system",
        persist: true,
      });

      if (themeRef.current !== normalized) {
        themeRef.current = normalized;
        setThemeState(normalized);
      }

      dispatchThemeEvent(normalized, "hook");
    },
    [commitTheme, dispatchThemeEvent]
  );

  /**
   * Montagem inicial:
   * - lê storage;
   * - sincroniza estado React;
   * - aplica no HTML.
   */
  useEffect(() => {
    const stored = normalizeTheme(getStoredTheme() || "system");

    themeRef.current = stored;
    setThemeState(stored);

    commitTheme(stored, {
      force: true,
      persist: true,
    });
  }, [commitTheme]);

  /**
   * Observa mudanças do modo "system".
   */
  useEffect(() => {
    const normalized = normalizeTheme(theme);

    commitTheme(normalized, {
      force: normalized === "system",
      persist: true,
    });

    if (systemUnsubRef.current) {
      systemUnsubRef.current();
      systemUnsubRef.current = null;
    }

    if (normalized === "system") {
      systemUnsubRef.current = watchSystemTheme(() => {
        commitTheme("system", {
          force: true,
          persist: true,
        });

        dispatchThemeEvent("system", "system");
      });
    }

    return () => {
      if (systemUnsubRef.current) {
        systemUnsubRef.current();
        systemUnsubRef.current = null;
      }
    };
  }, [theme, commitTheme, dispatchThemeEvent]);

  /**
   * Sincronização na mesma aba.
   */
  useEffect(() => {
    if (!canUseWindow()) {
      return undefined;
    }

    const onTheme = (event) => {
      const incoming = normalizeTheme(event?.detail?.theme);

      commitTheme(incoming, {
        force: incoming === "system",
        persist: true,
      });

      if (incoming !== themeRef.current) {
        themeRef.current = incoming;
        setThemeState(incoming);
      }
    };

    window.addEventListener(THEME_EVENT, onTheme);

    return () => {
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, [commitTheme]);

  /**
   * Sincronização entre abas.
   */
  useEffect(() => {
    if (!canUseWindow()) {
      return undefined;
    }

    const onStorage = (event) => {
      if (event.key !== ESCOLA_THEME_KEY) {
        return;
      }

      const incoming = normalizeTheme(event.newValue);

      commitTheme(incoming, {
        force: incoming === "system",
        persist: false,
      });

      if (incoming !== themeRef.current) {
        themeRef.current = incoming;
        setThemeState(incoming);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [commitTheme]);

  const effectiveTheme = useMemo(() => getEffectiveTheme(theme), [theme]);
  const isDark = effectiveTheme === "dark";

  return {
    theme,
    setTheme,
    effectiveTheme,
    isDark,
    STORAGE_KEY: ESCOLA_THEME_KEY,
    EVENT_NAME: THEME_EVENT,
  };
}