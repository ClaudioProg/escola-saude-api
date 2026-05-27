// 📁 src/utils/scroll.js — v2.0

/**
 * Utilitário oficial de bloqueio de rolagem.
 *
 * Função:
 * - Bloquear scroll do fundo ao abrir modal/drawer.
 * - Preservar posição da página.
 * - Evitar pulo visual causado pela barra de rolagem.
 * - Suportar múltiplos modais abertos simultaneamente.
 * - Restaurar estilos inline anteriores.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário.
 */

let lockCount = 0;
let previousScrollY = 0;
let previousStyles = null;

const HTML_LOCK_CLASS = "app-scroll-locked";
const BODY_LOCK_CLASS = "app-scroll-locked-body";
const BODY_MODAL_CLASS = "app-modal-open";
const DATA_SCROLL_LOCKED = "scrollLocked";
const DATA_SCROLL_TOP = "scrollTopBeforeLock";

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getScrollbarWidth(html) {
  if (!canUseDom() || !html) {
    return 0;
  }

  return Math.max(0, window.innerWidth - html.clientWidth);
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
      overflow: html.style.overflow,
      cssVarScrollbarWidth: html.style.getPropertyValue("--scrollbar-width"),
    },
  };
}

function restoreStyles(body, html, snapshot) {
  if (!snapshot) {
    return;
  }

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
  html.style.overflow = snapshot.html.overflow;

  if (snapshot.html.cssVarScrollbarWidth) {
    html.style.setProperty(
      "--scrollbar-width",
      snapshot.html.cssVarScrollbarWidth
    );
  } else {
    html.style.removeProperty("--scrollbar-width");
  }
}

function getCurrentScrollY() {
  if (!canUseDom()) {
    return 0;
  }

  return window.scrollY || window.pageYOffset || 0;
}

function restoreScrollPosition(scrollY) {
  if (!canUseDom()) {
    return;
  }

  try {
    window.scrollTo(0, scrollY);
  } catch {
    // noop
  }
}

function cleanupLockState(body, html) {
  html.classList.remove(HTML_LOCK_CLASS);
  body.classList.remove(BODY_LOCK_CLASS, BODY_MODAL_CLASS);

  delete body.dataset[DATA_SCROLL_LOCKED];
  delete body.dataset[DATA_SCROLL_TOP];

  previousStyles = null;
  previousScrollY = 0;
}

export function lockScroll() {
  if (!canUseDom()) {
    return false;
  }

  const html = document.documentElement;
  const body = document.body;

  if (!html || !body) {
    return false;
  }

  if (lockCount > 0) {
    lockCount += 1;
    return true;
  }

  lockCount = 1;
  previousScrollY = getCurrentScrollY();
  previousStyles = snapshotStyles(body, html);

  const scrollbarWidth = getScrollbarWidth(html);

  if (scrollbarWidth > 0) {
    html.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    body.style.paddingRight = `${scrollbarWidth}px`;
  }

  body.dataset[DATA_SCROLL_LOCKED] = "true";
  body.dataset[DATA_SCROLL_TOP] = String(previousScrollY);

  html.classList.add(HTML_LOCK_CLASS);
  body.classList.add(BODY_LOCK_CLASS, BODY_MODAL_CLASS);

  html.style.height = "100%";
  html.style.overflow = "hidden";

  body.style.position = "fixed";
  body.style.top = `-${previousScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.height = "100%";
  body.style.touchAction = "none";

  return true;
}

export function unlockScroll() {
  if (!canUseDom()) {
    return false;
  }

  if (lockCount <= 0) {
    lockCount = 0;
    return false;
  }

  lockCount -= 1;

  if (lockCount > 0) {
    return true;
  }

  const html = document.documentElement;
  const body = document.body;

  if (!html || !body) {
    lockCount = 0;
    previousStyles = null;
    previousScrollY = 0;
    return false;
  }

  const scrollY =
    Number.parseInt(body.dataset[DATA_SCROLL_TOP] || "", 10) ||
    previousScrollY ||
    0;

  restoreStyles(body, html, previousStyles);
  cleanupLockState(body, html);
  restoreScrollPosition(scrollY);

  return true;
}

/**
 * Recuperação de emergência.
 *
 * Uso:
 * - erro inesperado ao fechar modal;
 * - troca brusca de rota;
 * - desmontagem de árvore React;
 * - diagnóstico/admin.
 */
export function forceUnlockScroll() {
  if (!canUseDom()) {
    return false;
  }

  const html = document.documentElement;
  const body = document.body;

  if (!html || !body) {
    lockCount = 0;
    previousStyles = null;
    previousScrollY = 0;
    return false;
  }

  const estavaTravado =
    lockCount > 0 ||
    body.dataset[DATA_SCROLL_LOCKED] === "true" ||
    body.classList.contains(BODY_LOCK_CLASS) ||
    html.classList.contains(HTML_LOCK_CLASS);

  if (!estavaTravado) {
    lockCount = 0;
    previousStyles = null;
    previousScrollY = 0;
    return false;
  }

  lockCount = 1;
  return unlockScroll();
}

export function getScrollLockState() {
  return {
    locked: lockCount > 0,
    lockCount,
    previousScrollY,
  };
}