/* public/theme-boot.js — PREMIUM++ (robusto, zero-flash, sync com mudanças do sistema)
   - Sem inline/nonce/hash (CSP-friendly)
   - Evita “flash” de tema: aplica o mais cedo possível
   - Migração: suporta "escola_theme" e "theme"
   - Respeita: "light" | "dark" | "system"
   - Atualiza se o usuário estiver em "system" e o SO mudar (opcional, mas premium)
*/
(function () {
  "use strict";

  var KEY_PRIMARY = "escola_theme";
  var KEY_LEGACY = "theme";

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function normalize(v) {
    v = (v == null ? "" : String(v)).trim().toLowerCase();
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  }

  function prefersDarkNow() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch (_) {
      return false;
    }
  }

  function apply(mode) {
    var root = document.documentElement;
    var useDark = mode === "dark" || (mode === "system" && prefersDarkNow());
    if (useDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }

  function readMode() {
    var saved = safeGet(KEY_PRIMARY);
    if (!saved) saved = safeGet(KEY_LEGACY); // migração
    return normalize(saved);
  }

  // aplica imediatamente
  var mode = readMode();
  apply(mode);

  // premium: se estiver em "system", reage a mudanças do SO
  // (sem leaks, sem quebrar browsers antigos)
  try {
    if (mode === "system" && window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");

      var onChange = function () {
        // só reage se continuar em system
        var current = readMode();
        if (current !== "system") return;
        apply("system");
      };

      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (_) {
    // silencioso
  }
})();
