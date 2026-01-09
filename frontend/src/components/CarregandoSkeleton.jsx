// 📁 src/components/CarregandoSkeleton.jsx
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Skeleton de carregamento para listas/blocos de texto.
 * - Prefer-reduced-motion respeitado (desliga pulse + shimmer).
 * - Largura “randômica” determinística (com seed) para evitar divergência de hidratação.
 * - Acessível: role="status", aria-busy, aria-live + sr-only.
 * - Personalizável: linhas, altura, cor, rounded, shimmer, larguraVariada, seed e container "as".
 */
export default function CarregandoSkeleton({
  linhas = 3,
  altura = 20,
  cor = "gray",            // 'gray' | 'verde'
  larguraVariada = true,
  className = "",
  shimmer = true,          // brilho transversal por linha
  rounded = "md",          // 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  ariaLabel = "Carregando conteúdo…",
  srText = "Carregando…",  // texto visível apenas a leitores de tela
  as: As = motion.div,     // container (div/section/article...), com motion por padrão
  seed = 0,                // muda o padrão determinístico das larguras
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

  // Largura “randômica” determinística por índice + seed (estável em SSR/CSR)
  const widthFor = (i) => {
    if (!larguraVariada) return "100%";
    // LCG simples e estável
    const m = 233280, a = 9301, c = 49297;
    const s = (i + 1) * 97 + (seed % 997); // pequena variação por seed
    const r = ((a * s + c) % m) / m; // 0..1
    const pct = Math.max(0.4, r) * 100; // mínimo 40% para evitar linhas minguadas
    return `${pct.toFixed(0)}%`;
  };

  // Container: sem animação infinita para não “cutucar” leitores de tela
  const containerMotion = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0.8 }, animate: { opacity: 1 }, transition: { duration: 0.28, ease: "easeOut" } };

  // Shimmer por linha (desligado se reduceMotion || shimmer=false)
  const shimmerClass =
    !reduceMotion && shimmer
      ? "relative overflow-hidden after:content-[''] after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent dark:after:via-white/10 after:animate-[shimmer_1.2s_infinite]"
      : "";

  // Pulse por linha (desligado se reduceMotion)
  const pulseClass = reduceMotion ? "" : "animate-pulse";

  return (
    <As
      className={`space-y-3 py-4 px-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
      {...containerMotion}
    >
      <span className="sr-only">{srText}</span>

      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          style={{ width: widthFor(i), height: altura }}
          className={`${radius} ${baseColor} ${pulseClass} ${shimmerClass}`}
          role="presentation"
          aria-hidden="true"
        />
      ))}
    </As>
  );
}

CarregandoSkeleton.propTypes = {
  linhas: PropTypes.number,
  altura: PropTypes.number,
  cor: PropTypes.oneOf(["gray", "verde"]),
  larguraVariada: PropTypes.bool,
  className: PropTypes.string,
  shimmer: PropTypes.bool,
  rounded: PropTypes.oneOf(["none", "sm", "md", "lg", "xl", "2xl", "full"]),
  ariaLabel: PropTypes.string,
  srText: PropTypes.string,
  as: PropTypes.elementType,
  seed: PropTypes.number,
};

/* Tailwind keyframes sugeridos (adicione no tailwind.config ou CSS global):
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
*/
