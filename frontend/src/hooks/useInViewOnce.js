// ✅ src/hooks/useInViewOnce.js — v2.0
import { useEffect, useRef, useState } from "react";

/**
 * Hook para detectar quando um elemento entra na viewport.
 *
 * Uso:
 * const { ref, inView } = useInViewOnce();
 *
 * <div ref={ref}>
 *   {inView ? <ComponentePesado /> : null}
 * </div>
 *
 * Observações:
 * - SSR-safe.
 * - Fallback para browsers sem IntersectionObserver.
 * - triggerOnce=true por padrão.
 * - Útil para lazy render, animações e gráficos.
 */

function canUseIntersectionObserver() {
  return (
    typeof window !== "undefined" &&
    typeof window.IntersectionObserver === "function"
  );
}

function normalizeThreshold(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .map((item) => Math.min(Math.max(item, 0), 1));
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 1);
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
    if (triggerOnce && inView) {
      return undefined;
    }

    const element = ref.current;

    if (!element) {
      return undefined;
    }

    if (!canUseIntersectionObserver()) {
      setInView(true);
      return undefined;
    }

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);

        if (!visible) {
          return;
        }

        setInView(true);

        if (triggerOnce) {
          observer.disconnect();
          observerRef.current = null;
        }
      },
      {
        root,
        rootMargin,
        threshold: normalizeThreshold(threshold),
      }
    );

    observerRef.current = observer;
    observer.observe(element);

    return () => {
      observer.disconnect();

      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [inView, root, rootMargin, threshold, triggerOnce]);

  return {
    ref,
    inView,
  };
}

export default useInViewOnce;