// public/boot-theme.js
try {
    var t = localStorage.getItem("theme");
    var root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
      if (t !== "light") localStorage.setItem("theme", "light");
    }
  } catch (e) {}
  