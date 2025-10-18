// 📁 src/components/CarregandoSkeleton.jsx
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Skeleton de carregamento para listas/blocos de texto.
 * - Aceita número de linhas, altura e largura randômica opcional (determinística).
 * - Respeita prefers-reduced-motion.
 * - Acessível (aria-busy / aria-live).
 */
export default function CarregandoSkeleton({
  linhas = 3,
  altura = 20,
  cor = "gray",        // 'gray' | 'verde'
  larguraVariada = true,
  className = "",
  shimmer = true,      // ativa brilho lateral (desliga com prefers-reduced-motion)
  rounded = "md",      // 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  ariaLabel = "Carregando conteúdo…",
}) {
  const reduceMotion = useReducedMotion();

  const baseColor =
    cor === "verde"
      ? "bg-green-100 dark:bg-green-900/40"
      : "bg-gray-200 dark:bg-gray-700";

  const radius = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded] || "rounded-md";

  // “Randômico” determinístico por índice → evita hidratação divergente
  const widthFor = (i) => {
    if (!larguraVariada) return "100%";
    // LCG simples baseado no índice
    const m = 233280, a = 9301, c = 49297;
    const seed = (i + 1) * 97;
    const r = ((a * seed + c) % m) / m; // 0..1
    const pct = Math.max(0.4, r) * 100; // mantém >= 40%
    return `${pct.toFixed(0)}%`;
  };

  // Animação global (container) — desliga se reduceMotion
  const containerAnim = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0.5 }, animate: { opacity: 1 } };

  // Classe de shimmer por linha — desliga em reduceMotion ou shimmer=false
  const shimmerClass =
    !reduceMotion && shimmer
      ? "relative overflow-hidden after:content-[''] after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent dark:after:via-white/10 after:animate-[shimmer_1.2s_infinite]"
      : "";

  return (
    <motion.div
      className={`space-y-3 py-4 px-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
      {...containerAnim}
      transition={reduceMotion ? undefined : { duration: 0.8, repeat: Infinity, repeatType: "mirror" }}
    >
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          style={{ width: widthFor(i), height: altura }}
          className={`${radius} ${baseColor} ${reduceMotion ? "" : "animate-pulse"} ${shimmerClass}`}
          role="presentation"
          aria-hidden="true"
        />
      ))}
    </motion.div>
  );
}

CarregandoSkeleton.propTypes = {
  linhas: PropTypes.number,
  altura: PropTypes.number,
  cor: PropTypes.oneOf(["gray", "verde"]),
  larguraVariada: PropTypes.bool,
  className: PropTypes.string,
  /** Habilita brilho transversal (desativado automaticamente se prefers-reduced-motion) */
  shimmer: PropTypes.bool,
  /** Raio da borda (rounded) */
  rounded: PropTypes.oneOf(["none", "sm", "md", "lg", "xl", "2xl", "full"]),
  /** Texto para leitores de tela */
  ariaLabel: PropTypes.string,
};

/* Tailwind keyframes sugeridos (adicione no tailwind.config ou CSS global):
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
*/
