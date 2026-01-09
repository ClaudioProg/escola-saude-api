import { useEffect, useRef } from "react";

/**
 * Executa o efeito apenas uma vez, ignorando o StrictMode do React 18
 * (que chama useEffect duas vezes em desenvolvimento).
 * Ideal para inicializações seguras, como analytics, logs, listeners únicos etc.
 *
 * @param {Function} effect - função de efeito a executar uma única vez
 * @param {Array<any>} deps - dependências opcionais (apenas para consistência; ignoradas após a primeira execução)
 */
export function useOnceEffect(effect, deps = []) {
  const hasRun = useRef(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    // Impede execução dupla no Strict Mode (React 18)
    if (hasRun.current) return;

    hasRun.current = true;
    const cleanup = effect?.();

    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    }

    // Cleanup no unmount
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
