// 📁 src/hooks/useEscolaTheme.js — PREMIUM (reativo + single source of truth)
// - Fonte única: src/theme/escolaTheme.js
// - Resolve bug “só muda tema no F5” (mesma aba) via CustomEvent
// - Sincroniza entre abas via storage event
// - “system” acompanha o SO em tempo real
// - SSR-safe, StrictMode-safe

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

export default function useEscolaTheme() {
  // SSR-safe init: lê storage (ou cai em system)
  const [theme, _setTheme] = useState(() => normalizeTheme(getStoredTheme() || "system"));

  // evita loop quando o próprio hook recebe evento e tenta reaplicar
  const lastAppliedRef = useRef(null);
  const systemUnsubRef = useRef(null);

  /**
   * Setter premium:
   * - aplica no DOM agora (imediato)
   * - persiste
   * - atualiza estado do React
   * - dispara evento (para mesma aba), caso o motor ainda não dispare (fallback)
   */
  const setTheme = useCallback((next) => {
    const normalized = normalizeTheme(next);

    // Atualiza React state
    _setTheme(normalized);

    // Aplica/persiste imediatamente (UX instantânea)
    applyThemeToHtml(normalized);
    setStoredTheme(normalized);

    // Fallback: se o motor não emitir, emitimos nós (não quebra se emitir em dobro;
    // o listener abaixo ignora repetidos via lastAppliedRef)
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, {
          detail: { theme: normalized, source: "hook" },
        })
      );
    } catch {
      /* noop */
    }
  }, []);

  // 1) Ao montar: garante consistência com o DOM já bootado
  useEffect(() => {
    const stored = normalizeTheme(getStoredTheme() || "system");
    // Se o boot já aplicou o tema, apenas sincroniza o estado React.
    _setTheme(stored);
  }, []);

  // 2) Quando theme muda (por state), manter watchers corretos (system)
  useEffect(() => {
    const normalized = normalizeTheme(theme);

    // Evita re-aplicar em cascata (principalmente em StrictMode)
    if (lastAppliedRef.current !== normalized) {
      lastAppliedRef.current = normalized;
      applyThemeToHtml(normalized);
      setStoredTheme(normalized);
    }

    // Watch do SO apenas quando "system"
    systemUnsubRef.current?.();
    systemUnsubRef.current = null;

    if (normalized === "system") {
      systemUnsubRef.current = watchSystemTheme(() => {
        // tema efetivo mudou → reaplica no DOM
        applyThemeToHtml("system");

        // avisa UI (mesma aba)
        try {
          window.dispatchEvent(
            new CustomEvent(THEME_EVENT, { detail: { theme: "system", source: "system" } })
          );
        } catch {
          /* noop */
        }
      });
    }

    return () => {
      systemUnsubRef.current?.();
      systemUnsubRef.current = null;
    };
  }, [theme]);

  // 3) Listener: mesmo tab (CustomEvent)
  useEffect(() => {
    const onTheme = (ev) => {
      const incoming = normalizeTheme(ev?.detail?.theme);

      if (incoming === theme) return;

      // Atualiza estado sem “reaplicar” redundante (effect cuida)
      _setTheme(incoming);
    };

    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, [theme]);

  // 4) Listener: outras abas (storage)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== ESCOLA_THEME_KEY) return;
      const incoming = normalizeTheme(e.newValue);

      if (incoming === theme) return;
      _setTheme(incoming);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [theme]);

  // Tema efetivo para UI
  const effectiveTheme = useMemo(() => getEffectiveTheme(theme), [theme]);
  const isDark = effectiveTheme === "dark";

  return {
    theme,            // "light" | "dark" | "system"
    setTheme,         // setter premium
    effectiveTheme,   // "light" | "dark"
    isDark,
    STORAGE_KEY: ESCOLA_THEME_KEY,
    EVENT_NAME: THEME_EVENT,
  };
}
