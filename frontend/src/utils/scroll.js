// 📁 src/utils/scroll.js
/**
 * Utilitário premium de bloqueio de rolagem:
 * - Preserva posição do scroll (sem “pulo”)
 * - Evita travar viewport em iOS Safari
 * - Compatível com múltiplos modais (lockCount)
 * - SSR-safe
 */

let lockCount = 0;
let prevScrollY = 0;
let scrollbarWidth = 0;

function hasWindow() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function lockScroll() {
  if (!hasWindow()) return;

  const html = document.documentElement;
  const body = document.body;
  if (!body || lockCount++ > 0) return; // já está travado por outro modal

  prevScrollY = window.scrollY || window.pageYOffset || 0;

  // Calcula largura da barra de rolagem (para evitar "jump")
  scrollbarWidth = window.innerWidth - html.clientWidth;
  if (scrollbarWidth > 0) {
    html.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    body.style.paddingRight = `${scrollbarWidth}px`;
  }

  // Aplica travamento
  body.dataset.prevTop = String(prevScrollY);
  body.style.position = "fixed";
  body.style.top = `-${prevScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";

  // Classe auxiliar (Tailwind / global CSS)
  html.classList.add("overflow-hidden");
  body.classList.add("overflow-hidden", "no-scroll", "modal-open");

  // Corrige iOS Safari (trava pull-to-refresh)
  html.style.height = "100%";
  body.style.height = "100%";
  body.style.touchAction = "none";
}

export function unlockScroll() {
  if (!hasWindow()) return;
  if (--lockCount > 0) return; // ainda há outro modal ativo

  const html = document.documentElement;
  const body = document.body;
  if (!body) return;

  const prevTop = parseInt(body.dataset.prevTop || "0", 10) || 0;

  html.classList.remove("overflow-hidden");
  body.classList.remove("overflow-hidden", "no-scroll", "modal-open");

  // Remove estilos fixos
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  body.style.paddingRight = "";
  body.style.height = "";
  body.style.touchAction = "";
  html.style.height = "";
  html.style.removeProperty("--scrollbar-width");

  delete body.dataset.prevTop;

  // Restaura rolagem
  try {
    window.scrollTo({ top: prevTop, behavior: "instant" });
  } catch {
    window.scrollTo(0, prevTop);
  }
}
