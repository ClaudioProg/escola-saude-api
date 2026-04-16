import { useEffect, useRef } from "react";

/**
 * Executa um efeito uma vez por montagem do componente.
 *
 * Importante:
 * - Em produção: roda uma vez normalmente.
 * - Em React 18 + StrictMode (desenvolvimento): o componente pode montar,
 *   desmontar e montar novamente para validações internas do React.
 *   Nesse cenário, este hook roda uma vez por montagem.
 *
 * Use para:
 * - listeners locais do componente
 * - inicializações idempotentes
 * - efeitos com cleanup seguro
 *
 * Não use como garantia de "executar uma única vez globalmente na aplicação".
 */
export function useOnceEffect(effect) {
  const hasRunRef = useRef(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (hasRunRef.current) return undefined;

    hasRunRef.current = true;

    const cleanup = effect?.();

    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    }

    return () => {
      if (typeof cleanupRef.current === "function") {
        cleanupRef.current();
      }
      cleanupRef.current = null;
    };
  }, []);
}

export default useOnceEffect;