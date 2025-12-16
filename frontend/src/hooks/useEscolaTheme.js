// ✅ src/hooks/useEscolaTheme.js
import { useEffect, useMemo, useState } from "react";
import {
  ESCOLA_THEME_KEY,
  applyThemeToHtml,
  getEffectiveTheme,
  watchSystemTheme,
} from "../theme/escolaTheme";

export default function useEscolaTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(ESCOLA_THEME_KEY) || "system");

  useEffect(() => {
    applyThemeToHtml(theme);
    localStorage.setItem(ESCOLA_THEME_KEY, theme);

    if (theme !== "system") return;
    return watchSystemTheme(() => applyThemeToHtml("system"));
  }, [theme]);

  const effective = useMemo(() => getEffectiveTheme(theme), [theme]);
  const isDark = effective === "dark";

  return { theme, setTheme, effectiveTheme: effective, isDark };
}
