// hooks/useOnceEffect.js
import { useEffect, useRef } from "react";

export function useOnceEffect(effect, deps = []) {
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
