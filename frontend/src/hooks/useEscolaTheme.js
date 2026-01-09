// 📁 src/hooks/useEscolaTheme.js
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  getEffectiveTheme,
  watchSystemTheme,
  getStoredTheme,
  setStoredTheme,
} from "../theme/escolaTheme";

// Nota: o boot-theme.js já aplica o tema antes da hidratação.
// Este hook mantém tudo sincronizado com o React (UI/botões/menus).

export default function useEscolaTheme() {
  // SSR-safe: inicializa lendo do localStorage quando possível
  const initial = (() => getStoredTheme() || "system")();
  const [theme, setTheme] = useState(initial); // "light" | "dark" | "system"
  const unsubscribeRef = useRef(null);

  // Aplica e persiste sempre que mudar
  useEffect(() => {
    applyThemeToHtml(theme);
    setStoredTheme(theme);

    // Se "system", escuta alterações do SO
    if (theme === "system") {
      unsubscribeRef.current?.();
      unsubscribeRef.current = watchSystemTheme(() => {
        // Só reaplica quando for realmente "system"
        applyThemeToHtml("system");
      });
      return () => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      };
    } else {
      // Se fixo (light/dark), garante que não fica ouvindo o SO
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    }
  }, [theme]);

  // Tema efetivo (para UI)
  const effectiveTheme = useMemo(() => getEffectiveTheme(theme), [theme]);
  const isDark = effectiveTheme === "dark";

  return { theme, setTheme, effectiveTheme, isDark, STORAGE_KEY: ESCOLA_THEME_KEY };
}
