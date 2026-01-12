/* public/theme-boot.js — boot premium (sem inline, sem nonce/hash) */
(function () {
    try {
      var KEY = "escola_theme";
      var saved = localStorage.getItem(KEY) || localStorage.getItem("theme"); // migração
      var valid = (saved === "light" || saved === "dark" || saved === "system") ? saved : "system";
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var useDark = (valid === "dark") || (valid === "system" && prefersDark);
      var root = document.documentElement;
      if (useDark) root.classList.add("dark");
      else root.classList.remove("dark");
    } catch (e) {
      // silêncio intencional
    }
  })();
  