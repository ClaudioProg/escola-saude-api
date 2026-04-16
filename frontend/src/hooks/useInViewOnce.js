// ✅ src/hooks/useInViewOnce.js — PREMIUM++
// - SSR-safe
// - Fallback se IntersectionObserver não existir
// - Permite threshold / root / rootMargin
// - triggerOnce=true por padrão
// - Mantém API simples e compatível

import { useEffect, useRef, useState } from "react";

function canUseIO() {
  return typeof window !== "undefined" && "IntersectionObserver" in window;
}

export function useInViewOnce({
  root = null,
  rootMargin = "300px",
  threshold = 0,
  triggerOnce = true,
} = {}) {
  const ref = useRef(null);
  const observerRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // já entrou e é só uma vez
    if (triggerOnce && inView) return undefined;

    const el = ref.current;
    if (!el) return undefined;

    // fallback para browsers/ambientes sem IO
    if (!canUseIO()) {
      setInView(true);
      return undefined;
    }

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);

        if (!visible) return;

        setInView(true);

        if (triggerOnce) {
          observerRef.current?.disconnect();
          observerRef.current = null;
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [inView, root, rootMargin, threshold, triggerOnce]);

  return { ref, inView };
}

export default useInViewOnce;