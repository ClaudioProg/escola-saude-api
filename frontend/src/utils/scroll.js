// 📁 src/utils/scroll.js — PREMIUM++
/**
 * Utilitário premium de bloqueio de rolagem:
 * - Preserva posição do scroll (sem “pulo”)
 * - Evita travar viewport em iOS Safari
 * - Compatível com múltiplos modais (lockCount)
 * - SSR-safe
 * - Restaura estilos inline anteriores
 */

let lockCount = 0;
let prevScrollY = 0;
let scrollbarWidth = 0;

let prevStyles = null;

function hasWindow() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function snapshotStyles(body, html) {
  return {
    body: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      height: body.style.height,
      touchAction: body.style.touchAction,
    },
    html: {
      height: html.style.height,
      cssVarScrollbarWidth: html.style.getPropertyValue("--scrollbar-width"),
    },
  };
}

function restoreStyles(body, html, snapshot) {
  if (!snapshot) return;

  body.style.position = snapshot.body.position;
  body.style.top = snapshot.body.top;
  body.style.left = snapshot.body.left;
  body.style.right = snapshot.body.right;
  body.style.width = snapshot.body.width;
  body.style.overflow = snapshot.body.overflow;
  body.style.paddingRight = snapshot.body.paddingRight;
  body.style.height = snapshot.body.height;
  body.style.touchAction = snapshot.body.touchAction;

  html.style.height = snapshot.html.height;

  if (snapshot.html.cssVarScrollbarWidth) {
    html.style.setProperty("--scrollbar-width", snapshot.html.cssVarScrollbarWidth);
  } else {
    html.style.removeProperty("--scrollbar-width");
  }
}

export function lockScroll() {
  if (!hasWindow()) return;

  const html = document.documentElement;
  const body = document.body;
  if (!body) return;

  // já está travado por outro modal
  if (lockCount > 0) {
    lockCount += 1;
    return;
  }

  lockCount = 1;
  prevScrollY = window.scrollY || window.pageYOffset || 0;
  prevStyles = snapshotStyles(body, html);

  // Calcula largura da barra de rolagem (para evitar "jump")
  scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

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

  // Classes auxiliares
  html.classList.add("overflow-hidden");
  body.classList.add("overflow-hidden", "no-scroll", "modal-open");

  // Ajustes extras para iOS / viewport
  html.style.height = "100%";
  body.style.height = "100%";
  body.style.touchAction = "none";
}

export function unlockScroll() {
  if (!hasWindow()) return;
  if (lockCount <= 0) {
    lockCount = 0;
    return;
  }

  lockCount -= 1;
  if (lockCount > 0) return;

  const html = document.documentElement;
  const body = document.body;
  if (!body) {
    lockCount = 0;
    return;
  }

  const prevTop = parseInt(body.dataset.prevTop || String(prevScrollY || 0), 10) || 0;

  html.classList.remove("overflow-hidden");
  body.classList.remove("overflow-hidden", "no-scroll", "modal-open");

  restoreStyles(body, html, prevStyles);
  prevStyles = null;

  delete body.dataset.prevTop;

  try {
    window.scrollTo({ top: prevTop, behavior: "instant" });
  } catch {
    window.scrollTo(0, prevTop);
  }
}