// 📁 src/components/PageHeader.jsx
import { motion } from "framer-motion";

/**
 * PageHeader
 * Props:
 * - title: string (obrigatório)
 * - icon: React component (ex.: BookOpen, CalendarDays, etc.)
 * - variant: "petroleo" | "violeta" | "dourado" | "laranja"
 * - className: string extra (opcional)
 */
export default function PageHeader({ title, icon: Icon, variant = "petroleo", className = "" }) {
  const variants = {
    petroleo: "bg-teal-800",   // azul petróleo (combina com verde lousa)
    violeta:  "bg-violet-700",
    dourado:  "bg-amber-700",
    laranja:  "bg-orange-700",
  };

  const bg = variants[variant] || variants.petroleo;

  return (
    <motion.header
      role="banner"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="print:hidden"
    >
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div
          className={[
            "w-full mx-auto",
            "flex items-center justify-center gap-3",
            "text-white rounded-xl shadow-sm",
            "px-4 py-3 md:px-6 md:py-4",
            "text-center",
            bg,
            className,
          ].join(" ")}
        >
          {Icon && <Icon size={22} aria-hidden="true" className="shrink-0" />}
          <h1 className="text-lg md:text-xl font-semibold leading-none">
            {title}
          </h1>
        </div>
      </div>
    </motion.header>
  );
}
